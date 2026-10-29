import * as THREE from 'three';
import { random, gaussian } from './astronomy-materials.js';
import { facetGeometry, facetMaterial, facetMesh, globe, triangleSurface, PALETTES, TAU } from './tessellation.js';

function spiralArm(phase, minor=false, columns=144, rows=12) {
  return triangleSurface((u,v)=>{
    const r=.34+2.45*u,a=phase+3.8*Math.log(1+2.4*u),cross=v*TAU;
    const envelope=Math.sin(Math.PI*u)**.42;
    const width=(minor?.12:.22)*(1+.7*u)*envelope;
    const radial=r+width*Math.cos(cross),height=(.09+.07*(1-u))*envelope*Math.sin(cross);
    return[radial*Math.cos(a),height+.045*Math.sin(a*3)*envelope,radial*Math.sin(a)];
  },columns,rows);
}
export function createGalaxyVolume(scene) {
  const content=new THREE.Group(),arms=new THREE.Group();scene.root.add(content);content.add(arms);
  for(let i=0;i<4;i++) {
    const minor=i>1,phase=i*Math.PI+(minor?Math.PI*.5:0);
    const arm=facetMesh(scene,arms,facetGeometry(spiralArm(phase,minor),p=>{
      const r=Math.hypot(p[0],p[2]);return .2+.5*(1-r/3)+.12*Math.sin(r*8);
    }),{palette:PALETTES.galaxy,fill:minor?.17:.30,edge:minor?.48:.72,width:.58,back:.24,flow:.055,ripple:.018});
    arm.userData.role='spiral-arm';
  }
  const disk=globe(scene,content,1,21,{palette:PALETTES.galaxy,scale:[2.85,.12,2.85],fill:.055,edge:.19,width:.50,back:.16,field:p=>.18+.55*Math.abs(p[1])**3});
  disk.userData.role='galactic-disk';
  const bar=globe(scene,content,1,15,{palette:PALETTES.galaxy,scale:[.90,.21,.30],fill:.30,edge:.64});
  const bulge=globe(scene,content,1,15,{palette:PALETTES.galaxy,scale:[.50,.36,.43],fill:.46,edge:.77,field:()=>.82});
  scene.animate=t=>{content.rotation.set(.75+Math.sin(t*.05)*.12,Math.sin(t*.035)*.24,-.24);arms.rotation.y=t*.045;bar.rotation.y=t*.025;bulge.rotation.y=t*.035;disk.rotation.y=t*.018;};
  scene.theme='Milky Way';scene.volumeKind='stellar-disk';scene.galaxyCount=1;scene.radius=3.25;
}

function combineGeometry(parts) {
  const triangles=parts.map(g=>{if(!g.index)return g;const plain=g.toNonIndexed();g.dispose();return plain;});
  const size=triangles.reduce((n,g)=>n+g.attributes.position.array.length,0),p=new Float32Array(size);let at=0;
  for(const geometry of triangles){p.set(geometry.attributes.position.array,at);at+=geometry.attributes.position.array.length;geometry.dispose();}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(p,3));return geometry;
}
// Locate luminous objects in a coarse image field, then retain their sky positions.
export function clusterFeatures(map){
  const {pixels,width,height}=map.userData,size=96,field=new Float32Array(size*size);
  for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){
    const index=Math.min(size-1,Math.floor(y/height*size))*size+Math.min(size-1,Math.floor(x/width*size));
    field[index]+=(pixels[y*width+x]/255)**1.5;
  }
  const candidates=[];
  for(let y=2;y<size-2;y++)for(let x=2;x<size-2;x++){
    let value=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)value+=field[(y+j)*size+x+i]*(i===0&&j===0?4:1);
    candidates.push({u:(x+.5)/size,v:(y+.5)/size,value});
  }
  candidates.sort((a,b)=>b.value-a.value);
  const selected=[];
  for(const feature of candidates){
    if(selected.every(p=>Math.hypot(p.u-feature.u,p.v-feature.v)>.051))selected.push(feature);
    if(selected.length===112)break;
  }
  return selected;
}

export function createClusterVolume(scene,maps) {
  const content=new THREE.Group();scene.root.add(content);const rng=random(66327);
  const ellipse=facetGeometry(new THREE.IcosahedronGeometry(1,2),p=>.35+.45*Math.abs(p[1]));
  const miniCore=new THREE.IcosahedronGeometry(.58,2);miniCore.scale(1,.6,1);
  const spiral=facetGeometry(combineGeometry([miniCore,spiralArm(0,false,24,4),spiralArm(Math.PI,false,24,4)]),p=>.25+.65*Math.exp(-Math.hypot(...p)));
  const material=facetMaterial(scene,{palette:PALETTES.cluster,fill:.36,edge:.72,width:.52,back:.20,pulse:.035});
  const features=clusterFeatures(maps.cluster),maximum=features[0].value;
  const galaxies=features.map((feature,i)=>{
    const x=(feature.u-.5)*4.55,y=(.5-feature.v)*4.55,r=Math.hypot(x,y),luminosity=feature.value/maximum;
    const z=THREE.MathUtils.clamp(gaussian(rng),-2.8,2.8)*.78*Math.sqrt(Math.max(.12,1-r*r/10));
    const radius=.035+.060*Math.sqrt(luminosity),isSpiral=i%3===0;
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rng()*2.2,rng()*TAU,rng()*TAU));
    const mesh=new THREE.Mesh(isSpiral?spiral:ellipse,material);mesh.position.set(x,y,z);mesh.quaternion.copy(q);
    mesh.scale.set(radius*(isSpiral?1:1.6),radius*(isSpiral?1:.8),radius*(isSpiral?1:1.15));
    mesh.userData.tessellated=true;mesh.userData.posterKind='facets';mesh.userData.role='cluster-galaxy';content.add(mesh);
    return {mesh,q,radius,center:[x,y,z],rate:.055+luminosity*.045};
  });
  const turn=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  scene.animate=t=>{content.rotation.set(.12+Math.sin(t*.08)*.14,t*.043,.06+Math.sin(t*.06)*.06);
    galaxies.forEach(g=>g.mesh.quaternion.copy(g.q).multiply(turn.setFromAxisAngle(axis,t*g.rate)));};
  scene.theme='Galaxy cluster';scene.volumeKind='galaxy-population';scene.galaxyCenters=galaxies.map(g=>g.center);scene.galaxyRadii=galaxies.map(g=>g.radius);
  scene.radius=Math.max(...galaxies.map(g=>Math.hypot(...g.center)+g.radius*3.2))*1.05;
}
