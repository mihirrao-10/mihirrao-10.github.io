import * as THREE from "three";

function meshFrom(positions, colors, indices, name) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, side: THREE.DoubleSide,
    roughness: 0.5, metalness: 0.14,
  }));
  mesh.name = name;
  return mesh;
}

/** An original faceted ribbon around a genuine (2,3) torus-knot centerline. */
export function createResolution() {
  const root = new THREE.Group();
  root.name = "trefoil-ribbon";
  const positions = [], colors = [], indices = [];
  const steps = 256, sides = 12;
  const blue = new THREE.Color("#3577b8"), red = new THREE.Color("#db484f");
  const color = new THREE.Color(), rim = new THREE.Color("#f6ece5");
  for (let i = 0; i < steps; i++) {
    const t = i / steps * Math.PI * 2;
    const c2 = Math.cos(2 * t), s2 = Math.sin(2 * t);
    const c3 = Math.cos(3 * t), s3 = Math.sin(3 * t);
    const radius = 1.48 + 0.52 * c3;
    const center = new THREE.Vector3(radius * c2, radius * s2, 0.52 * s3);
    const tangent = new THREE.Vector3(-1.56 * s3 * c2 - 2 * radius * s2,
      -1.56 * s3 * s2 + 2 * radius * c2, 1.56 * c3).normalize();
    const normal = new THREE.Vector3(c3 * c2, c3 * s2, s3);
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    const warm = THREE.MathUtils.smoothstep(s3, -0.28, 0.28);
    for (let j = 0; j < sides; j++) {
      const theta = j / sides * Math.PI * 2;
      const point = center.clone()
        .addScaledVector(normal, 0.265 * Math.cos(theta))
        .addScaledVector(binormal, 0.063 * Math.sin(theta));
      positions.push(point.x, point.y, point.z);
      color.copy(blue).lerp(red, warm);
      color.lerp(rim, 0.12 * Math.abs(Math.sin(theta)) ** 8);
      colors.push(color.r, color.g, color.b);
      const a = i * sides + j, b = ((i + 1) % steps) * sides + j;
      const c = ((i + 1) % steps) * sides + (j + 1) % sides;
      const d = i * sides + (j + 1) % sides;
      indices.push(a, c, b, a, d, c);
    }
  }
  root.add(meshFrom(positions, colors, indices, "red-blue-trefoil-band"));
  root.rotation.set(0.27, -0.34, 0.19);
  root.userData = {
    identity: "resolution", equation: "C(t)=((1.48+0.52cos3t)cos2t,(1.48+0.52cos3t)sin2t,0.52sin3t)",
    meaning: "Abstract mathematical interlude; not a company symbol or financial visualization",
  };
  return root;
}

/** Three-dimensional projection (Re z, Re w, Im z) of w²=z over a punctured w-disk. */
export function createNotes() {
  const root = new THREE.Group();
  root.name = "square-root-riemann-projection";
  const positions = [], colors = [], indices = [];
  const rings = 32, sectors = 112;
  const white = new THREE.Color("#f1f5f2"), green = new THREE.Color("#83bd9c"), color = new THREE.Color();
  for (let j = 0; j <= rings; j++) {
    const radius = 0.065 + (j / rings) * 1.285;
    for (let i = 0; i < sectors; i++) {
      const angle = i / sectors * Math.PI * 2;
      const a = radius * Math.cos(angle), b = radius * Math.sin(angle);
      positions.push(a * a - b * b, 1.35 * a, 2 * a * b);
      color.copy(white).lerp(green, 0.06 + 0.16 * (0.5 + 0.5 * Math.sin(angle)) * j / rings);
      colors.push(color.r, color.g, color.b);
      if (j) {
        const here = j * sectors + i, next = j * sectors + (i + 1) % sectors;
        const below = here - sectors, belowNext = next - sectors;
        indices.push(below, belowNext, next, below, next, here);
      }
    }
  }
  root.add(meshFrom(positions, colors, indices, "two-sheet-square-root-projection"));
  root.rotation.set(0.44, -0.58, -0.13);
  root.userData = {
    identity: "notes", equation: "w=a+ib; z=w²=(a²−b²)+2iab; plotted (Re z,1.35 Re w,Im z)",
    meaning: "Projection of a two-sheet square-root Riemann surface, with a small puncture around the branch point",
  };
  return root;
}
