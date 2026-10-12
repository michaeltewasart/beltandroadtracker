import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { mapStyle, SKY_GLOBE } from './map-style.js';

const BRAND = '#ff9900';
const DATA_URL = `${import.meta.env.BASE_URL}data/projects.geojson`;
const PROJECTION_MS = 1100;

const isSmall = () => window.matchMedia('(max-width: 639px)').matches;
// Matches Tailwind's `md` breakpoint, where the details panel docks to the left.
const isWide = () => window.matchMedia('(min-width: 768px)').matches;

// Initial camera per view, tuned so the whole world fits on phones and desktops.
const homeView = (mode) => ({
  center: [40, 20],
  zoom: mode === '3d' ? (isSmall() ? 0.6 : 1.9) : isSmall() ? 0.4 : 1.6,
  bearing: 0,
  pitch: 0,
});

const $ = (id) => document.getElementById(id);
const els = {
  count: $('project-count'),
  toggle: $('view-toggle'),
  thumb: $('toggle-thumb'),
  controls: $('controls'),
  sheet: $('sheet'),
  sheetBody: $('sheet-body'),
  sheetClose: $('sheet-close'),
  sheetHandle: $('sheet-handle'),
  image: $('sheet-image'),
  typeText: $('sheet-type-text'),
  sheetStatus: $('sheet-status'),
  name: $('sheet-name'),
  meta: $('sheet-meta'),
  description: $('sheet-description'),
  link: $('sheet-link'),
  status: $('status'),
  statusText: $('status-text'),
};

let mode = '2d';
let selectedId = null;
let hoveredId = null;

const map = new maplibregl.Map({
  container: 'map',
  style: mapStyle,
  ...homeView('2d'),
  minZoom: 0,
  maxZoom: 16,
  dragRotate: false,
  pitchWithRotate: false,
  attributionControl: false,
  renderWorldCopies: true,
});
map.touchZoomRotate.disableRotation();
// Bottom-right, under the zoom buttons, so the left details panel never covers it.
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

const tooltip = new maplibregl.Popup({
  className: 'bri-tooltip',
  closeButton: false,
  closeOnClick: false,
  offset: 12,
  maxWidth: '260px',
});

/* ---------- Data ---------- */

async function loadProjects() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to load project data (${res.status})`);
  return res.json();
}

/* ---------- Layers ---------- */

function addProjectLayers(data) {
  map.addSource('projects', { type: 'geojson', data });

  // Soft glow under each marker; grows on hover / selection.
  map.addLayer({
    id: 'projects-glow',
    type: 'circle',
    source: 'projects',
    paint: {
      'circle-color': BRAND,
      'circle-blur': 1,
      'circle-pitch-alignment': 'map',
      'circle-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.7, 0.35],
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        0, ['case', ['boolean', ['feature-state', 'selected'], false], 14, 7],
        8, ['case', ['boolean', ['feature-state', 'selected'], false], 28, 16],
      ],
    },
  });

  map.addLayer({
    id: 'projects',
    type: 'circle',
    source: 'projects',
    paint: {
      'circle-color': BRAND,
      'circle-pitch-alignment': 'map',
      'circle-stroke-color': [
        'case', ['boolean', ['feature-state', 'selected'], false], '#ffffff', '#405f3b',
      ],
      'circle-stroke-width': [
        'case', ['boolean', ['feature-state', 'selected'], false], 2.5,
        ['boolean', ['feature-state', 'hover'], false], 2, 1,
      ],
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        0, ['case', ['boolean', ['feature-state', 'selected'], false], 7, ['boolean', ['feature-state', 'hover'], false], 6, 4],
        5, ['case', ['boolean', ['feature-state', 'selected'], false], 11, ['boolean', ['feature-state', 'hover'], false], 10, 8],
        12, ['case', ['boolean', ['feature-state', 'selected'], false], 14, 11],
      ],
    },
  });
}

function setFeatureState(id, state) {
  if (id !== null) map.setFeatureState({ source: 'projects', id }, state);
}

/* ---------- Interaction ---------- */

// When the world is zoomed out far enough to repeat, keep the popup on the copy under the cursor.
function wrapCoords(coords, lngLat) {
  const c = coords.slice();
  while (Math.abs(lngLat.lng - c[0]) > 180) c[0] += lngLat.lng > c[0] ? 360 : -360;
  return c;
}

function bindInteractions() {
  map.on('mousemove', 'projects', (e) => {
    const f = e.features[0];
    map.getCanvas().style.cursor = 'pointer';
    if (hoveredId !== f.id) {
      setFeatureState(hoveredId, { hover: false });
      hoveredId = f.id;
      setFeatureState(hoveredId, { hover: true });
    }
    const content = document.createElement('div');
    const type = content.appendChild(document.createElement('p'));
    type.className = 'text-[0.6875rem] font-bold uppercase tracking-wider text-brand';
    type.textContent = f.properties.type;
    const name = content.appendChild(document.createElement('p'));
    name.className = 'text-sm font-medium leading-snug';
    name.textContent = f.properties.name;
    tooltip.setLngLat(wrapCoords(f.geometry.coordinates, e.lngLat)).setDOMContent(content).addTo(map);
  });

  map.on('mouseleave', 'projects', () => {
    map.getCanvas().style.cursor = '';
    setFeatureState(hoveredId, { hover: false });
    hoveredId = null;
    tooltip.remove();
  });

  map.on('click', (e) => {
    // Generous hit box so markers are easy to tap on touch screens.
    const pad = isSmall() ? 14 : 6;
    const [hit] = map.queryRenderedFeatures(
      [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]],
      { layers: ['projects'] },
    );
    if (hit) {
      selectProject(hit, wrapCoords(hit.geometry.coordinates, e.lngLat));
    } else {
      closeSheet();
    }
  });

  els.sheetClose.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });
  bindSwipeToClose();

  els.controls.addEventListener('click', (e) => {
    const action = e.target.closest('button')?.dataset.action;
    if (action === 'zoom-in') map.zoomIn();
    if (action === 'zoom-out') map.zoomOut();
    if (action === 'reset') map.flyTo({ ...homeView(mode), duration: 1200 });
  });

  els.toggle.addEventListener('click', (e) => {
    const next = e.target.closest('button')?.dataset.mode;
    if (next) setMode(next);
  });
  els.toggle.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      setMode(mode === '2d' ? '3d' : '2d');
      els.toggle.querySelector(`[data-mode="${mode}"]`).focus();
    }
  });
}

/* ---------- Details sheet ---------- */

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

// Written out in full so Tailwind can see every class at build time.
const STATUS_BASE = 'items-center rounded-full px-2.5 py-1 text-[14px]/[18px] font-bold uppercase tracking-wider';
const STATUS_STYLES = {
  'In Progress': 'inline-flex bg-yellow-400/15 text-yellow-300',
  Completed: 'inline-flex bg-green-500/15 text-green-400',
  Abandoned: 'inline-flex bg-red-500/15 text-red-400',
};

function metaItem(label, value) {
  const wrap = document.createElement('div');
  wrap.className = 'flex gap-1';
  const dt = wrap.appendChild(document.createElement('dt'));
  dt.className = 'sr-only';
  dt.textContent = label;
  const dd = wrap.appendChild(document.createElement('dd'));
  dd.textContent = value;
  return wrap;
}

function renderSheet(p) {
  els.typeText.textContent = p.type;

  const statusStyle = STATUS_STYLES[p.status];
  els.sheetStatus.className = `${STATUS_BASE} ${statusStyle ?? 'hidden'}`;
  els.sheetStatus.textContent = statusStyle ? p.status : '';
  els.name.textContent = p.name;

  const location = [p.country, p.continent].filter(Boolean).join(', ');
  els.meta.replaceChildren(
    ...[
      location && metaItem('Location', `📍 ${location}`),
      p.cost && metaItem('Estimated cost', `💰 ${usd.format(p.cost)}`),
    ].filter(Boolean),
  );

  const paragraphs = p.description.length ? p.description : ['No description available yet.'];
  els.description.replaceChildren(
    ...paragraphs.map((text) => {
      const el = document.createElement('p');
      el.textContent = text;
      return el;
    }),
  );

  els.image.classList.add('hidden');
  if (p.image) {
    els.image.onload = () => els.image.classList.remove('hidden');
    els.image.onerror = () => els.image.classList.add('hidden');
    // Local photos (public/images/projects/) are site-relative; CMS images are full URLs.
    els.image.src = /^https?:/.test(p.image) ? p.image : `${import.meta.env.BASE_URL}${p.image}`;
  } else {
    els.image.removeAttribute('src');
  }

  els.link.classList.toggle('hidden', !p.link);
  els.link.classList.toggle('inline-flex', !!p.link);
  if (p.link) els.link.href = p.link;

  els.sheetBody.scrollTop = 0;
}

function selectProject(feature, coords) {
  // GeoJSON properties come back from the renderer serialized; arrays become JSON strings.
  const p = { ...feature.properties };
  if (typeof p.description === 'string') p.description = JSON.parse(p.description);

  setFeatureState(selectedId, { selected: false });
  selectedId = feature.id;
  setFeatureState(selectedId, { selected: true });

  renderSheet(p);
  openSheet();
  tooltip.remove();

  // Center the marker in the map area the panel leaves visible: right of the side
  // panel on wide screens, above the bottom sheet otherwise. offset* sizes ignore the
  // slide-in transform, which is still mid-animation here.
  requestAnimationFrame(() => {
    let offset;
    if (isWide()) {
      offset = [(els.sheet.offsetLeft + els.sheet.offsetWidth) / 2, 0];
    } else {
      const sheetH = els.sheet.offsetHeight;
      offset = [0, -(isSmall() ? sheetH / 2 : Math.min(sheetH / 2, window.innerHeight / 4))];
    }
    map.flyTo({
      center: coords,
      offset,
      zoom: Math.max(map.getZoom(), mode === '3d' ? 2.2 : 3),
      speed: 0.8,
      curve: 1.2,
      essential: true,
    });
  });
}

function openSheet() {
  els.sheet.dataset.open = 'true';
  els.sheet.setAttribute('aria-hidden', 'false');
  els.sheet.inert = false;
}

function closeSheet() {
  if (els.sheet.dataset.open !== 'true') return;
  els.sheet.dataset.open = 'false';
  els.sheet.setAttribute('aria-hidden', 'true');
  els.sheet.inert = true;
  setFeatureState(selectedId, { selected: false });
  selectedId = null;
}

// Phones: drag the sheet down by its handle (or from the top of its content) to dismiss.
function bindSwipeToClose() {
  let startY = null;
  let dy = 0;

  els.sheet.addEventListener('touchstart', (e) => {
    if (isWide()) return; // the side panel closes with its button, Esc, or a map click
    const onHandle = els.sheetHandle.contains(e.target);
    if (!onHandle && els.sheetBody.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    dy = 0;
  }, { passive: true });

  els.sheet.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    if (dy > 0) {
      els.sheet.style.transition = 'none';
      els.sheet.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });

  els.sheet.addEventListener('touchend', () => {
    if (startY === null) return;
    els.sheet.style.transition = '';
    els.sheet.style.transform = '';
    if (dy > 90) closeSheet();
    startY = null;
  });
}

/* ---------- 2D <-> 3D ---------- */

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
let projectionAnim = null;
let globeness = 0; // 0 = flat Mercator, 1 = full globe

// At rest on the globe, use MapLibre's own "globe" behavior: a sphere when zoomed out,
// switching to Mercator past zoom 11-12 where a sphere has no visual benefit.
const GLOBE_AT_REST = ['interpolate', ['linear'], ['zoom'], 11, 'vertical-perspective', 12, 'mercator'];
// Flat map at rest. This has to be an expression too: once the projection has held an
// expression, a plain "mercator" string evaluates to a degenerate blend that MapLibre
// draws as a globe. Both stops sit below zoom 0, so it always resolves to Mercator.
const FLAT_AT_REST = ['interpolate', ['linear'], ['zoom'], -2, 'vertical-perspective', -1, 'mercator'];

// The map keeps a single globe projection for its whole life (see `projection` in
// map-style.js), and we morph it by changing that projection's value in place.
// map.setProjection() can't be called per frame: it rebuilds the projection and
// reloads every tile. Updating in place uses MapLibre internals, which is why
// maplibre-gl is pinned to an exact version.
//
// MapLibre only honors a partial blend when it comes out of an expression, so mid-morph
// we build a zoom interpolation whose stops straddle the current zoom so that it
// evaluates to exactly `t` right now.
function setGlobeness(t) {
  globeness = t;
  let type;
  if (t <= 0) type = FLAT_AT_REST;
  else if (t >= 1) type = GLOBE_AT_REST;
  else {
    const z = map.getZoom() - t;
    type = ['interpolate', ['linear'], ['zoom'], z, 'mercator', z + 1, 'vertical-perspective'];
  }
  const projection = map.style?.projection;
  if (typeof projection?.updateTransitions === 'function' && typeof map._update === 'function') {
    projection.setProjection({ type });
    projection.updateTransitions({ now: performance.now(), transition: { duration: 0, delay: 0 } });
    map._update(true);
  } else if (t === 0 || t === 1) {
    // Fallback if internals change: switch without the morph.
    map.setProjection({ type: t ? 'globe' : 'mercator' });
  }
}

function setMode(next) {
  if (next === mode) return;
  mode = next;
  const toGlobe = mode === '3d';

  els.toggle.querySelectorAll('button').forEach((b) => {
    const active = b.dataset.mode === mode;
    b.setAttribute('aria-checked', String(active));
    b.tabIndex = active ? 0 : -1;
  });
  els.thumb.style.transform = toGlobe ? 'translateX(100%)' : '';

  // Rotation and pitch only make sense on the globe; the flat map stays north-up like the reference.
  if (toGlobe) {
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
  } else {
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
  }

  // Morph the projection frame by frame instead of snapping. Starts from what is on
  // screen: mid-animation, or already flat because the globe is zoomed in past level 12.
  cancelAnimationFrame(projectionAnim);
  const from = map.style?.projection?.transitionState ?? globeness;
  const to = toGlobe ? 1 : 0;
  const duration = PROJECTION_MS * Math.abs(to - from);
  const startTime = performance.now();

  const step = (now) => {
    const t = duration ? Math.min(1, (now - startTime) / duration) : 1;
    setGlobeness(from + (to - from) * easeInOut(t));
    if (t < 1) projectionAnim = requestAnimationFrame(step);
  };
  projectionAnim = requestAnimationFrame(step);

  // Ease the camera alongside the morph: pull back to show the whole globe, or flatten back out.
  const home = homeView(mode);
  map.easeTo({
    zoom: toGlobe ? Math.min(map.getZoom(), home.zoom + 0.6) : Math.max(map.getZoom(), home.zoom),
    pitch: 0,
    bearing: 0,
    duration: PROJECTION_MS,
    easing: easeInOut,
    essential: true,
  });
}

/* ---------- Boot ---------- */

function hideStatus() {
  els.status.classList.add('opacity-0');
  setTimeout(() => els.status.remove(), 800);
}

// Expose the header card's bottom edge as --brand-bottom so the side panel starts below it.
const brand = document.getElementById('brand');
const syncBrandBottom = () =>
  document.documentElement.style.setProperty('--brand-bottom', `${brand.getBoundingClientRect().bottom}px`);
new ResizeObserver(syncBrandBottom).observe(brand);
window.addEventListener('resize', syncBrandBottom);

const dataPromise = loadProjects();
dataPromise.catch(() => {}); // handled in the load callback

if (import.meta.env.DEV) Object.assign(window, { map, setGlobeness });

map.on('load', async () => {
  map.setSky(SKY_GLOBE);
  try {
    const data = await dataPromise;
    addProjectLayers(data);
    bindInteractions();
    els.count.textContent = `${data.features.length.toLocaleString()} projects`;
    hideStatus();
  } catch (err) {
    console.error(err);
    els.statusText.textContent = 'Could not load project data. Please refresh to try again.';
    els.count.textContent = 'Unavailable';
  }
});
