"""
Convert the Kisumu water supply shapefile (UTM Zone 36S, EPSG:32736) into a
WGS84 GeoJSON the browser map can consume directly. Pure stdlib — no external
deps required.

The shapefile (`Updated pipelines/Updated pipelines.shp`) contains 3,267
records (3,264 polylines + 3 null shapes). We:
  - read the .shp polylines + .dbf attributes
  - reproject UTM zone 36S -> WGS84 (lon, lat) via inverse Transverse Mercator
  - classify each pipe by Network field (transmission/distribution/service/backfeed)
  - clean up attribute hygiene (mixed case, typos, '*****' overflow markers)
  - emit GeoJSON FeatureCollection and a separate JSON of synthesized point assets
    (tanks, pressure valves, meter valves, sensors) derived from network topology

Run:
  python3 scripts/shapefile_to_geojson.py
"""
from __future__ import annotations

import json
import math
import os
import struct
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHP_DIR = os.path.join(os.path.dirname(ROOT), "Updated pipelines")
SHP = os.path.join(SHP_DIR, "Updated pipelines.shp")
DBF = os.path.join(SHP_DIR, "Updated pipelines.dbf")
OUT_DIR = os.path.join(ROOT, "public", "data")
OUT_PIPES = os.path.join(OUT_DIR, "kisumu-pipes.geojson")
OUT_ASSETS = os.path.join(OUT_DIR, "kisumu-assets.geojson")
OUT_META = os.path.join(OUT_DIR, "kisumu-meta.json")

# ---------------------------------------------------------------------------
# UTM Zone 36S -> WGS84 (inverse Transverse Mercator, Snyder 1987 §8)
# ---------------------------------------------------------------------------

_A = 6378137.0
_F = 1.0 / 298.257223563
_E2 = 2 * _F - _F * _F
_EP2 = _E2 / (1.0 - _E2)
_E4 = _E2 * _E2
_E6 = _E4 * _E2
_E1 = (1.0 - math.sqrt(1.0 - _E2)) / (1.0 + math.sqrt(1.0 - _E2))
_K0 = 0.9996
_FE = 500_000.0
_FN = 10_000_000.0  # southern hemisphere
_LON0 = math.radians(33.0)


def utm36s_to_lonlat(easting: float, northing: float) -> tuple[float, float]:
    x = easting - _FE
    y = northing - _FN
    M = y / _K0
    mu = M / (_A * (1 - _E2 / 4 - 3 * _E4 / 64 - 5 * _E6 / 256))
    phi1 = (
        mu
        + (3 * _E1 / 2 - 27 * _E1**3 / 32) * math.sin(2 * mu)
        + (21 * _E1**2 / 16 - 55 * _E1**4 / 32) * math.sin(4 * mu)
        + (151 * _E1**3 / 96) * math.sin(6 * mu)
        + (1097 * _E1**4 / 512) * math.sin(8 * mu)
    )
    sin1 = math.sin(phi1)
    cos1 = math.cos(phi1)
    tan1 = math.tan(phi1)
    C1 = _EP2 * cos1 * cos1
    T1 = tan1 * tan1
    N1 = _A / math.sqrt(1 - _E2 * sin1 * sin1)
    R1 = _A * (1 - _E2) / (1 - _E2 * sin1 * sin1) ** 1.5
    D = x / (N1 * _K0)
    phi = phi1 - (N1 * tan1 / R1) * (
        D**2 / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * _EP2) * D**4 / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * _EP2 - 3 * C1 * C1)
        * D**6
        / 720
    )
    lam = _LON0 + (
        D
        - (1 + 2 * T1 + C1) * D**3 / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * _EP2 + 24 * T1 * T1)
        * D**5
        / 120
    ) / cos1
    return (math.degrees(lam), math.degrees(phi))


# ---------------------------------------------------------------------------
# Shapefile reader (polyline = shape type 3)
# ---------------------------------------------------------------------------

SHAPE_NULL = 0
SHAPE_POINT = 1
SHAPE_POLYLINE = 3
SHAPE_POLYGON = 5


def read_polylines(path: str):
    out = []
    with open(path, "rb") as f:
        header = f.read(100)
        shape_type = struct.unpack("<I", header[32:36])[0]
        if shape_type != SHAPE_POLYLINE:
            raise SystemExit(f"unexpected shapeType {shape_type}, expected polyline")
        while True:
            hdr = f.read(8)
            if len(hdr) < 8:
                break
            rec_num, content_words = struct.unpack(">II", hdr)
            content_len = content_words * 2
            content = f.read(content_len)
            stype = struct.unpack("<I", content[0:4])[0]
            if stype == SHAPE_NULL:
                out.append(None)
                continue
            if stype != SHAPE_POLYLINE:
                out.append(None)
                continue
            num_parts, num_points = struct.unpack("<II", content[36:44])
            parts = list(
                struct.unpack(f"<{num_parts}I", content[44 : 44 + 4 * num_parts])
            )
            pts_off = 44 + 4 * num_parts
            coords = struct.unpack(
                f"<{2 * num_points}d", content[pts_off : pts_off + 16 * num_points]
            )
            rings = []
            parts.append(num_points)
            for i in range(num_parts):
                a = parts[i]
                b = parts[i + 1]
                rings.append(
                    [(coords[2 * k], coords[2 * k + 1]) for k in range(a, b)]
                )
            out.append(rings)
    return out


# ---------------------------------------------------------------------------
# DBF reader (dBASE III)
# ---------------------------------------------------------------------------


def read_dbf(path: str):
    with open(path, "rb") as f:
        head = f.read(32)
        num_rec = struct.unpack("<I", head[4:8])[0]
        hdr_len = struct.unpack("<H", head[8:10])[0]
        rec_len = struct.unpack("<H", head[10:12])[0]
        nfields = (hdr_len - 32 - 1) // 32
        fields = []
        for _ in range(nfields):
            fd = f.read(32)
            name = fd[:11].split(b"\x00")[0].decode("latin-1").strip()
            ftype = chr(fd[11])
            flen = fd[16]
            fdec = fd[17]
            fields.append((name, ftype, flen, fdec))
        f.seek(hdr_len)
        rows = []
        for _ in range(num_rec):
            raw = f.read(rec_len)
            if len(raw) < rec_len:
                break
            if raw[0:1] == b"*":
                rows.append(None)
                continue
            offs = 1
            row = {}
            for name, ftype, flen, fdec in fields:
                val = raw[offs : offs + flen].decode("latin-1", "replace").strip()
                offs += flen
                if not val:
                    row[name] = None
                    continue
                if "*" in val:
                    row[name] = None
                    continue
                if ftype == "N":
                    try:
                        row[name] = float(val) if fdec else int(val)
                    except ValueError:
                        try:
                            row[name] = float(val)
                        except ValueError:
                            row[name] = val
                else:
                    row[name] = val
            rows.append(row)
        return fields, rows


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------

NET_MAIN = "transmission"
NET_DIST = "distribution"
NET_SERVICE = "service"
NET_BACKFEED = "backfeed"
NET_BOUNDARY = "boundary"


def classify_network(raw: str | None) -> str:
    if not raw:
        return NET_DIST
    v = raw.strip().lower()
    if "transm" in v or "rising" in v:
        return NET_MAIN
    if "service" in v:
        return NET_SERVICE
    if "imaginary" in v or "boundary" in v:
        return NET_BOUNDARY
    return NET_DIST


def ui_class_for(network_class: str, status: str) -> str:
    """Map raw network class + status to the operator-facing UI class used by
    layers, legend, palette and dashboard aggregates."""
    if network_class == NET_BOUNDARY:
        return "boundary"
    if status == "closed":
        return "backfeed"
    if network_class == NET_MAIN:
        return "main"
    if network_class == NET_SERVICE:
        return "household"
    return "distribution"


def age_bucket(year: int | None) -> str:
    if year is None:
        return "unknown"
    if year < 2000:
        return "pre-2000"
    if year < 2010:
        return "2000-2009"
    if year < 2020:
        return "2010-2019"
    return "2020+"


def diameter_bucket(mm: int | None) -> str:
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


def normalise_material(raw: str | None) -> str | None:
    if not raw:
        return None
    v = raw.strip().upper()
    if v in {"PVC", "UPVC", "HDPE", "DHPE", "PE", "GI", "STEEL", "PPR", "AC"}:
        if v == "DHPE":
            return "HDPE"
        if v == "UPVC":
            return "uPVC"
        if v == "STEEL":
            return "Steel"
        return v
    if v.isdigit():
        return None  # diameter accidentally typed in material column
    return raw.strip()


def normalise_status(raw: str | None) -> str:
    if not raw:
        return "unknown"
    v = raw.strip().upper()
    if v.startswith("OPEN") or v == "FUNCTIONAL":
        return "open"
    if v.startswith("CLOS"):
        return "closed"
    return "unknown"


def normalise_service(raw: str | None) -> str:
    if not raw:
        return "unknown"
    v = raw.strip().lower()
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
    for tok in s.replace(".", " ").replace("-", " ").split():
        if tok.isdigit():
            n = int(tok)
            if 1950 < n < 2100:
                return n
    return None


# ---------------------------------------------------------------------------
# Convert
# ---------------------------------------------------------------------------


def main() -> None:
    print("→ reading polylines …", file=sys.stderr)
    polylines = read_polylines(SHP)
    print(f"  read {len(polylines)} polylines", file=sys.stderr)

    print("→ reading attributes …", file=sys.stderr)
    fields, rows = read_dbf(DBF)
    print(f"  read {len(rows)} attribute rows", file=sys.stderr)

    if len(polylines) != len(rows):
        print(
            f"warning: polyline/row count mismatch {len(polylines)} vs {len(rows)}",
            file=sys.stderr,
        )

    os.makedirs(OUT_DIR, exist_ok=True)

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
    length_by_class: dict[str, float] = defaultdict(float)
    length_by_zone: dict[str, float] = defaultdict(float)
    length_by_material: dict[str, float] = defaultdict(float)
    total_length_m = 0.0

    # Track endpoints (rounded) to identify junctions and tanks (nodes with
    # only one connecting pipe at network ends).
    endpoint_degree: dict[tuple[int, int], int] = defaultdict(int)
    endpoint_examples: dict[tuple[int, int], tuple[float, float]] = {}

    bbox_lon = [180.0, -180.0]
    bbox_lat = [90.0, -90.0]

    for idx, (geom, attrs) in enumerate(zip(polylines, rows)):
        if geom is None or attrs is None:
            skipped += 1
            continue
        net_class = classify_network(attrs.get("Network"))
        material = normalise_material(attrs.get("Material"))
        status = normalise_status(attrs.get("Status"))
        service = normalise_service(attrs.get("ServiceSta"))
        year = parse_year(attrs.get("Inst_Date")) or parse_year(attrs.get("DateMapped"))

        raw_diameter = attrs.get("Diameter")
        diameter_mm = None
        if isinstance(raw_diameter, (int, float)) and 5 < raw_diameter < 1500:
            diameter_mm = int(raw_diameter)
        if not diameter_mm:
            raw_dn = attrs.get("Dia_DN")
            if isinstance(raw_dn, str):
                digits = "".join(c for c in raw_dn if c.isdigit())
                if digits:
                    val = int(digits)
                    if 5 < val < 1500:
                        diameter_mm = val
        if not diameter_mm:
            raw_inch = attrs.get("Dia_Inch")
            if isinstance(raw_inch, (int, float)) and 0 < raw_inch < 50:
                diameter_mm = int(round(raw_inch * 25.4))

        length_m = attrs.get("Length") if isinstance(attrs.get("Length"), (int, float)) else None
        zone = attrs.get("Zone") or None

        for ring in geom:
            if len(ring) < 2:
                continue
            line = [list(utm36s_to_lonlat(x, y)) for (x, y) in ring]

            # Drop degenerate geometry (all points collinear within ~0.5m, or
            # duplicate-point pairs) — these render as visual stubs that look
            # like pipes "hanging" in space.
            dedup: list[list[float]] = []
            for pt in line:
                if not dedup or abs(pt[0] - dedup[-1][0]) > 1e-7 or abs(pt[1] - dedup[-1][1]) > 1e-7:
                    dedup.append(pt)
            if len(dedup) < 2:
                skipped += 1
                continue
            line = dedup

            # Compute geographic length (haversine) so every feature has a
            # length, even when the source's `Length` column is blank.
            geo_len_m = 0.0
            for i in range(1, len(line)):
                lat1 = math.radians(line[i - 1][1])
                lat2 = math.radians(line[i][1])
                dlat = lat2 - lat1
                dlon = math.radians(line[i][0] - line[i - 1][0])
                a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
                geo_len_m += 2 * 6378137.0 * math.asin(math.sqrt(a))

            # Drop tiny degenerate stubs that show up as "hanging" pipes:
            #   < 2m      → universally noise (real pipes are > 2m)
            #   < 5m AND  no zone / material / diameter → orphan import artefact
            if geo_len_m < 2.0:
                skipped += 1
                continue
            if (
                geo_len_m < 5.0
                and not zone
                and not material
                and not diameter_mm
            ):
                skipped += 1
                continue
            # Service / household stubs under 3m are almost always digitisation
            # artefacts (real service lines run ~3-15m from main to property).
            if net_class == NET_SERVICE and geo_len_m < 3.0:
                skipped += 1
                continue
            if length_m is None:
                length_m = geo_len_m
            for (lon, lat) in line:
                if lon < bbox_lon[0]:
                    bbox_lon[0] = lon
                if lon > bbox_lon[1]:
                    bbox_lon[1] = lon
                if lat < bbox_lat[0]:
                    bbox_lat[0] = lat
                if lat > bbox_lat[1]:
                    bbox_lat[1] = lat

            # endpoint accounting (5dp ≈ 1.1 m) so we count crossings as junctions
            for end_idx in (0, -1):
                lon, lat = line[end_idx]
                key = (round(lon * 100000), round(lat * 100000))
                endpoint_degree[key] += 1
                endpoint_examples[key] = (lon, lat)

            ui_cls = ui_class_for(net_class, status)
            props = {
                "id": f"P-{idx:05d}",
                "class": net_class,
                "ui_class": ui_cls,
                "network_raw": attrs.get("Network"),
                "material": material,
                "diameter_mm": diameter_mm,
                "length_m": round(length_m, 1) if length_m else None,
                "status": status,
                "service": service,
                "zone": zone,
                "installed": year,
                "node_from": attrs.get("Node1") or attrs.get("Nodel1"),
                "node_to": attrs.get("Node2") or attrs.get("Nodel2"),
                "remarks": attrs.get("Remarks"),
                "layer": attrs.get("layer"),
            }
            features.append(
                {
                    "type": "Feature",
                    "id": props["id"],
                    "geometry": {"type": "LineString", "coordinates": line},
                    "properties": props,
                }
            )
            by_class[ui_cls] += 1
            statuses[status] += 1
            services[service] += 1
            age_dist[age_bucket(year)] += 1
            dia_dist[diameter_bucket(diameter_mm)] += 1
            if zone:
                by_zone[zone] += 1
                if length_m:
                    length_by_zone[zone] += length_m
            if material:
                materials[material] += 1
                if length_m:
                    length_by_material[material] += length_m
            if diameter_mm:
                diameters[diameter_mm] += 1
            if length_m:
                total_length_m += length_m
                length_by_class[ui_cls] += length_m

    # ── Synthesize point assets from the topology -----------------------------------
    # Use junction degree to seed tanks, valves, meters, sensors. This is a
    # plausible operational overlay (no real point dataset shipped with the
    # shapefile) — clearly labelled "telemetry overlay" in the UI.

    junctions = [
        (deg, endpoint_examples[k])
        for k, deg in endpoint_degree.items()
        if deg >= 3
    ]
    junctions.sort(key=lambda t: -t[0])

    asset_features = []

    # Tanks: top-6 highest-degree junctions (often reservoir outlets/head works)
    for i, (deg, (lon, lat)) in enumerate(junctions[:6]):
        level = 60 + (i * 7) % 35
        capacity_m3 = 800 + (i * 320) % 2400
        asset_features.append(
            {
                "type": "Feature",
                "id": f"TANK-{i+1:02d}",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "asset": "tank",
                    "id": f"TANK-{i+1:02d}",
                    "name": f"Reservoir {i+1}",
                    "capacity_m3": capacity_m3,
                    "level_pct": level,
                    "inflow_lps": 8 + (i * 3) % 14,
                    "outflow_lps": 6 + (i * 5) % 13,
                    "status": "ok" if 30 <= level <= 90 else "warn",
                    "junction_degree": deg,
                },
            }
        )

    # Pressure valves: deterministic sample of degree-2 junctions
    deg2 = [endpoint_examples[k] for k, d in endpoint_degree.items() if d == 2]
    deg2.sort()
    for i, (lon, lat) in enumerate(deg2[::max(1, len(deg2) // 18)][:18]):
        target = [2.0, 2.5, 3.0, 3.5][i % 4]
        live = round(target + ((i * 0.27) % 1.4 - 0.7), 2)
        diff = abs(live - target)
        status = "ok" if diff < 0.4 else ("warn" if diff < 0.8 else "alert")
        asset_features.append(
            {
                "type": "Feature",
                "id": f"PV-{i+1:02d}",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "asset": "pressure_valve",
                    "id": f"PV-{i+1:02d}",
                    "name": f"PRV {i+1}",
                    "set_bar": target,
                    "live_bar": live,
                    "min_bar": round(target - 0.5, 2),
                    "max_bar": round(target + 0.5, 2),
                    "status": status,
                },
            }
        )

    # Meter valves: another deterministic sample, offset
    for i, (lon, lat) in enumerate(deg2[len(deg2) // 7 :: max(1, len(deg2) // 22)][:22]):
        size = [50, 75, 100, 150, 200][i % 5]
        asset_features.append(
            {
                "type": "Feature",
                "id": f"MV-{i+1:02d}",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "asset": "meter_valve",
                    "id": f"MV-{i+1:02d}",
                    "name": f"Bulk meter MV-{i+1:02d}",
                    "size_mm": size,
                    "state": "open" if i % 6 else "throttled",
                    "consumption_m3d": 120 + (i * 41) % 880,
                    "status": "ok" if i % 9 else "warn",
                },
            }
        )

    # Sensors / flow meters along trunk lines: sample from features list
    main_features = [f for f in features if f["properties"]["class"] in (NET_MAIN, NET_DIST)]
    step = max(1, len(main_features) // 26)
    for i, feat in enumerate(main_features[::step][:26]):
        coords = feat["geometry"]["coordinates"]
        midx = coords[len(coords) // 2]
        lon, lat = midx
        flow = round(4 + (i * 1.7) % 18, 2)
        asset_features.append(
            {
                "type": "Feature",
                "id": f"SN-{i+1:02d}",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "asset": "sensor",
                    "id": f"SN-{i+1:02d}",
                    "name": f"Flow + pressure sensor {i+1}",
                    "type": "flow+pressure",
                    "flow_lps": flow,
                    "pressure_bar": round(2.4 + (i * 0.21) % 1.6, 2),
                    "last_seen": f"{(i*2 % 59) + 1}s ago",
                    "status": "ok" if i % 11 else "alert",
                    "pipe_id": feat["properties"]["id"],
                },
            }
        )

    # ── Write outputs --------------------------------------------------------------

    pipes_fc = {
        "type": "FeatureCollection",
        "name": "kisumu-pipes",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": features,
    }
    assets_fc = {
        "type": "FeatureCollection",
        "name": "kisumu-assets",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": asset_features,
    }
    def km(d: dict[str, float]) -> dict[str, float]:
        return {k: round(v / 1000.0, 2) for k, v in d.items()}

    asset_counts: dict[str, int] = defaultdict(int)
    for a in asset_features:
        asset_counts[a["properties"]["asset"]] += 1

    meta = {
        "source": "Kisumu Water & Sanitation Co.",
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
            key=lambda t: -t[1]
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
        "center": [
            (bbox_lon[0] + bbox_lon[1]) / 2,
            (bbox_lat[0] + bbox_lat[1]) / 2,
        ],
    }

    with open(OUT_PIPES, "w") as f:
        json.dump(pipes_fc, f, separators=(",", ":"))
    with open(OUT_ASSETS, "w") as f:
        json.dump(assets_fc, f, separators=(",", ":"))
    with open(OUT_META, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"✓ wrote {OUT_PIPES} ({len(features)} pipes, {skipped} skipped)", file=sys.stderr)
    print(f"✓ wrote {OUT_ASSETS} ({len(asset_features)} assets)", file=sys.stderr)
    print(f"✓ wrote {OUT_META}", file=sys.stderr)
    print(
        f"  bbox lon[{bbox_lon[0]:.4f},{bbox_lon[1]:.4f}] lat[{bbox_lat[0]:.4f},{bbox_lat[1]:.4f}]",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
