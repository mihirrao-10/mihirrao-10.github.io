import * as THREE from 'three';

export const COSMIC_TARGETS = Object.freeze(['education', 'experience', 'projects']);
const TAU = Math.PI * 2;
const SHELL_VERTEX = `
attribute vec3 barycentric;
varying vec3 vBarycentric;
varying vec3 vNormal;
varying vec3 vView;
void main(){
  vBarycentric=barycentric;
  vNormal=normalize(normalMatrix*normal);
  vec4 p=modelViewMatrix*vec4(position,1.0);
  vView=-p.xyz;
  gl_Position=projectionMatrix*p;
}`;
const SHELL_FRAGMENT = `
uniform float presence;
uniform float lineOpacity;
uniform float fillOpacity;
varying vec3 vBarycentric;
varying vec3 vNormal;
varying vec3 vView;
void main(){
  vec3 width=max(fwidth(vBarycentric),vec3(.00001));
  vec3 lines=smoothstep(vec3(0.0),width*.65,vBarycentric);
  float edge=1.0-min(min(lines.x,lines.y),lines.z);
  edge*=smoothstep(.6,2.0,1.0/max(max(width.x,width.y),width.z));
  float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.0);
  float alpha=(fillOpacity*(.55+.45*rim)+lineOpacity*edge*(.72+.28*rim))*presence;
  if(alpha<.001)discard;
  float tone=mix(.62,.20,edge);
  gl_FragColor=vec4(vec3(tone),alpha);
  #include <colorspace_fragment>
}`;
const STAR_VERTEX = `
attribute float starSize;
attribute float phase;
attribute float rate;
attribute float strength;
uniform float time;
uniform float pixelRatio;
uniform float flow;
varying float vAlpha;
void main(){
  vec3 p=position;
  float fade=1.0;
  if(flow>1.5){
    float f=fract((abs(p.y)-.7+time*.28)/2.35);
    p.y=sign(p.y)*(.7+2.35*f);
    fade=sin(3.14159265*f);
  }else{
    float a=time*rate;
    p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
  }
  vec4 view=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*view;
  gl_PointSize=clamp(starSize*pixelRatio*12.0/max(1.0,-view.z),.9,6.0*pixelRatio);
  vAlpha=strength*fade*(.82+.18*sin(time*.6+phase));
}`;
const STAR_FRAGMENT = `
uniform float presence;
varying float vAlpha;
void main(){
  float d=length(gl_PointCoord-.5);
  float disc=1.0-smoothstep(.12,.5,d);
  float alpha=disc*vAlpha*presence;
  if(alpha<.002)discard;
  gl_FragColor=vec4(vec3(.16),alpha);
  #include <colorspace_fragment>
}`;

function random(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function grid(point, columns = 256, rows = 12) {
  const positions = [], indices = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    positions.push(...point(i / columns, j / rows));
    if (i && j) {
      const d = j * (columns + 1) + i, c = d - 1, b = d - columns - 1, a = b - 1;
      indices.push(a, c, d, a, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
function shell(scene, parent, geometry, line = .13, fill = .012) {
  // Thin edges carry the detail; the nearly clear faces keep rear layers visible.
  line *= 1.7;
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  const count = flat.attributes.position.count, barycentric = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) barycentric[i * 3 + i % 3] = 1;
  flat.setAttribute('barycentric', new THREE.BufferAttribute(barycentric, 3));
  const material = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX, fragmentShader: SHELL_FRAGMENT,
    side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false, forceSinglePass: true,
    uniforms: { presence: scene.uniforms.presence, lineOpacity: { value: line }, fillOpacity: { value: fill } },
  });
  const mesh = new THREE.Mesh(flat, material);
  mesh.userData.posterLine = line; mesh.userData.posterFill = fill;
  parent.add(mesh); scene.materials.add(material);
  return mesh;
}
function globe(scene, parent, radius, detail = 96) {
  const mesh = shell(scene, parent, new THREE.SphereGeometry(radius, detail, Math.round(detail * .65)), .13, .014);
  return mesh;
}
function stars(scene, parent, count, seed, sample, flow = 0) {
  const rng = random(seed), positions = [], sizes = [], phases = [], rates = [], strengths = [];
  for (let i = 0; i < count; i++) {
    const star = sample(rng, i);
    positions.push(...star.position); sizes.push(star.size ?? .7 + rng() * 1.4);
    phases.push(rng() * TAU); rates.push(star.rate ?? 0);
    strengths.push(star.strength ?? .13 + rng() * .21);
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, values, size] of [['position', positions, 3], ['starSize', sizes, 1], ['phase', phases, 1], ['rate', rates, 1], ['strength', strengths, 1]])
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, size));
  const material = new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT, transparent: true, depthWrite: false, depthTest: false,
    uniforms: { ...scene.uniforms, flow: { value: flow } },
  });
  const points = new THREE.Points(geometry, material); points.frustumCulled = false;
  parent.add(points); scene.materials.add(material);
  return points;
}
function orbitTrace(scene, parent, radius, inclination = 0) {
  const band = shell(scene, parent, grid((u, v) => {
    const angle = u * TAU, r = radius + (v - .5) * .009;
    return [r * Math.cos(angle), 0, r * Math.sin(angle)];
  }, 320, 1), .12, 0);
  band.rotation.x = inclination;
  return band;
}

function orbitalSystem(scene) {
  const content = new THREE.Group(); scene.root.add(content);
  content.rotation.set(.45, .2, -.23);
  const primary = new THREE.Group(); primary.position.x = -.45; content.add(primary);
  globe(scene, primary, .91, 128);
  const rings = new THREE.Group(); rings.rotation.set(.2, -.1, .36); primary.add(rings);
  for (const [inner, outer] of [[1.17, 1.42], [1.47, 1.72], [1.8, 1.93]]) {
    shell(scene, rings, grid((u, v) => {
      const angle = u * TAU, r = inner + (outer - inner) * v;
      return [r * Math.cos(angle), .018 * Math.sin(angle * 6 + v * 3), r * Math.sin(angle)];
    }, 320, 8), .085, .004);
  }
  stars(scene, rings, 1800, 19373, rng => {
    const angle = rng() * TAU, r = 1.17 + rng() * .76;
    return { position: [r * Math.cos(angle), (rng() - .5) * .045, r * Math.sin(angle)], rate: .045 / r, size: .6 + rng() * .8, strength: .16 };
  });
  const satellites = [[2.62, .32, .14, .5], [2.12, .15, -.55, 3.4], [1.5, .09, .9, 1.8]].map(([radius, size, inclination, phase], i) => {
    const orbit = new THREE.Group(); orbit.rotation.x = inclination; content.add(orbit);
    orbitTrace(scene, orbit, radius);
    const moon = globe(scene, orbit, size, i === 0 ? 80 : 48);
    return { moon, radius, phase, speed: [.105, .17, .24][i] };
  });
  stars(scene, content, 650, 48131, rng => {
    const a = rng() * TAU, z = 2 * rng() - 1, r = 2.7 + rng() * .25, s = Math.sqrt(1 - z * z);
    return { position: [r * s * Math.cos(a), r * z * .65, r * s * Math.sin(a)], size: .6 + rng(), strength: .1 + rng() * .13 };
  });
  scene.animate = time => {
    rings.rotation.y = time * .016;
    primary.rotation.y = time * .027;
    for (const satellite of satellites) {
      const a = satellite.phase + time * satellite.speed;
      satellite.moon.position.set(satellite.radius * Math.cos(a), 0, satellite.radius * Math.sin(a));
      satellite.moon.rotation.y = time * .08;
    }
  };
  scene.theme = 'Orbital atlas';
}

function quasar(scene) {
  const content = new THREE.Group(); content.rotation.set(.2, .08, -.34); scene.root.add(content);
  const disk = new THREE.Group(); content.add(disk);
  for (let sheet = 0; sheet < 2; sheet++) {
    const mesh = shell(scene, disk, grid((u, v) => {
      const angle = u * TAU, r = .68 + v * 2.06;
      const warp = .12 * Math.sin(angle * 3 + v * 4 + sheet * 1.8) * Math.sin(v * Math.PI);
      return [r * Math.cos(angle), warp + .17 / (r + .3) + sheet * .05, r * Math.sin(angle)];
    }, 320, 28), .075, .005);
    mesh.rotation.z = sheet * .06;
  }
  const horizon = shell(scene, content, new THREE.TorusGeometry(.63, .055, 12, 256), .15, .005);
  horizon.rotation.x = Math.PI / 2;
  globe(scene, content, .53, 96);
  const jets = new THREE.Group(); content.add(jets);
  for (const sign of [-1, 1]) {
    shell(scene, jets, grid((u, v) => {
      const angle = u * TAU + v * 1.6, y = .55 + v * 2.5;
      const r = .065 + .18 * v + .035 * Math.sin(v * Math.PI * 3);
      return [r * Math.cos(angle), sign * y, r * Math.sin(angle)];
    }, 48, 112), .10, .006);
  }
  stars(scene, disk, 3400, 33191, rng => {
    const r = .68 + 2.08 * Math.sqrt(rng()), a = rng() * TAU;
    return { position: [r * Math.cos(a), .17 / (r + .3) + (rng() - .5) * .09, r * Math.sin(a)], rate: .16 / (r ** 1.3), size: .6 + rng() * 1.1 };
  }, 1);
  stars(scene, jets, 900, 87533, rng => {
    const y = .7 + rng() * 2.35, a = rng() * TAU, r = rng() * (.04 + y * .06);
    return { position: [r * Math.cos(a), (rng() < .5 ? -1 : 1) * y, r * Math.sin(a)], size: .7 + rng() * 1.2, strength: .18 + rng() * .2 };
  }, 2);
  scene.animate = time => { disk.rotation.y = time * .022; jets.rotation.y = time * .07; };
  scene.theme = 'Accretion and polar jets';
}

function galaxy(scene) {
  const content = new THREE.Group(); content.rotation.set(.68, .1, -.16); scene.root.add(content);
  const arms = new THREE.Group(); content.add(arms);
  for (let arm = 0; arm < 5; arm++) {
    shell(scene, arms, grid((u, v) => {
      const r = .3 + 2.65 * u, angle = arm * TAU / 5 + 2.8 * Math.log(1 + 4 * u) + (v - .5) * (.20 + .16 * u);
      return [r * Math.cos(angle), .055 * Math.sin(angle * 2) * u + (v - .5) * .065, r * Math.sin(angle)];
    }, 256, 12), .07, .004);
  }
  const core = globe(scene, content, .5, 96); core.scale.set(1, .55, 1);
  stars(scene, content, 7800, 60827, (rng, i) => {
    const r = .2 + 2.78 * Math.sqrt(rng()), arm = i % 5;
    const angle = arm * TAU / 5 + 2.8 * Math.log(1 + 4 * (r - .2) / 2.78) + (rng() - .5) * (.22 + .13 * r);
    return { position: [r * Math.cos(angle), (rng() + rng() + rng() - 1.5) * (.055 + .12 * (1 - r / 3)), r * Math.sin(angle)], rate: .032 / (.6 + r), size: .65 + rng() * 1.5 };
  }, 1);
  stars(scene, content, 1800, 91283, rng => {
    const a = rng() * TAU, z = rng() * 2 - 1, r = .72 * rng() ** .65, s = Math.sqrt(1 - z * z);
    return { position: [r * s * Math.cos(a), r * z * .7, r * s * Math.sin(a)], rate: .05, size: .7 + rng(), strength: .13 + rng() * .15 };
  });
  const binary = [globe(scene, content, .10, 40), globe(scene, content, .075, 40)];
  scene.animate = time => {
    arms.rotation.y = time * .012;
    binary.forEach((body, i) => { const a = time * .25 + i * Math.PI; body.position.set(.24 * Math.cos(a), .03 * Math.sin(a), .24 * Math.sin(a)); });
  };
  scene.theme = 'Spiral galaxy and stellar cluster';
}

export function createCosmos(name) {
  if (!COSMIC_TARGETS.includes(name)) throw new Error(`Unknown cosmic scene: ${name}`);
  const scene = {
    root: new THREE.Group(), materials: new Set(),
    uniforms: { time: { value: 0 }, presence: { value: 1 }, pixelRatio: { value: 1 } },
    bounds: [{ center: [0, 0, 0], radius: 3.65 }],
  };
  ({ education: orbitalSystem, experience: quasar, projects: galaxy })[name](scene);
  scene.root.name = `cosmos-${name}`;
  scene.update = (time = 0, presence = 1, pixelRatio = 1) => {
    scene.uniforms.time.value = time;
    scene.uniforms.presence.value = presence;
    scene.uniforms.pixelRatio.value = pixelRatio;
    scene.animate(time); scene.root.updateMatrixWorld(true);
  };
  scene.dispose = () => {
    const geometries = new Set(); scene.root.traverse(object => { if (object.geometry) geometries.add(object.geometry); });
    geometries.forEach(geometry => geometry.dispose()); scene.materials.forEach(material => material.dispose());
  };
  scene.update();
  return scene;
}
