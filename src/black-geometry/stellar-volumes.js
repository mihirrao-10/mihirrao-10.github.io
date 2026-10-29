import * as THREE from 'three';
import { random, gaussian, pointMaterial, volumeMaterial, valueNoise } from './astronomy-materials.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const normal = (rng, scale = 1) => clamp(gaussian(rng), -3, 3) * scale;

function stars(scene, parent, count, seed, sample, soft = 0) {
  const rng = random(seed), data = { position: [], starSize: [], strength: [], phase: [], rate: [], orbitCenter: [], orbitAxis: [] };
  for (let i = 0; i < count; i++) {
    const p = sample(rng, i);
    data.position.push(...p.position);data.starSize.push(p.size ?? .5 + rng());
    data.strength.push(p.strength ?? .2 + rng() * .4);data.phase.push(rng() * TAU);
    data.rate.push(p.rate ?? 0);data.orbitCenter.push(...(p.center ?? [0, 0, 0]));
    data.orbitAxis.push(...(p.axis ?? [0, 1, 0]));
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(data)) geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, ['position', 'orbitCenter', 'orbitAxis'].includes(name) ? 3 : 1));
  const points = new THREE.Points(geometry, pointMaterial(scene, soft));
  points.frustumCulled = false;points.renderOrder = 2;points.userData.posterSoft = soft;
  points.userData.posterKind = 'stars';parent.add(points);return points;
}

function cloud(scene, parent, scale, opacity, center = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), volumeMaterial(scene, opacity));
  mesh.scale.fromArray(scale);mesh.position.fromArray(center);mesh.renderOrder = 1;
  mesh.userData.posterKind = 'volume';parent.add(mesh);return mesh;
}

// Bound local stellar orbits and every parent rotation without a time-dependent fit.
function fitVolume(scene) {
  let bound = 0;
  scene.root.traverse(object => {
    if (!object.geometry) return;
    const { position, orbitCenter } = object.geometry.attributes;
    let radius = 0;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      if (orbitCenter) {
        const cx = orbitCenter.getX(i), cy = orbitCenter.getY(i), cz = orbitCenter.getZ(i);
        radius = Math.max(radius, Math.hypot(cx, cy, cz) + Math.hypot(x - cx, y - cy, z - cz));
      } else radius = Math.max(radius, Math.hypot(x, y, z));
    }
    for (let node = object; node && node !== scene.root; node = node.parent) radius = radius * Math.max(...node.scale.toArray()) + node.position.length();
    bound = Math.max(bound, radius);
  });
  scene.radius = bound * 1.045;
}

function spiral(scene, parent, seed, density = 1) {
  const identity = (seed % 101) * .071;
  const armPoint = (rng, i, soft = false) => {
    const u = rng() ** .82, r = .42 + 2.38 * u, arm = i % 2, minor = i % 5 === 0;
    const phase = arm * Math.PI + (minor ? .86 : 0) + identity * .09;
    const winding = arm ? 1.72 : 1.94;
    const theta = phase + winding * Math.log((r + .10) / .52) + .10 * Math.sin(u * 12 + phase);
    const knot = valueNoise(u * 15 + identity, phase * 3, 2.4);
    const width = (minor ? .22 : .09) + .14 * u + .10 * knot;
    let offset = normal(rng, width);
    // Spurs fan out from the main arms; breaks between stellar knots keep
    // the spiral from reading as two continuous dark circles.
    if (u > .32 && rng() < .18) offset += .16 + .32 * (u - .32);
    const a = theta + offset, rr = r + normal(rng, .035 + u * .07);
    const laneOffset = -.035 + .025 * Math.sin(u * 23 + identity);
    const dust = 1 - .72 * Math.exp(-(((offset - laneOffset) / (.023 + .018 * u)) ** 2));
    const patch = .24 + .76 * clamp((knot - .13) / .62, 0, 1);
    const bright = rng() < .014;
    return { position: [rr * Math.cos(a), normal(rng, .025 + .06 * (1 - u)) + .025 * Math.sin(a * 3), rr * Math.sin(a)],
      rate: .019 / (r + .5) ** .65,
      size: soft ? 3 + rng() * 7 : bright ? 1.6 + rng() * 1.4 : .34 + rng() ** 2.8 * 1.55,
      strength: (soft ? .035 + rng() * .045 : .18 + rng() * .48) * patch * dust * (minor ? .65 : 1) };
  };
  stars(scene, parent, Math.round(106000 * density), seed, (rng, i) => armPoint(rng, i));
  stars(scene, parent, Math.round(16000 * density), seed + 1, (rng, i) => armPoint(rng, i, true), 1);
  stars(scene, parent, Math.round(65000 * density), seed + 2, rng => {
    let r;do { r = rng() < .28 ? 2.85 * Math.sqrt(rng()) : -.56 * Math.log(Math.max(1e-9, rng() * rng())); } while (r > 2.85);
    const a = rng() * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const lane = .45 + .55 * valueNoise(x * 5 + identity, 2, z * 5);
    return { position: [x, normal(rng, .085), z], rate: .015 / (r + .6) ** .6,
      size: .35 + rng() ** 2.5 * 1.15, strength: (.24 + rng() * .40) * (.4 + .6 * (1 - r / 3.15)) * lane };
  });
  stars(scene, parent, Math.round(24000 * density), seed + 3, rng => ({
    position: [normal(rng, .31), normal(rng, .19), normal(rng, .28)], size: .45 + rng() ** 2.7 * 2.0,
    strength: .32 + rng() * .42, rate: .028 + rng() * .015,
  }));
  stars(scene, parent, Math.round(12000 * density), seed + 4, rng => ({
    position: [normal(rng, .56), normal(rng, .09), normal(rng, .15)], size: .4 + rng() ** 2 * 1.2, strength: .20 + rng() * .28, rate: .012,
  }));
  cloud(scene, parent, [.23, .17, .22], .16);
  cloud(scene, parent, [.48, .27, .44], .055);
  cloud(scene, parent, [.92, .12, .22], .035);
}

export function createGalaxyVolume(scene) {
  const content = new THREE.Group();scene.root.add(content);spiral(scene, content, 60827);
  scene.animate = t => content.rotation.set(.87 + Math.sin(t * .045) * .13, t * .025, -.24 + Math.sin(t * .03) * .04);
  scene.theme = 'Milky Way';scene.volumeKind = 'stellar-disk';scene.galaxyCount = 1;fitVolume(scene);
}

export function createCollisionVolume(scene) {
  const content = new THREE.Group(), first = new THREE.Group(), second = new THREE.Group();
  scene.root.add(content);content.add(first, second);
  first.position.set(-.81, -.14, 0);first.scale.set(.71, .68, .64);first.rotation.set(.46, 0, -.24);
  second.position.set(.92, .18, .25);second.scale.set(.50, .53, .57);second.rotation.set(.98, -.42, .34);
  spiral(scene, first, 98117, .45);spiral(scene, second, 47437, .36);
  // Broad tidal tails are spatial streams, not drawn curves or a flat image.
  stars(scene, content, 40000, 12397, (rng, i) => {
    const side = i % 2 ? 1 : -1, u = rng() ** .85, angle = side * ((side > 0 ? .35 : .60) + u * (side > 0 ? 1.95 : 2.3));
    const r = 1.05 + u * (side > 0 ? 2.05 : 1.83), spread = .035 + .18 * u;
    const knot = .4 + .6 * valueNoise(u * 12, side + 1, 3.7);
    return { position: [side * .45 + side * r * Math.cos(angle) + normal(rng, spread),
      side * (.10 + .38 * u * u) + normal(rng, .06 + .10 * u),
      side * r * Math.sin(angle) * .68 + normal(rng, spread)],
      size: .45 + rng() ** 2 * 1.0, strength: (.30 + rng() * .42) * (1 - .60 * u) * knot, rate: .007 };
  });
  stars(scene, content, 14000, 16199, rng => {
    const u = rng(), x = -.81 + 1.73 * u;
    return { position: [x + normal(rng, .08), .05 + .20 * Math.sin(u * Math.PI) + normal(rng, .08), .12 + normal(rng, .16)],
      size: .6 + rng() * 1.3, strength: .24 + rng() * .32, rate: .011 };
  });
  scene.animate = t => {
    content.rotation.set(.65 + Math.sin(t * .04) * .09, t * .018, -.20);
    first.rotation.y = t * .016;second.rotation.y = -.42 - t * .021;
  };
  scene.theme = 'Colliding galaxies';scene.volumeKind = 'interacting-galaxies';scene.galaxyCount = 2;fitVolume(scene);
}

function sphere(rng, radius) {
  const z = rng() * 2 - 1, a = rng() * TAU, s = Math.sqrt(1 - z * z);
  return [radius * s * Math.cos(a), radius * z, radius * s * Math.sin(a)];
}

export function createClusterVolume(scene) {
  const content = new THREE.Group();scene.root.add(content);
  // A truncated Plummer distribution gives the dense center and extended halo
  // of the supplied globular-cluster reference without copying its stars.
  stars(scene, content, 186000, 66327, rng => {
    let r;do { r = .57 / Math.sqrt(Math.max(1e-9, rng() ** (-2 / 3) - 1)); } while (r > 3.05);
    const p = sphere(rng, r), giant = rng() < .018 + .014 * Math.exp(-r);
    p[1] *= .97;
    const axis = new THREE.Vector3(...sphere(rng, 1)).normalize().toArray();
    return { position: p, axis, rate: .008 + .015 / (r + .4),
      size: giant ? 1.7 + rng() ** 1.4 * 2.9 : .32 + rng() ** 2.7 * 1.20,
      strength: giant ? .40 + rng() * .5 : .13 + rng() * .36 };
  });
  stars(scene, content, 42000, 41833, rng => {
    const r = 2.95 * rng() ** .55;
    return { position: sphere(rng, r), size: .35 + rng() ** 2 * 1.25, strength: .15 + rng() * .25, rate: .013 };
  });
  cloud(scene, content, [.24, .24, .24], .15);
  cloud(scene, content, [.47, .47, .47], .055);
  scene.animate = t => content.rotation.set(.16 + Math.sin(t * .04) * .08, t * .028, -.08);
  scene.theme = 'Globular star cluster';scene.volumeKind = 'globular-cluster';scene.starCount = 228000;fitVolume(scene);
}

export function createRadialVolume(scene) {
  const content = new THREE.Group();scene.root.add(content);
  stars(scene, content, 126000, 21973, rng => {
    const p = sphere(rng, 1), a = Math.atan2(p[2], p[0]);
    const knots = valueNoise(p[0] * 5 + 3, p[1] * 5, p[2] * 5);
    const shell = 1.43 + .38 * Math.sin(a * 3 + p[1] * 4) + .42 * (knots - .5);
    const r = shell + normal(rng, .10 + .10 * knots);
    return { position: p.map(v => v * r), size: .7 + rng() * 1.2,
      strength: (.20 + .85 * knots ** 2) * (.5 + rng() * .5), rate: .009 + .004 * p[1] };
  });
  const rng = random(9271), directions = Array.from({ length: 32 }, () => new THREE.Vector3(...sphere(rng, 1)));
  stars(scene, content, 46000, 41783, (rng, i) => {
    const axis = directions[i % directions.length], r = .40 + rng() ** .7 * 1.65, spread = .018 + r * .022;
    const tangent = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize();
    const bend = .12 * r * Math.sin(r * 2 + i % directions.length);
    const p = axis.clone().multiplyScalar(r).addScaledVector(tangent, bend).add(new THREE.Vector3(normal(rng, spread), normal(rng, spread), normal(rng, spread)));
    return { position: p.toArray(), size: 1.5 + rng() * 4, strength: .04 + rng() * .055, rate: .012 };
  }, 1);
  stars(scene, content, 3500, 85139, rng => ({ position: sphere(rng, .24 * rng() ** .65),
    size: .8 + rng() * 1.6, strength: .11 + rng() * .14, rate: .07 }));
  stars(scene, content, 8000, 37811, rng => ({ position: sphere(rng, 2.3 * rng() ** .5),
    size: .5 + rng() ** 3 * 2.5, strength: .18 + rng() * .30, rate: .009 }));
  cloud(scene, content, [.15, .15, .15], .12);
  scene.animate = t => content.rotation.set(.25 + Math.sin(t * .045) * .10, t * .032, -.16);
  scene.theme = 'Radial stellar cloud';scene.volumeKind = 'radial-cloud';fitVolume(scene);
}

// Retained image-field helper for archived galaxy-cluster references.
export function clusterFeatures(map) {
  const { pixels, width, height } = map.userData, size = 96, field = new Float32Array(size * size);
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const index = Math.min(size - 1, Math.floor(y / height * size)) * size + Math.min(size - 1, Math.floor(x / width * size));
    field[index] += (pixels[y * width + x] / 255) ** 1.5;
  }
  const candidates = [];
  for (let y = 2; y < size - 2; y++) for (let x = 2; x < size - 2; x++) {
    let value = 0;for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) value += field[(y + j) * size + x + i] * (i === 0 && j === 0 ? 4 : 1);
    candidates.push({ u: (x + .5) / size, v: (y + .5) / size, value });
  }
  candidates.sort((a, b) => b.value - a.value);const selected = [];
  for (const feature of candidates) { if (selected.every(p => Math.hypot(p.u - feature.u, p.v - feature.v) > .051)) selected.push(feature);if (selected.length === 112) break; }
  return selected;
}
