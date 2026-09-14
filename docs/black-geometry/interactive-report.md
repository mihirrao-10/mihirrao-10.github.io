# Interactive sculpture revision

The homepage now opens with an original gold, orange and violet Fermat-quintic
Calabi–Yau cross-section. UChicago uses a volumetric phoenix in official maroon,
greystone and white. The [Calabi–Yau provenance](calabi-yau.md) records the
equations, projection and topology; the [phoenix provenance](phoenix.md) records
the University's primary references and the original modeling work.

## Motion and interaction

The camera circles continuously at 0.105 radians per second, approximately one
revolution per minute, with varying elevation and gentle roll. Each sculpture
remains centered and fits the stage through arbitrary drag orientations.
Mouse and pen dragging rotate around the viewing axes and pause automatic
orbiting. Release adds a short exponentially decaying continuation. Horizontal
touch gestures rotate; native vertical scrolling and pinch zoom remain enabled.
The focused stage accepts arrow keys, Shift for larger steps, and Home to reset
the drag angle. Arrow keys elsewhere retain their native behavior.

Pointer capture is released on cancellation, chapter changes, hidden pages,
motion changes and disposal. Static, reduced-motion and failed-renderer modes
remove the interaction hint and stage tab stop. No second animation loop or
additional graphics context is created.

## Material and transitions

Lower face alpha, view-dependent highlights, luminous facet edges and a small
halo make the geometry lighter and shinier. Low quality omits the CSS halo while
retaining the material. Alpha blending remains an artistic approximation:
depth writes preserve route occlusion and legible folds, so intersecting sheets
do not simulate physically ordered glass transparency.

Two cubic Bézier segments meet on the shared connected scaffold with matching
tangents, avoiding a frozen middle pose. Visual review replaced a single cubic
path because it left the intermediate silhouette overly fragmented. Source and
destination endpoints remain exact. Quintic scroll timing and the existing
140ms visual-scroll damping preserve smooth reversal. Precise vertex bounds now
set the initial fit, avoiding oversized transformed bounding boxes that made
the rotated hero unnecessarily small. The far clipping plane follows the camera
distance for unusually tall viewports.

The two project surfaces and their scientific paths retain their prepared
results. The preceding removal of Research and the move of teaching courses and
awards into Education remain in place. Tracker files, note PDFs, external project
repositories and audio synthesis are outside this revision.

## Verification

Evidence is retained locally in `.artifacts/black-geometry-interactive/`.
Geometry tests cover the quintic equation, its projection and seam topology,
the phoenix's volume and official base colors, and the existing project data.
Interaction unit tests cover gesture arbitration, frame-independent inertia,
keyboard behavior and capture cleanup. Browser tests exercise the actual
rendered orientations and paused orbit, both scroll directions, native touch,
fallback modes and root/dist parity.

`npm run check` passes all 97 unit tests, deterministic asset verification,
byte-for-byte root/dist parity for 42 public files and all 22 local HTML
references. Desktop, phone and landscape captures cover all eight identities,
with additional dragged views, static artwork and intermediate transitions.
No browser page errors occurred in the visual capture run.

A six-second scroll sample on this machine measured 57.8 rendered frames per
second on desktop High (16.7ms median, 21.7ms p95). A 390 × 844 Low profile with
4× CPU throttling held its 30fps target (33.4ms median, 34.5ms p95). These are local
measurements rather than guarantees for every device. The stage retained one
draw call and at most two decoded targets during the sampled morphs.

An independent packed-geometry review checked all seven transition pairs:
both segments have the same midpoint derivative, `0.36 × (destination − source)`.
All control points stay within radius 3.651, leaving at least 0.126 of clearance
inside the fitted side planes. The convex-hull property therefore bounds the
entire morph, including arbitrary user rotations.

The full Chromium/WebKit suite passes **67 tests**. One native-touch test is
intentionally Chromium-only because its real touch injection uses CDP; gesture
arbitration also has browser-independent unit coverage. The suite covers actual
dragged orientations, orbit pause, keyboard and lifecycle cleanup, forward and
reverse scrolling, seven viewport sizes, audio output, reduced motion, missing
assets/rendering, disabled JavaScript, zoom and print.

Publication uses the existing GitHub Pages `main` branch and repository root.
Deployment logs and public asset/rendering verification are retained with the
local evidence rather than embedded into the published page.
