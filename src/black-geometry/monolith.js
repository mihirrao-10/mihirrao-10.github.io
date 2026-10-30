import * as THREE from 'three';

// The unadorned 1:4:9 slab from 2001: A Space Odyssey, modeled from primitives.
export function createMonolith(scene) {
  const content = new THREE.Group(); scene.root.add(content);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, depthTest: true,
    uniforms: { ...scene.uniforms },
    vertexShader: `varying vec3 normalView;
      void main(){normalView=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float presence;varying vec3 normalView;
      void main(){vec3 n=normalize(normalView);float light=max(0.0,dot(n,normalize(vec3(-.7,.8,1.0))));
      gl_FragColor=vec4(vec3(.012+.055*light),.98*presence);}`,
  });
  material.userData.bodyDepth = true; scene.materials.add(material);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 4.05, .45), material);
  slab.userData.posterKind = 'monolith'; slab.userData.role = 'monolith'; content.add(slab);
  scene.animate = time => content.rotation.set(.08 + .025 * Math.sin(time * .04), -.32 + time * .025, -.045);
  scene.theme = '2001 monolith'; scene.volumeKind = 'monolith'; scene.radius = 3.0;
  scene.proportions = [1, 4, 9];
}
