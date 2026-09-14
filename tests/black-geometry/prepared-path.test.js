import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PreparedPath } from '../../src/black-geometry/world.js';

test('rendered tubes preserve nonuniform prepared samples and align with the moving marker', () => {
  // Arc-length redistribution would move the middle sample from (1,0,0) to
  // (1,4,0), cutting across the actual route and separating it from its marker.
  const points=[0,0,0, 1,0,0, 1,9,0, 2,9,1];
  const curve=new PreparedPath(points);
  const tube=new THREE.TubeGeometry(curve,6,.02,5,false);
  const positions=tube.attributes.position;
  for(let i=0;i<=6;i++) {
    const t=i/6,at=Math.min(2,Math.floor(t*3)),amount=t*3-at;
    const marker=[0,1,2].map(k=>points[at*3+k]*(1-amount)+points[(at+1)*3+k]*amount);
    const center=new THREE.Vector3();
    // Five unique vertices per ring; the sixth closes its circumference.
    for(let j=0;j<5;j++) center.add(new THREE.Vector3().fromBufferAttribute(positions,i*6+j));
    center.divideScalar(5);
    assert.ok(center.distanceTo(new THREE.Vector3(...marker))<1e-6);
    assert.deepEqual(curve.getPointAt(t).toArray(),marker);
  }
  assert.ok(tube.attributes.normal.array.every(Number.isFinite));
  tube.dispose();
});
