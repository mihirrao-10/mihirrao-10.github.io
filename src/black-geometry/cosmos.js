import * as THREE from 'three';
import { createPlanetMoon, createStar } from './world-bodies.js';
import { createBlackHole } from './black-hole.js';
import { createGalaxyVolume, createClusterVolume, createCollisionVolume, createRadialVolume } from './stellar-volumes.js';

export const COSMIC_TARGETS = Object.freeze(['hero','education','experience','publications','teaching','projects','notes']);

function blackHole(scene) {
  const content = new THREE.Group(); scene.root.add(content);
  createBlackHole(scene, content);
  scene.animate = t => content.rotation.set(.04 + Math.sin(t*.035)*.025, 0, -.22);
  scene.theme = 'Black hole'; scene.renderMode = 'bent-ray-accretion'; scene.radius = 3.4;
}

export function createCosmos(name, { maps = {} } = {}) {
  const factory = { hero:createPlanetMoon, education:createStar, experience:blackHole,
    publications:createRadialVolume, teaching:createGalaxyVolume, projects:createCollisionVolume, notes:createClusterVolume }[name];
  if (!factory) throw new Error(`Unknown cosmic scene: ${name}`);
  const scene = { root:new THREE.Group(), materials:new Set(), textures:new Set(),
    uniforms:{ time:{value:0}, presence:{value:1}, pixelRatio:{value:1} } };
  factory(scene, maps); scene.bounds = [{center:[0,0,0], radius:scene.radius}]; scene.root.name = `cosmos-${name}`;
  scene.update = (time=0, presence=1, pixelRatio=1) => {
    scene.uniforms.time.value=time; scene.uniforms.presence.value=presence; scene.uniforms.pixelRatio.value=pixelRatio;
    for (const material of scene.materials) {
      if (material.userData.bodyDepth) material.depthWrite=presence>.999;
      if (material.userData.baseOpacity!==undefined) material.opacity=presence*material.userData.baseOpacity;
    }
    scene.animate(time); scene.root.updateMatrixWorld(true);
  };
  scene.dispose = () => {
    const geometries=new Set(); scene.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
    geometries.forEach(g=>g.dispose()); scene.materials.forEach(m=>m.dispose()); scene.textures.forEach(t=>t.dispose());
  };
  scene.update(); return scene;
}
