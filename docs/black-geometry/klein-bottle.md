# Classical Klein bottle notes sculpture

The notes sculpture replaces the rainbow torus knot with an original triangulation of the classical, self-penetrating bottle immersion. It uses the final construction in Gregorio Franzoni's [*The Klein bottle in its classical shape*, section 4 and Figure 8](https://arxiv.org/abs/0909.5354).

For `0 ≤ t ≤ π`, its directrix and radius are

`α(t) = (5 sin t, 2 sin²t cos t, 0)`

`r(t) = 1/2 − (2t−π)√(2t(2π−2t))/30`.

Writing `T=α′/|α′|`, and `J(T)=(-T_y,T_x,0)`, the displayed points satisfy

`P(t,v) = α(t) + r(t)[cos(v)J(T) + sin(v)(0,0,1)]`.

Our parameter change `t=π(1−cos u)/2`, `0≤u≤π`, removes the endpoint divergence in the radius derivative. Equivalently, `r(u)=1/2+(π²/30)cos u sin u`. The circular coordinate is periodic and the longitudinal seam reverses: `(π,v)~(0,π−v)`. The final row of triangle indices joins that reflected row exactly. The parameter domain, rather than coincident XYZ positions, determines connectivity, so spatial self-intersections do not accidentally merge sheets.

This is a closed nonorientable surface immersed in three-dimensional space, not an embedding without intersections, a vessel enclosing a conventional interior, or a torus. Its natural depiction includes the mouth, returning neck and long loop. A rigid rotation stands the bottle upright and exposes the mouth; the shared compiler centers and uniformly fits it.

The source has **20,480 vertices and 40,960 triangles**. Colors are only crystalline white `#F7FBFF`, ice `#DCEAF2` and silver `#A3AFB9`; these are authored presentation colors with no scientific data meaning. The renderer controls the final material and lighting. No downloaded mesh or implementation is included.

Focused tests independently check circular cross-sections in the directrix's normal plane, the published radius, the reflected seam's position and tangent agreement, each retained vertex's parametrization, indexed connectivity, Euler characteristic zero, and an orientation-propagation contradiction. The last check distinguishes the Klein bottle from an orientable torus with the same Euler characteristic. Source geometry is finite and stays within the 65,536-face budget; integrated browser appearance is checked separately.
