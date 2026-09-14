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

test("the trefoil ribbon closes both longitudinal and cross-section seams", () => {
  const group = createResolution();
  try {
    const mesh = group.children.find((object) => object.isMesh);
    assert.deepEqual(topology(mesh.geometry), { components: 1, boundaryLoops: 0, euler: 0 },
      "The prepared ribbon is a closed tube surface, not a set of disconnected strips");
  } finally { dispose(group); }
});
