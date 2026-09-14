# Crystalline mesh and résumé revision

This revision supersedes the large opaque sculptures and rainbow notes knot.
All render targets use the same 0.84 presentation scale, including their scientific
paths, and the static posters use the same size reduction. Prepared geometry
remains at 65,536 triangles per identity; topology is not inflated to obtain
brighter pixels.

## Mesh presentation

Real barycentric triangle edges now form a luminous tessellation. A blend of
smooth and face normals, deterministic per-facet lighting and moving highlights
makes the triangular surface visible. Face alpha is 0.88 and edge alpha reaches
0.98. The existing 380ms elapsed-time transition still completes when scrolling
stops, with no intermediate transported triangle cloud.

A depth-only pass and a translucent color pass share each endpoint's geometry,
transform, visibility, uniforms and exact screen-pixel dissolve mask. This lets
faces remain gently translucent without layering every rear surface over the
silhouette. Shader derivatives are evaluated before any varying pixel discard.
Targets still own cached geometry, retaining at most two decoded targets and
avoiding uploads when a transition merely settles or reverses.

The Calabi–Yau uses Hanson's published projection/view parameters; the new white,
ice and silver notes surface is a classical immersed Klein bottle. See
[Calabi–Yau provenance](calabi-yau.md) and [Klein bottle provenance](klein-bottle.md).
UChicago's phoenix returns to official maroon #800000 with gray and white accents;
its small lighting highlights are display effects, not replacement brand colors.

## Content provenance

Teaching retains minimal code | title rows. The Autumn 2026 offering is
**MPCS 50103 — Mathematics for Computer Science: Discrete Mathematics**, with
Ishan Agarwal listed as instructor in the
[official course schedule](https://mpcs-courses.cs.uchicago.edu/?sort=catalog).
The new TA assignment and Drexel magna cum laude honor were provided by the user.
The university's [specialization listing](https://mpcs-courses.cs.uchicago.edu/?by_requirement=true&sort=-name)
uses **Artificial Intelligence Foundations**.

The other course codes were verified against official UChicago and Drexel
catalogs. All eight industry bullets and the two existing project descriptions
match the corresponding text in `career/resume/resume.tex` after normalizing
LaTeX formatting; metrics and technical details are retained. No résumé source,
note PDF, numerical project data or job-tracker data was modified.

## Verification

Evidence is retained locally under `.artifacts/crystalline-mesh/`.
`npm run check` passes all 88 unit/data tests, deterministic generation and
root/dist parity for 42 public files and 22 local HTML references. Visual review
covers all eight sculptures at desktop, phone and landscape sizes, dragged
views and static fallbacks. The final Klein bottle view was checked directly
and after an orbit, at both desktop and phone sizes.

The Chromium diagnostic uses ANGLE SwiftShader software rendering. Its brief
2×-pixel-ratio traversals measured 11.2fps desktop, 19.1fps phone and 15.8fps with
4× CPU throttling; these are software-renderer observations, not hardware-GPU
benchmarks or a 60fps guarantee. Quality remains High as requested. Decoded
geometry stayed bounded at two targets and both depth/color endpoint pairs
remained synchronized throughout.

History testing exposed a WebKit restoration issue: a full Back navigation first
restored the saved reading position, then jumped to an older URL fragment before
`pageshow`. Instrumented probes reproduced it with snapping disabled, fallbacks
hidden from initial parsing, and the entire application module removed. The
guarded correction preserves the nonzero position already restored by the
browser, only on a full `back_forward` navigation that subsequently reaches the
stale scene anchor. It runs once at `pageshow` and cancels on intervening user
input. Fresh links, reloads, BFCache returns and native history remain in place.

The initial two-engine browser run passed 56 cases, with the restoration failure
above and one expected WebKit native-touch protocol skip. After the correction,
all eight targeted history/hash/resize/reload checks pass in Chromium and WebKit
at 1440×900 and 390×844, preserving the exact scroll-position assertions. Across
the full and focused runs, 59 distinct cases pass and one is skipped; this is
not a claim that the expanded 60-case suite ran in one final invocation.
Post-push Pages and fresh public-site evidence are retained in the same local
artifact directory.
