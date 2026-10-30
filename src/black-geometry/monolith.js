import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { random } from './astronomy-materials.js';

export function createMonolith(scene) {
  const content = new THREE.Group(); scene.root.add(content);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, depthTest: true,
    uniforms: { ...scene.uniforms },
    vertexShader: `varying vec3 normalView,viewDirection;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.0);normalView=normalize(normalMatrix*normal);
      viewDirection=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform float presence;varying vec3 normalView,viewDirection;
      void main(){vec3 n=normalize(normalView),v=normalize(viewDirection),r=reflect(-v,n);
      float diffuse=max(0.0,dot(n,normalize(vec3(-.7,.8,1.0))));
      float strip=exp(-pow(abs((r.x+.78)/.035),4.0))*(.62+.38*smoothstep(-.8,.8,r.y));
      float other=exp(-pow(abs((r.x-.65)/.10),4.0))*.45;
      float spec=pow(max(0.0,dot(n,normalize(v+normalize(vec3(-.7,.8,1.0))))),90.0);
      float fresnel=pow(1.0-max(0.0,dot(n,v)),4.0);
      float sheen=.012+.035*diffuse+.38*strip+.18*other+.22*spec+.10*fresnel;
      gl_FragColor=vec4(vec3(sheen),presence);}`,
  });
  material.userData.bodyDepth = true; scene.materials.add(material);
  const slab = new THREE.Mesh(new RoundedBoxGeometry(1.8, 4.05, .45, 4, .018), material);
  slab.userData.posterKind = 'monolith'; slab.userData.role = 'monolith'; content.add(slab);

  const rng = random(2001009), count = 64, data = new Float32Array(count * 6), strength = new Float32Array(count * 2);
  const paths = Array.from({ length: count }, () => {
    const angle = rng() * Math.PI * 2, radius = 1.35 + rng() * .9;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius * .65,
      phase: rng() * 5.6, length: .22 + rng() * .66, speed: .7 + rng() * .9, strength: .35 + rng() * .65 };
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('strength', new THREE.BufferAttribute(strength, 1).setUsage(THREE.DynamicDrawUsage));
  const streakMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, opacity: .26,
    uniforms: { ...scene.uniforms },
    vertexShader: `attribute float strength;varying float fade;
      void main(){fade=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float presence;varying float fade;
      void main(){gl_FragColor=vec4(vec3(.12),fade*.26*presence);}`,
  });
  scene.materials.add(streakMaterial);
  const streaks = new THREE.LineSegments(geometry, streakMaterial); streaks.frustumCulled = false; streaks.renderOrder = 1;
  streaks.userData = { role: 'travel-streaks', posterKind: 'travel-streaks' }; content.add(streaks);
  scene.animate = time => {
    content.rotation.set(.08 + .025 * Math.sin(time * .04), -.32 + time * .025, -.08 + Math.sin(time * .055) * .045);
    paths.forEach((path, i) => {
      const top = 2.8 - (time * path.speed + path.phase) % 5.6, bottom = Math.max(-2.8, top - path.length);
      data.set([path.x, top, path.z, path.x, bottom, path.z], i * 6);
      const fade = Math.max(0, Math.min(1, (2.8 - top) * 4, (bottom + 2.8) * 4));
      strength[i * 2] = strength[i * 2 + 1] = path.strength * fade;
    });
    geometry.attributes.position.needsUpdate = geometry.attributes.strength.needsUpdate = true;
  };
  scene.theme = '2001 monolith'; scene.volumeKind = 'monolith'; scene.radius = 4.05;
  scene.proportions = [1, 4, 9];
}
