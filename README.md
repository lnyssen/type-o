# GenType

Open-source **generative typography**: take a professionally drawn variable typeface, run its outlines through a stack of destructive operators — fracture, swell, stencil, halftone, melt — and export the result as a real `.ttf`, `.otf`, `.woff` or `.woff2`, with its metrics, its kerning and its accents intact.

Press **Roll** and you get a typeface nobody has. Every curve in it descends from one a type designer drew.

## Why

A parametric engine that draws letters from scratch hits a quality ceiling you can see immediately next to a real typeface — GenType had one, and it is still in `shared/engine/` (tagged `skeleton-engine`) as a record of that. Instancing a variable font instead gives you flawless letters, but nothing surprising: move a slider called Weight and you get the same face, bolder.

So the master is the *material*, not the product. The letterforms, the spacing and the kerning come from someone who did the work; the operators then cut, inflate, perforate and melt that geometry into something else. The quality floor is a professional drawing, the ceiling is whatever the chain does — and because the chain runs in the browser on the real outlines, **the polygons on screen are the ones packed into the file**.

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
   variable master          operator chain (browser)        your font
   ┌─────────────┐   ┌───────────────────────────────┐  ┌──────────────┐
   │ Inter       │   │ Swell  +38‰                   │  │ polygons     │
   │ [opsz,wght] │ ─►│ Fracture 7 bands, 160‰, 32°   │─►│ + metrics    │─► .ttf/.otf/.woff/.woff2
   │ instanced,  │   │ Melt   190‰                   │  │ + kerning    │
   │ overlaps    │   │          seed 4242            │  │ + accents    │
   │ removed     │   └───────────────────────────────┘  └──────────────┘
   └─────────────┘            ↑ what you see is what is packed
```

1. **Outlines** — the server instances the master at your axes with `fontTools.varLib.instancer`, removes overlaps with skia-pathops, and flattens every glyph to polygons fine enough that the facets are invisible (1.2‰ of the em). It also extracts the GPOS kerning. One call per family + axes, then the browser has everything.
2. **Operators** — the chain runs in the client on those polygons. Unions, differences and offsets go through Clipper; distortions are a warp of every point. Each operator is a pure function of the geometry, its settings and the seed, so the same roll always gives the same letters.
3. **Per-mille, not units** — every distance setting is in thousandths of an em, so a chain looks identical on a 1000-upm master and on Inter's 2048.
4. **Export** — the polygons go to the server as they are. `build_font.py` draws them with a `TTGlyphPen`, writes the metrics, the character map, the names and the style bits, compiles the kerning as a real GPOS `kern` feature, and runs one `removeOverlaps` pass — which also fixes the winding, since Clipper orients holes the other way from TrueType.
5. **An empty chain** short-circuits all of that: the master is instanced directly, keeping its curves, its full character set and its own kerning (`instance_font.py`, with oblique and tracking).
6. **Formats** — TrueType as built; OTF re-draws the outlines as cubics for CFF; WOFF and WOFF2 are the same font in a web wrapper.

### The operators

| | Operator | What it does |
|---|---|---|
| mass | **Swell** | Inflates the letter until the counters close, or starves it to a thread. |
| cut | **Fracture** | Slices it into bands and slides each one sideways. |
| cut | **Shatter** | Breaks it on a grid and nudges every shard off its place. |
| cut | **Stencil** | Cuts stripes out of it; wide gaps break it into fragments. |
| cut | **Invert** | Knocks the letter out of a solid block instead of drawing it. |
| cut | **Halftone** | Rebuilds it from a grid of dots, squares or diamonds. |
| surface | **Ring** | Keeps only the rim: an outline or an inline face. |
| surface | **Echo** | Repeats it in one direction — extrusion, shadow or smear. |
| finish | **Jitter** | Pushes every point through a noise field. |
| finish | **Melt** | Lets it sag: the closer to the baseline, the further it drips. |

Order is the point. Ring after Halftone draws hollow dots; Halftone after Ring samples a rim. Swell before a cut sets the mass; Swell after one welds the cut shut.

### Rolling

**Roll** picks two to four operators, orders them by stage, and samples each setting from the range where it actually says something. Then it checks the result: `legibility()` measures how much of the original ink is still where the eye expects it, minus the ink that ended up everywhere else. Chains below the threshold are re-rolled, so a roll gives you something strange but still readable — which is the whole brief for a display face. Press **Seed +** to keep the chain and reshuffle its accidents.

## The interface

- **Lab** — `01 Source` (the family and its axes), `02 Chain` (the operator stack: reorder it, mute a step, open one to tune it), `03 Chance` (roll, reseed, and a legibility meter). The stage draws your word live from the real outlines, or the whole alphabet.
- **Export** — name it, pick a format, download it, or load the compiled file straight into the page. You can also save a **specimen sheet** as SVG, or an **animation** as WebM: every setting that has an "off" value ramps from there to yours, so the clip plays the chain coming on. The licence card links to the master's `OFL.txt`, and the recipe panel shows the exact chain and seed.

Projects autosave to the browser and save as `.gentype` files — family, axes, chain, seed and all, so a font can be rebuilt exactly. `Cmd/Ctrl+S` saves, `Cmd/Ctrl+O` opens, `Cmd/Ctrl+E` jumps to Export. Files from before the operators (v2) still open; they just arrive with an empty chain.

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

## Deploying

The live build runs on Vercel: the interface, the preview fonts, the licences
and the character sets are static; `/api/outlines`, `/api/build-font` and
`/api/export-font` are Python functions sharing `api/_shared.py` and the same
`server/python/` code the local server runs.

```bash
npm run setup:masters   # the deployment carries the masters; it will not build without them
vercel deploy --prod
```

`.vercelignore` replaces `.gitignore` for the upload, which is how the 18 MB of
variable masters reach the function — they are not in git. If you deploy from a
Git integration instead of the CLI, commit them first (`git add -f
server/masters`), otherwise the build stops with a list of what is missing.

`api/export-font.py` is the serverless twin of `server/index.js`: it validates
the project, picks the master and calls the same `instance_font.py`. It cannot
import `shared/catalog.js`, so `node scripts/build-catalog-json.mjs` writes the
fields it needs into the committed `api/_catalog.json` — and `npm test` fails if
that file drifts, or if the two implementations stop naming and refusing
projects identically.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Python toolchain status, formats, missing masters. |
| `GET /api/families` | Genres, families with their axes, and the look presets (local only). |
| `GET /masters/:id/:file` | Preview WOFF2, `charset.json` and `OFL.txt` for a family. |
| `POST /api/outlines` | `{ family, axes, chars }` → real outlines as polygons, metrics and kerning. |
| `POST /api/build-font` | The polygons the browser produced → the font binary. |
| `POST /api/export-font` | `{ project, format }` → a plain instance of the master, no operators. |

`project` is the contents of a `.gentype` file; it is validated and clamped on the way in.

```bash
curl -X POST localhost:5188/api/export-font \
  -H 'content-type: application/json' \
  -d '{"project":{"name":"Rafale Display","family":"inter","axes":{"wght":620,"opsz":20},"oblique":8,"tracking":-20},"format":"woff2"}' \
  -o RafaleDisplay.woff2
```

## Layout

```
shared/ops/clip.js      polygon algebra: union, difference, offset, warp (Clipper)
shared/ops/operators.js the ten operators, their settings and their stages
shared/ops/chain.js     running a chain, rolling one, measuring legibility
shared/ops/simplify.js  Ramer–Douglas–Peucker, so an export is kilobytes
shared/ops/build.js     outlines + chain → the job the builder packs
shared/ops/render.js    contours → SVG path, and a kerned line of them
shared/catalog.js       families, axes, labels, looks, naming rules
shared/project.js       .gentype v3 — family, axes, chain, seed
client/src/views/lab.js the chain, the stage, the roll
client/src/animate.js   records the chain coming on, as WebM
client/src/outlines.js  one fetch per family + axes, then everything is local
server/index.js         Express API
server/python/          outline_font.py (instance → polygons + kerning)
                        build_font.py   (polygons → font binary)
                        instance_font.py (the no-operator path)
                        preview_font.py  (light Latin WOFF2 previews)
server/masters/<id>/    roman.ttf, italic.ttf, previews, charset.json (downloaded),
                        OFL.txt, METADATA.pb (in git)
api/*.py                the same three endpoints as Vercel Python functions
api/_catalog.json       generated from shared/catalog.js for those functions
scripts/                setup-masters.mjs, build-catalog-json.mjs, build-vercel.mjs,
                        lab-specimen.mjs (roll a sheet of chains and look at it)
test/                   operator invariants, end-to-end builds, Node↔Python parity
```

`scripts/lab-specimen.mjs Rafale` rolls a page of chains and writes it to
`client/public/lab.html`, which `npm run dev` serves at `/lab.html` — the fastest
way to judge a change to the operators by eye.

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

`api/_catalog.json` is current, the Node and Python export paths build the same
payload and refuse the same names, look presets stay inside their axis ranges, `.gentype` files round-trip, malformed projects are coerced rather than crashing, style names follow weight and width, forbidden names are refused — and, when Python and the masters are installed, all four formats compile into loadable fonts with no `fvar` left, the right names and a real italic angle.

## Known limits

- Each export is a static instance; GenType doesn't emit variable fonts.
- Operator outlines are polygons, not curves. At 0.35‰ of the em the facets are far below what any rasteriser shows, but a `.ttf` from a chain has more points than one from a plain instance (tens of kilobytes rather than a few).
- The legibility guard protects a roll, not a chain you build by hand — drag Melt to 400‰ and the letter will leave.
- Latin only — the catalogue's masters cover Latin (many include Greek and Cyrillic, which are kept but not previewed).
- The oblique is a shear, not a redrawn cursive; use a family's true italic when it has one.
- No hinting is generated.
- Exporting needs Python: any Node host that can run it, or Vercel's Python runtime (see **Deploying**). A pure edge runtime will not do.
- An export takes 3–4 s server-side, so the function is configured with a 60 s limit rather than the 10 s default.

## The skeleton engine

GenType started as a from-scratch outline engine: METAFONT-style skeletons, Hobby splines, stroke expansion, optical spacing. It works, and it is still in `shared/engine/` and `shared/glyphs/` (tagged `skeleton-engine`), but stroke-expanded skeletons have a quality ceiling that shows immediately next to a professionally drawn face — which is why the tool now builds on real masters.

## License

Code: MIT. Fonts you export: SIL Open Font License 1.1 — see **Licensing** above.
