# Sculpture provenance

Geometry factories live in `src/black-geometry/sculptures/`. The asset compiler
prepares their output for the runtime and static posters. Institutional sculptures
are independently authored interpretations. Reference photographs, logos, meshes,
and proprietary implementations are not redistributed. Display colors and lighting
are presentation choices except where an official asset's colors are identified below.
The source and tests define current sampling budgets and rendering parameters.

## Calabi–Yau slice

`hero.js` implements Andrew J. Hanson's published construction from his
[1994 paper, equations (3)–(7) and Table 1](https://homes.luddy.indiana.edu/hansona/papers/CP2-94.pdf).
For `w = theta + i xi`:

```text
z1 = exp(2 pi i k1/5) cos(w)^(2/5)
z2 = exp(2 pi i k2/5) sin(w)^(2/5)
P  = (Re z1, Re z2, (Im z1 + Im z2)/sqrt(2))
```

Use all 25 `(k1,k2)` pairs, `0 <= theta <= pi/2`, and `-1 <= xi <= 1`.
This solves `z1^5 + z2^5 = 1`; its inclusion
`[1:exp(i pi/5)z1:exp(i pi/5)z2:0:0]` lies in the projective Fermat quintic.
The displayed slice has two real dimensions. The complete Calabi–Yau threefold
has six; this artwork does not compute its Ricci-flat metric.

The projection discards `(Im z2 - Im z1)/sqrt(2)`, allowing sheets to overlap.
Seams are welded in four-dimensional source coordinates rather than projected
coordinates. The finite cutoff leaves five boundary loops; the connected mesh's
Euler characteristic is -15, consistent with genus six and five removed ends.
Hanson's [2019 presentation](https://homes.luddy.indiana.edu/hansona/papers/Brown-IGT-Sep19.pdf)
describes the patches and genus. The presentation follows his published projection
angle and three-quarter view, with uniform fitting rather than axis stretching.
The indigo, amethyst, rose, and champagne palette is authored.

Reference images are on [Hanson's page](https://homes.luddy.indiana.edu/hansona/):
[Mathematica rendering](https://homes.luddy.indiana.edu/hansona/smoothN5.jpg) and
[phase-colored rendering](https://homes.luddy.indiana.edu/hansona/web-CY-quintic.jpg).
Tests independently check the equations, projection, seams, and indexed topology.

## Klein immersion

`mathematical.js` sweeps a figure-eight through three half-turns. The reference is
Gregorio Franzoni's [*The Klein bottle in its classical shape*, equation (1)](https://arxiv.org/abs/0909.5354).
The paper supplies the one-half-twist construction; three half-turns are an authored
extension. For `0 <= u,v <= 2 pi`:

```text
R = 2.3; phi = 3u/2
A = cos(phi) sin(v) - sin(phi) sin(2v)
B = sin(phi) sin(v) + cos(phi) sin(2v)
P = ((R+A) cos(u), (R+A) sin(u), B)
```

The seam is `(2 pi,v) ~ (0,-v)`. Crossing branches at `v=0` and `v=pi` retain
distinct vertices. This is a closed nonorientable immersion with self-intersections.
The cross-section radius is at most `5/4`, so `R+A` stays positive, and its tangent
has squared length at least `31/64`. The sweep and cross-section derivatives remain
independent. Tests recover closed connectivity, Euler characteristic zero, reflected
seam tangents, and an orientation-propagation contradiction.

Pearl, faint lavender, ice blue, and a small peach glint are authored display accents.
The renderer's translucent faces and hidden contours reveal folded lobes; they do
not represent a scientific field or an optical simulation.

## Institutional sculptures

### UChicago phoenix

`phoenix.js` models the bird in volume, including both sides of its wings, beak,
feet, feather relief, and five tail plumes. UChicago's
[mascot history](https://athletics.uchicago.edu/sports/2023/6/12/maroons-phoenix.aspx)
identifies Phil the Phoenix. Its
[identity reference](https://creative.uchicago.edu/logos-and-identity-elements/) and
[mascot photograph](https://dbukjj6eu5tsf.cloudfront.net/sidearm.sites/chgo.sidearmsports.com/images/2017/4/1/Phoenix_Mascot1.jpg)
informed the silhouette and neck ruff. Maroon `#800000`, gray `#767676`, light gray
`#D6D6CE`, and white follow the [published style guide](https://www.law.uchicago.edu/style-guide).
Darker shading accents are authored. Tests check anatomy, bounds, enclosed feather
volume, color-area proportions, and attachment of tail shafts and nostrils.

### Drexel dragon

`dragon.js` uses anatomical lofts, solid armor, and curved wing membranes with
separate finger bones. Drexel's [interview with sculptor Eric Berg](https://drexel.edu/news/archive/2019/September/Drexel-Dragon-Secrets-Straight-from-the-Sculptor)
supplied front, rear, and clay-head references. The upright curved neck, open snout,
raised foreclaw, and lifted tail informed the authored pose. Blue `#07294D` and gold
`#FFC600` follow [Drexel's digital colors](https://drexel.edu/identity/drexel/color).
Tests check finite geometry, approved bounds, opposing eyes, and scute attachment.

### MathWorks membrane

`membrane.js` independently evaluates a fixed shape derived from the L-shaped
membrane. References: [Creating the MATLAB Logo](https://www.mathworks.com/help/matlab/visualize/creating-the-matlab-logo.html),
[why it is L-shaped](https://blogs.mathworks.com/cleve/2014/10/13/mathworks-logo-part-one-why-is-it-l-shaped/),
[method of particular solutions and two-term display truncation](https://blogs.mathworks.com/cleve/2014/11/17/mathworks-logo-part-four-method-of-particular-solutions-generates-the-logo/),
and [the wave-equation eigenfunction](https://www.mathworks.com/company/technical-articles/the-mathworks-logo-is-an-eigenfunction-of-the-wave-equation.html).

The solve domain is `[-1,1]^2` excluding the open southwest quadrant. With polar
angle measured from the downward ray, the basis is
`J_alpha(sqrt(lambda) r) sin(alpha theta)` for orders
`(2/3) * [1,5,7,11,13,17,19,23,25]`. Boundary collocation uses 580 outer-edge
samples, column-normalized singular values, and golden-section search on `[9.5,9.8]`.
It gives `lambda = 9.639723843543223`, second coefficient `0.25615690714466466`,
and sampled boundary discrepancy approximately `1.2284e-6` after normalizing the
first coefficient to one. Reproduce the author-time solve with Python and NumPy:

```python
import math
import numpy as np

orders = np.array([1, 5, 7, 11, 13, 17, 19, 23, 25]) * (2 / 3)

def bessel(order, z):
    term = (z / 2) ** order / math.gamma(order + 1)
    value = term.copy()
    for k in range(1, 48):
        term *= -(z * z / 4) / (k * (k + order))
        value += term
    return value

def basis(x, y, eigenvalue):
    r = np.hypot(x, y)
    theta = np.mod(np.arctan2(y, x) + math.pi / 2, 2 * math.pi)
    return np.array([
        bessel(order, np.sqrt(eigenvalue) * r) * np.sin(order * theta)
        for order in orders
    ]).T

t = np.linspace(-1, 1, 193)
q = np.linspace(0, 1, 97)
x = np.concatenate([t, np.ones_like(t), -np.ones_like(q), q])
y = np.concatenate([np.ones_like(t), t, q, -np.ones_like(q)])

def objective(eigenvalue, full=False):
    matrix = basis(x, y, eigenvalue)
    scale = np.linalg.norm(matrix, axis=0)
    _, singular_values, vt = np.linalg.svd(matrix / scale, full_matrices=False)
    return (singular_values[-1], vt[-1] / scale) if full else singular_values[-1]

a, b = 9.5, 9.8
ratio = (math.sqrt(5) - 1) / 2
c, d = b - ratio * (b - a), a + ratio * (b - a)
fc, fd = objective(c), objective(d)
for _ in range(90):
    if fc < fd:
        b, d, fd = d, c, fc
        c = b - ratio * (b - a)
        fc = objective(c)
    else:
        a, c, fc = c, d, fd
        d = a + ratio * (b - a)
        fd = objective(d)
eigenvalue = (a + b) / 2
_, coefficients = objective(eigenvalue, True)
coefficients /= coefficients[0]
print(eigenvalue, coefficients)
print(np.max(np.abs(basis(x, y, eigenvalue) @ coefficients)))
```

The display retains only the first two terms and extends the excluded quadrant
at zero height as an apron. Its outside edges intentionally do not satisfy the
full eigenfunction boundary conditions. Evaluation happens during asset building;
no eigenvalue solver runs in the browser. Copper, orange, gold, and blue are
authored presentation colors. Keep the baked camera orientation when comparing
the silhouette with the reference.

### Resolution Life flag

`mathematical.js` constructs a solid version of the triangle in the company's
[official header SVG](https://www.resolutionlife.com/media/pfglbg3u/logo.svg).
The asset supplies aspect ratio `15.6471 / 7.29508`, red `#E53E51`, and blue
`#202945`. A curved crest, thickness, blue reverse, and blue perimeter reveal
are original three-dimensional choices. Tests check projected silhouette, aspect
ratio, enclosed thickness, connectedness, and topology.

## Research exports

`projects.js` is build-only Node code. It reads prepared local exports; the homepage
runs no solver or learner. Both source projects use the MIT License, Copyright (c)
2026 Mihir Rao. The full notice remains in
`assets/black-geometry/project-data/PROJECT-DATA-LICENSE.txt`.

### Heat-method surface

The original source is `research/shortest-path-through-a-curved-world`, commit
`8c81669648c663b33343f3346f2a410180e74d6f`, specifically
`web/public/data/worlds/genus-2/world.bin` and `world.meta.json`.
Source binary SHA-256:
`df82e2c0f602522b4dd928555f94e8ebd381f314b0fbf9cc74f06da2c93d234e`.

Local `assets/black-geometry/project-data/genus-2.bin` preserves byte-exact subsets:
14,790 positions and normals, 29,584 triangles, distance values, and all 242 native
positions of the `outer-ridge` route. Format: `PORTGEO1`, three little-endian uint32
counts, then Float32 positions, normals, distances, Uint32 faces, and Float32 route
coordinates. Source path length `3.86152056647` agrees with the Float32 copy's
`3.86152058719`. The mesh and route receive the same rigid transform and uniform
scale. This is a prepared approximate heat-method route; color derives from its
distance field.

### Congestion potential

The original source is `research/multi-agent-reinforcement-learning-in-congestion-games`,
commit `11cefcec1d168cf98aecdd8e23ffac7771dbfea1`, specifically
`web/public/data/population-100-v3.json`.
Source SHA-256:
`78ddb2dc83ebf3b04e0673f2ad7aa26738012d80bfd5d12a7b7fa773d5e0f529`.

Local `congestion-100.json` preserves 5,151 integer count states and 10,000 triangles.
Height and color represent Rosenthal potential, using `(potential - 6060) / 3000`
before presentation scaling. The open path is all 65 strict-best-response
checkpoints, ending at `[1,1,98]`. The closed path is all 101 feasible states
`[upper,lower,0]`; it represents feasibility, not learning. Open equilibria are
`[0,0,100]`, `[0,1,99]`, `[1,0,99]`, and `[1,1,98]`; all-Shortcut is not unique.
The optional network illustration uses the source's canonical open/closed states.
Tests check copied data, exact counts, complete equilibrium metadata, and shared
transforms for geometry and paths.

## Additional source factories

The retained Harper library factory is an original simplified architectural model.
References are the [official architecture entry](https://architecture.uchicago.edu/locations/william_rainey_harper_memorial_library/),
[tower photographs](https://college.uchicago.edu/news/campus-stories/library-isnt-evolution-harper-memorial-library),
and [UChicago identity guidelines](https://news.uchicago.edu/sites/default/files/attachments/_uchicago.identity.guidelines.pdf).
Its Gothic windows are actual modeled openings, and its unlike tower crowns follow
the references. It is not a survey reconstruction.

Auxiliary mathematical factories were independently authored using standard
[torus-knot](https://mathworld.wolfram.com/TorusKnot.html),
[trefoil](https://mathworld.wolfram.com/TrefoilKnot.html),
[monkey-saddle](https://mathworld.wolfram.com/MonkeySaddle.html), and
[square-root surface](https://reference.wolfram.com/language/ref/Sqrt.html) definitions.
Their presence in source does not make them active homepage targets.
