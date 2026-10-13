// Converts the project list (data/projects.csv) into the GeoJSON file the map loads.
// Run with `npm run data` (also runs automatically before `dev` and `build`).
//
// data/projects.csv is the single source of truth. Columns:
//   Name, Slug, Project Type, Status, Country, Continent, Latitude, Longitude, Cost (USD), Image, Link, Description
// - Slug: unique ID for the project (lowercase-with-dashes).
// - Status: In Progress, Completed, or Abandoned (shown as a coloured tag; blank shows no tag).
// - Image: a photo's file name (found in any folder under public/images/projects/, e.g. the
//   continent folders), a path like "Asia/photo.jpg", a full image URL, or blank. Blank rows are
//   auto-matched by name to photos that no row claims (see match-images.mjs).
// - Description: plain text; separate paragraphs with a blank line.
//
// Routes (railways, roads, pipelines…): data/routes/<project slug>.geojson holds a LineString or
// MultiLineString for that project. They're combined into public/data/routes.geojson and drawn as
// dotted lines.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { sep } from 'node:path';
import Papa from 'papaparse';
import { matchImages } from './match-images.mjs';

const SRC = new URL('../data/projects.csv', import.meta.url);
const OUT_DIR = new URL('../public/data/', import.meta.url);
const IMAGES_DIR = new URL('../public/images/projects/', import.meta.url);
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif)$/i;
const ROUTES_DIR = new URL('../data/routes/', import.meta.url);

// Like encodeURIComponent, but leaves characters that are legal in a URL path (& + , ; = $ @ :)
// as-is: some static servers, including Vite's dev server, don't decode e.g. %26 back to "&".
const encodePathSegment = (name) =>
  encodeURIComponent(name).replace(/%(26|2B|2C|3B|3D|24|40|3A)/g, (m) => decodeURIComponent(m));

const warn = (msg) => console.warn(`  ⚠ ${msg}`);

// Accepts loose spellings so a hand-edited cell still works.
const STATUSES = {
  'in progress': 'In Progress', 'in-progress': 'In Progress', inprogress: 'In Progress', ongoing: 'In Progress', planned: 'In Progress', proposed: 'In Progress',
  completed: 'Completed', complete: 'Completed', done: 'Completed', operational: 'Completed',
  abandoned: 'Abandoned', cancelled: 'Abandoned', canceled: 'Abandoned',
};

const csv = readFileSync(SRC, 'utf8').replace(/^﻿/, ''); // Excel adds a byte-order mark
const { data, errors } = Papa.parse(csv, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
for (const e of errors.slice(0, 5)) warn(`CSV row ${e.row + 2}: ${e.message}`);

// Photos anywhere under public/images/projects/, as paths relative to it ("South America/x.jpg").
const imageFiles = readdirSync(IMAGES_DIR, { recursive: true })
  .map((p) => p.split(sep).join('/'))
  .filter((p) => IMAGE_EXTENSIONS.test(p));
const fileName = (p) => p.split('/').pop();
const folderOf = (p) => (p.includes('/') ? p.split('/')[0] : null);
// Keyed loosely so stray spaces in a file name (" Canal.jpg", "Bridge .jpg") still match the cell.
// NFC: macOS can hand back accented names (Bogotá) in a decomposed form that looks identical but differs.
const imageKey = (name) => name.normalize('NFC').toLowerCase().replace(/\s+(\.[^.]+)$/, '$1').trim();
const imagesByPath = new Map(imageFiles.map((p) => [imageKey(p), p]));
const imagesByName = new Map(); // bare file name -> every path with that name
for (const p of imageFiles) {
  const k = imageKey(fileName(p));
  imagesByName.set(k, [...(imagesByName.get(k) ?? []), p]);
}

// Resolves an Image cell to a photo path, or explains why it can't.
function resolveImage(cell, continent) {
  if (cell.includes('/')) return { path: imagesByPath.get(imageKey(cell)) };
  const found = imagesByName.get(imageKey(cell)) ?? [];
  if (found.length <= 1) return { path: found[0] };
  // Same name in several folders: prefer the project's own continent folder.
  const own = found.filter((p) => (folderOf(p) ?? '').toLowerCase() === continent.toLowerCase());
  if (own.length === 1) return { path: own[0] };
  return { ambiguous: found };
}

const features = [];
const seenSlugs = new Set();
const seenNames = new Set();

data.forEach((row, i) => {
  const line = i + 2; // spreadsheet row number (row 1 is the header)
  const get = (col) => (row[col] ?? '').trim();
  const name = get('Name');
  const lat = parseFloat(get('Latitude'));
  const lng = parseFloat(get('Longitude'));

  if (!name) return warn(`row ${line}: no Name; skipped`);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return warn(`row ${line} (${name}): missing or invalid Latitude/Longitude; skipped`);
  }

  let slug = get('Slug').toLowerCase();
  if (!slug) slug = name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (seenSlugs.has(slug)) warn(`row ${line} (${name}): Slug "${slug}" is used more than once`);
  if (seenNames.has(name.toLowerCase())) warn(`row ${line}: "${name}" appears more than once; is it a duplicate?`);
  seenSlugs.add(slug);
  seenNames.add(name.toLowerCase());

  let image = get('Image') || null;
  if (image && !/^https?:\/\//i.test(image)) {
    const { path, ambiguous } = resolveImage(image, get('Continent'));
    if (ambiguous) warn(`row ${line} (${name}): "${image}" exists in several folders (${ambiguous.join(', ')}); write the folder in the Image column, e.g. "${ambiguous[0]}"`);
    else if (!path) warn(`row ${line} (${name}): Image "${image}" isn't in public/images/projects/`);
    image = path ?? null;
  }

  const statusCell = get('Status');
  const status = STATUSES[statusCell.toLowerCase()] ?? null;
  if (statusCell && !status) warn(`row ${line} (${name}): Status "${statusCell}" isn't In Progress, Completed, or Abandoned; no status tag shown`);

  const cost = parseFloat(get('Cost (USD)').replace(/[$,\s]/g, ''));

  features.push({
    type: 'Feature',
    id: features.length,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      name,
      slug,
      type: get('Project Type') || 'Project',
      status,
      country: get('Country'),
      continent: get('Continent'),
      cost: Number.isFinite(cost) ? cost : null,
      description: get('Description').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean),
      image,
      link: get('Link') || null,
    },
  });
});

// Photos nobody's Image column claims are matched by file name. Every project is a candidate so
// the match is honest, but only projects with a blank Image get the photo.
const claimed = new Set(features.map((f) => f.properties.image).filter(Boolean));
const unclaimed = imageFiles.filter((file) => !claimed.has(file));
const { matches, warnings } = matchImages(
  unclaimed,
  features.map((f) => ({ feature: f, name: f.properties.name, slugs: [f.properties.slug] })),
);
for (const [project, file] of matches) {
  const props = project.feature.properties;
  if (props.image) {
    const ref = imagesByName.get(imageKey(fileName(file))).length > 1 ? file : fileName(file); // add the folder if the name repeats
    warn(`image: ${file} looks like ${project.name}, which already has a photo; to use this one instead, put "${ref}" in its Image column`);
    continue;
  }
  props.image = file;
  console.log(`  image: ${file} → ${project.name} (auto-matched; put the file name in its Image column to lock it in)`);
}
for (const w of warnings) warn(`image: ${w}`);

// Flag photos filed under a different continent's folder than their project.
// ":" is how macOS stores a "/" typed in Finder; Windows can't check such files out.
for (const p of imageFiles) if (/[:\\*?"<>|]/.test(fileName(p))) warn(`image: "${p}" has a character Windows doesn't allow in file names (often a "/" typed in Finder); rename it`);

for (const f of features) {
  const img = f.properties.image;
  const folder = img && !/^https?:\/\//i.test(img) && folderOf(img);
  if (folder && f.properties.continent && folder.toLowerCase() !== f.properties.continent.toLowerCase()) {
    warn(`image: ${f.properties.image} is in the "${folder}" folder, but ${f.properties.name} is in ${f.properties.continent}`);
  }
}

// Local photos become site-relative paths; main.js prefixes the deploy base path.
for (const f of features) {
  const img = f.properties.image;
  if (img && !/^https?:\/\//i.test(img)) f.properties.image = `images/projects/${img.split('/').map(encodePathSegment).join('/')}`;
}

// Routes: one file per project, named after its slug.
const bySlug = new Map(features.map((f) => [f.properties.slug, f]));
const routes = [];
for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.geojson'))) {
  const slug = file.replace(/\.geojson$/, '');
  const project = bySlug.get(slug);
  if (!project) {
    warn(`route: data/routes/${file} doesn't match any project slug`);
    continue;
  }
  const json = JSON.parse(readFileSync(new URL(file, ROUTES_DIR), 'utf8'));
  const parts = json.type === 'FeatureCollection' ? json.features : [json.type === 'Feature' ? json : { type: 'Feature', geometry: json }];
  for (const part of parts) {
    if (!/LineString$/.test(part.geometry?.type ?? '')) {
      warn(`route: data/routes/${file} has a ${part.geometry?.type} instead of a line; skipped`);
      continue;
    }
    routes.push({ type: 'Feature', id: routes.length, geometry: part.geometry, properties: { slug, projectId: project.id } });
  }
  project.properties.hasRoute = true;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(new URL('projects.geojson', OUT_DIR), JSON.stringify({ type: 'FeatureCollection', features }));
writeFileSync(new URL('routes.geojson', OUT_DIR), JSON.stringify({ type: 'FeatureCollection', features: routes }));
const withImages = features.filter((f) => f.properties.image).length;
console.log(`projects.geojson: ${features.length} projects, ${withImages} with images, ${new Set(routes.map((r) => r.properties.slug)).size} with routes`);
