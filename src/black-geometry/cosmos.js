import * as THREE from 'three';
import { facetGeometry, facetMesh, globe, PALETTES, TAU } from './tessellation.js';
import { createNeutronStar } from './neutron-star.js';
import { createAccretion } from './tessellated-accretion.js';
import { createGalaxyVolume, createClusterVolume } from './stellar-volumes.js';

export const COSMIC_TARGETS = Object.freeze(['hero','education','experience','publications','teaching','projects','notes']);

function earthMoon(scene, maps) {
  const content = new THREE.Group();content.rotation.z = -.10;scene.root.add(content);
  const earth = globe(scene, content, 1.24, 19, { map: maps.earth, kind: 0, palette: PALETTES.earth, fill: .67, edge: .66, width: .46, back: .035 });
  earth.position.x = -.60;
  const moon = globe(scene, content, .34, 10, { map: maps.moon, kind: 1, palette: PALETTES.moon, fill: .62, edge: .64, width: .46, back: .035 });
  scene.animate = t => {
    earth.rotation.y = .25 + t * .045;
    const a = .36 + t * .055;moon.position.set(2.45 * Math.cos(a), 2.15 * Math.sin(a), .60 * Math.sin(a));moon.rotation.y = -a;
  };
  scene.theme = 'Earth and Moon';scene.radius = 3.05;
  scene.bodyRadii = [1.24,.34];
}
function jupiter(scene, maps) {
  const content = new THREE.Group();content.rotation.set(.10,0,-.13);scene.root.add(content);
  const planet = globe(scene, content, 1.68, 25, { map: maps.jupiter, kind: 2, palette: PALETTES.jupiter, fill: .67, edge: .66, width: .46, back: .035, scale: [1,.935,1] });
  scene.animate = t => { planet.rotation.y = -.65 + t * .055;content.rotation.z = -.13 + Math.sin(t * .04) * .035; };
  scene.theme = 'Jupiter';scene.radius = 2.42;
}
function star(scene, maps) {
  const content = new THREE.Group();scene.root.add(content);
  const sun = globe(scene, content, 1.54, 27, { map: maps.sun, kind: 3, palette: PALETTES.sun, fill: .60, edge: .66, width: .46, back: .04, ripple: .012, pulse: .07 });
  const loops = new THREE.Group();content.add(loops);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.399, b = .6 + (i % 5) * .43;
    const n = new THREE.Vector3(Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a));
    const tangent = new THREE.Vector3(-Math.sin(a),0,Math.cos(a));
    const path = [];
    for (let j = 0; j <= 64; j++) {
      const u = j/64, angle = Math.cos(u*Math.PI)*.20, r = 1.54 + (.25 + i%3*.1)*Math.sin(u*Math.PI);
      path.push(n.clone().multiplyScalar(Math.cos(angle)).addScaledVector(tangent,Math.sin(angle)).multiplyScalar(r));
    }
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),64,.025 + i%2*.015,8,false);
    const loop = facetMesh(scene, loops, facetGeometry(geometry,p=>.4+.3*Math.sin(p[1]*5)), { palette: PALETTES.sun, fill: .15, edge: .50, width: .52, back: .35, pulse: .15 });
    loop.userData.role = 'solar-loop';
  }
  scene.animate = t => { sun.rotation.y = t*.045;loops.rotation.y = t*.045;content.rotation.set(.12+Math.sin(t*.04)*.04,0,-.12); };
  scene.theme = 'Sun';scene.radius = 2.42;
}
export function createCosmos(name, { maps = {} } = {}) {
  const factory = { hero: earthMoon, education: jupiter, experience: star, publications: createNeutronStar,
    teaching: createAccretion, projects: createGalaxyVolume, notes: createClusterVolume }[name];
  if (!factory) throw new Error(`Unknown cosmic scene: ${name}`);
  const scene = { root: new THREE.Group(), materials: new Set(), textures: new Set(),
    uniforms: { time: { value: 0 }, presence: { value: 1 }, pixelRatio: { value: 1 } } };
  factory(scene,maps);scene.bounds = [{ center: [0,0,0], radius: scene.radius }];scene.root.name = `cosmos-${name}`;
  scene.update = (time = 0, presence = 1, pixelRatio = 1) => {
    scene.uniforms.time.value = time;scene.uniforms.presence.value = presence;scene.uniforms.pixelRatio.value = pixelRatio;
    for (const material of scene.materials) if (material.userData.bodyDepth) material.depthWrite = presence > .999;
    scene.animate(time);scene.root.updateMatrixWorld(true);
  };
  scene.dispose = () => {
    const geometries = new Set();scene.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
    geometries.forEach(g=>g.dispose());scene.materials.forEach(m=>m.dispose());scene.textures.forEach(t=>t.dispose());
  };
  scene.update();return scene;
}
