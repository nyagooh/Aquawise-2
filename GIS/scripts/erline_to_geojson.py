"""
Convert the Erline Water asset shapefiles (Arc 1960 / UTM 37S, EPSG:21037)
into the static WGS84 files the browser map consumes.

Source: ../Erline-Water-Assets/*.shp  (QGIS export)
  - Raw water lines        intake → WTP            (2 lines,  Steel)
  - Transmission Lines     WTP → reservoirs → towns (11 lines, Steel)
  - Distribution lines     per-reservoir zones      (133 lines, material + year)
  - Service Area           utility boundary polygon
  - *Intake / *WTP / *WWTP treatment facilities (points)
  - *Reservoir(s)          storage reservoirs (points)

Outputs (public/data/):
  - erline-pipes.geojson           pipes + service-area outline, classified with ui_class
  - erline-assets.geojson          real facilities/reservoirs + synthesized telemetry overlay
  - erline-meta.json               aggregates (km by class/zone/material, age, bbox …)
  - erline-pipes-attributes.csv    attribute table for the Attribute page

Reprojection is delegated to GDAL's ogr2ogr (must be on PATH). The .prj files
carry no datum shift, so the source SRS is forced to EPSG:21037 — otherwise
features land ~300 m off.

Run:
  python3 scripts/erline_to_geojson.py
"""
from __future__ import annotations

import csv
import json
import math
import os
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(os.path.dirname(ROOT), "Erline-Water-Assets")
OUT_DIR = os.path.join(ROOT, "public", "data")
OUT_PIPES = os.path.join(OUT_DIR, "erline-pipes.geojson")
OUT_ASSETS = os.path.join(OUT_DIR, "erline-assets.geojson")
OUT_META = os.path.join(OUT_DIR, "erline-meta.json")
OUT_CSV = os.path.join(OUT_DIR, "erline-pipes-attributes.csv")

SOURCE_SRS = "EPSG:21037"

RESERVOIR_LAYERS = ["Ziwani Reservoirs", "Shauri Reservoir", "Kwa Njora Reservoir"]
FACILITY_LAYERS = {
    "Mairo Inya Intake": "intake",
    "Kwa Njora Intake": "intake",
    "Mairo Inya WTP": "wtp",
    "Kwa Njora WTP": "wtp",
    "Mairo Inya WWTP": "wwtp",
}


def read_layer(tmp: str, name: str) -> list[dict]:
    src = os.path.join(SRC_DIR, f"{name}.shp")
    dst = os.path.join(tmp, f"{name}.geojson")
    subprocess.run(
        ["ogr2ogr", "-f", "GeoJSON", "-s_srs", SOURCE_SRS, "-t_srs", "EPSG:4326",
         "-lco", "COORDINATE_PRECISION=7", dst, src],
        check=True,
    )
    with open(dst) as f:
        return json.load(f)["features"]


def geo_length_m(line: list[list[float]]) -> float:
    total = 0.0
    for i in range(1, len(line)):
        lat1 = math.radians(line[i - 1][1])
        lat2 = math.radians(line[i][1])
        dlat = lat2 - lat1
        dlon = math.radians(line[i][0] - line[i - 1][0])
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        total += 2 * 6378137.0 * math.asin(math.sqrt(a))
    return total


def midpoint(line: list[list[float]]) -> list[float]:
    """Point halfway along the line by distance (not by vertex index)."""
    half = geo_length_m(line) / 2
    run = 0.0
    for i in range(1, len(line)):
        seg = geo_length_m([line[i - 1], line[i]])
        if run + seg >= half and seg > 0:
            t = (half - run) / seg
            return [
                round(line[i - 1][0] + t * (line[i][0] - line[i - 1][0]), 7),
                round(line[i - 1][1] + t * (line[i][1] - line[i - 1][1]), 7),
            ]
        run += seg
    return line[len(line) // 2]


def normalise_material(raw: str | None) -> str | None:
    if not raw:
        return None
    v = raw.strip()
    up = v.upper()
    if "ASBESTOS" in up or up == "AC":
        return "AC"
    return {"UPVC": "uPVC", "STEEL": "Steel"}.get(up, up if up in {"PVC", "HDPE", "GI", "DI", "PE"} else v)


def parse_year(raw) -> int | None:
    try:
        y = int(str(raw).strip())
    except (TypeError, ValueError):
        return None
    return y if 1950 < y < 2100 else None


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


# Distribution zones are named after the reservoir that feeds them. Short,
# URL-safe codes are used as ids (asset deep links embed them); the app maps
# them back to display names in ZONE_LABELS.
ZONE_CODES = {
    "Shauri Reservoir": "SHAURI",
    "Ziwani 1": "ZIWANI1",
    "Ziwani 2": "ZIWANI2",
    "Ziwani 3": "ZIWANI3",
    "Kwa Njora Reservoir": "KWANJORA",
    "Ziwani Reservoir": "ZIWANI",
}

ZONE_NAMES = {code: name.replace(" Reservoir", "") for name, code in ZONE_CODES.items()}

# Flow + pressure loggers per district zone, placed on the zone's longest
# distribution segments (ids continue after the trunk-main loggers).
ZONE_LOGGERS = [("ZIWANI3", 3), ("SHAURI", 3), ("ZIWANI2", 2), ("ZIWANI1", 2), ("KWANJORA", 1)]


def tidy_name(name: str) -> str:
    return name.replace("_", " ").replace("SHauri", "Shauri").strip()


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw_lines = read_layer(tmp, "Raw water lines")
        transmission = read_layer(tmp, "Transmission Lines")
        distribution = read_layer(tmp, "Distribution lines")
        service_area = read_layer(tmp, "Service Area")
        reservoirs = [f for name in RESERVOIR_LAYERS for f in read_layer(tmp, name)]
        facilities = [(kind, f) for name, kind in FACILITY_LAYERS.items() for f in read_layer(tmp, name)]

    pipes: list[dict] = []

    def add_pipe(pid, net_class, ui_class, network_raw, line, *, name=None, material=None,
                 zone=None, installed=None, length_m=None, layer=None):
        if length_m is None or length_m <= 0:
            length_m = geo_length_m(line)
        pipes.append({
            "type": "Feature",
            "id": pid,
            "geometry": {"type": "LineString", "coordinates": line},
            "properties": {
                "id": pid,
                "class": net_class,
                "ui_class": ui_class,
                "network_raw": network_raw,
                "material": material,
                "diameter_mm": None,  # not captured in the Erline survey
                "length_m": round(length_m, 1),
                "status": "open",
                "service": "in-service",
                "zone": zone,
                "installed": installed,
                "node_from": None,
                "node_to": None,
                "remarks": name,
                "layer": layer,
            },
        })

    for i, f in enumerate(sorted(raw_lines, key=lambda f: f["properties"]["id"])):
        p = f["properties"]
        add_pipe(f"RW-{i+1:02d}", "transmission", "main", "Raw Water Main",
                 f["geometry"]["coordinates"], name=tidy_name(p["Name"]),
                 material=normalise_material(p.get("Material")), length_m=p.get("Length"),
                 layer="Raw water lines")

    for i, f in enumerate(sorted(transmission, key=lambda f: (f["properties"]["id"], f["properties"]["Name"]))):
        p = f["properties"]
        add_pipe(f"TM-{i+1:02d}", "transmission", "main", "Transmission Main",
                 f["geometry"]["coordinates"], name=tidy_name(p["Name"]),
                 material=normalise_material(p.get("Material")), length_m=p.get("length"),
                 layer="Transmission Lines")

    for i, f in enumerate(sorted(distribution, key=lambda f: f["properties"]["id"])):
        p = f["properties"]
        add_pipe(f"DL-{i+1:03d}", "distribution", "distribution", "Distribution Main",
                 f["geometry"]["coordinates"], material=normalise_material(p.get("WD_Pipe Ma")),
                 zone=ZONE_CODES.get(p.get("Zone"), p.get("Zone")), installed=parse_year(p.get("WD_Year la")),
                 length_m=p.get("Length"), layer="Distribution lines")

    for i, f in enumerate(service_area):
        ring = f["geometry"]["coordinates"][0]
        add_pipe(f"SA-{i+1:02d}", "boundary", "boundary", "Service Area Boundary", ring,
                 name=tidy_name(f["properties"]["Name"]), layer="Service Area")

    # ── Assets ────────────────────────────────────────────────────────────────
    # Facilities and reservoirs are real surveyed points. Their telemetry
    # values, plus the valves / meters / sensors placed on real pipes, are a
    # deterministic synthesized overlay — the survey carries no SCADA data.
    assets: list[dict] = []

    def add_asset(coord, props):
        assets.append({
            "type": "Feature",
            "id": props["id"],
            "geometry": {"type": "Point", "coordinates": coord},
            "properties": props,
        })

    facility_ids = Counter()
    facility_capacity = {"intake": 4200, "wtp": 3600, "wwtp": 1800}
    for i, (kind, f) in enumerate(facilities):
        facility_ids[kind] += 1
        fid = f"{kind.upper()}-{facility_ids[kind]:02d}"
        cap = facility_capacity[kind] - (facility_ids[kind] - 1) * 1200
        add_asset(f["geometry"]["coordinates"], {
            "asset": "facility", "id": fid, "name": tidy_name(f["properties"]["Name"]),
            "facility_type": kind, "capacity_m3d": cap,
            "throughput_m3d": round(cap * (0.82 - 0.07 * i)),
            "status": "warn" if kind == "wwtp" else "ok",
        })

    for i, f in enumerate(reservoirs):
        g = f["geometry"]
        coord = g["coordinates"][0] if g["type"] == "MultiPoint" else g["coordinates"]
        level = [78, 64, 58, 86, 58][i % 5]
        capacity = [1500, 1500, 1000, 2000, 1200][i % 5]
        add_asset(coord, {
            "asset": "tank", "id": f"TANK-{i+1:02d}", "name": tidy_name(f["properties"]["Name"]),
            "capacity_m3": capacity, "level_pct": level,
            "inflow_lps": 9 + (i * 4) % 12, "outflow_lps": 7 + (i * 5) % 13,
            "status": "ok" if 35 <= level <= 92 else "warn",
            "junction_degree": 0,
        })

    mains = [p for p in pipes if p["properties"]["ui_class"] == "main"]
    for i, p in enumerate(mains):
        flow = round(6 + (i * 2.3) % 18, 1)
        add_asset(midpoint(p["geometry"]["coordinates"]), {
            "asset": "sensor", "id": f"SN-{i+1:02d}",
            "name": f"Flow + pressure · {p['properties']['remarks']}",
            "type": "flow+pressure", "flow_lps": flow,
            "pressure_bar": round(2.6 + (i * 0.37) % 1.2, 2),
            "last_seen": f"{(i * 7) % 59 + 1}s ago",
            "status": "ok",
            "pipe_id": p["properties"]["id"],
        })

    n = len(mains)
    for zone, count in ZONE_LOGGERS:
        zone_pipes = sorted(
            (p for p in pipes if p["properties"]["zone"] == zone),
            key=lambda p: -p["properties"]["length_m"],
        )
        for p in zone_pipes[:count]:
            add_asset(midpoint(p["geometry"]["coordinates"]), {
                "asset": "sensor", "id": f"SN-{n+1:02d}",
                "name": f"Flow + pressure · {ZONE_NAMES[zone]} {p['properties']['id']}",
                "type": "flow+pressure", "flow_lps": round(3 + (n * 1.3) % 7, 1),
                "pressure_bar": round(2.4 + (n * 0.29) % 1.4, 2),
                "last_seen": f"{(n * 7) % 59 + 1}s ago",
                "status": "ok",
                "pipe_id": p["properties"]["id"],
            })
            n += 1

    # Bulk meters at the delivery end of each transmission main (town supply points).
    # Mains ending at a reservoir are skipped (the reservoir marker covers it),
    # and a town fed by a multi-segment main gets a single meter.
    towns: dict[str, list[float]] = {}
    for p in mains:
        if not p["properties"]["id"].startswith("TM-"):
            continue
        town = p["properties"]["remarks"].split(" to ")[-1]
        if "reservoir" not in town.lower() and town not in towns:
            towns[town] = p["geometry"]["coordinates"][-1]
    for i, (town, coord) in enumerate(towns.items()):
        add_asset(coord, {
            "asset": "meter_valve", "id": f"MV-{i+1:02d}", "name": f"Bulk meter · {town}",
            "size_mm": [100, 150, 80, 100, 150, 200][i % 6],
            "state": "throttled" if i == 3 else "open",
            "consumption_m3d": 180 + (i * 97) % 640,
            "status": "warn" if i == 5 else "ok",
        })

    # One PRV per distribution zone, on the zone's longest segment.
    by_zone_pipes: dict[str, list[dict]] = defaultdict(list)
    for p in pipes:
        if p["properties"]["ui_class"] == "distribution" and p["properties"]["zone"]:
            by_zone_pipes[p["properties"]["zone"]].append(p)
    zone_names = sorted(z for z, ps in by_zone_pipes.items() if len(ps) > 1)
    for i, z in enumerate(zone_names):
        longest = max(by_zone_pipes[z], key=lambda p: p["properties"]["length_m"])
        target = [2.5, 3.0, 2.0, 3.5, 2.5][i % 5]
        live = round(target + [0.1, -0.2, 0.9, 0.3, -0.5][i % 5], 2)
        diff = abs(live - target)
        add_asset(longest["geometry"]["coordinates"][0], {
            "asset": "pressure_valve", "id": f"PV-{i+1:02d}", "name": f"PRV · {z}",
            "set_bar": target, "live_bar": live,
            "min_bar": round(target - 0.5, 2), "max_bar": round(target + 0.5, 2),
            "status": "ok" if diff < 0.4 else ("warn" if diff < 0.8 else "alert"),
        })

    # ── Aggregates ────────────────────────────────────────────────────────────
    by_class = Counter()
    by_zone = Counter()
    materials = Counter()
    age_dist = Counter()
    length_by_class: dict[str, float] = defaultdict(float)
    length_by_zone: dict[str, float] = defaultdict(float)
    length_by_material: dict[str, float] = defaultdict(float)
    lons: list[float] = []
    lats: list[float] = []
    for p in pipes:
        pr = p["properties"]
        for lon, lat in p["geometry"]["coordinates"]:
            lons.append(lon)
            lats.append(lat)
        if pr["ui_class"] == "boundary":
            by_class["boundary"] += 1
            continue
        by_class[pr["ui_class"]] += 1
        length_by_class[pr["ui_class"]] += pr["length_m"]
        age_dist[age_bucket(pr["installed"])] += 1
        if pr["zone"]:
            by_zone[pr["zone"]] += 1
            length_by_zone[pr["zone"]] += pr["length_m"]
        if pr["material"]:
            materials[pr["material"]] += 1
            length_by_material[pr["material"]] += pr["length_m"]
    for a in assets:
        lon, lat = a["geometry"]["coordinates"]
        lons.append(lon)
        lats.append(lat)

    network = [p for p in pipes if p["properties"]["ui_class"] != "boundary"]
    total_length_m = sum(p["properties"]["length_m"] for p in network)

    def km(d: dict[str, float]) -> dict[str, float]:
        return {k: round(v / 1000.0, 2) for k, v in d.items()}

    bbox = [min(lons), min(lats), max(lons), max(lats)]
    meta = {
        "source": "Erline Water",
        "feature_count": len(pipes),
        "skipped": 0,
        "asset_count": len(assets),
        "asset_counts": dict(Counter(a["properties"]["asset"] for a in assets)),
        "by_class": dict(by_class),
        "length_km_by_class": km(length_by_class),
        "length_km_by_zone": km(length_by_zone),
        "length_km_by_material": km(length_by_material),
        "top_zones": by_zone.most_common(20),
        "zones_normalized": by_zone.most_common(20),
        "materials": materials.most_common(),
        "common_diameters_mm": [],
        "diameter_distribution": {"unknown": len(network)},
        "age_distribution": dict(age_dist),
        "status_counts": {"open": len(network), "closed": 0, "unknown": 0},
        "service_counts": {"in-service": len(network), "out-of-service": 0, "pending": 0, "unknown": 0},
        "total_length_m": round(total_length_m, 1),
        "total_length_km": round(total_length_m / 1000.0, 2),
        "bbox": bbox,
        "center": [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
    }

    def fc(name, features):
        return {"type": "FeatureCollection", "name": name, "features": features}

    with open(OUT_PIPES, "w") as f:
        json.dump(fc("erline-pipes", pipes), f, separators=(",", ":"))
    with open(OUT_ASSETS, "w") as f:
        json.dump(fc("erline-assets", assets), f, separators=(",", ":"))
    with open(OUT_META, "w") as f:
        json.dump(meta, f, indent=2)

    cols = ["id", "layer", "network_raw", "remarks", "zone", "material", "installed", "length_m", "status", "service"]
    headers = ["ID", "Layer", "Network", "Name", "Zone", "Material", "Year laid", "Length (m)", "Status", "Service"]
    with open(OUT_CSV, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(headers)
        for p in network:
            w.writerow(["" if p["properties"][c] is None else p["properties"][c] for c in cols])

    print(f"✓ wrote {OUT_PIPES} ({len(pipes)} features)", file=sys.stderr)
    print(f"✓ wrote {OUT_ASSETS} ({len(assets)} assets: {meta['asset_counts']})", file=sys.stderr)
    print(f"✓ wrote {OUT_META} ({meta['total_length_km']} km)", file=sys.stderr)
    print(f"✓ wrote {OUT_CSV}", file=sys.stderr)


if __name__ == "__main__":
    main()
