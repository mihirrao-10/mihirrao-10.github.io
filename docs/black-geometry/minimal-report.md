# Minimal presentation revision

The page removes the header name, menu, display settings, sound and audio code,
project replay/shortcut controls, explanatory visualization captions, decorative
arrows and repeated footer details. A single Back to top link remains. Note links
and boxed Open project links use a muted warm yellow; project destinations open
in separate tabs. The homepage retains all eleven note PDFs and both projects.

Teaching now contains only a heading and course titles: two at UChicago and four
at Drexel. Awards retain their three names, including the short Jeffrey L.
Popyack Teaching Assistant Award title from the résumé. Industry role titles are
Software Engineering Intern and Data Science Intern. Their concise summaries
were populated from `career/resume/resume.tex`; project descriptions were checked
against the corresponding local project READMEs. No résumé, PDF, tracker or
external project source was modified.

## Complete surfaces and readable scrolling

Native mandatory scroll snapping settles the page between entries. Complete
entry boxes own their snap areas, so long content remains freely readable inside
an oversized area, as specified by [CSS Scroll Snap](https://www.w3.org/TR/css-scroll-snap-1/#snap-overflow).
The renderer selects the nearest valid reading interval using the same CSS
padding and margins. WebKit uses an equivalent scroll-margin offset because its
oversized-area behavior differs from Chromium's padded snapport. Notes include
the short footer in their snap area, keeping the final PDF and Back to top
reachable. Reduced motion disables smooth snapping.
Initial hash and reload positioning stays immediate, preventing the browser
from animating toward a pre-enhancement layout. Deliberate internal-link clicks
enable native smooth scrolling without replacing browser history or focus.

A 380ms quintic transition runs on elapsed time, independently of scroll position.
It dissolves between complete opaque endpoint meshes using complementary screen
pixels, preserving depth occlusion without intermediate disconnected geometry.
Stopping, reversing or skipping sections always finishes on the selected mesh.

Drag rotation accumulates normalized quaternions about the current screen axes.
This preserves right/down/diagonal directional sense after prior rotations and
allows complete vertical turns. Inertia uses an analytic exponential decay.
Touch retains native vertical scrolling and pinch zoom; horizontal gestures
rotate. Capture is released on cancellation, hidden pages, reduced motion and
disposal. Keyboard rotation is scoped to the focused stage.

## Geometry and material

The notes sculpture is now a colorful (3,5) torus knot. Parametric geometry has
denser samples and every prepared target has at least 65,536 facets. Scientific
project surfaces preserve their original prepared geometry through subdivision.
Smooth normals preserve structural creases; fine mesh edges support the shape
without covering it in bright wire lines. Normals and spatial fitting bounds
are prepared during the build, avoiding reconstruction during a transition.
Each endpoint keeps its own perspective fit so changing the other endpoint
cannot suddenly resize it. Opaque faces, moving gradient colors,
glossy highlights and a glow replace the former translucent layered appearance.
The phoenix's new fire palette is an artistic red/orange/yellow treatment.

The page always uses High quality at up to 2× pixel ratio and targets 60fps;
previous stored preferences cannot downgrade it. OS reduced motion and graphics
failure still show matching static artwork. One graphics context retains at most
two decoded targets, and one settled mesh is drawn outside transitions.
Live section changes also avoid loading hidden fallback SVGs. The matching
poster loads when reduced motion or a graphics failure actually needs it.
Each decoded target owns a reusable graphics buffer, so settling or reversing a
transition does not upload unchanged endpoint geometry again. Buffers are
disposed when their target leaves the two-target cache.

## Verification

Integration evidence is retained locally in `.artifacts/black-geometry-minimal/`.
`npm run check` passes all 86 unit/data tests, the deterministic asset build and
root/dist byte parity for 42 public files and 22 local HTML references. Visual
review covers desktop, portrait phone and landscape layouts, every sculpture,
three dragged views and three reduced-motion posters; no page errors occurred.

The automated Chromium graphics backend reports ANGLE SwiftShader (software
rendering), so its measured frame rate is not a hardware-browser benchmark.
At 2× pixel ratio, the final six-second section traversal measured 14.1fps desktop,
30.9fps phone and 25.6fps with 4× CPU throttling. Removing hidden SVG parsing and
repeated geometry uploads reduced p95 frame intervals from 183ms to 105ms desktop,
104ms to 50ms phone, and 725ms to 65ms with throttling. A settled desktop hero
measured 14.7fps. These short runs are diagnostic observations, not a performance
guarantee. High quality is retained as requested; 60fps remains a target on
capable hardware. The renderer stayed opaque and retained at most two decoded
targets throughout these runs.

All 57 applicable Chromium/WebKit browser cases pass across the complete suite
and focused reruns after the fixes. One WebKit touch-injection case is skipped
because that test uses Chromium's native-input protocol; touch arbitration also
has engine-independent unit coverage. The browser checks cover actual projected
drag directions, moving gradient pixels, completed transitions, buffer limits,
native wheel/touch scrolling, long reading areas, hashes/reloads/history,
project popups, reduced motion, five graphics failure modes, JavaScript disabled,
six viewport sizes, zoom and print.

The initial complete run and focused rerun reports are retained separately.
Publication is checked against committed HTML, CSS, JavaScript and geometry
bytes, followed by a fresh-browser check of every live sculpture.
