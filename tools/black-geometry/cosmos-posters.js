import * as THREE from 'three';

// The fallback uses the same shells, stars and orbital pose as the live scene.
export function cosmicPoster(scene) {
  scene.update(0);
  const point = new THREE.Vector3();
  const view = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.14, -.22, 0));
  const project = (position, i, matrix) => {
    point.fromBufferAttribute(position, i).applyMatrix4(matrix).applyMatrix4(view);
    return [400 + point.x / (12 - point.z) * 850, 300 - point.y / (12 - point.z) * 850];
  };
  const n = value => value.toFixed(2), layers = [];
  scene.root.traverse(object => {
    if (!object.geometry) return;
    const position = object.geometry.attributes.position;
    if (object.isMesh) {
      const paths = [];
      for (let i = 0; i < position.count; i += 3) {
        const corners = [i, i + 1, i + 2].map(j => project(position, j, object.matrixWorld));
        paths.push(`M${corners.map(p => p.map(n).join(' ')).join('L')}Z`);
      }
      layers.push(`<path d="${paths.join('')}" fill="#bbb" fill-opacity="${object.userData.posterFill}" stroke="#777" stroke-opacity="${object.userData.posterLine}" stroke-width=".4" stroke-linejoin="round"/>`);
    } else if (object.isPoints) {
      const size = object.geometry.attributes.starSize, strength = object.geometry.attributes.strength;
      for (let i = 0; i < position.count; i++) {
        const p = project(position, i, object.matrixWorld);
        layers.push(`<circle cx="${n(p[0])}" cy="${n(p[1])}" r="${n(size.getX(i) * .36)}" fill="#777" opacity="${n(strength.getX(i) * .82)}"/>`);
      }
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" aria-hidden="true">${layers.join('')}</svg>\n`;
}
