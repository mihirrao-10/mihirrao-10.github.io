import * as THREE from 'three';
import { random, gaussian, pointMaterial, volumeMaterial, valueNoise } from './astronomy-materials.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const normal = (rng, scale = 1) => clamp(gaussian(rng), -3, 3) * scale;

function stars(scene, parent, count, seed, sample, soft = 0) {
  // Fill the final GPU buffers directly instead of growing and copying JS arrays.
  const rng = random(seed), data = {
    position: new Float32Array(count * 3), starSize: new Float32Array(count),
    strength: new Float32Array(count), phase: new Float32Array(count), rate: new Float32Array(count),
    orbitCenter: new Float32Array(count * 3), orbitAxis: new Float32Array(count * 3),
  };
  for (let i = 0; i < count; i++) {
    const p = sample(rng, i), offset = i * 3;
    data.position.set(p.position, offset);data.starSize[i] = p.size ?? .5 + rng();
    data.strength[i] = p.strength ?? .2 + rng() * .4;data.phase[i] = rng() * TAU;
    data.rate[i] = p.rate ?? 0;
    if (p.center) data.orbitCenter.set(p.center, offset);
    if (p.axis) data.orbitAxis.set(p.axis, offset);
    else data.orbitAxis[offset + 1] = 1;
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(data)) geometry.setAttribute(name, new THREE.BufferAttribute(values, ['position', 'orbitCenter', 'orbitAxis'].includes(name) ? 3 : 1));
  const points = new THREE.Points(geometry, pointMaterial(scene, soft)), drawingSize = new THREE.Vector2();
  points.onBeforeRender = renderer => { points.material.uniforms.viewportHeight.value = renderer.getDrawingBufferSize(drawingSize).y; };
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
    const u = rng() ** .82, r = .34 + 2.46 * u, arm = i % 2, minor = i % 5 === 0;
    const phase = arm * Math.PI + (minor ? 1.05 + .22 * Math.sin(u * 5) : 0) + identity * .09;
    const winding = arm ? 1.72 : 1.94;
    const theta = phase + winding * Math.log((r + .10) / .52) + .16 * Math.sin(u * 11 + phase);
    const knot = valueNoise(u * 15 + identity, phase * 3, 2.4);
    const width = (minor ? .15 : .065) + .13 * u + .13 * knot;
    let offset = normal(rng, width);
    // Spurs fan out from the main arms; breaks between stellar knots keep
    // the spiral from reading as two continuous dark circles.
    if (u > .28 && rng() < .25) offset += .12 + .38 * (u - .28);
    // Broken secondary feathers share the arm's flow without tracing a ring.
    offset += .045 * Math.sin(u * 37 + arm * 2 + identity);
    const a = theta + offset, rr = r + normal(rng, .035 + u * .07);
    const laneOffset = -.035 + .025 * Math.sin(u * 23 + identity);
    const dust = 1 - .72 * Math.exp(-(((offset - laneOffset) / (.023 + .018 * u)) ** 2));
    const patch = .12 + .88 * clamp((knot - .18) / .56, 0, 1);
    const bright = rng() < .025;
    return { position: [rr * Math.cos(a), normal(rng, .035 + .075 * (1 - u)) + .10 * u * u * Math.sin(a * 2 + identity), rr * Math.sin(a)],
      rate: .019 / (r + .5) ** .65,
      size: soft ? 3 + rng() * 7 : bright ? 2.1 + rng() ** 2 * 2.1 : .40 + rng() ** 2.8 * 1.45,
      strength: (soft ? .035 + rng() * .045 : .18 + rng() * .48) * patch * dust * (minor ? .65 : 1) };
  };
  stars(scene, parent, Math.round(106000 * density), seed, (rng, i) => armPoint(rng, i));
  stars(scene, parent, Math.round(16000 * density), seed + 1, (rng, i) => armPoint(rng, i, true), 1);
  stars(scene, parent, Math.round(65000 * density), seed + 2, rng => {
    let r;do { r = rng() < .28 ? 2.85 * Math.sqrt(rng()) : -.56 * Math.log(Math.max(1e-9, rng() * rng())); } while (r > 2.85);
    const a = rng() * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const lane = .24 + .76 * valueNoise(x * 5 + identity, 2, z * 5);
    return { position: [x, normal(rng, .065 + .035 * r) + .075 * (r / 2.85) ** 2 * Math.sin(a * 2 + identity), z], rate: .015 / (r + .6) ** .6,
      size: .35 + rng() ** 2.5 * 1.15, strength: (.24 + rng() * .40) * (.4 + .6 * (1 - r / 3.15)) * lane };
  });
  stars(scene, parent, Math.round(24000 * density), seed + 3, rng => ({
    position: [normal(rng, .35), normal(rng, .19), normal(rng, .25)], size: .50 + rng() ** 2.7 * 2.5,
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
    const knot = .26 + .74 * valueNoise(u * 12, side + 1, 3.7);
    const feather = (i % 5 === 0 ? 1 : 0) * .20 * Math.sin(u * Math.PI);
    return { position: [side * .45 + side * r * Math.cos(angle) + normal(rng, spread),
      side * (.10 + .38 * u * u) + feather + normal(rng, .045 + .10 * u),
      side * r * Math.sin(angle) * .68 + normal(rng, spread)],
      size: .42 + rng() ** 3 * 2.0, strength: (.30 + rng() * .42) * (1 - .60 * u) * knot, rate: .007 };
  });
  stars(scene, content, 14000, 16199, rng => {
    const u = rng(), x = -.81 + 1.73 * u, ridge = Math.sin(u * Math.PI);
    const knots = .35 + .65 * valueNoise(u * 15, 4.7, 1.3);
    return { position: [x + normal(rng, .07), .05 + .25 * ridge + normal(rng, .045 + .05 * ridge),
      .12 + .18 * Math.sin(u * 5) + normal(rng, .10)],
      size: .55 + rng() ** 2.6 * 2.8, strength: (.28 + rng() * .42) * knots, rate: .008 };
  });
  scene.animate = t => {
    content.rotation.set(.65 + Math.sin(t * .04) * .09, t * .018, -.20);
    first.rotation.y = t * .016;second.rotation.y = -.42 - t * .021;
  };
  scene.theme = 'Colliding galaxies';scene.volumeKind = 'interacting-galaxies';scene.galaxyCount = 2;fitVolume(scene);
}

// A galaxy cluster contains distinct extended galaxies, not individual stars
// around one nucleus. Batch each depth group to keep the whole field inexpensive.
export function createGalaxyClusterVolume(scene) {
  const content = new THREE.Group();scene.root.add(content);
  const rng = random(720431), members = [], layers = Array.from({ length: 3 }, () => new THREE.Group());
  layers.forEach(layer => content.add(layer));
  const anchors = [
    { center: [-.42, .28, .20], size: .58, type: 'elliptical' },
    { center: [.42, -.38, -.18], size: .42, type: 'elliptical' },
    { center: [.94, .62, .65], size: .43, type: 'spiral' },
    { center: [-1.05, -.65, .35], size: .34, type: 'lenticular' },
  ];
  for (let i = 0; i < 36; i++) {
    let center, size, type;
    if (i < anchors.length) ({ center, size, type } = anchors[i]);
    else {
      const u = (i - 3) / 33, angle = i * 2.39996323 + (rng() - .5) * .40;
      const radius = .85 + 1.82 * Math.sqrt(u);
      center = [Math.cos(angle) * radius, Math.sin(angle) * radius * .85, normal(rng, .64)];
      size = .11 + .18 * rng() ** 1.25 + (i % 9 === 0 ? .08 : 0);
      type = i % 5 === 0 ? 'spiral' : i % 4 === 0 ? 'lenticular' : 'elliptical';
    }
    const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.35 + rng() * 2.25, rng() * TAU, rng() * TAU));
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(orientation).toArray();
    members.push({ center, size, type, orientation, axis, phase: rng() * TAU,
      weight: size ** 1.4, layer: center[2] < -.32 ? 0 : center[2] > .32 ? 2 : 1 });
  }
  // A recognizable, oblique foreground spiral contrasts with the central ellipses.
  members[2].orientation.setFromEuler(new THREE.Euler(.92, .15, -.30));
  members[2].axis = new THREE.Vector3(0, 1, 0).applyQuaternion(members[2].orientation).toArray();
  const point = new THREE.Vector3();
  function sampleMember(member, random, index, soft) {
    const { center, size, type, orientation, axis, phase } = member;
    let x, y, z, density = 1;
    if (type === 'elliptical') {
      // A compact core and extended ellipsoidal envelope give each galaxy a
      // continuous surface-brightness profile instead of a hard particle ball.
      let radius;
      do { radius = -.19 * Math.log(Math.max(1e-9, random() * random())); } while (radius > 1.45);
      if (soft && random() < .40) radius = .28 + .95 * Math.sqrt(random());
      const direction = sphere(random, radius);
      [x, y, z] = [direction[0], direction[1] * .56, direction[2] * .66];
    } else {
      const bulge = random() < (type === 'spiral' ? .30 : .46);
      if (bulge) {
        x = normal(random, .15);y = normal(random, .10);z = normal(random, .15);
      } else {
        const radius = .12 + 1.02 * random() ** .72;
        const arm = index % 2, scatter = normal(random, .13 + radius * .12);
        const diffuse = type === 'lenticular' || random() < .25;
        const angle = !diffuse ? arm * Math.PI + 1.9 * Math.log((radius + .10) / .30) + phase + scatter : random() * TAU;
        x = Math.cos(angle) * radius;z = Math.sin(angle) * radius;
        y = normal(random, .035 + .035 * (1 - radius));
        const knots = valueNoise(radius * 12 + phase, arm, 4.1);
        density = !diffuse ? (.42 + .58 * knots) * (1 - .48 * Math.exp(-(((scatter + .055) / .025) ** 2))) : .24 + .52 * (1 - radius / 1.2);
      }
    }
    point.set(x * size, y * size, z * size).applyQuaternion(orientation);
    return { position: [point.x + center[0], point.y + center[1], point.z + center[2]], center, axis,
      rate: type === 'elliptical' ? .003 : .010 / (.7 + Math.hypot(x, z)),
      size: soft ? 2.4 + random() * 4.5 : .36 + random() ** 2.3 * .88,
      strength: (soft ? .020 + random() * .030 : .20 + random() * .38) * density * (.90 + center[2] * .045) };
  }
  const clusterWeight = members.reduce((sum, member) => sum + member.weight, 0);
  for (let layer = 0; layer < layers.length; layer++) {
    const galaxies = members.filter(member => member.layer === layer), total = galaxies.reduce((sum, member) => sum + member.weight, 0);
    const choose = random => {
      let weight = random() * total;
      for (const member of galaxies) { weight -= member.weight;if (weight <= 0) return member; }
      return galaxies.at(-1);
    };
    stars(scene, layers[layer], Math.round(132000 * total / clusterWeight), 12073 + layer * 7, (random, i) => sampleMember(choose(random), random, i, false));
    stars(scene, layers[layer], Math.round(21000 * total / clusterWeight), 28031 + layer * 7, (random, i) => sampleMember(choose(random), random, i, true), 1);
  }
  // Faint intracluster light occupies the space between members without hiding
  // their separate silhouettes or introducing visible connecting lines.
  stars(scene, content, 5000, 65519, random => {
    const p = sphere(random, 2.35 * random() ** .58);
    return { position: [p[0], p[1] * .72, p[2] * .58], size: 5 + random() * 8,
      strength: .0015 + random() * .004, rate: .0015 };
  }, 1);
  scene.animate = time => {
    content.rotation.set(.08 + Math.sin(time * .025) * .035, time * .012, -.08);
    layers.forEach((layer, i) => { layer.rotation.y = Math.sin(time * .018 + i) * .012; });
  };
  scene.theme = 'Galaxy cluster';scene.volumeKind = 'galaxy-cluster';scene.galaxyCount = members.length;
  scene.galaxies = members.map(({ center, size, type }) => ({ center: [...center], size, type }));
  fitVolume(scene);
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
    let r;do { r = .64 / Math.sqrt(Math.max(1e-9, rng() ** (-2 / 3) - 1)); } while (r > 3.05);
    const p = sphere(rng, r), giant = rng() < .018 + .014 * Math.exp(-r);
    p[1] *= .97;
    const axis = sphere(rng, 1);
    return { position: p, axis, rate: .008 + .015 / (r + .4),
      size: giant ? 2.2 + rng() ** 1.8 * 3.8 : .38 + rng() ** 2.7 * 1.30,
      strength: giant ? .40 + rng() * .5 : .13 + rng() * .36 };
  });
  stars(scene, content, 42000, 41833, (rng, i) => {
    const r = 2.95 * rng() ** .55, p = sphere(rng, r), foreground = i % 19 === 0;
    // Sparse resolved giants sit throughout the halo, among finer distant stars.
    return { position: p, axis: sphere(rng, 1),
      size: foreground ? 2.4 + rng() ** 2 * 3.0 : .38 + rng() ** 2.8 * 1.15,
      strength: foreground ? .42 + rng() * .35 : (.10 + rng() * .24) * (1 - .50 * (r / 3) ** 4),
      rate: .005 + .010 / (r + .5) };
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

export function createNebulaVolume(scene) {
  const content = new THREE.Group(); scene.root.add(content);
  // Overlapping irregular filaments occupy real depth. Gaps and thinner edges
  // leave open cavities instead of forming a solid sphere or flat photograph.
  stars(scene, content, 62000, 741923, (rng, i) => {
    const u = rng() * 2 - 1, branch = i % 3;
    const x = u * 2.35;
    const wave = .5 * Math.sin(u * 3.4 + branch * .7);
    const width = .16 + .30 * (.5 + .5 * Math.sin(u * 5.7 + branch));
    const y = wave + (branch - 1) * .43 + normal(rng, width);
    const z = .43 * Math.sin(u * 4.1 + branch * 1.8) + normal(rng, width * .82);
    const knot = valueNoise(x * 3.8 + 9, y * 3.8, z * 3.8);
    const edge = Math.max(.08, (1 - u * u) ** .65);
    return { position: [x + normal(rng, .09), y, z],
      size: 7 + rng() * 17, strength: (.008 + knot ** 2 * .052) * edge, rate: 0 };
  }, 1);
  // Fine dusty knots add detail without turning the cloud into a star cluster.
  stars(scene, content, 24000, 623819, rng => {
    const u = rng() * 2 - 1, x = u * 2.20, y = .55 * Math.sin(u * 3.2) + normal(rng, .22), z = normal(rng, .32);
    const knots = valueNoise(x * 7 + 3, y * 7, z * 7);
    return { position: [x, y, z], size: 1.5 + rng() * 3.5, strength: .014 + .10 * knots ** 3, rate: 0 };
  }, 1);
  stars(scene, content, 1600, 281421, rng => ({
    position: [normal(rng, .9), normal(rng, .6), normal(rng, .65)],
    size: .5 + rng() ** 4 * 2.1, strength: .16 + rng() * .36, rate: .002,
  }));
  const veil = cloud(scene, content, [1.30, .38, .42], .045, [-.35, .15, .05]); veil.rotation.z = .22;
  const second = cloud(scene, content, [.90, .30, .37], .035, [.8, -.18, -.05]); second.rotation.z = -.45;
  scene.animate = time => content.rotation.set(.30 + Math.sin(time * .03) * .07, time * .019, -.20);
  scene.theme = 'Nebula'; scene.volumeKind = 'filament-nebula'; fitVolume(scene);
}
