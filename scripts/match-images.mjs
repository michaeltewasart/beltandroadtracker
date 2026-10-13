// Matches loosely named photos in public/images/projects/ to projects, e.g.
// "Chancay Port (final).JPG" -> port-of-chancay. Used for photos no row's Image column names.

const STOPWORDS = new Set(['of', 'the', 'and', 'de', 'la', 'del', 'el', 'a', 'an', 'in', 'on', 'for', 'to']);
// Words people add to file names that say nothing about the project.
const NOISE = new Set([
  'img', 'image', 'images', 'photo', 'photos', 'pic', 'picture', 'copy', 'final', 'edit', 'edited',
  'new', 'old', 'small', 'large', 'hero', 'thumb', 'thumbnail', 'cover', 'version', 'v', 'jpeg', 'jpg', 'png', 'webp',
]);

const MIN_SCORE = 0.5; // share of words that must line up
const MIN_LEAD = 0.15; // how far ahead of the runner-up the best match must be

export function tokens(text, { dropNoise = false } = {}) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t) && !(dropNoise && (NOISE.has(t) || /^\d{3,}$/.test(t))));
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// Same word, allowing small typos in longer words ("chancey" ~ "chancay").
function wordsMatch(a, b) {
  if (a === b) return true;
  const len = Math.min(a.length, b.length);
  if (len < 4) return false;
  return editDistance(a, b) <= (len >= 8 ? 2 : 1);
}

// Dice similarity on words: 1 = same words, 0 = nothing in common.
function score(fileWords, projectWords) {
  const unused = [...projectWords];
  let shared = 0;
  for (const w of fileWords) {
    const i = unused.findIndex((p) => wordsMatch(w, p));
    if (i !== -1) {
      shared++;
      unused.splice(i, 1);
    }
  }
  return (2 * shared) / (fileWords.length + projectWords.length);
}

/**
 * @param files   image file names in the folder
 * @param projects [{ slugs: string[], name: string }]
 * @param pinned  { "file name": "slug" } overrides
 * @returns { matches: Map<project, file>, warnings: string[] }
 */
export function matchImages(files, projects, pinned = {}) {
  const warnings = [];
  const matches = new Map();
  const bySlug = new Map(projects.flatMap((p) => p.slugs.map((s) => [s.toLowerCase(), p])));
  const candidates = projects.map((p) => ({
    project: p,
    // Score against the display name and each slug; keep whichever fits best.
    wordSets: [tokens(p.name), ...p.slugs.map((s) => tokens(s))],
  }));

  const assign = (project, file, how) => {
    const existing = matches.get(project);
    if (existing) {
      warnings.push(`${file}: ${project.name} already uses ${existing}; skipped (${how})`);
      return;
    }
    matches.set(project, file);
  };

  for (const file of [...files].sort()) {
    const base = file.split('/').pop().replace(/\.[^.]+$/, ''); // ignore the folder

    const pinnedSlug = pinned[file];
    if (pinnedSlug) {
      const project = bySlug.get(pinnedSlug.toLowerCase());
      if (project) assign(project, file, 'pinned');
      else warnings.push(`${file}: pinned to "${pinnedSlug}", but no project has that slug`);
      continue;
    }

    const exact = bySlug.get(base.toLowerCase());
    if (exact) {
      assign(exact, file, 'exact slug');
      continue;
    }

    const fileWords = tokens(base, { dropNoise: true });
    if (!fileWords.length) {
      warnings.push(`${file}: no usable words in the name; put the file name in that project's Image column in data/projects.csv`);
      continue;
    }

    const ranked = candidates
      .map((c) => ({ project: c.project, score: Math.max(...c.wordSets.map((ws) => score(fileWords, ws))) }))
      .sort((a, b) => b.score - a.score);
    const [best, second] = ranked;
    const suggestions = ranked
      .slice(0, 3)
      .filter((r) => r.score > 0)
      .map((r) => `${r.project.slugs[0]} (${Math.round(r.score * 100)}%)`)
      .join(', ');

    if (best.score < MIN_SCORE) {
      warnings.push(`${file}: no confident match${suggestions ? `. Closest: ${suggestions}` : ''}`);
    } else if (second && best.score - second.score < MIN_LEAD) {
      warnings.push(`${file}: ambiguous between ${suggestions}; put the file name in that project's Image column in data/projects.csv`);
    } else {
      assign(best.project, file, 'name match');
    }
  }

  return { matches, warnings };
}
