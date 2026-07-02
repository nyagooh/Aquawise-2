"""
Synchronous GIS upload → frontend GeoJSON converter.

Reuses the classification / normalisation / asset-synthesis logic from
`GIS/scripts/shapefile_to_geojson.py`, but generalised to accept arbitrary
uploads (zipped shapefile, GeoJSON, KML/KMZ) and reproject any source CRS to
WGS84 via pyproj. No database, no Celery — runs inline in the request and
returns the exact { pipes, assets, meta } shape the React map consumes.
"""
from __future__ import annotations

import json
import math
import os
import tempfile
import zipfile
from collections import Counter, defaultdict

import fiona
from pyproj import CRS as ProjCRS
from pyproj import Transformer

# ── classification / normalisation (ported from scripts/shapefile_to_geojson.py) ──

NET_MAIN = "transmission"
NET_DIST = "distribution"
NET_SERVICE = "service"
NET_BACKFEED = "backfeed"
NET_BOUNDARY = "boundary"

# Field-name candidates — attribute schemas vary wildly between utilities, so
# we probe a list of common aliases (case-insensitive) for each concept.
_NETWORK_FIELDS = ["network", "net", "class", "category", "type", "pipe_type", "func", "function"]
_MATERIAL_FIELDS = ["material", "mat", "pipe_mat", "matl", "material_t"]
_STATUS_FIELDS = ["status", "stat", "pipe_stat", "condition"]
_SERVICE_FIELDS = ["servicesta", "service", "service_st", "in_service"]
_DIAMETER_FIELDS = ["diameter", "diam", "dia", "diameter_mm", "pipe_diam", "width", "dn"]
_DIA_DN_FIELDS = ["dia_dn", "dn", "nominal"]
_DIA_INCH_FIELDS = ["dia_inch", "inch", "dia_in"]
_ZONE_FIELDS = ["zone", "zone_id", "dma", "dma_id", "zone_name", "district"]
_YEAR_FIELDS = ["inst_date", "datemapped", "date_mapped", "year", "install_yr", "installation_year", "year_inst"]
_LENGTH_FIELDS = ["length", "length_m", "len", "shape_leng", "shape_length"]
_NODEFROM_FIELDS = ["node1", "nodel1", "node_from", "from_node", "start"]
_NODETO_FIELDS = ["node2", "nodel2", "node_to", "to_node", "end"]
_REMARKS_FIELDS = ["remarks", "remark", "notes", "comment"]


def _find(props, candidates):
    low = {k.lower(): k for k in props}
    for c in candidates:
        if c.lower() in low:
            return props[low[c.lower()]]
    return None


def classify_network(raw) -> str:
    if not raw:
        return NET_DIST
    v = str(raw).strip().lower()
    if "transm" in v or "rising" in v or "trunk" in v or "main" in v:
        return NET_MAIN
    if "service" in v or "household" in v or "connection" in v:
        return NET_SERVICE
    if "imaginary" in v or "boundary" in v or "dma" in v or "zone" in v:
        return NET_BOUNDARY
    return NET_DIST


def ui_class_for(network_class: str, status: str) -> str:
    if network_class == NET_BOUNDARY:
        return "boundary"
    if status == "closed":
        return "backfeed"
    if network_class == NET_MAIN:
        return "main"
    if network_class == NET_SERVICE:
        return "household"
    return "distribution"


def age_bucket(year):
    if year is None:
        return "unknown"
    if year < 2000:
        return "pre-2000"
    if year < 2010:
        return "2000-2009"
    if year < 2020:
        return "2010-2019"
    return "2020+"


def diameter_bucket(mm):
    if mm is None:
        return "unknown"
    if mm < 50:
        return "<50 mm"
    if mm < 100:
        return "50-99 mm"
    if mm < 200:
        return "100-199 mm"
    if mm < 350:
        return "200-349 mm"
    return ">=350 mm"


def normalise_material(raw):
    if not raw:
        return None
    v = str(raw).strip().upper()
    if v in {"PVC", "UPVC", "HDPE", "DHPE", "PE", "GI", "STEEL", "PPR", "AC"}:
        if v == "DHPE":
            return "HDPE"
        if v == "UPVC":
            return "uPVC"
        if v == "STEEL":
            return "Steel"
        return v
    if v.isdigit():
        return None
    return str(raw).strip()


def normalise_status(raw):
    if not raw:
        return "unknown"
    v = str(raw).strip().upper()
    if v.startswith("OPEN") or v == "FUNCTIONAL":
        return "open"
    if v.startswith("CLOS"):
        return "closed"
    return "unknown"


def normalise_service(raw):
    if not raw:
        return "unknown"
    v = str(raw).strip().lower()
    if "out" in v or "not" in v:
        return "out-of-service"
    if "pending" in v:
        return "pending"
    if "service" in v or "serevic" in v or "serv" in v:
        return "in-service"
    return "unknown"


def parse_year(raw):
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        v = int(raw)
        return v if 1950 < v < 2100 else None
    s = str(raw)
    for tok in s.replace(".", " ").replace("-", " ").replace("/", " ").split():
        if tok.isdigit():
            n = int(tok)
            if 1950 < n < 2100:
                return n
    return None


def _diameter_mm(props):
    raw = _find(props, _DIAMETER_FIELDS)
    if isinstance(raw, (int, float)) and 5 < raw < 1500:
        return int(raw)
    dn = _find(props, _DIA_DN_FIELDS)
    if isinstance(dn, str):
        digits = "".join(c for c in dn if c.isdigit())
        if digits:
            val = int(digits)
            if 5 < val < 1500:
                return val
    inch = _find(props, _DIA_INCH_FIELDS)
    if isinstance(inch, (int, float)) and 0 < inch < 50:
        return int(round(inch * 25.4))
    return None


def _haversine_len(line) -> float:
    total = 0.0
    for i in range(1, len(line)):
        lat1 = math.radians(line[i - 1][1])
        lat2 = math.radians(line[i][1])
        dlat = lat2 - lat1
        dlon = math.radians(line[i][0] - line[i - 1][0])
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        total += 2 * 6378137.0 * math.asin(math.sqrt(a))
    return total


# ── geometry iteration ────────────────────────────────────────────────────

def _line_parts(geom):
    """Yield each LineString part as a list of (lon, lat) coords."""
    if not geom:
        return
    t = geom.get("type")
    c = geom.get("coordinates")
    if t == "LineString":
        yield c
    elif t == "MultiLineString":
        for part in c:
            yield part
    elif t == "GeometryCollection":
        for g in geom.get("geometries", []):
            yield from _line_parts(g)


def _make_transformer(crs):
    try:
        proj = ProjCRS.from_user_input(crs)
    except Exception:
        return None
    if proj.equals("EPSG:4326"):
        return None
    return Transformer.from_crs(proj, "EPSG:4326", always_xy=True)


# ── feature sources ─────────────────────────────────────────────────────────

def _features_from_geojson(text):
    data = json.loads(text)
    crs_name = None
    try:
        crs_name = data.get("crs", {}).get("properties", {}).get("name")
    except Exception:
        crs_name = None
    transformer = _make_transformer(crs_name) if crs_name else None
    feats = data.get("features", []) if data.get("type") == "FeatureCollection" else [data]
    for f in feats:
        yield f.get("geometry"), (f.get("properties") or {}), transformer


def _features_from_fiona(path):
    for layer in fiona.listlayers(path):
        with fiona.open(path, layer=layer) as src:
            transformer = _make_transformer(src.crs_wkt or src.crs)
            for feat in src:
                geom = feat["geometry"]
                if geom is not None and not isinstance(geom, dict):
                    from fiona.model import to_dict as _td
                    geom = _td(geom)
                props = dict(feat["properties"] or {})
                yield geom, props, transformer


def _iter_source_features(filename, raw_bytes):
    """Yield (geom_dict, props, transformer) tuples for any supported upload."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("geojson", "json"):
        yield from _features_from_geojson(raw_bytes.decode("utf-8", "replace"))
        return

    with tempfile.TemporaryDirectory() as tmp:
        if ext == "zip":
            zpath = os.path.join(tmp, "upload.zip")
            with open(zpath, "wb") as fh:
                fh.write(raw_bytes)
            with zipfile.ZipFile(zpath) as zf:
                zf.extractall(tmp)
            shp_paths = [
                os.path.join(root, f)
                for root, _, files in os.walk(tmp)
                for f in files
                if f.lower().endswith(".shp")
            ]
            geojson_paths = [
                os.path.join(root, f)
                for root, _, files in os.walk(tmp)
                for f in files
                if f.lower().endswith((".geojson", ".json"))
            ]
            if not shp_paths and not geojson_paths:
                raise ValueError("ZIP archive contains no .shp or .geojson files")
            for gj in geojson_paths:
                with open(gj, "r", encoding="utf-8", errors="replace") as fh:
                    yield from _features_from_geojson(fh.read())
            for shp in shp_paths:
                yield from _features_from_fiona(shp)
        elif ext in ("kml", "kmz"):
            path = os.path.join(tmp, filename)
            with open(path, "wb") as fh:
                fh.write(raw_bytes)
            yield from _features_from_fiona(path)
        else:
            raise ValueError(
                f"Unsupported file type '.{ext}'. Upload a .geojson, zipped shapefile (.zip), or .kml/.kmz."
            )


# ── main conversion ──────────────────────────────────────────────────────────

def convert_upload(filename: str, raw_bytes: bytes) -> dict:
    """Parse an uploaded GIS file into { pipes, assets, meta } for the map."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "inp":
        return convert_inp(filename, raw_bytes.decode("utf-8", "replace"))
    features = []
    skipped = 0
    by_class = Counter()
    by_zone = Counter()
    materials = Counter()
    diameters = Counter()
    statuses = Counter()
    services = Counter()
    age_dist = Counter()
    dia_dist = Counter()
    length_by_class = defaultdict(float)
    length_by_zone = defaultdict(float)
    length_by_material = defaultdict(float)
    total_length_m = 0.0

    endpoint_degree = defaultdict(int)
    endpoint_examples = {}

    bbox_lon = [180.0, -180.0]
    bbox_lat = [90.0, -90.0]
    idx = 0

    for geom, props, transformer in _iter_source_features(filename, raw_bytes):
        net_class = classify_network(_find(props, _NETWORK_FIELDS))
        material = normalise_material(_find(props, _MATERIAL_FIELDS))
        status = normalise_status(_find(props, _STATUS_FIELDS))
        service = normalise_service(_find(props, _SERVICE_FIELDS))
        year = parse_year(_find(props, _YEAR_FIELDS))
        diameter_mm = _diameter_mm(props)
        src_len = _find(props, _LENGTH_FIELDS)
        length_attr = src_len if isinstance(src_len, (int, float)) else None
        zone = _find(props, _ZONE_FIELDS)
        zone = str(zone).strip() if zone not in (None, "") else None

        for ring in _line_parts(geom):
            if not ring or len(ring) < 2:
                continue
            # reproject + dedup
            line = []
            for pt in ring:
                lon, lat = pt[0], pt[1]
                if transformer is not None:
                    lon, lat = transformer.transform(lon, lat)
                if not line or abs(lon - line[-1][0]) > 1e-7 or abs(lat - line[-1][1]) > 1e-7:
                    line.append([lon, lat])
            if len(line) < 2:
                skipped += 1
                continue

            geo_len_m = _haversine_len(line)
            if geo_len_m < 2.0:
                skipped += 1
                continue
            if geo_len_m < 5.0 and not zone and not material and not diameter_mm:
                skipped += 1
                continue
            if net_class == NET_SERVICE and geo_len_m < 3.0:
                skipped += 1
                continue

            length_m = length_attr if length_attr else geo_len_m

            for lon, lat in line:
                bbox_lon[0] = min(bbox_lon[0], lon)
                bbox_lon[1] = max(bbox_lon[1], lon)
                bbox_lat[0] = min(bbox_lat[0], lat)
                bbox_lat[1] = max(bbox_lat[1], lat)

            for end_idx in (0, -1):
                lon, lat = line[end_idx]
                key = (round(lon * 100000), round(lat * 100000))
                endpoint_degree[key] += 1
                endpoint_examples[key] = (lon, lat)

            ui_cls = ui_class_for(net_class, status)
            pid = f"P-{idx:05d}"
            idx += 1
            features.append({
                "type": "Feature",
                "id": pid,
                "geometry": {"type": "LineString", "coordinates": line},
                "properties": {
                    "id": pid,
                    "class": net_class,
                    "ui_class": ui_cls,
                    "network_raw": _find(props, _NETWORK_FIELDS),
                    "material": material,
                    "diameter_mm": diameter_mm,
                    "length_m": round(length_m, 1) if length_m else None,
                    "status": status,
                    "service": service,
                    "zone": zone,
                    "installed": year,
                    "node_from": _find(props, _NODEFROM_FIELDS),
                    "node_to": _find(props, _NODETO_FIELDS),
                    "remarks": _find(props, _REMARKS_FIELDS),
                    "layer": None,
                },
            })
            by_class[ui_cls] += 1
            statuses[status] += 1
            services[service] += 1
            age_dist[age_bucket(year)] += 1
            dia_dist[diameter_bucket(diameter_mm)] += 1
            if zone:
                by_zone[zone] += 1
                length_by_zone[zone] += length_m
            if material:
                materials[material] += 1
                length_by_material[material] += length_m
            if diameter_mm:
                diameters[diameter_mm] += 1
            total_length_m += length_m
            length_by_class[ui_cls] += length_m

    if not features:
        raise ValueError(
            f"No usable line features found in '{filename}'. "
            "The map renders pipe networks — upload a file containing LineString geometry."
        )

    asset_features = _synthesize_assets(features, endpoint_degree, endpoint_examples)
    return _build_payload(
        filename, features, asset_features, skipped,
        by_class, by_zone, materials, diameters, statuses, services,
        age_dist, dia_dist, length_by_class, length_by_zone, length_by_material,
        total_length_m, bbox_lon, bbox_lat,
    )


def _synthesize_assets(features, endpoint_degree, endpoint_examples):
    """Telemetry overlay derived from network topology (tanks/valves/sensors)."""
    junctions = [(deg, endpoint_examples[k]) for k, deg in endpoint_degree.items() if deg >= 3]
    junctions.sort(key=lambda t: -t[0])
    out = []

    for i, (deg, (lon, lat)) in enumerate(junctions[:6]):
        level = 60 + (i * 7) % 35
        out.append({
            "type": "Feature", "id": f"TANK-{i+1:02d}",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "asset": "tank", "id": f"TANK-{i+1:02d}", "name": f"Reservoir {i+1}",
                "capacity_m3": 800 + (i * 320) % 2400, "level_pct": level,
                "inflow_lps": 8 + (i * 3) % 14, "outflow_lps": 6 + (i * 5) % 13,
                "status": "ok" if 30 <= level <= 90 else "warn", "junction_degree": deg,
            },
        })

    deg2 = [endpoint_examples[k] for k, d in endpoint_degree.items() if d == 2]
    deg2.sort()
    for i, (lon, lat) in enumerate(deg2[::max(1, len(deg2) // 18)][:18]):
        target = [2.0, 2.5, 3.0, 3.5][i % 4]
        live = round(target + ((i * 0.27) % 1.4 - 0.7), 2)
        diff = abs(live - target)
        out.append({
            "type": "Feature", "id": f"PV-{i+1:02d}",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "asset": "pressure_valve", "id": f"PV-{i+1:02d}", "name": f"PRV {i+1}",
                "set_bar": target, "live_bar": live,
                "min_bar": round(target - 0.5, 2), "max_bar": round(target + 0.5, 2),
                "status": "ok" if diff < 0.4 else ("warn" if diff < 0.8 else "alert"),
            },
        })

    for i, (lon, lat) in enumerate(deg2[len(deg2) // 7:: max(1, len(deg2) // 22)][:22]):
        size = [50, 75, 100, 150, 200][i % 5]
        out.append({
            "type": "Feature", "id": f"MV-{i+1:02d}",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "asset": "meter_valve", "id": f"MV-{i+1:02d}", "name": f"Bulk meter MV-{i+1:02d}",
                "size_mm": size, "state": "open" if i % 6 else "throttled",
                "consumption_m3d": 120 + (i * 41) % 880, "status": "ok" if i % 9 else "warn",
            },
        })

    trunk = [f for f in features if f["properties"]["class"] in (NET_MAIN, NET_DIST)]
    step = max(1, len(trunk) // 26)
    for i, feat in enumerate(trunk[::step][:26]):
        coords = feat["geometry"]["coordinates"]
        lon, lat = coords[len(coords) // 2]
        out.append({
            "type": "Feature", "id": f"SN-{i+1:02d}",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "asset": "sensor", "id": f"SN-{i+1:02d}", "name": f"Flow + pressure sensor {i+1}",
                "type": "flow+pressure", "flow_lps": round(4 + (i * 1.7) % 18, 2),
                "pressure_bar": round(2.4 + (i * 0.21) % 1.6, 2),
                "last_seen": f"{(i*2 % 59) + 1}s ago", "status": "ok" if i % 11 else "alert",
                "pipe_id": feat["properties"]["id"],
            },
        })
    return out


def _build_payload(filename, features, asset_features, skipped, by_class, by_zone,
                   materials, diameters, statuses, services, age_dist, dia_dist,
                   length_by_class, length_by_zone, length_by_material,
                   total_length_m, bbox_lon, bbox_lat):
    def km(d):
        return {k: round(v / 1000.0, 2) for k, v in d.items()}

    asset_counts = defaultdict(int)
    for a in asset_features:
        asset_counts[a["properties"]["asset"]] += 1

    meta = {
        "source": filename.rsplit(".", 1)[0].replace("_", " ").title(),
        "feature_count": len(features),
        "skipped": skipped,
        "asset_count": len(asset_features),
        "asset_counts": dict(asset_counts),
        "by_class": dict(by_class),
        "length_km_by_class": km(length_by_class),
        "length_km_by_zone": km(length_by_zone),
        "length_km_by_material": km(length_by_material),
        "top_zones": by_zone.most_common(20),
        "zones_normalized": sorted(
            [(z, by_zone[z]) for z in by_zone if z and len(z) <= 10 and z.isupper()],
            key=lambda t: -t[1],
        ),
        "materials": materials.most_common(),
        "common_diameters_mm": diameters.most_common(12),
        "diameter_distribution": dict(dia_dist),
        "age_distribution": dict(age_dist),
        "status_counts": dict(statuses),
        "service_counts": dict(services),
        "total_length_m": round(total_length_m, 1),
        "total_length_km": round(total_length_m / 1000.0, 2),
        "bbox": [bbox_lon[0], bbox_lat[0], bbox_lon[1], bbox_lat[1]],
        "center": [(bbox_lon[0] + bbox_lon[1]) / 2, (bbox_lat[0] + bbox_lat[1]) / 2],
    }
    return {
        "pipes": {"type": "FeatureCollection", "features": features},
        "assets": {"type": "FeatureCollection", "features": asset_features},
        "meta": meta,
    }


# ── EPANET .inp hydraulic model parsing ──────────────────────────────────────

def _parse_inp_sections(text: str):
    """Split an EPANET .inp into {SECTION: [ [tokens...], ... ]}, dropping
    comments (everything after ';') and blank lines."""
    sections = defaultdict(list)
    current = None
    for raw in text.splitlines():
        line = raw.split(";", 1)[0].strip()
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1].strip().upper()
            continue
        if current is None:
            continue
        sections[current].append(line.split())
    return sections


def _num(tok, default=None):
    try:
        return float(tok)
    except (TypeError, ValueError):
        return default


def convert_inp(filename: str, text: str) -> dict:
    """Parse an EPANET .inp into the { pipes, assets, meta } map payload.

    Nodes (junctions, reservoirs, tanks) and links (pipes, pumps, valves) come
    straight from the model — no synthesis. [COORDINATES] place nodes and
    [VERTICES] add bend points. When coordinates fall outside lon/lat ranges we
    flag the model as 'schematic' so the frontend renders it on the No-basemap
    engineering canvas instead of a geographic map.
    """
    s = _parse_inp_sections(text)
    if not any(k in s for k in ("JUNCTIONS", "PIPES", "RESERVOIRS", "TANKS")):
        raise ValueError(
            f"'{filename}' does not look like an EPANET model — no [JUNCTIONS]/[PIPES] sections found."
        )

    # node id -> raw (x, y) from [COORDINATES]
    coords = {}
    for row in s.get("COORDINATES", []):
        if len(row) >= 3:
            x, y = _num(row[1]), _num(row[2])
            if x is not None and y is not None:
                coords[row[0]] = (x, y)

    # Detect projectability: are the raw coords already lon/lat?
    xs = [c[0] for c in coords.values()]
    ys = [c[1] for c in coords.values()]
    geographic = bool(coords) and all(-180 <= x <= 180 for x in xs) and all(-90 <= y <= 90 for y in ys) \
        and (max(xs) - min(xs) > 1e-4 or max(ys) - min(ys) > 1e-4)

    def project(pt):
        """Return (lon, lat). Geographic coords pass through; schematic coords
        are linearly fitted into a small synthetic window so Leaflet can still
        draw the model on the engineering canvas."""
        if geographic:
            return [pt[0], pt[1]]
        # normalise schematic x/y into a ~0.08° box near the equator
        if not xs or max(xs) == min(xs) or max(ys) == min(ys):
            return [pt[0], pt[1]]
        nx = (pt[0] - min(xs)) / (max(xs) - min(xs))
        ny = (pt[1] - min(ys)) / (max(ys) - min(ys))
        return [round(nx * 0.08, 6), round(ny * 0.08, 6)]

    # node kind lookup
    node_kind = {}
    for row in s.get("JUNCTIONS", []):
        if row:
            node_kind[row[0]] = "junction"
    elev = {row[0]: _num(row[1]) for row in s.get("JUNCTIONS", []) if len(row) >= 2}
    for row in s.get("RESERVOIRS", []):
        if row:
            node_kind[row[0]] = "reservoir"
    for row in s.get("TANKS", []):
        if row:
            node_kind[row[0]] = "tank"

    # link vertices: link id -> list of intermediate (x,y)
    verts = defaultdict(list)
    for row in s.get("VERTICES", []):
        if len(row) >= 3:
            x, y = _num(row[1]), _num(row[2])
            if x is not None and y is not None:
                verts[row[0]].append((x, y))

    features = []
    by_class = Counter()
    statuses = Counter()
    dia_dist = Counter()
    diameters = Counter()
    length_by_class = defaultdict(float)
    total_length_m = 0.0
    bbox_lon = [180.0, -180.0]
    bbox_lat = [90.0, -90.0]

    def _line_for_link(n1, n2, lid):
        if n1 not in coords or n2 not in coords:
            return None
        pts = [coords[n1], *verts.get(lid, []), coords[n2]]
        return [project(p) for p in pts]

    def _track_bbox(line):
        for lon, lat in line:
            bbox_lon[0] = min(bbox_lon[0], lon)
            bbox_lon[1] = max(bbox_lon[1], lon)
            bbox_lat[0] = min(bbox_lat[0], lat)
            bbox_lat[1] = max(bbox_lat[1], lat)

    # [PIPES]  ID Node1 Node2 Length Diam Roughness MinorLoss Status
    for row in s.get("PIPES", []):
        if len(row) < 3:
            continue
        lid, n1, n2 = row[0], row[1], row[2]
        line = _line_for_link(n1, n2, lid)
        if not line or len(line) < 2:
            continue
        length_m = _num(row[3]) if len(row) >= 4 else None
        diameter_mm = _num(row[4]) if len(row) >= 5 else None
        roughness = _num(row[5]) if len(row) >= 6 else None
        raw_status = row[7].lower() if len(row) >= 8 else "open"
        status = "closed" if raw_status in ("closed", "cv") else "open"
        ui_cls = "backfeed" if status == "closed" else ("main" if (diameter_mm or 0) >= 250 else "distribution")
        if length_m is None:
            length_m = _haversine_len(line) if geographic else 0.0
        _track_bbox(line)
        features.append({
            "type": "Feature", "id": lid,
            "geometry": {"type": "LineString", "coordinates": line},
            "properties": {
                "id": lid, "class": "transmission" if ui_cls == "main" else "distribution",
                "ui_class": ui_cls, "network_raw": "pipe",
                "material": None, "diameter_mm": int(diameter_mm) if diameter_mm else None,
                "length_m": round(length_m, 1) if length_m else None,
                "status": status, "service": "in-service",
                "zone": None, "installed": None,
                "node_from": n1, "node_to": n2,
                "remarks": f"roughness {roughness}" if roughness else None, "layer": "pipes",
            },
        })
        by_class[ui_cls] += 1
        statuses[status] += 1
        dia_dist[diameter_bucket(diameter_mm)] += 1
        if diameter_mm:
            diameters[int(diameter_mm)] += 1
        total_length_m += length_m or 0.0
        length_by_class[ui_cls] += length_m or 0.0

    # pumps + valves rendered as short link segments too (dashed via status)
    for sect, kind in (("PUMPS", "pump"), ("VALVES", "valve")):
        for row in s.get(sect, []):
            if len(row) < 3:
                continue
            lid, n1, n2 = row[0], row[1], row[2]
            line = _line_for_link(n1, n2, lid)
            if not line or len(line) < 2:
                continue
            _track_bbox(line)
            features.append({
                "type": "Feature", "id": lid,
                "geometry": {"type": "LineString", "coordinates": line},
                "properties": {
                    "id": lid, "class": "distribution", "ui_class": "distribution",
                    "network_raw": kind, "material": None, "diameter_mm": None,
                    "length_m": None, "status": "open", "service": "in-service",
                    "zone": None, "installed": None, "node_from": n1, "node_to": n2,
                    "remarks": kind, "layer": sect.lower(),
                },
            })
            by_class["distribution"] += 1

    # node-point assets: tanks/reservoirs → tank; valves → pressure_valve; pumps → meter_valve
    asset_features = []
    for nid, kind in node_kind.items():
        if kind in ("tank", "reservoir") and nid in coords:
            lon, lat = project(coords[nid])
            asset_features.append({
                "type": "Feature", "id": nid,
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "asset": "tank", "id": nid,
                    "name": f"{'Reservoir' if kind == 'reservoir' else 'Tank'} {nid}",
                    "capacity_m3": 1000, "level_pct": 65,
                    "inflow_lps": 10, "outflow_lps": 9,
                    "status": "ok", "junction_degree": 0,
                },
            })

    def _midpoint_asset(sect, asset, name, extra):
        for i, row in enumerate(s.get(sect, [])):
            if len(row) < 3:
                continue
            lid, n1, n2 = row[0], row[1], row[2]
            if n1 not in coords or n2 not in coords:
                continue
            p1, p2 = project(coords[n1]), project(coords[n2])
            mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
            props = {"asset": asset, "id": lid, "name": f"{name} {lid}", "status": "ok"}
            props.update(extra(i, row))
            asset_features.append({
                "type": "Feature", "id": lid,
                "geometry": {"type": "Point", "coordinates": mid},
                "properties": props,
            })

    _midpoint_asset("VALVES", "pressure_valve", "Valve",
                    lambda i, row: {"set_bar": 3.0, "live_bar": 3.0, "min_bar": 2.5, "max_bar": 3.5})
    _midpoint_asset("PUMPS", "meter_valve", "Pump",
                    lambda i, row: {"size_mm": 150, "state": "open", "consumption_m3d": 0})

    if not features:
        raise ValueError(
            f"No pipe links with usable coordinates found in '{filename}'. "
            "Ensure the model includes a [COORDINATES] section."
        )

    asset_counts = defaultdict(int)
    for a in asset_features:
        asset_counts[a["properties"]["asset"]] += 1

    node_total = len(node_kind)
    meta = {
        "source": filename.rsplit(".", 1)[0].replace("_", " ").title(),
        "model_kind": "epanet",
        "projection": "geographic" if geographic else "schematic",
        "feature_count": len(features),
        "node_count": node_total,
        "skipped": 0,
        "asset_count": len(asset_features),
        "asset_counts": dict(asset_counts),
        "by_class": dict(by_class),
        "length_km_by_class": {k: round(v / 1000.0, 2) for k, v in length_by_class.items()},
        "length_km_by_zone": {},
        "length_km_by_material": {},
        "top_zones": [],
        "zones_normalized": [],
        "materials": [],
        "common_diameters_mm": diameters.most_common(12),
        "diameter_distribution": dict(dia_dist),
        "age_distribution": {},
        "status_counts": dict(statuses),
        "service_counts": {},
        "total_length_m": round(total_length_m, 1),
        "total_length_km": round(total_length_m / 1000.0, 2),
        "bbox": [bbox_lon[0], bbox_lat[0], bbox_lon[1], bbox_lat[1]],
        "center": [(bbox_lon[0] + bbox_lon[1]) / 2, (bbox_lat[0] + bbox_lat[1]) / 2],
    }
    return {
        "pipes": {"type": "FeatureCollection", "features": features},
        "assets": {"type": "FeatureCollection", "features": asset_features},
        "meta": meta,
    }
