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
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright npx playwright test -g "notes"
```

The full `npm run test:browser` suite is slow. Browser evidence is ignored under
`.artifacts/`. Chromium and WebKit tests cover simulated gestures; physical
trackpad/Safari/iPhone behavior requires separate hands-on review.

## Content and notes

Education, Experience, and Projects derive from the résumé. Deliberate edits to
those sections require updating `tests/black-geometry/fixtures/content-baseline.json`
in the same commit. Notes are checked structurally instead.

Never edit PDFs or the Notes block between `<!-- notes:begin ... -->` and
`<!-- notes:end -->` by hand. Run `make publish` in
[the notes workspace](../../learning/course-notes/README.md) to build, copy changed
PDFs, regenerate the block from status metadata, and check consistency.

## Runtime constraints

The STIX Two Text page stays readable with static SVGs when graphics fail or
reduced motion is requested. Visitors can enable animation or retry; rendering
failures retain content and native links. Print uses dark text on white.

One WebGL context renders eight prepared sculptures: the quintic slice, phoenix,
dragon, membrane, Resolution flag, heat-method surface, congestion potential,
and twisted figure-eight Klein immersion. All targets are prepared at build time;
scientific geometry and paths come from the research exports. The homepage runs
no numerical solver. The same geometry produces the static posters.

A shared depth prepass, per-sculpture materials, and a two-surface dissolve preserve
readable geometry through transitions. Notes use a faint hidden-contour pass to
expose folded lobes. Prepared targets stay resident. Each visit has its own orbit
start and drag state; reversal preserves a still-visible identity's state.

The loader waits for fonts, all decoded sculptures, shaders, uploaded GPU buffers,
warm-up draws, and a GPU fence. There is no timeout or input-driven dismissal.
Resolution adapts to sustained frame cost by dropping glow and then render scale;
geometry detail stays fixed.

Navigation uses native mandatory CSS snapping, with no JavaScript wheel
cancellation or momentum classifier. Tall entries remain readable within their
snap area. Mouse/pen dragging rotates in screen coordinates with inertia; horizontal
touch dragging preserves vertical scrolling and pinch zoom. Focused arrow keys
rotate; Home resets. Rendering and transition completion remain independent of
scroll input. History restoration preserves the URL and saved reading position
while allowing user input to cancel a pending correction.

For local diagnostics, append `?bg-debug`. The read-only
`window.__blackGeometry.snapshot()` reports scene, frame, draw, material, quality,
and interaction state without changing display settings.
