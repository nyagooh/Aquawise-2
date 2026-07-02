# Uhai WashWise

A real-time water quality monitoring dashboard for Kisumu, Kenya. Built to help water operators and communities track contamination risk, sensor readings, and safety alerts across five sub-regions near key water bodies.

![Dashboard Preview](Uhaiwashwise1_page-0001%201.png)

---

## What it does

- **Live sensor readings** — temperature and turbidity from real sensors; pH, dissolved oxygen, conductivity, and nitrates from simulation
- **Region-based filtering** — switch between All Regions and specific sub-regions (Dunga, Ahero, Nyalenda, Kibos, Kondele)
- **Parameter trend charts** — 24-hour area chart per region showing safe range boundaries
- **Water quality predictions** — 7-day contamination risk forecast per region with expandable details
- **Alerts table** — filterable by severity (Critical / Warning / Resolved)
- **Monitoring stations** — status of all water source stations per region
- **Dark / light mode** — toggle in the header

---

## Regions covered

| Region | Water Body |
|--------|-----------|
| Dunga | Lake Victoria — Dunga Beach |
| Ahero | Nyando River & Irrigation Canals |
| Nyalenda | Nyalenda Wetland & Streams |
| Kibos | Kibos River |
| Kondele | Kondele Municipal Water Points |

---

## Tech stack

### Frontend

| Tool | Purpose |
|------|---------|
| React 18 | UI framework |
| TypeScript 4 | Type safety |
| Vite 8 | Build tool & dev server |
| Tailwind CSS 3 | Styling |
| Recharts 2 | Charts |
| Lucide React | Icons |

### Backend

| Tool | Purpose |
|------|---------|
| Django 4.2 | Web framework |
| Django REST Framework | JSON API |
| django-cors-headers | CORS for local dev |
| SQLite | Database |

---

## Running the project

Both the backend and frontend must be running at the same time. Open two terminals.

### Prerequisites

- Python 3.10+
- Node.js 18+

---

### Terminal 1 — Backend

```bash
cd backend

pip install -r requirements.txt

python manage.py makemigrations api
python manage.py migrate
python manage.py seed_data        # loads regions, stations, alerts & predictions

python manage.py runserver        # http://localhost:8000
```

---

### Terminal 2 — Frontend

```bash
cd dashboard

npm install
npm run dev                       # http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies all `/api` requests to `localhost:8000`, so both must be running.

---

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/regions/` | All monitored regions |
| GET | `/api/sensor-readings/` | Current live sensor values |
| GET | `/api/timeseries/` | 24-hour parameter history |
| GET | `/api/water-sources/` | Monitoring station statuses |
| GET | `/api/alerts/` | Recent alerts |
| GET | `/api/predictions/` | 7-day regional risk forecasts |

All list endpoints accept an optional `?region=r1` query parameter to filter by region ID.

---

## Project structure

```
Aquawise/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── aquawise/                  # Django project config
│   │   ├── settings.py
│   │   └── urls.py
│   └── api/                       # REST API app
│       ├── models.py              # Region, WaterSource, SensorParameter, Alert, …
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py
│       └── management/commands/
│           └── seed_data.py       # Populates the database with initial data
└── dashboard/
    └── src/
        ├── components/            # UI components
        ├── context/
        │   ├── ThemeContext.tsx
        │   ├── NavigationContext.tsx
        │   └── DataContext.tsx    # Fetches all API data, provides it app-wide
        ├── data/
        │   └── mockData.ts        # TypeScript type definitions only
        ├── services/
        │   └── api.ts             # Typed fetch helpers for each endpoint
        ├── utils/
        │   └── riskCalculator.ts
        └── App.tsx
```

---

## Color system

Primary blue: `#2563EB` · Background light: `#E8EEF8` · Background dark: `#1A2332`

All colors are defined in `tailwind.config.js` under `theme.extend.colors`.
