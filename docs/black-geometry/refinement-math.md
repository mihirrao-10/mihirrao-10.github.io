> Historical authoring record. The opening height field and gradient trace described below have been replaced by the [Hanson quintic cross-section](calabi-yau.md). The square-root notes form and subsequent rainbow knot have been replaced by the [classical Klein bottle](klein-bottle.md). The trefoil interlude has now been replaced by the [Resolution Life flag sculpture](resolution-life.md). Current source factories use the 65,536-facet packet budget.

# Mathematical sculpture refinement

The three new forms are original mathematical artwork, prepared locally when the sculpture assets are built. No external mesh, copyrighted implementation, runtime solver, or remote numerical service is used. These are not company logos or visualizations of financial results. None is described as a Calabi–Yau surface.

## Opening: three crests and a real gradient ascent

`src/black-geometry/sculptures/hero.js` replaces the original Enneper hero with a connected height graph:

`h(u,v) = 3.15 (u³ − 3uv²) exp(−u² − v²)`.

The cubic factor is the classical monkey-saddle polynomial; the Gaussian envelope is an original modification that produces finite crests. The domain has polar radius `1.61 + 0.13 cos(3θ)`, giving an authored, gently lobed perimeter. The source mesh uses `(u, h, −v)` so +Y is height, followed by one presentation rotation. Its 7,504 triangular faces share indexed vertices. Bright near-white colors with a restrained green height accent replace the beige palette.

The red path is a computed intrinsic gradient ascent of height on this graph. Let `g = (h_u, h_v)`. The induced metric of the graph is `I + ggᵀ`, so its height-gradient flow in parameter coordinates is

`d(u,v)/dt = g / (1 + |g|²)`.

Consequently, along the exact flow, `dh/dt = |g|² / (1 + |g|²) ≥ 0`. The implementation uses the analytic derivatives of the displayed equation and fourth-order Runge–Kutta with step 0.025, starting at `(0.52, 0.87)`. It stops when the gradient norm is below 0.0001. This trajectory represents an authored mathematical field, not empirical research data.

Observed preparation checks:

- 198 saved trajectory points; every sampled height strictly increases.
- Initial height −1.17289277519; final height 1.29123627786.
- Final parameter position approximately `(1.2247271884, 0.0000000092)`.
- Endpoint gradient norm approximately `9.13 × 10⁻⁵`, close to the actual crest at `(sqrt(3/2), 0)`.
- Analytic derivatives agree with central finite differences within `10⁻⁷` at the checked interior points.

The Group contains the line with `userData.path = true`, `userData.kind = "ascent"`, and an explicit 0.012 offset along the analytic upward unit normal. Ray checks against the actual triangulated mesh confirm every saved line point remains within the mesh and above it, with vertical clearances from 0.01244 to 0.03051 source units. The line and mesh share the presentation transform. The main renderer may animate the prepared draw range and a marker; it must not imply a solver is running live.

`createHero(true)` remains supported as a quieter variant without the ascent line.

Reference: [Wolfram MathWorld's authored monkey-saddle equations](https://mathworld.wolfram.com/MonkeySaddle.html). The Gaussian modification and gradient computation are independently derived here.

## Resolution Life interlude: trefoil ribbon

`createResolution()` in `src/black-geometry/sculptures/mathematical.js` returns an original faceted ribbon around the torus-knot centerline

`C(t) = ((1.48 + 0.52 cos 3t) cos 2t, (1.48 + 0.52 cos 3t) sin 2t, 0.52 sin 3t)`.

The centerline is a genuine `(2,3)` torus knot, or trefoil. An elliptical cross-section of half-width 0.265 and half-thickness 0.063 follows its analytic tangent and torus normal. Red and blue occupy simultaneous continuous regions. The 6,144 triangles make a closed ribbon volume, not a flat diagram or generic torus. This is an abstract mathematical interlude beside the real Resolution Life content; it is not presented as that company's identity or as financial data.

Reference: [Wolfram's torus-knot definition](https://mathworld.wolfram.com/TorusKnot.html) and [trefoil classification](https://mathworld.wolfram.com/TrefoilKnot.html). Geometry and colors are originally authored.

## Notes: two sheets of the square root

`createNotes()` shows a three-dimensional projection of the algebraic surface `w² = z`. Writing `w = a + ib` gives `z = (a² − b²) + 2iab`; the displayed coordinates are

`(Re z, 1.35 Re w, Im z) = (a² − b², 1.35a, 2ab)`.

A punctured parameter disk, `0.065 ≤ |w| ≤ 1.35`, gives a connected mesh of 7,168 triangles and avoids a degenerate triangle fan at the projected branch point. The two square roots of a nonzero `z` appear on its two sheets. Because one real component of `w` has been omitted, this is a **3D projection** of the complex relation; projected self-intersections must not be described as singularities of the full complex surface. White faces and a restrained green accent keep the closing scene quiet.

Reference: [Wolfram's square-root documentation and Riemann-surface example](https://reference.wolfram.com/language/ref/Sqrt.html). The projection and authored domain are explicit above.

## Verification boundary

All three factories import and construct using installed Three.js 0.186.0. Position, color, and normal arrays are finite; all authored triangles have positive area; each target is below 10,000 faces. The smallest checked triangle areas are approximately `5.32×10⁻⁵` for the hero, `1.43×10⁻³` for the ribbon, and `1.29×10⁻⁵` for notes, in source square units.

A geometry projection contact sheet was inspected during authoring for the three-crest silhouette, visible red ascent, separated trefoil crossings, and folded square-root sheets. Final browser lighting, orbit range, path playback, and mobile composition are verified by the shared rendering integration.
