// Original periodic folded surface. No sampled project data or numerical solver.
export const TAU = Math.PI * 2;
export const SURFACE_ROTATION = [-0.64, -0.32, -0.32];
export function surfacePoint(u, v, offset = 0) {
  const radius = 1.48 + 0.22 * Math.cos(u - 0.4) - 0.14 * Math.cos(2 * u);
  const tube = 0.5 + 0.17 * Math.sin(u + 0.7) + 0.055 * Math.cos(3 * u);
  const r = tube + offset;
  return [
    (radius + r * Math.cos(v)) * Math.cos(u) * 1.22,
    (radius + r * Math.cos(v)) * Math.sin(u) * 0.88,
    r * Math.sin(v) * (0.78 + 0.14 * Math.cos(u)) +
      0.32 * Math.sin(2 * u + 0.3),
  ];
}
export function surfaceData(around = 64, across = 24) {
  const positions = [],
    indices = [];
  for (let i = 0; i < around; i++)
    for (let j = 0; j < across; j++) {
      positions.push(...surfacePoint((i / around) * TAU, (j / across) * TAU));
      const a = i * across + j,
        b = ((i + 1) % around) * across + j;
      const c = ((i + 1) % around) * across + ((j + 1) % across),
        d = i * across + ((j + 1) % across);
      indices.push(a, b, d, b, c, d);
    }
  return { positions, indices };
}
export function pathPoint(t) {
  // Parameterized illustration, lifted slightly along the tube to prevent z-fighting.
  return surfacePoint(
    0.15 + t * 2.65,
    1.2 + 0.28 * Math.sin(t * Math.PI),
    0.025,
  );
}
export const NETWORK = {
  nodes: [
    [-2, 0, 0],
    [0, 1.28, 0],
    [0, -1.28, 0],
    [2, 0, 0],
  ],
  edges: [
    [0, 1],
    [1, 3],
    [0, 2],
    [2, 3],
    [1, 2],
  ],
  open: [[0, 1, 2, 3]],
  closed: [
    [0, 1, 3],
    [0, 2, 3],
  ],
};

export function rotatePoint([x, y, z], [rx, ry, rz] = SURFACE_ROTATION) {
  // Match Three.js Euler XYZ (Rz is applied first).
  [x, y] = [
    x * Math.cos(rz) - y * Math.sin(rz),
    x * Math.sin(rz) + y * Math.cos(rz),
  ];
  [x, z] = [
    x * Math.cos(ry) + z * Math.sin(ry),
    -x * Math.sin(ry) + z * Math.cos(ry),
  ];
  return [
    x,
    y * Math.cos(rx) - z * Math.sin(rx),
    y * Math.sin(rx) + z * Math.cos(rx),
  ];
}
