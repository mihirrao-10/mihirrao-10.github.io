import * as THREE from 'three';

function sculpture(geometry, name, rotation) {
  const position = geometry.getAttribute('position'), colors = [];
  for (let i = 0; i < position.count; i++) {
    const tone = .4 + .11 * Math.sin(position.getX(i) * 1.3 + position.getZ(i));
    colors.push(tone, tone, tone);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const root = new THREE.Group();
  root.name = name;
  root.rotation.set(...rotation);
  root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: .45,
  })));
  return root;
}

// A closed tubular knot, with generous gaps between the crossings.
export function createEducation() {
  return sculpture(new THREE.TorusKnotGeometry(1.5, .29, 288, 64, 2, 3),
    'looped-knot', [.5, -.3, .2]);
}

function parametricSurface(point, { steps = 240, sides = 96, reflected = false } = {}) {
  const positions = [], indices = [];
  const columns = reflected ? sides + 1 : sides;
  for (let i = 0; i < steps; i++) for (let j = 0; j < columns; j++) {
    positions.push(...point(i / steps * Math.PI * 2, j / sides));
    const next = column => i + 1 < steps ? (i + 1) * columns + column
      : reflected ? sides - column : column;
    if (reflected && j === sides) continue;
    const k = (j + 1) % columns;
    const a = i * columns + j, b = next(j), c = next(k), d = i * columns + k;
    indices.push(a, b, c, a, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

// Authored corrugations move the ring's centerline and vary its tube radius.
export function createExperience() {
  const geometry = parametricSurface((u, t) => {
    const v = t * Math.PI * 2;
    const tube = .48 + .13 * Math.cos(3 * u);
    const radial = 1.65 + .25 * Math.cos(3 * u) + tube * Math.cos(v);
    return [radial * Math.cos(u), radial * Math.sin(u), tube * Math.sin(v) + .4 * Math.sin(3 * u)];
  });
  return sculpture(geometry, 'folded-ring', [.9, .2, -.3]);
}

// Reflect the end seam to close a ribbon with three half-twists.
export function createProjects() {
  const geometry = parametricSurface((u, t) => {
    const v = (2 * t - 1) * .75, radial = 1.7 + v * Math.cos(1.5 * u);
    return [radial * Math.cos(u), radial * Math.sin(u), v * Math.sin(1.5 * u)];
  }, { reflected: true });
  return sculpture(geometry, 'three-twist-ribbon', [.8, -.25, .2]);
}
