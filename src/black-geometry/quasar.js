import * as THREE from 'three';
import { random, gaussian, pointMaterial, surfaceMaterial, valueNoise } from './astronomy-materials.js';

const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// The jet travels outwards; its slight helical displacement and widening sheath
// keep the two plumes spatial when the visitor turns the object.
export function quasarJetPosition(u, angle, shell, side, time = 0, rate = .075) {
  const along = (u + time * rate) % 1;
  const width = .022 + .19 * along ** 1.4 + .10 * Math.exp(-(((along - .86) / .11) ** 2));
  const swirl = angle + along * 9 + time * .12;
  return [
    Math.cos(swirl) * width * shell + .045 * Math.sin(along * 13 + side) * along,
    side * (.12 + along * 3.2),
    Math.sin(swirl) * width * shell + .035 * Math.sin(along * 10 + 2) * along,
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
        float width=.022+.19*pow(u,1.4)+.10*exp(-pow((u-.86)/.11,2.0));
        float a=angle+u*9.0+time*.12;
        vec3 p=vec3(cos(a)*width*shell+.045*sin(u*13.0+side)*u,
          side*(.12+u*3.2),sin(a)*width*shell+.035*sin(u*10.0+2.0)*u);
        vec4 view=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(starSize*pixelRatio*12.0/max(1.0,-view.z),.65,8.0*pixelRatio);
        float fade=smoothstep(.0,.04,u)*(1.0-smoothstep(.80,1.0,u));
        float shocks=.54+.46*pow(.5+.5*cos(u*35.0-time*.7),4.0);
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

function accretionDisk(scene, parent) {
  const count = 88000, rng = random(678134), attributes = {
    position: new Float32Array(count * 3), starSize: new Float32Array(count),
    strength: new Float32Array(count), phase: new Float32Array(count), rate: new Float32Array(count),
    orbitCenter: new Float32Array(count * 3), orbitAxis: new Float32Array(count * 3),
  };
  for (let i = 0; i < count; i++) {
    const u = rng(), r = .16 + 1.64 * u ** 1.5, a = rng() * TAU;
    const cloud = valueNoise(Math.cos(a) * r * 8, Math.sin(a) * r * 8, r * 6);
    const wave = Math.sin(a * 3 + r * 9 + cloud * 3);
    const thickness = (.014 + .030 * r) * clamp(gaussian(rng), -2.5, 2.5);
    attributes.position.set([r * Math.cos(a), thickness, r * Math.sin(a)], i * 3);
    attributes.orbitAxis[i * 3 + 1] = 1;
    attributes.starSize[i] = .45 + rng() ** 2 * 1.6;
    attributes.strength[i] = (.13 + rng() * .37) * (.35 + .65 * cloud) * (.58 + .42 * wave ** 2) * (1 - .48 * u);
    attributes.phase[i] = rng() * TAU;
    attributes.rate[i] = .17 / (r + .25) ** 1.3;
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, data] of Object.entries(attributes)) {
    geometry.setAttribute(name, new THREE.BufferAttribute(data, ['position', 'orbitCenter', 'orbitAxis'].includes(name) ? 3 : 1));
  }
  const disk = new THREE.Points(geometry, pointMaterial(scene));
  disk.frustumCulled = false; disk.userData = { posterKind: 'stars', posterSoft: 0, role: 'quasar-disk' };
  parent.add(disk);
}

function bipolarJets(scene, parent) {
  const count = 104000, rng = random(923473), data = {
    position: new Float32Array(count * 3), starSize: new Float32Array(count), strength: new Float32Array(count),
    along: new Float32Array(count), angle: new Float32Array(count), shell: new Float32Array(count),
    side: new Float32Array(count), rate: new Float32Array(count), density: new Float32Array(count),
  };
  for (let i = 0; i < count; i++) {
    const u = rng(), angle = rng() * TAU, side = i % 2 ? 1 : -1;
    const shell = rng() ** .6, rate = .045 + rng() * .045;
    const fade = THREE.MathUtils.smoothstep(u, 0, .04) * (1 - THREE.MathUtils.smoothstep(u, .80, 1));
    const shocks = .54 + .46 * (.5 + .5 * Math.cos(u * 35)) ** 4;
    const strength = (.16 + rng() * .34) * (1 - .3 * shell);
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
  accretionDisk(scene, content);
  bipolarJets(scene, content);
  const coreMaterial = surfaceMaterial(scene, 3, null, { opacity: 1.3, detail: 128 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(.115, 128, 64), coreMaterial);
  core.userData = { posterKind: 'body', surfaceKind: 3, role: 'quasar-core' }; content.add(core);
  scene.animate = time => {
    content.rotation.set(.48 + .035 * Math.sin(time * .04), .15 + time * .012, -.48);
    core.rotation.y = time * .13;
  };
  scene.theme = 'Quasar'; scene.volumeKind = 'bipolar-quasar'; scene.renderMode = 'particle-quasar';
  scene.particleCount = 192000; scene.radius = 3.75;
}
