import * as THREE from "three";

// Original, deliberately simplified Harper Memorial Library sculpture.
// The south elevation and its unlike tower crowns were studied in UChicago's
// official architectural illustration and exterior/tower photographs.
// See docs/black-geometry/revision-harper-provenance.md. No image or model asset
// is copied into the experience. +Y is up; the principal facade faces +Z.

const COLORS = {
  stone: 0x800000,
  molding: 0xa13e3c,
  tracer: 0xbb7062,
  recess: 0x210d14,
  roof: 0x531b21,
  darkStone: 0x651d24,
};

function polygon(points, Shape = THREE.Shape) {
  const path = new Shape();
  path.moveTo(...points[0]);
  for (const point of points.slice(1)) path.lineTo(...point);
  path.closePath();
  return path;
}

function rectangle(width, height) {
  return [
    [-width / 2, 0],
    [width / 2, 0],
    [width / 2, height],
    [-width / 2, height],
  ];
}

// Two quadratic arcs meet at a point. These are actual wall openings and
// extruded archivolts, rather than window decals on solid boxes.
function lancet(width, height) {
  const radius = width / 2;
  const rise = Math.min(height * 0.47, width * 0.64);
  const spring = height - rise;
  const points = [[-radius, 0], [radius, 0], [radius, spring]];
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    const inverse = 1 - t;
    points.push([
      radius * (inverse * inverse + 1.68 * inverse * t),
      spring + rise * (1.24 * inverse * t + t * t),
    ]);
  }
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    const inverse = 1 - t;
    points.push([
      -radius * (1.68 * inverse * t + t * t),
      spring + rise * (inverse * inverse + 1.24 * inverse * t),
    ]);
  }
  return points;
}

function extrude(shape, depth) {
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 5,
  });
}

export function createHarper() {
  const root = new THREE.Group();
  root.name = "Harper Memorial Library — original architectural sculpture";
  const materials = Object.fromEntries(
    Object.entries(COLORS).map(([name, color]) => [
      name,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.76,
        metalness: 0.14,
        side: THREE.DoubleSide,
      }),
    ]),
  );

  function mesh(parent, geometry, material = "stone", position = [0, 0, 0]) {
    const object = new THREE.Mesh(geometry, materials[material]);
    object.position.fromArray(position);
    parent.add(object);
    return object;
  }
  function box(parent, width, height, depth, x, y, z, material = "stone") {
    return mesh(parent, new THREE.BoxGeometry(width, height, depth), material, [x, y, z]);
  }
  function ribbon(parent, outerPoints, innerPoints, x, y, z, material = "molding", depth = 0.038) {
    const shape = polygon(outerPoints);
    shape.holes.push(polygon(innerPoints, THREE.Path));
    // Raised face ribbons retain the arches without invisible back/side faces;
    // the structural wall reveals beneath them supply their modeled depth.
    return mesh(parent, new THREE.ShapeGeometry(shape), material, [x, y, z + depth]);
  }
  function windowDetail(parent, spec) {
    const { x, y, w, h, arch = true, fine = false } = spec;
    const contour = arch ? lancet : rectangle;
    const points = contour(w, h);
    mesh(parent, new THREE.ShapeGeometry(polygon(points)), "recess", [x, y, -0.115]);
    const rim = arch ? 0.04 : 0.028;
    ribbon(parent,
      contour(w + rim * 2, h + rim * 2).map(([u, v]) => [u, v - rim]),
      points, x, y, 0.012, "molding", 0.045);
    const bar = fine ? 0.013 : 0.019;
    const spring = arch ? h - Math.min(h * 0.47, w * 0.64) : h;
    box(parent, bar, arch ? h * 0.89 : h, 0.04, x, y + (arch ? h * 0.445 : h / 2), -0.01, "tracer");
    box(parent, w, bar, 0.042, x, y + h * 0.38, -0.01, "molding");
    if (arch && !fine) {
      // Paired tracery lights sit under the main pointed arch.
      for (const side of [-1, 1]) {
        const innerW = w * 0.46;
        const innerH = Math.min(w * 0.46, h * 0.29);
        const outer = lancet(innerW, innerH);
        const inner = lancet(innerW - 0.025, innerH - 0.021).map(([u, v]) => [u, v + 0.006]);
        ribbon(parent, outer, inner, x + side * w * 0.245, y + spring - innerH * 0.23, -0.014, "tracer", 0.027);
      }
      for (const side of [-1, 1]) {
        box(parent, 0.014, spring, 0.033, x + side * w * 0.255, y + spring / 2, -0.017, "molding");
      }
    }
    box(parent, w + rim * 3, 0.043, 0.105, x, y - rim * 0.6, 0.025, "molding");
  }

  function facade(parent, width, height, windows, x, z, angle = 0) {
    const wall = new THREE.Group();
    wall.position.set(x, 0, z);
    wall.rotation.y = angle;
    parent.add(wall);
    const shape = polygon(rectangle(width, height));
    for (const spec of windows) {
      const points = (spec.arch === false ? rectangle : lancet)(spec.w, spec.h);
      shape.holes.push(polygon(points.map(([u, v]) => [u + spec.x, v + spec.y]), THREE.Path));
    }
    mesh(wall, extrude(shape, 0.13), "stone", [0, 0, -0.13]);
    for (const spec of windows) windowDetail(wall, spec);
    return wall;
  }

  function cornice(parent, width, depth, y, x = 0, z = 0) {
    box(parent, width + 0.055, 0.048, depth + 0.055, x, y - 0.035, z, "darkStone");
    box(parent, width + 0.11, 0.061, depth + 0.11, x, y + 0.019, z, "molding");
  }

  function parapet(parent, width, z, base, x = 0, count = 9) {
    box(parent, width, 0.16, 0.115, x, base + 0.08, z, "stone");
    box(parent, width + 0.035, 0.043, 0.155, x, base + 0.17, z, "molding");
    for (let i = 0; i < count; i++) {
      const px = x - width / 2 + (i + 0.5) * width / count;
      box(parent, width / count * 0.49, 0.145, 0.13, px, base + 0.225, z, "stone");
      box(parent, width / count * 0.52, 0.035, 0.16, px, base + 0.304, z, "molding");
    }
  }

  function buttress(parent, x, z, height, slender = false) {
    const width = slender ? 0.11 : 0.16;
    const projection = slender ? 0.11 : 0.22;
    box(parent, width + 0.065, height * 0.35, projection + 0.08, x, height * 0.175, z + projection * 0.36);
    box(parent, width + 0.028, height * 0.34, projection + 0.02, x, height * 0.52, z + projection * 0.27);
    box(parent, width, height * 0.32, projection, x, height * 0.84, z + projection * 0.21);
    for (const y of [height * 0.35, height * 0.69, height]) {
      box(parent, width + 0.075, 0.046, projection + 0.075, x, y, z + projection * 0.28, "molding");
    }
  }

  function pinnacle(parent, x, y, z, height = 0.56) {
    box(parent, 0.083, height * 0.54, 0.083, x, y + height * 0.27, z, "molding");
    mesh(parent, new THREE.ConeGeometry(0.071, height * 0.44, 4), "molding", [x, y + height * 0.73, z]);
    mesh(parent, new THREE.OctahedronGeometry(0.035), "tracer", [x, y + height * 0.89, z]);
  }

  function turret(parent, x, z, west) {
    const shaftBottom = 3.84;
    const radius = 0.145;
    const shaftHeight = 0.64;
    mesh(parent, new THREE.CylinderGeometry(radius, radius * 1.07, shaftHeight, 8), "stone", [x, shaftBottom + shaftHeight / 2, z]);
    for (const y of [shaftBottom + 0.03, shaftBottom + 0.56]) {
      mesh(parent, new THREE.CylinderGeometry(radius * 1.18, radius * 1.18, 0.065, 8), "molding", [x, y, z]);
    }
    // The tall dark slit and its pointed hood make these lantern turrets.
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const detail = new THREE.Group();
      detail.position.set(x + Math.sin(angle) * radius * 0.955, shaftBottom + 0.14, z + Math.cos(angle) * radius * 0.955);
      detail.rotation.y = angle;
      parent.add(detail);
      mesh(detail, new THREE.ShapeGeometry(polygon(lancet(0.091, 0.335))), "recess");
      ribbon(detail, lancet(0.115, 0.37), lancet(0.091, 0.335).map(([u, v]) => [u, v + 0.014]), 0, -0.01, 0.002, "molding", 0.012);
    }
    if (west) {
      // West tower: ecclesiastical octagonal pointed caps.
      mesh(parent, new THREE.ConeGeometry(radius * 1.12, 0.255, 8), "molding", [x, shaftBottom + shaftHeight + 0.115, z]);
      mesh(parent, new THREE.OctahedronGeometry(0.033), "tracer", [x, shaftBottom + shaftHeight + 0.256, z]);
    } else {
      // East tower: flat military battlements, distinct in silhouette.
      mesh(parent, new THREE.CylinderGeometry(radius * 1.15, radius * 1.12, 0.12, 8), "molding", [x, shaftBottom + shaftHeight + 0.035, z]);
      for (let i = 0; i < 4; i++) {
        const angle = (i + 0.5) * Math.PI / 2;
        box(parent, 0.095, 0.14, 0.095, x + Math.sin(angle) * 0.095, shaftBottom + shaftHeight + 0.14, z + Math.cos(angle) * 0.095, "molding");
      }
    }
  }

  // The long reading-room range is the identifying horizontal gesture: seven
  // tall Gothic bays above two smaller rows, with a continuous pitched roof.
  const hallWidth = 4.72;
  const hallDepth = 1.28;
  const hallHeight = 2.88;
  const hallWindows = [];
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.665;
    hallWindows.push({ x, y: 1.55, w: 0.45, h: 1.09 });
    for (const y of [0.29, 0.87]) hallWindows.push({ x, y, w: 0.34, h: 0.38, arch: false, fine: true });
  }
  facade(root, hallWidth, hallHeight, hallWindows, 0, hallDepth / 2);
  // The back is modeled in depth, but kept quieter than the chosen elevation.
  facade(root, hallWidth, hallHeight, [], 0, -hallDepth / 2, Math.PI);
  box(root, hallWidth, 0.14, hallDepth, 0, 0.07, 0, "darkStone");
  cornice(root, hallWidth, hallDepth, 1.36);
  cornice(root, hallWidth, hallDepth, 2.82);
  for (let i = 0; i <= 7; i++) buttress(root, (i - 3.5) * 0.665, hallDepth / 2, 2.82, true);
  parapet(root, hallWidth, hallDepth / 2 + 0.025, 2.86, 0, 14);
  parapet(root, hallWidth, -hallDepth / 2 - 0.025, 2.86, 0, 14);
  const roofShape = polygon([[-hallDepth / 2 - 0.03, 2.94], [0, 3.46], [hallDepth / 2 + 0.03, 2.94]]);
  const roof = mesh(root, extrude(roofShape, hallWidth), "roof");
  roof.rotation.y = Math.PI / 2;
  roof.position.x = -hallWidth / 2;
  box(root, hallWidth, 0.045, 0.07, 0, 3.468, 0, "molding");

  for (const side of [-1, 1]) {
    const tower = new THREE.Group();
    tower.position.x = side * 3.075;
    root.add(tower);
    const width = 1.51;
    const depth = 1.64;
    const height = 3.95;
    const frontWindows = [];
    for (const x of [-0.345, 0.345]) {
      frontWindows.push({ x, y: 2.55, w: 0.43, h: 1.0 });
      for (const y of [0.28, 0.83]) frontWindows.push({ x, y, w: 0.34, h: 0.38, arch: false, fine: true });
    }
    for (let i = 0; i < 4; i++) frontWindows.push({ x: (i - 1.5) * 0.285, y: 1.43, w: 0.18, h: 0.42, fine: true });
    facade(tower, width, height, frontWindows, 0, depth / 2);
    facade(tower, width, height, [], 0, -depth / 2, Math.PI);
    for (const direction of [-1, 1]) {
      const sideWindows = [
        { x: 0, y: 2.5, w: 0.61, h: 1.05 },
        { x: -0.34, y: 0.3, w: 0.31, h: 0.71, arch: false, fine: true },
        { x: 0.34, y: 0.3, w: 0.31, h: 0.71, arch: false, fine: true },
        { x: -0.34, y: 1.43, w: 0.25, h: 0.42, fine: true },
        { x: 0.34, y: 1.43, w: 0.25, h: 0.42, fine: true },
      ];
      facade(tower, depth, height, direction === side ? sideWindows : [], direction * width / 2, 0, direction * Math.PI / 2);
    }
    box(tower, width, 0.14, depth, 0, 0.07, 0, "darkStone");
    box(tower, width - 0.12, 0.08, depth - 0.12, 0, height - 0.1, 0, "roof");
    for (const y of [1.27, 1.99, 2.31, 3.84]) cornice(tower, width, depth, y);
    for (const direction of [-1, 1]) {
      buttress(tower, direction * (width / 2 - 0.035), depth / 2, 3.89);
      buttress(tower, direction * (width / 2 - 0.035), -depth / 2 - 0.115, 3.89);
      for (const z of [-depth / 2 + 0.03, depth / 2 - 0.03]) turret(tower, direction * (width / 2 - 0.035), z, side < 0);
    }
    // A narrow center pier ties the twin upper lancets to the crown.
    box(tower, 0.075, 1.43, 0.09, 0, 3.08, depth / 2 + 0.045, "molding");
    for (const z of [-depth / 2, depth / 2]) {
      parapet(tower, width, z, 3.87, 0, 5);
      pinnacle(tower, 0, 4.05, z, 0.53);
    }
    for (const x of [-width / 2, width / 2]) {
      const sideCrown = new THREE.Group();
      sideCrown.position.x = x;
      sideCrown.rotation.y = Math.PI / 2;
      tower.add(sideCrown);
      parapet(sideCrown, depth, 0, 3.87, 0, 5);
    }
    for (const x of [-0.33, 0.33]) {
      const shield = polygon([[-0.09, 0.075], [0.09, 0.075], [0.075, -0.045], [0, -0.105], [-0.075, -0.045]]);
      mesh(tower, extrude(shield, 0.045), "molding", [x, 2.16, depth / 2 + 0.02]);
    }
  }

  // Small stepped footing establishes a grounded building while remaining part
  // of the sculpture; no surrounding campus plane or decorative display plinth.
  box(root, 7.84, 0.12, 1.89, 0, -0.035, 0, "darkStone");
  box(root, 7.94, 0.055, 1.96, 0, -0.122, 0, "molding");

  // A slightly elevated three-quarter view preserves the long facade, shows
  // both roofs and the return wall, and keeps the unequal crowns distinct.
  root.rotation.set(0.13, -0.37, -0.018);
  root.userData.sculpture = "harper";
  root.userData.brandReference = "#800000";
  root.userData.feature = "seven-bay hall, twin Gothic towers, unlike lantern crowns";
  root.updateMatrixWorld(true);
  return root;
}
