# AquaWatch — GIS-First Smart Water Dashboard

React + TypeScript + Vite implementation of the GIS-first demo flow.
Mirrors the static HTML demo in [`design/`](../design) with the same data, styling, and interactions.

## Quick start

```bash
cd GIS
npm install
npm run dev
```

Vite dev server runs on http://localhost:5174.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | for uploads / lead form | Base URL of the GIS backend (default `http://localhost:8000`). |
| `VITE_GOOGLE_MAPS_API_KEY` | optional | Google Maps tile key for the GIS workspace **Map** basemap. When unset, the workspace falls back to CARTO tiles; the **No basemap** engineering-canvas mode needs no key. |

Copy `.env.example` to `.env.local` and fill in values. To enable Google tiles,
create a key at the [Google Maps Platform console](https://console.cloud.google.com/google/maps-apis)
(Maps JavaScript API enabled), restrict it to your domains, and set
`VITE_GOOGLE_MAPS_API_KEY`.

## Upload → render (GIS backend)

The **Upload GIS Data** flow (`/demo/upload`) posts a file to the bundled GIS
backend, which parses + reprojects it to WGS84 and returns GeoJSON the map
renders directly. Supported uploads: `.geojson`/`.json`, a zipped shapefile
(`.zip`), or `.kml`/`.kmz`. Loose shapefile parts (`.shp/.dbf/.shx/.prj`) are
bundled into a zip in the browser automatically.

Start the backend (lightweight demo mode — SQLite, no PostGIS/Redis/Celery/auth):

```bash
cd GIS/backend
DJANGO_SETTINGS_MODULE=aquawise_gis.settings.demo venv/bin/python manage.py migrate   # first run only
DJANGO_SETTINGS_MODULE=aquawise_gis.settings.demo venv/bin/python manage.py runserver 0.0.0.0:8000
```

The frontend calls `http://localhost:8000` by default; override with the
`VITE_API_URL` env var. Endpoint: `POST /api/v1/parse/` (form field `file`)
→ `{ pipes, assets, meta }`.

> The full multi-tenant backend (PostGIS + Celery + JWT, in `GIS/backend/apps`)
> remains available via `aquawise_gis.settings.development`; the demo settings
> only wire the stateless `apps.parsing` parse endpoint.

## Deploying on Vercel

Vercel hosts the **frontend** (this `GIS/` folder). When importing the repo:

| Setting           | Value                |
| ----------------- | -------------------- |
| Root Directory    | `GIS`                |
| Framework Preset  | Vite                 |
| Build Command     | `npm run build`      |
| Output Directory  | `dist`               |

`vercel.json` already rewrites all routes to `index.html` for client-side
routing. The bundled Riverton demo (map, dashboard, sensors) works with **no
backend** — its data is static in `public/data/`.

The **file upload** and **demo-request / Book a Walkthrough** features call the
backend, so set the `VITE_API_URL` environment variable in Vercel
(Project → Settings → Environment Variables) to your deployed backend URL:

```
VITE_API_URL=https://your-backend-host.example
```

> ⚠️ Vercel **cannot** run the Django/GDAL backend (it's a long-running server,
> not a serverless function). Host it on Render / Railway / Fly.io / a VM, then
> point `VITE_API_URL` at it. Until then the static demo works, but uploads and
> the lead form will show a "could not reach the server" error.

## Hosting the backend (so upload + lead form work)

The demo backend ships as a slim container — [`backend/docker/Dockerfile.demo`](backend/docker/Dockerfile.demo)
(SQLite, gunicorn; `fiona/pyproj/shapely` wheels bundle GDAL, so no system geo
packages). Deploy it anywhere that runs a container, then set `VITE_API_URL` in
Vercel to its public URL.

### Render (one-click via Blueprint)

A Blueprint is included at [`backend/render.yaml`](backend/render.yaml).

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. It reads `render.yaml` and
   provisions a Docker web service from `GIS/backend` using `Dockerfile.demo`.
3. Deploy. Render gives you a URL like `https://aquawise-gis-backend.onrender.com`.
4. Verify: open `<url>/healthz` → `{"status": "ok"}`.

**Manual setup (any host — Render/Railway/Fly):**
- Root directory: `GIS/backend`
- Dockerfile: `docker/Dockerfile.demo`
- The container runs `migrate` then `gunicorn` on `$PORT` automatically.
- Env vars:
  - `DJANGO_DEBUG=false`
  - `SECRET_KEY=<random string>`
  - `DEMO_LEAD_RECIPIENT=annmaina.info@gmail.com` (where demo requests are sent)
  - For the lead form to actually email (not just log): `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` (e.g. Gmail SMTP + app password)
  - Optional `CORS_ALLOWED_ORIGINS=https://your-app.vercel.app` to lock down CORS

### Then connect Vercel → backend

In Vercel → Project → Settings → Environment Variables, add
`VITE_API_URL=https://aquawise-gis-backend.onrender.com` (your backend URL, no
trailing slash) and **redeploy**. Uploads and the demo/Book-a-Walkthrough form
will now work in production.

## Routes

| Path           | Page         | Purpose                                             |
| -------------- | ------------ | --------------------------------------------------- |
| `/dashboard`   | Dashboard    | KPI summary + GIS preview + alerts feed + zones     |
| `/gis`         | GIS Map      | Core screen — zones, pipes, tanks, sensors          |
| `/alerts`      | Alerts       | Triage queue with severity stats & filters          |
| `/nrw`         | NRW          | Loss tracking, trend chart, zone ranking, insights  |
| `/sensors`     | Sensors      | Sensor inventory by type with summary tiles         |
| `/reports`     | Reports      | Daily / weekly / monthly with asset summary         |

## Deep links

Search results and table rows route to `/gis?focus=<kind>:<id>` to focus a specific entity:

- `/gis?focus=zone:ZD` — open Zone D side panel
- `/gis?focus=sensor:PR-03` — focus the PR-03 pressure sensor
- `/gis?focus=pipe:P-104` — focus pipe segment P-104

## File layout

```
GIS/
├── index.html              Vite HTML entry
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx            React + router bootstrap
    ├── App.tsx             Route table
    ├── styles.css          Theme tokens + shell + components
    ├── data.ts             Synthetic zones, sensors, pipes, alerts
    ├── components/
    │   ├── Shell.tsx       Sidebar + topbar wrapper
    │   ├── Sidebar.tsx     Navigation
    │   ├── Topbar.tsx      Title + global search (⌘K)
    │   └── SidePanel.tsx   GIS detail panel
    └── pages/
        ├── Dashboard.tsx
        ├── GISMap.tsx      SVG map with zones / pipes / tanks / sensors
        ├── Alerts.tsx
        ├── NRW.tsx
        ├── Sensors.tsx
        └── Reports.tsx
```

## Build

```bash
npm run build
npm run preview
```
