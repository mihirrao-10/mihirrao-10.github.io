import * as THREE from 'three';
import { surfaceMaterial, ringMaterial, pointMaterial, random, gaussian } from './astronomy-materials.js';
import { createBlackHole } from './black-hole.js';

export const COSMIC_TARGETS=Object.freeze(['hero','education','experience','publications','teaching','projects','notes']);
const TAU=2*Math.PI;
function grid(point,columns,rows){
  const positions=[],uv=[],indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
    positions.push(...point(i/columns,j/rows));uv.push(i/columns,j/rows);
    if(i&&j){const d=j*(columns+1)+i,c=d-1,b=d-columns-1,a=b-1;indices.push(a,c,d,a,d,b);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function body(scene,parent,radius,kind=4,{map,detail=384,opacity=1,scale=[1,1,1]}={}){
  const material=surfaceMaterial(scene,kind,map,{opacity,detail:Math.min(detail,320),depthWrite:kind<5});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,detail,Math.round(detail*.5)),material);
  mesh.scale.fromArray(scale);mesh.userData.posterKind='body';mesh.userData.surfaceKind=kind;parent.add(mesh);return mesh;
}
function annulus(scene,parent,inner,outer,{opacity=.9,columns=1024,rows=128}={}){
  const geometry=grid((u,v)=>{const a=u*TAU,r=inner+(outer-inner)*v;return[r*Math.cos(a),0,r*Math.sin(a)];},columns,rows);
  const mesh=new THREE.Mesh(geometry,ringMaterial(scene,inner,outer,opacity));mesh.renderOrder=1;
  mesh.userData.posterKind='ring';mesh.userData.innerRadius=inner;mesh.userData.outerRadius=outer;parent.add(mesh);return mesh;
}
function points(scene,parent,count,seed,sample,{soft=0}={}){
  const rng=random(seed),data={position:[],starSize:[],strength:[],phase:[],rate:[]};
  for(let i=0;i<count;i++){
    const p=sample(rng,i);data.position.push(...p.position);data.starSize.push(p.size??.5+rng());
    data.strength.push(p.strength??.35+rng()*.4);data.phase.push(rng()*TAU);data.rate.push(p.rate??0);
  }
  const geometry=new THREE.BufferGeometry();for(const[k,v]of Object.entries(data))geometry.setAttribute(k,new THREE.Float32BufferAttribute(v,k==='position'?3:1));
  const mesh=new THREE.Points(geometry,pointMaterial(scene,soft));mesh.frustumCulled=false;mesh.renderOrder=2;
  mesh.userData.posterSoft=soft;parent.add(mesh);return mesh;
}
function sphere(rng,radius,flatten=1){const a=rng()*TAU,z=rng()*2-1,s=Math.sqrt(1-z*z);return[radius*s*Math.cos(a),radius*z*flatten,radius*s*Math.sin(a)];}
function line(scene,parent,positions,opacity=.35){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const material=new THREE.LineBasicMaterial({color:0x242321,transparent:true,opacity,depthWrite:false,depthTest:true});
  material.userData.baseOpacity=opacity;scene.materials.add(material);
  const object=new THREE.LineSegments(geometry,material);object.renderOrder=2;parent.add(object);return object;
}
function orbit(scene,parent,radius,inclination=0){
  const p=[];for(let i=0;i<1536;i++){const a=i/1536*TAU,b=(i+1)/1536*TAU;p.push(radius*Math.cos(a),0,radius*Math.sin(a),radius*Math.cos(b),0,radius*Math.sin(b));}
  const object=line(scene,parent,p,.3);object.rotation.x=inclination;return object;
}
function sunlight(scene,parent,radius,{detail=512,corona=true}={}){
  const core=body(scene,parent,radius,3,{detail,opacity:.95});
  if(!corona)return core;
  const rng=random(72517),filaments=[];
  // Hundreds of individually curved magnetic arches and hairline coronal threads.
  for(let i=0;i<48;i++){
    const a=rng()*TAU,b=Math.acos(2*rng()-1),height=radius*(.04+rng()*.30),width=.04+rng()*.15;
    const n=new THREE.Vector3(Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a));
    const t=new THREE.Vector3(-Math.sin(a),0,Math.cos(a));
    const point=u=>n.clone().multiplyScalar(radius+height*Math.sin(u*Math.PI)).addScaledVector(t,Math.cos(u*Math.PI)*width);
    for(let j=0;j<80;j++){const p=point(j/80),q=point((j+1)/80);filaments.push(...p.toArray(),...q.toArray());}
  }
  line(scene,parent,filaments,.19);
  points(scene,parent,16000,99713,rng=>{
    const r=radius*(1.02+.68*rng()**2);return{position:sphere(rng,r),size:.45+rng()*.8,strength:.12+rng()*.25};
  });
  points(scene,parent,18000,21937,rng=>{
    const r=radius*(1.02+.58*rng()**2),p=sphere(rng,r);
    const ray=.5+.5*Math.sin(Math.atan2(p[2],p[0])*21+Math.sin(p[1]*9)*3);
    return{position:p,size:3+rng()*8,strength:(.025+.055*ray)*(1-(r/radius-1)/.65)};
  },{soft:1});
  body(scene,parent,radius*1.025,6,{detail:192,opacity:.17});
  return core;
}
function blackHole(scene){
  const content=new THREE.Group();content.rotation.z=-.06;scene.root.add(content);
  const mesh=createBlackHole(scene,content);
  scene.animate=t=>{content.rotation.y=Math.sin(t*.025)*.055;mesh.rotation.z=Math.sin(t*.017)*.015;};
  scene.theme='Black hole';scene.radius=3.4;
}
function earthMoon(scene,maps){
  const content=new THREE.Group();content.rotation.z=-.08;scene.root.add(content);
  const earth=new THREE.Group();earth.position.x=-.35;content.add(earth);
  const globe=body(scene,earth,1.48,0,{map:maps.earth,detail:640});globe.rotation.y=.2;
  const clouds=body(scene,earth,1.498,5,{detail:384,opacity:.17});clouds.renderOrder=1;
  const atmosphere=body(scene,earth,1.518,6,{detail:256,opacity:.16});atmosphere.renderOrder=1;
  const moon=body(scene,content,.405,1,{map:maps.moon,detail:384,opacity:1.1});
  const track=orbit(scene,content,2.3,.18);track.material.opacity=.12;track.material.userData.baseOpacity=.12;
  scene.animate=t=>{
    globe.rotation.y=.2+t*.025;clouds.rotation.y=t*.032;
    const a=.48+t*.055;moon.position.set(2.3*Math.cos(a),.25*Math.sin(a),2.3*Math.sin(a));moon.rotation.y=-a;
  };
  scene.theme='Earth and Moon';scene.radius=2.9;
}
function saturn(scene){
  const content=new THREE.Group();content.rotation.set(.61,.1,-.40);scene.root.add(content);
  const planet=body(scene,content,1.13,2,{detail:640,opacity:1.12,scale:[1,.89,1]});
  annulus(scene,content,1.37,2.65,{columns:1536,rows:160,opacity:1});
  // Fine grains sit within the ring plane, outside the major optical gaps.
  points(scene,content,16000,73913,rng=>{
    let r=1.38+rng()*1.25;if(r>2.15&&r<2.21)r=2.22;
    const a=rng()*TAU;return{position:[r*Math.cos(a),gaussian(rng)*.004,r*Math.sin(a)],size:.36+rng()*.45,strength:.16+rng()*.3,rate:.014/r};
  });
  const titan=body(scene,content,.15,4,{detail:128,opacity:1.1});
  scene.animate=t=>{planet.rotation.y=t*.025;const a=2.3+t*.04;titan.position.set(2.91*Math.cos(a),.06,2.91*Math.sin(a));};
  scene.theme='Saturn';scene.radius=3.12;
}
function star(scene){
  const content=new THREE.Group();content.rotation.set(.15,0,-.12);scene.root.add(content);
  const sun=sunlight(scene,content,1.65);
  scene.animate=t=>{sun.rotation.y=t*.018;content.rotation.z=-.12+Math.sin(t*.024)*.025;};
  scene.theme='Sun';scene.radius=3.02;
}
function solarSystem(scene,maps){
  const content=new THREE.Group();content.rotation.set(.70,.12,-.22);scene.root.add(content);
  const sun=sunlight(scene,content,.42,{detail:256,corona:false});
  const radii=[.72,1.02,1.30,1.58,1.91,2.25,2.59,2.93],sizes=[.055,.085,.09,.065,.23,.20,.145,.14];
  const planets=radii.map((radius,i)=>{
    const orbitGroup=new THREE.Group();orbitGroup.rotation.z=(i%3-1)*.025;content.add(orbitGroup);orbit(scene,orbitGroup,radius);
    const group=new THREE.Group();orbitGroup.add(group);
    const planet=body(scene,group,sizes[i],i===2?0:i>3?2:4,{map:i===2?maps.earth:null,detail:i>3?160:128,opacity:1.2});
    if(i===5){group.rotation.z=.4;annulus(scene,group,.25,.41,{columns:384,rows:32});}
    return {group,planet,radius,phase:[.5,2.1,3.9,5.4,1.1,4.4,2.7,5.7][i],speed:.10/(radius**1.5)};
  });
  points(scene,content,16000,39173,rng=>{
    const a=rng()*TAU,r=1.70+rng()*.10;return{position:[r*Math.cos(a),gaussian(rng)*.015,r*Math.sin(a)],rate:.02,size:.3+rng()*.35,strength:.12+rng()*.22};
  });
  scene.animate=t=>{sun.rotation.y=t*.03;for(const p of planets){const a=p.phase+t*p.speed;p.group.position.set(p.radius*Math.cos(a),0,p.radius*Math.sin(a));p.planet.rotation.y=t*.05;}};
  scene.theme='Solar system';scene.radius=3.17;
}
function galaxy(scene){
  const content=new THREE.Group();content.rotation.set(.55,.1,-.30);scene.root.add(content);
  const sampleArm=(rng,i,soft=false)=>{
    const u=rng()**.88,r=.20+2.88*u,arm=i%4;
    const a=arm*TAU/4+3.1*Math.log(1+4*u)+gaussian(rng)*(.14+.14*u)+.10*Math.sin(u*26+arm);
    return{position:[r*Math.cos(a),gaussian(rng)*(.035+.11*(1-u)),r*Math.sin(a)],size:soft?3+rng()*8:.4+rng()*1.5,strength:soft?.095:.22+rng()*.6};
  };
  points(scene,content,94000,60827,(rng,i)=>sampleArm(rng,i));
  points(scene,content,9000,58271,(rng,i)=>sampleArm(rng,i,true),{soft:1});
  points(scene,content,24000,91283,rng=>{
    const r=Math.min(1.32,-Math.log(Math.max(1e-9,rng()))*.27);
    return{position:sphere(rng,r,.48),size:.5+rng()*1.35,strength:.22+rng()*.4};
  });
  points(scene,content,14000,52931,rng=>{const a=rng()*TAU,r=3.1*Math.sqrt(rng());return{position:[r*Math.cos(a),gaussian(rng)*.08,r*Math.sin(a)],size:.4+rng(),strength:.08+rng()*.18};});
  for(let arm=0;arm<4;arm++){
    const geometry=grid((u,v)=>{
      const r=.2+2.9*u,a=arm*TAU/4+3.1*Math.log(1+4*u)+(v-.5)*(.3+.35*u);
      return[r*Math.cos(a),.03*Math.sin(a*3),r*Math.sin(a)];
    },512,24);
    const material=surfaceMaterial(scene,4,null,{opacity:.065,detail:256,depthWrite:false});material.side=THREE.DoubleSide;
    const veil=new THREE.Mesh(geometry,material);veil.userData.posterKind='body';veil.userData.surfaceKind=4;content.add(veil);
  }
  scene.animate=t=>{content.rotation.y=t*.008;};
  scene.theme='Spiral galaxy';scene.radius=3.28;
}
function cluster(scene){
  const content=new THREE.Group();content.rotation.z=.12;scene.root.add(content);
  const clusterPoint=rng=>{
    let r=4;while(r>3){const u=Math.max(.0001,rng());r=.56/Math.sqrt(u**(-2/3)-1);}
    return sphere(rng,r,.88);
  };
  points(scene,content,78000,66327,rng=>({position:clusterPoint(rng),size:.4+rng()*1.45,strength:.18+rng()*.5}));
  points(scene,content,3600,11933,rng=>({position:clusterPoint(rng),size:4+rng()*10,strength:.025}),{soft:1});
  points(scene,content,140,41833,rng=>({position:sphere(rng,.6+rng()*2.35,.9),size:3+rng()*4,strength:.8+rng()*.2}));
  const rng=random(90317),resolved=[];
  for(let i=0;i<8;i++){const s=body(scene,content,.018+rng()*.012,3,{detail:48,opacity:1.1});s.position.fromArray(sphere(rng,1.5+rng()*.7));resolved.push(s);}
  scene.animate=t=>{content.rotation.y=t*.008;resolved.forEach((s,i)=>s.rotation.y=t*(.02+i*.002));};
  scene.theme='Globular cluster';scene.radius=3.16;
}
export function createCosmos(name,{maps={}}={}){
  const factory={hero:blackHole,education:earthMoon,experience:saturn,publications:star,teaching:solarSystem,projects:galaxy,notes:cluster}[name];
  if(!factory)throw new Error(`Unknown cosmic scene: ${name}`);
  const scene={root:new THREE.Group(),materials:new Set(),textures:new Set(),uniforms:{time:{value:0},presence:{value:1},pixelRatio:{value:1}}};
  factory(scene,maps);scene.bounds=[{center:[0,0,0],radius:scene.radius}];scene.root.name=`cosmos-${name}`;
  scene.update=(time=0,presence=1,pixelRatio=1)=>{
    scene.uniforms.time.value=time;scene.uniforms.presence.value=presence;scene.uniforms.pixelRatio.value=pixelRatio;
    for(const material of scene.materials){
      if(material.userData.bodyDepth)material.depthWrite=presence>.999;
      if(material.userData.baseOpacity!==undefined)material.opacity=presence*material.userData.baseOpacity;
    }
    scene.animate(time);scene.root.updateMatrixWorld(true);
  };
  scene.dispose=()=>{const geometries=new Set();scene.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());scene.materials.forEach(m=>m.dispose());scene.textures.forEach(t=>t.dispose());};
  scene.update();return scene;
}
