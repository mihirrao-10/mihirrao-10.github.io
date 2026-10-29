import * as THREE from 'three';
import { surfaceMaterial, pointMaterial, flareMaterial, random, gaussian } from './astronomy-materials.js';
import { createSpacetime } from './spacetime.js';
import { createNeutronStar } from './neutron-star.js';
import { createGalaxyVolume, createClusterVolume } from './stellar-volumes.js';

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
function points(scene,parent,count,seed,sample,{soft=0}={}){
  const rng=random(seed),data={position:[],starSize:[],strength:[],phase:[],rate:[],orbitCenter:[],orbitAxis:[]};
  for(let i=0;i<count;i++){
    const p=sample(rng,i);data.position.push(...p.position);data.starSize.push(p.size??.5+rng());
    data.strength.push(p.strength??.35+rng()*.4);data.phase.push(rng()*TAU);data.rate.push(p.rate??0);data.orbitCenter.push(...(p.center??[0,0,0]));data.orbitAxis.push(...(p.axis??[0,1,0]));
  }
  const geometry=new THREE.BufferGeometry();for(const[k,v]of Object.entries(data))geometry.setAttribute(k,new THREE.Float32BufferAttribute(v,['position','orbitCenter','orbitAxis'].includes(k)?3:1));
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
  const core=body(scene,parent,radius,3,{map,detail,opacity:1.18});
  if(!corona)return core;
  const rng=random(72517),loops=new THREE.Group();parent.add(loops);
  // Bundles of nested magnetic loops, rooted on the sphere rather than a hair halo.
  for(let region=0;region<6;region++){
    const a=region*2.399,b=.55+rng()*2.0;
    const n=new THREE.Vector3(Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a));
    const tangent=new THREE.Vector3(-Math.sin(a),0,Math.cos(a));
    const side=new THREE.Vector3().crossVectors(n,tangent).normalize();
    for(let strand=0;strand<5;strand++){
      const height=radius*(.10+region%3*.045+strand*.012),span=radius*(.10+strand*.009);
      const geometry=grid((u,v)=>{
        const arch=Math.sin(u*Math.PI),offset=(v-.5)*radius*.008;
        const angle=Math.cos(u*Math.PI)*span/radius;
        return n.clone().multiplyScalar(Math.cos(angle)).addScaledVector(tangent,Math.sin(angle)).multiplyScalar(radius+height*arch).addScaledVector(side,offset+(strand-2)*radius*.004).toArray();
      },192,6);
      const mesh=new THREE.Mesh(geometry,flareMaterial(scene,region*.9+strand*.16));
      mesh.userData.posterKind='flare';mesh.renderOrder=2;loops.add(mesh);
    }
  }
  points(scene,parent,20000,21937,rng=>{
    const r=radius*(1.015+.38*rng()**2),p=sphere(rng,r);
    return{position:p,size:2+rng()*7,strength:.047*(1-(r/radius-1)/.42),rate:.018};
  },{soft:1});
  body(scene,parent,radius*1.018,6,{detail:256,opacity:.20});
  const coronaShell=body(scene,parent,radius*1.36,7,{detail:320,opacity:1.25});coronaShell.renderOrder=1;
  core.userData.loops=loops;return core;
}
function blackHole(scene){createSpacetime(scene);}
function neutronStar(scene){createNeutronStar(scene,grid);}
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
function jupiter(scene,maps){
  const content=new THREE.Group();content.rotation.set(.10,0,-.10);scene.root.add(content);
  const planet=body(scene,content,1.90,2,{map:maps.jupiter,detail:768,opacity:1.2,scale:[1,.935,1]});
  const clouds=body(scene,content,1.914,9,{map:maps.jupiter,detail:384,opacity:.20,scale:[1,.935,1]});
  body(scene,content,1.94,6,{detail:256,opacity:.13,scale:[1,.935,1]});
  scene.animate=t=>{planet.rotation.y=-.58+t*.055;clouds.rotation.y=-.58+t*.059;content.rotation.z=-.10+Math.sin(t*.035)*.025;};
  scene.theme='Jupiter';scene.radius=2.08;
}
function star(scene,maps){
  const content=new THREE.Group();content.rotation.set(.15,0,-.12);scene.root.add(content);
  const sun=sunlight(scene,content,1.95,{map:maps.sun});
  scene.animate=t=>{sun.rotation.y=t*.04;sun.userData.loops.rotation.y=t*.04;content.rotation.z=-.12+Math.sin(t*.035)*.025;};
  scene.theme='Sun';scene.radius=2.87;
}
function galaxy(scene,maps){createGalaxyVolume(scene,maps,points);}
function cluster(scene,maps){createClusterVolume(scene,maps,points);}
export function createCosmos(name,{maps={}}={}){
  const factory={hero:earthMoon,education:jupiter,experience:star,publications:neutronStar,teaching:blackHole,projects:galaxy,notes:cluster}[name];
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
