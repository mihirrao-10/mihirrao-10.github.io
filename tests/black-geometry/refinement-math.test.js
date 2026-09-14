import test from "node:test";
import assert from "node:assert/strict";
import { createNotes, createResolution } from "../../src/black-geometry/sculptures/mathematical.js";

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

test("notes vertices satisfy the square-root projection, retain both roots, and join the periodic seam", () => {
  const group = createNotes();
  try {
    const mesh = group.children.find((object) => object.isMesh);
    const positions = mesh.geometry.attributes.position;
    const key = (x, y, z) => [x, y, z].map((value) => Math.round(value * 100000)).join(",");
    const points = new Set();
    for (let i = 0; i < positions.count; i++) points.add(key(positions.getX(i), positions.getY(i), positions.getZ(i)));
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const realRoot = y / 1.35;
      // Eliminate Im(w) from w²=z: Im(z)² = 4 Re(w)² (Re(w)² - Re(z)).
      const imaginaryRootSquared = realRoot * realRoot - x;
      assert.ok(imaginaryRootSquared >= -0.000001);
      assert.ok(Math.abs(z * z - 4 * realRoot * realRoot * imaginaryRootSquared) < 0.000005,
        "Every plotted vertex must lie on the stated algebraic projection");
      assert.ok(points.has(key(x, -y, z)), "The opposite square root must occur over the same complex z");
    }
    assert.deepEqual(topology(mesh.geometry), { components: 1, boundaryLoops: 2, euler: 0 },
      "The punctured parameter disk must be one annulus, with no accidental branch-cut seam");
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
