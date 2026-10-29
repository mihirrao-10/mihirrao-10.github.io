import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEducation, createExperience, createProjects } from '../../src/black-geometry/sculptures/abstract.js';

for (const factory of [createEducation, createExperience, createProjects]) {
  test(`${factory.name} has finite, regular, grayscale geometry with the intended boundary`, () => {
    const root = factory(), mesh = root.children[0], geometry = mesh.geometry;
    const position = geometry.getAttribute('position'), color = geometry.getAttribute('color');
    const index = geometry.index.array, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    assert.ok(position.array.every(Number.isFinite));
    const edges = new Map();
    const key = i => [position.getX(i), position.getY(i), position.getZ(i)].map(v => Math.round(v * 1e5)).join(',');
    for (let i = 0; i < position.count; i++) {
      assert.equal(color.getX(i), color.getY(i));
      assert.equal(color.getY(i), color.getZ(i));
    }
    for (let i = 0; i < index.length; i += 3) {
      const ids = Array.from(index.slice(i, i + 3));
      a.fromBufferAttribute(position, ids[0]); b.fromBufferAttribute(position, ids[1]); c.fromBufferAttribute(position, ids[2]);
      assert.ok(b.sub(a).cross(c.sub(a)).length() > 1e-7, 'No collapsed triangles, including the closing seam');
      const keys = ids.map(key);
      for (let j = 0; j < 3; j++) {
        const edge = [keys[j], keys[(j + 1) % 3]].sort().join('|');
        edges.set(edge, (edges.get(edge) || 0) + 1);
      }
    }
    const boundary = [...edges.values()].filter(count => count === 1).length;
    assert.ok([...edges.values()].every(count => count === 1 || count === 2));
    assert.equal(boundary, factory === createProjects ? 480 : 0);
    assert.ok(index.length / 3 < 65536);
    geometry.dispose(); mesh.material.dispose();
  });
}
