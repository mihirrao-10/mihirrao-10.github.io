import test from 'node:test';
import assert from 'node:assert/strict';
import { createCosmos } from '../../src/black-geometry/cosmos.js';
import { warpSpacetime } from '../../src/black-geometry/spacetime.js';
import { dipolePoint } from '../../src/black-geometry/neutron-star.js';

test('the black-hole well bends a background grid around an unshaded shadow',()=>{
  const scene=createCosmos('teaching');let shadow,grids=0;
  scene.root.traverse(o=>{if(o.userData.posterKind==='event-horizon')shadow=o;if(o.userData.posterKind==='spacetime-grid')grids++;});
  assert.equal(grids,2);assert.equal(shadow.geometry.type,'CircleGeometry');
  assert.equal(shadow.material.type,'MeshBasicMaterial');assert.ok(shadow.material.opacity>.98);
  assert.ok(warpSpacetime(.3,.1)[2]<warpSpacetime(2.5,.1)[2]-.8,'The center must visibly deepen');
  assert.ok(warpSpacetime(.7,0)[0]>.7,'Lensing should bend grid lines around the shadow');
  assert.notDeepEqual(warpSpacetime(1,1,0),warpSpacetime(1,1,4));
  scene.dispose();
});

test('dipolar magnetic loops meet the neutron-star surface and enclose a volume',()=>{
  for(const extent of [1.35,1.9,2.55]){
    const theta=Math.asin(Math.sqrt(.86/extent));
    assert.ok(Math.abs(dipolePoint(theta,.4,extent).length()-.86)<1e-12);
    assert.ok(Math.abs(dipolePoint(Math.PI-theta,.4,extent).length()-.86)<1e-12);
    assert.ok(Math.abs(dipolePoint(Math.PI/2,.4,extent).length()-extent)<1e-12);
  }
  const scene=createCosmos('publications'),fields=[],beams=[];
  scene.root.traverse(o=>{if(o.userData.posterKind==='magnetic-field')fields.push(o);if(o.userData.posterKind==='pulsar-beam')beams.push(o);});
  assert.equal(fields.length,72);assert.equal(beams.length,4);
  const before=fields[0].matrixWorld.elements.slice();scene.update(2);
  assert.notDeepEqual(fields[0].matrixWorld.elements,before,'Magnetic fields and beams should sweep with the star');
  scene.dispose();
});
