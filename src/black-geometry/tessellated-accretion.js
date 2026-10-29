import * as THREE from 'three';
import { facetGeometry, facetMesh, globe, triangleSurface, PALETTES, TAU } from './tessellation.js';

export function accretionPoint(u,v) {
  const a=u*TAU,r=.88+2.16*v;
  const wave=.10*Math.sin(a*3+r*2)+.06*Math.sin(a*7-r*3);
  return [r*Math.cos(a),wave*(.25+.75*v),r*Math.sin(a)];
}
export function createAccretion(scene) {
  const content=new THREE.Group();scene.root.add(content);
  const disk=facetMesh(scene,content,facetGeometry(triangleSurface(accretionPoint,128,24,true),p=>{
    const r=Math.hypot(p[0],p[2]),a=Math.atan2(p[2],p[0]);
    return .20+.45*(1-(r-.88)/2.16)+.16*Math.sin(a*4+r*8);
  }),{palette:PALETTES.hole,fill:.42,edge:.72,width:.50,back:.80,flow:.30,ripple:.045,pulse:.06});
  disk.userData.role='accretion-disk';
  // A curved, triangulated image of the far disk wraps above and below the shadow.
  const arc=facetMesh(scene,content,facetGeometry(triangleSurface((u,v)=>{
    const a=u*TAU,s=Math.sin(a),width=.025+(s>0?.38:.14)*Math.abs(s)**.7,r=.805+width*v;
    return[r*Math.cos(a),r*s,-.23-.12*s*s];
  },128,10,true),p=>.3+.45*Math.abs(p[1])),{
    palette:PALETTES.hole,fill:.28,edge:.66,width:.50,back:.35,pulse:.10});
  arc.userData.role='lensed-disk';
  const shadow=globe(scene,content,.80,15,{palette:PALETTES.hole,voidCore:true,fill:.98,edge:.99,width:.38});
  shadow.userData.role='event-horizon';shadow.renderOrder=-1;
  scene.animate=t=>{content.rotation.set(.10+Math.sin(t*.055)*.045,Math.sin(t*.035)*.08,-.12);shadow.rotation.y=t*.045;};
  scene.theme='Black hole';scene.volumeKind='tessellated-accretion';scene.radius=3.25;
}
