import * as THREE from "three";
import { readFileSync } from "node:fs";

// Build-only source. The browser receives prepared sculpture assets, never a
// numerical solver or a dependency on either sibling checkout.
const DATA = new URL("../../../assets/black-geometry/project-data/", import.meta.url);
const surfaceMetadata = JSON.parse(readFileSync(new URL("genus-2.meta.json", DATA), "utf8"));
const congestion = JSON.parse(readFileSync(new URL("congestion-100.json", DATA), "utf8"));

function readSurface() {
  const buffer = readFileSync(new URL("genus-2.bin", DATA));
  if (buffer.subarray(0, 8).toString() !== "PORTGEO1") throw new Error("Invalid portfolio surface export");
  const vertices = buffer.readUInt32LE(8);
  const faces = buffer.readUInt32LE(12);
  const points = buffer.readUInt32LE(16);
  let offset = 20;
  function array(count, unsigned = false) {
    const output = unsigned ? new Uint32Array(count) : new Float32Array(count);
    for (let i = 0; i < count; i++, offset += 4) {
      output[i] = unsigned ? buffer.readUInt32LE(offset) : buffer.readFloatLE(offset);
    }
    return output;
  }
  const positions = array(vertices * 3);
  const normals = array(vertices * 3);
  const distance = array(vertices);
  const indices = array(faces * 3, true);
  const path = array(points * 3);
  if (offset !== buffer.length || vertices !== surfaceMetadata.vertices || faces !== surfaceMetadata.faces) {
    throw new Error("Portfolio surface export count mismatch");
  }
  return { positions, normals, distance, indices, path };
}

const surface = readSurface();
export const SURFACE_PATH = Array.from({ length: surface.path.length / 3 }, (_, i) => Array.from(surface.path.subarray(i * 3, i * 3 + 3)));
export const SURFACE_INFO = {
  genus: 2,
  vertices: surfaceMetadata.vertices,
  faces: surfaceMetadata.faces,
  route: surfaceMetadata.routePresets.find((route) => route.id === "outer-ridge"),
  source: surfaceMetadata.source,
  export: surfaceMetadata.portfolioExport,
};

export const CONGESTION_INFO = {
  population: congestion.population,
  modelIdentifier: congestion.modelIdentifier,
  sampling: congestion.potentialLandscape.sampling,
  heightTransform: congestion.potentialLandscape.heightTransform,
  equilibria: congestion.exactAnalysis["braess-open"].pureNashEquilibria,
  socialOptima: congestion.exactAnalysis["braess-open"].socialOptima,
  closed: congestion.scenarioStates["braess-closed"].equilibrium,
  open: congestion.scenarioStates["braess-open"].equilibrium,
  bestResponseAudit: congestion.potentialLandscape.bestResponseAudit,
  source: congestion.portfolioExport,
};

function material() {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.64,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
}

function pathLine(points, name, metadata) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffd393, transparent: true, opacity: 1 }));
  line.name = name;
  line.userData = { path: true, ...metadata };
  return line;
}

// Bake the same rigid presentation transform into every surface and line.
// This keeps the real route attached even when the enclosing Group is sampled.
function present(group, rotation) {
  group.rotation.copy(rotation);
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group, true);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(5.8 / size.x, 4.8 / size.y);
  const normalization = new THREE.Matrix4().makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  const markerTransform = normalization.clone().multiply(group.matrixWorld);
  if (group.userData.markers) {
    group.userData.markers = group.userData.markers.map((marker) => ({
      ...marker, position: new THREE.Vector3(...marker.position).applyMatrix4(markerTransform).toArray(),
    }));
  }
  group.traverse((object) => {
    if (!object.geometry) return;
    const transform = normalization.clone().multiply(object.matrixWorld);
    object.geometry.applyMatrix4(transform);
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);
    object.updateMatrix();
  });
  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
  group.scale.set(1, 1, 1);
  group.updateMatrixWorld(true);
  return group;
}

export function createSurface() {
  const group = new THREE.Group();
  group.name = "computed-genus-two-world";
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(surface.positions.slice(), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(surface.normals.slice(), 3));
  geometry.setIndex(new THREE.BufferAttribute(surface.indices.slice(), 1));
  const colors = new Float32Array(surface.positions.length);
  const low = new THREE.Color("#176aa3"), mid = new THREE.Color("#16a6a2"), high = new THREE.Color("#70dec4"), color = new THREE.Color();
  let maximumDistance = 0;
  for (const distance of surface.distance) maximumDistance = Math.max(maximumDistance, distance);
  for (let i = 0; i < surface.distance.length; i++) {
    const t = Math.max(0, surface.distance[i]) / maximumDistance;
    if (t < 0.55) color.copy(low).lerp(mid, t / 0.55);
    else color.copy(mid).lerp(high, (t - 0.55) / 0.45);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, material());
  mesh.name = "original-29584-face-genus-two-mesh";
  group.add(mesh);
  group.add(pathLine(SURFACE_PATH, "computed-outer-ridge-path", {
    kind: "route",
    method: "prepared-heat-method-route",
    routeId: "outer-ridge",
    originalPositions: true,
    tracingReachedSource: true,
    fallbackUsed: false,
    pathPointCount: SURFACE_PATH.length,
  }));
  group.userData = { identity: "surface", ...SURFACE_INFO };
  return present(group, new THREE.Euler(0.29, -0.13, -0.1));
}

function landscapePoint(point) {
  return [point.displayCoordinates[0] * 2.4, point.displayHeightOriginal * 2.25 - 0.52, point.displayCoordinates[1] * 2.4];
}

export function createCongestion() {
  const group = new THREE.Group();
  group.name = "exact-rosenthal-potential-landscape";
  const landscape = congestion.potentialLandscape;
  const positions = [], colors = [];
  // A brighter red interpretation of the source visualization's copper/red
  // potential scale; the exact height values and all state geometry stay put.
  const low = new THREE.Color("#841d28"), mid = new THREE.Color("#e54338"), high = new THREE.Color("#ff735c");
  const color = new THREE.Color();
  let maxHeight = 0;
  for (const vertex of landscape.vertices) maxHeight = Math.max(maxHeight, vertex.displayHeightOriginal);
  for (const vertex of landscape.vertices) {
    positions.push(...landscapePoint(vertex));
    const t = vertex.displayHeightOriginal / maxHeight;
    if (t < 0.5) color.copy(low).lerp(mid, t * 2);
    else color.copy(mid).lerp(high, (t - 0.5) * 2);
    colors.push(color.r, color.g, color.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(landscape.triangles.flat());
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material());
  mesh.name = "all-5151-count-states";
  group.add(mesh);
  const trajectory = landscape.trajectories["braess-open-best-response"];
  group.add(pathLine(trajectory.map(landscapePoint), "exact-one-agent-best-response-path", {
    kind: "open",
    method: "exact-best-response",
    points: trajectory.length,
    routeCounts: trajectory.map((point) => point.routeCounts),
    audit: landscape.bestResponseAudit,
  }));
  const closedBoundary = landscape.vertices
    .filter((vertex) => vertex.routeCounts[2] === 0)
    .sort((a, b) => a.routeCounts[0] - b.routeCounts[0]);
  group.add(pathLine(closedBoundary.map(landscapePoint), "feasible-closed-shortcut-boundary", {
    kind: "closed",
    method: "all-feasible-two-route-count-states",
    points: closedBoundary.length,
    routeCounts: closedBoundary.map((vertex) => vertex.routeCounts),
    meaning: "Feasible states when the shortcut is closed; not a learning trajectory",
  }));
  group.userData = {
    identity: "congestion", ...CONGESTION_INFO,
    markers: [
      ...landscape.markers.equilibria.map((marker) => ({
        kind: "open-equilibrium", routeCounts: marker.routeCounts,
        position: landscapePoint({ ...marker, displayHeightOriginal: (marker.originalPotential - landscape.heightTransform.originalMinimum) / landscape.heightTransform.sharedScale }),
      })),
      ...landscape.markers.optima.map((marker) => ({
        kind: "closed-equilibrium", routeCounts: marker.routeCounts,
        position: landscapePoint({ ...marker, displayHeightOriginal: (marker.originalPotential - landscape.heightTransform.originalMinimum) / landscape.heightTransform.sharedScale }),
      })),
    ],
  };
  // A three-quarter view of the actual Y-up field; values are transformed only
  // by the same affine height conversion used in its source visualization.
  return present(group, new THREE.Euler(0.77, -0.55, -0.05));
}

/** Prepared network equilibrium, suitable for the optional shortcut control. */
export function createNetwork(shortcut = true) {
  const group = new THREE.Group();
  group.name = shortcut ? "braess-open-equilibrium" : "braess-closed-equilibrium";
  const state = shortcut ? CONGESTION_INFO.open : CONGESTION_INFO.closed;
  const nodes = {
    S: new THREE.Vector3(-2.2, 0, 0), U: new THREE.Vector3(0, 1.4, -0.12),
    V: new THREE.Vector3(0, -1.4, 0.12), T: new THREE.Vector3(2.2, 0, 0),
  };
  for (const id of ["SU", "UT", "SV", "VT", "UV"]) {
    if (id === "UV" && !shortcut) continue;
    const load = state.edgeLoads[id];
    const curve = new THREE.LineCurve3(nodes[id[0]], nodes[id[1]]);
    const geometry = new THREE.TubeGeometry(curve, 14, 0.018 + 0.048 * load / CONGESTION_INFO.population, 7, false);
    const color = new THREE.Color(load > 0 ? (id === "UV" ? "#e2a974" : "#94b9ad") : "#4e625f");
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, material());
    mesh.name = id;
    mesh.userData = { edge: id, load, physicalLatency: state.edgePhysicalLatencies[id] };
    group.add(mesh);
  }
  for (const [id, point] of Object.entries(nodes)) {
    const geometry = new THREE.IcosahedronGeometry(0.12, 1);
    geometry.translate(point.x, point.y, point.z);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    const color = new THREE.Color("#eee4cb");
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, material());
    mesh.name = id;
    group.add(mesh);
  }
  group.userData = { prepared: true, population: CONGESTION_INFO.population, shortcut, state };
  return present(group, new THREE.Euler(0.08, -0.16, 0));
}
