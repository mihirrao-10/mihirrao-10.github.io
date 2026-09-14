import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { smoothSurfaceNormals, surfaceFitBounds, fitSurfaceDistance } from '../../src/black-geometry/world.js';

const at=(array,index)=>new THREE.Vector3().fromArray(array,index*3);
test('smooth shading joins a bent surface despite reversed triangle winding and retains sharp creases',()=>{
  const angle=Math.PI/6;
  const p=new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,0, 0,-Math.cos(angle),Math.sin(angle), 1,0,0]);
  const normal=smoothSurfaceNormals(p),a=at(normal,0),b=at(normal,3);
  assert.ok(Math.abs(a.dot(b))>1-1e-6,'Shared edge normals must agree up to winding');
  assert.ok(Math.abs(a.z)>Math.cos(angle) && Math.abs(a.z)<1,'The bend must receive a genuinely smoothed normal');
  const sharp=new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,0, 0,0,1, 1,0,0]);
  const crease=smoothSurfaceNormals(sharp);
  assert.ok(Math.abs(at(crease,0).dot(at(crease,3)))<1e-6,'A right-angle edge must remain a crease');
  for(let i=0;i<normal.length;i+=3)assert.ok(Math.abs(new THREE.Vector3().fromArray(normal,i).length()-1)<1e-6);
});

test('perspective fitting encloses every source point through arbitrary quaternion rotations and tall viewports',()=>{
  const points=[];
  for(let i=0;i<1000;i++){
    const a=i*2.399963229728653,z=2*(i+.5)/1000-1,r=Math.sqrt(1-z*z);
    points.push(2.95*r*Math.cos(a),2.32*r*Math.sin(a),2.8*z);
  }
  const bounds=surfaceFitBounds(points),p=new THREE.Vector3(),q=new THREE.Quaternion();
  for(const aspect of [.13,.5,1,1.7,3])for(let i=0;i<18;i++){
    q.setFromEuler(new THREE.Euler(i*.53,i*.89,i*.37));
    const distance=fitSurfaceDistance(bounds,q,aspect),tanV=Math.tan(35*Math.PI/360);
    for(let vertex=0;vertex<points.length;vertex+=3){
      p.fromArray(points,vertex).applyQuaternion(q);
      const depth=distance-p.z;
      assert.ok(depth>.1);
      assert.ok(Math.abs(p.x)/(depth*tanV*aspect)<1 && Math.abs(p.y)/(depth*tanV)<1,'A rotated source point cannot leave the viewport');
      assert.ok(depth<Math.max(60,distance+12),'The adaptive far plane must enclose the sculpture');
    }
  }
});
