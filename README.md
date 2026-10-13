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

All project data lives in one file: **`data/projects.csv`**. Open it in Excel, Numbers or Google Sheets, edit, save as CSV, and restart the site (or run `npm run data`).

| Column | What goes in it |
|---|---|
| Name | Project name shown on the map |
| Slug | Unique ID, lowercase-with-dashes (left blank, one is made from the name) |
| Project Type | e.g. Port, Railway, Dam |
| Status | In Progress, Completed, or Abandoned (coloured tag; blank shows none) |
| Country, Continent | Shown under the name |
| Latitude, Longitude | Marker position, in decimal degrees |
| Cost (USD) | Optional, a plain number |
| Image | A photo file name from `public/images/projects/` (any continent folder), a full image URL, or blank (see that folder's README) |
| Link | Optional "Learn more" URL |
| Description | Plain text; leave a blank line between paragraphs |

`npm run data` (also run automatically before `dev` and `build`) turns it into `public/data/projects.geojson`, the file the map loads. It warns about rows with missing coordinates, duplicate names, or image files that don't exist.

## Notes

- `maplibre-gl` is pinned to an exact version because the smooth 2D↔3D morph (`setGlobeness` in `src/main.js`) relies on MapLibre internals. After upgrading, check that the toggle still animates. If those internals ever disappear, it falls back to an instant switch.
