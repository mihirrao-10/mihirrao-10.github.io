import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, QUALITY, renderingDpr, createResolutionBudget } from '../../src/black-geometry/preferences.js';
test('highest-quality presentation defaults to animation', () => {
  assert.deepEqual(DEFAULTS, { motion: 'on', quality: 'high' });
  assert.equal(QUALITY.high.dpr, 2);
  assert.equal(QUALITY.high.fps, 60);
});
test('render resolution retains phone detail and bounds large high-DPI GPU work', () => {
  assert.equal(renderingDpr(390, 360, 3), 2);
  assert.equal(renderingDpr(720, 900, 1), 1);
  const large = renderingDpr(1600, 1800, 2);
  assert.ok(large > 1 && large < 1.1);
  assert.equal(renderingDpr(390, 360, 3, .8), .8);
});

test('high-DPI artwork retains detail and resolution adaptation stays local to its scene',()=>{
  assert.equal(renderingDpr(900,900,2),Math.sqrt(3000000/(900*900)));
  const budget=createResolutionBudget();assert.equal(budget.select('teaching'),2);
  for(let i=0;i<200;i++)budget.record(40);
  assert.equal(budget.select('teaching'),1.25);
  assert.equal(budget.select('education'),2,'Ray tracing must not soften subsequent planet artwork');
  for(let i=0;i<200;i++)budget.record(16.7);
  assert.equal(budget.select('education'),2);
  assert.equal(budget.select('teaching'),1.25,'Returning scenes retain their measured budget');
});
