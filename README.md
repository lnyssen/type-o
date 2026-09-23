# GenType

Open-source **generative typography**: start from a professionally drawn variable typeface, shape it with its own design axes, then export a real `.ttf`, `.otf`, `.woff` or `.woff2` — a static instance with correct metrics, kerning, ligatures and full Latin coverage, renamed as your own font.

Sixteen families (SIL Open Font License), forty-odd axes, eighteen curated starting points.

## Why

Most parametric type toys stop at "nice preview", and the letters they draw never survive contact with a real text setting. GenType takes the opposite route: the letterforms, the spacing and the kerning come from type designers who did the work, and the tool gives you the design space around them — weight, width, optical size, x-height, stem thickness, softness, cursive-ness — plus an oblique and a tracking of your own. What you see in the browser is the same font file you download.

## Quick start

```bash
npm install
npm run setup          # fontTools in server/.venv + the masters (≈18 MB)
npm run dev            # API on :5188, interface on http://localhost:3000
```

`npm run setup` is `setup:python` then `setup:masters`; run them separately if you prefer. The masters are downloaded from [google/fonts](https://github.com/google/fonts) and are **not** in this repository — only their `OFL.txt` and `METADATA.pb` are.

Production:

```bash
npm run build && npm start   # serves the built interface + API on :5188
```

Requirements: Node 20+, Python 3.9+.

## How it works

```
  variable master              your settings                  your font
  ┌─────────────┐   ┌──────────────────────────┐   ┌────────────────────┐
  │ Inter       │   │ wght 620 · opsz 20        │   │ static instance    │
  │ [opsz,wght] │ ─►│ oblique 8° · tracking −20 │─► │ renamed, restyled  │─► .ttf/.otf/.woff/.woff2
  │ + GPOS/GSUB │   │ name: “Rafale Display”    │   │ kerning kept       │
  └─────────────┘   └──────────────────────────┘   └────────────────────┘
```

1. **Preview** — each master is subsetted to a light Latin WOFF2 (~120 KB) that keeps its variations, so the browser renders your settings live through `font-variation-settings`. Every slider is instant, with the real outlines, the real kerning and the real ligatures.
2. **Instancing** — on export, `fontTools.varLib.instancer` pins every axis and strips `fvar`/`gvar`/`avar`/`STAT`/`MVAR`/`HVAR`. The result is an ordinary static font, not a variable font with defaults.
3. **Oblique** — an outline shear: glyph coordinates, component offsets *and* the GPOS anchors (so accents and marks stay put), plus `post.italicAngle` and the caret slope.
4. **Tracking** — added to the advance widths, like CSS `letter-spacing`, in thousandths of an em.
5. **Naming** — name IDs 1–6/16/17 are rewritten for your family and the style the axes describe (`ExtraCondensed ExtraBold Italic`…), `OS/2` weight/width classes and the italic bits follow; the original copyright and the OFL text stay in the file, as the license requires.
6. **Formats** — TrueType as is; OTF converts the quadratics to cubics (`Qu2CuPen` → `T2CharStringPen` → `FontBuilder.setupCFF`); WOFF and WOFF2 are the same font in a web wrapper.

## The interface

- **Design** — `01 Looks` (eighteen presets, each card drawn in its own typeface), `02 Family` (genre filter, every family set in itself), `03 Shape` (one slider per axis of the chosen family, with a plain-language label), `04 Style` (true italic when the family has one, oblique, tracking). The stage shows a fitted headline you can retype, the alphabet, running text, a size ramp and a weight ramp — or a **type tester** at any size, or the whole **character set**.
- **Export** — name it, pick a format, download it, or load the compiled file straight into the page to check the real thing. The license card spells out what you may do with it and links to the master's `OFL.txt`.

Projects autosave to the browser and save as `.gentype` files. `Cmd/Ctrl+S` saves, `Cmd/Ctrl+O` opens, `Cmd/Ctrl+E` jumps to Export.

## The families

| Genre | Families |
|---|---|
| Grotesk | Roboto Flex (12 axes), Inter, Archivo, Space Grotesk |
| Geometric | Jost |
| Humanist | Source Sans 3 |
| Serif | EB Garamond, Fraunces, Source Serif 4 |
| Didone | Bodoni Moda, Playfair |
| Slab | Bitter |
| Rounded | Nunito |
| Display | Anybody |
| Casual | Recursive |
| Script | Caveat |

Axes are read from each font's `fvar` and labelled in `shared/catalog.js` — weight, width, optical size, grade, stem and hairline thickness, x-height, cap height, ascenders, descenders, counter width, softness, wonk, casual, monospace, cursive, slant.

## Licensing — read this before you ship

Everything GenType exports is a **Modified Version** of an OFL font, so your export is under the [SIL Open Font License 1.1](https://openfontlicense.org) too. In practice:

- Use it anywhere: print, web, apps, logos, commercial work, client jobs.
- Share it, embed it, bundle it with software.
- Don't sell the font file on its own, and keep it under the OFL.
- Don't use the original family name, or a Reserved Font Name — GenType refuses those names at export, and the original copyright and license stay embedded in the file.

The GenType **code** is MIT.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Python toolchain status, formats, missing masters. |
| `GET /api/families` | Genres, families with their axes, and the look presets. |
| `GET /api/families/:id/charset` | The codepoints that family covers. |
| `GET /masters/:id/:file` | Preview WOFF2 and `OFL.txt` for a family. |
| `POST /api/export-font` | `{ project, format }` → the font binary as a download. |

`project` is the contents of a `.gentype` file; it is validated and clamped on the way in.

```bash
curl -X POST localhost:5188/api/export-font \
  -H 'content-type: application/json' \
  -d '{"project":{"name":"Rafale Display","family":"inter","axes":{"wght":620,"opsz":20},"oblique":8,"tracking":-20},"format":"woff2"}' \
  -o RafaleDisplay.woff2
```

## Layout

```
shared/catalog.js      families, axes, labels, looks, naming rules
shared/project.js      .gentype v2, style naming, export payloads
client/                Vite app — design & export views, live FontFace preview
server/index.js        Express API
server/compile.js      runs the Python helpers
server/python/         instance_font.py (instancing, oblique, tracking, renaming)
                       preview_font.py  (light Latin WOFF2 previews)
server/masters/<id>/   roman.ttf, italic.ttf, previews (downloaded), OFL.txt, METADATA.pb
scripts/               setup-masters.mjs
test/                  catalogue & project rules, end-to-end instancing
```

## Adding a family

1. Pick a variable font with an OFL license on [google/fonts](https://github.com/google/fonts).
2. `mkdir server/masters/<ofl-dir-name>` and copy its `METADATA.pb` and `OFL.txt` there.
3. `node scripts/setup-masters.mjs <ofl-dir-name>` — it reads the metadata, downloads the variable files and builds the previews.
4. Add an entry to `FAMILIES` in `shared/catalog.js` with its genre, credit, blurb and axes (min/default/max straight from `fvar`), plus `rfn: [...]` if the license declares Reserved Font Names.
5. `npm test` checks that the catalogue and the files agree.

## Tests

```bash
npm test
```

Look presets stay inside their axis ranges, `.gentype` files round-trip, malformed projects are coerced rather than crashing, style names follow weight and width, forbidden names are refused — and, when Python and the masters are installed, all four formats compile into loadable fonts with no `fvar` left, the right names and a real italic angle.

## Known limits

- Each export is a static instance; GenType doesn't emit variable fonts.
- Latin only — the catalogue's masters cover Latin (many include Greek and Cyrillic, which are kept but not previewed).
- The oblique is a shear, not a redrawn cursive; use a family's true italic when it has one.
- No hinting is generated.
- Deployment needs a Node host that can run Python — a container or a VPS, not a pure serverless edge function.

## The skeleton engine

GenType started as a from-scratch outline engine: METAFONT-style skeletons, Hobby splines, stroke expansion, optical spacing. It works, and it is still in `shared/engine/` and `shared/glyphs/` (tagged `skeleton-engine`), but stroke-expanded skeletons have a quality ceiling that shows immediately next to a professionally drawn face — which is why the tool now builds on real masters.

## License

Code: MIT. Fonts you export: SIL Open Font License 1.1 — see **Licensing** above.
