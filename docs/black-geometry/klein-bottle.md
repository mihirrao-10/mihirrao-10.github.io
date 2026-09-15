# Twisted figure-eight Klein immersion

The notes sculpture now uses a more intricate figure-eight Klein immersion, replacing the earlier classical bottle silhouette. Its reference is the one-half-twist construction in Gregorio Franzoni's [*The Klein bottle in its classical shape*, equation (1) and Figure 1](https://arxiv.org/abs/0909.5354). The extra odd twists are our authored extension, not a claim that the paper specifies this exact three-half-twist presentation.

For `0 ≤ u,v ≤ 2π`, set `R=2.3`, `φ=3u/2`, and

`A = cos(φ) sin(v) − sin(φ) sin(2v)`

`B = sin(φ) sin(v) + cos(φ) sin(2v)`

`P(u,v) = ((R+A)cos(u), (R+A)sin(u), B)`.

This rotates the plane figure-eight `(sin(v),sin(2v))` through three half-turns while sweeping it once around a circle. The odd number of half-turns gives the Klein identification `(2π,v)~(0,−v)`. The final row of indices joins that reflected row exactly. The two crossing branches at `v=0` and `v=π` remain separate vertices, even though their images meet along the sweep circle.

The result is a closed nonorientable surface immersed in three-dimensional space. It has the same Klein-bottle topology as the previous model, with more folded lobes in its spatial presentation. It is not an embedding without intersections, a torus, or a surface of higher topological genus.

## Regularity and geometry

The cross-section radius is at most `5/4`, so `R+A ≥ 2.3−1.25 > 0`. Its tangent `(cos(v),2cos(2v))` never vanishes: its squared length is at least `31/64`. The sweep derivative has a nonzero azimuthal component while the cross-section derivative lies in the radial/vertical plane. They are therefore independent; the authored extra twists do not create singular patches. Position and both tangents obey the reflected seam identification.

The source uses a **288 × 96 lattice: 27,648 vertices and 55,296 triangles**. A rigid three-quarter presentation rotation exposes the central opening and folded returns. The shared compiler centers and uniformly fits the result. It does not solve an equation at visitor runtime or weld self-intersections together.

The mostly pearl `#FAFAFF` surface retains faint lavender `#E8E2F7`, ice blue `#DDEEF9` and a localized peach `#FFE4D4` glint. These colors are authored display accents without a scientific data meaning. The shared renderer uses notes face alpha 0.32, increasing to 0.44 at grazing angles, and brighter edges at 0.68. A faint smooth-contour pass uses both sides and greater-depth testing to reveal obscured folds without drawing rear wireframes. Both sides are appropriate because the surface is nonorientable. Sparse star glints complete this presentation effect; no optical simulation or downloaded mesh is involved.

## Verification

Focused tests independently recover the untwisted lemniscate relation, measure three half-turns from the displayed coordinates, verify both seam tangents and nonzero numerical Jacobians, check each stored vertex against the parametrization, and recover closed connectivity with Euler characteristic zero and an orientation-propagation contradiction. The last check distinguishes the Klein bottle from an orientable torus with the same Euler characteristic. Palette checks retain near-white colors and keep the peach accent small. Integrated browser appearance is reviewed separately.

The integrated revision passed 96 unit checks and 46 targeted Chromium/WebKit cases, including notes transition reversals, contour alignment, loading, responsive layout, native reading restoration and graphics fallbacks. Generated assets are deterministic and 42 public files match between root and dist. Desktop, phone and landscape previews, rotated notes views and the static poster were inspected visually.
