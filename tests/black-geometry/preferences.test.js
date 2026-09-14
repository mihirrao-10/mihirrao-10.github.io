import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, QUALITY, motionPolicy } from '../../src/black-geometry/preferences.js';
test('highest-quality presentation preserves OS reduced motion', () => {
  assert.deepEqual(DEFAULTS, { motion: 'on', quality: 'high' });
  assert.equal(QUALITY.high.dpr, 2);
  assert.equal(QUALITY.high.fps, 60);
  assert.equal(motionPolicy(false), 'full');
  assert.equal(motionPolicy(true), 'reduced');
});
