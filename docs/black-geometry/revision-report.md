# Black Geometry second-pass revision

Revision date: 2026-09-14. This revision supersedes the first-pass visual direction
and its historical acceptance report. Implementation started from the local
`1b28b9779b2b352666618ac1080d41b1b7b14189` tree. The later explicit instruction
“Committ, psuh and deploy” authorizes publication and supersedes the brief's
original local-only restriction. Existing GitHub Pages hosting is retained.

## Result

The fixed blue torus/boxes/node arrangements were replaced with original,
contextual sculptures. The hero is a warm ivory Enneper immersion. Harper uses
its seven-bay hall, Gothic openings, tracery, buttresses, paired towers and
contrasting tower crowns. The dragon has separate angular head/jaw, neck,
articulated claws, ribbed wings, and tail, with navy and gold simultaneously
visible. The membrane is an independently prepared numerical reconstruction
of the logo's L-shaped membrane and two-term display approximation.

Every education, industry, research and teaching entry has its own measured
anchor. Repeated institutions reuse their sculpture; Resolution Life, notes and
contact use the quieter neutral surface. The first 58% of an entry interval
holds its identity and the final 42% transports the mesh toward the next. Native
hashes, resize/font changes, reverse scrolling, and restored positions all use
actual DOM measurements. No scroll capture or simulated navigation was added.

Desktop composition separates readable text on the left from substantial art
on the right. Portrait mobile uses a bounded opaque art region below the
header; landscape uses a split layout. Menu combines navigation and settings.
Decorative numbering, hero slogans, EXPLORE text, project frames and stage labels
were removed. Project controls and concise scientific qualifications remain.

## Geometry, correspondence and rendering

Authored meshes are baked at build time with their presentation transforms and
linear-space material colors. Longest-edge subdivision preserves their surfaces
while bringing them to a common 32,768-facet budget. Balanced spatial partitions
provide deterministic neighborhood correspondence. Each face's six possible
corner orders are tested against a shared folded scaffold to minimize local
rotation/collapse without changing its endpoint surface.

The same opaque mesh unfolds into that connected scaffold and assembles into
the next target. There is no opacity crossfade between complete models. A single
shader interpolates positions and colors; it restores the exact prepared target
at either endpoint. The middle sculpture is an affine deformation of the hero's
connected Enneper surface. Facets separate around the assembly phases; this is
an authored material-transport effect, not a claim of a watertight physical
surface simulation across changes in topology.

The initial direct facet interpolation was rejected after inspecting actual
intermediate screenshots: it produced disconnected shards. The final design
adds the connected bridge, offline corner alignment, subdued moving edges,
and warm intermediate material. A subsequent rendering review caught
winding-dependent lighting after corner alignment; visible-face derivative
normals now keep lighting consistent regardless of corner order.

There is one WebGL context, one animation clock, one principal mesh, and only
the visible project's path overlay. CPU topology/correspondence work is outside
the frame loop. The browser uses the active pair plus the shared scaffold.
Low changes the frame/DPR budgets while retaining recognizable geometry.
Linear material interpolation is converted to sRGB by Three.js's
`colorspace_fragment` output chunk. Lighting is neutral, not permanently blue.

## Source provenance and scientific accuracy

- [Harper reference, architecture, colors and authorship](revision-harper-provenance.md).
- [Drexel references, original dragon design and palette](revision-dragon-provenance.md).
- [Membrane numerical method, official references and reproduction](revision-membrane-provenance.md).
- [Project extraction, original data checks and MIT license](revision-project-provenance.md).
- [Audio lifecycle, graph, measured output and reproduction](revision-audio.md).

The surface project retains all 29,584 original triangles and its 242-point native
outer-ridge Heat Method route. The route reached its source without fallback.
The congestion sculpture retains the 5,151 finite-player count states and 10,000
triangles of the N=100 export. Open highlights the audited exact best-response
trajectory; Closed highlights the feasible two-route boundary. The four open
pure equilibria are preserved in the exported metadata. This homepage does not
run training, invent experiment results, or run either numerical solver.

The build consumes local prepared copies, so it does not require sibling
checkouts or a MATLAB installation. Siblings were inspected read-only. Licenses
and extraction metadata accompany the copied subsets.

## Validation and retained evidence

The unchanged semantic fixture verifies every original name, degree, employer,
role, date, location, course, project description, category and destination.
All 11 notes links remain real unique `li > a` links to valid local PDFs. All 55
protected file hashes match the second-pass starting snapshot, including tracker
records/workflow and published notes; inspected sibling Git states remain clean.

`npm run check` passes 69 tests, builds the experience and static site, verifies
that generated files are current, and checks byte-for-byte root/dist parity for
41 public files and 25 local HTML references. The final browser suite passes all 58 Chromium
and WebKit cases, including actual root/dist requests, tracker filtering,
PDF signatures, per-entry selection, reverse/jump/resize behavior, keyboard and
native history, project controls, audio output and races, reduced/off motion,
no JavaScript, denied storage/fonts, import/asset/renderer/shader/context failure,
320–1920 px layouts, zoom, and print.

Local evidence is deliberately ignored by Git:

| Evidence | Local path |
| --- | --- |
| Starting screenshots, observations and preservation hashes | `.artifacts/black-geometry-revision/baseline/` |
| Actual desktop, laptop and phone targets plus intermediate frames | `.artifacts/black-geometry-revision/visual/` |
| Production scroll recordings | `.artifacts/black-geometry-revision/visual/final-desktop-scroll.webm` |
| Browser regression screenshots and traces | `.artifacts/black-geometry/` |
| Final check log | `.artifacts/black-geometry-revision/check.log` |
| Final full browser log | `.artifacts/black-geometry-revision/browser-final.log` |
| Rendering measurements | `.artifacts/black-geometry-revision/performance.json` |
| Same-graph WAV, measured levels, live control/scroll observations | `.artifacts/black-geometry/revision-audio/` |

The production visual review covered the hero, Harper, dragon and membrane at
1365×900,1024×768 and 390×844; each project, repeated institution, notes and
contact; and 25%,50%,75% samples of the first three transitions. The visual
refinement enlarged the hero and made its idle visible within a few seconds,
reduced the dragon's rounded oversized head, sharpened the muzzle and claws,
removed header ghosting, corrected additive mobile anchor offsets, and added
an intentional landscape composition. Actual images, not scene labels alone,
were used to assess silhouettes and palettes.

## Sound and performance limits

Fresh load creates no AudioContext. A Sound click creates/resumes it directly in
the gesture and plays confirmation. Actual page instrumentation recorded one
context, audible nonzero confirmation, then new transition/settle voices while
scrolling through Harper, dragon and membrane. Mute clears voices and suspends.
Hidden pages are silent, and return does not play skipped identities. A WebKit
off/on boundary involving a redundant delayed suspension was fixed and has a
regression test. Native rapid-click instrumentation also identified missed
clicks while the Sound label changed beneath the pointer. Giving the native
button a stable hit target delivered all six clicks in eight repeated trials,
without weakening the browser test.

The 9-second production-graph WAV has peak 0.3255 (-9.75 dBFS), no clipped samples,
no nonfinite samples and exact initial silence. Confirmation peak is 0.2956;
its 0.65-second measurement window has RMS 0.0476. The live browser tap measured
peak 0.3183 across ordinary interactions. These are digital output measurements;
no human-listening claim is made, and physical speaker/headphone volume is not
under website control. The capture remains available for listening/reproduction.

A local 6-second scroll traversal measured 55.5 fps on the desktop High profile
(median 16.7 ms, 95th percentile 23.9 ms) and 26.7 fps at 390×844 with Low and a simulated 4× CPU
slowdown (median 33.3 ms, 95th percentile 42.2 ms). These investigate the 60/30 fps targets rather
than promise them on every device; model-pair upload and browser scheduling can
cause slower frames. These are local headless-browser measurements, not a
physical low-end-phone certification. The compressed sculpture packet is about
1.7 MiB; total generated JavaScript is 566,913 bytes (145,784 gzip estimate). Static
art appears before enhancement, and reduced/off motion skips the heavy renderer.

The sculptural models are stylized original interpretations, not official
institution-owned 3D models. Static SVGs use painter-sorted projections of the
same targets; they do not reproduce every WebGL shading/occlusion detail.

## Running and publication

```sh
npm ci
npm run build:experience
npm run check
npm run test:browser
python3 -m http.server 8000 --bind 127.0.0.1
# Optional output capture while the server is running:
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright node tools/black-geometry/capture-audio.mjs --live
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright node tools/black-geometry/capture-visuals.mjs
```

For an explicit root/dist comparison, serve `dist` on 8001. Append `?bg-debug`
for the read-only production observations. Motion and Quality are in Menu;
Sound remains a separate discoverable opt-in control.

Publication commits the completed implementation and generated assets, pushes
the current branch to its existing `origin/main` upstream, and verifies the
existing GitHub Pages deployment at `https://mihirrao-10.github.io/`. No hosting
configuration, visibility, tracker workflow, or unrelated user changes are part
of this revision.
