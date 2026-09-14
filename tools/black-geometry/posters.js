import * as THREE from "three";

const n = value => value.toFixed(1);
const project = ([x,y,z]) => [400+x*900/(12-z),300-y*900/(12-z),z];
const toHex = values => new THREE.Color().setRGB(...values,THREE.LinearSRGBColorSpace).getHexString(THREE.SRGBColorSpace);

/** Static views of the same authored meshes, including their material regions and depth. */
export function sculpturePoster(model,{shortcut="open"}={}) {
  const faces=model.faces.map(face=>{
    const p=face.p, a=new THREE.Vector3(p[3]-p[0],p[4]-p[1],p[5]-p[2]), b=new THREE.Vector3(p[6]-p[0],p[7]-p[1],p[8]-p[2]);
    const normal=a.cross(b).normalize();if(normal.z<0)normal.negate();
    const key=Math.max(0,normal.dot(new THREE.Vector3(-0.45,0.7,1).normalize()));
    const shade=.42+.64*key+.15*(1-Math.abs(normal.z))**2;
    const points=[0,3,6].map(i=>project(p.slice(i,i+3)));
    const fill=toHex(face.c.map(c=>Math.min(1,c*shade)));
    const edge=toHex(face.c.map(c=>Math.min(1,(c*1.2+.055)*(.7+.3*key))));
    const presence=Math.max(...face.c)>.01?.27:.03;
    return {depth:(p[2]+p[5]+p[8])/3, markup:`<path d="M${points.map(p=>`${n(p[0])} ${n(p[1])}`).join("L")}Z" fill="#${fill}" stroke="#${edge}" stroke-opacity="${presence}" stroke-width=".45" stroke-linejoin="round"/>`};
  });
  let body=faces.sort((a,b)=>a.depth-b.depth).map(f=>f.markup).join("");
  for(const path of model.paths){
    if(model.name==="congestion"&&path.kind!==shortcut&&path.kind!=="boundary")continue;
    const points=[];for(let i=0;i<path.points.length;i+=3)points.push(project(path.points.slice(i,i+3)));
    body+=`<path d="M${points.map(p=>`${n(p[0])} ${n(p[1])}`).join("L")}" fill="none" stroke="#ffa846" stroke-width="1.8"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" fill="none" aria-hidden="true">${body}</svg>\n`;
}

export function posterOutputs(models) {
  const files=new Map(models.map(model=>[`sculpture-${model.name}.svg`,sculpturePoster(model)]));
  files.set("sculpture-congestion-closed.svg",sculpturePoster(models.find(m=>m.name==="congestion"),{shortcut:"closed"}));
  return files;
}
