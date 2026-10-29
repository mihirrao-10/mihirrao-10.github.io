import * as THREE from 'three';
import { random, gaussian, volumeMaterial } from './astronomy-materials.js';

const TAU=2*Math.PI;
const limit=(value,low,high)=>Math.max(low,Math.min(high,value));
const normal=(rng,scale=1)=>limit(gaussian(rng),-2.8,2.8)*scale;

function imageSampler(map){
  if(!map)throw new Error('Stellar volumes require their prepared reference map');
  const {pixels,width,height}=map.userData,cdf=new Float64Array(pixels.length);
  let total=0;for(let i=0;i<pixels.length;i++){total+=(pixels[i]/255)**1.35;cdf[i]=total;}
  return rng=>{
    let lo=0,hi=cdf.length-1;const target=rng()*total;
    while(lo<hi){const mid=(lo+hi)>>>1;if(cdf[mid]<target)lo=mid+1;else hi=mid;}
    return {u:(lo%width+rng())/width,v:(Math.floor(lo/width)+rng())/height,light:pixels[lo]/255};
  };
}

function shells(scene,parent){
  const geometry=new THREE.SphereGeometry(1,128,64),material=volumeMaterial(scene,.12);
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

export function createGalaxyVolume(scene,maps,points){
  const content=new THREE.Group();scene.root.add(content);
  const sample=imageSampler(maps.galaxy),shell=shells(scene,content);
  const disk=(rng,soft=false)=>{
    const {u,v,light}=sample(rng),x=(u-.415)*5.25,z=(v-.48)*3.65,r=Math.hypot(x,z);
    const companion=u>.69&&v<.47,thickness=companion?.18:(soft?.10:.024)+.15*Math.exp(-r*r/.40);
    const center=companion?[2.05,.24,-.72]:[0,0,0];
    return {position:[x,normal(rng,thickness)+(companion?.24:0),z],
      center,axis:[0,1,0],rate:companion?.022:.030/(.65+r)**.65,
      size:soft?3+rng()*7:.45+rng()*.9,strength:soft?.035+light*.07:.18+light*.42};
  };
  points(scene,content,190000,60827,rng=>disk(rng));
  points(scene,content,18000,58271,rng=>disk(rng,true),{soft:1});
  points(scene,content,18000,91283,rng=>{
    const companion=rng()<.16,c=companion?[2.05,.24,-.72]:[0,0,0],r=companion?.115:.19;
    return {position:[c[0]+normal(rng,r),c[1]+normal(rng,r*.8),c[2]+normal(rng,r)],center:c,
      size:.6+rng()*.9,strength:.16+rng()*.3,rate:.045};
  });
  for(const radius of [.18,.30,.46,.68])shell([0,0,0],[radius,radius*.75,radius]);
  for(const radius of [.15,.28])shell([2.05,.24,-.72],[radius,radius*.85,radius]);
  // The stellar disk has real thickness; its round bulges remain visible edge-on.
  scene.animate=t=>{content.rotation.set(.78+Math.sin(t*.085)*.24,t*.030,-.22+Math.sin(t*.06)*.07);};
  scene.theme='Spiral galaxy';scene.volumeKind='stellar-disk';fitVolume(scene);
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
      size:soft?1.2+rng()*2.8:.28+rng()*.40,strength:soft?.022+g.luminosity*.035:.20+g.luminosity*.38};
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
