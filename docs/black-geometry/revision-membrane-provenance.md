# MathWorks-inspired membrane: source and numerical preparation

This portfolio sculpture is original, mathematically constructed artwork. It is not an official MathWorks asset. The published reference images were inspected but are not included in the website. No MATLAB source, proprietary implementation, downloaded model, runtime MATLAB dependency, or remote numerical service is used.

## Primary references inspected

- [Creating the MATLAB Logo](https://www.mathworks.com/help/matlab/visualize/creating-the-matlab-logo.html), including its [finished image](https://www.mathworks.com/help/examples/matlab/win64/MatlabLogoExample_08.png) and [camera view before lighting](https://www.mathworks.com/help/examples/matlab/win64/MatlabLogoExample_03.png). These establish the tall asymmetric crest, flat left extension, rolled lower edge, warm front face, and cool back flank. Its camera direction is used to orient the original mesh.
- [MathWorks Logo, Part One: Why Is It L Shaped?](https://blogs.mathworks.com/cleve/2014/10/13/mathworks-logo-part-one-why-is-it-l-shaped/) establishes the lowest Dirichlet Laplacian mode over three unit squares and the singular behavior at the 270° reentrant corner.
- [Part Four: Method of Particular Solutions Generates the Logo](https://blogs.mathworks.com/cleve/2014/11/17/mathworks-logo-part-four-method-of-particular-solutions-generates-the-logo/) explains the symmetric sector basis and the deliberate two-term truncation used for the symbol. The visual truncation does not satisfy the outside boundary conditions; its curved outer edges are intentional.
- [The MathWorks Logo Is an Eigenfunction of the Wave Equation](https://www.mathworks.com/company/technical-articles/the-mathworks-logo-is-an-eigenfunction-of-the-wave-equation.html) confirms the distinction between the mathematical membrane mode and the artistically modified display surface.

## Original computation

The computation below was run at author time with Python's standard library and NumPy. It uses the mathematical method described in the references, independently implemented; no reference implementation was downloaded or translated.

The domain is `[-1, 1]²` with the open southwest quadrant removed. With polar angle measured counterclockwise from the downward ray, the trial basis is

`J_α(sqrt(λ) r) sin(α θ)`, for `α = (2/3) × [1, 5, 7, 11, 13, 17, 19, 23, 25]`.

The basis already vanishes on both edges meeting at the reentrant corner. Its values on 580 samples of the four outer edges form the boundary matrix. Column normalization makes the singular-value comparison meaningful despite the differing basis magnitudes. Golden-section minimization over `[9.5, 9.8]` locates the lowest mode. The final right singular vector determines its coefficients.

Observed results:

- Eigenvalue: **9.639723843543223**. The reference value is approximately 9.63972384402.
- Maximum absolute sampled outside-boundary discrepancy after setting the first coefficient to one: **1.2284 × 10⁻⁶**.
- Coefficients: `[1, 0.25615690714466466, -0.7955036743177366, -2.114282253223813, -0.6722756653580659, -28.660323965401066, 8.600189278520025, -4065.4943587273156, -635.7340045913635]`.
- The displayed sculpture retains the first two terms. On a uniform 49 × 49 authoring grid its height ranges from −0.215927 to 0.646785, giving the approximately −1/3 lower edge relative to the positive crest seen in the reference. This display shape must not be described as the exact zero-boundary mode.

The excluded quadrant is displayed at zero height to preserve the flat apron visible in the illustrated logo. It is excluded from the eigenfunction solve.

Reproduction of the numerical coefficients:

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
    if full:
        return singular_values[-1], vt[-1] / scale
    return singular_values[-1]

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

## Geometry and presentation

`src/black-geometry/sculptures/membrane.js` exports `createMembrane()`, a Node-importable Three.js Group with one indexed, vertex-colored BufferGeometry mesh. It contains **2,401 vertices and 4,608 triangles**, using local grid connectivity with alternating diagonals and slightly greater sampling density around the fold. The author-time coefficients are constants; the file evaluates the fixed shape for the asset build and performs no eigenvalue solve.

The source domain is rotated clockwise by 90°. A camera basis from the documented southwest view is baked into the geometry, giving +Y up and a primary camera on +Z. The peak remains above and to the right of the broad blue apron; the copper sheet falls forward into the curved lower hem. Uniform scaling and centering yield bounds of approximately **5.781 × 4.800 × 4.955**. Use the authored primary orientation and restrained camera offsets; a full rotation defeats the reference presentation.

The copper, orange, gold, and blue vertex colors are original art-direction choices, converted by Three.js from sRGB inputs into linear working color. They are not claimed as an official hexadecimal brand palette. The blue is a continuous flank and apron; the orange/copper region is simultaneously present on the main face.

Author checks: imported successfully using installed Three.js 0.186.0; all positions, colors, and normals finite; vertex normals unit length within Float32 tolerance; mesh bounds and triangle count checked. A projected geometry preview was compared with the actual reference for crest position, blue apron, descending right tip, and curved lower edge. This authoring preview is not a claim about integrated browser lighting or mobile composition; those require the shared scene review.
