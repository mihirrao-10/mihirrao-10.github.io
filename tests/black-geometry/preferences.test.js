import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, QUALITY, motionPolicy, renderingDpr } from '../../src/black-geometry/preferences.js';
test('highest-quality presentation preserves OS reduced motion', () => {
  assert.deepEqual(DEFAULTS, { motion: 'on', quality: 'high' });
  assert.equal(QUALITY.high.dpr, 2);
  assert.equal(QUALITY.high.fps, 60);
  assert.equal(motionPolicy(false), 'full');
  assert.equal(motionPolicy(true), 'reduced');
});
test('render resolution retains phone detail and bounds large high-DPI GPU work', () => {
  assert.equal(renderingDpr(390, 360, 3), 2);
  assert.equal(renderingDpr(720, 900, 1), 1);
  const large = renderingDpr(1600, 1800, 2);
  assert.ok(large < 1 && large >= .75);
  assert.equal(renderingDpr(390, 360, 3, .8), .8);
});
