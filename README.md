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

One WebGL context renders seven tessellated astronomical sculptures: Earth and
Moon (About), Jupiter (Education), the Sun (Industry experience), a neutron star
(Publications), a black hole (Teaching), the Milky Way (Projects), and a galaxy
cluster (Personal notes). Every visible surface uses the same triangle-edge
shader, flat facet samples, translucent faces, and restrained color gradients.
Edges follow the actual triangles using barycentric coordinates, with an
antialiased width in screen pixels. There are no photographic display planes
or point-cloud substitutes for the sculptures.

Earth, Moon, Jupiter, and the Sun sample the existing NASA maps once per triangle.
The continents, lunar terrain, cloud bands, and active regions become geometric
mosaics. Earth and Moon have smaller radii and a wider orbit that keeps a visible
gap in the default view. Jupiter occupies less of the art panel. Solar loops,
magnetic ribbons, and polar beams use the same triangular material as the globes.

The black hole combines a dark faceted shadow, a warped accretion disk, and an
arched image of the far disk. Rotation and bounded differential shear animate
the lattice without stretching triangles indefinitely. There is no spacetime
grid. The lensing shape is an authored illustration, not a geodesic solver.
The Milky Way has four thick spiral ribbons, a translucent triangular disk, a
bar, and a central bulge. The cluster contains 112 small triangular elliptical
or spiral galaxies, distributed in depth and independently rotating.

Geometry and facet values are prepared once and remain resident. Motion uses
uniforms and object transforms. The black-hole shadow writes depth for coherent
occlusion; other surfaces retain a faint view of their rear faces. Presentation
sizes and rates are chosen for legibility, not physical scale or ephemerides.
Credits and map preparation details are in
`assets/black-geometry/textures/CREDITS.txt`. The former smooth-surface materials,
ray-integrated accretion renderer, and spacetime grid remain in source outside
the active homepage build. Archived texture fields are not fetched by the page.

Static posters embed 1600 × 1200 deterministic software-rendered PNGs in SVG
wrappers. They use the same triangles, sampled facet colors, edge widths, and
translucency. Each visit has its own orbit and drag state; reversal preserves a
still-visible identity's state.

Text, navigation, and a static poster appear immediately. Live artwork waits for
fonts, surface maps, procedural scenes, shaders, uploaded GPU buffers, warm-up draws, and a GPU
fence. Graphics preparation never blocks navigation. A three-megapixel budget
retains fine detail. Resolution adapts separately for each scene, so slow frames
on the black-hole page do not soften subsequent scenes; geometry detail stays fixed. Runtime and poster URLs carry content hashes so returning visitors receive the
current visuals.

The beige homepage has seven links and no secondary navigation:
About, Education, Industry experience, Publications, Teaching, Projects, and
Personal notes. Education and industry show locations; Notes shows each book
with its author and edition. Its generated source block stays intact.
Native hash links, old section aliases, reload, and browser history select the
corresponding text and sculpture without document scrolling. If enlarged text
exceeds the available height, overflow stays within the selected panel.
Mouse/pen dragging rotates the artwork with inertia; horizontal touch dragging
and pinch zoom remain available. Focused arrow keys rotate; Home resets.
Artwork and fallback posters share muted mineral palettes; text stays neutral.

For local diagnostics, append `?bg-debug`. The read-only
`window.__blackGeometry.snapshot()` reports scene, frame, draw, material, quality,
and interaction state without changing display settings.
