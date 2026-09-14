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
  const steps = 512, sides = 24;
  const blue = new THREE.Color("#187fe8"), red = new THREE.Color("#f12f57");
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
