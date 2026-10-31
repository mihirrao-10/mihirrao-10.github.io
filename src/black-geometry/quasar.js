import * as THREE from 'three';
import { random, gaussian, pointMaterial, surfaceMaterial, valueNoise } from './astronomy-materials.js';

const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// A narrow spine carries small shocks out from the disk along both poles.
export function quasarJetPosition(u, angle, shell, side, time = 0, rate = .075) {
  const along = (u + time * rate) % 1;
  const width = .012 + .052 * along ** 1.4 + .028 * Math.exp(-(((along - .78) / .10) ** 2));
  const swirl = angle + along * 12 + time * .12;
  return [
    Math.cos(swirl) * width * shell + .025 * Math.sin(along * 13 + side) * along,
    side * (.12 + along * 3.2),
    Math.sin(swirl) * width * shell + .020 * Math.sin(along * 10 + 2) * along,
  ];
}

function jetMaterial(scene) {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    uniforms: { ...scene.uniforms },
    vertexShader: `
      attribute float along,angle,shell,side,rate,starSize,density;
      uniform float time,pixelRatio;
      varying float alpha;
      void main(){
        float u=fract(along+time*rate);
        float width=.012+.052*pow(u,1.4)+.028*exp(-pow((u-.78)/.10,2.0));
        float a=angle+u*12.0+time*.12;
        vec3 p=vec3(cos(a)*width*shell+.025*sin(u*13.0+side)*u,
          side*(.12+u*3.2),sin(a)*width*shell+.020*sin(u*10.0+2.0)*u);
        vec4 view=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(starSize*pixelRatio*12.0/max(1.0,-view.z),.65,8.0*pixelRatio);
        float fade=smoothstep(.0,.025,u)*(1.0-smoothstep(.88,1.0,u));
        float shocks=.64+.36*pow(.5+.5*cos(u*40.0-time*.7),4.0);
        alpha=density*fade*shocks;
      }`,
    fragmentShader: `
      uniform float presence;varying float alpha;
      void main(){vec2 p=gl_PointCoord-.5;float r=length(p);
        float grain=exp(-r*r*27.0)*(1.0-smoothstep(.32,.5,r));
        float ink=grain*alpha*presence;if(ink<.001)discard;
        gl_FragColor=vec4(vec3(.025),ink);
      }`,
  });
  scene.materials.add(material);
  return material;
}

function cloudAttributes(count) {
  return {
    position: new Float32Array(count * 3), starSize: new Float32Array(count),
    strength: new Float32Array(count), phase: new Float32Array(count), rate: new Float32Array(count),
    orbitCenter: new Float32Array(count * 3), orbitAxis: new Float32Array(count * 3),
  };
}

function addCloud(scene, parent, attributes, role, softness) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, data] of Object.entries(attributes)) {
    geometry.setAttribute(name, new THREE.BufferAttribute(data, ['position', 'orbitCenter', 'orbitAxis'].includes(name) ? 3 : 1));
  }
  const cloud = new THREE.Points(geometry, pointMaterial(scene, softness));
  cloud.frustumCulled = false;
  cloud.userData = { posterKind: 'stars', posterSoft: softness, role };
  parent.add(cloud);
}

function accretionDisk(scene, parent) {
  const count = 104000, rng = random(678134), attributes = cloudAttributes(count);
  for (let i = 0; i < count; i++) {
    const u = rng(), a = rng() * TAU, stream = i % 3 === 0;
    const r = stream
      ? .14 + 2 * (Math.floor(u * 9) + a / TAU) / 9 + gaussian(rng) * .014
      : .045 + 2.22 * u ** 1.5;
    const cloud = valueNoise(Math.cos(a) * r * 7, Math.sin(a) * r * 7, r * 5);
    // Tight turbulent bands keep the disk continuous rather than forming galactic arms.
    const streams = .5 + .5 * (.5 + .5 * Math.sin(a * 2 - r * 19 + cloud * 3)) ** 4;
    const thickness = (.018 + .035 * r) * clamp(gaussian(rng), -2.5, 2.5);
    attributes.position.set([r * Math.cos(a), thickness, r * Math.sin(a)], i * 3);
    attributes.orbitAxis[i * 3 + 1] = 1;
    attributes.starSize[i] = .65 + rng() ** 2 * 1.65;
    const edge = 1 - THREE.MathUtils.smoothstep(r, 1.65, 2.28);
    attributes.strength[i] = ((stream ? .5 : .25) + rng() * .35) * (.55 + .45 * cloud)
      * (stream ? 1 : streams) * (.35 + .65 * Math.exp(-r * .6)) * edge;
    attributes.phase[i] = rng() * TAU;
    attributes.rate[i] = .13 / (r + .3) ** 1.3;
  }
  addCloud(scene, parent, attributes, 'quasar-disk', 1);
}

function surroundingFilaments(scene, parent) {
  const count = 56000, rng = random(431785), attributes = cloudAttributes(count);
  for (let i = 0; i < count; i++) {
    const u = rng(), r = .7 + 2.42 * u ** .7, arm = (i % 9) * TAU / 9;
    const diffuse = i % 4 === 0;
    const a = arm - 1.45 * Math.log(r + .1) + .16 * Math.sin(r * 3 + arm) + gaussian(rng) * (diffuse ? .32 : .035);
    const height = .14 * r * Math.sin(a * 2 + arm) + .07 * r * Math.sin(r * 4 + arm)
      + clamp(gaussian(rng), -2, 2) * (diffuse ? .16 : .035) * r;
    attributes.position.set([r * Math.cos(a), height, r * Math.sin(a)], i * 3);
    attributes.orbitAxis[i * 3 + 1] = 1;
    attributes.starSize[i] = diffuse ? 1.5 + rng() * 2 : .55 + rng() * 1.1;
    const edge = 1 - THREE.MathUtils.smoothstep(u, .65, 1);
    attributes.strength[i] = (diffuse ? .035 : .12) * (.4 + rng() * .6) * edge;
    attributes.phase[i] = rng() * TAU;
    attributes.rate[i] = .035 / (r + .3);
  }
  addCloud(scene, parent, attributes, 'quasar-filaments', 1);
}

function bipolarJets(scene, parent) {
  const count = 32000, rng = random(923473), data = {
    position: new Float32Array(count * 3), starSize: new Float32Array(count), strength: new Float32Array(count),
    along: new Float32Array(count), angle: new Float32Array(count), shell: new Float32Array(count),
    side: new Float32Array(count), rate: new Float32Array(count), density: new Float32Array(count),
  };
  for (let i = 0; i < count; i++) {
    const u = rng(), angle = rng() * TAU, side = i % 2 ? 1 : -1;
    const shell = rng() ** .9, rate = .045 + rng() * .045;
    const fade = THREE.MathUtils.smoothstep(u, 0, .025) * (1 - THREE.MathUtils.smoothstep(u, .88, 1));
    const shocks = .64 + .36 * (.5 + .5 * Math.cos(u * 40)) ** 4;
    const strength = (.24 + rng() * .35) * (1 - .3 * shell) * (side > 0 ? 1 : .24);
    data.position.set(quasarJetPosition(u, angle, shell, side), i * 3);
    data.along[i] = u; data.angle[i] = angle; data.side[i] = side; data.shell[i] = shell; data.rate[i] = rate;
    data.starSize[i] = .48 + rng() ** 2 * 1.15;
    // Posters use the initial weight; moving grains use their underlying density.
    data.density[i] = strength;
    data.strength[i] = strength * fade * shocks;
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(data)) geometry.setAttribute(name, new THREE.BufferAttribute(values, name === 'position' ? 3 : 1));
  const material = jetMaterial(scene);
  const jets = new THREE.Points(geometry, material);
  jets.frustumCulled = false; jets.renderOrder = 1;
  jets.userData = { posterKind: 'stars', posterSoft: 0, role: 'quasar-jets' };
  parent.add(jets);
}

export function createQuasar(scene) {
  const content = new THREE.Group(); scene.root.add(content);
  surroundingFilaments(scene, content);
  accretionDisk(scene, content);
  bipolarJets(scene, content);
  const coreMaterial = surfaceMaterial(scene, 3, null, { opacity: .75, detail: 128 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(.085, 128, 64), coreMaterial);
  core.userData = { posterKind: 'body', surfaceKind: 3, role: 'quasar-core' }; content.add(core);
  scene.animate = time => {
    content.rotation.set(.62 + .025 * Math.sin(time * .04), .15 + time * .008, .48);
    core.rotation.y = time * .13;
  };
  scene.theme = 'Quasar'; scene.volumeKind = 'bipolar-quasar'; scene.renderMode = 'particle-quasar';
  scene.particleCount = 192000; scene.radius = 3.75;
}
