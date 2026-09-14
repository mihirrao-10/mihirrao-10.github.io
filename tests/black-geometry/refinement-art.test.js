import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createHarper } from '../../src/black-geometry/sculptures/harper.js';
import { createSurface, createCongestion } from '../../src/black-geometry/sculptures/projects.js';

const data = new URL('../../assets/black-geometry/project-data/', import.meta.url);
const rawSurface = readFileSync(new URL('genus-2.bin', data));
const rawCongestion = JSON.parse(readFileSync(new URL('congestion-100.json', data), 'utf8'));
const vertex = (array, index) => new THREE.Vector3().fromArray(array, index * 3);

// Infer the presentation from four well-separated source points. This permits
// camera/framing changes while independently detecting altered scientific
// coordinates, extra deformations, and routes detached from their own mesh.
function recoverPresentation(source, displayed) {
  const origin = vertex(source, 0);
  const farthest = (score) => {
    let best = 1, maximum = -Infinity;
    for (let i = 1; i < source.length / 3; i++) {
      const value = score(vertex(source, i).sub(origin));
      if (value > maximum) { maximum = value; best = i; }
    }
    return best;
  };
  const first = farthest((point) => point.lengthSq());
  const axis = vertex(source, first).sub(origin);
  const second = farthest((point) => point.clone().cross(axis).lengthSq());
  const normal = axis.clone().cross(vertex(source, second).sub(origin));
  const third = farthest((point) => Math.abs(point.dot(normal)));
  const basis = (points) => {
    const o = vertex(points, 0), a = vertex(points, first).sub(o), b = vertex(points, second).sub(o), c = vertex(points, third).sub(o);
    return new THREE.Matrix4().set(a.x, b.x, c.x, o.x, a.y, b.y, c.y, o.y, a.z, b.z, c.z, o.z, 0, 0, 0, 1);
  };
  const sourceBasis = basis(source);
  assert.ok(Math.abs(sourceBasis.determinant()) > 1e-5, 'Reference points must span the 3D project');
  return basis(displayed).multiply(sourceBasis.invert());
}
function assertCoordinates(source, displayed, transform, message) {
  assert.equal(displayed.length, source.length, `${message}: no added or dropped coordinates`);
  let maximumError = 0;
  for (let i = 0; i < source.length / 3; i++) {
    maximumError = Math.max(maximumError, vertex(source, i).applyMatrix4(transform).distanceTo(vertex(displayed, i)));
  }
  assert.ok(maximumError < 0.00002, `${message}: maximum transformed coordinate error ${maximumError}`);
}
function assertRigidScale(transform, expectedYRatio = 1) {
  const e = transform.elements;
  const axes = [new THREE.Vector3(e[0], e[1], e[2]), new THREE.Vector3(e[4], e[5], e[6]), new THREE.Vector3(e[8], e[9], e[10])];
  assert.ok(transform.determinant() > 0, 'Presentation must not reflect the scientific geometry');
  assert.ok(Math.abs(axes[0].length() / axes[2].length() - 1) < 0.00002, 'Horizontal axes must retain equal scale');
  assert.ok(Math.abs(axes[1].length() / axes[0].length() - expectedYRatio) < 0.00002, 'Height scale must preserve the original visualization convention');
  axes.forEach((a, i) => axes.slice(i + 1).forEach((b) => assert.ok(Math.abs(a.clone().normalize().dot(b.clone().normalize())) < 0.00002, 'Presentation cannot shear the source surface')));
}
function surfaceExport() {
  assert.equal(rawSurface.subarray(0, 8).toString(), 'PORTGEO1');
  const vertices = rawSurface.readUInt32LE(8), faces = rawSurface.readUInt32LE(12), points = rawSurface.readUInt32LE(16);
  let offset = 20;
  const read = (length, integers = false) => Array.from({ length }, () => {
    const value = integers ? rawSurface.readUInt32LE(offset) : rawSurface.readFloatLE(offset);
    offset += 4; return value;
  });
  const positions = read(vertices * 3), normals = read(vertices * 3);
  read(vertices); // Distances affect the palette, never the source coordinates.
  const indices = read(faces * 3, true), path = read(points * 3);
  assert.equal(offset, rawSurface.length);
  return { positions, normals, indices, path };
}

test('blue-green genus-two rendering preserves every exported vertex, normal, triangle and computed route', () => {
  const source = surfaceExport(), group = createSurface();
  const mesh = group.children.find((object) => object.isMesh);
  const displayed = mesh.geometry.attributes.position.array;
  const transform = recoverPresentation(source.positions, displayed);
  assertRigidScale(transform);
  assertCoordinates(source.positions, displayed, transform, 'Genus-two surface');
  assert.deepEqual(Array.from(mesh.geometry.index.array), source.indices, 'Source triangle connectivity must remain exact');
  const normalTransform = new THREE.Matrix3().getNormalMatrix(transform);
  const normals = mesh.geometry.attributes.normal.array;
  for (let i = 0; i < source.normals.length / 3; i++) {
    assert.ok(vertex(source.normals, i).applyNormalMatrix(normalTransform).distanceTo(vertex(normals, i)) < 0.00002, 'The source normals must follow the same rigid presentation');
  }
  const route = group.children.find((object) => object.isLine && object.userData.kind === 'route');
  assertCoordinates(source.path, route.geometry.attributes.position.array, transform, 'Computed outer-ridge path');
  assert.equal(route.userData.tracingReachedSource, true);
  assert.equal(route.userData.fallbackUsed, false);
});

test('red congestion rendering retains every exact potential state and the meaning of both route modes', () => {
  const source = rawCongestion.potentialLandscape;
  const coordinates = (point) => [point.displayCoordinates[0], point.displayHeightOriginal, point.displayCoordinates[1]];
  const positions = source.vertices.flatMap(coordinates);
  const group = createCongestion(), mesh = group.children.find((object) => object.isMesh);
  const transform = recoverPresentation(positions, mesh.geometry.attributes.position.array);
  // The existing visualization uses 2.4 for simplex coordinates and 2.25 for
  // its documented display-height conversion; palette edits cannot change it.
  assertRigidScale(transform, 2.25 / 2.4);
  assertCoordinates(positions, mesh.geometry.attributes.position.array, transform, 'Exact N=100 potential states');
  assert.deepEqual(Array.from(mesh.geometry.index.array), source.triangles.flat());
  const openSource = source.trajectories['braess-open-best-response'];
  const closedSource = source.vertices.filter((point) => point.routeCounts[2] === 0).sort((a, b) => a.routeCounts[0] - b.routeCounts[0]);
  for (const [kind, points] of [['open', openSource], ['closed', closedSource]]) {
    const path = group.children.find((object) => object.isLine && object.userData.kind === kind);
    assertCoordinates(points.flatMap(coordinates), path.geometry.attributes.position.array, transform, `${kind} route mode`);
    assert.deepEqual(path.userData.routeCounts, points.map((point) => point.routeCounts));
  }
  assert.equal(group.children.find((object) => object.userData.kind === 'open').userData.method, 'exact-best-response');
  assert.equal(group.children.find((object) => object.userData.kind === 'closed').userData.method, 'all-feasible-two-route-count-states');
  assert.deepEqual(group.userData.equilibria, rawCongestion.exactAnalysis['braess-open'].pureNashEquilibria);
  assert.deepEqual(group.userData.socialOptima, rawCongestion.exactAnalysis['braess-open'].socialOptima);
  const expectedMarkers = [
    ...source.markers.equilibria.map((marker) => ({ ...marker, kind: 'open-equilibrium' })),
    ...source.markers.optima.map((marker) => ({ ...marker, kind: 'closed-equilibrium' })),
  ];
  assert.equal(group.userData.markers.length, expectedMarkers.length);
  expectedMarkers.forEach((marker, i) => {
    const actual = group.userData.markers[i];
    const height = (marker.originalPotential - source.heightTransform.originalMinimum) / source.heightTransform.sharedScale;
    const expectedPosition = new THREE.Vector3(marker.displayCoordinates[0], height, marker.displayCoordinates[1]).applyMatrix4(transform);
    assert.ok(expectedPosition.distanceTo(new THREE.Vector3(...actual.position)) < 0.00002, 'Exact state markers must stay attached to their source potential');
    assert.equal(actual.kind, marker.kind);
    assert.deepEqual(actual.routeCounts, marker.routeCounts);
  });
});

test('Harper keeps a wide architectural proportion and bounded context instead of shrinking around remote scenery', () => {
  const group = createHarper(); group.updateMatrixWorld(true);
  const total = new THREE.Box3().setFromObject(group), meshBounds = new THREE.Box3();
  let triangles = 0, contextLines = 0;
  group.traverse((object) => {
    if (object.isMesh) {
      meshBounds.union(new THREE.Box3().setFromObject(object));
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    } else if (object.isLine) {
      assert.equal(object.userData.kind, 'context', 'Architecture outlines cannot be decoded as computed project paths');
      contextLines++;
    }
  });
  const size = total.getSize(new THREE.Vector3()), core = meshBounds.getSize(new THREE.Vector3());
  assert.ok(size.x / size.y > 1.6 && size.x / size.y < 1.9, 'The complete building must read as an extended collegiate range');
  assert.ok(size.x / core.x < 1.1 && size.y / core.y < 1.1, 'Context must not dominate normalization or shrink the building');
  assert.ok(triangles > 10000 && triangles < 20000, 'Retain architectural detail within the moderate facet budget');
  assert.ok(contextLines >= 2, 'The rear setting needs its separate fadeable outlines');
});
