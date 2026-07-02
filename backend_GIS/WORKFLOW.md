# Workflow & Process Document
## AquaWise GIS Backend — Development & Operational Flows

---

## 1. Development Workflow

### Branch Strategy

```
main                    ← production-ready; protected
  └── gis_backend       ← integration branch for this feature set
        ├── feat/phase1-ingestion
        ├── feat/phase2-spatial-queries
        ├── feat/phase3-hydraulics
        └── fix/shapefile-crs-detection
```

- Never commit directly to `main`
- Feature branches cut from `gis_backend`
- PR → review → merge to `gis_backend` → merge to `main` at phase milestones

### Daily Dev Loop

```
1. Pull latest gis_backend
2. Activate venv  →  source venv/bin/activate
3. docker compose up -d db redis      (start PostGIS + Redis only)
4. python manage.py migrate
5. python manage.py runserver          (Django dev server)
6. celery -A aquawise_gis worker -l info  (separate terminal)
7. Write code → write tests → pytest
8. Commit with conventional prefix (feat:/fix:/chore:)
```

### Commit Convention

```
feat(networks): add shapefile CRS auto-detection
fix(hydraulics): handle zero-roughness before EPANET run
chore(deps): pin wntr to 1.2.0
test(sensors): add MQTT consumer integration test
docs(api): update OpenAPI schema for /networks/upload
```

---

## 2. Data Ingestion Flow

### 2.1 Shapefile Upload → Storage

```
User/API Client
    │
    ├──► POST /api/v1/networks/upload/   (multipart, .zip)
    │
Django (api/views.py)
    ├── Validate file extension and size (< 100 MB)
    ├── Save to S3/MinIO: uploads/{org_id}/{uuid}.zip
    ├── Create NetworkUpload record (status=PENDING)
    └── Enqueue Celery task: process_shapefile.delay(upload_id)

Celery Worker (networks/tasks.py: process_shapefile)
    ├── Download zip from storage
    ├── Unzip to temp dir
    ├── Detect geometry type (LineString=pipes, Point=nodes, Polygon=zones)
    ├── Read with fiona/geopandas
    ├── Detect source CRS from .prj file
    ├── Reproject to EPSG:4326 if needed (pyproj)
    ├── Validate schema:
    │     ├── Required columns present?
    │     ├── Roughness: fill zeros with material defaults
    │     ├── Topology: ST_IsValid on all geometries
    │     └── Duplicates: ST_Equals check on geometries
    ├── Bulk-insert into PostGIS (Pipe, Node, Zone models)
    ├── Build spatial index (GIST — auto via Django migration)
    ├── Update NetworkUpload: status=COMPLETE | FAILED
    └── Publish Channels event: network_upload_done

Client polls GET /api/v1/networks/uploads/{id}/
    └── Returns status + validation_report JSON
```

### 2.2 EPANET Ingestion Flow

```
POST /api/v1/networks/upload/   (.inp file)
    │
Celery: process_epanet.delay(upload_id)
    ├── Parse with wntr.network.WaterNetworkModel(inp_file)
    ├── Extract:
    │     ├── Pipes → Pipe model (start/end node coords → LineString geometry)
    │     ├── Junctions → Node model (Point geometry, demand, elevation)
    │     ├── Reservoirs/Tanks → Node (type differentiated)
    │     └── Valves/Pumps → Asset model
    ├── Roughness: use values from .inp; flag zeros
    ├── Node connectivity: build adjacency from pipe start_node / end_node
    └── Store in same schema as shapefile path
```

### 2.3 Validation Report Schema

```json
{
  "network_id": "uuid",
  "status": "COMPLETE_WITH_WARNINGS",
  "summary": {
    "total_pipes": 4947,
    "total_nodes": 3201,
    "total_length_km": 790.58,
    "crs_detected": "EPSG:32736",
    "crs_stored": "EPSG:4326"
  },
  "warnings": [
    {
      "type": "ROUGHNESS_ZERO",
      "count": 4947,
      "message": "All roughness values were 0; populated from material defaults",
      "affected_materials": {"PVC": 150, "GI": 100, "Steel": 95}
    },
    {
      "type": "NODE_CONNECTIVITY_MISSING",
      "count": 312,
      "message": "Node1/Node2 fields empty; topology inferred from geometry proximity"
    }
  ],
  "errors": []
}
```

---

## 3. Hydraulic Simulation Flow

```
Engineer uploads .inp  →  stored as SimulationRun (status=QUEUED)
    │
Celery heavy queue: run_epanet_simulation.delay(run_id)
    │
    ├── Load .inp from storage
    ├── Apply roughness overrides if requested
    ├── wntr.sim.EpanetSimulator(wn).run_sim()
    ├── Parse results:
    │     ├── pressure_at_nodes (DataFrame: node × time)
    │     └── flowrate_in_pipes (DataFrame: pipe × time)
    ├── Bulk-insert PressureResult rows (node, timestamp, pressure_psi)
    ├── Bulk-insert FlowResult rows (pipe, timestamp, flow_lps)
    ├── Update SimulationRun: status=COMPLETE, duration_s=…
    └── Channels event: simulation_complete → notify connected engineers
    
Client:
    GET /api/v1/hydraulics/runs/{id}/results/pressure/spatial/
    → GeoJSON: each node Feature has "pressure_min", "pressure_max", "pressure_avg"
       for the simulation period → frontend renders choropleth
```

---

## 4. Real-Time Sensor Data Flow

```
Physical Sensor (field)
    └──► MQTT Broker  (topic: aquawise/{org_id}/sensors/{sensor_id}/reading)
              │
              ▼
Celery Beat (every 30s): mqtt_subscriber task
    ├── Subscribe to org's configured MQTT broker
    ├── Receive message payload:
    │     {"sensor_id": "uuid", "value": 4.2, "unit": "bar", "ts": "ISO8601"}
    ├── Validate sensor belongs to org (security)
    ├── Store SensorReading (sensor, timestamp, value, unit)
    └── Publish to Redis Channels group: network_{network_id}_sensors

Django Channels Consumer (ws/sensors/{network_id}/)
    ├── On connect: authenticate JWT, join group network_{network_id}_sensors
    ├── On group message: forward to WebSocket client
    └── Client receives: {"type": "reading", "sensor_id": "…", "value": 4.2, "ts": "…"}

Frontend Map:
    └── Updates sensor marker colour based on value vs threshold
```

### REST Fallback (no sensors yet)
```
POST /api/v1/sensors/{id}/readings/
    Body: {"value": 4.2, "unit": "bar", "timestamp": "2026-05-17T10:00:00Z"}
    → Same SensorReading storage + Channels publish
```

---

## 5. Anomaly Detection Flow

```
Celery Beat (every 5 minutes): detect_anomalies task
    │
    For each org with an active AnomalyDetectionModel:
    │
    ├── Fetch last 60 minutes of SensorReadings per sensor
    ├── Feature vector: [value, rolling_mean_1h, rolling_std_1h, hour_of_day, day_of_week]
    ├── Load trained IsolationForest model from storage
    ├── Predict: anomaly_score per reading
    ├── If score > threshold:
    │     ├── Create AnomalyEvent (sensor, type, confidence, timestamp)
    │     ├── Evaluate AlertRules matching this event
    │     └── If rule matches → create AlertEvent → dispatch Notification
    └── Update LeakRiskScore for affected pipes

Model Training (Celery task: train_anomaly_model)
    ├── Triggered manually or on schedule (weekly)
    ├── Pulls 30 days of SensorReadings per sensor
    ├── Trains IsolationForest (contamination=0.05)
    ├── Evaluates on holdout set
    └── Saves model artifact to storage; creates AnomalyDetectionModel record
```

---

## 6. Alert & Notification Flow

```
Alert trigger source (any of):
    ├── AnomalyEvent from ML detection
    ├── AlertRule threshold breach (Celery beat evaluation)
    └── Manual alert from engineer via API

        ▼

AlertEvent created (severity: LOW/MEDIUM/HIGH/CRITICAL)
    │
    ├── Channels push → ops staff WebSocket (immediate, in-app)
    ├── Celery task: send_notification.delay(alert_event_id)
    │     ├── Look up users in affected zone with notification preferences
    │     ├── Email: SendGrid template render → send
    │     ├── SMS: Africa's Talking API → send (if phone number set)
    │     └── Store Notification record (channel, status, sent_at)
    └── Alert stays OPEN until ops staff acknowledges via:
          PATCH /api/v1/alerts/events/{id}/  {"status": "acknowledged"}
```

---

## 7. API Request Lifecycle

```
Client Request
    │
    ├── Nginx → Gunicorn/Daphne
    ├── Django middleware:
    │     ├── CORS check
    │     ├── JWT authentication (SimpleJWT)
    │     └── Org-scope injection (request.org = user.organisation)
    ├── DRF ViewSet
    │     ├── Permission check (IsAuthenticated + IsOrgMember)
    │     ├── Queryset filtered to request.org (no cross-tenant data)
    │     ├── Serializer validation
    │     └── Response (GeoJSON or JSON)
    └── Client Response
```

---

## 8. Environment Configuration

### Required Environment Variables

```env
# Django
SECRET_KEY=…
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgis://aquawise:password@localhost:5432/aquawise_gis

# Redis (Celery + Channels)
REDIS_URL=redis://localhost:6379/0

# Storage
USE_S3=False                      # True in production
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
AWS_STORAGE_BUCKET_NAME=aquawise-gis
MINIO_ENDPOINT=http://localhost:9000  # dev only

# Notifications
AFRICASTALKING_USERNAME=…
AFRICASTALKING_API_KEY=…
SENDGRID_API_KEY=…
FROM_EMAIL=alerts@aquawise.io

# MQTT (optional — can be blank if no sensors yet)
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
```

### Docker Compose Services (dev)

```yaml
services:
  db:       PostgreSQL 16 + PostGIS 3.4  (port 5432)
  redis:    Redis 7                       (port 6379)
  django:   Django dev server             (port 8000)
  celery:   Celery worker (default queue)
  celery-heavy: Celery worker (heavy queue — EPANET runs)
  celery-beat:  Celery beat scheduler
  minio:    S3-compatible storage         (port 9000)
  mqtt:     Eclipse Mosquitto MQTT        (port 1883) — optional
```

---

## 9. File & Directory Structure

```
backend/
├── aquawise_gis/           ← Django project root
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   ├── asgi.py             ← Channels ASGI entry
│   └── celery.py
│
├── apps/
│   ├── core/               ← Organisation, CustomUser, Project
│   ├── networks/           ← Pipe, Node, Zone, Asset; ingestion tasks
│   ├── hydraulics/         ← SimulationRun, results; wntr integration
│   ├── sensors/            ← Sensor, SensorReading; MQTT consumer
│   ├── analytics/          ← Anomaly models, leak risk, forecasting
│   ├── alerts/             ← AlertRule, AlertEvent, Notification
│   └── api/                ← DRF router, versioned viewsets
│
├── tests/
│   ├── fixtures/
│   │   └── kisumu_network.zip   ← integration test shapefile
│   ├── test_networks.py
│   ├── test_hydraulics.py
│   ├── test_sensors.py
│   └── test_analytics.py
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── scripts/
│   └── seed_dev.py         ← loads Kisumu shapefile for local dev
│
├── requirements/
│   ├── base.txt
│   ├── development.txt
│   └── production.txt
│
├── .env.example
├── manage.py
├── SDP.md                  ← this repo's planning docs
├── ROADMAP.md
└── WORKFLOW.md
```

---

## 10. Onboarding a New Water Utility (Platform Operator Flow)

```
1. Create Organisation in Django admin (or POST /api/v1/orgs/)
2. Create admin user for that org
3. Utility uploads shapefile zip via frontend upload wizard
4. Platform auto-validates → returns validation report
5. Utility reviews warnings, confirms upload
6. (Optional) Upload EPANET .inp file for hydraulic layer
7. (Optional) Register sensors via /api/v1/sensors/ + provide MQTT credentials
8. (Optional) Configure alert rules per zone
9. Engineers and ops staff log in → see their data, no other org's data
```

This flow works identically whether the utility is in Kisumu (Kenya), Nairobi, Dar es Salaam, Lagos, or anywhere else — the platform is fully location-agnostic.
