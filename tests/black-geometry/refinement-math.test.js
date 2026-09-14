import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  heroHeight, heroDerivatives, computeHeroAscent, createHero,
} from "../../src/black-geometry/sculptures/hero.js";
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

test("hero analytic gradient matches numerical derivatives and its three crests are stationary maxima", () => {
  const step = 0.00001;
  for (const u of [-1.2, -0.63, -0.1, 0.37, 1.12]) {
    for (const v of [-1.04, -0.38, 0.07, 0.53, 1.21]) {
      const numeric = [
        (heroHeight(u + step, v) - heroHeight(u - step, v)) / (2 * step),
        (heroHeight(u, v + step) - heroHeight(u, v - step)) / (2 * step),
      ];
      const analytic = heroDerivatives(u, v);
      analytic.forEach((value, axis) => assert.ok(
        Math.abs(value - numeric[axis]) < 0.0000001,
        `Derivative ${axis} must describe the actual height field at (${u}, ${v})`,
      ));
    }
  }
  // The radial factor r^3 exp(-r^2) peaks at sqrt(3/2), independently of RK4.
  const radius = Math.sqrt(3 / 2);
  for (let crest = 0; crest < 3; crest++) {
    const theta = crest * 2 * Math.PI / 3;
    const u = radius * Math.cos(theta), v = radius * Math.sin(theta);
    assert.ok(Math.hypot(...heroDerivatives(u, v)) < 1e-12);
    const maximum = heroHeight(u, v);
    for (const [du, dv] of [[0.01, 0], [-0.01, 0], [0, 0.01], [0, -0.01]]) {
      assert.ok(heroHeight(u + du, v + dv) < maximum, "Each crest must be a local maximum, not a labeled arbitrary endpoint");
    }
  }
});

test("prepared ascent follows the actual gradient uphill and reaches the independently known crest", () => {
  const samples = computeHeroAscent();
  assert.ok(samples.length > 10, "The trajectory must contain resolved integration steps");
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    assert.ok(Math.abs(sample.height - heroHeight(...sample.uv)) < 1e-12);
    if (!i) continue;
    const previous = samples[i - 1];
    assert.ok(sample.height > previous.height, "Every saved point must ascend the displayed field");
    const delta = sample.uv.map((value, axis) => value - previous.uv[axis]);
    const middle = sample.uv.map((value, axis) => (value + previous.uv[axis]) / 2);
    const gradient = heroDerivatives(...middle);
    const product = Math.hypot(...delta) * Math.hypot(...gradient);
    assert.ok(delta[0] * gradient[0] + delta[1] * gradient[1] > 0);
    assert.ok(Math.abs(delta[0] * gradient[1] - delta[1] * gradient[0]) / product < 0.003,
      "A step must follow the gradient direction, not merely happen to gain height");
  }
  assert.ok(samples.at(-1).height - samples[0].height > 2);
  assert.ok(Math.hypot(samples.at(-1).uv[0] - Math.sqrt(3 / 2), samples.at(-1).uv[1]) < 0.00003);
  const trueMaximum = 3.15 * (3 / 2) ** 1.5 * Math.exp(-3 / 2);
  assert.ok(Math.abs(samples.at(-1).height - trueMaximum) < 1e-8);
});

test("the red ascent remains above the actual connected mesh after its presentation transform", () => {
  const group = createHero();
  try {
    group.updateMatrixWorld(true);
    const mesh = group.children.find((object) => object.isMesh);
    const line = group.children.find((object) => object.isLine && object.userData.kind === "ascent");
    assert.ok(line, "The renderer needs a prepared ascent line");
    assert.deepEqual(topology(mesh.geometry), { components: 1, boundaryLoops: 1, euler: 1 });
    const upward = new THREE.Vector3(0, 1, 0).transformDirection(mesh.matrixWorld);
    const ray = new THREE.Raycaster(), point = new THREE.Vector3();
    const positions = line.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(line.matrixWorld);
      ray.set(point.clone().addScaledVector(upward, 10), upward.clone().negate());
      const intersections = ray.intersectObject(mesh, false);
      assert.ok(intersections.length, "Every trace point must remain over the triangulated domain");
      const clearance = point.clone().sub(intersections[0].point).dot(upward);
      assert.ok(clearance > 0.001 && clearance < 0.08,
        `Trace clearance ${clearance} must be positive and small, rather than detached or buried`);
    }
  } finally { dispose(group); }
});

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
