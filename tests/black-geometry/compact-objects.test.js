import test from 'node:test';
import assert from 'node:assert/strict';
import { dipolePoint } from '../../src/black-geometry/neutron-star.js';

test('archived dipole ribbons meet the neutron-star surface',()=>{
  for(const extent of [1.55,2.35]){
    const theta=Math.asin(Math.sqrt(.78/extent));
    assert.ok(Math.abs(dipolePoint(theta,.4,extent).length()-.78)<1e-12);
    assert.ok(Math.abs(dipolePoint(Math.PI-theta,.4,extent).length()-.78)<1e-12);
    assert.ok(Math.abs(dipolePoint(Math.PI/2,.4,extent).length()-extent)<1e-12);
  }
});
