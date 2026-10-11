# BRI Tracker

An interactive map tracking China's Belt and Road Initiative projects. Drag, zoom, and click any marker to see the project's name, type, and description. The 2D / 3D toggle morphs the flat map into a rotatable globe.

Built with [Vite](https://vite.dev), [Tailwind CSS v4](https://tailwindcss.com), and [MapLibre GL JS](https://maplibre.org). The basemap uses free [OpenFreeMap](https://openfreemap.org) tiles, so no API key is needed.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run preview  # serve dist/ locally
```

## Updating the projects

Project data comes from the Webflow CMS export at `data/projects.csv`. To update it, export the Projects collection from Webflow again, replace that file, and rebuild. `npm run data`, which also runs automatically before `dev` and `build`, converts it to `public/data/projects.geojson`. Archived and draft items are skipped.

Columns used: `Name`, `Project Type`, `Description`, `Country`, `Continent`, `Lattitude`, `Longitude`, `Cost`, `Featured Image`, `TSP Main Link`, `Archived`, `Draft`.

## Notes

- `maplibre-gl` is pinned to an exact version because the smooth 2D↔3D morph (`setGlobeness` in `src/main.js`) relies on MapLibre internals. After upgrading, check that the toggle still animates. If those internals ever disappear, it falls back to an instant switch.
