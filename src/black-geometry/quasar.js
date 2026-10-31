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
    uniforms: { ...scene.uniforms, viewportHeight: { value: 765 } },
    vertexShader: `
      attribute float along,angle,shell,side,rate,starSize,density;
      uniform float time,pixelRatio,viewportHeight;
      varying float alpha;
      void main(){
        float u=fract(along+time*rate);
        float width=.012+.052*pow(u,1.4)+.028*exp(-pow((u-.78)/.10,2.0));
        float a=angle+u*12.0+time*.12;
        vec3 p=vec3(cos(a)*width*shell+.025*sin(u*13.0+side)*u,
          side*(.12+u*3.2),sin(a)*width*shell+.020*sin(u*10.0+2.0)*u);
        vec4 view=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*view;
        float natural=starSize*viewportHeight/765.0*12.0/max(1.0,-view.z);
        gl_PointSize=clamp(natural,.65*pixelRatio,8.0*pixelRatio);
        float fade=smoothstep(.0,.025,u)*(1.0-smoothstep(.88,1.0,u));
        float shocks=.64+.36*pow(.5+.5*cos(u*40.0-time*.7),4.0);
        alpha=density*fade*shocks*min(1.0,natural*natural/(gl_PointSize*gl_PointSize));
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
  const viewport = new THREE.Vector2();
  cloud.onBeforeRender = renderer => {
    cloud.material.uniforms.viewportHeight.value = renderer.getDrawingBufferSize(viewport).y;
  };
  cloud.frustumCulled = false;
  cloud.userData = { posterKind: 'stars', posterSoft: softness, role };
  parent.add(cloud);
}

function accretionDisk(scene, parent) {
  const count = 88000, rng = random(678134), attributes = cloudAttributes(count);
  for (let i = 0; i < count; i++) {
    const u = rng(), a = rng() * TAU;
    // Continuous radii avoid the old quantized, concentric grooves. The warped
    // noise field makes broad eddies, broken streams and fine mottled dust.
    const r = .045 + 2.16 * u ** 1.35;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const warp = valueNoise(x * 2.2, z * 2.2, 1.7);
    const cloud = valueNoise(x * 5 + warp * 2, z * 5 - warp, r * 1.8);
    const fine = valueNoise(x * 18, z * 18, warp * 3);
    const stream = .5 + .5 * Math.sin(a * 3 - r * 7 + warp * 9);
    const thickness = (.018 + .055 * r) * clamp(gaussian(rng), -2.5, 2.5)
      + .045 * r * Math.sin(a * 3 + r * 2);
    attributes.position.set([x, thickness, z], i * 3);
    attributes.orbitAxis[i * 3 + 1] = 1;
    attributes.starSize[i] = .65 + rng() ** 2 * 1.75;
    const edge = 1 - THREE.MathUtils.smoothstep(r, 1.55, 2.23);
    attributes.strength[i] = (.36 + rng() * .40) * (.3 + .9 * cloud)
      * (.5 + .5 * stream) * (.65 + .35 * fine) * edge;
    attributes.phase[i] = rng() * TAU;
    attributes.rate[i] = .095 / (r + .3) ** 1.3;
  }
  addCloud(scene, parent, attributes, 'quasar-disk', 1);
}

function surroundingFilaments(scene, parent) {
  const count = 64000, rng = random(431785), attributes = cloudAttributes(count);
  // Independent ribbons overlap above and below the disk. Unequal lengths,
  // pitch and thickness break rotational symmetry without adding draw calls.
  const ribbons = Array.from({ length: 23 }, () => ({
    angle: rng() * TAU, start: .35 + rng() * .7, span: 1.4 + rng() * .75,
    pitch: .8 + rng() * 2.4, lift: (rng() - .5) * 1.15,
    phase: rng() * TAU, width: .025 + rng() * .065,
  }));
  for (let i = 0; i < count; i++) {
    const ribbon = ribbons[i % ribbons.length], u = rng();
    const diffuse = i % 3 === 0, r = ribbon.start + ribbon.span * u;
    const a = ribbon.angle - ribbon.pitch * Math.log(r + .25)
      + .22 * Math.sin(u * 7 + ribbon.phase);
    const spread = clamp(gaussian(rng), -2.5, 2.5) * ribbon.width * (diffuse ? 3 : 1);
    const height = ribbon.lift * Math.sin(u * Math.PI * .8)
      + .17 * Math.sin(u * 9 + ribbon.phase) * u
      + clamp(gaussian(rng), -2.5, 2.5) * (diffuse ? .14 : .025);
    attributes.position.set([(r + spread) * Math.cos(a), height, (r + spread) * Math.sin(a)], i * 3);
    attributes.orbitAxis[i * 3 + 1] = 1;
    attributes.starSize[i] = diffuse ? 2 + rng() * 3.8 : .65 + rng() * 1.5;
    const edge = THREE.MathUtils.smoothstep(u, 0, .08) * (1 - THREE.MathUtils.smoothstep(u, .72, 1));
    const knots = .45 + .55 * (.5 + .5 * Math.sin(u * 17 + ribbon.phase)) ** 2;
    attributes.strength[i] = (diffuse ? .085 : .30) * (.4 + rng() * .6) * edge * knots;
    attributes.phase[i] = rng() * TAU;
    attributes.rate[i] = .018 / (r + .6);
  }
  addCloud(scene, parent, attributes, 'quasar-filaments', 1);
}

function turbulentEnvelope(scene, parent) {
  const count = 20000, rng = random(310947), attributes = cloudAttributes(count);
  for (let i = 0; i < count; i++) {
    const r = .6 + rng() ** .65 * 2.45, a = rng() * TAU;
    const x = r * Math.cos(a), z = r * Math.sin(a);
    const warp = valueNoise(x * 1.8, z * 1.8, 2);
    const height = .24 * Math.sin(a * 2 + r * 2) + (warp - .5) * .65
      + clamp(gaussian(rng), -2.5, 2.5) * .18;
    attributes.position.set([x, height, z], i * 3);
    attributes.orbitAxis[i * 3 + 1] = 1;
    attributes.starSize[i] = 3 + rng() * 5;
    const cloud = valueNoise(x * 3 + warp * 2, z * 3 - warp, height * 3);
    const edge = 1 - THREE.MathUtils.smoothstep(r, 1.8, 3.05);
    attributes.strength[i] = (.018 + .060 * cloud ** 2) * edge;
    attributes.phase[i] = rng() * TAU;
    attributes.rate[i] = .012 / (r + .6);
  }
  addCloud(scene, parent, attributes, 'quasar-envelope', 1);
}

function bipolarJets(scene, parent) {
  const count = 20000, rng = random(923473), data = {
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
  const viewport = new THREE.Vector2();
  jets.onBeforeRender = renderer => {
    material.uniforms.viewportHeight.value = renderer.getDrawingBufferSize(viewport).y;
  };
  jets.frustumCulled = false; jets.renderOrder = 1;
  jets.userData = { posterKind: 'stars', posterSoft: 0, role: 'quasar-jets' };
  parent.add(jets);
}

export function createQuasar(scene) {
  const content = new THREE.Group(); scene.root.add(content);
  turbulentEnvelope(scene, content);
  surroundingFilaments(scene, content);
  accretionDisk(scene, content);
  bipolarJets(scene, content);
  const coreMaterial = surfaceMaterial(scene, 3, null, { opacity: .75, detail: 48 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(.085, 48, 24), coreMaterial);
  core.userData = { posterKind: 'body', surfaceKind: 3, role: 'quasar-core' }; content.add(core);
  scene.animate = time => {
    content.rotation.set(.62 + .025 * Math.sin(time * .04), .15 + time * .008, .48);
    core.rotation.y = time * .13;
  };
  scene.theme = 'Quasar'; scene.volumeKind = 'bipolar-quasar'; scene.renderMode = 'particle-quasar';
  scene.particleCount = 192000; scene.radius = 3.75;
}
