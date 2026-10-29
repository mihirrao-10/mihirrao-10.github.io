# mihirrao-10.github.io

Framework-free personal homepage. GitHub Pages serves the repository root of
`main` directly; commit generated browser assets along with their sources.
The two research projects deploy from their own sibling repositories.

## Layout

| Path | Purpose |
|---|---|
| `index.html` | All homepage content, native links, and generated Notes. |
| `assets/css/black-geometry.css` | Styles. |
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

The STIX Two Text page stays readable with static SVGs when graphics fail or
reduced motion is requested. Visitors can enable animation or retry; rendering
failures retain content and native links. Print uses dark text on white.

One WebGL context renders seven astronomical subjects: Earth and Moon (About),
Jupiter (Education), the Sun (Industry experience), a neutron star (Publications),
a black hole (Teaching), the Milky Way (Projects), and the Abell 1689 galaxy
cluster (Personal notes). Distances and presentation sizes are compressed for
the page. Dense indexed meshes, layered atmospheres, anchored coronal loops,
magnetic field tubes, and stellar volumes stay resident on the GPU. Surface
rotation, moving plasma, local stellar orbits, and volume rotation animate without
rebuilding geometry. Opaque planetary surfaces write depth for coherent occlusion.

Jupiter uses a 3600 × 1800 grayscale Cassini cloud map with fine belts, storms,
and the Great Red Spot. The Sun combines an SDO active-region field with changing
granulation and anchored loop bundles. The neutron star has 72 tilted magnetic
field tubes and sweeping polar beams. The black hole is an unshaded circular
shadow above a curved, gently moving spacetime grid with a minimal disk. This is
an illustrative embedding, not a general-relativity simulation.

The Milky Way is one authored barred spiral with two dominant arms, fainter arms
and spurs, a thick disk, a central bulge, soft cloud volumes, and 300,000 moving
stellar/cloud points. The cluster contains 112 small, independently oriented
galaxies distributed through a volume, with 136,000 orbiting points. Neither scene
contains a photographic display plane. Darkness represents brightness in the
grayscale artwork. Credits and preparation details are in
`assets/black-geometry/textures/CREDITS.txt`. Five active content-addressed maps
have compressed equivalents; three earlier Saturn/ring/M51 fields and the old
ray-integrated accretion renderer remain as tested references outside the active
homepage build. The optional preparation tools are `prepare-astronomy.py` and
`prepare-jupiter.py` in `tools/black-geometry/`.

Static posters embed 1600 × 1200 deterministic software-rendered PNGs in SVG
wrappers, using the same geometry and surface maps. The fallback stays detailed
without shipping millions of SVG triangle paths. Each visit has its own orbit
and drag state; reversal preserves a still-visible identity's state.

Text, navigation, and a static poster appear immediately. Live artwork waits for
fonts, surface maps, procedural scenes, shaders, uploaded GPU buffers, warm-up draws, and a GPU
fence. Graphics preparation never blocks navigation. A three-megapixel budget
retains fine detail. Resolution adapts separately for each scene, so slow frames
on the black-hole page do not soften subsequent scenes; geometry detail stays fixed. Runtime and poster URLs carry content hashes so returning visitors receive the
current visuals.

The beige, grayscale homepage has seven links and no secondary navigation:
About, Education, Industry experience, Publications, Teaching, Projects, and
Personal notes. Education and industry show locations; Notes shows each book
with its author and edition. Its generated source block stays intact.
Native hash links, old section aliases, reload, and browser history select the
corresponding text and sculpture without document scrolling. If enlarged text
exceeds the available height, overflow stays within the selected panel.
Mouse/pen dragging rotates the artwork with inertia; horizontal touch dragging
and pinch zoom remain available. Focused arrow keys rotate; Home resets.
All artwork, including fallback posters, is presented in grayscale.

For local diagnostics, append `?bg-debug`. The read-only
`window.__blackGeometry.snapshot()` reports scene, frame, draw, material, quality,
and interaction state without changing display settings.
