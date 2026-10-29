import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCosmos } from '../../src/black-geometry/cosmos.js';
import { accretionPoint } from '../../src/black-geometry/tessellated-accretion.js';
import { deformFacet } from '../../src/black-geometry/tessellation.js';
import { dipolePoint } from '../../src/black-geometry/neutron-star.js';

test('the black hole has a flowing triangular disk without a background grid',()=>{
  const scene=createCosmos('teaching'),roles=[];
  scene.root.traverse(o=>{if(o.geometry){assert.ok(o.isMesh);assert.equal(o.userData.tessellated,true);roles.push(o.userData.role);}});
  assert.ok(roles.includes('accretion-disk')&&roles.includes('event-horizon')&&roles.includes('lensed-disk'));
  const p=accretionPoint(.31,.4),q=accretionPoint(.31,.41),distance=(a,b)=>new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
  for(const t of [0,1,30,1000,100000]){
    const next=deformFacet(p,t,.30,.045),neighbor=deformFacet(q,t,.30,.045);
    assert.ok(Math.abs(Math.hypot(next[0],next[2])-Math.hypot(p[0],p[2]))<1e-10,'Flow preserves radial distance');
    assert.ok(distance(next,neighbor)<distance(p,q)*2,'The flowing lattice must not stretch indefinitely');
  }
  assert.notDeepEqual(deformFacet(p,2,.30,.045),p);
  scene.dispose();
});

test('magnetic ribbons meet the neutron-star surface and sweep with the poles',()=>{
  for(const extent of [1.55,2.35]){
    const theta=Math.asin(Math.sqrt(.78/extent));
    assert.ok(Math.abs(dipolePoint(theta,.4,extent).length()-.78)<1e-12);
    assert.ok(Math.abs(dipolePoint(Math.PI-theta,.4,extent).length()-.78)<1e-12);
    assert.ok(Math.abs(dipolePoint(Math.PI/2,.4,extent).length()-extent)<1e-12);
  }
  const scene=createCosmos('publications'),fields=[],beams=[];
  scene.root.traverse(o=>{if(o.userData.role==='magnetic-field')fields.push(o);if(o.userData.role==='pulsar-beam')beams.push(o);});
  assert.ok(fields.length>10);assert.equal(beams.length,2);
  const before=fields[0].matrixWorld.elements.slice();scene.update(2);
  assert.notDeepEqual(fields[0].matrixWorld.elements,before);
  scene.dispose();
});
