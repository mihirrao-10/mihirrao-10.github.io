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

One WebGL context renders seven grayscale scenes: a fictional planet and moon
(About), an uneven giant star (Education), a black hole (Industry experience),
a neutron star (Publications), the Milky Way (Teaching assistant), two colliding
galaxies (Projects), and a globular star cluster (Personal notes). Detailed
surface fields, volumetric particles, and bent-ray integration suit each subject;
there are no visible wireframes or tessellated surface treatments. A shared
presentation factor enlarges the previous grayscale artwork by about 8%, while
keeping space around it.

The invented planet has authored terrain and clouds; its orbiting moon uses the
retained NASA lunar map and a wider orbit. The giant star combines a slightly
uneven surface, SDO-derived activity, and fine evolving convection. Its dark
center fades toward a pale limb, without an outer haze or particle corona. The black
hole traces deflected rays through a turbulent disk, producing a dark circular
shadow, a lighter foreground band, and a lensed arch. This is an illustrative
ray model, not a relativistic solver.

The neutron star has a compact core, curved dipole fields, and two narrow polar
beams that sweep with its tilted magnetic axis. The galaxy scenes contain stars distributed in three dimensions,
with individual orbital motion and slowly changing views. The colliding pair has
two tilted disks, a stellar bridge, and tidal tails. The final scene is a globular
cluster of stars with a dense core and an extended halo. The stars, cloud fields,
orbital rates, and interaction are authored, not observational reconstructions
or gravitational simulations. Darkness represents luminous density on the beige
page. Geometry stays resident; motion uses uniforms and object transforms.

Only the Moon and Sun image fields are loaded by the current page. Other NASA
and Hubble derivatives, together with earlier scene implementations, remain as
archived references. Credits and preparation details are in
`assets/black-geometry/textures/CREDITS.txt`. The two user-supplied inspiration
images guide composition only and are not redistributed.

Static posters embed 1600 × 1200 deterministic software-rendered PNGs in SVG
wrappers, using the same geometry, surface fields, and black-hole ray model.
Their shading approximates the live rendering. Each visit has its own orbit and
drag state; reversal preserves a still-visible identity's state.

An initial beige loading screen shows black text with three dots that bounce in
sequence. It fades away after fonts, surface maps, procedural scenes, shaders,
uploaded GPU buffers, warm-up draws, a GPU fence, and the first live frame are
ready. Reduced-motion visitors get still dots and the static poster without a
fade. Failed graphics or a 30-second loading deadline reveal the static site;
JavaScript-disabled visits skip the loader. A three-megapixel budget
retains fine detail. Resolution adapts separately for each scene, so slow frames
on the black-hole page do not soften subsequent scenes; geometry detail stays fixed. Runtime and poster URLs carry content hashes so returning visitors receive the
current visuals.

The beige homepage has seven links and no secondary navigation:
About, Education, Industry experience, Publications, Teaching assistant, Projects, and
Personal notes. Education and industry show locations; Notes shows each book
with its author. Its generated source block stays intact.
Native hash links, old section aliases, reload, and browser history select the
corresponding text and sculpture without document scrolling. If enlarged text
exceeds the available height, overflow stays within the selected panel.
Mouse/pen dragging rotates the artwork with inertia; horizontal touch dragging
and pinch zoom remain available. Focused arrow keys rotate; Home resets.
Artwork and fallback posters are strictly grayscale; the beige page and neutral text remain.

For local diagnostics, append `?bg-debug`. The read-only
`window.__blackGeometry.snapshot()` reports scene, frame, draw, material, quality,
and interaction state without changing display settings.
