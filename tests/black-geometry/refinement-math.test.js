import test from "node:test";
import assert from "node:assert/strict";
import { createNotes, createResolution, kleinBottlePoint, KLEIN_BOTTLE } from "../../src/black-geometry/sculptures/mathematical.js";

function dispose(group) {
  group.traverse((object) => {
    object.geometry?.dispose();
    for (const material of [object.material].flat().filter(Boolean)) material.dispose();
  });
}

// Read actual indexed connectivity, independently of the authoring loops. A
// periodic parameter seam must be joined, not two coincident open boundaries.
function topology(geometry) {
  const edges = new Map(), adjacency = new Map(), boundary = new Map();
  const add = (map, a, b) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a).add(b);
  };
  const indices = geometry.index.array;
  for (let i = 0; i < indices.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = indices[i + j], b = indices[i + (j + 1) % 3];
      assert.notEqual(a, b, "A surface triangle cannot repeat a vertex");
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      const edge = edges.get(key) || { count: 0, a, b };
      edge.count++;
      edges.set(key, edge);
      add(adjacency, a, b);
      add(adjacency, b, a);
    }
  }
  for (const edge of edges.values()) {
    assert.ok(edge.count <= 2, "Surface edges must be manifold");
    if (edge.count === 1) {
      add(boundary, edge.a, edge.b);
      add(boundary, edge.b, edge.a);
    }
  }
  const components = (graph) => {
    const remaining = new Set(graph.keys());
    let count = 0;
    while (remaining.size) {
      count++;
      const stack = [remaining.values().next().value];
      while (stack.length) {
        const vertex = stack.pop();
        if (!remaining.delete(vertex)) continue;
        for (const next of graph.get(vertex)) if (remaining.has(next)) stack.push(next);
      }
    }
    return count;
  };
  for (const neighbors of boundary.values()) assert.equal(neighbors.size, 2, "Each boundary component must close into a loop");
  return {
    components: components(adjacency), boundaryLoops: components(boundary),
    euler: adjacency.size - edges.size + indices.length / 3,
  };
}

// Orientability is distinct from Euler characteristic: both a torus and a
// Klein bottle have χ=0. Propagate face orientations through actual edges.
function isOrientable(geometry) {
  const edges = new Map(), index = geometry.index.array;
  const adjacent = Array.from({ length: index.length / 3 }, () => []);
  for (let i = 0; i < index.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = index[i + j], b = index[i + (j + 1) % 3];
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    const side = { face: i / 3, direction: a < b ? 1 : -1 };
    if (!edges.has(key)) edges.set(key, side);
    else {
      const other = edges.get(key), relation = -side.direction * other.direction;
      adjacent[side.face].push([other.face, relation]);
      adjacent[other.face].push([side.face, relation]);
    }
  }
  const orientation = new Int8Array(adjacent.length);
  for (let seed = 0; seed < adjacent.length; seed++) {
    if (orientation[seed]) continue;
    orientation[seed] = 1;
    const stack = [seed];
    while (stack.length) {
      const face = stack.pop();
      for (const [next, relation] of adjacent[face]) {
        const expected = orientation[face] * relation;
        if (orientation[next] && orientation[next] !== expected) return false;
        if (!orientation[next]) { orientation[next] = expected; stack.push(next); }
      }
    }
  }
  return true;
}

const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
test("the classical bottle obeys its published tube equation and reversed seam", () => {
  for (let i = 0; i <= 32; i++) {
    const u = i / 32 * Math.PI, t = Math.PI * (1 - Math.cos(u)) / 2;
    const center = [5 * Math.sin(t), 2 * Math.sin(t) ** 2 * Math.cos(t), 0];
    const derivative = [5 * Math.cos(t), 4 * Math.sin(t) * Math.cos(t) ** 2 - 2 * Math.sin(t) ** 3, 0];
    const radius = .5 - (2 * t - Math.PI) * Math.sqrt(2 * t * (2 * Math.PI - 2 * t)) / 30;
    for (let j = 0; j < 24; j++) {
      const v = j / 24 * Math.PI * 2, p = kleinBottlePoint(u, v);
      const offset = p.map((value, k) => value - center[k]);
      assert.ok(Math.abs(Math.hypot(...offset) - radius) < 1e-12);
      assert.ok(Math.abs(offset.reduce((sum, value, k) => sum + value * derivative[k], 0)) < 1e-12,
        "Every cross-section must lie in the normal plane of the directrix");
      assert.ok(distance(p, kleinBottlePoint(u, v + 2 * Math.PI)) < 1e-12);
    }
  }
  const h = 1e-6;
  for (let j = 0; j < 24; j++) {
    const v = j / 24 * Math.PI * 2, reversed = Math.PI - v;
    assert.ok(distance(kleinBottlePoint(Math.PI, v), kleinBottlePoint(0, reversed)) < 1e-12);
    const atStart = kleinBottlePoint(h, reversed).map((x, k) => (x - kleinBottlePoint(0, reversed)[k]) / h);
    const atEnd = kleinBottlePoint(Math.PI, v).map((x, k) => (x - kleinBottlePoint(Math.PI - h, v)[k]) / h);
    assert.ok(distance(atStart, atEnd) < 0.0001, "The glued seam must meet tangentwise");
  }
});

test("notes triangulation is closed and nonorientable with finite ice-only colors", () => {
  const group = createNotes();
  try {
    const geometry = group.children.find(object => object.isMesh).geometry;
    assert.deepEqual(topology(geometry), { components: 1, boundaryLoops: 0, euler: 0 });
    assert.equal(isOrientable(geometry), false, "The reversed quotient must produce a Klein bottle, not another torus");
    assert.ok(geometry.index.count / 3 >= 30000 && geometry.index.count / 3 <= 65536);
    const { position, parameter, color } = geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      const p = [position.getX(i), position.getY(i), position.getZ(i)];
      assert.ok(p.every(Number.isFinite));
      assert.ok(distance(p, kleinBottlePoint(parameter.getX(i), parameter.getY(i))) < .000003);
      const rgb = [color.getX(i), color.getY(i), color.getZ(i)];
      assert.ok(rgb.every(value => value >= .6 && value <= 1));
      assert.ok(Math.max(...rgb) - Math.min(...rgb) < .15, "The sculpture must remain white/ice/silver without saturated rainbow regions");
    }
    assert.equal(KLEIN_BOTTLE.radialSegments % 2, 0, "The reflected seam needs an exact half-circle vertex");
  } finally { dispose(group); }
});

test("Resolution Life is a closed triangular flag solid with shallow authored depth", () => {
  const group = createResolution();
  try {
    const geometry = group.children.find(object => object.isMesh).geometry;
    assert.deepEqual(topology(geometry), { components: 1, boundaryLoops: 0, euler: 2 },
      "The flag is a solid triangular sheet, without the obsolete trefoil's handle");
    assert.equal(isOrientable(geometry), true);
    const p = geometry.attributes.position, indices = geometry.index.array;
    const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
    const point = i => [p.getX(i), p.getY(i), p.getZ(i)];
    for (let i = 0; i < p.count; i++) for (let k = 0; k < 3; k++) {
      const value = point(i)[k];
      assert.ok(Number.isFinite(value));
      minimum[k] = Math.min(minimum[k], value); maximum[k] = Math.max(maximum[k], value);
    }
    const width = maximum[0] - minimum[0], height = maximum[1] - minimum[1];
    assert.ok(Math.abs(width / height - 15.6471 / 7.29508) < .000001,
      "The official flag's width/height proportion must survive authoring");
    assert.ok(maximum[2] - minimum[2] > .5 && maximum[2] - minimum[2] < 1,
      "The flag has a shallow physical fold, rather than becoming a flat card or bulky volume");
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) - minimum[0]) / width, v = (maximum[1] - p.getY(i)) / height;
      assert.ok(u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7,
        "Every vertex must project inside the right triangle with a horizontal top and ascending lower edge");
    }
    let signedVolume = 0, frontArea = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map(j => point(indices[i + j]));
      const cross = [b[1]*c[2]-b[2]*c[1], b[2]*c[0]-b[0]*c[2], b[0]*c[1]-b[1]*c[0]];
      signedVolume += a.reduce((sum, value, k) => sum + value * cross[k], 0) / 6;
      const areaZ = ((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])) / 2;
      if (areaZ > 0) frontArea += areaZ;
    }
    assert.ok(Math.abs(frontArea - width * height / 2) < .00001,
      "The actual front triangles cover the reference silhouette without gaps or overlaps");
    assert.ok(Math.abs(signedVolume - width * height / 2 * .20) < .00001,
      "The closed flag retains its authored solid thickness throughout the fold");
    assert.ok(indices.length / 3 > 20000 && indices.length / 3 <= 65536);
  } finally { dispose(group); }
});

test("Resolution Life keeps a predominantly red front and a distinctly blue reverse", () => {
  const group = createResolution();
  try {
    const geometry = group.children.find(object => object.isMesh).geometry;
    const { position: p, color } = geometry.attributes, indices = geometry.index.array;
    let front = 0, red = 0, back = 0, blue = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [indices[i], indices[i+1], indices[i+2]];
      const area = ((p.getX(b)-p.getX(a))*(p.getY(c)-p.getY(a))-(p.getY(b)-p.getY(a))*(p.getX(c)-p.getX(a))) / 2;
      const rgb = [0,1,2].map(k => [a,b,c].reduce((sum, index) => sum + color.array[index*3+k], 0) / 3);
      if (area > 0) { front += area; if (rgb[0] > 4 * rgb[2]) red += area; }
      if (area < 0) { back -= area; if (rgb[2] > 2 * rgb[0]) blue -= area; }
    }
    assert.ok(red / front > .80, "The narrow blue reveal cannot overwhelm the official red flag face");
    assert.ok(blue / back > .99, "The authored reverse must retain the companion blue color during orbit");
  } finally { dispose(group); }
});
