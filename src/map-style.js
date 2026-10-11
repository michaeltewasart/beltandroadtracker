// Dark-gray basemap modeled on the reference site's Mapbox "Rango" style.
// Tiles and fonts come from OpenFreeMap (free, no API key, OpenMapTiles schema).

const name = ['coalesce', ['get', 'name:en'], ['get', 'name']];

const colors = {
  land: '#474747',
  water: '#242424',
  park: '#3f4543',
  road: '#5a5a5a',
  border: '#fcfcfc',
  label: '#f0f0f0',
  halo: '#2a2a2a',
};

export const SKY_GLOBE = {
  'sky-color': '#0b0d10',
  'horizon-color': '#2b2f36',
  'fog-color': '#0b0d10',
  'sky-horizon-blend': 0.5,
  'horizon-fog-blend': 0.6,
  'fog-ground-blend': 0.5,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
};

export const mapStyle = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  // Any expression here makes MapLibre create its globe-capable projection; this one always
  // resolves to flat Mercator. main.js animates it for the 2D/3D toggle (see FLAT_AT_REST).
  projection: { type: ['interpolate', ['linear'], ['zoom'], -2, 'vertical-perspective', -1, 'mercator'] },
  sources: {
    omt: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution:
        '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': colors.land } },
    {
      id: 'park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      minzoom: 6,
      paint: { 'fill-color': colors.park, 'fill-opacity': 0.6 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': colors.water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      minzoom: 6,
      paint: { 'line-color': colors.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 14, 3] },
    },
    {
      id: 'roads-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 5,
      filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 5, 0.4, 10, 1.5, 16, 8],
      },
    },
    {
      id: 'roads-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 10,
      filter: ['match', ['get', 'class'], ['secondary', 'tertiary', 'minor', 'service'], true, false],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.road,
        'line-opacity': 0.7,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 10, 0.3, 16, 4],
      },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 7,
      filter: ['==', ['get', 'class'], 'rail'],
      paint: { 'line-color': '#6b6b6b', 'line-width': 0.8, 'line-dasharray': [3, 2] },
    },
    {
      id: 'boundary-state',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      minzoom: 3,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': colors.border, 'line-opacity': 0.18, 'line-width': 0.6, 'line-dasharray': [2, 2] },
    },
    {
      id: 'boundary-country',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': colors.border,
        'line-opacity': 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2, 10, 2],
      },
    },
    {
      id: 'label-water',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      filter: ['match', ['get', 'class'], ['ocean', 'sea'], true, false],
      layout: {
        'text-field': name,
        'text-font': ['Noto Sans Italic'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 6, 14],
        'text-letter-spacing': 0.2,
        'text-max-width': 6,
      },
      paint: { 'text-color': '#7a7a7a' },
    },
    {
      id: 'label-city',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 4,
      filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
      layout: {
        'text-field': name,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 15],
        'symbol-sort-key': ['get', 'rank'],
      },
      paint: { 'text-color': colors.label, 'text-halo-color': colors.halo, 'text-halo-width': 1.2, 'text-opacity': 0.85 },
    },
    {
      id: 'label-state',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 4,
      maxzoom: 8,
      filter: ['==', ['get', 'class'], 'state'],
      layout: {
        'text-field': name,
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.15,
      },
      paint: { 'text-color': '#bdbdbd', 'text-halo-color': colors.halo, 'text-halo-width': 1 },
    },
    {
      id: 'label-country',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      maxzoom: 9,
      filter: ['==', ['get', 'class'], 'country'],
      layout: {
        'text-field': name,
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 9, 4, 13, 7, 16],
        'text-max-width': 7,
        'symbol-sort-key': ['get', 'rank'],
      },
      paint: { 'text-color': colors.label, 'text-halo-color': colors.halo, 'text-halo-width': 1.2 },
    },
  ],
};
