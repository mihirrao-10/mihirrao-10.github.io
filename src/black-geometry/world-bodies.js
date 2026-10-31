import * as THREE from 'three';
import { surfaceMaterial, ringMaterial, valueNoise } from './astronomy-materials.js';

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
function planetMap(scene, width = 1536, height = 768) {
  const pixels = new Uint8Array(width * height);
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

// An illustrative eight-planet system. Sizes and spacing favor a readable
// oblique view rather than astronomical scale.
export function createSolarSystem(scene, maps) {
  const content = new THREE.Group(); content.rotation.set(.34, -.18, -.32); scene.root.add(content);
  const sun = body(scene, content, .44, 3, { map: maps.sun, detail: 160, opacity: 1.15 });
  sun.userData.role = 'central-sun';
  const radii = [.075, .115, .13, .095, .31, .255, .18, .175];
  const orbits = [.80, 1.14, 1.53, 1.95, 2.62, 3.30, 3.95, 4.57];
  const phases = [2.20, 5.25, .35, 3.72, 1.20, 4.55, 2.64, 5.72];
  const kinds = [1, 4, 0, 4, 2, 2, 4, 2], planets = [];
  const terrain = planetMap(scene, 512, 256);
  const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x474747, transparent: true, opacity: .18, depthWrite: false });
  orbitMaterial.userData.baseOpacity = .18; scene.materials.add(orbitMaterial);
  const ringPixels = new Uint8Array(512);
  for (let i = 0; i < ringPixels.length; i++) {
    const u = i / (ringPixels.length - 1);
    const gaps = 1 - .84 * Math.exp(-(((u - .61) / .026) ** 2)) - .45 * Math.exp(-(((u - .83) / .012) ** 2));
    const edge = Math.min(1, u * 24, (1 - u) * 22);
    ringPixels[i] = Math.round(255 * edge * Math.max(0, gaps) * (.53 + .15 * Math.sin(u * 185) ** 2));
  }
  const ringProfile = new THREE.DataTexture(ringPixels, 512, 1, THREE.RedFormat);
  ringProfile.userData = { pixels: ringPixels, width: 512, height: 1, origin: 'Authored illustrative ring bands' };
  ringProfile.magFilter = ringProfile.minFilter = THREE.LinearFilter;
  ringProfile.needsUpdate = true; scene.textures.add(ringProfile);
  for (let i = 0; i < orbits.length; i++) {
    const plane = new THREE.Group(); plane.rotation.set((i - 3.5) * .012, 0, (i % 3 - 1) * .012); content.add(plane);
    const points = [];
    for (let j = 0; j < 256; j++) {
      const a = j * TAU / 256, b = (j + 1) * TAU / 256;
      points.push(orbits[i] * Math.cos(a), 0, orbits[i] * Math.sin(a), orbits[i] * Math.cos(b), 0, orbits[i] * Math.sin(b));
    }
    const path = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), orbitMaterial);
    path.userData.posterKind = 'orbit'; plane.add(path);
    const planet = new THREE.Group(); plane.add(planet);
    const surface = body(scene, planet, radii[i], kinds[i], { map: i === 0 ? maps.moon : i === 2 ? terrain : null, detail: i >= 4 ? 128 : 96, opacity: i === 6 ? .80 : 1.08 });
    surface.userData.role = 'planet'; surface.userData.planetIndex = i;
    surface.rotation.z = [.05, .1, .41, .44, .06, .47, 1.45, .49][i];
    if (i === 5) {
      const inner = radii[i] * 1.32, outer = radii[i] * 2.10;
      const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 192, 4).rotateX(-Math.PI / 2), ringMaterial(scene, inner, outer, .70, ringProfile));
      ring.rotation.z = .47; ring.userData = { posterKind: 'ring', innerRadius: inner, outerRadius: outer }; planet.add(ring);
    }
    planets.push({ planet, surface, orbit: orbits[i], phase: phases[i], speed: .24 / orbits[i] ** 1.2 });
  }
  // Sparse grains suggest the belt while keeping each orbit easy to follow.
  const beltPositions = [], sizes = [], strengths = [];
  for (let i = 0; i < 720; i++) {
    const angle = i * 2.399963229728653, r = 2.18 + .20 * valueNoise(i * 1.7, 4.3, 2.1);
    beltPositions.push(r * Math.cos(angle), .045 * (valueNoise(i * 3.1, 2.2, 8.4) - .5), r * Math.sin(angle));
    sizes.push(.8 + .5 * valueNoise(i, 7, 3)); strengths.push(.12 + .12 * valueNoise(i, 5, 9));
  }
  const beltGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(beltPositions, 3));
  beltGeometry.setAttribute('starSize', new THREE.Float32BufferAttribute(sizes, 1));
  beltGeometry.setAttribute('strength', new THREE.Float32BufferAttribute(strengths, 1));
  const beltMaterial = new THREE.PointsMaterial({ color: 0x555555, size: .014, transparent: true, opacity: .24, depthWrite: false });
  beltMaterial.userData.baseOpacity = .24; scene.materials.add(beltMaterial);
  const belt = new THREE.Points(beltGeometry, beltMaterial); belt.userData.role = 'asteroid-belt'; content.add(belt);
  scene.animate = time => {
    sun.rotation.y = time * .04; belt.rotation.y = time * .012;
    for (const { planet, surface, orbit, phase, speed } of planets) {
      const angle = phase + time * speed;
      planet.position.set(orbit * Math.cos(angle), 0, orbit * Math.sin(angle));
      surface.rotation.y = time * .09;
    }
  };
  scene.theme = 'Solar system'; scene.volumeKind = 'solar-system';
  scene.planetCount = 8; scene.orbitRadii = orbits; scene.bodyRadii = [.44, ...radii];
  scene.radius = 4.92;
}
