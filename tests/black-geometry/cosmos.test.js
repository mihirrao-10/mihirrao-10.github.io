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
    assert.ok(['hero', 'teaching'].includes(name) ? particles === 0 : particles > 2000 && particles < 160000);
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
