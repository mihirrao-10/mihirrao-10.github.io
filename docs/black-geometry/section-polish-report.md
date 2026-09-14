# Section color and sculpture polish

The homepage now pairs each entry's text accents with its sculpture. Introductory
contact links are white; Chicago uses muted red, Drexel blue/gold, MathWorks
blue/amber, Resolution red/blue, the surface project blue/teal, the congestion
project red/orange, and Notes ice white. All boxed links have square corners.
The UChicago Interests paragraph is removed; résumé details, courses and awards
remain intact. Native downward links and viewport reading-height minimums keep
the next education title outside the current entry's starting screen.

Resolution uses an original solid mesh of the company's triangular flag; see
[source and geometry verification](resolution-life.md). Dragon neck/tail scutes
and facial accents add 736 source triangles without changing its bounds. Phoenix
feather relief, raised tail shafts and beak detail add 1,480 triangles. Prepared
targets remain at 65,536 facets. The Klein bottle uses 0.70 face alpha, with mesh
edges reaching 0.88, while other surfaces retain 0.88/0.98. Depth/color geometry,
quaternions, scale, visibility and dissolve masks remain shared.

The Calabi–Yau keeps Hanson's projection with a quieter indigo/amethyst/rose/
champagne palette. The congestion field uses crimson through orange; its exact
prepared trajectory is now a golden-orange tube of radius 0.027 with eight
radial segments. Original route samples, field values and topology are unchanged.

Each decoded target owns its visit's orbit start and saved drag orientation.
MathWorks and Resolution hold the baked reference view for 0.8 seconds of active
orbit time, then ease into movement. Endpoint transforms cancel the shared
camera's incidental phase, so an incoming identity starts clearly while an
outgoing identity continues smoothly. Reversing while an identity is still
visible restores its existing visit; returning after it leaves the two-target
cache starts a fresh view. Pausing a grab still pauses orbit time and preserves
screen-relative drag directions. Static posters use the same authored opening
views and matching palettes/opacity.

Local evidence is under `.artifacts/section-polish/`. Unit/data checks pass 95
tests, deterministic generation checks 16 assets, and root/dist parity checks 42
public files and 22 HTML references. Visual review covers desktop, phone and
landscape versions of all eight identities, plus dragged and reduced-motion
views. No JavaScript errors were observed in that capture run.

The new bundle/layout timing also exposed a weakness in the earlier WebKit
history workaround: startup ran before CSS and native restoration, and late
fonts revisited the old fragment after `pageshow`. The page now saves its reading
position in the existing history entry at `pagehide`, preserving other state and
the URL. On a full Back/Forward return, it checks after fonts and layout settle,
and corrects only a stale scene-fragment landing. Intervening input or navigation
cancels the correction; fresh navigation, reload and BFCache remain native.

The full 66-case browser sweep passed 63 cases, exposing the two WebKit history
cases above, with one expected WebKit native-touch protocol skip. After the
correction, all 10 focused navigation/history/resize/reload cases pass in both
engines, including exact saved-position and unchanged-URL assertions at desktop
and phone widths. This validates 65 distinct cases across the full and focused
runs; the expanded suite was not rerun as a single invocation. Pages deployment
and fresh public-site verification logs are retained in the same evidence folder.
