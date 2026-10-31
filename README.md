# mihirrao-10.github.io

Framework-free personal homepage. GitHub Pages serves the repository root of
`main` directly; commit generated browser assets along with their sources.
The two research projects deploy from their own sibling repositories.

## Layout

| Path | Purpose |
|---|---|
| `index.html` | All homepage content, native links, and generated Notes. |
| `assets/css/black-geometry.css` | Styles and local font declarations. |
| `assets/fonts/` | Original STIX Two Text subsets, provenance, and OFL license. |
| `src/black-geometry/` | Runtime and sculpture source. |
| `tools/black-geometry/` | Asset build and verification. |
| `assets/black-geometry/generated/` | Committed JavaScript, posters, licenses, and hashed stylesheet. |
| `assets/black-geometry/project-data/` | Prepared research geometry/data and license. |
| `notes/` | Published PDFs; sources live in `../../learning/course-notes/`. |
| `tests/black-geometry/` | Node tests and targeted Playwright browser specs. |
| [docs/black-geometry/provenance.md](docs/black-geometry/provenance.md) | Sculpture equations, references, data origins, and authorship. |
| `dist/` | Ignored production copy. |

## Development

Node ≥20.19 is required. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run check
python3 -m http.server 8000 --bind 127.0.0.1
# Preview the production copy separately:
python3 -m http.server 8001 --bind 127.0.0.1 -d dist
```

`npm run check` runs unit/content tests, builds, verifies deterministic generated
assets, and checks root/dist parity. `npm run build` updates generated assets,
removes stale files only inside the owned generated directory, and updates the
stylesheet and entry-script URLs for returning visitors. Run it after CSS or
runtime edits and include the generated changes in the commit.

Use focused browser specs when interaction or layout changes require them:

```sh
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright npx playwright test -g "page|education"
```

The `npm run test:browser` suite checks page navigation, responsive layout,
sculpture interaction, fallback, and browser history. Browser evidence is ignored
under `.artifacts/`. Chromium and WebKit tests cover simulated gestures; physical
trackpad/Safari/iPhone behavior requires separate hands-on review.

With the local server running, the maintenance tools use the same seven page
entries as the runtime. Set `PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright`
and run `node tools/black-geometry/diagnostics.js` for Chromium frame timings,
`node tools/black-geometry/profile-webkit.js` for WebKit, or
`node tools/black-geometry/review.js` for desktop/mobile screenshots.
`BG_BASE_URL` overrides the local server URL. Reports stay under `.artifacts/`.

## Content and notes

Education, Experience, and Projects derive from the résumé. Deliberate edits to
those sections require updating `tests/black-geometry/fixtures/content-baseline.json`
in the same commit. Notes are checked structurally instead.

Never edit PDFs or the Notes block between `<!-- notes:begin ... -->` and
`<!-- notes:end -->` by hand. Follow the installed `/publish-notes` skill for the notes workflow.
After approval to publish into the website working tree, run `make publish` in
[the notes workspace](../../learning/course-notes/) to build, copy changed PDFs,
regenerate the block from status metadata, and check consistency. Commits and
pushes require their own separate approvals.

## Runtime constraints

The original STIX Two Text v18 variable WOFF2 files are served locally. The
normal Latin subset is preloaded; other Unicode subsets and italic styles load
only when needed. `assets/fonts/sources.json` records their original URLs and
SHA-256 hashes, and `assets/fonts/OFL.txt` retains the license. No external font
service is needed to display the page.

The STIX Two Text page starts the animation automatically on supported devices.
If graphics fail, static SVGs retain the content and native links. Print uses
dark text on white.

One WebGL context renders seven grayscale subjects: a globular star cluster,
colliding galaxies, the Milky Way, a nebula, a black hole, a quasar, and a solar
system. Each page load shuffles a one-to-one assignment across the seven pages;
the assignment stays fixed during navigation and browser history within that
visit. Fallback posters follow the same assignment. The quasar has a tilted
accretion disk and animated bipolar jets. The eight-planet solar system starts
at an oblique angle, with distinct planet sizes, Saturn's rings, and an asteroid
belt. Its sizes, distances, and periods are illustrative.

The nebula is a loose cloud of 238,000 fine dust grains, curling filaments,
and faint haze particles. Grains swirl around local knots and drift on
independent phases; the cloud continuously changes internally while remaining
freely rotatable. Its spread and grain echo the introductory star cluster.
Stars occupy three dimensions. The solar system has eight independently
orbiting planets, thin orbital paths, and one ringed planet.
All scenes share unrestricted mouse and touch rotation, with bounds that retain
the entire object. The black hole uses an approximate bent-ray accretion model.
Geometry stays resident while animation updates transforms and uniforms.

Only the Moon and Sun image fields are loaded, for solar-system surface detail.
Their browser downloads use lossless WebP with raw compressed fields as a
fallback; both paths reconstruct the same grayscale samples. After changing an
active raw field, run `python3 tools/black-geometry/prepare-map-images.py` before
building to regenerate its image derivative and content hash. Pillow is an
authoring dependency, not a website build dependency.
Other NASA/Hubble derivatives and earlier scene factories remain as archived
references. Credits are in `assets/black-geometry/textures/CREDITS.txt`.

Static posters embed 1600 × 1200 deterministic software-rendered PNGs in SVG
wrappers, using the same geometry, surface fields, and black-hole ray model.
Their shading approximates the live rendering. Each visit has its own orbit and
drag state; reversal preserves a still-visible identity's state.

An initial beige loading screen shows black text with three dots that bounce in
sequence. It fades away after fonts, surface maps, procedural scenes, shaders,
uploaded GPU buffers, warm-up draws, a GPU fence, and the first live frame are
ready. The graphics chunk is preloaded with the document, and graphics/font
preparation runs concurrently. All seven scenes warm their complete geometry
and shaders in a small hidden buffer before the normal display resolution is
restored for the final frame and GPU fence. Reduced-motion preferences disable
the loader animation and fade, while
the sculpture still starts automatically. Failed graphics or a 30-second loading
deadline reveal the static site;
JavaScript-disabled visits skip the loader. A three-megapixel budget
retains fine detail. Resolution adapts separately for each scene, so slow frames
on the black-hole page do not soften subsequent scenes; geometry detail stays fixed. Runtime and poster URLs carry content hashes so returning visitors receive the
current visuals.

The beige homepage has seven links and no secondary navigation:
About, Education, Industry experience, Publications, Teaching, Projects, and
Personal notes. Education and industry show locations; Notes shows each book
with its author. Its generated source block stays intact.
Native hash links, old section aliases, reload, and browser history select the
corresponding text and sculpture without document scrolling. Tabs and left/right
arrow keys move between pages and start each destination at the top. The small
arrow-key hint stays visible through tab clicks and disappears after the first
keyboard page change until the next reload. Swipes do not change pages. If enlarged text
exceeds the available height, overflow stays within the selected panel.
Mouse, pen, and single-finger drags rotate the artwork freely in every direction
with inertia; pinch zoom remains available. Focused arrow keys rotate; Home resets.
Artwork and fallback posters are strictly grayscale; the beige page and neutral text remain.

For local diagnostics, append `?bg-debug`. The read-only
`window.__blackGeometry.snapshot()` reports scene, frame, draw, material, quality,
and interaction state without changing display settings.
