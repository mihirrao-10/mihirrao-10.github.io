import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import { MAP_FILES, decodeMap } from '../../src/black-geometry/astronomy-maps.js';
const maps=Object.fromEntries(Object.entries(MAP_FILES).map(([name,file])=>[name,decodeMap(fs.readFileSync(new URL(`../../assets/black-geometry/textures/${file}`,import.meta.url)))]));
import { createCosmos, COSMIC_TARGETS } from '../../src/black-geometry/cosmos.js';
import { nebulaParticle } from '../../src/black-geometry/nebula-cloud.js';
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
    const geometries = new Set(), materials = new Set();
    scene.root.traverse(object => {
      if (!object.geometry) return;
      geometries.add(object.geometry); materials.add(object.material);
      for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      if (object.isMesh) triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
      if (object.isPoints) particles += object.geometry.attributes.position.count;
      assert.equal(object.material.transparent, true);
      assert.equal(object.material.depthWrite, !!object.material.userData.bodyDepth, 'Only coherent planetary surfaces write depth');

    });
    assert.ok(triangles + particles > 0);
    const point = new THREE.Vector3();
    const first = [];
    scene.root.traverse(object => { if (object.geometry) first.push(object.matrixWorld.elements.slice()); });
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
          point.fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld);
          assert.ok(point.length() < scene.bounds[0].radius, 'Moving bodies must stay inside their rotation-safe fit');
        }
      });
    }
    const last = [];
    scene.root.traverse(object => { if (object.geometry) last.push(object.matrixWorld.elements.slice()); });
    assert.notDeepEqual(last, first, 'At least one shell or satellite must move');
    scene.update(0, 1, 1);
    for (const material of scene.materials) if (material.userData.bodyDepth) assert.equal(material.depthWrite, true);
    assert.deepEqual(scene.materials, materials, 'Every registered material must belong to a drawable object');
    scene.dispose(); again.dispose();
  });
}

test('the mathematical introduction is lighter and the Notes opacity stays unchanged', () => {
  assert.equal(sculptureOpacity('hero'), .30);
  assert.equal(sculptureOpacity('notes'), .32);
});

test('navigation preserves seven distinct cosmic subjects',()=>{
  const themes = COSMIC_TARGETS.map(target=>{
    const scene=createCosmos(target,{maps});const theme=scene.theme;scene.dispose();return theme;
  });
  assert.equal(new Set(themes).size,7);
});

for(const name of ['hero','education','experience','publications'])test(`${name} contains stars distributed in three dimensions`,()=>{
  const scene=createCosmos(name,{maps}),clouds=[];
  scene.root.traverse(o=>{if(o.isPoints)clouds.push(o);});
  assert.ok(clouds.length>0);
  for(const cloud of clouds){
    cloud.geometry.computeBoundingBox();
    const size=cloud.geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.x>0&&size.y>0&&size.z>0);
  }
  scene.dispose();
});


test('the seven homepage scenes follow the requested visual order', () => {
  const expected = ['Globular star cluster', 'Colliding galaxies', 'Milky Way', 'Nebula', 'Black hole', 'Seven-planet solar system', '2001 monolith'];
  assert.deepEqual(COSMIC_TARGETS.map(name => { const scene = createCosmos(name, { maps }); const theme = scene.theme; scene.dispose(); return theme; }), expected);
});

test('the compact solar system has seven separate orbiting planets and one sun', () => {
  const scene = createCosmos('projects', { maps });
  const planets = [], sun = [], paths = [];
  scene.root.traverse(object => {
    if (object.userData.role === 'planet') planets.push(object);
    if (object.userData.role === 'central-sun') sun.push(object);
    if (object.userData.posterKind === 'orbit') paths.push(object);
  });
  assert.equal(scene.planetCount, 7); assert.equal(planets.length, 7); assert.equal(paths.length, 7); assert.equal(sun.length, 1);
  assert.ok(scene.orbitRadii.every((r, i, list) => i === 0 || r > list[i - 1]));
  const positions = planets.map(object => object.getWorldPosition(new THREE.Vector3()));
  scene.update(10);
  for (const [i, planet] of planets.entries()) {
    assert.ok(planet.getWorldPosition(new THREE.Vector3()).distanceTo(positions[i]) > .1);
    assert.ok(planet.getWorldPosition(new THREE.Vector3()).length() < scene.radius * .8);
  }
  scene.dispose();
});

test('the final monolith is a solid rectangular slab with 1:4:9 proportions', () => {
  const scene = createCosmos('notes', { maps }); let slab;
  scene.root.traverse(object => { if (object.userData.role === 'monolith') slab = object; });
  assert.ok(slab?.isMesh); const { width, height, depth } = slab.geometry.parameters;
  assert.equal(width / depth, 4); assert.equal(height / depth, 9);
  assert.equal(slab.material.depthWrite, true); scene.dispose();
});

test('travel streaks move through space while staying parallel to the monolith in every orientation', () => {
  const scene=createCosmos('notes',{maps});let slab,streaks;
  scene.root.traverse(object=>{if(object.userData.role==='monolith')slab=object;if(object.userData.role==='travel-streaks')streaks=object;});
  assert.ok(streaks?.isLineSegments);const geometry=streaks.geometry,initial=geometry.attributes.position.array.slice();
  assert.ok(geometry.attributes.position.count>=100);
  for(const time of [0,1,10,100]){
    scene.root.quaternion.setFromEuler(new THREE.Euler(time*.19,time*.23,time*.37));scene.update(time);
    assert.equal(streaks.geometry,geometry);
    const axis=new THREE.Vector3(0,1,0).transformDirection(slab.matrixWorld);
    const p=new THREE.Vector3(),q=new THREE.Vector3();
    for(let i=0;i<geometry.attributes.position.count;i+=2){
      p.fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(streaks.matrixWorld);
      q.fromBufferAttribute(geometry.attributes.position,i+1).applyMatrix4(streaks.matrixWorld);
      const direction=p.sub(q).normalize();assert.ok(direction.clone().cross(axis).length()<1e-6);
    }
  }
  assert.notDeepEqual(geometry.attributes.position.array,initial);scene.dispose();
});

test('the nebula is a dispersed three-dimensional particle cloud with internal motion', () => {
  const scene=createCosmos('publications',{maps}),clouds=[];
  scene.root.traverse(object=>{if(object.isPoints)clouds.push(object);assert.ok(!object.isMesh,'Gas must not form a solid surface');});
  assert.equal(scene.particleCount,238000);assert.equal(clouds.length,3);
  const samples=[];
  for(const cloud of clouds){
    const a=cloud.geometry.attributes;
    cloud.geometry.computeBoundingBox();const size=cloud.geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.x>3&&size.y>1.5&&size.z>1,'Dust must occupy depth and spread around open space');
    assert.equal(cloud.material.depthWrite,false);
    for(let i=0;i<a.position.count;i+=997){
      const get=name=>[a[name].getX(i),a[name].getY(i),a[name].getZ(i)];
      const p=get('position'),center=get('orbitCenter'),axis=get('orbitAxis'),rate=a.rate.getX(i),phase=a.phase.getX(i);
      const at=t=>nebulaParticle(p,center,axis,rate,phase,t);
      assert.ok(new THREE.Vector3(...at(0)).distanceTo(new THREE.Vector3(...p))<1e-6);
      assert.ok(new THREE.Vector3(...at(.01)).distanceTo(new THREE.Vector3(...at(0)))<.02,'Dust must drift smoothly');
      for(const t of [4,20,1000])assert.ok(Math.hypot(...at(t))<scene.radius,'Flow must stay inside rotation-safe bounds');
      samples.push([at(0),at(4)]);
    }
  }
  assert.ok(samples.filter(([a,b])=>new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b))>.1).length>samples.length*.8);
  const distance=(a,b)=>new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
  assert.ok(samples.slice(1).some((sample,i)=>Math.abs(distance(samples[i][0],sample[0])-distance(samples[i][1],sample[1]))>.05),'The cloud must change internally, beyond rotating as a rigid object');
  scene.dispose();
});

test('monolith travel streaks advance at the faster travel speed', () => {
  const scene=createCosmos('notes',{maps});let streaks;
  scene.root.traverse(object=>{if(object.userData.role==='travel-streaks')streaks=object;});
  const before=streaks.geometry.attributes.position.array.slice();scene.update(.01);
  const after=streaks.geometry.attributes.position.array,velocities=[];
  for(let i=1;i<before.length;i+=6)if(before[i]>after[i])velocities.push((before[i]-after[i])/.01);
  assert.ok(velocities.length>60);
  assert.ok(velocities.every(v=>v>=2.09&&v<=4.81));scene.dispose();
});
