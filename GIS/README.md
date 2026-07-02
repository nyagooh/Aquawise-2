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
