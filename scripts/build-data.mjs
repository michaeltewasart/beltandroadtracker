// Converts the Webflow CMS export (data/projects.csv) into a GeoJSON file the map loads.
// Run with `npm run data` (also runs automatically before `dev` and `build`).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import Papa from 'papaparse';

const SRC = new URL('../data/projects.csv', import.meta.url);
const OUT_DIR = new URL('../public/data/', import.meta.url);

// Webflow's default "no image" placeholder; treat it as missing.
const PLACEHOLDER_IMAGE = 'Frame%25207.jpeg';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Rich-text HTML -> array of plain-text paragraphs (rendered with textContent, never innerHTML).
function htmlToParagraphs(html) {
  return html
    .split(/<\/p>|<br\s*\/?>/i)
    .map((chunk) => decodeEntities(chunk.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const { data, errors } = Papa.parse(readFileSync(SRC, 'utf8'), { header: true, skipEmptyLines: true });
if (errors.length) {
  console.warn(`CSV parse warnings:`, errors.slice(0, 5));
}

const features = [];
let skipped = 0;

for (const row of data) {
  const lat = parseFloat(row.Lattitude);
  const lng = parseFloat(row.Longitude);
  const live = row.Archived !== 'true' && row.Draft !== 'true';
  if (!live || !Number.isFinite(lat) || !Number.isFinite(lng) || !row.Name) {
    skipped++;
    continue;
  }

  const image = row['Featured Image'];
  const cost = parseFloat(row.Cost);

  features.push({
    type: 'Feature',
    id: features.length,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      name: row.Name.trim(),
      slug: row.Slug,
      type: row['Project Type'].trim() || 'Project',
      country: row.Country.trim(),
      continent: row.Continent.trim(),
      cost: Number.isFinite(cost) ? cost : null,
      description: htmlToParagraphs(row.Description || ''),
      image: image && !image.includes(PLACEHOLDER_IMAGE) ? image : null,
      link: row['TSP Main Link'] || null,
    },
  });
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(new URL('projects.geojson', OUT_DIR), JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`projects.geojson: ${features.length} projects (${skipped} archived/draft/invalid rows skipped)`);
