# Calabi–Yau hero provenance

The hero is an original triangulation of a finite **real two-dimensional slice of the Fermat-quintic Calabi–Yau threefold**, projected from four real coordinates to three. It is not the complete six-dimensional manifold, a Ricci-flat metric computation, or an isometric embedding.

Andrew J. Hanson's [Calabi–Yau cross-section description](https://homes.luddy.indiana.edu/hansona/#:~:text=Calabi-Yau%20Cross%20Sections) identifies the familiar folded illustration with a slice of the projective quintic

\[
Z_0^5+Z_1^5+Z_2^5+Z_3^5+Z_4^5=0\quad\text{in }\mathbb{CP}^4.
\]

Our affine curve is \(z_1^5+z_2^5=1\). One explicit inclusion in that quintic is
\([1:e^{i\pi/5}z_1:e^{i\pi/5}z_2:0:0]\). The quintic itself is a complex threefold; this selected curve has one complex parameter.

## Original implementation of the published construction

Hanson's [1994 Notices AMS paper, equations (3)–(7)](https://homes.luddy.indiana.edu/hansona/papers/CP2-94.pdf) supplies the complex-circle construction. For \(w=\theta+i\xi\), we evaluate

\[
z_1=e^{2\pi i k_1/5}\cos(w)^{2/5},\qquad
z_2=e^{2\pi i k_2/5}\sin(w)^{2/5},
\]

with \(0\leq\theta\leq\pi/2\), \(-1.08\leq\xi\leq1.08\), and every \((k_1,k_2)\in\{0,1,2,3,4\}^2\). Taking fifth powers recovers \(\cos^2w+\sin^2w=1\). The powers use a continuous principal argument on each quadrant patch.

The displayed map is the orthogonal projection

\[
P(z_1,z_2)=\left(\Re z_1,\Re z_2,
\frac{\Im z_1+\Im z_2}{\sqrt2}\right).
\]

It discards \((\Im z_2-\Im z_1)/\sqrt2\). Apparent intersections of different sheets in the picture are consequently expected. A rigid presentation rotation then brings a view at azimuth 35°, elevation 25° to the renderer's camera at +Z.

Hanson's [2019 ICERM presentation, slides 41–47 and 52–53](https://homes.luddy.indiana.edu/hansona/papers/Brown-IGT-Sep19.pdf) discusses the 25 fundamental patches and the compact curve's genus six. Our finite cutoff leaves five boundary loops. It does not include or artificially cap the points at projective infinity.

## Geometry and appearance

- 25 patches, each sampled with 36 × 32 cells: **57,600 triangles, 29,685 vertices**.
- Sampling concentrates near fractional-power branch points. The mesh is computed only during the site's build.
- Shared seams are welded using all four real source coordinates, preserving distinct sheets that overlap only after projection.
- Topology checks independently recover one connected component, five boundary loops, and Euler characteristic −15, consistent with genus six and five removed ends.
- The yellow `#ffe978`, orange `#f47c38`, magenta `#ce4e9b`, and violet `#7142d2` stops are an authored visualization palette. Calabi–Yau manifolds have no intrinsic official colors. The patch palette evokes familiar mathematical illustrations and differentiates phase patches; it is not a physical measurement or an official standard.
- The former height-field ascent trace has been removed because it has no mathematical interpretation on this replacement.

All JavaScript and triangles are original. No reference image, third-party mesh, Mathematica implementation, or downloaded internal asset is included. The current renderer is opaque and handles motion, animated gradients, glow and interaction separately; see opaque-quality.md.

## Verification

`node --test tests/black-geometry/calabi-yau.test.js tests/black-geometry/refinement-math.test.js`

All six tests pass. The new checks independently multiply complex numbers to verify both quintic equations across all 25 charts, test phase identifications at seams and the finite cutoff equation, check every stored mesh vertex against the equation and projection, recover the indexed topology, and verify the projection's discarded coordinate. Existing square-root and trefoil tests remain intact. Authoring previews at front and ±0.35-radian yaw show the folds and simultaneous warm/violet patches; final material and browser review belong to the integrated renderer.
