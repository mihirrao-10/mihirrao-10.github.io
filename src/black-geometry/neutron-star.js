import * as THREE from 'three';
import { facetGeometry, facetMesh, globe, triangleSurface, PALETTES, TAU } from './tessellation.js';

export function dipolePoint(theta,azimuth,extent) {
  const r=extent*Math.sin(theta)**2;
  return new THREE.Vector3(r*Math.sin(theta)*Math.cos(azimuth),r*Math.cos(theta),r*Math.sin(theta)*Math.sin(azimuth));
}
export function createNeutronStar(scene) {
  const spin=new THREE.Group(),magnet=new THREE.Group();magnet.rotation.z=.47;spin.add(magnet);scene.root.add(spin);
  const core=globe(scene,magnet,.78,17,{palette:PALETTES.neutron,fill:.58,edge:.68,width:.48,back:.06,pulse:.08});
  // Broad, translucent magnetic ribbons expose their triangular surface.
  for(const extent of [1.55,2.35])for(let i=0;i<12;i++) {
    const azimuth=i/12*TAU,theta0=Math.asin(Math.sqrt(.78/extent));
    const geometry=triangleSurface((u,v)=>dipolePoint(theta0+(Math.PI-2*theta0)*u,azimuth+(v-.5)*.12,extent).toArray(),64,3);
    const mesh=facetMesh(scene,magnet,facetGeometry(geometry,p=>.35+.3*Math.cos(p[1]*3+i)),{
      palette:PALETTES.neutron,fill:.13,edge:.46,width:.48,back:.35,pulse:.12});
    mesh.userData.role='magnetic-field';
  }
  for(const sign of [-1,1]) {
    const geometry=triangleSurface((u,v)=>{
      const a=u*TAU,r=.05+.20*v;return[r*Math.cos(a),sign*(.75+1.86*v),r*Math.sin(a)];
    },12,26,true);
    const beam=facetMesh(scene,magnet,facetGeometry(geometry,p=>1-(Math.abs(p[1])-.75)/1.86),{
      palette:PALETTES.neutron,fill:.16,edge:.40,width:.50,back:.30,pulse:.15});
    beam.userData.role='pulsar-beam';
  }
  scene.animate=t=>{spin.rotation.set(.10,t*.26,-.12);core.rotation.y=t*.45;};
  scene.theme='Neutron star';scene.volumeKind='magnetosphere';scene.radius=2.95;
}
