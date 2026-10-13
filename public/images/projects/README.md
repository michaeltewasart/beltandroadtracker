# Project images

Photos for the project details panel, sorted into one folder per continent:

```
Africa/  Asia/  Europe/  Middle East/  North America/  Oceania/  South America/
```

Put each photo in the folder matching the project's `Continent` column in `data/projects.csv`. If a photo ends up in another continent's folder, you'll see a warning naming it. Photos left loose in this main folder still work.

There are two ways to give a project a photo:

1. **Put the file name in the project's `Image` column**, e.g. `Salar_de_Atacama.jpg`. You don't need to type the folder; the site looks in all of them. This always wins, so use it for names the auto-matcher can't work out (like `IMG_4821.jpg`). If two folders contain the same file name, the copy in the project's own continent folder is used; otherwise write the folder too, e.g. `South America/Salar_de_Atacama.jpg`.
2. **Just drop the file into a folder.** Photos that no `Image` cell mentions are matched by name to projects whose `Image` is blank, ignoring capitals, accents, dashes and spaces, word order, small typos, and extras like "copy" or "final". When the site starts you'll see each auto-match, or a warning if the name is too vague or the project already has a photo.

The `Image` column can also hold a full image URL (e.g. the Webflow CDN images).

- **Formats:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`
- **Size:** landscape, about 1200 px wide, under ~300 KB. The panel shows images wide and short (16:7).
- **New photos show up** the next time the site starts or builds. If it's already running, run `npm run data` and refresh the page.
