import * as THREE from "three";
import { SCULPTURE_STYLE } from "../../src/black-geometry/world.js";

const n = value => value.toFixed(1);

const toHex = values => new THREE.Color().setRGB(...values,THREE.LinearSRGBColorSpace).getHexString(THREE.SRGBColorSpace);

/** Static views of the same authored meshes, including their material regions and depth. */
export function sculpturePoster(model,{shortcut="open"}={}) {
  const view = ([x,y,z]) => [x,y*Math.cos(.2)-z*Math.sin(.2),y*Math.sin(.2)+z*Math.cos(.2)];
  const rawProject = ([x,y,z]) => [x/(12-z),-y/(12-z),z];
  const projected = model.faces.flatMap(face=>[0,3,6].map(i=>rawProject(view(face.p.slice(i,i+3)))));
  const lower=[Infinity,Infinity],upper=[-Infinity,-Infinity];
  for(const p of projected)for(let k=0;k<2;k++){lower[k]=Math.min(lower[k],p[k]);upper[k]=Math.max(upper[k],p[k]);}
  const scale=SCULPTURE_STYLE.scale*Math.min(720/(upper[0]-lower[0]),528/(upper[1]-lower[1]));
  const middle=lower.map((v,k)=>(v+upper[k])/2);
  const project=point=>{const p=rawProject(point);return [400+(p[0]-middle[0])*scale,300+(p[1]-middle[1])*scale,p[2]];};
  const faces=model.faces.map((face,index)=>{
    const p=[0,3,6].flatMap(i=>view(face.p.slice(i,i+3))), a=new THREE.Vector3(p[3]-p[0],p[4]-p[1],p[5]-p[2]), b=new THREE.Vector3(p[6]-p[0],p[7]-p[1],p[8]-p[2]);
    const normal=a.cross(b).normalize();if(normal.z<0)normal.negate();
    const key=Math.max(0,normal.dot(new THREE.Vector3(-0.45,0.7,1).normalize()));
    const rim=(1-Math.abs(normal.z))**2;
    const fillLight=Math.max(0,normal.dot(new THREE.Vector3(.7,-.25,.65).normalize()));
    const facetLight=.76+.28*((Math.imul(index+1,2654435761)>>>0)/4294967296);
    const shade=(.38+.76*key+.12*fillLight)*facetLight;
    const specular=Math.max(0,normal.dot(new THREE.Vector3(-.25,.32,1).normalize()))**110;
    const points=[0,3,6].map(i=>project(p.slice(i,i+3)));
    const fill=toHex(face.c.map(c=>Math.min(1,c*shade+.30*specular+c*rim*.30)));
    const edge=toHex(face.c.map((c,k)=>Math.min(1,c*1.85+[.025,.035,.05][k])));
    const presence=Math.max(...face.c)>.01?.52:.08;
    return {depth:(p[2]+p[5]+p[8])/3, markup:`<path d="M${points.map(p=>`${n(p[0])} ${n(p[1])}`).join("L")}Z" fill="#${fill}" stroke="#${edge}" stroke-opacity="${presence}" stroke-width=".42" stroke-linejoin="round"/>`};
  });
  let body=`<g id="surface">${faces.sort((a,b)=>a.depth-b.depth).map(f=>f.markup).join("")}</g>`;
  for(const path of model.paths){
    if(model.name==="congestion"&&path.kind!==shortcut&&path.kind!=="boundary")continue;
    const points=[];for(let i=0;i<path.points.length;i+=3)points.push(project(view(path.points.slice(i,i+3))));
    const color=path.kind==="ascent"?"#ff404b":path.kind==="context"?"#e9d6d5":model.name==="surface"?"#b7fff0":"#ffeedf";
    body+=`<path d="M${points.map(p=>`${n(p[0])} ${n(p[1])}`).join("L")}" fill="none" stroke="${color}" stroke-opacity="${path.kind==="context"?.38:1}" stroke-width="${path.kind==="ascent"?2.5:1.8}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" fill="none" aria-hidden="true"><defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter></defs><use href="#surface" filter="url(#glow)" opacity=".42"/><g opacity="${SCULPTURE_STYLE.opacity}">${body}</g></svg>\n`;
}

export function posterOutputs(models) {
  const files=new Map(models.map(model=>[`sculpture-${model.name}.svg`,sculpturePoster(model)]));
  files.set("sculpture-congestion-closed.svg",sculpturePoster(models.find(m=>m.name==="congestion"),{shortcut:"closed"}));
  return files;
}
