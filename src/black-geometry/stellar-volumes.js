import * as THREE from 'three';
import { random, gaussian, volumeMaterial } from './astronomy-materials.js';

const TAU=2*Math.PI;
const limit=(value,low,high)=>Math.max(low,Math.min(high,value));
const normal=(rng,scale=1)=>limit(gaussian(rng),-2.8,2.8)*scale;

function shells(scene,parent,{detail=128,opacity=.26}={}){
  const geometry=new THREE.SphereGeometry(1,detail,detail/2),material=volumeMaterial(scene,opacity);
  return (center,scale,quaternion)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(center);mesh.scale.fromArray(scale);
    if(quaternion)mesh.quaternion.copy(quaternion);
    mesh.userData.posterKind='volume';mesh.renderOrder=1;parent.add(mesh);return mesh;
  };
}

// A conservative bound covers every local particle orbit, including tilted ones.
function fitVolume(scene){
  let radius=0;
  scene.root.traverse(object=>{
    if(!object.geometry)return;
    const {position,orbitCenter}=object.geometry.attributes;
    if(object.isPoints){
      for(let i=0;i<position.count;i++){
        const c=[orbitCenter.getX(i),orbitCenter.getY(i),orbitCenter.getZ(i)];
        radius=Math.max(radius,Math.hypot(...c)+Math.hypot(position.getX(i)-c[0],position.getY(i)-c[1],position.getZ(i)-c[2]));
      }
    }else radius=Math.max(radius,object.position.length()+Math.max(...object.scale.toArray()));
  });
  scene.radius=radius*1.035;
}

export function createGalaxyVolume(scene,_maps,points){
  const content=new THREE.Group();scene.root.add(content);
  const shell=shells(scene,content,{detail:64,opacity:.13});
  const armPoint=(u,arm=0,minor=false)=>{
    const r=(minor?1.0:.48)+(minor?1.82:2.50)*u;
    const angle=arm*Math.PI+(minor?1.27:0)+2.5*Math.log(r/.48)+.06*Math.sin(u*19+arm);
    return {r,angle};
  };
  const arm=(rng,i,minor=false,soft=false)=>{
    let u=rng()**.82;
    if(rng()<.38)u=limit(Math.round(u*38)/38+normal(rng,.007),0,1);
    const {r,angle}=armPoint(u,i%2,minor);
    const a=angle+normal(rng,(minor?.23:.16)+u*.14)+(rng()<.12?.17:0);
    return {position:[r*Math.cos(a),normal(rng,.025+.075*(1-u)),r*Math.sin(a)],
      rate:.023/(r+.5)**.45,size:soft?5+rng()*8:.45+rng()*.95,
      strength:soft?.07+rng()*.055:(minor?.18:.22)+rng()*.34};
  };
  points(scene,content,112000,60827,(rng,i)=>arm(rng,i));
  points(scene,content,28000,52931,(rng,i)=>arm(rng,i,true));
  points(scene,content,28000,58271,(rng,i)=>arm(rng,i,false,true),{soft:1});
  points(scene,content,72000,91283,rng=>{
    let r;do{r=-.72*Math.log(Math.max(1e-9,rng()*rng()));}while(r>3.03);const a=rng()*TAU;
    return {position:[r*Math.cos(a),normal(rng,.075),r*Math.sin(a)],rate:.017/(r+.6)**.4,
      size:.35+rng()*.6,strength:(.30+rng()*.30)*(1-r/3.3)};
  });
  points(scene,content,40000,30193,rng=>({position:[normal(rng,.50),normal(rng,.12),normal(rng,.19)],
    size:.55+rng()*.9,strength:.35+rng()*.35,rate:0}));
  points(scene,content,20000,19137,rng=>({position:[normal(rng,.34),normal(rng,.23),normal(rng,.30)],
    size:.8+rng()*1.2,strength:.35+rng()*.4,rate:.045}));
  for(const radius of [.16,.27,.40,.59])shell([0,0,0],[radius*1.35,radius*.74,radius]);
  shell([0,0,0],[.92,.14,.24]);
  const starlight=shell([0,0,0],[3.04,.10,3.04]);starlight.material=volumeMaterial(scene,.09);
  const movingClouds=[],axisY=new THREE.Vector3(0,1,0),turn=new THREE.Quaternion();
  // Soft three-dimensional cloud volumes follow the two dominant arms.
  for(let arm=0;arm<2;arm++)for(let j=0;j<24;j++){
    const u=(j+.5)/24,{r,angle}=armPoint(u,arm),x=r*Math.cos(angle),z=r*Math.sin(angle);
    const tangent=new THREE.Vector3(Math.cos(angle)-2.5*Math.sin(angle),0,Math.sin(angle)+2.5*Math.cos(angle)).normalize();
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),tangent);
    const mesh=shell([x,0,z],[.20+.06*u,.055,.14+.04*u],q);
    movingClouds.push({mesh,center:mesh.position.clone(),orientation:q,rate:.023/(r+.5)**.45});
  }
  scene.animate=t=>{
    content.rotation.set(.80+Math.sin(t*.055)*.12,Math.sin(t*.035)*.30,-.27+Math.sin(t*.045)*.06);
    for(const cloud of movingClouds){cloud.mesh.position.copy(cloud.center).applyAxisAngle(axisY,t*cloud.rate);cloud.mesh.quaternion.copy(turn.setFromAxisAngle(axisY,t*cloud.rate)).multiply(cloud.orientation);}
  };
  scene.theme='Milky Way';scene.volumeKind='stellar-disk';scene.galaxyCount=1;fitVolume(scene);
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

export function createClusterVolume(scene,maps,points){
  const content=new THREE.Group();scene.root.add(content);const shell=shells(scene,content),rng=random(66327);
  const features=clusterFeatures(maps.cluster),maximum=features[0].value;
  const galaxies=features.map((feature,i)=>{
    const x=(feature.u-.5)*4.55,y=(.5-feature.v)*4.55,r=Math.hypot(x,y),luminosity=feature.value/maximum;
    const z=normal(rng,.78)*Math.sqrt(Math.max(.12,1-r*r/10));
    const radius=.025+.072*Math.sqrt(luminosity),spiral=i%7===0&&i>8;
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rng()*2.2,rng()*TAU,rng()*TAU));
    const axis=new THREE.Vector3(0,1,0).applyQuaternion(q).toArray();
    const galaxy={center:[x,y,z],radius,spiral,q,axis,luminosity,phase:rng()*TAU};
    if(i<26){
      galaxy.mesh=shell(galaxy.center,[radius*1.7,radius*(spiral?.48:1.3),radius*1.4],q);
    }
    return galaxy;
  });
  const cdf=[],total=galaxies.reduce((sum,g)=>{const next=sum+.18+g.luminosity;cdf.push(next);return next;},0);
  const sample=(rng,soft=false)=>{
    const select=rng()*total,index=cdf.findIndex(value=>value>=select),g=galaxies[index];
    let p;
    if(g.spiral&&rng()>.42){
      const u=rng()**.72,r=g.radius*(.2+2.7*u),a=(rng()<.5?0:Math.PI)+g.phase+4.1*Math.log(1+3*u)+normal(rng,.23)+.12*Math.sin(u*19+g.phase);
      p=new THREE.Vector3(r*Math.cos(a),normal(rng,g.radius*.12),r*Math.sin(a));
    }else p=new THREE.Vector3(normal(rng,g.radius*.65),normal(rng,g.radius*.50),normal(rng,g.radius*.65));
    p.applyQuaternion(g.q).add(new THREE.Vector3(...g.center));
    return {position:p.toArray(),center:g.center,axis:g.axis,rate:.055+g.luminosity*.035,
      size:soft?2+rng()*4:.4+rng()*.55,strength:soft?.085+g.luminosity*.10:.50+g.luminosity*.45};
  };
  points(scene,content,120000,11933,rng=>sample(rng));
  points(scene,content,16000,41833,rng=>sample(rng,true),{soft:1});
  const spin=new THREE.Quaternion(),axisY=new THREE.Vector3(0,1,0);
  scene.animate=t=>{
    content.rotation.set(.12+Math.sin(t*.095)*.18,t*.050,.06+Math.sin(t*.07)*.07);
    galaxies.forEach(g=>{if(g.mesh)g.mesh.quaternion.copy(g.q).multiply(spin.setFromAxisAngle(axisY,t*(.055+g.luminosity*.035)));});
  };
  scene.theme='Galaxy cluster';scene.volumeKind='galaxy-population';scene.galaxyCenters=galaxies.map(g=>g.center);scene.galaxyRadii=galaxies.map(g=>g.radius);
  fitVolume(scene);
}
