// Converts the project list (data/projects.csv) into the GeoJSON file the map loads.
// Run with `npm run data` (also runs automatically before `dev` and `build`).
//
// data/projects.csv is the single source of truth. Columns:
//   Name, Slug, Project Type, Status, Country, Continent, Latitude, Longitude, Cost (USD), Image, Link, Description
// - Slug: unique ID for the project (lowercase-with-dashes).
// - Status: In Progress, Completed, or Abandoned (shown as a coloured tag; blank shows no tag).
// - Image: a file name in public/images/projects/, a full image URL, or blank. Blank rows are
//   auto-matched by name to photos in the folder that no row claims (see match-images.mjs).
// - Description: plain text; separate paragraphs with a blank line.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import Papa from 'papaparse';
import { matchImages } from './match-images.mjs';

const SRC = new URL('../data/projects.csv', import.meta.url);
const OUT_DIR = new URL('../public/data/', import.meta.url);
const IMAGES_DIR = new URL('../public/images/projects/', import.meta.url);
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif)$/i;

// Like encodeURIComponent, but leaves characters that are legal in a URL path (& + , ; = $ @)
// as-is: some static servers, including Vite's dev server, don't decode e.g. %26 back to "&".
const encodePathSegment = (name) =>
  encodeURIComponent(name).replace(/%(26|2B|2C|3B|3D|24|40)/g, (m) => decodeURIComponent(m));

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

const imageFiles = readdirSync(IMAGES_DIR).filter((file) => IMAGE_EXTENSIONS.test(file));
// Keyed loosely so stray spaces in a file name (" Canal.jpg", "Bridge .jpg") still match the cell.
const imageKey = (name) => name.toLowerCase().replace(/\s+(\.[^.]+)$/, '$1').trim();
const imageFilesByKey = new Map(imageFiles.map((file) => [imageKey(file), file]));

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
    const file = imageFilesByKey.get(imageKey(image));
    if (file) image = file;
    else {
      warn(`row ${line} (${name}): Image "${image}" isn't in public/images/projects/`);
      image = null;
    }
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

// Photos nobody's Image column claims get matched by file name to rows with a blank Image.
const claimed = new Set(features.map((f) => f.properties.image).filter(Boolean));
const unclaimed = imageFiles.filter((file) => !claimed.has(file));
const needImage = features.filter((f) => !f.properties.image);
const { matches, warnings } = matchImages(
  unclaimed,
  needImage.map((f) => ({ feature: f, name: f.properties.name, slugs: [f.properties.slug] })),
);
for (const [project, file] of matches) {
  project.feature.properties.image = file;
  console.log(`  image: ${file} → ${project.name} (auto-matched; put the file name in its Image column to lock it in)`);
}
for (const w of warnings) warn(`image: ${w}`);

// Local photos become site-relative paths; main.js prefixes the deploy base path.
for (const f of features) {
  const img = f.properties.image;
  if (img && !/^https?:\/\//i.test(img)) f.properties.image = `images/projects/${encodePathSegment(img)}`;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(new URL('projects.geojson', OUT_DIR), JSON.stringify({ type: 'FeatureCollection', features }));
const withImages = features.filter((f) => f.properties.image).length;
console.log(`projects.geojson: ${features.length} projects, ${withImages} with images`);
