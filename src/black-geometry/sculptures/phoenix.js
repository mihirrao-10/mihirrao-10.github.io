import * as THREE from 'three';

// Original volumetric interpretation of UChicago's phoenix, not official logo
// geometry. UChicago's primary maroon and grays are restored in this revision.
export const PHOENIX_PALETTE = Object.freeze({
  maroon: '#800000', lightGray: '#d6d6ce', gray: '#767676', darkGray: '#4d4d4d', white: '#ffffff',
});
const vector = (point) => new THREE.Vector3(...point);

export function createPhoenix() {
  const phoenix = new THREE.Group();
  phoenix.name = 'Original UChicago phoenix sculpture';
  const materials = Object.fromEntries(Object.entries({ ...PHOENIX_PALETTE, shadow: '#241b1b' }).map(([name, color]) => [name,
    new THREE.MeshStandardMaterial({ color, roughness: 0.59, metalness: 0.22, flatShading: false, side: THREE.DoubleSide }),
  ]));
  function add(parent, name, geometry, color = 'maroon', anatomy = name) {
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, materials[color]);
    mesh.name = name;
    mesh.userData.anatomy = anatomy;
    parent.add(mesh);
    return mesh;
  }
  function volume(parent, name, center, radius, color = 'maroon', segments = 14) {
    const geometry = new THREE.SphereGeometry(1, segments * 2, 20);
    geometry.scale(...radius); geometry.translate(...center);
    return add(parent, name, geometry, color);
  }

  // Closed anatomical lofts for wing bones, beak and talons. Each segment has
  // an elliptical cross-section, so the bird remains physical from the back.
  function loft(parent, name, controls, color, segments = 14, sides = 8, reference = [0, 0, 1]) {
    segments *= 2; sides *= 2;
    const curve = new THREE.CatmullRomCurve3(controls.map(p => vector(p.slice(0, 3))), false, 'catmullrom', 0.25);
    const positions = [], indices = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, center = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
      const ref = vector(reference);
      if (Math.abs(ref.dot(tangent)) > 0.94) ref.set(1, 0, 0);
      const side = new THREE.Vector3().crossVectors(ref, tangent).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, side).normalize();
      const at = Math.min(controls.length - 2, Math.floor(t * (controls.length - 1)));
      const f = t * (controls.length - 1) - at;
      const width = THREE.MathUtils.lerp(controls[at][3], controls[at + 1][3], f);
      const depth = THREE.MathUtils.lerp(controls[at][4] ?? controls[at][3], controls[at + 1][4] ?? controls[at + 1][3], f);
      for (let j = 0; j < sides; j++) {
        const angle = j / sides * Math.PI * 2;
        positions.push(...center.clone().addScaledVector(side, Math.cos(angle) * width).addScaledVector(normal, Math.sin(angle) * depth).toArray());
      }
    }
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + (j + 1) % sides, c = a + sides, d = b + sides;
      indices.push(a, b, d, a, d, c);
    }
    for (let j = 1; j < sides - 1; j++) {
      indices.push(0, j + 1, j);
      const end = segments * sides; indices.push(end, end + j, end + j + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
    return add(parent, name, geometry, color);
  }

  // A feather is a closed, curved, lenticular solid with a raised central vane.
  // The layered pointed silhouettes do the work; there is no bat membrane.
  function feather(parent, name, controls, width, color = 'maroon', depth = 0.048, segments = 9) {
    segments *= 2;
    const curve = new THREE.CatmullRomCurve3(controls.map(vector), false, 'catmullrom', 0.25);
    const positions = [], indices = [], sides = 10;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, center = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), tangent).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, side).normalize();
      const envelope = Math.pow(Math.sin(Math.PI * t), 0.58) * (1.12 - 0.33 * t);
      const w = Math.max(0.003, width * envelope), d = Math.max(0.002, depth * Math.pow(Math.sin(Math.PI * t), 0.45));
      for (let j = 0; j < sides; j++) {
        const angle = j / sides * Math.PI * 2;
        const asymmetry = Math.cos(angle) > 0 ? 1 : 0.84;
        // Shallow oblique vane relief uses the existing surface samples. The
        // tips and lateral silhouette stay fixed; both faces gain feather grain.
        const vane = 1 + 0.14 * Math.sin((t * 4 - Math.abs(Math.cos(angle)) * 0.85) * Math.PI * 2) * Math.sin(Math.PI * t);
        positions.push(...center.clone().addScaledVector(side, Math.cos(angle) * w * asymmetry).addScaledVector(normal, Math.sin(angle) * d * vane).toArray());
      }
    }
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + (j + 1) % sides, c = a + sides, d = b + sides;
      indices.push(a, b, d, a, d, c);
    }
    for (let j = 1; j < sides - 1; j++) { indices.push(0, j + 1, j); const end = segments * sides; indices.push(end, end + j, end + j + 1); }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
    return add(parent, name, geometry, color, 'feather');
  }

  // Five flowing central tail plumes reference a phoenix rising from flame;
  // their shared feather construction keeps them distinct from extra limbs.
  const tail = new THREE.Group(); tail.name = 'Five flowing phoenix tail plumes'; phoenix.add(tail);
  const tailTips = [[-0.98, -2.12, -0.13], [-0.47, -2.58, 0.08], [0.02, -2.82, -0.26], [0.55, -2.56, -0.15], [1.02, -2.07, -0.27]];
  tailTips.forEach((tip, i) => {
    const spread = (i - 2) * 0.13;
    const controls = [[spread, -0.35, -0.16], [spread * 2.8, -1.12, -0.31], [tip[0] * 0.53, tip[1] * 0.78, tip[2] - 0.11], tip];
    feather(tail, `Tail plume ${i + 1}`, controls, i === 2 ? 0.22 : 0.19, i === 1 || i === 3 ? 'gray' : 'maroon', 0.070, 12);
    const curve = new THREE.CatmullRomCurve3(controls.map(vector), false, 'catmullrom', 0.25);
    const shaft = [0.10, 0.35, 0.60, 0.86].map((t, index) => {
      const p = curve.getPoint(t);
      p.z += 0.070 * Math.pow(Math.sin(Math.PI * t), 0.45);
      return [...p.toArray(), 0.010 * (1 - index / 4)];
    });
    loft(tail, `Tail plume shaft ${i + 1}`, shaft, i === 1 || i === 3 ? 'lightGray' : 'darkGray', 6, 5);
  });

  const primaryTips = [[3.20, 1.84, -0.24], [3.25, 1.39, -0.09], [3.13, 0.92, 0.03], [2.96, 0.46, 0.14], [2.68, 0.02, 0.23], [2.36, -0.34, 0.29], [2.04, -0.55, 0.30], [1.69, -0.66, 0.28], [1.32, -0.61, 0.22]];
  for (const sign of [-1, 1]) {
    const wing = new THREE.Group(); wing.name = sign < 0 ? 'Left feathered wing' : 'Right feathered wing'; phoenix.add(wing);
    const mirror = (point, offset = 0) => [point[0] * sign, point[1] + (sign < 0 ? 0.045 : 0), point[2] + offset];
    loft(wing, 'Muscular wing leading edge', [[...mirror([0.28, 0.49, -0.02]), 0.22, 0.22], [...mirror([0.84, 1.00, -0.10]), 0.25, 0.20], [...mirror([1.43, 1.25, -0.16]), 0.20, 0.16], [...mirror([2.00, 1.39, -0.24]), 0.075, 0.065]], 'maroon', 17, 10);
    // Long separated primary feathers fan from the wrist. Grey regions sit
    // among the maroon flight feathers, visible from both sides of the wing.
    primaryTips.forEach((tip, i) => {
      const root = [1.56 - i * 0.115, 1.11 - i * 0.075, -0.02];
      const middle = [root[0] * 0.48 + tip[0] * 0.52, root[1] * 0.50 + tip[1] * 0.50 + 0.10, tip[2] + 0.035];
      const color = [0, 3, 6, 8].includes(i) ? 'maroon' : i % 3 === 1 ? 'lightGray' : 'gray';
      feather(wing, `Primary flight feather ${i + 1}`, [mirror(root), mirror(middle), mirror(tip)], 0.18 + 0.01 * (i < 4), color, 0.065, 12);
      const quillEnd = [middle[0] * 0.25 + tip[0] * 0.75, middle[1] * 0.25 + tip[1] * 0.75, middle[2] * 0.25 + tip[2] * 0.75 + 0.060];
      loft(wing, `Primary feather shaft ${i + 1}`, [[...mirror(root, 0.06), 0.014], [...mirror(middle, 0.06), 0.012], [...mirror(quillEnd), 0.002]], color === 'maroon' ? 'darkGray' : 'white', 7, 5);
    });
    // Upper and lower covert layers are separately modeled on front and back;
    // rotating the artwork exposes real depth and feather overlap.
    for (const back of [false, true]) {
      for (let row = 0; row < 2; row++) for (let i = 0; i < 7; i++) {
        const x = 0.35 + i * 0.22, y = 0.69 + i * 0.082 - row * 0.16;
        const z = back ? -0.28 - row * 0.015 : 0.12 + row * 0.055;
        const end = [x + 0.24 + row * 0.06, y - 0.43 - row * 0.10, z + (back ? -0.04 : 0.07)];
        feather(wing, `${back ? 'Rear' : 'Front'} covert ${row}-${i}`, [mirror([x, y, z]), mirror([x + 0.17, y - 0.14, z + (back ? -0.08 : 0.08)]), mirror(end)], 0.13 + row * 0.01, row === 1 && i > 2 ? (back ? 'darkGray' : 'maroon') : 'maroon', 0.060, 7);
      }
    }
    // Small shoulder feathers break up the body/wing intersection naturally.
    for (let i = 0; i < 4; i++) {
      feather(wing, `Shoulder scapular ${i}`, [mirror([0.24, 0.60 - i * 0.1, 0.28]), mirror([0.50, 0.68 - i * 0.11, 0.32]), mirror([0.80, 0.54 - i * 0.13, 0.20])], 0.13, i === 0 ? 'gray' : 'maroon', 0.06, 7);
    }
  }

  volume(phoenix, 'Deep oval avian torso', [0, 0.15, 0.04], [0.48, 0.78, 0.41], 'maroon', 18);
  volume(phoenix, 'Feathered upper breast', [0, 0.65, 0.16], [0.35, 0.42, 0.33], 'maroon', 16);
  volume(phoenix, 'Back and rump', [0, -0.25, -0.18], [0.37, 0.46, 0.32], 'maroon', 14);
  // The light throat recalls Phil's pale ruff without copying the costume.
  for (let row = 0; row < 3; row++) for (let i = -1; i <= 1; i++) {
    const x = i * (0.11 + row * 0.022), y = 0.88 - row * 0.15;
    feather(phoenix, `Pale throat feather ${row}-${i}`, [[x, y, 0.51], [x * 1.22, y - 0.15, 0.58], [x * 1.40, y - 0.32, 0.52]], 0.10, row === 0 ? 'white' : 'lightGray', 0.036, 7);
  }
  for (const back of [false, true]) for (let row = 0; row < 3; row++) for (let i = -1; i <= 1; i++) {
    const x = i * 0.17, y = 0.21 - row * 0.20, z = back ? -0.40 : 0.40;
    feather(phoenix, `${back ? 'Back' : 'Breast'} body feather ${row}-${i}`, [[x, y, z], [x * 1.15, y - 0.12, z + (back ? -0.02 : 0.025)], [x * 1.08, y - 0.31, z - (back ? -0.04 : 0.04)]], 0.125, 'maroon', 0.035, 6);
  }

  const head = new THREE.Group(); head.name = 'Turned avian head and hooked beak';
  head.position.set(0, 0.92, 0.22); head.rotation.y = -0.42; phoenix.add(head);
  volume(head, 'Compact bird skull', [0, 0.31, 0.12], [0.28, 0.32, 0.34], 'maroon', 16);
  volume(head, 'Nape', [0, 0.06, -0.04], [0.25, 0.31, 0.26], 'maroon', 14);
  loft(head, 'Upper hooked silver beak', [[0, 0.30, 0.35, 0.13, 0.16], [0, 0.30, 0.52, 0.12, 0.14], [0, 0.24, 0.71, 0.085, 0.080], [0, 0.09, 0.75, 0.020, 0.012]], 'lightGray', 10, 6, [1, 0, 0]);
  loft(head, 'Lower beak with narrow mouth seam', [[0, 0.115, 0.36, 0.045, 0.12], [0, 0.10, 0.56, 0.040, 0.08], [0, 0.14, 0.66, 0.012, 0.015]], 'darkGray', 7, 6, [1, 0, 0]);
  for (const sign of [-1, 1]) {
    const naris = new THREE.SphereGeometry(1, 10, 6);
    naris.scale(0.010, 0.020, 0.040); naris.translate(sign * 0.142, 0.315, 0.485);
    add(head, `Beak naris ${sign}`, naris, 'shadow');
    volume(head, 'Almond eye socket', [sign * 0.225, 0.36, 0.285], [0.018, 0.070, 0.095], 'shadow', 10);
    volume(head, 'Small pale eye', [sign * 0.244, 0.364, 0.302], [0.010, 0.025, 0.028], 'white', 8);
    loft(head, 'Sculpted brow ridge', [[sign * 0.235, 0.39, 0.37, 0.035], [sign * 0.262, 0.445, 0.24, 0.041], [sign * 0.20, 0.43, 0.12, 0.013]], 'maroon', 7, 6);
    for (let i = 0; i < 3; i++) feather(head, `Swept cheek feather ${sign}-${i}`, [[sign * 0.17, 0.19 - i * 0.055, 0.12], [sign * 0.29, 0.14 - i * 0.08, 0.02], [sign * 0.33, 0.03 - i * 0.10, -0.16]], 0.075, i === 1 ? 'gray' : 'maroon', 0.04, 6);
  }
  // A low swept feather crest, never horns: vanes remain broad and attached.
  for (let i = -1; i <= 1; i++) feather(head, `Low crown feather ${i}`, [[i * 0.10, 0.52, 0.14], [i * 0.15, 0.64, -0.01], [i * 0.19, 0.53, -0.27]], 0.095, 'maroon', 0.045, 7);

  for (const sign of [-1, 1]) {
    const leg = new THREE.Group(); leg.name = sign < 0 ? 'Left tucked avian foot' : 'Right tucked avian foot'; phoenix.add(leg);
    loft(leg, 'Tucked feathered thigh', [[sign * 0.24, -0.41, 0.17, 0.13], [sign * 0.29, -0.69, 0.29, 0.10], [sign * 0.25, -0.85, 0.38, 0.055]], 'maroon', 9, 7);
    loft(leg, 'Short scaled tarsus', [[sign * 0.25, -0.82, 0.38, 0.050], [sign * 0.29, -0.99, 0.49, 0.040]], 'darkGray', 5, 6);
    for (let i = -1; i <= 1; i++) {
      const x = sign * 0.29 + i * 0.075;
      loft(leg, `Curled forward talon ${i}`, [[x, -0.97, 0.49, 0.025], [x + i * 0.055, -1.05, 0.65, 0.022], [x + i * 0.07, -1.15, 0.69, 0.003]], 'lightGray', 7, 5);
    }
  }

  phoenix.rotation.y = -0.10;
  phoenix.userData = {
    sculpture: 'phoenix', mascot: 'Phoenix (Phil the Phoenix)', palette: PHOENIX_PALETTE,
    source: 'Original 3D sculpture inspired by University of Chicago mascot and phoenix identity references; not official institutional artwork',
    presentation: { front: '+Z', up: '+Y', headTurn: -0.42 },
    anatomy: { wings: 2, primaryFeathersPerWing: 9, tailPlumes: 5, feet: 2 },
  };
  phoenix.updateMatrixWorld(true);
  return phoenix;
}
