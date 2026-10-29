import * as THREE from 'three';
import { surfaceMaterial, valueNoise } from './astronomy-materials.js';

const TAU = Math.PI * 2;
const clamp = x => THREE.MathUtils.clamp(x, 0, 1);
function fbm(x, y, z, octaves = 5) {
  let value = 0, amplitude = .5;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise(x, y, z);
    x = x * 2.03 + 7.1;y = y * 2.03 + 3.7;z = z * 2.03 + 1.3;amplitude *= .5;
  }
  return value;
}

// A spherical field gives this invented world its own geography without a UV seam.
function planetMap(scene) {
  const width = 1536, height = 768, pixels = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    const latitude = Math.PI * j / (height - 1), y = Math.cos(latitude), radial = Math.sin(latitude);
    for (let i = 0; i < width; i++) {
      const longitude = TAU * i / (width - 1), x = -radial * Math.cos(longitude), z = radial * Math.sin(longitude);
      const warp = fbm(x * 3.2 + 8, y * 3.2, z * 3.2, 3);
      const terrain = fbm(x * 5.2 + warp * 1.8, y * 5.2 + warp, z * 5.2 - warp * 1.4);
      const ridges = 1 - Math.abs(2 * fbm(x * 21 + warp * 4, y * 21, z * 21, 4) - 1);
      const cloud = fbm(x * 8 - y * 1.8, y * 9 + warp * 2.5, z * 8 + warp, 4);
      const basin = THREE.MathUtils.smoothstep(terrain, .34, .66);
      const density = .12 + .52 * basin + .17 * ridges + .21 * THREE.MathUtils.smoothstep(cloud, .46, .69);
      pixels[j * width + i] = Math.round(clamp((density - .08) * .82) * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RedFormat);
  texture.wrapS = THREE.RepeatWrapping;texture.magFilter = THREE.LinearFilter;texture.minFilter = THREE.LinearFilter;
  texture.userData = { pixels, width, height, origin: 'Authored spherical terrain and cloud field' };
  texture.needsUpdate = true;scene.textures.add(texture);return texture;
}

function body(scene, parent, radius, kind, { map = null, opacity = 1, detail = 384, uneven = false } = {}) {
  const geometry = new THREE.SphereGeometry(radius, detail, detail / 2);
  if (uneven) {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) / radius, y = positions.getY(i) / radius, z = positions.getZ(i) / radius;
      const ripple = .075 * (fbm(x * 3, y * 3, z * 3, 3) - .45) + .018 * (valueNoise(x * 15, y * 15, z * 15) - .5);
      positions.setXYZ(i, x * radius * (1 + ripple), y * radius * (1 + ripple), z * radius * (1 + ripple));
    }
    geometry.computeVertexNormals();
  }
  const material = surfaceMaterial(scene, kind, map, { opacity, detail, depthWrite: kind < 5 });
  const object = new THREE.Mesh(geometry, material);
  object.userData.posterKind = 'body';object.userData.surfaceKind = kind;
  parent.add(object);return object;
}

export function createPlanetMoon(scene, maps) {
  const content = new THREE.Group();content.rotation.z = -.12;scene.root.add(content);
  const world = new THREE.Group();content.add(world);
  const planet = body(scene, world, 1.15, 0, { map: planetMap(scene), detail: 512, opacity: 1.15 });
  const clouds = body(scene, world, 1.163, 5, { detail: 256, opacity: .15 });clouds.renderOrder = 1;
  const atmosphere = body(scene, world, 1.181, 6, { detail: 192, opacity: .15 });atmosphere.renderOrder = 1;
  const moon = body(scene, content, .29, 1, { map: maps.moon, detail: 320, opacity: 1.12 });
  scene.animate = t => {
    const a = .46 + t * .045;
    world.position.set(-.47 - .065 * Math.cos(a), -.035 * Math.sin(a), -.02 * Math.sin(a));
    planet.rotation.y = .28 + t * .032;clouds.rotation.y = .28 + t * .039;
    moon.position.set(2.60 * Math.cos(a), 2.10 * Math.sin(a), .88 * Math.sin(a));
    moon.rotation.y = -a + .7;
  };
  scene.theme = 'Planet and Moon';scene.radius = 3.25;
  scene.bodyRadii = [1.15, .29];scene.volumeKind = 'planet-moon';
}

export function createStar(scene, maps) {
  const content = new THREE.Group();content.rotation.set(.12, 0, -.16);scene.root.add(content);
  const star = body(scene, content, 1.37, 3, { map: maps.sun, detail: 640, opacity: 1.19, uneven: true });
  star.userData.role = 'convective-star';
  scene.animate = t => {
    star.rotation.y = t * .027;
    content.rotation.z = -.16 + Math.sin(t * .035) * .018;
    const breath = 1 + .004 * Math.sin(t * .18);star.scale.setScalar(breath);
  };
  scene.theme = 'Giant star';scene.radius = 2.95;scene.volumeKind = 'convective-star';
}
