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
  longitudinalSegments: 288,
  radialSegments: 96,
  sweepRadius: 2.3,
  halfTwists: 3,
  palette: Object.freeze(["#fafaff", "#e8e2f7", "#ddeef9", "#ffe4d4"]),
  source: "https://arxiv.org/abs/0909.5354",
});

/**
 * Figure-eight Klein immersion, extending Franzoni's equation (1) from one
 * to three half-twists. The extra odd twists are an authored variation.
 * u,v∈[0,2π]; identify (2π,v) with (0,-v). R>1.25 keeps the sweep radius
 * positive, and the figure-eight cross-section has no vanishing tangent.
 */
export function kleinBottlePoint(u, v) {
  const twist = KLEIN_BOTTLE.halfTwists * u / 2;
  const a = Math.sin(v), b = Math.sin(2 * v);
  const radial = Math.cos(twist) * a - Math.sin(twist) * b;
  const height = Math.sin(twist) * a + Math.cos(twist) * b;
  const radius = KLEIN_BOTTLE.sweepRadius + radial;
  return [
    radius * Math.cos(u),
    radius * Math.sin(u),
    height,
  ];
}

/** A three-half-twist figure-eight Klein immersion in faint opalescent pearl. */
export function createNotes() {
  const root = new THREE.Group();
  root.name = "three-half-twist-figure-eight-klein-bottle";
  const positions = [], colors = [], indices = [], parameters = [];
  const { longitudinalSegments: steps, radialSegments: sides } = KLEIN_BOTTLE;
  const [pearl, lavender, ice, peach] = KLEIN_BOTTLE.palette.map(hex => new THREE.Color(hex));
  const color = new THREE.Color();
  for (let i = 0; i < steps; i++) {
    const u = i / steps * Math.PI * 2;
    for (let j = 0; j < sides; j++) {
      const v = j / sides * Math.PI * 2;
      positions.push(...kleinBottlePoint(u, v));
      parameters.push(u, v);
      // Each term respects the reflected seam. The surface remains mostly
      // pearl, with a small warm glint on the loop instead of rainbow bands.
      color.copy(pearl).lerp(lavender, 0.24 * Math.cos(v) ** 2);
      color.lerp(ice, 0.22 * Math.sin(v) ** 2);
      const warmGlint = Math.max(0, Math.sin(v)) ** 12 * Math.sin(u) ** 6;
      color.lerp(pearl, warmGlint).lerp(peach, 0.30 * warmGlint);
      colors.push(color.r, color.g, color.b);
      const a = i * sides + j, d = i * sides + (j + 1) % sides;
      const next = column => i + 1 < steps
        ? (i + 1) * sides + column % sides
        : (sides - column) % sides;
      // Reversing the final circular seam creates the Klein bottle quotient.
      // Never weld spatial self-intersections: their two sheets stay distinct.
      const b = next(j), c = next(j + 1);
      indices.push(a, c, b, a, d, c);
    }
  }
  const mesh = meshFrom(positions, colors, indices, "pearl-opalescent-klein-bottle");
  mesh.geometry.setAttribute("parameter", new THREE.Float32BufferAttribute(parameters, 2));
  mesh.material.roughness = 0.24;
  mesh.material.metalness = 0.33;
  root.add(mesh);
  // Expose the central opening and the three folded figure-eight returns.
  root.rotation.set(0.52, 0.24, -0.16);
  root.userData = {
    identity: "notes", source: KLEIN_BOTTLE.source,
    equation: "P(u,v)=((R+A)cos(u),(R+A)sin(u),B), (A,B)=Rot(3u/2)(sin(v),sin(2v))",
    sweepRadius: KLEIN_BOTTLE.sweepRadius,
    halfTwists: KLEIN_BOTTLE.halfTwists,
    seam: "(2pi,v)~(0,-v)",
    meaning: "Closed nonorientable figure-eight Klein immersion in 3D; three half-twists are an authored extension of the published one-half-twist construction",
    palette: "Mostly pearl with faint lavender, ice blue and a small peach glint; authored display colors",
  };
  return root;
}
