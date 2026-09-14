import test from "node:test";
import assert from "node:assert/strict";
import {
  CALABI_YAU, calabiYauPoint, projectCalabiYau, createHero,
} from "../../src/black-geometry/sculptures/hero.js";

// Multiplication gives an independent check of the fractional-power chart.
function multiply([a, b], [c, d]) { return [a * c - b * d, a * d + b * c]; }
function fifth(z) {
  let power = [1, 0];
  for (let i = 0; i < 5; i++) power = multiply(power, z);
  return power;
}
function residual(point) {
  const a = fifth(point.slice(0, 2)), b = fifth(point.slice(2, 4));
  return Math.hypot(a[0] + b[0] - 1, a[1] + b[1]);
}
function distance(a, b) { return Math.hypot(...a.map((value, i) => value - b[i])); }
function dispose(group) {
  group.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
}

function topology(geometry) {
  const edges = new Map(), adjacency = new Map(), boundary = new Map();
  const join = (graph, a, b) => {
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a).add(b); graph.get(b).add(a);
  };
  const index = geometry.index.array;
  for (let i = 0; i < index.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = index[i + j], b = index[i + (j + 1) % 3];
      assert.notEqual(a, b);
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      const edge = edges.get(key) || { a, b, count: 0 };
      edge.count++; edges.set(key, edge); join(adjacency, a, b);
    }
  }
  for (const edge of edges.values()) {
    assert.ok(edge.count <= 2, "Welding must not create a nonmanifold edge");
    if (edge.count === 1) join(boundary, edge.a, edge.b);
  }
  const components = graph => {
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
  for (const neighbors of boundary.values()) assert.equal(neighbors.size, 2, "Each boundary must close into a loop");
  return {
    components: components(adjacency), boundaryLoops: components(boundary),
    euler: adjacency.size - edges.size + index.length / 3,
  };
}

test("all 25 phase charts satisfy the Fermat slice and embed in the ambient Calabi–Yau quintic", () => {
  const phase = [Math.cos(Math.PI / 5), Math.sin(Math.PI / 5)];
  for (let k1 = 0; k1 < 5; k1++) {
    for (let k2 = 0; k2 < 5; k2++) {
      for (const theta of [0, 0.017, 0.29, 0.81, 1.37, Math.PI / 2]) {
        for (const xi of [-1.08, -0.431, 0, 0.017, 0.672, 1.08]) {
          const point = calabiYauPoint(theta, xi, k1, k2);
          assert.ok(point.every(Number.isFinite));
          assert.ok(residual(point) < 1e-12, "The complex equation must hold before projection");
          // [1 : exp(iπ/5)z₁ : exp(iπ/5)z₂ : 0 : 0] lies in Σ Zⱼ⁵=0.
          const z1 = fifth(multiply(phase, point.slice(0, 2)));
          const z2 = fifth(multiply(phase, point.slice(2, 4)));
          assert.ok(Math.hypot(1 + z1[0] + z2[0], z1[1] + z2[1]) < 1e-12);
        }
      }
    }
  }
});

test("chart boundaries obey the phase identifications and the finite cutoff equation", () => {
  for (let k1 = 0; k1 < 5; k1++) {
    for (let k2 = 0; k2 < 5; k2++) {
      for (const xi of [0, 0.031, 0.52, CALABI_YAU.xiMax]) {
        assert.ok(distance(calabiYauPoint(0, xi, k1, k2),
          calabiYauPoint(0, -xi, k1, (k2 + 1) % 5)) < 1e-12);
        assert.ok(distance(calabiYauPoint(Math.PI / 2, xi, k1, k2),
          calabiYauPoint(Math.PI / 2, -xi, (k1 + 4) % 5, k2)) < 1e-12);
      }
    }
  }
  for (const theta of [0, 0.18, 0.63, 1.17, Math.PI / 2]) {
    const p = calabiYauPoint(theta, CALABI_YAU.xiMax, 2, 3);
    const radial = Math.hypot(...p.slice(0, 2)) ** 5 + Math.hypot(...p.slice(2, 4)) ** 5;
    assert.ok(Math.abs(radial - Math.cosh(2 * CALABI_YAU.xiMax)) < 1e-12);
  }
});

test("the displayed mesh retains the equation, its documented projection, and genus-six topology with five open ends", () => {
  const group = createHero();
  try {
    assert.equal(group.children.filter(object => object.isLine).length, 0,
      "The superseded height-field ascent does not belong on this complex slice");
    const geometry = group.children.find(object => object.isMesh).geometry;
    const p = geometry.attributes.position, c = geometry.attributes.complexPosition;
    assert.ok(geometry.index.count / 3 <= 16000, "Authoring must respect the shared renderer budget");
    for (let i = 0; i < p.count; i++) {
      const point = [...c.array.slice(i * 4, i * 4 + 4)];
      assert.ok(residual(point) < 0.000004, "Every retained Float32 vertex must satisfy the source equation");
      assert.ok(distance(projectCalabiYau(point), [p.getX(i), p.getY(i), p.getZ(i)]) < 0.0000002);
    }
    // A compact degree-five plane curve has genus (5−1)(5−2)/2=6.
    // This finite affine slice removes five ends: χ=2−2×6−5=−15.
    assert.deepEqual(topology(geometry), { components: 1, boundaryLoops: 5, euler: -15 });
  } finally { dispose(group); }
});

test("the 3D map is a projection that discards one real coordinate, not a full-dimensional embedding", () => {
  const point = [0.24, -0.68, 0.57, 0.91];
  const projected = projectCalabiYau(point);
  const hidden = -Math.sin(CALABI_YAU.projectionAngle) * point[1] + Math.cos(CALABI_YAU.projectionAngle) * point[3];
  const lengthSquared = values => values.reduce((sum, value) => sum + value * value, 0);
  assert.ok(Math.abs(lengthSquared(point) - lengthSquared(projected) - hidden * hidden) < 1e-14,
    "The displayed and discarded coordinates must form an orthogonal decomposition");
  const shifted = point.map((value, i) => value + [0, -Math.sin(CALABI_YAU.projectionAngle), 0, Math.cos(CALABI_YAU.projectionAngle)][i]);
  assert.ok(distance(projected, projectCalabiYau(shifted)) < 1e-14,
    "Distinct R⁴ points can share one screen sculpture position");
});
