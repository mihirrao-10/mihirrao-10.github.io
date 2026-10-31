import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import { MAP_FILES, decodeMap } from '../../src/black-geometry/astronomy-maps.js';
const maps=Object.fromEntries(Object.entries(MAP_FILES).map(([name,file])=>[name,decodeMap(fs.readFileSync(new URL(`../../assets/black-geometry/textures/${file}`,import.meta.url)))]));
import { createCosmos, COSMIC_TARGETS } from '../../src/black-geometry/cosmos.js';
import { nebulaParticle } from '../../src/black-geometry/nebula-cloud.js';
import { quasarJetPosition } from '../../src/black-geometry/quasar.js';
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


test('the graphic pool contains seven distinct cosmic subjects', () => {
  const expected = ['Globular star cluster', 'Colliding galaxies', 'Milky Way', 'Nebula', 'Black hole', 'Quasar', 'Solar system'];
  assert.deepEqual(COSMIC_TARGETS.map(name => { const scene = createCosmos(name, { maps }); const theme = scene.theme; scene.dispose(); return theme; }), expected);
});

test('the oblique solar system has eight separate orbiting planets and one sun', () => {
  const scene = createCosmos('notes', { maps });
  const planets = [], sun = [], paths = [];
  scene.root.traverse(object => {
    if (object.userData.role === 'planet') planets.push(object);
    if (object.userData.role === 'central-sun') sun.push(object);
    if (object.userData.posterKind === 'orbit') paths.push(object);
  });
  assert.equal(scene.planetCount, 8); assert.equal(planets.length, 8); assert.equal(paths.length, 8); assert.equal(sun.length, 1);
  assert.ok(scene.orbitRadii.every((r, i, list) => i === 0 || r > list[i - 1]));
  const positions = planets.map(object => object.getWorldPosition(new THREE.Vector3()));
  scene.update(10);
  for (const [i, planet] of planets.entries()) {
    assert.ok(planet.getWorldPosition(new THREE.Vector3()).distanceTo(positions[i]) > .1);
    assert.ok(planet.getWorldPosition(new THREE.Vector3()).length() < scene.radius);
  }
  scene.dispose();
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


test('quasar jets occupy both poles and flow inside the scene bounds', () => {
  const scene = createCosmos('projects', { maps });
  let jets; scene.root.traverse(object => { if (object.userData.role === 'quasar-jets') jets = object; });
  assert.ok(jets?.isPoints);
  for (const side of [-1, 1]) for (const u of [.1, .4, .8]) {
    const a = quasarJetPosition(u, .8, .7, side, 0);
    const b = quasarJetPosition(u, .8, .7, side, 1);
    assert.equal(Math.sign(a[1]), side);
    assert.ok(Math.abs(b[1]) > Math.abs(a[1]));
    assert.ok(Math.hypot(...b) < scene.radius);
  }
  const attributes = jets.geometry.attributes;
  for (let i = 0; i < attributes.position.count; i += 997) {
    const at = time => quasarJetPosition(attributes.along.getX(i), attributes.angle.getX(i),
      attributes.shell.getX(i), attributes.side.getX(i), time, attributes.rate.getX(i));
    const initial = new THREE.Vector3().fromBufferAttribute(attributes.position, i);
    assert.ok(initial.distanceTo(new THREE.Vector3(...at(0))) < 1e-6, 'Poster and live jets must start at the same positions');
    for (const time of [0, .01, 1, 20, 100, 1000]) {
      const position = at(time);
      assert.ok(position.every(Number.isFinite), 'Animated jet particles must stay finite');
      assert.ok(Math.hypot(...position) < scene.radius, 'Animated jet particles must stay inside rotation-safe bounds');
    }
  }
  scene.dispose();
});
