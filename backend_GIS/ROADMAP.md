# Project Plan & Roadmap
## AquaWise GIS Backend

**Start date:** 2026-05-17  
**Methodology:** Iterative phases — each phase ships a working, testable slice of the system

> **Legend:** ✅ Done &nbsp;|&nbsp; 🔧 In progress &nbsp;|&nbsp; ⬜ Not started

---

## Phase Overview

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
Foundation   Spatial     Hydraulic   Real-Time   ML &
& Ingestion  Network     Engine      Operations  Intelligence
    ✅         Viewer
```

Each phase ends with a working API that the frontend can consume — no phase is "backend only with nothing to show."

---

## Phase 1 — Foundation & Data Ingestion ✅
**Duration:** 2 weeks  
**Goal:** Accept any shapefile or EPANET file from any utility, validate it, and store it correctly.

### Deliverables

#### 1.1 Project Bootstrap ✅
- [x] Django project `aquawise_gis` created with `core`, `networks`, `hydraulics`, `sensors`, `analytics`, `alerts`, `api` apps
- [x] GeoDjango configured with PostGIS (PostgreSQL 16, port 5433)
- [x] Docker Compose: PostgreSQL+PostGIS, Redis, Django, Celery, MinIO, Mosquitto
- [x] `.env` pattern set up (django-environ, split settings base/dev/prod)
- [x] JWT authentication wired (`/api/v1/auth/token/`, `/api/v1/auth/token/refresh/`)
- [x] `GET /api/v1/auth/me/` — returns authenticated user profile (id, username, email, role, organisation) *(added — was not in original plan)*
- [x] Multi-tenant `Organisation` + `Project` + `CustomUser` (role-based) models
- [x] All migrations applied — 26+ migrations across 6 apps
- [x] Dev data seeded (KIWASCO org, admin user, Kisumu project)
- [x] DRF router wired with versioned URL includes at `/api/v1/` *(added — was not in original plan)*
- [ ] `ruff` linting configured

#### 1.2 Shapefile Ingestion Pipeline ✅
- [x] `POST /api/v1/networks/upload/` endpoint — accepts `.zip` shapefile (also `.inp` / `.net` EPANET — see 1.3), saves to `media/uploads/<org_id>/<upload_id>.<ext>`
- [x] Celery task `ingest_shapefile`: unzip → classify `.shp` by geometry type (line→Pipe, point→Node, polygon→Zone) → validate schema
- [x] Auto-detect and reproject any CRS → EPSG:4326 using `pyproj` + `shapely.ops.transform`
- [x] Roughness fill: populate zero-roughness values from material lookup table (Hazen-Williams defaults: PVC=150, GI=100, Steel=95, HDPE=140, PPR=140, CI=130, AC=120)
- [x] Fuzzy field-name matching for common column aliases (e.g. `diam`, `diameter_mm`, `DIAMETER`)
- [x] Bulk inserts via `bulk_create(batch_size=500)` for performance
- [x] PostGIS `ST_Intersects` zone assignment after pipe ingestion
- [x] `ST_Length(geography)` for accurate total network length
- [x] `ST_Extent` for bounding box computation
- [x] Upload status lifecycle: `pending → processing → complete / complete_warnings / failed` with `validation_report` JSON
- [x] Junction node auto-derivation from pipe endpoints using `ST_Dump` + `ST_StartPoint`/`ST_EndPoint` when no point layer is present *(added — not in original plan)*
- [ ] Topology repair: flag disconnected segments, duplicate geometries

#### 1.3 EPANET Ingestion ✅ *(substantially complete — using custom parser instead of wntr)*
- [x] `POST /api/v1/networks/upload/` — also accepts `.inp` and `.net` files (routes via `file_type = "epanet_inp"` / `"epanet_net"`)
- [x] `POST /api/v1/networks/{id}/epanet/` — attach EPANET model to an **existing** network *(added — not in original plan)*
- [x] Celery task `ingest_epanet(upload_id)` — dispatches to the appropriate parser based on file extension
- [x] `_parse_inp_sections(path)` — parses EPANET `.inp` text format into `{SECTION: [[token,...], ...]}` dict
- [x] `_apply_epanet_inp(network, sections, warnings)` — extracts `[JUNCTIONS]`, `[RESERVOIRS]`, `[TANKS]`, `[COORDINATES]`; detects CRS (degrees → WGS84, else uses `network.source_crs`); reprojects projected coords to EPSG:4326; bulk-creates `Node` records; handles missing coordinates gracefully
- [x] `_extract_net_node_types(path)` — scans binary `.net` for node type prefixes (TCV-, FCV-, PRV-, GPV-, PSV-, PMP-)
- [x] `_apply_epanet_net_types(network, node_types, warnings)` — creates special nodes at network centroid when geographic coordinates unavailable from binary `.net`
- [x] `network` FK added to `NetworkUpload` model (nullable) — set after ingestion links upload to its created/updated network
- [x] `network_id` included in `GET /api/v1/networks/{upload_id}/validate/` response — needed for chained EPANET upload after shapefile
- [x] Migration `0002_networkupload_network_alter_networkupload_file_type` applied
- [ ] wntr-based simulation integration *(deferred to Phase 3)*
- [ ] Demand data extraction from `[DEMANDS]` section *(deferred)*

**Known limitation:** Binary `.net` files (WaterGEMS/EPANET GUI project format) contain only canvas pixel coordinates, not geographic coordinates. Only `.inp` text files with a `[COORDINATES]` section provide real node positions. Users should export `.inp` from EPANET/WaterGEMS.

#### 1.4 Network API ✅
- [x] `GET /api/v1/networks/` — lists all networks for the authenticated organisation
- [x] `GET /api/v1/networks/{id}/` — network detail with `source_crs` and `bbox` GeoJSON
- [x] `DELETE /api/v1/networks/{id}/` — delete network and all associated data
- [x] `GET /api/v1/networks/{id}/pipes/` — GeoJSON `FeatureCollection` with `?bbox=minx,miny,maxx,maxy` and `?zone=<uuid>` params; `.iterator(chunk_size=500)`
- [x] `GET /api/v1/networks/{id}/nodes/` — GeoJSON `FeatureCollection` with same bbox/zone filters
- [x] `GET /api/v1/networks/{id}/zones/` — GeoJSON `FeatureCollection` of zone polygons
- [x] `GET /api/v1/networks/{id}/assets/` — GeoJSON `FeatureCollection` with bbox filter
- [x] `GET /api/v1/networks/{id}/validate/` — upload status + `network_id` (set after ingestion)
- [x] `GET /api/v1/networks/{id}/uploads/` — lists all uploads (shapefile + EPANET) attached to a network *(added — not in original plan)*
- [x] `GET /api/v1/networks/{id}/stats/` — enhanced stats with full breakdown *(extended beyond original plan)*:
  - `total_pipes`, `total_nodes`, `total_length_km`
  - `materials_breakdown` — per-material pipe count and length km
  - `status_breakdown` — per-status pipe count (open/closed/out_of_service/pending)
  - `age_distribution` — pipe count bucketed by install decade via Django ORM `Case/When`
  - `zones_breakdown` — per-zone pipe count and length km
  - `nodes_breakdown` — per node_type count (`junction`, `reservoir`, `tank`, `meter`) *(added — not in original plan)*
- [x] Trained ML model artifacts committed: Random Forest water quality predictors + Isolation Forest anomaly detector *(added — not in original plan)*

#### 1.5 Tests & Docs ⬜
- [ ] Pytest suite for upload, validation, and API endpoints
- [ ] Kisumu water supply network used as integration test fixture
- [x] OpenAPI schema auto-generated via DRF spectacular (`/api/docs/`)

**Phase 1 success criteria:** ✅ Upload the Kisumu shapefile, get back a clean GeoJSON response with pipes coloured by material, and a validation report listing roughness gaps.

---

## Phase 2 — Spatial Network Viewer ⬜
**Duration:** 2 weeks  
**Goal:** Rich spatial query API that the map frontend can use for interactive exploration.

### Deliverables

#### 2.1 Advanced Spatial Queries ⬜
- [ ] Buffer analysis: `GET /api/v1/networks/{id}/pipes/?buffer_around_point=lat,lon,radius_m`
- [ ] Zone intersection: pipes within a zone polygon
- [ ] Pipe attribute filtering: material, diameter range, status, age
- [ ] Nearest pipe/node to a coordinate

#### 2.2 Asset Management ⬜
- [x] `Asset` model defined (pumps, valves, meters, treatment plants, boreholes, intakes, storage tanks)
- [x] `GET /api/v1/networks/{id}/assets/` — GeoJSON with asset type symbology hints *(already implemented in Phase 1)*
- [ ] `POST /api/v1/networks/{id}/assets/` — add asset with lat/lon + type
- [ ] `PATCH/DELETE /api/v1/networks/{id}/assets/{id}/` — edit + remove asset

#### 2.3 Network Topology ⬜
- [ ] Connectivity graph built with `networkx` from `Pipe` adjacency
- [ ] `GET /api/v1/networks/{id}/topology/isolation-impact/?pipe_id=X` — which zones lose supply if pipe X is closed
- [ ] `GET /api/v1/networks/{id}/topology/path/?from_node=A&to_node=B` — shortest path

#### 2.4 Service Zones ⬜
- [x] `Zone` model defined with geometry
- [x] `GET /api/v1/networks/{id}/zones/` — zones GeoJSON endpoint *(already implemented in Phase 1)*
- [ ] Zone CRUD endpoints (`POST`, `PATCH`, `DELETE`)
- [ ] Population demand estimate per zone (if census data uploaded)
- [ ] Per-zone coverage statistics

**Phase 2 success criteria:** Engineer clicks a pipe on the map → sees material, diameter, zone, connectivity impact. Draws a polygon → gets all pipes inside it.

---

## Phase 3 — Hydraulic Model Integration ⬜
**Duration:** 2 weeks  
**Goal:** Run EPANET simulations via the API and expose results as time-series + spatial layers.

### Deliverables

#### 3.1 Simulation Engine ⬜
- [x] `SimulationRun`, `PressureResult`, `FlowResult`, `HydraulicScenario` models defined + migrated
- [x] URL routes wired (`/api/v1/hydraulics/runs/`, `/results/pressure/`, `/results/flow/`)
- [ ] `POST /api/v1/hydraulics/runs/` — accepts `.inp` file + run parameters (real implementation using `wntr`)
- [ ] Celery heavy queue: `wntr.sim.EpanetSimulator` execution
- [ ] Run status polling: `GET /api/v1/hydraulics/runs/{id}/`

#### 3.2 Results API ⬜
- [ ] `GET /api/v1/hydraulics/runs/{id}/results/pressure/` — time-series JSON
- [ ] `GET /api/v1/hydraulics/runs/{id}/results/pressure/spatial/` — GeoJSON choropleth layer
- [ ] `GET /api/v1/hydraulics/runs/{id}/results/flow/` — pipe-level flow results

#### 3.3 Scenario Management ⬜
- [ ] `POST /api/v1/hydraulics/scenarios/` — create scenario from existing network
- [ ] Compare two runs: pressure delta layer

#### 3.4 Roughness Auto-Population ⬜
- [ ] Endpoint to apply material-based roughness defaults before simulation
- [ ] Flag nodes with missing demand data

**Phase 3 success criteria:** Engineer uploads Kisumu .inp → triggers simulation → sees pressure heat map on the network map within 2 minutes.

---

## Phase 4 — Real-Time Operations Dashboard ⬜
**Duration:** 2 weeks  
**Goal:** Live sensor data ingested via MQTT, pushed to ops staff via WebSocket.

### Deliverables

#### 4.1 Sensor Registry ⬜
- [x] `Sensor`, `SensorReading`, `MQTTBroker` models defined + migrated
- [x] URL routes wired (`/api/v1/sensors/`, `/readings/`, `/summary/`)
- [ ] `GET/POST /api/v1/sensors/` — real implementation
- [ ] `GET /api/v1/sensors/{id}/readings/?start=&end=&resample=1h` — historical time-series

#### 4.2 MQTT Consumer ⬜
- [ ] Celery beat task: connect to configured MQTT broker per org
- [ ] Topic pattern: `aquawise/{org_id}/sensors/{sensor_id}/reading`
- [ ] Incoming reading → store `SensorReading` → publish to Channels group

#### 4.3 WebSocket Push ⬜
- [x] Django Channels consumer scaffold (`apps/sensors/consumers.py`)
- [x] WebSocket URL routing wired (`ws/sensors/{network_id}/`)
- [x] ASGI entry point configured (Daphne)
- [ ] Auth via JWT token in query param
- [ ] Broadcasts new readings to all connected clients for that network in real-time

#### 4.4 Historical Aggregation ⬜
- [ ] Hourly/daily rollup Celery task
- [ ] `GET /api/v1/sensors/summary/?zone=X&metric=pressure&period=7d` — aggregated stats

**Phase 4 success criteria:** Ops staff open the dashboard → see live pressure readings updating on the map without page refresh. Latency < 3 seconds from MQTT publish to browser update.

---

## Phase 5 — ML Anomaly Detection & Alerts ⬜
**Duration:** 3 weeks  
**Goal:** Automatically detect leaks, pressure anomalies, and pipe failure risk. Notify operators.

### Deliverables

#### 5.1 Anomaly Detection ⬜
- [x] `AnomalyDetectionModel`, `AnomalyEvent` models defined + migrated
- [x] URL route wired (`/api/v1/analytics/anomalies/`)
- [x] Trained Isolation Forest model artifact committed *(added — not in original plan)*
- [ ] Feature engineering: rolling mean/std of pressure per sensor, demand-adjusted baseline
- [ ] Celery task: run inference on new readings every 5 minutes
- [ ] `GET /api/v1/analytics/anomalies/` — real implementation

#### 5.2 Leak Risk Scoring ⬜
- [x] `LeakRiskScore` model defined + migrated
- [x] URL route wired (`/api/v1/analytics/leak-risk/`)
- [x] Trained Random Forest water quality predictor artifacts committed *(added — not in original plan)*
- [ ] Per-pipe risk score = f(material_age, pressure_variance, historical_break_rate)
- [ ] GeoJSON layer endpoint: real implementation
- [ ] Updated nightly via Celery beat

#### 5.3 Demand Forecasting ⬜
- [ ] SARIMA model per zone on historical demand
- [ ] `GET /api/v1/analytics/demand-forecast/?zone=X&horizon=7d` — predicted demand
- [ ] Feed forecasts back into hydraulic scenario generation

#### 5.4 Alert Engine ⬜
- [x] `AlertRule`, `AlertEvent`, `Notification` models defined + migrated
- [x] URL routes wired (`/api/v1/alerts/rules/`, `/events/`)
- [ ] `AlertRule` CRUD — real implementation
- [ ] Rule evaluation Celery beat task
- [ ] `AlertEvent` → `Notification` dispatch pipeline

#### 5.5 Notifications ⬜
- [ ] Email via SendGrid / SMTP
- [ ] SMS via Africa's Talking API (East Africa primary)
- [ ] In-app push via WebSocket (same Channels infrastructure as Phase 4)
- [x] Notification preferences per user (fields on `CustomUser`: notify_sms, notify_email, notify_push)

**Phase 5 success criteria:** Simulated pressure drop injected into test sensor → anomaly event created within 5 minutes → SMS and WebSocket alert delivered to ops staff.

---

## Milestone Summary

| Milestone | Status | Target | Deliverable |
|-----------|--------|--------|-------------|
| M1 | ✅ Done | Week 2 | Upload Kisumu shapefile → GeoJSON pipes API + enhanced stats + EPANET ingestion |
| M2 | ⬜ Not started | Week 4 | Full spatial query API + asset management |
| M3 | ⬜ Not started | Week 6 | EPANET simulation via wntr → pressure choropleth |
| M4 | ⬜ Not started | Week 8 | Live WebSocket sensor dashboard |
| M5 | ⬜ Not started | Week 11 | ML anomaly detection + SMS alerts |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| EPANET simulation takes > 5 min for large networks | Medium | High | Celery heavy queue with timeout; result caching |
| Shapefile CRS detection fails for unusual projections | Medium | Medium | Fall back to user-specified CRS; clear error message |
| MQTT broker not available (no real sensors yet) | High (early) | Low | Mock MQTT publisher for dev; REST fallback endpoint |
| PostGIS topology queries slow on 4,947-pipe network | Low | High | GIST spatial indexes created on migration |
| Africa's Talking SMS delivery in non-EA regions | Medium | Low | Pluggable notification backend; Twilio alternative |
| `.net` binary has no geographic coordinates | Confirmed | Medium | Document clearly; require `.inp` for node mapping; strip centroid placeholder nodes |

---

## Dependencies & Blockers

- [x] **PostGIS** — installed (PostgreSQL 16 + PostGIS on port 5433)
- [x] **GDAL system libraries** — installed (`libgdal-dev 3.8.4`, `libgeos-dev`, `libproj-dev`)
- [ ] **celery** — not installed in venv (`pip install celery redis`); `ingest_shapefile` falls back to `.apply()` synchronously without it
- [ ] **Real sensor data** needed for Phase 4 production use; Phase 4 dev can proceed with mock MQTT publisher
- [ ] **Hydraulic engineering review** of simulation defaults before Phase 3 goes to production (wrong roughness → wrong pressure predictions)
- [ ] **`.inp` export from EPANET** — needed to get real node geographic coordinates; binary `.net` format is not usable for spatial mapping
