# Software Development Plan (SDP)
## AquaWise GIS — Water Resources Platform Backend

**Version:** 1.0  
**Date:** 2026-05-17  
**Author:** Tomlee Abila  
**Stack:** Django + GeoDjango · PostGIS · Django REST Framework · Django Channels · Celery

---

## 1. Purpose & Scope

This document defines the software development approach for the AquaWise GIS backend — a location-agnostic, multi-tenant water resources intelligence platform. The backend exposes a REST + WebSocket API consumed by a JavaScript GIS frontend. Any water utility anywhere in the world can upload their network data and immediately gain spatial analysis, hydraulic simulation, real-time monitoring, and ML-powered anomaly detection capabilities.

---

## 2. System Overview

```
Data Sources
  ├── Shapefiles (.shp, .dbf, .prj, .shx, .cpg)
  ├── EPANET files (.inp + simulation results)
  ├── Live sensors (pressure, flow, water quality)
  └── Population / land-use (census, satellite)
          │
          ▼
Data Validation & Ingestion Layer
  └── Schema checks · roughness fill · topology repair · format normalisation
          │
          ▼
Processing Backend  ←── THIS REPO
  ├── PostGIS          — spatial database, all geometry stored here
  ├── Hydraulic Engine — EPANET solver (wntr) + result ingestion
  ├── Real-time Stream — MQTT broker consumer → Django Channels
  └── ML Anomaly       — leak / failure detection models
          │
          ▼
REST API + WebSocket Gateway (DRF + Channels)
          │
          ▼
JS Frontend (Leaflet / Mapbox · React)
  ├── Map Viewer       — pipes, zones, assets
  ├── Hydraulic Dash   — pressure, flow, scenarios
  ├── Ops Monitor      — live pressure + alerts
  └── Alert System     — SMS, email, push
          │
          ▼
Users
  ├── Engineers        — network analysis, hydraulic modelling
  └── Ops Staff        — real-time monitoring, leak response
```

---

## 3. Django Application Architecture

The backend is a single Django project (`aquawise_gis`) composed of focused, independently testable apps:

| App | Responsibility |
|-----|---------------|
| `core` | Multi-tenant project/organisation model, shared base classes, custom user model |
| `networks` | Water network entities — pipes, nodes, zones, assets; shapefile ingestion pipeline |
| `hydraulics` | EPANET `.inp` ingestion, simulation runs via `wntr`, result storage and querying |
| `sensors` | Sensor registry, real-time readings via MQTT → Channels, time-series storage |
| `analytics` | Spatial analysis (buffer, overlay, watershed), ML anomaly detection, leak scoring |
| `alerts` | Alert rules engine, notification dispatch (email, SMS via Africa's Talking, push) |
| `api` | DRF router, serializers, viewsets, API versioning (`/api/v1/`) |

---

## 4. Technology Stack

### Core
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Language | Python 3.12 | ML ecosystem, GDAL bindings, WNTR |
| Framework | Django 5.x + GeoDjango | Built-in spatial ORM on top of PostGIS |
| Database | PostgreSQL 16 + PostGIS 3.4 | Industry standard for GIS; ST_* spatial functions |
| API | Django REST Framework 3.15 | Browsable API, serializers, viewsets |
| Real-time | Django Channels 4 + Redis | WebSocket push for live sensor data |
| Async tasks | Celery 5 + Redis | Shapefile processing, EPANET runs, ML inference |

### Geospatial
| Library | Use |
|---------|-----|
| GDAL / GEOS / PROJ | Coordinate transforms, geometry operations |
| `fiona` | Shapefile read/write |
| `geopandas` | Tabular spatial data manipulation |
| `shapely` | Geometry construction and validation |
| `pyproj` | CRS reprojection (any CRS → WGS84 for storage) |

### Hydraulics
| Library | Use |
|---------|-----|
| `wntr` | EPANET solver, network graph analysis, resilience metrics |
| `epynet` | EPANET .inp parser (fallback) |

### ML / Analytics
| Library | Use |
|---------|-----|
| `scikit-learn` | Isolation Forest, LOF for anomaly detection |
| `pandas` / `numpy` | Time-series feature engineering |
| `statsmodels` | Demand forecasting (SARIMA) |

### Notifications
| Service | Channel |
|---------|---------|
| Africa's Talking | SMS (Kenya, East Africa) |
| SendGrid / SMTP | Email |
| Firebase FCM | Push notifications |

---

## 5. Data Models (Key Entities)

### `core`
- `Organisation` — multi-tenant root; each utility is one org
- `Project` — a named water network dataset within an org
- `CustomUser` — extends AbstractUser; role: `engineer` | `ops_staff` | `admin`

### `networks`
- `NetworkUpload` — tracks raw file upload state and validation errors
- `WaterNetwork` — top-level network metadata (CRS, bbox, total length, zone list)
- `Pipe` — LineString geometry, material, diameter, roughness, status, zone
- `Node` — Point geometry (junction, reservoir, tank); demand, elevation
- `Zone` — Polygon geometry; service zone boundary
- `Asset` — Point; type: pump, valve, meter, treatment plant

### `hydraulics`
- `SimulationRun` — EPANET .inp file reference, run status, duration, wntr version
- `PressureResult` — node-level pressure over time (TimescaleDB or partitioned by run)
- `FlowResult` — pipe-level flow over simulation timesteps
- `HydraulicScenario` — named "what-if" run (demand multiplier, pipe closure, etc.)

### `sensors`
- `Sensor` — physical sensor: type (pressure/flow/quality), lat/lon, associated pipe/node
- `SensorReading` — time-series: sensor FK, timestamp, value, unit, quality_flag
- `MQTTBroker` — connection config per org (host, port, topics)

### `analytics`
- `AnomalyDetectionModel` — trained model artifact, training date, metric scores
- `AnomalyEvent` — detected anomaly: type, confidence, affected pipes/zones, timestamp
- `LeakRiskScore` — per-pipe risk score derived from material age + hydraulic deviation

### `alerts`
- `AlertRule` — threshold-based rule (e.g., pressure < 5 psi in zone X)
- `AlertEvent` — triggered alert instance with severity, status (open/ack/resolved)
- `Notification` — delivery record (channel, recipient, status, timestamp)

---

## 6. API Design

Base URL: `/api/v1/`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/networks/upload/` | POST | Upload shapefile zip or EPANET .inp |
| `/networks/{id}/validate/` | GET | Return validation report |
| `/networks/{id}/pipes/` | GET | GeoJSON FeatureCollection of pipes (bbox filter) |
| `/networks/{id}/nodes/` | GET | GeoJSON nodes |
| `/networks/{id}/zones/` | GET | GeoJSON zones |
| `/hydraulics/runs/` | POST | Trigger new EPANET simulation |
| `/hydraulics/runs/{id}/results/` | GET | Pressure/flow results for a run |
| `/sensors/` | GET/POST | Sensor registry |
| `/sensors/{id}/readings/` | GET | Time-series readings (start, end, resample params) |
| `/analytics/anomalies/` | GET | List anomaly events (filterable by zone, time) |
| `/analytics/leak-risk/` | GET | GeoJSON pipe layer with risk_score property |
| `/alerts/rules/` | GET/POST | Alert rule management |
| `/alerts/events/` | GET | Alert event log |
| `ws://…/ws/sensors/{network_id}/` | WebSocket | Live sensor push stream |

All geometry responses are GeoJSON. Authentication: JWT (djangorestframework-simplejwt).

---

## 7. Security Considerations

- JWT auth on all API endpoints; org-scoped queryset filtering (no cross-tenant data leakage)
- File upload validation: whitelist extensions, max size, virus scan hook
- EPANET solver runs in isolated Celery worker (no shell injection from .inp content)
- CORS configured per environment (dev: all, prod: specific frontend origin)
- Django's GDAL/GEOS calls use safe geometry constructors, never raw SQL concat
- Secrets via environment variables (`.env`), never in code

---

## 8. Testing Strategy

| Layer | Tool | Target coverage |
|-------|------|----------------|
| Unit (models, utils) | `pytest-django` | 90%+ |
| API endpoints | `pytest` + `APIClient` | All happy + error paths |
| Spatial operations | GeoDjango test fixtures + real shapefiles | Key transforms |
| Async (Celery) | `pytest-celery` with eager mode | Task logic |
| WebSocket | `pytest-django` + Channels test client | Push events |
| Integration | Docker Compose test stack | Upload → validate → simulate flow |

---

## 9. Deployment Architecture

```
Nginx (reverse proxy + static)
    ├── Gunicorn (Django WSGI — REST API)
    ├── Daphne / uvicorn (Django ASGI — WebSocket)
    └── Flower (Celery monitoring)

Celery workers (2 queues):
    ├── heavy  — EPANET runs, ML training
    └── default — shapefile processing, notifications

Storage:
    ├── PostgreSQL + PostGIS — primary database
    ├── Redis — Channels layer + Celery broker
    └── S3-compatible (MinIO dev / AWS prod) — uploaded files
```

Dev: Docker Compose with all services.  
Prod target: VPS (Ubuntu 22.04) or Render/Railway for initial deployment.

---

## 10. Development Standards

- Python: PEP 8, enforced with `ruff`
- Git: feature branches off `gis_backend`; PR review before merge to `main`
- Commits: conventional commits (`feat:`, `fix:`, `chore:`)
- No hardcoded coordinates or utility names in business logic — everything parameterised through `Organisation` and `Project` models
- GeoDjango `SRID=4326` (WGS84) for all stored geometry; transform on ingest
- All file paths through Django's storage backend (not raw `os.path`)
