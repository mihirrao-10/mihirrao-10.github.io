import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveScene } from '../../src/black-geometry/navigation.js';

const ids = ['top', 'education', 'experience', 'personal-projects', 'notes'];

test('page links retain old section aliases and reject unknown or malformed fragments', () => {
  for (const id of ids) assert.equal(resolveScene(`#${id}`, ids), id);
  assert.equal(resolveScene('#education-uchicago', ids), 'education');
  assert.equal(resolveScene('#experience-mathworks', ids), 'experience');
  assert.equal(resolveScene('#project-surface', ids), 'personal-projects');
  assert.equal(resolveScene('#contact', ids), 'notes');
  assert.equal(resolveScene('#main', ids), 'top');
  assert.equal(resolveScene('#education%2Ddrexel', ids), 'education');
  for (const fragment of ['', '#unknown', '#%E0%A4%A']) assert.equal(resolveScene(fragment, ids), 'top');
});
