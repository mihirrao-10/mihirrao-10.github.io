import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDragon } from '../../src/black-geometry/sculptures/dragon.js';

test('dragon refinements preserve its approved silhouette, palette and usable surface budget', () => {
  const model = createDragon(); model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  // The added anatomy must not enlarge the accepted silhouette or drive a
  // different renderer fit. These are measured pre-refinement dimensions.
  for (const [actual, previous] of [[size.x, 5.335435], [size.y, 5.096771], [size.z, 1.980038]])
    assert.ok(Math.abs(actual - previous) < 0.02);
  const colors = new Set(); let triangles = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    colors.add(mesh.material.color.getHexString());
    const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
    assert.ok(position.array.every(Number.isFinite));
    assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      a.fromBufferAttribute(position, index ? index.getX(i) : i);
      b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1);
      c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2);
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18, `${mesh.name} has a collapsed surface triangle`);
      triangles++;
    }
  });
  assert.ok(triangles > 30000 && triangles <= 65536);
  assert.ok(colors.has('07294d') && colors.has('ffc600'), 'The official navy body and gold structure remain distinct');
});

test('neck and tail scale relief stays attached to the anatomy and both skull sides have eyes', () => {
  const model = createDragon(); model.updateMatrixWorld(true);
  let scales = 0;
  model.traverse(mesh => {
    if (!mesh.isMesh || !/imbricate|keeled/.test(mesh.name)) return;
    const box = new THREE.Box3().setFromObject(mesh), center = box.getCenter(new THREE.Vector3());
    const core = model.getObjectByName(mesh.name.startsWith('Tail') ? 'Long articulated tail' : 'Continuous chest and neck');
    const ray = new THREE.Raycaster(new THREE.Vector3(center.x, center.y, 3), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(core)[0];
    assert.ok(hit, `${mesh.name} must sit over the actual body surface`);
    const relief = box.max.z - hit.point.z;
    assert.ok(relief > 0 && relief < 0.06, `${mesh.name} must be visible low relief, not a detached plate`);
    scales++;
  });
  assert.ok(scales >= 10);
  const center = object => new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
  const skull = center(model.getObjectByName('Angular skull and long snout'));
  const near = center(model.getObjectByName('Gold slit eye'));
  const far = center(model.getObjectByName('Far gold slit eye'));
  assert.ok(near.z > skull.z + 0.15 && far.z < skull.z - 0.15, 'Rotation should reveal eyes on opposite skull surfaces');
  assert.ok(Math.abs(near.x - far.x) < 0.001 && Math.abs(near.y - far.y) < 0.001);
});
