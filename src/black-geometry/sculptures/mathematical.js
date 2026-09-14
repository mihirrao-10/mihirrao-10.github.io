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

export const RESOLUTION_FLAG = Object.freeze({
  width: 5.8,
  height: 5.8 * 7.29508 / 15.6471,
  thickness: 0.20,
  segments: 120,
  red: "#e53e51",
  blue: "#202945",
  source: "https://www.resolutionlife.com/media/pfglbg3u/logo.svg",
});

/**
 * Original shallow 3D interpretation of Resolution Life's right-triangle flag.
 * Its vertical hoist, horizontal upper edge and rising lower edge follow the
 * official mark; the folded depth, blue reverse and narrow rim are authored.
 */
export function createResolution() {
  const root = new THREE.Group();
  root.name = "resolution-life-folded-flag";
  const positions = [], colors = [], indices = [], rows = [];
  const { width, height, thickness, segments } = RESOLUTION_FLAG;
  const red = new THREE.Color(RESOLUTION_FLAG.red), blue = new THREE.Color(RESOLUTION_FLAG.blue);
  const color = new THREE.Color();
  // A regular barycentric lattice covers the triangular domain exactly. The
  // shallow crest adds physical depth without cutting holes or adding lobes.
  for (let i = 0; i <= segments; i++) {
    const row = [];
    for (let j = 0; j <= segments - i; j++) {
      const u = i / segments, v = j / segments, edge = Math.min(u, v, 1 - u - v);
      const depth = 0.44 * Math.sin(Math.PI * u) + 0.12 * v
        + 0.08 * Math.sin(Math.PI * v) * Math.sin(2 * Math.PI * u);
      row.push(positions.length / 3);
      positions.push(width * (u - .5), height * (.5 - v), depth + thickness / 2);
      // A small blue reveal makes the reverse material legible from the front;
      // the broad face remains red, as in the official flat symbol.
      color.copy(blue).lerp(red, THREE.MathUtils.smoothstep(edge, .006, .026));
      colors.push(color.r, color.g, color.b);
    }
    rows.push(row);
  }
  const frontCount = positions.length / 3;
  for (let i = 0; i < frontCount; i++) {
    positions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2] - thickness);
    colors.push(blue.r, blue.g, blue.b);
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < segments - i; j++) {
    const a = rows[i][j], b = rows[i + 1][j], c = rows[i][j + 1];
    indices.push(a, c, b, a + frontCount, b + frontCount, c + frontCount);
    if (i + j < segments - 1) {
      const d = rows[i + 1][j + 1];
      indices.push(b, c, d, b + frontCount, d + frontCount, c + frontCount);
    }
  }
  const boundary = [];
  for (let j = 0; j <= segments; j++) boundary.push(rows[0][j]);
  for (let i = 1; i <= segments; i++) boundary.push(rows[i][segments - i]);
  for (let i = segments - 1; i > 0; i--) boundary.push(rows[i][0]);
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    indices.push(a, a + frontCount, b, b, a + frontCount, b + frontCount);
  }
  root.add(meshFrom(positions, colors, indices, "red-flag-blue-reverse"));
  root.rotation.set(-0.10, 0.35, 0);
  root.userData = {
    identity: "resolution", source: RESOLUTION_FLAG.source,
    meaning: "Original 3D interpretation of Resolution Life's triangular flag symbol",
    reference: "Official header symbol: vertical left edge, horizontal top edge, red triangle above the blue wordmark",
    authored: "Shallow fold, solid thickness, blue reverse and narrow blue rim; not official 3D brand artwork",
    palette: { red: RESOLUTION_FLAG.red, blue: RESOLUTION_FLAG.blue },
  };
  return root;
}

export const KLEIN_BOTTLE = Object.freeze({
  longitudinalSegments: 256,
  radialSegments: 80,
  palette: Object.freeze(["#f7fbff", "#dceaf2", "#a3afb9"]),
  source: "https://arxiv.org/abs/0909.5354",
});

/**
 * Franzoni's classical bottle immersion: a tube around a half-dumbbell.
 * u∈[0,π], v∈[0,2π]; identify (π,v) with (0,π-v).
 * t=π(1-cos u)/2 removes the radius derivative's endpoint divergence.
 */
export function kleinBottlePoint(u, v) {
  const t = Math.PI * (1 - Math.cos(u)) / 2;
  const sine = Math.sin(t), cosine = Math.cos(t);
  const tangentX = 5 * cosine;
  const tangentY = 4 * sine * cosine * cosine - 2 * sine * sine * sine;
  const length = Math.hypot(tangentX, tangentY);
  // This is exactly 1/2-(2t-π)sqrt(2t(2π-2t))/30 on the domain.
  const radius = 0.5 + Math.PI * Math.PI / 30 * Math.cos(u) * Math.sin(u);
  return [
    5 * sine - radius * Math.cos(v) * tangentY / length,
    2 * sine * sine * cosine + radius * Math.cos(v) * tangentX / length,
    radius * Math.sin(v),
  ];
}

/** The classical self-penetrating bottle, in white, ice and silver. */
export function createNotes() {
  const root = new THREE.Group();
  root.name = "classical-immersed-klein-bottle";
  const positions = [], colors = [], indices = [], parameters = [];
  const { longitudinalSegments: steps, radialSegments: sides } = KLEIN_BOTTLE;
  const [white, ice, silver] = KLEIN_BOTTLE.palette.map(hex => new THREE.Color(hex));
  const color = new THREE.Color();
  for (let i = 0; i < steps; i++) {
    const u = i / steps * Math.PI;
    for (let j = 0; j < sides; j++) {
      const v = j / sides * Math.PI * 2;
      positions.push(...kleinBottlePoint(u, v));
      parameters.push(u, v);
      // Both terms respect the reversed seam; no rainbow or false data scale.
      color.copy(white).lerp(ice, 0.18 + 0.28 * Math.sin(v) ** 2);
      color.lerp(silver, 0.24 * Math.cos(v) ** 2 * Math.sin(u) ** 2);
      colors.push(color.r, color.g, color.b);
      const a = i * sides + j, d = i * sides + (j + 1) % sides;
      const next = column => i + 1 < steps
        ? (i + 1) * sides + column % sides
        : (sides / 2 - column + sides) % sides;
      // Reversing the final circular seam creates the Klein bottle quotient.
      // Never weld spatial self-intersections: their two sheets stay distinct.
      const b = next(j), c = next(j + 1);
      indices.push(a, c, b, a, d, c);
    }
  }
  const mesh = meshFrom(positions, colors, indices, "ice-silver-klein-bottle");
  mesh.geometry.setAttribute("parameter", new THREE.Float32BufferAttribute(parameters, 2));
  mesh.material.roughness = 0.24;
  mesh.material.metalness = 0.33;
  root.add(mesh);
  // Stand the bottle upright, then expose its mouth, returning neck and loop.
  root.rotation.set(0.32, 0.70, -Math.PI / 2);
  root.userData = {
    identity: "notes", source: KLEIN_BOTTLE.source,
    equation: "Tube(t,v)=alpha(t)+r(t)(cos(v)J(T(t))+sin(v)(0,0,1))",
    directrix: "alpha(t)=(5sin(t),2sin(t)^2cos(t),0)",
    radius: "r(t)=1/2-(2t-pi)sqrt(2t(2pi-2t))/30",
    parameterChange: "t=pi(1-cos(u))/2",
    seam: "(pi,v)~(0,pi-v)",
    meaning: "Classical closed nonorientable Klein bottle immersed in 3D; self-intersections are intentional",
    palette: "Crystalline white, ice and silver; authored display colors",
  };
  return root;
}
