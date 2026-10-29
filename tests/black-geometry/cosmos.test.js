import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import { MAP_FILES, decodeMap } from '../../src/black-geometry/astronomy-maps.js';
const maps=Object.fromEntries(Object.entries(MAP_FILES).map(([name,file])=>[name,decodeMap(fs.readFileSync(new URL(`../../assets/black-geometry/textures/${file}`,import.meta.url)))]));
import { createCosmos, COSMIC_TARGETS } from '../../src/black-geometry/cosmos.js';
import { sculptureOpacity } from '../../src/black-geometry/world.js';

for (const name of COSMIC_TARGETS) {
  test(`${name} has a detailed finite geometry, stable motion, and deterministic sampling`, () => {
    const scene = createCosmos(name,{maps}), again = createCosmos(name,{maps});
    const positions = root => {
      const arrays = []; root.traverse(object => { if (object.geometry) arrays.push(object.geometry.attributes.position.array); });
      return arrays;
    };
    assert.deepEqual(positions(scene.root), positions(again.root));
    let triangles = 0, particles = 0;
    const geometries = new Set();
    scene.root.traverse(object => {
      if (!object.geometry) return;
      geometries.add(object.geometry);
      for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      if (object.isMesh) triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
      if (object.isPoints) particles += object.geometry.attributes.position.count;
      assert.equal(object.material.transparent, true);
      assert.equal(object.material.depthWrite, !!object.material.userData.bodyDepth, 'Only coherent planetary surfaces write depth');

    });
    assert.ok(triangles > 10000 && triangles < 1000000);
    assert.ok(['hero', 'education', 'teaching'].includes(name) ? particles === 0 : particles > 2000 && particles < (name==='projects'?260000:160000));
    const point = new THREE.Vector3();
    const first = [];
    scene.root.traverse(object => { if (object.isMesh) first.push(object.matrixWorld.elements.slice()); });
    for (const time of [1, 20, 100, 1000]) {
      scene.update(time, .7, 2);
      assert.equal(scene.uniforms.time.value, time);
      assert.equal(scene.uniforms.presence.value, .7);
      scene.root.traverse(object => {
        if (!object.geometry) return;
        assert.ok(geometries.has(object.geometry), 'Orbit updates must reuse buffers');
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
        const position = object.geometry.attributes.position;
        for (let i = 0; i < position.count; i += 13) {
          point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
          assert.ok(point.length() < scene.bounds[0].radius, 'Moving bodies must stay inside their rotation-safe fit');
        }
      });
    }
    const last = [];
    scene.root.traverse(object => { if (object.isMesh) last.push(object.matrixWorld.elements.slice()); });
    assert.notDeepEqual(last, first, 'At least one shell or satellite must move');
    scene.update(0, 1, 1);
    for (const material of scene.materials) if (material.userData.bodyDepth) assert.equal(material.depthWrite, true);
    assert.ok(scene.materials.size <= geometries.size);
    scene.dispose(); again.dispose();
  });
}

test('the mathematical introduction is lighter and the Notes opacity stays unchanged', () => {
  assert.equal(sculptureOpacity('hero'), .30);
  assert.equal(sculptureOpacity('notes'), .32);
});

// The sequence travels from nearby bodies to structures beyond a single galaxy.
test('navigation moves outward in scale and Saturn contains only its ringed planet',()=>{
  const expected=['Earth and Moon','Saturn','Sun','Solar system','Black hole','Spiral galaxy','Galaxy cluster'];
  COSMIC_TARGETS.forEach((target,i)=>{
    const scene=createCosmos(target,{maps});assert.equal(scene.theme,expected[i]);
    if(target==='education'){
      const bodies=[];scene.root.traverse(o=>{if(o.userData.posterKind==='body')bodies.push(o);});
      assert.equal(bodies.length,1);assert.equal(bodies[0].userData.surfaceKind,2);
    }
    scene.dispose();
  });
});

for(const name of ['projects','notes'])test(`${name} has a moving stellar volume with orbit-safe depth`,()=>{
  const scene=createCosmos(name,{maps}),points=[];let imageSheets=0;
  scene.root.traverse(o=>{if(o.isPoints)points.push(o);if(o.userData.posterKind==='field')imageSheets++;});
  assert.equal(imageSheets,0,'The live scene must not contain an image-backed sheet');
  assert.equal(scene.volumeKind,name==='projects'?'stellar-disk':'galaxy-population');
  const ranges=[[],[],[]],p=new THREE.Vector3(),center=new THREE.Vector3(),axis=new THREE.Vector3();
  let moving=0;
  for(const object of points){
    const data=object.geometry.attributes;
    for(let i=0;i<data.position.count;i+=97){
      for(let k=0;k<3;k++)ranges[k].push(data.position.array[i*3+k]);
      center.fromBufferAttribute(data.orbitCenter,i);axis.fromBufferAttribute(data.orbitAxis,i);
      assert.ok(Math.abs(axis.length()-1)<1e-6);
      p.fromBufferAttribute(data.position,i).sub(center);
      const before=p.clone();p.applyAxisAngle(axis,data.rate.getX(i)*2);
      if(p.distanceTo(before)>.003)moving++;
      for(const time of [0,3,1000]){
        p.fromBufferAttribute(data.position,i).sub(center).applyAxisAngle(axis,data.rate.getX(i)*time).add(center);
        assert.ok(p.length()<scene.radius,'GPU particle orbits must stay inside the fit at every orientation');
      }
    }
  }
  for(const values of ranges){values.sort((a,b)=>a-b);assert.ok(values[Math.floor(values.length*.95)]-values[Math.floor(values.length*.05)]>.20,'Depth must span a volume');}
  assert.ok(moving>200,'Individual stars must move in addition to the camera');
  if(name==='notes'){
    assert.equal(scene.galaxyCenters.length,112);
    assert.ok(Math.max(...scene.galaxyRadii)<.10,'Cluster members should read as small distant galaxies');
    assert.ok(Math.max(...scene.galaxyRadii)/scene.radius<.04);
    const depths=scene.galaxyCenters.map(c=>c[2]);assert.ok(Math.max(...depths)-Math.min(...depths)>2);
  }
  scene.dispose();
});
