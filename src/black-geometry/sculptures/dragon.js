import * as THREE from 'three';

// Original faceted dragon; visual references and color provenance are recorded in
// docs/black-geometry/revision-dragon-provenance.md. This is not official artwork.
const BLUE = '#07294D';
const GOLD = '#FFC600';
const V = (p) => new THREE.Vector3(...p);

/**
 * The finished pose is authored for a +Z camera, +Y up, facing screen-left.
 * Everything is a BufferGeometry mesh, so the assembly can be baked into a
 * shared surface representation without special-case line or sprite assets.
 */
export function createDragon() {
  const dragon = new THREE.Group();
  dragon.name = 'Original Drexel-inspired dragon';
  const materials = {
    body: new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.57, metalness: 0.35, flatShading: false, side: THREE.DoubleSide }),
    litBlue: new THREE.MeshStandardMaterial({ color: '#1165a5', roughness: 0.57, metalness: 0.3, flatShading: false, side: THREE.DoubleSide }),
    blueRidge: new THREE.MeshStandardMaterial({ color: '#178ccc', roughness: 0.57, metalness: 0.3, flatShading: false, side: THREE.DoubleSide }),
    gold: new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.49, metalness: 0.48, flatShading: false, side: THREE.DoubleSide }),
    oldGold: new THREE.MeshStandardMaterial({ color: '#ed9e16', roughness: 0.55, metalness: 0.4, flatShading: false, side: THREE.DoubleSide }),
    paleGold: new THREE.MeshStandardMaterial({ color: '#FAD774', roughness: 0.43, metalness: 0.4, flatShading: false, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: '#020D1C', roughness: 0.8, metalness: 0.1, flatShading: false, side: THREE.DoubleSide }),
  };

  function add(name, geometry, material = materials.body) {
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    dragon.add(mesh);
    return mesh;
  }

  function triangles(name, points, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(2), 3));
    return add(name, geometry, material);
  }

  // Anatomical lofts use independently varying elliptical cross-sections. The
  // rings follow the centerline instead of piling spheres along a tube.
  function loft(name, controls, { rings = 20, sides = 12, material = materials.body, rib = 0 } = {}) {
    rings *= 2; sides *= 2;
    const curve = new THREE.CatmullRomCurve3(controls.map((p) => V(p.slice(0, 3))), false, 'catmullrom', 0.35);
    const vertices = [];
    const indices = [];
    for (let i = 0; i <= rings; i += 1) {
      const t = i / rings;
      const p = curve.getPoint(t);
      const tangent = curve.getTangent(t).normalize();
      const lateral = new THREE.Vector3(0, 0, 1);
      if (Math.abs(tangent.dot(lateral)) > 0.96) lateral.set(1, 0, 0);
      const normal = new THREE.Vector3().crossVectors(lateral, tangent).normalize();
      lateral.crossVectors(tangent, normal).normalize();
      const index = Math.min(controls.length - 2, Math.floor(t * (controls.length - 1)));
      const f = t * (controls.length - 1) - index;
      const ry = THREE.MathUtils.lerp(controls[index][3], controls[index + 1][3], f);
      const rz = THREE.MathUtils.lerp(controls[index][4] ?? controls[index][3], controls[index + 1][4] ?? controls[index + 1][3], f);
      for (let j = 0; j < sides; j += 1) {
        const angle = (j / sides) * Math.PI * 2;
        const corrugation = 1 + rib * Math.cos(i * Math.PI);
        const q = p.clone().addScaledVector(normal, Math.cos(angle) * ry * corrugation).addScaledVector(lateral, Math.sin(angle) * rz * corrugation);
        vertices.push(q.x, q.y, q.z);
      }
    }
    for (let i = 0; i < rings; i += 1) {
      for (let j = 0; j < sides; j += 1) {
        const a = i * sides + j;
        const b = i * sides + (j + 1) % sides;
        const c = (i + 1) * sides + j;
        const d = (i + 1) * sides + (j + 1) % sides;
        if ((i + j) % 2) indices.push(a, b, c, b, d, c);
        else indices.push(a, b, d, a, d, c);
      }
    }
    for (let j = 1; j < sides - 1; j += 1) {
      indices.push(0, j + 1, j);
      const end = rings * sides;
      indices.push(end, end + j, end + j + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    return add(name, geometry, material);
  }

  function rib(name, controls, radius, material = materials.gold, rings = 9) {
    return loft(name, controls.map((p, i) => [...p, radius * (1 - 0.6 * i / (controls.length - 1))]), { rings, sides: 6, material });
  }

  // Beveled angular plates retain a sculpted outline instead of a flat polygon.
  function plate(name, outline, depth, material, bevel = 0.78) {
    const center = outline.reduce((a, p) => a.add(V(p)), new THREE.Vector3()).multiplyScalar(1 / outline.length);
    const front = outline.map((p) => V(p).lerp(center, 1 - bevel).add(new THREE.Vector3(0, 0, depth)));
    const back = outline.map((p) => V(p).add(new THREE.Vector3(0, 0, -depth * 0.6)));
    const points = [];
    for (let j = 0; j < outline.length; j += 1) {
      const k = (j + 1) % outline.length;
      points.push(center.clone().add(new THREE.Vector3(0, 0, depth * 1.05)).toArray(), front[j].toArray(), front[k].toArray());
      points.push(front[j].toArray(), back[j].toArray(), back[k].toArray(), front[j].toArray(), back[k].toArray(), front[k].toArray());
      points.push(center.clone().add(new THREE.Vector3(0, 0, -depth * 0.6)).toArray(), back[k].toArray(), back[j].toArray());
    }
    return triangles(name, points, material);
  }

  // Rear wing first: a distinct raised fan behind the front wing and neck.
  function wing(name, root, wrist, tips, front) {
    const O = V(wrist);
    const R = V(root);
    rib(`${name} upper arm`, [root, [root[0] - 0.04, root[1] + 0.61, root[2]], wrist], 0.13, front ? materials.litBlue : materials.body, 12);
    const rim = [R, ...tips.map(V)];
    // Finger-bounded membrane panels have scalloped trailing edges and a
    // tensioned, curved surface. Their light-catching folds are actual depth.
    for (let section = 0; section < rim.length - 1; section += 1) {
      const A = rim[section];
      const B = rim[section + 1];
      const subdivisions = 14;
      const rows = 14;
      const pos = [];
      const colors = [];
      const indices = [];
      for (let i = 0; i <= rows; i += 1) {
        const r = i / rows;
        for (let j = 0; j <= subdivisions; j += 1) {
          const u = j / subdivisions;
          const edge = A.clone().lerp(B, u);
          edge.lerp(O, Math.sin(u * Math.PI) * (section === 0 ? 0.11 : 0.23));
          const point = O.clone().lerp(edge, r);
          point.z += Math.sin(u * Math.PI) * Math.sin(r * Math.PI) * (front ? 0.26 : -0.18);
          pos.push(...point.toArray());
          const border = r > 0.84 || u < 0.04 || u > 0.96;
          const color = new THREE.Color(border ? '#155486' : front ? GOLD : '#AC871E');
          if (!border) color.multiplyScalar(0.62 + 0.38 * Math.sin(u * Math.PI));
          colors.push(color.r, color.g, color.b);
        }
      }
      for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < subdivisions; j += 1) {
          const a = i * (subdivisions + 1) + j;
          const b = a + subdivisions + 1;
          if (i > 0) indices.push(a, b, a + 1);
          indices.push(a + 1, b, b + 1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      add(`${name} tensioned membrane ${section + 1}`, geometry, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.57, metalness: 0.32, side: THREE.DoubleSide, flatShading: false }));
      const middle = A.clone().lerp(B, 0.5).lerp(O, section === 0 ? 0.11 : 0.23);
      rib(`${name} scalloped edge ${section + 1}`, [A.toArray(), middle.toArray(), B.toArray()], 0.035, front ? materials.blueRidge : materials.oldGold, 9);
    }
    tips.forEach((tip, i) => {
      const middle = O.clone().lerp(V(tip), 0.52);
      middle.z += front ? 0.11 : -0.08;
      rib(`${name} articulated finger ${i + 1}`, [wrist, middle.toArray(), tip], i === tips.length - 1 ? 0.058 : 0.041, materials.paleGold, 9);
    });
    loft(`${name} wrist claw`, [[...wrist, 0.085], [wrist[0] - 0.14, wrist[1] + 0.20, wrist[2] + 0.02, 0.06], [wrist[0] - 0.28, wrist[1] + 0.17, wrist[2] + 0.07, 0.002]], { rings: 6, sides: 6, material: materials.gold });
  }

  wing('Far wing', [-0.18, 0.42, -0.30], [-0.03, 1.66, -0.50], [
    [0.53, 0.12, -0.90], [1.25, 0.88, -1.05], [1.15, 1.88, -0.91], [0.67, 2.90, -0.70],
  ], false);

  // The torso has a pronounced breast, compact shoulder, narrow waist and
  // separate haunch. Cross-section scale creates an anatomical S-curve.
  loft('Continuous chest and neck', [
    [0.94, -0.53, -0.04, 0.13, 0.18], [0.62, -0.37, 0, 0.57, 0.44],
    [0.05, -0.20, 0.04, 0.64, 0.48], [-0.50, 0.04, 0.08, 0.52, 0.40],
    [-0.91, 0.46, 0.12, 0.32, 0.29], [-1.01, 0.96, 0.13, 0.24, 0.23],
    [-1.16, 1.48, 0.15, 0.24, 0.23], [-1.42, 1.73, 0.17, 0.26, 0.26],
  ], { rings: 34, sides: 14 });

  loft('Long articulated tail', [
    [0.59, -0.44, -0.15, 0.38, 0.35], [1.15, -0.61, -0.18, 0.33, 0.30],
    [1.75, -0.86, -0.12, 0.25, 0.24], [2.32, -0.78, 0.04, 0.19, 0.19],
    [2.73, -0.43, 0.20, 0.135, 0.13], [2.88, 0.13, 0.29, 0.090, 0.085],
    [2.88, 0.60, 0.30, 0.055, 0.05], [2.62, 0.82, 0.31, 0.002, 0.002],
  ], { rings: 36, sides: 10, rib: 0.025 });

  // Far-side limbs are displaced enough to keep four readable claw forms.
  const limb = (name, controls, material = materials.body) => loft(name, controls, { rings: 13, sides: 10, material });
  limb('Far hind leg', [[0.72, -0.55, -0.36, 0.30], [1.06, -1.02, -0.43, 0.23], [0.91, -1.40, -0.43, 0.12], [1.28, -1.74, -0.40, 0.13], [1.49, -1.78, -0.37, 0.07]]);
  limb('Far foreleg', [[-0.70, 0.15, -0.15, 0.18], [-1.15, -0.22, -0.34, 0.14], [-1.52, 0.12, -0.30, 0.105], [-1.56, 0.43, -0.26, 0.06]]);
  limb('Near powerful haunch', [[0.54, -0.36, 0.30, 0.22, 0.23], [0.62, -0.81, 0.45, 0.31, 0.25], [0.14, -1.20, 0.54, 0.17, 0.15], [0.25, -1.67, 0.60, 0.105, 0.11], [-0.22, -1.87, 0.65, 0.085, 0.17]], materials.litBlue);
  limb('Near lowered foreleg', [[-0.65, 0.18, 0.26, 0.22], [-0.94, -0.29, 0.41, 0.19], [-0.99, -0.67, 0.48, 0.12], [-1.39, -1.22, 0.53, 0.075], [-1.66, -1.33, 0.54, 0.085]], materials.litBlue);

  function claws(name, center, direction, width, scale = 1) {
    for (let i = 0; i < 3; i += 1) {
      const z = center[2] + (i - 1) * width;
      const side = (i - 1) * 0.085;
      const reach = i === 1 ? 1.17 : i === 0 ? 0.85 : 1;
      loft(`${name} toe ${i + 1}`, [[center[0] + 0.09, center[1] + side * 0.3, z, 0.054 * scale], [center[0] + direction * 0.15 * reach, center[1] - 0.04 + side, z + 0.035, 0.045 * scale], [center[0] + direction * 0.27 * reach, center[1] - 0.10 + side * 1.5, z + 0.06, 0.030 * scale]], { rings: 4, sides: 6, material: materials.litBlue });
      loft(`${name} claw ${i + 1}`, [[center[0] + direction * 0.24 * reach, center[1] - 0.08 + side * 1.5, z + 0.055, 0.034 * scale], [center[0] + direction * 0.36 * reach, center[1] - 0.13 + side * 1.6, z + 0.07, 0.024 * scale], [center[0] + direction * 0.41 * reach, center[1] - 0.21 + side * 1.7, z + 0.075, 0.002]], { rings: 5, sides: 6, material: materials.paleGold });
    }
  }
  claws('Near hind foot', [-0.20, -1.83, 0.66], -1, 0.14, 1.1);
  claws('Far hind foot', [1.42, -1.74, -0.32], -1, 0.13, 0.9);
  claws('Near forefoot', [-1.55, -1.29, 0.54], -1, 0.105, 0.83);
  // Raised paw uses the same curved claw construction rotated at the wrist.
  for (let i = 0; i < 3; i += 1) {
    loft(`Raised foreclaw ${i + 1}`, [[-1.56, 0.35, -0.36 + i * 0.10, 0.043], [-1.61, 0.55, -0.36 + i * 0.10, 0.044], [-1.78, 0.59, -0.32 + i * 0.10, 0.030], [-1.85, 0.48, -0.30 + i * 0.10, 0.002]], { rings: 7, sides: 6, material: materials.gold });
  }

  // Skull and open, separately authored jaw. The forehead, raised nasal bridge,
  // cheekbone and two jaw silhouettes remain legible at thumbnail size.
  loft('Angular skull and long snout', [
    [-1.03, 1.68, 0.16, 0.19, 0.21], [-1.29, 1.88, 0.19, 0.27, 0.23],
    [-1.59, 1.99, 0.22, 0.22, 0.21], [-1.85, 1.94, 0.24, 0.13, 0.18],
    [-2.15, 1.96, 0.25, 0.10, 0.17], [-2.38, 1.98, 0.25, 0.10, 0.145],
    [-2.55, 1.95, 0.25, 0.045, 0.10],
  ], { rings: 14, sides: 8, material: materials.litBlue });
  plate('Separated lower jaw', [[-1.30, 1.72, 0.20], [-1.56, 1.67, 0.20], [-2.23, 1.61, 0.20], [-2.52, 1.72, 0.20], [-2.33, 1.51, 0.20], [-1.71, 1.46, 0.20], [-1.33, 1.54, 0.20]], 0.13, materials.body, 0.84);
  plate('Sculpted near cheekbone', [[-1.17, 1.90, 0.39], [-1.47, 1.92, 0.47], [-1.76, 1.64, 0.43], [-1.39, 1.54, 0.40]], 0.08, materials.blueRidge);
  plate('Angular eye socket', [[-1.76, 2.10, 0.452], [-1.59, 2.16, 0.465], [-1.42, 2.05, 0.47], [-1.63, 1.98, 0.47]], 0.012, materials.dark);
  plate('Gold slit eye', [[-1.65, 2.10, 0.488], [-1.59, 2.075, 0.494], [-1.64, 2.055, 0.49], [-1.68, 2.075, 0.49]], 0.008, materials.oldGold);
  rib('Heavy sculpted brow', [[-1.85, 2.105, 0.42], [-1.67, 2.22, 0.43], [-1.44, 2.17, 0.40]], 0.060, materials.blueRidge, 7);
  plate('Near nostril recess', [[-2.43, 2.01, 0.358], [-2.31, 2.03, 0.380], [-2.37, 1.96, 0.385], [-2.48, 1.97, 0.34]], 0.006, materials.dark);
  // A restrained set of separated teeth gives the open mouth a clear scale.
  for (let i = 0; i < 6; i += 1) {
    const x = [-2.36, -2.23, -2.10, -1.97, -1.82, -1.68][i];
    const y = 1.84 - Math.sin(i / 5 * Math.PI) * 0.035;
    const fang = [0.065, 0.12, 0.035, 0.052, 0.105, 0.042][i];
    loft(`Upper tooth ${i + 1}`, [[x, y, 0.365, i === 1 || i === 4 ? 0.027 : 0.016], [x + 0.036, y - fang, 0.375, 0.001]], { rings: 2, sides: 5, material: materials.paleGold });
    if (i < 3) loft(`Lower tooth ${i + 1}`, [[x + 0.05, 1.65 - i * 0.018, 0.345, 0.016], [x + 0.018, 1.69 - i * 0.019, 0.345, 0.001]], { rings: 2, sides: 5, material: materials.oldGold });
  }
  loft('Near swept crown horn', [[-1.26, 2.10, 0.32, 0.12], [-1.07, 2.42, 0.30, 0.105], [-0.78, 2.60, 0.20, 0.06], [-0.59, 2.57, 0.14, 0.002]], { rings: 10, sides: 7, material: materials.gold });
  loft('Far swept crown horn', [[-1.52, 2.16, -0.01, 0.105], [-1.43, 2.42, -0.06, 0.075], [-1.15, 2.59, -0.08, 0.003]], { rings: 8, sides: 7, material: materials.oldGold });
  loft('Back cheek horn', [[-1.17, 1.75, 0.39, 0.10], [-0.94, 1.87, 0.54, 0.05], [-0.80, 2.01, 0.58, 0.002]], { rings: 7, sides: 6, material: materials.gold });
  loft('Small chin barb', [[-1.59, 1.50, 0.22, 0.065], [-1.47, 1.35, 0.24, 0.035], [-1.33, 1.40, 0.21, 0.002]], { rings: 6, sides: 6, material: materials.oldGold });

  // Shorter skull proportion and a thin, tapered muzzle avoid the broad mascot
  // head. The eyes, cheeks and crown share the authored anatomical transform.
  const headNames = /skull|lower jaw|cheekbone|eye|brow|nostril|tooth|crown horn|cheek horn|chin barb/;
  const headPivot = new THREE.Vector3(-1.15, 1.72, 0.16);
  for (const mesh of dragon.children) {
    if (!headNames.test(mesh.name)) continue;
    mesh.geometry.translate(-headPivot.x, -headPivot.y, -headPivot.z);
    mesh.geometry.scale(0.86, 0.86, 0.86);
    mesh.geometry.translate(headPivot.x, headPivot.y, headPivot.z);
  }

  // Individual armor plates pick out the ventral curve and the exposed flank.
  for (let i = 0; i < 8; i += 1) {
    const t = i / 7;
    const x = -1.05 + 0.73 * t * t;
    const y = 1.31 - 1.72 * t;
    const z = 0.28 + 0.17 * t;
    const w = 0.115 + 0.14 * t;
    plate(`Ventral armor ${i + 1}`, [[x - w, y + 0.10, z], [x + w * 0.70, y + 0.06, z + 0.09], [x + w, y - 0.10, z + 0.04], [x - w * 0.65, y - 0.14, z]], 0.035, i % 3 === 0 ? materials.gold : materials.oldGold, 0.87);
  }
  for (let row = 0; row < 3; row += 1) {
    for (let i = 0; i < 5; i += 1) {
      const x = -0.41 + i * 0.21 + row * 0.07;
      const y = 0.09 - row * 0.17;
      const z = 0.40 + 0.08 * Math.sin(i / 4 * Math.PI) - row * 0.012;
      plate(`Faceted flank scute ${row}-${i}`, [[x - 0.10, y, z], [x, y + 0.12, z], [x + 0.14, y, z], [x + 0.01, y - 0.10, z]], 0.035, (row + i) % 4 === 0 ? materials.blueRidge : materials.litBlue, 0.87);
    }
  }

  const crest = [
    [-1.00, 1.91, 0.04, 0.30], [-0.86, 1.60, 0.02, 0.28], [-0.72, 1.27, 0.01, 0.25],
    [-0.62, 0.94, -0.02, 0.23], [-0.44, 0.63, -0.03, 0.22], [0.03, 0.40, -0.08, 0.21],
    [0.54, 0.19, -0.15, 0.20], [1.01, -0.20, -0.17, 0.23], [1.39, -0.35, -0.09, 0.22],
    [1.78, -0.62, 0.04, 0.22], [2.18, -0.57, 0.17, 0.20], [2.49, -0.34, 0.27, 0.16],
    [2.66, 0.02, 0.34, 0.12], [2.68, 0.36, 0.36, 0.09],
  ];
  crest.forEach(([x, y, z, h], i) => {
    plate(`Dorsal crest ${i + 1}`, [[x - 0.10, y - 0.09, z], [x + 0.08, y + h, z], [x + 0.20, y + h * 0.82, z], [x + 0.15, y - 0.06, z]], 0.055, i % 3 === 2 ? materials.oldGold : materials.gold, 0.87);
  });

  wing('Near wing', [-0.14, 0.34, 0.28], [0.72, 1.92, 0.39], [
    [0.66, -0.04, 0.58], [1.62, 0.11, 0.78], [2.24, 0.94, 0.81], [2.50, 1.82, 0.65], [2.56, 2.73, 0.42],
  ], true);

  dragon.userData = {
    source: 'Original procedural sculpture, inspired by Drexel dragon references; not official institutional artwork',
    palette: { navy: BLUE, gold: GOLD },
    presentation: { front: '+Z', up: '+Y', facing: '-X', rotationY: -0.08, rotationX: 0.015 },
    anchors: { head: [-1.8, 1.95, 0.25], heart: [-0.40, 0.05, 0.10], wing: [0.72, 1.92, 0.39], tail: [2.88, 0.13, 0.29] },
  };
  return dragon;
}
