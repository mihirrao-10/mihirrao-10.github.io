import * as THREE from 'three';
import { surfaceMaterial, ringMaterial, pointMaterial, fieldMaterial, flareMaterial, random, gaussian } from './astronomy-materials.js';
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
function annulus(scene,parent,inner,outer,{opacity=.9,columns=1024,rows=128,map=null}={}){
  const geometry=grid((u,v)=>{const a=u*TAU,r=inner+(outer-inner)*v;return[r*Math.cos(a),0,r*Math.sin(a)];},columns,rows);
  const mesh=new THREE.Mesh(geometry,ringMaterial(scene,inner,outer,opacity,map));mesh.renderOrder=1;
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
function sunlight(scene,parent,radius,{detail=640,corona=true,map=null}={}){
  const core=body(scene,parent,radius,3,{map,detail,opacity:1.04});
  if(!corona)return core;
  const rng=random(72517),loops=new THREE.Group();parent.add(loops);
  // Bundles of nested magnetic loops, rooted on the sphere rather than a hair halo.
  for(let region=0;region<9;region++){
    const a=region*2.399,b=.55+rng()*2.0;
    const n=new THREE.Vector3(Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a));
    const tangent=new THREE.Vector3(-Math.sin(a),0,Math.cos(a));
    const side=new THREE.Vector3().crossVectors(n,tangent).normalize();
    for(let strand=0;strand<7;strand++){
      const height=radius*(.10+region%3*.045+strand*.012),span=radius*(.10+strand*.009);
      const geometry=grid((u,v)=>{
        const arch=Math.sin(u*Math.PI),offset=(v-.5)*radius*.008;
        return n.clone().multiplyScalar(radius+height*arch).addScaledVector(tangent,Math.cos(u*Math.PI)*span).addScaledVector(side,offset+(strand-3)*radius*.004).toArray();
      },192,6);
      const mesh=new THREE.Mesh(geometry,flareMaterial(scene,region*.9+strand*.16));
      mesh.userData.posterKind='flare';mesh.renderOrder=2;loops.add(mesh);
    }
  }
  points(scene,parent,20000,21937,rng=>{
    const r=radius*(1.015+.50*rng()**2),p=sphere(rng,r);
    return{position:p,size:2+rng()*7,strength:.022*(1-(r/radius-1)/.55),rate:.018};
  },{soft:1});
  body(scene,parent,radius*1.018,6,{detail:256,opacity:.20});
  const coronaShell=body(scene,parent,radius*1.46,7,{detail:256,opacity:.75});coronaShell.renderOrder=1;
  core.userData.loops=loops;return core;
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
function saturn(scene,maps){
  const content=new THREE.Group();content.rotation.set(.37,.1,-.28);scene.root.add(content);
  const planet=body(scene,content,1.13,2,{map:maps.saturn,detail:640,opacity:1.12,scale:[1,.90,1]});
  annulus(scene,content,1.37,2.65,{columns:1536,rows:160,opacity:1,map:maps.rings});
  // Fine grains sit within the ring plane, outside the major optical gaps.
  points(scene,content,16000,73913,rng=>{
    let r=1.38+rng()*1.25;if(r>2.15&&r<2.21)r=2.22;
    const a=rng()*TAU;return{position:[r*Math.cos(a),gaussian(rng)*.004,r*Math.sin(a)],size:.36+rng()*.45,strength:.16+rng()*.3,rate:.075/r};
  });
  scene.animate=t=>{planet.rotation.y=t*.055;content.rotation.y=.1+Math.sin(t*.07)*.045;};
  scene.theme='Saturn';scene.radius=2.85;
}
function star(scene,maps){
  const content=new THREE.Group();content.rotation.set(.15,0,-.12);scene.root.add(content);
  const sun=sunlight(scene,content,1.75,{map:maps.sun});
  scene.animate=t=>{sun.rotation.y=t*.04;sun.userData.loops.rotation.y=t*.04;content.rotation.z=-.12+Math.sin(t*.035)*.025;};
  scene.theme='Sun';scene.radius=2.9;
}
function solarSystem(scene,maps){
  const content=new THREE.Group();content.rotation.set(.70,.12,-.22);scene.root.add(content);
  const sun=sunlight(scene,content,.42,{map:maps.sun,detail:256,corona:false});
  const radii=[.72,1.02,1.30,1.58,1.91,2.25,2.59,2.93],sizes=[.055,.085,.09,.065,.23,.20,.145,.14];
  const planets=radii.map((radius,i)=>{
    const orbitGroup=new THREE.Group();orbitGroup.rotation.z=(i%3-1)*.025;content.add(orbitGroup);orbit(scene,orbitGroup,radius);
    const group=new THREE.Group();orbitGroup.add(group);
    const planet=body(scene,group,sizes[i],i===2?0:i>3?2:4,{map:i===2?maps.earth:null,detail:i>3?160:128,opacity:1.2});
    if(i===5){group.rotation.z=.4;annulus(scene,group,.25,.41,{columns:384,rows:32,map:maps.rings});}
    return {group,planet,radius,phase:[.5,2.1,3.9,5.4,1.1,4.4,2.7,5.7][i],speed:.19/(radius**1.5)};
  });
  points(scene,content,16000,39173,rng=>{
    const a=rng()*TAU,r=1.70+rng()*.10;return{position:[r*Math.cos(a),gaussian(rng)*.015,r*Math.sin(a)],rate:.02,size:.3+rng()*.35,strength:.12+rng()*.22};
  });
  scene.animate=t=>{sun.rotation.y=t*.03;for(const p of planets){const a=p.phase+t*p.speed;p.group.position.set(p.radius*Math.cos(a),0,p.radius*Math.sin(a));p.planet.rotation.y=t*.05;}};
  scene.theme='Solar system';scene.radius=3.17;
}
function photoField(scene,maps,name){
  let map=maps[name];
  if(!map){
    const pixels=new Uint8Array(256*256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const r=Math.hypot(x-128,y-128)/128,a=Math.atan2(y-128,x-128);
      pixels[y*256+x]=Math.round(255*Math.exp(-r*4)*(.5+.5*Math.cos(a*2-r*13)));
    }
    map=new THREE.DataTexture(pixels,256,256,THREE.RedFormat);map.needsUpdate=true;
    map.userData={width:256,height:256,pixels};scene.textures.add(map);
  }
  const {width,height,pixels}=map.userData,aspect=height/width;
  const content=new THREE.Group();scene.root.add(content);
  // Depth is authored, but the stars, knots, dust lanes, and cores follow the photograph.
  const halfWidth=name==='galaxy'?2.85:2.30,halfHeight=halfWidth*aspect;
  const depthAt=(u,v)=>name==='galaxy'?.055*Math.sin(u*8+v*5):.13*Math.sin(u*14)*Math.cos(v*9);
  const geometry=grid((u,v)=>[(u-.5)*halfWidth*2,(.5-v)*halfHeight*2,depthAt(u,v)],384,256);
  const veil=new THREE.Mesh(geometry,fieldMaterial(scene,map,name==='galaxy'?.84:.9));
  veil.userData.posterKind='field';content.add(veil);
  const cdf=new Float64Array(pixels.length);let sum=0;
  for(let i=0;i<pixels.length;i++){sum+=(pixels[i]/255)**1.4;cdf[i]=sum;}
  const sample=(rng,soft)=>{
    const target=rng()*sum;let lo=0,hi=cdf.length-1;
    while(lo<hi){const mid=(lo+hi)>>>1;if(cdf[mid]<target)lo=mid+1;else hi=mid;}
    const u=(lo%width+rng())/width,v=(Math.floor(lo/width)+rng())/height;
    const light=pixels[lo]/255;
    return{position:[(u-.5)*halfWidth*2,(.5-v)*halfHeight*2,depthAt(u,v)+gaussian(rng)*(name==='galaxy'?.045:.10)],
      size:soft?2+rng()*5:.40+rng()*.65,strength:soft?.018+light*.025:.12+light*.27};
  };
  points(scene,content,name==='galaxy'?104000:90000,60827,rng=>sample(rng,false));
  points(scene,content,14000,58271,rng=>sample(rng,true),{soft:1});
  scene.animate=t=>{
    content.rotation.set(.10+Math.sin(t*.035)*.07,Math.sin(t*.045)*.10,(name==='galaxy'?-.12:.06)+t*(name==='galaxy'?.006:.002));
  };
  scene.theme=name==='galaxy'?'Spiral galaxy':'Galaxy cluster';scene.radius=Math.hypot(halfWidth,halfHeight)+.35;
}
function galaxy(scene,maps){photoField(scene,maps,'galaxy');}
function cluster(scene,maps){photoField(scene,maps,'cluster');}
export function createCosmos(name,{maps={}}={}){
  const factory={hero:earthMoon,education:saturn,experience:star,publications:solarSystem,teaching:blackHole,projects:galaxy,notes:cluster}[name];
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
