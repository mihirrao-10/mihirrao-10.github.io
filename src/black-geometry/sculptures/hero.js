import * as THREE from "three";

/** Original Enneper immersion: a continuous, curved disk with an open rolled rim. */
export function createHero(neutral = false) {
  const positions = [], colors = [], indices = [];
  const rings = 30, sectors = 96;
  const ivory = new THREE.Color("#E8DECE");
  for (let j = 0; j <= rings; j++) {
    const r = 0.025 + (j / rings) * 1.39;
    for (let i = 0; i <= sectors; i++) {
      const angle = i / sectors * Math.PI * 2;
      const u = r * Math.cos(angle), v = r * Math.sin(angle);
      positions.push(u - u ** 3 / 3 + u * v * v,
        v - v ** 3 / 3 + v * u * u, (u * u - v * v) * 0.83);
      const shade = 0.67 + 0.33 * j / rings;
      colors.push(ivory.r * shade, ivory.g * shade, ivory.b * shade);
      if (j && i) {
        const d = j * (sectors + 1) + i, a = d - sectors - 2;
        indices.push(a, a + 1, d, a, d, d - 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.72,
  })));
  root.rotation.set(neutral ? 0.48 : -0.48, neutral ? 0.52 : -0.36, neutral ? -0.48 : 0.34);
  return root;
}
