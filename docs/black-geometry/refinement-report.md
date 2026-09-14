# Portfolio refinement — September 14, 2026

This pass brightens the portfolio, smooths scroll response, expands Harper's
architectural context, adds distinct mathematical identities, and consolidates
teaching within Education. It builds on commit `796e1ee`.

## Content and appearance

The four main sections are Education, Industry Experience, Personal Projects,
and Personal Notes. Research is removed. The two teaching records retain their
roles, dates, locations, and all six original course titles/codes in structured
lists under the appropriate university. Drexel also lists the A* Award,
Student Teaching Excellence Award, and Jeffrey L. Popyack Outstanding
Undergraduate Teaching/Course Assistant Award. The separate awards and Popyack
spelling were verified against [Drexel's official awards page](https://drexel.edu/cci/student-experience/awards-scholarships/).

Neutral white typography, larger section headings, stronger dividers and wider
entry gaps clarify the reading order. Entry opacity follows measured layout in
both scroll directions, reaches full contrast at the reading position, and
remains full for focused content, static fallbacks, reduced motion, Motion off,
printing and JavaScript-disabled browsing.

## Sculptures and motion

Nine measured scene entries use eight baked identities. The opening form is an
original Gaussian-damped cubic saddle with an intrinsic gradient-ascent path.
Its red trace and marker animate along a prepared RK4 trajectory, then gently
fade for replay. The hero is not labeled a Calabi–Yau manifold. Resolution Life
uses a red-and-blue trefoil ribbon; notes use a white-and-green projection of
the square-root Riemann surface. Equations, mathematical limitations, and sources
are in [the mathematical provenance](refinement-math.md).

Harper is approximately 16% wider, with the main architecture retained and low
Gothic wings, rear arcade, and courtyard outlines adding context. These are
stylized surrounding forms, not a survey of the campus. Its faces are more
translucent, while stronger mesh edges preserve legibility. The existing dragon
and MATLAB membrane retain their authored geometry. The genus-two project uses
blue, teal, and cyan-green; the congestion potential uses brighter reds. The
[art report](refinement-art.md) documents the geometry and palette changes.

Native scrolling and links remain immediate. Only the artwork's sampled scroll
position has a 140ms exponential response; large jumps and restored anchors
resolve directly. The first half of each measured interval holds a sculpture;
the second half uses quintic easing through a connected folded scaffold, with a
soft opacity dip. Context lines and paths fade with their associated geometry.
A slow camera ellipse in azimuth and elevation looks at the fixed center,
retaining a useful front-facing view of the sculptures. The hero has a higher
viewpoint to expose the red path: ray checks across 25 poses, including pointer
limits, find all 198 trace points visible. Tube sampling preserves the prepared
polyline parameterization so the animated marker stays on its drawn endpoint.

The runtime still has one WebGL context and one transported mesh, retaining only
two decoded target buffers and the shared scaffold. The mesh has 32,768 facets;
all authoring, gradient integration, numerical export handling, and spatial
correspondence happen during the build. Static SVGs use the same source models.

## Validation

- `npm run check`: 82 passing tests, deterministic asset verification, tracker
  validation, and byte-for-byte root/dist parity for 42 public files and all 22
  local HTML references.
- The full Chromium/WebKit suite passed all 62 checks. After the A* award
  addition and audio synchronization adjustment, 22 affected content, responsive
  and audio cases were rechecked. The sound probe initially sampled too late
  under load; it now records from graph creation. Its final two-engine rerun
  passes, with the other 21 affected cases passing in the preceding run.
- Math tests independently check analytic gradients, increasing ascent heights,
  trace clearance, square-root algebra and sheet seams, and the closed ribbon.
  Export invariants cover every project vertex, normal, triangle, route, and
  exact congestion marker. A runtime tube test covers nonuniform sampling and
  marker alignment.
- Desktop, portrait phone and landscape screenshots show legible content and
  unclipped sculptures. The trace was inspected through its animated reveal.
- A six-second local scroll sample averaged 54 rendered fps at desktop high
  quality (16.7ms median, 27ms p95), and 26.2 fps with phone low quality plus
  simulated 4× CPU slowdown (33.3ms median, 59.7ms p95). These observations are
  device-specific; low quality targets 30 fps. Both retained finite geometry,
  two decoded targets, and one live context.

The tracker records, PDF notes, scheduled workflow, and audio synthesis module
are unchanged. Optional cues now follow the eased visual state. The three
awards are explicitly represented in the content-preservation fixture.

Local screenshots, browser reports, performance measurements, and subsequent
live verification are stored under the ignored
`.artifacts/black-geometry-refinement/` directory. Publishing pushes the current
branch to its existing `origin/main` upstream; GitHub Pages serves `main` at `/`.
