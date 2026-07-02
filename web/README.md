# AquaWatch — Water Utility Monitoring (React)

React + Vite + TypeScript port of the design mockups in `../design/`.

## Stack
- React 18 + TypeScript + Vite 5
- React Router v6
- Recharts (charts)
- React Leaflet + Leaflet (map)
- Lucide icons
- Shared CSS design system (`src/styles/shared.css`) — same TechBlue palette and `data-theme` light/dark switch as the design folder

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the built app
```

## Layout
- `src/App.tsx` — router
- `src/components/Layout.tsx` — sidebar + topbar shell
- `src/components/UtilityMap.tsx` — Kenyan utility map (Leaflet)
- `src/components/LocationFilter.tsx` — search + status + county chip filter
- `src/data/mockData.ts` — Kenyan utilities + WHO parameter definitions (incl. pressure & level sensors)
- `src/pages/` — Dashboard, LocationDetail, Alerts, Predictive, Statistics, Settings, Account
- `src/lib/theme.ts` — light/dark theme hook (persisted to localStorage)
