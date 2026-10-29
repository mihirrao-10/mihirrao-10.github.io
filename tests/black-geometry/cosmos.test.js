import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import { MAP_FILES, decodeMap } from '../../src/black-geometry/astronomy-maps.js';
const maps=Object.fromEntries(Object.entries(MAP_FILES).map(([name,file])=>[name,decodeMap(fs.readFileSync(new URL(`../../assets/black-geometry/textures/${file}`,import.meta.url)))]));
import { createCosmos, COSMIC_TARGETS } from '../../src/black-geometry/cosmos.js';
import { sculptureOpacity } from '../../src/black-geometry/world.js';
import { deformFacet } from '../../src/black-geometry/tessellation.js';

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
      assert.equal(object.userData.tessellated, true);
      const { barycentric, facetValue } = object.geometry.attributes;
      assert.equal(barycentric.count, object.geometry.attributes.position.count);
      for (let i = 0; i < barycentric.count; i += 3) {
        assert.deepEqual(Array.from(barycentric.array.slice(i*3,i*3+9)), [1,0,0,0,1,0,0,0,1]);
        assert.equal(facetValue.getX(i), facetValue.getX(i+1));
        assert.equal(facetValue.getX(i), facetValue.getX(i+2));
      }
      for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      if (object.isMesh) triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
      if (object.isPoints) particles += object.geometry.attributes.position.count;
      assert.equal(object.material.transparent, true);
      assert.equal(object.material.depthWrite, !!object.material.userData.bodyDepth, 'Only coherent planetary surfaces write depth');

    });
    assert.ok(triangles > 6000 && triangles < 200000);
    assert.equal(particles, 0, 'Every scene must use tessellated surfaces instead of point clouds');
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
          const style = object.material.userData.facetStyle;
          point.fromArray(deformFacet([position.getX(i),position.getY(i),position.getZ(i)], time, style.flow, style.ripple)).applyMatrix4(object.matrixWorld);
          assert.ok(point.length() < scene.bounds[0].radius, 'Moving bodies must stay inside their rotation-safe fit');
        }
      });
    }
    const last = [];
    scene.root.traverse(object => { if (object.isMesh) last.push(object.matrixWorld.elements.slice()); });
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

// The sequence travels from nearby bodies to structures beyond a single galaxy.
test('navigation uses the requested subjects and Jupiter replaces the ringed planet',()=>{
  const expected=['Earth and Moon','Jupiter','Sun','Neutron star','Black hole','Milky Way','Galaxy cluster'];
  COSMIC_TARGETS.forEach((target,i)=>{
    const scene=createCosmos(target,{maps});assert.equal(scene.theme,expected[i]);
    if(target==='education'){
      const bodies=[];scene.root.traverse(o=>{if(o.userData.surfaceKind===2)bodies.push(o);});
      assert.equal(bodies.length,1);assert.equal(bodies[0].userData.surfaceKind,2);
    }
    scene.dispose();
  });
});

for(const name of ['projects','notes'])test(`${name} has moving triangular volumes with real depth`,()=>{
  const scene=createCosmos(name,{maps}),meshes=[];
  scene.root.traverse(o=>{if(o.isMesh)meshes.push(o);assert.ok(!o.isPoints);});
  assert.equal(scene.volumeKind,name==='projects'?'stellar-disk':'galaxy-population');
  const initial=meshes.map(o=>o.matrixWorld.elements.slice());scene.update(3);
  assert.notDeepEqual(meshes.map(o=>o.matrixWorld.elements),initial);
  if(name==='projects'){
    assert.equal(scene.galaxyCount,1);
    for(const mesh of meshes.filter(o=>o.userData.role==='spiral-arm')){
      mesh.geometry.computeBoundingBox();
      assert.ok(mesh.geometry.boundingBox.max.y-mesh.geometry.boundingBox.min.y>.20, 'Spiral arms have a closed, thick cross section');
    }
  }else{
    assert.equal(scene.galaxyCenters.length,112);
    assert.equal(meshes.length,112);
    assert.ok(Math.max(...scene.galaxyRadii)<.10);
    const depths=scene.galaxyCenters.map(c=>c[2]);assert.ok(Math.max(...depths)-Math.min(...depths)>2);
  }
  scene.dispose();
});

test('Earth and Moon have a clear gap throughout the default orbit',()=>{
  const scene=createCosmos('hero',{maps}),bodies=[];
  scene.root.traverse(o=>{if(o.isMesh)bodies.push(o);});
  const [earth,moon]=bodies;
  for(let t=0;t<130;t+=.5){scene.update(t);assert.ok(Math.hypot(earth.position.x-moon.position.x,earth.position.y-moon.position.y)>scene.bodyRadii[0]+scene.bodyRadii[1]+.20);}
  const values=earth.geometry.attributes.facetValue.array;
  assert.ok(Math.max(...values)-Math.min(...values)>.7,'Continental contrast survives the facet sampling');
  scene.dispose();
});
