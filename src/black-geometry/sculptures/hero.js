import * as THREE from "three";

export const CALABI_YAU = Object.freeze({
  degree: 5,
  xiMax: 1.08,
  thetaSegments: 18,
  xiSegments: 16,
  projectionAngle: Math.PI / 4,
  equation: "z₁⁵ + z₂⁵ = 1",
});

// Original implementation of the complex-circle construction in A. J. Hanson,
// Notices AMS 41 (1994), 1156–1163, equations (3)–(7). These are 25 charts of
// a real 2D slice, not an embedding of the entire real 6D Calabi–Yau threefold.
function fractionalPower(real, imaginary, phase) {
  // Trigonometric roundoff at a branch point must remain an exact zero.
  if (Math.hypot(real, imaginary) < 1e-14) return [0, 0];
  const radius = Math.hypot(real, imaginary) ** (2 / CALABI_YAU.degree);
  const angle = Math.atan2(imaginary, real) * (2 / CALABI_YAU.degree) + phase;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

/** Return [Re z₁, Im z₁, Re z₂, Im z₂] before the lossy 3D projection. */
export function calabiYauPoint(theta, xi, k1 = 0, k2 = 0) {
  const phase = 2 * Math.PI / CALABI_YAU.degree;
  // cos(theta+i xi), sin(theta+i xi): their squares sum to one.
  const z1 = fractionalPower(
    Math.cos(theta) * Math.cosh(xi), -Math.sin(theta) * Math.sinh(xi), k1 * phase,
  );
  const z2 = fractionalPower(
    Math.sin(theta) * Math.cosh(xi), Math.cos(theta) * Math.sinh(xi), k2 * phase,
  );
  return [...z1, ...z2];
}

/** Orthogonal projection R⁴ → R³; the discarded coordinate is documented. */
export function projectCalabiYau([real1, imaginary1, real2, imaginary2]) {
  const angle = CALABI_YAU.projectionAngle;
  return [real1, real2, Math.cos(angle) * imaginary1 + Math.sin(angle) * imaginary2];
}

/** Prepared Fermat-quintic cross-section with a phase-inspired display palette. */
export function createHero(neutral = false) {
  const positions = [], complex = [], colors = [], colorCounts = [], indices = [];
  const welded = new Map();
  const palette = ["#7142d2", "#ce4e9b", "#f47c38", "#ffe978"].map(hex => new THREE.Color(hex));
  const white = new THREE.Color("#eef1ed"), color = new THREE.Color();
  const { degree, thetaSegments, xiSegments, xiMax } = CALABI_YAU;
  for (let k1 = 0; k1 < degree; k1++) {
    for (let k2 = 0; k2 < degree; k2++) {
      const patch = [];
      const phaseShade = 0.5 + 0.5 * Math.cos(2 * Math.PI * (k1 + 0.57 * k2) / degree);
      const band = phaseShade * (palette.length - 1), low = Math.min(palette.length - 2, Math.floor(band));
      color.copy(palette[low]).lerp(palette[low + 1], band - low);
      if (neutral) color.lerp(white, 0.85);
      for (let j = 0; j <= xiSegments; j++) {
        const signed = 2 * j / xiSegments - 1;
        const xi = Math.sign(signed) * Math.abs(signed) ** 2 * xiMax;
        for (let i = 0; i <= thetaSegments; i++) {
          const s = i / thetaSegments;
          // Resolve the fractional-power cusps without changing the surface.
          const theta = Math.atan2(s * s, (1 - s) * (1 - s));
          const point = calabiYauPoint(theta, xi, k1, k2);
          // Weld in R⁴. Welding projected XYZ would incorrectly join distinct
          // sheets at their apparent self-intersections in the 3D picture.
          const key = point.map(value => Math.round(value * 1e10)).join(",");
          let vertex = welded.get(key);
          if (vertex === undefined) {
            vertex = positions.length / 3;
            welded.set(key, vertex);
            positions.push(...projectCalabiYau(point));
            complex.push(...point);
            colors.push(0, 0, 0);
            colorCounts.push(0);
          }
          colors[vertex * 3] += color.r;
          colors[vertex * 3 + 1] += color.g;
          colors[vertex * 3 + 2] += color.b;
          colorCounts[vertex]++;
          patch.push(vertex);
          if (i && j) {
            const a = patch[(j - 1) * (thetaSegments + 1) + i - 1];
            const b = patch[(j - 1) * (thetaSegments + 1) + i];
            const c = patch[j * (thetaSegments + 1) + i - 1];
            indices.push(a, c, vertex, a, vertex, b);
          }
        }
      }
    }
  }
  for (let vertex = 0; vertex < colorCounts.length; vertex++) {
    for (let axis = 0; axis < 3; axis++) colors[vertex * 3 + axis] /= colorCounts[vertex];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  // Retained only in this authoring geometry for equation/projection checks.
  geometry.setAttribute("complexPosition", new THREE.Float32BufferAttribute(complex, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const root = new THREE.Group();
  root.name = neutral ? "quiet-quintic-cross-section" : "calabi-yau-quintic-cross-section";
  root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, side: THREE.DoubleSide,
    roughness: 0.35, metalness: 0.13,
  })));
  // Bring a three-quarter view of the complex projection to camera +Z;
  // the renderer may then orbit freely around this actual 3D geometry.
  const azimuth = 35 * Math.PI / 180, elevation = 25 * Math.PI / 180;
  const view = new THREE.Vector3(
    Math.cos(elevation) * Math.cos(azimuth),
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
  );
  root.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().lookAt(view, new THREE.Vector3(), new THREE.Vector3(0, 0, 1)),
  ).invert();
  root.userData = {
    identity: neutral ? "neutral" : "hero",
    equation: CALABI_YAU.equation,
    ambientEquation: "Z₀⁵ + Z₁⁵ + Z₂⁵ + Z₃⁵ + Z₄⁵ = 0 in CP⁴",
    interpretation: "3D projection of a finite real 2D slice of the Calabi–Yau quintic",
    phasePatches: degree * degree,
    openBoundary: true,
    xiMax,
    palette: "Authored yellow, orange, magenta and violet; no intrinsic official colors",
    source: "https://homes.luddy.indiana.edu/hansona/papers/CP2-94.pdf",
  };
  return root;
}
