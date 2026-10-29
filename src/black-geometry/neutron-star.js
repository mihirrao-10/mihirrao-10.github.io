import * as THREE from 'three';
import { surfaceMaterial } from './astronomy-materials.js';

const TAU = Math.PI * 2;
const CORE_RADIUS = .66;

export function dipolePoint(theta, azimuth, extent) {
  const r = extent * Math.sin(theta) ** 2;
  return new THREE.Vector3(r * Math.sin(theta) * Math.cos(azimuth), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(azimuth));
}

function emissionMaterial(scene, opacity, beam = false) {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.FrontSide,
    uniforms: { ...scene.uniforms, opacity: { value: opacity } },
    vertexShader: `varying vec2 vUv;varying vec3 vNormal,vView;
      void main(){vUv=uv;vNormal=normalMatrix*normal;
      vec4 p=modelViewMatrix*vec4(position,1.);vView=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float time,presence,opacity;varying vec2 vUv;varying vec3 vNormal,vView;
      void main(){
        float facing=max(0.,dot(normalize(vNormal),normalize(vView)));
        float flow=${beam ? '.78+.22*sin(vUv.y*16.-time*2.4)' : '.60+.40*pow(.5+.5*sin(vUv.x*13.-time*.85),2.)'};
        float envelope=${beam ? 'pow(1.-vUv.y,1.65)' : '.65+.35*sin(fract(vUv.x)*3.14159265)'};
        float radial=pow(facing,${beam ? '.80' : '.35'});
        gl_FragColor=vec4(vec3(.02),opacity*flow*envelope*radial*presence);
      }`,
  });
  scene.materials.add(material);return material;
}

export function createNeutronStar(scene) {
  const spin = new THREE.Group(), magnet = new THREE.Group();
  magnet.rotation.z = .43;spin.add(magnet);scene.root.add(spin);
  const core = new THREE.Mesh(new THREE.SphereGeometry(CORE_RADIUS, 512, 256),
    surfaceMaterial(scene, 8, null, { opacity: 1.06, detail: 512 }));
  core.userData.posterKind = 'body';core.userData.surfaceKind = 8;
  core.userData.role = 'neutron-core';magnet.add(core);

  // Sparse, hairline dipole paths leave open space around the compact star.
  const outerMaterial = emissionMaterial(scene, .48), innerMaterial = emissionMaterial(scene, .27);
  for (const [extent, count, phase, material] of [[2.20, 10, 0, outerMaterial], [1.36, 6, .28, innerMaterial]]) {
    for (let i = 0; i < count; i++) {
      const azimuth = i / count * TAU + phase, theta0 = Math.asin(Math.sqrt(CORE_RADIUS / extent));
      const points = [];
      for (let j = 0; j <= 96; j++) points.push(dipolePoint(theta0 + (Math.PI - 2 * theta0) * j / 96, azimuth, extent));
      const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 192, .0045, 8, false);
      const uv = geometry.attributes.uv;for (let j = 0; j < uv.count; j++) uv.setX(j, uv.getX(j) + i * .067);
      const field = new THREE.Mesh(geometry, material);
      field.renderOrder = 1;field.userData.posterKind = 'magnetic-field';field.userData.role = 'magnetic-field';magnet.add(field);
    }
  }

  // Narrow cones fade both across their width and toward their open ends.
  const beamMaterial = emissionMaterial(scene, .46, true);
  for (const sign of [-1, 1]) {
    const length = 1.92, geometry = new THREE.CylinderGeometry(.082, .018, length, 64, 96, true);
    geometry.translate(0, CORE_RADIUS + length / 2 - .015, 0);
    const beam = new THREE.Mesh(geometry, beamMaterial);
    if (sign < 0) beam.rotation.z = Math.PI;
    beam.renderOrder = 1;beam.userData.posterKind = 'pulsar-beam';beam.userData.role = 'pulsar-beam';magnet.add(beam);
  }
  scene.animate = t => {
    spin.rotation.set(.12 + Math.sin(t * .08) * .035, t * .17, -.10);
    magnet.rotation.z = .43 + Math.sin(t * .11) * .035;
    core.rotation.y = t * .60;
  };
  scene.theme = 'Neutron star';scene.volumeKind = 'magnetosphere';scene.radius = 2.72;
}
