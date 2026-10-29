import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEducation, createExperience, createProjects, permutationGraph, lossValue, lossGradient, descentPath, policyGraph } from '../../src/black-geometry/sculptures/abstract.js';

for (const factory of [createEducation, createExperience, createProjects]) {
  test(`${factory.name} produces finite grayscale geometry within the prepared facet budget`, () => {
    const root = factory(); let faces = 0;
    root.updateMatrixWorld(true);
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry, position = geometry.getAttribute('position'), color = geometry.getAttribute('color');
      assert.ok(position.array.every(Number.isFinite));
      assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));
      assert.equal(mesh.material.color.r, mesh.material.color.g);
      assert.equal(mesh.material.color.g, mesh.material.color.b);
      if (color) for (let i = 0; i < color.count; i++) {
        assert.equal(color.getX(i), color.getY(i)); assert.equal(color.getY(i), color.getZ(i));
      }
      const index = geometry.index, count = index?.count || position.count;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < count; i += 3) {
        a.fromBufferAttribute(position, index ? index.getX(i) : i);
        b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1);
        c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2);
        assert.ok(b.sub(a).cross(c.sub(a)).length() > 1e-12, 'No collapsed source triangles');
      }
      faces += count / 3; geometry.dispose(); mesh.material.dispose();
    });
    assert.ok(faces > 1000 && faces < 65536);
  });
}

test('permutation polytope uses genuine adjacent-value edges and a shortest sorting route', () => {
  const { permutations, points, edges, path } = permutationGraph();
  assert.equal(permutations.length, 24); assert.equal(edges.length, 36);
  assert.equal(new Set(permutations.map(p => p.join(','))).size, 24);
  const degree = Array(24).fill(0), keys = new Set();
  for (const [a, b] of edges) {
    degree[a]++; degree[b]++; keys.add([a, b].sort((x, y) => x - y).join(','));
    const changed = permutations[a].map((value, i) => Math.abs(value - permutations[b][i])).filter(Boolean);
    assert.deepEqual(changed, [1, 1]);
    assert.ok(Math.abs(new THREE.Vector3(...points[a]).distanceTo(new THREE.Vector3(...points[b])) - Math.sqrt(2)) < 1e-12);
  }
  assert.ok(degree.every(value => value === 3));
  assert.equal(path.length - 1, 6); // Reversal has six inversions and each edge changes one.
  for (let i = 1; i < path.length; i++) assert.ok(keys.has([path[i - 1], path[i]].sort((x, y) => x - y).join(',')));
});

test('loss gradients agree with finite differences and all displayed trajectories decrease the objective', () => {
  const epsilon = 1e-5;
  for (const x of [-1.8, -.4, .5, 1.6]) for (const z of [-1.6, -.2, .7, 1.7]) {
    const numeric = [(lossValue(x + epsilon, z) - lossValue(x - epsilon, z)) / (2 * epsilon),
      (lossValue(x, z + epsilon) - lossValue(x, z - epsilon)) / (2 * epsilon)];
    lossGradient(x, z).forEach((value, i) => assert.ok(Math.abs(value - numeric[i]) < 1e-8));
  }
  for (const start of [[-1.9, 1.8], [1.7, 1.8], [1.8, -1.8]]) {
    const path = descentPath(start);
    assert.ok(path.length > 5);
    for (let i = 1; i < path.length; i++) assert.ok(lossValue(...path[i]) < lossValue(...path[i - 1]));
    assert.ok(Math.hypot(...lossGradient(...path.at(-1))) < .005);
  }
});

test('Bellman policy matches exhaustive discounted returns across all decision paths', () => {
  const { states, edges, path, gamma, depth } = policyGraph();
  assert.equal(states.length, 28); assert.equal(edges.length, 42);
  assert.equal(path.length, depth + 1);
  function bestReturn(id) {
    const state = states[id];
    return state.actions.length ? Math.max(...state.actions.map(action => action.reward + gamma * bestReturn(action.next))) : state.value;
  }
  assert.ok(Math.abs(states[0].value - bestReturn(0)) < 1e-12);
  for (let i = 0; i < path.length - 1; i++) {
    const state = states[path[i]];
    assert.equal(path[i + 1], state.actions[state.policy].next);
    assert.equal(state.value, Math.max(...state.actions.map(action => action.q)));
  }
});
