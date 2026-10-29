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

One WebGL context renders seven astronomical subjects: a black hole (About),
Earth and Moon (Education), Saturn (Industry experience), the Sun (Publications),
the solar system (Teaching), a spiral galaxy (Projects), and a globular cluster
(Personal notes). Indexed planet meshes, layered atmospheres, ring grains,
coronal filaments, and dense star fields stay resident on the GPU. Shaders add
fine triangular meshes, surface texture, ring gaps, granulation, and slow flow.
Planetary surfaces write depth so rings and moons have coherent occlusion.

The black hole integrates bent viewing rays through a turbulent accretion disk.
It is an authored approximation, not a Kerr geodesic solver. Earth and lunar
surfaces use NASA grayscale maps in `assets/black-geometry/textures/`, with credits
beside them. Surface files have content-addressed names and compressed equivalents;
the runtime shares two textures across all scenes. Older factories remain tested
in source, outside the active homepage build.

Static posters embed deterministic software-rendered PNGs in SVG wrappers, using
the same geometry and surface maps. The black-hole poster traces adaptive rays
through the same disk boundaries. The fallback stays small and detailed without
shipping millions of SVG triangle paths. Each visit has its own orbit and drag
state; reversal preserves a still-visible identity's state.

Text, navigation, and a static poster appear immediately. Live artwork waits for
fonts, surface maps, procedural scenes, shaders, uploaded GPU buffers, warm-up draws, and a GPU
fence. Graphics preparation never blocks navigation. Resolution adapts to sustained
frame cost; geometry detail stays fixed. Runtime and poster URLs carry content hashes so returning visitors receive the
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
