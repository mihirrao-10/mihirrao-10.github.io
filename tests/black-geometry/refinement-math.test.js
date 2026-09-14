import test from "node:test";
import assert from "node:assert/strict";
import { createNotes, createResolution, notesCurve } from "../../src/black-geometry/sculptures/mathematical.js";

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

test("notes is a closed (3,5) torus knot with independently verified winding numbers", () => {
  const group=createNotes();
  try {
    const geometry=group.children.find(object=>object.isMesh).geometry;
    assert.deepEqual(topology(geometry),{components:1,boundaryLoops:0,euler:0});
    let major=0,minor=0,previous;
    const difference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
    for(let i=0;i<=1000;i++){
      const point=notesCurve(i/1000*Math.PI*2), radial=Math.hypot(point[0],point[1]);
      assert.ok(Math.abs((radial-1.35)**2+point[2]**2-.58**2)<1e-12);
      const angles=[Math.atan2(point[1],point[0]),Math.atan2(point[2],radial-1.35)];
      if(previous){major+=difference(angles[0],previous[0]);minor+=difference(angles[1],previous[1]);}
      previous=angles;
    }
    assert.ok(Math.abs(major/(2*Math.PI)-3)<1e-12);
    assert.ok(Math.abs(minor/(2*Math.PI)-5)<1e-12);
  }finally{dispose(group);}
});

test("the trefoil ribbon closes both longitudinal and cross-section seams", () => {
  const group = createResolution();
  try {
    const mesh = group.children.find((object) => object.isMesh);
    assert.deepEqual(topology(mesh.geometry), { components: 1, boundaryLoops: 0, euler: 0 },
      "The prepared ribbon is a closed tube surface, not a set of disconnected strips");
  } finally { dispose(group); }
});
