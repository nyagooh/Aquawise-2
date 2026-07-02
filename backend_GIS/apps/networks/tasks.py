import json
import logging
import os
import tempfile
import zipfile

import fiona
from fiona.model import to_dict as fiona_to_dict
from celery import shared_task
from django.contrib.gis.geos import GEOSGeometry, MultiLineString, MultiPolygon
from django.db import connection
from django.utils import timezone
from pyproj import CRS as ProjCRS
from pyproj import Transformer
from shapely import from_geojson, to_geojson
from shapely.ops import transform

from .models import NetworkUpload, Node, Pipe, WaterNetwork, Zone

logger = logging.getLogger(__name__)

ROUGHNESS_DEFAULTS = {
    "PVC": 150.0,
    "GI": 100.0,
    "STEEL": 95.0,
    "HDPE": 140.0,
    "PPR": 140.0,
    "CI": 130.0,
    "AC": 120.0,
}

_MATERIAL_MAP = {
    "PVC": "PVC", "GI": "GI", "GALVANIZED": "GI", "GALVANISED": "GI",
    "HDPE": "HDPE", "STEEL": "Steel", "PPR": "PPR",
    "CI": "CI", "CAST IRON": "CI", "AC": "AC", "ASBESTOS": "AC",
}

_MATERIAL_FIELDS = ["material", "mat", "pipe_mat", "matl", "material_t"]
_DIAMETER_FIELDS = ["diameter", "diam", "dia", "diameter_mm", "pipe_diam", "width", "dia_dn", "dia_inch"]
_STATUS_FIELDS = ["status", "stat", "pipe_stat", "condition", "servicesta"]
_EXT_ID_FIELDS = ["dc_id", "id", "fid", "pipe_id", "node_id", "external_id", "objectid", "gid", "pipeid"]
_NODE_TYPE_FIELDS = ["node_type", "type", "feature_ty", "node_t", "feature"]
_ELEVATION_FIELDS = ["elevation", "elev", "z", "altitude", "elevation_m"]
_YEAR_FIELDS = ["year", "install_yr", "installation_year", "year_inst", "inst_date", "date_mapped", "datemapped"]
_PIPE_ZONE_FIELDS = ["zone", "zone_id", "dma", "dma_id", "zone_name", "district", "network"]
_ZONE_NAME_FIELDS = ["name", "zone_name", "dma_name", "zone", "district", "label"]
_ZONE_CODE_FIELDS = ["code", "zone_code", "dma_code", "dma_id"]


def _find_field(props, candidates):
    keys_lower = {k.lower(): k for k in props}
    for c in candidates:
        if c.lower() in keys_lower:
            return keys_lower[c.lower()]
    return None


def _is_wgs84(crs):
    try:
        return ProjCRS.from_user_input(crs).equals("EPSG:4326")
    except Exception:
        return False


def _make_transformer(crs_wkt):
    return Transformer.from_crs(crs_wkt, "EPSG:4326", always_xy=True)


def _geom_to_dict(geom):
    """Coerce a fiona Geometry object or plain dict to a JSON-serialisable dict."""
    if isinstance(geom, dict):
        return geom
    return fiona_to_dict(geom)


def _reproject(geom_dict, transformer):
    shape = from_geojson(json.dumps(_geom_to_dict(geom_dict)))
    reprojected = transform(transformer.transform, shape)
    return json.loads(to_geojson(reprojected))


def _to_float(val):
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _to_int(val):
    try:
        return int(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _extract_year(val):
    """Extract a 4-digit year from integers, floats, or date strings like '2019-03-15'."""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", ""):
        return None
    # Try plain integer / float year
    try:
        y = int(float(s))
        if 1900 <= y <= 2100:
            return y
    except (ValueError, TypeError):
        pass
    # Try leading 4-digit year from date string
    import re
    m = re.match(r"(\d{4})", s)
    if m:
        y = int(m.group(1))
        if 1900 <= y <= 2100:
            return y
    return None


def _normalize_material(val):
    v = str(val or "").strip().upper()
    return _MATERIAL_MAP.get(v, Pipe.Material.UNKNOWN)


def _normalize_pipe_status(val):
    v = str(val or "").strip().lower()
    if v in ("closed",):
        return Pipe.Status.CLOSED
    if v in ("out_of_service", "decommissioned", "abandoned"):
        return Pipe.Status.OUT_OF_SERVICE
    return Pipe.Status.OPEN


def _normalize_node_type(val):
    v = str(val or "").strip().lower()
    if "reservoir" in v:
        return Node.NodeType.RESERVOIR
    if "tank" in v:
        return Node.NodeType.TANK
    if "meter" in v:
        return Node.NodeType.METER
    return Node.NodeType.JUNCTION


@shared_task(bind=True, ignore_result=True)
def ingest_shapefile(self, upload_id: str):
    try:
        upload = NetworkUpload.objects.get(id=upload_id)
    except NetworkUpload.DoesNotExist:
        logger.error("NetworkUpload %s not found", upload_id)
        return

    upload.status = NetworkUpload.Status.PROCESSING
    upload.save(update_fields=["status"])

    network = None
    warnings = []

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            with zipfile.ZipFile(upload.file_path) as zf:
                zf.extractall(tmpdir)

            shp_files = [
                os.path.join(root, f)
                for root, _, files in os.walk(tmpdir)
                for f in files
                if f.lower().endswith(".shp")
            ]
            if not shp_files:
                raise ValueError("No .shp files found in ZIP archive")

            line_layers, point_layers, polygon_layers = [], [], []
            for shp_path in shp_files:
                with fiona.open(shp_path) as src:
                    gt = (src.schema.get("geometry") or "").lower()
                    if "line" in gt:
                        line_layers.append(shp_path)
                    elif "point" in gt:
                        point_layers.append(shp_path)
                    elif "polygon" in gt:
                        polygon_layers.append(shp_path)

            network_name = upload.file_name.rsplit(".", 1)[0].replace("_", " ").title()
            network = WaterNetwork.objects.create(
                organisation=upload.organisation,
                project=upload.project,
                upload=upload,
                name=network_name,
                source_crs="",
            )

            # --- Zones (polygons) ---
            for shp_path in polygon_layers:
                with fiona.open(shp_path) as src:
                    needs_reproject = not _is_wgs84(src.crs)
                    transformer = _make_transformer(src.crs_wkt) if needs_reproject else None
                    if not network.source_crs:
                        network.source_crs = src.crs_wkt[:50]

                    zones = []
                    for feat in src:
                        if not feat["geometry"]:
                            continue
                        geom_dict = _geom_to_dict(feat["geometry"])
                        if needs_reproject:
                            geom_dict = _reproject(geom_dict, transformer)
                        geos = GEOSGeometry(json.dumps(geom_dict))
                        if geos.geom_type == "Polygon":
                            geos = MultiPolygon(geos)
                        props = feat["properties"] or {}
                        name_f = _find_field(props, _ZONE_NAME_FIELDS)
                        code_f = _find_field(props, _ZONE_CODE_FIELDS)
                        zones.append(Zone(
                            network=network,
                            name=str(props.get(name_f) if name_f else f"Zone {feat['id']}"),
                            code=str(props.get(code_f, "") if code_f else "")[:20],
                            geometry=geos,
                        ))
                    Zone.objects.bulk_create(zones, batch_size=500)
                    if not zones:
                        warnings.append(f"{os.path.basename(shp_path)}: no valid polygon features")

            # --- Pipes (lines) ---
            total_pipes = 0
            _pipe_known = {f.lower() for group in [
                _MATERIAL_FIELDS, _DIAMETER_FIELDS, _STATUS_FIELDS,
                _EXT_ID_FIELDS, _YEAR_FIELDS, _PIPE_ZONE_FIELDS,
            ] for f in group}

            # Zone cache: zone name → Zone instance (created on demand)
            zone_cache: dict[str, Zone] = {}

            for shp_path in line_layers:
                with fiona.open(shp_path) as src:
                    needs_reproject = not _is_wgs84(src.crs)
                    transformer = _make_transformer(src.crs_wkt) if needs_reproject else None
                    if not network.source_crs:
                        network.source_crs = src.crs_wkt[:50]
                    logger.info("Line layer %s fields: %s", os.path.basename(shp_path), list(src.schema["properties"].keys()))

                    pipes = []
                    for feat in src:
                        if not feat["geometry"]:
                            continue
                        geom_dict = _geom_to_dict(feat["geometry"])
                        if needs_reproject:
                            geom_dict = _reproject(geom_dict, transformer)
                        geos = GEOSGeometry(json.dumps(geom_dict))
                        if geos.geom_type == "LineString":
                            geos = MultiLineString(geos)
                        props = feat["properties"] or {}
                        material = _normalize_material(
                            props.get(_find_field(props, _MATERIAL_FIELDS) or "") or ""
                        )
                        diam = _to_float(props.get(_find_field(props, _DIAMETER_FIELDS) or ""))
                        ext_id_f = _find_field(props, _EXT_ID_FIELDS)
                        ext_id = str(props.get(ext_id_f, "") if ext_id_f else "")[:100]
                        pipe_status = _normalize_pipe_status(
                            props.get(_find_field(props, _STATUS_FIELDS) or "") or ""
                        )
                        year_raw = props.get(_find_field(props, _YEAR_FIELDS) or "")
                        year = _extract_year(year_raw)
                        roughness = ROUGHNESS_DEFAULTS.get(material.upper())

                        # Zone assignment from pipe attribute
                        zone_obj = None
                        zone_f = _find_field(props, _PIPE_ZONE_FIELDS)
                        if zone_f:
                            zone_name = str(props.get(zone_f) or "").strip()
                            if zone_name:
                                if zone_name not in zone_cache:
                                    code = zone_name[:20]
                                    zone_cache[zone_name], _ = Zone.objects.get_or_create(
                                        network=network, code=code,
                                        defaults={"name": zone_name},
                                    )
                                zone_obj = zone_cache[zone_name]

                        extras = {k: v for k, v in props.items() if k.lower() not in _pipe_known and v is not None}
                        pipes.append(Pipe(
                            network=network,
                            zone=zone_obj,
                            external_id=ext_id,
                            geometry=geos,
                            material=material,
                            diameter_mm=diam,
                            roughness=roughness,
                            status=pipe_status,
                            installation_year=year,
                            attributes=extras,
                        ))
                    Pipe.objects.bulk_create(pipes, batch_size=500)
                    total_pipes += len(pipes)
                    if not pipes:
                        warnings.append(f"{os.path.basename(shp_path)}: no valid line features")
                    else:
                        with connection.cursor() as cur:
                            cur.execute(
                                "UPDATE networks_pipe SET length_m = ST_Length(geometry::geography)"
                                " WHERE network_id = %s AND length_m IS NULL",
                                [str(network.id)],
                            )

            # --- Nodes (points) ---
            total_nodes = 0
            _node_known = {f for group in [
                _NODE_TYPE_FIELDS, _ELEVATION_FIELDS, _EXT_ID_FIELDS,
            ] for f in group}

            for shp_path in point_layers:
                with fiona.open(shp_path) as src:
                    needs_reproject = not _is_wgs84(src.crs)
                    transformer = _make_transformer(src.crs_wkt) if needs_reproject else None
                    if not network.source_crs:
                        network.source_crs = src.crs_wkt[:50]
                    logger.info("Point layer %s fields: %s", os.path.basename(shp_path), list(src.schema["properties"].keys()))

                    nodes = []
                    for feat in src:
                        if not feat["geometry"]:
                            continue
                        geom_dict = _geom_to_dict(feat["geometry"])
                        if needs_reproject:
                            geom_dict = _reproject(geom_dict, transformer)
                        geos = GEOSGeometry(json.dumps(geom_dict))
                        if geos.geom_type == "MultiPoint":
                            geos = geos[0]
                        props = feat["properties"] or {}
                        node_type = _normalize_node_type(
                            props.get(_find_field(props, _NODE_TYPE_FIELDS) or "") or ""
                        )
                        elev = _to_float(props.get(_find_field(props, _ELEVATION_FIELDS) or ""))
                        ext_id_f = _find_field(props, _EXT_ID_FIELDS)
                        ext_id = str(props.get(ext_id_f, "") if ext_id_f else "")[:100]
                        extras = {k: v for k, v in props.items() if k.lower() not in _node_known and v is not None}
                        nodes.append(Node(
                            network=network,
                            external_id=ext_id,
                            node_type=node_type,
                            geometry=geos,
                            elevation_m=elev,
                            attributes=extras,
                        ))
                    Node.objects.bulk_create(nodes, batch_size=500)
                    total_nodes += len(nodes)
                    if not nodes:
                        warnings.append(f"{os.path.basename(shp_path)}: no valid point features")

            # Assign zones via PostGIS spatial JOIN — much faster than Python loops
            if Zone.objects.filter(network=network).exists():
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        UPDATE networks_pipe p
                           SET zone_id = z.id
                          FROM networks_zone z
                         WHERE p.network_id = %s
                           AND z.network_id = %s
                           AND ST_Intersects(p.geometry, z.geometry)
                           AND p.zone_id IS NULL
                        """,
                        [str(network.id), str(network.id)],
                    )
                    cursor.execute(
                        """
                        UPDATE networks_node n
                           SET zone_id = z.id
                          FROM networks_zone z
                         WHERE n.network_id = %s
                           AND z.network_id = %s
                           AND ST_Within(n.geometry, z.geometry)
                           AND n.zone_id IS NULL
                        """,
                        [str(network.id), str(network.id)],
                    )

            # Auto-derive junction nodes from pipe endpoints when no point layer was provided.
            # Rounds to 6 decimal places (~10 cm) to merge coincident points.
            if total_nodes == 0 and total_pipes > 0:
                with connection.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO networks_node
                               (id, network_id, external_id, node_type, geometry, attributes)
                        SELECT
                            gen_random_uuid(),
                            %(net)s::uuid,
                            '',
                            'junction',
                            ST_SetSRID(
                                ST_MakePoint(
                                    ROUND(ST_X(pt.geom)::numeric, 6)::float8,
                                    ROUND(ST_Y(pt.geom)::numeric, 6)::float8
                                ),
                                4326
                            )::geometry(Point, 4326),
                            '{}'::jsonb
                        FROM (
                            SELECT DISTINCT
                                ROUND(ST_X(geom)::numeric, 6) AS rx,
                                ROUND(ST_Y(geom)::numeric, 6) AS ry,
                                ST_MakePoint(
                                    ROUND(ST_X(geom)::numeric, 6)::float8,
                                    ROUND(ST_Y(geom)::numeric, 6)::float8
                                ) AS geom
                            FROM (
                                -- Dump each pipe into individual LineStrings, then take start+end
                                SELECT ST_StartPoint((ST_Dump(geometry::geometry)).geom) AS geom
                                  FROM networks_pipe WHERE network_id = %(net)s::uuid
                                UNION ALL
                                SELECT ST_EndPoint((ST_Dump(geometry::geometry)).geom) AS geom
                                  FROM networks_pipe WHERE network_id = %(net)s::uuid
                            ) raw
                            WHERE geom IS NOT NULL
                        ) pt
                        """,
                        {"net": str(network.id)},
                    )
                    total_nodes = cur.rowcount
                    logger.info(
                        "Derived %d junction nodes from pipe endpoints for network %s",
                        total_nodes, network.id,
                    )

                # Assign zones to derived nodes
                if Zone.objects.filter(network=network).exists():
                    with connection.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE networks_node n
                               SET zone_id = z.id
                              FROM networks_zone z
                             WHERE n.network_id = %s
                               AND z.network_id = %s
                               AND ST_Within(n.geometry, z.geometry)
                               AND n.zone_id IS NULL
                            """,
                            [str(network.id), str(network.id)],
                        )

            # Network stats + bbox
            network.total_pipes = total_pipes
            network.total_nodes = total_nodes
            network.source_crs = network.source_crs or "EPSG:4326"

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT ST_AsText(ST_SetSRID(ST_Extent(geometry::geometry), 4326))
                      FROM (
                        SELECT geometry FROM networks_pipe WHERE network_id = %s
                        UNION ALL
                        SELECT geometry FROM networks_node WHERE network_id = %s
                      ) geoms
                    """,
                    [str(network.id), str(network.id)],
                )
                row = cursor.fetchone()
                if row and row[0]:
                    from django.contrib.gis.geos import GEOSGeometry as _G
                    network.bbox = _G(row[0]).envelope

                cursor.execute(
                    "SELECT COALESCE(SUM(ST_Length(geometry::geography)), 0) / 1000.0 FROM networks_pipe WHERE network_id = %s",
                    [str(network.id)],
                )
                network.total_length_km = cursor.fetchone()[0]

            network.save()

            upload.status = (
                NetworkUpload.Status.COMPLETE_WITH_WARNINGS if warnings else NetworkUpload.Status.COMPLETE
            )
            upload.validation_report = {
                "pipes": total_pipes,
                "nodes": total_nodes,
                "warnings": warnings,
            }
            upload.completed_at = timezone.now()
            upload.save()
            logger.info("Ingestion complete for upload %s: %d pipes, %d nodes", upload_id, total_pipes, total_nodes)

    except Exception as exc:
        logger.exception("Shapefile ingestion failed for upload %s", upload_id)
        if network:
            network.delete()
        upload.status = NetworkUpload.Status.FAILED
        upload.validation_report = {"error": str(exc), "warnings": warnings}
        upload.completed_at = timezone.now()
        upload.save()


# ── EPANET ingestion ──────────────────────────────────────────────────────────

def _parse_inp_sections(path):
    """Read an EPANET .inp text file into {SECTION: [[token,...], ...]}."""
    sections = {}
    current = None
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("["):
                end = stripped.index("]")
                current = stripped[1:end].upper()
                sections[current] = []
            elif current and not stripped.startswith(";"):
                parts = stripped.split(";")[0].split()
                if parts:
                    sections[current].append(parts)
    return sections


def _extract_net_node_types(path):
    """
    Scan an EPANET .net binary for node-type prefixes.
    Returns {node_id: node_type_string} for tanks, reservoirs, and valves only
    (junctions are already derived from pipe endpoints).
    """
    import re as _re
    with open(path, "rb") as f:
        data = f.read()
    result = {}
    for m in _re.finditer(rb"[A-Z][A-Z0-9_\-]{1,29}", data):
        nid = m.group(0).decode("ascii", errors="replace")
        if _re.match(r"^(TCV|FCV|PRV|GPV|PSV)-", nid):
            result[nid] = "valve"
        elif nid.startswith("T-"):
            result[nid] = "tank"
        elif nid.startswith("R-") and len(nid) > 2:
            result[nid] = "reservoir"
    # Deduplicate (same ID may appear many times in binary)
    return dict(result)


def _apply_epanet_inp(network, sections, warnings):
    """
    Parse INP sections and replace all existing nodes with properly typed,
    geographically positioned nodes from the EPANET model.
    """
    # Coordinates
    coords = {}
    for row in sections.get("COORDINATES", []):
        if len(row) >= 3:
            x, y = _to_float(row[1]), _to_float(row[2])
            if x is not None and y is not None:
                coords[row[0]] = (x, y)

    if not coords:
        warnings.append("[COORDINATES] section missing — nodes cannot be positioned")
        return

    # Detect CRS: if values are in degree range → WGS84; else use network.source_crs
    xs = [x for x, _ in coords.values()]
    in_degrees = -180 < min(xs) < 180 and -180 < max(xs) < 180
    transformer = None
    if not in_degrees:
        crs_wkt = network.source_crs or "EPSG:32736"
        if not _is_wgs84(crs_wkt):
            try:
                transformer = _make_transformer(crs_wkt)
            except Exception as exc:
                warnings.append(f"CRS transform failed ({exc}); coordinates may be inaccurate")

    # Collect node attributes from all sections
    nodes_data = {}
    for row in sections.get("JUNCTIONS", []):
        if row:
            nodes_data[row[0]] = {
                "node_type": Node.NodeType.JUNCTION,
                "elevation_m": _to_float(row[1]) if len(row) > 1 else None,
                "demand_lps": _to_float(row[2]) if len(row) > 2 else None,
            }
    for row in sections.get("RESERVOIRS", []):
        if row:
            nodes_data[row[0]] = {
                "node_type": Node.NodeType.RESERVOIR,
                "elevation_m": _to_float(row[1]) if len(row) > 1 else None,
            }
    for row in sections.get("TANKS", []):
        if row:
            nodes_data[row[0]] = {
                "node_type": Node.NodeType.TANK,
                "elevation_m": _to_float(row[1]) if len(row) > 1 else None,
            }

    if not nodes_data:
        warnings.append("No node sections ([JUNCTIONS]/[RESERVOIRS]/[TANKS]) found")
        return

    # Replace all existing nodes with EPANET model nodes
    Node.objects.filter(network=network).delete()

    node_objs = []
    skipped = 0
    for node_id, data in nodes_data.items():
        if node_id not in coords:
            skipped += 1
            continue
        x, y = coords[node_id]
        geom_dict = {"type": "Point", "coordinates": [x, y]}
        if transformer:
            geom_dict = _reproject(geom_dict, transformer)
        try:
            geos = GEOSGeometry(json.dumps(geom_dict))
        except Exception:
            skipped += 1
            continue
        node_objs.append(Node(
            network=network,
            external_id=node_id,
            node_type=data["node_type"],
            geometry=geos,
            elevation_m=data.get("elevation_m"),
            demand_lps=data.get("demand_lps"),
        ))

    if skipped:
        warnings.append(f"{skipped} nodes skipped (no coordinates or invalid geometry)")

    Node.objects.bulk_create(node_objs, batch_size=500)
    network.total_nodes = len(node_objs)
    network.save(update_fields=["total_nodes"])

    # Zone assignment
    if Zone.objects.filter(network=network).exists():
        with connection.cursor() as cur:
            cur.execute(
                """UPDATE networks_node n SET zone_id = z.id
                   FROM networks_zone z
                   WHERE n.network_id = %s AND z.network_id = %s
                   AND ST_Within(n.geometry, z.geometry) AND n.zone_id IS NULL""",
                [str(network.id), str(network.id)],
            )

    logger.info(
        "INP: created %d nodes (%d skipped) for network %s",
        len(node_objs), skipped, network.id,
    )


def _apply_epanet_net_types(network, node_types, warnings):
    """
    .net binary: we have node IDs and types but no geographic coords.
    Creates special nodes (tank/reservoir/valve) at the network centroid
    so they appear in Sensors. Upload an .inp for accurate positions.
    """
    if not node_types:
        warnings.append("No special nodes (T-, R-, TCV-, FCV-, PRV-) found in .net binary")
        return

    with connection.cursor() as cur:
        cur.execute(
            "SELECT ST_AsText(ST_Centroid(ST_Collect(geometry::geometry))) "
            "FROM networks_pipe WHERE network_id = %s",
            [str(network.id)],
        )
        row = cur.fetchone()
        centroid_wkt = row[0] if row and row[0] else "POINT(0 0)"

    centroid = GEOSGeometry(centroid_wkt)
    valid_types = {c[0] for c in Node.NodeType.choices}

    new_nodes = []
    for node_id, ntype in node_types.items():
        if ntype not in valid_types:
            continue
        new_nodes.append(Node(
            network=network,
            external_id=node_id,
            node_type=ntype,
            geometry=centroid,
            attributes={"unlocated": True, "source": "epanet_net"},
        ))

    Node.objects.bulk_create(new_nodes, batch_size=200, ignore_conflicts=True)
    network.total_nodes = Node.objects.filter(network=network).count()
    network.save(update_fields=["total_nodes"])
    warnings.append(
        f".net binary: {len(new_nodes)} special nodes placed at network centroid. "
        "Upload an .inp file for accurate geographic positions."
    )
    logger.info(".net: created %d special nodes for network %s", len(new_nodes), network.id)


@shared_task(bind=True, ignore_result=True)
def ingest_epanet(self, upload_id: str):
    try:
        upload = NetworkUpload.objects.get(id=upload_id)
    except NetworkUpload.DoesNotExist:
        logger.error("NetworkUpload %s not found", upload_id)
        return

    if not upload.network_id:
        upload.status = NetworkUpload.Status.FAILED
        upload.validation_report = {"error": "No network associated with this upload"}
        upload.save(update_fields=["status", "validation_report"])
        return

    upload.status = NetworkUpload.Status.PROCESSING
    upload.save(update_fields=["status"])

    network = upload.network
    warnings = []

    try:
        ext = upload.file_path.rsplit(".", 1)[-1].lower()
        if ext == "inp":
            sections = _parse_inp_sections(upload.file_path)
            _apply_epanet_inp(network, sections, warnings)
        elif ext == "net":
            node_types = _extract_net_node_types(upload.file_path)
            _apply_epanet_net_types(network, node_types, warnings)
        else:
            raise ValueError(f"Unsupported EPANET extension: .{ext}")

        upload.status = (
            NetworkUpload.Status.COMPLETE_WITH_WARNINGS if warnings
            else NetworkUpload.Status.COMPLETE
        )
        upload.validation_report = {"warnings": warnings}
        upload.completed_at = timezone.now()
        upload.save()
        logger.info("EPANET ingestion complete for upload %s", upload_id)

    except Exception as exc:
        logger.exception("EPANET ingestion failed for upload %s", upload_id)
        upload.status = NetworkUpload.Status.FAILED
        upload.validation_report = {"error": str(exc), "warnings": warnings}
        upload.completed_at = timezone.now()
        upload.save()
