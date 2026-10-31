import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffledTargets, assignSceneTargets } from '../../src/black-geometry/scene-assignments.js';

test('a launch assigns every graphic exactly once without changing page identities', () => {
  const targets = ['hero', 'education', 'experience', 'publications', 'teaching', 'projects', 'notes'];
  const scenes = targets.map(id => ({ id, dataset: { target: id } }));
  assignSceneTargets(scenes, () => 0);
  assert.deepEqual(scenes.map(scene => scene.id), targets);
  assert.deepEqual(scenes.map(scene => scene.dataset.target).sort(), [...targets].sort());
  assert.notDeepEqual(scenes.map(scene => scene.dataset.target), targets);
  assert.deepEqual(targets, ['hero', 'education', 'experience', 'publications', 'teaching', 'projects', 'notes']);
  assert.notDeepEqual(shuffledTargets(targets, () => 0), shuffledTargets(targets, () => .999));
});
