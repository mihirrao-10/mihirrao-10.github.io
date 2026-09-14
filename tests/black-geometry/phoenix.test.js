import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPhoenix, PHOENIX_PALETTE } from '../../src/black-geometry/sculptures/phoenix.js';

const sizeOf = (object) => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
function trianglesOf(mesh) {
  const positions = mesh.geometry.attributes.position, index = mesh.geometry.index;
  const triangles = [];
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    triangles.push([0, 1, 2].map((j) => new THREE.Vector3()
      .fromBufferAttribute(positions, index ? index.getX(i + j) : i + j)
      .applyMatrix4(mesh.matrixWorld)));
  }
  return triangles;
}

test('phoenix retains a broad bird silhouette and real depth within the authoring facet budget', () => {
  const model = createPhoenix();
  assert.ok(model.isGroup);
  model.updateMatrixWorld(true);
  let count = 0;
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    assert.ok(mesh.geometry.isBufferGeometry, 'Every solid must enter the existing facet compiler');
    for (const [a, b, c] of trianglesOf(mesh)) {
      assert.ok([...a, ...b, ...c].every(Number.isFinite), 'Coordinates must remain finite through group transforms');
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-18, 'Collapsed triangles cannot carry a normal or morph reliably');
      count++;
    }
  });
  assert.ok(count > 50000 && count <= 65536, `High-resolution sculpture budget: ${count}`);
  const size = sizeOf(model);
  assert.ok(size.x / size.y > 1.25 && size.x / size.y < 1.6, 'Spread wings should dominate the upright bird without becoming a thin banner');
  assert.ok(size.z > 1.2, 'Quarter and side views must reveal a physical bird, not a flat emblem');
  const fit = Math.min(5.9 / size.x, 4.65 / size.y, 5.6 / size.z);
  assert.ok(size.x * fit > 5.5 && size.y * fit > 4, 'The sculpture must command the intended view after uniform fitting');
});

test('the requested fire colors occupy substantial actual surface regions', () => {
  assert.deepEqual(PHOENIX_PALETTE, {
    maroon: '#f04414', lightGray: '#ffcc36', gray: '#ff8b18', darkGray: '#c5260b', white: '#fff3a0',
  });
  const model = createPhoenix(), areas = new Map();
  model.updateMatrixWorld(true);
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const color = mesh.material.color.getHexString();
    let area = areas.get(color) ?? 0;
    for (const [a, b, c] of trianglesOf(mesh)) area += b.sub(a).cross(c.sub(a)).length() / 2;
    areas.set(color, area);
  });
  const total = [...areas.values()].reduce((a, b) => a + b, 0);
  const gray = ['ffcc36', 'ff8b18', 'c5260b'].reduce((sum, color) => sum + (areas.get(color) ?? 0), 0);
  assert.ok(areas.get('f04414') / total > 0.55, 'Orange-red feathers remain the dominant fire color');
  assert.ok(gray / total > 0.20 && gray / total < 0.40, 'Gold and amber feathers form distinct substantial regions');
  assert.ok(areas.get('fff3a0') / total > 0.01, 'The pale throat and small highlights must survive facet conversion');
  assert.ok((areas.get('481005') ?? 0) / total < 0.01, 'Small eye shadows must not overwhelm the warm palette');
});

test('hooked avian head, front ruff and rear feather volumes remain spatially legible', () => {
  const model = createPhoenix(); model.updateMatrixWorld(true);
  const torso = model.getObjectByName('Deep oval avian torso');
  const skull = model.getObjectByName('Compact bird skull');
  const beak = model.getObjectByName('Upper hooked silver beak');
  const torsoBox = new THREE.Box3().setFromObject(torso), beakBox = new THREE.Box3().setFromObject(beak);
  assert.ok(sizeOf(torso).z > 0.7, 'The bird has a full oval torso');
  assert.ok(beakBox.max.z > torsoBox.max.z + 0.35, 'The hooked beak projects in front of the breast at the primary angle');
  assert.ok(beakBox.min.x < new THREE.Box3().setFromObject(skull).min.x, 'The turned head gives the beak a visible side profile from the front');
  assert.ok(beakBox.min.y > torsoBox.getCenter(new THREE.Vector3()).y + 0.7, 'The beak belongs above the torso');
  const breastFront = new THREE.Box3().setFromObject(model.getObjectByName('Feathered upper breast')).max.z;
  assert.ok(new THREE.Box3().setFromObject(model.getObjectByName('Pale throat feather 1-0')).max.z > breastFront + 0.04,
    'The pale throat stays in front of the breast instead of being occluded by it');
  let frontCoverts = 0, rearCoverts = 0;
  model.traverse((mesh) => {
    if (!mesh.isMesh || mesh.userData.anatomy !== 'feather') return;
    let volume = 0;
    for (const [a, b, c] of trianglesOf(mesh)) volume += a.dot(b.clone().cross(c)) / 6;
    assert.ok(Math.abs(volume) > 0.00005, `${mesh.name} must enclose a volume rather than form a flat card`);
    const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    if (mesh.name.startsWith('Front covert') && center.z > 0.05) frontCoverts++;
    if (mesh.name.startsWith('Rear covert') && center.z < -0.12) rearCoverts++;
  });
  assert.ok(frontCoverts >= 20 && rearCoverts >= 20, 'Both sides need a layered physical wing covering for rotation');
});
