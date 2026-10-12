# Project images

Photos for the project details panel. There are two ways to give a project a photo:

1. **Put the file name in the project's `Image` column** in `data/projects.csv`, e.g. `Salar_de_Atacama.jpg`. This always wins, so use it for any name the auto-matcher can't work out (like `IMG_4821.jpg`).
2. **Just drop the file here.** Photos that no `Image` cell mentions are matched by name to projects whose `Image` is blank, ignoring capitals, accents, dashes and spaces, word order, small typos, and extras like "copy" or "final". When the site starts you'll see each auto-match, or a warning listing the closest projects if the name is too vague.

The `Image` column can also hold a full image URL (e.g. the Webflow CDN images).

- **Formats:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`
- **Size:** landscape, about 1200 px wide, under ~300 KB. The panel shows images wide and short (16:7).
- **New photos show up** the next time the site starts or builds. If it's already running, run `npm run data` and refresh the page.
