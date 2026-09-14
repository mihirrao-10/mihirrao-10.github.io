import * as THREE from "three";
import { QUALITY } from "./preferences.js";

const VERTEX = `
attribute vec3 destination;
attribute vec3 scaffold;
attribute vec3 originColor;
attribute vec3 destinationColor;
attribute vec3 barycentric;
uniform float progress;
varying vec3 vColor;
varying vec3 vBarycentric;
varying vec3 vViewPosition;
void main() {
  // Two cubic segments meet at the connected scaffold with the same nonzero
  // tangent. The middle stays recognizable without introducing a pause.
  float t = progress;
  float local = t < 0.5 ? t*2.0 : (t-0.5)*2.0;
  float s = 1.0-local;
  vec3 tangent = (destination-position)*0.06;
  vec3 start = t < 0.5 ? position : scaffold;
  vec3 finish = t < 0.5 ? scaffold : destination;
  vec3 controlA = t < 0.5 ? mix(position,scaffold,0.55) : scaffold+tangent;
  vec3 controlB = t < 0.5 ? scaffold-tangent : mix(destination,scaffold,0.55);
  vec3 transformed = s*s*s*start + 3.0*s*s*local*controlA
    + 3.0*s*local*local*controlB + local*local*local*finish;
  vColor = mix(originColor, destinationColor, t);
  vBarycentric = barycentric;
  vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
  vViewPosition = viewPosition.xyz;
  gl_Position = projectionMatrix * viewPosition;
}`;
const FRAGMENT = `
uniform float progress;
uniform float opacity;
varying vec3 vColor;
varying vec3 vBarycentric;
varying vec3 vViewPosition;
void main() {
  vec3 normal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  // Screen-space derivatives already orient the visible face toward the viewer.
  // Corner correspondence may reverse winding; it must not reverse the lighting.
  if(normal.z < 0.0) normal = -normal;
  float key = max(dot(normal, normalize(vec3(-0.45,0.7,1.0))), 0.0);
  vec3 view = normalize(-vViewPosition);
  float rim = pow(1.0-max(dot(normal,view),0.0), 2.0);
  vec3 halfLight = normalize(normalize(vec3(-0.55,0.65,1.0)) + view);
  float specular = pow(max(dot(normal,halfLight),0.0), 44.0);
  float broadSpecular = pow(max(dot(normal,halfLight),0.0), 10.0);
  float shade = 0.54 + 0.58 * key + 0.3 * rim;
  vec3 face = vColor * shade + vec3(0.54,0.58,0.62)*specular
    + mix(vColor,vec3(0.9),0.25)*broadSpecular*0.12;
  vec3 width = fwidth(vBarycentric);
  vec3 line = smoothstep(vec3(0.0), width * 0.9, vBarycentric);
  float edge = (1.0 - min(min(line.x,line.y),line.z)) * 0.7;
  edge *= 1.0 - 0.18 * sin(progress * 3.14159265);
  float presence = smoothstep(0.003,0.06,max(max(vColor.r,vColor.g),vColor.b));
  vec3 edgeColor = min(vec3(1.0),vColor * 1.25 + vec3(0.085)) * (0.78+0.22*key);
  float ivory = smoothstep(0.35,0.65,vColor.b) * (1.0-smoothstep(0.18,0.38,abs(vColor.r-vColor.b)));
  edgeColor = mix(edgeColor, vColor * 0.44, ivory*0.75);
  float fade = 1.0 - 0.12 * pow(sin(progress * 3.14159265), 2.0);
  float alpha = mix(opacity, 0.9, max(edge,rim)) * fade;
  vec3 glow = mix(vColor,vec3(1.0),0.25) * (rim*0.22 + edge*0.08);
  gl_FragColor = vec4(mix(face, edgeColor, edge * presence) + glow, alpha);
  #include <colorspace_fragment>
}`;

// TubeGeometry normally redistributes samples by arc length. These paths are
// prepared polylines: preserving their parameterization keeps every original
// vertex, the reveal length and the animated marker in agreement.
export class PreparedPath extends THREE.Curve {
  constructor(points) { super(); this.points=points; this.count=points.length/3; }
  getPoint(t,target=new THREE.Vector3()) {
    const at=Math.min(this.count-2,Math.floor(t*(this.count-1))),f=t*(this.count-1)-at;
    return target.set(...[0,1,2].map(k=>this.points[at*3+k]*(1-f)+this.points[(at+1)*3+k]*f));
  }
  getPointAt(t,target) { return this.getPoint(t,target); }
  getTangentAt(t,target) { return this.getTangent(t,target); }
}

async function loadSculptures() {
  const compressed = typeof DecompressionStream === "function";
  const response = await fetch(new URL(compressed ? "./sculpture-data.bin.gz" : "./sculpture-data.bin", import.meta.url));
  if (!response.ok) throw new Error("The sculpture asset could not be loaded");
  const received = await response.arrayBuffer();
  const signature = new Uint8Array(received,0,Math.min(2,received.byteLength));
  // Static hosts may either serve .gz verbatim or transparently decode it.
  const data = compressed && signature[0]===31 && signature[1]===139
    ? await new Response(new Blob([received]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
    : received;
  const view = new DataView(data);
  const size = view.getUint32(0,true);
  const manifest = JSON.parse(new TextDecoder().decode(new Uint8Array(data,4,size)));
  if(manifest.version !== 1 || manifest.stride !== 21) throw new Error("Unsupported sculpture data");
  return {data,view,manifest,offset:4+size};
}

/** One context and one continuously transported mesh; only the active pair has GPU attributes. */
export async function createWorld({container, quality="medium", onFailure}) {
  const packed = await loadSculptures();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:"low-power"});
  } catch(error) { renderer?.dispose(); throw error; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x080808,0);
  const canvas=renderer.domElement;
  canvas.setAttribute("aria-hidden","true");
  container.append(canvas);
  let disposed=false, shaderFailed=false, frames=0, currentQuality=quality, pair="", currentName="hero", nextName="hero";
  renderer.debug.onShaderError=()=>{shaderFailed=true;};
  const contextLost=event=>{event.preventDefault();onFailure(new Error("WebGL context lost"));};
  canvas.addEventListener("webglcontextlost",contextLost);
  const scene=new THREE.Scene(), pivot=new THREE.Group();scene.add(pivot);
  const camera=new THREE.PerspectiveCamera(35,1,0.1,60);camera.position.set(0,0,12);
  const dragEuler=new THREE.Euler(0,0,0,"YXZ"),dragQuaternion=new THREE.Quaternion(),inverseView=new THREE.Quaternion();
  let userRotation=[0,0],dragging=false;
  const material=new THREE.ShaderMaterial({
    vertexShader:VERTEX,fragmentShader:FRAGMENT,side:THREE.DoubleSide,
    transparent:true,depthWrite:true,forceSinglePass:true,
    uniforms:{progress:{value:0},opacity:{value:0.9}},
  });
  const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);
  mesh.frustumCulled=false;pivot.add(mesh);
  const count=packed.manifest.count, bary=new Float32Array(count*9);
  for(let i=0;i<count;i++){bary[i*9]=1;bary[i*9+4]=1;bary[i*9+8]=1;}
  const decoded=new Map();
  let finiteActiveBuffers=true;
  function decode(name){
    if(decoded.has(name))return decoded.get(name);
    const modelIndex=packed.manifest.models.findIndex(m=>m.name===name);
    if(modelIndex<0)throw new Error(`Unknown sculpture ${name}`);
    const position=new Float32Array(count*9),center=new Float32Array(count*9),color=new Float32Array(count*9);
    const offset=packed.offset+modelIndex*count*21;
    for(let i=0;i<count;i++){
      const at=offset+i*21;
      for(let j=0;j<9;j++)position[i*9+j]=packed.view.getInt16(at+j*2,true)/4096;
      for(let k=0;k<3;k++){
        const middle=(position[i*9+k]+position[i*9+3+k]+position[i*9+6+k])/3;
        const shade=packed.view.getUint8(at+18+k)/255;
        for(let j=0;j<3;j++){center[i*9+j*3+k]=middle;color[i*9+j*3+k]=shade;}
      }
    }
    const result={position,center,color};decoded.set(name,result);return result;
  }
  const scaffold = decode("hero").position.slice();
  for(let i=0;i<scaffold.length;i+=3){scaffold[i]*=1.1;scaffold[i+1]*=.7;scaffold[i+2]*=.5;}
  const routes=[];
  for(const model of packed.manifest.models)for(const path of model.paths){
    const count=path.points.length/3;
    let line, unitsPerPoint=1;
    const ascent = path.kind === "ascent", context = path.kind === "context";
    const color = ascent ? 0xff404b : context ? 0xe9d6d5 : model.name === "surface" ? 0xb7fff0 : 0xffeedf;
    if(model.name==="surface" || ascent){
      const geometry=new THREE.TubeGeometry(new PreparedPath(path.points),(count-1)*(ascent?2:1),ascent?0.019:0.012,5,false);
      line=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false}));
      unitsPerPoint=30;
    }else{
      const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(path.points,3));
      line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,depthTest:true,transparent:true,depthWrite:false}));
    }
    line.renderOrder=2;line.visible=false;pivot.add(line);
    let marker;
    if(ascent){
      marker=new THREE.Mesh(new THREE.SphereGeometry(0.047,10,8),new THREE.MeshBasicMaterial({color:0xff6570,transparent:true,depthWrite:false}));
      marker.visible=false;marker.renderOrder=3;pivot.add(marker);
    }
    routes.push({line,marker,points:path.points,model:model.name,kind:path.kind,count,unitsPerPoint,shown:count});
  }
  function updatePair(a,b){
    const key=`${a}/${b}`;if(key===pair)return;
    const source=decode(a),destination=decode(b), geometry=new THREE.BufferGeometry();
    for(const [name,array] of Object.entries({position:source.position,destination:destination.position,scaffold,originColor:source.color,destinationColor:destination.color,barycentric:bary}))
      geometry.setAttribute(name,new THREE.BufferAttribute(array,3));
    finiteActiveBuffers = source.position.every(Number.isFinite) && destination.position.every(Number.isFinite);
    mesh.geometry.dispose();mesh.geometry=geometry;pair=key;
    for(const name of decoded.keys())if(name!==a&&name!==b)decoded.delete(name);
  }
  let width=1,height=1,lastDpr=1,orbitRadius=12;
  function resize(_width,_height,dpr=lastDpr){
    width=Math.max(1,container.clientWidth);height=Math.max(1,container.clientHeight);lastDpr=dpr;
    renderer.setPixelRatio(Math.min(dpr,QUALITY[currentQuality].dpr));renderer.setSize(width,height,false);
    canvas.style.filter=currentQuality==="low" ? "none" : "drop-shadow(0 0 7px rgb(214 226 255 / 0.2))";
    camera.aspect=width/height;
    // Fit both axes with enough depth clearance for the membrane and wing tips.
    // Diagonal views and user rotation need space on both axes.
    orbitRadius=Math.max(13.2,12.5/camera.aspect);
    camera.far=Math.max(60,orbitRadius+8);
    camera.updateProjectionMatrix();
  }
  updatePair("hero","hero");resize(0,0,devicePixelRatio);
  return {
    resize,
    setQuality(next){currentQuality=next;resize();},
    render({state,pose,time,project,interaction}){
      if(disposed)return;
      currentName=state.target||"hero";nextName=state.nextTarget||currentName;
      updatePair(currentName,nextName);
      material.uniforms.progress.value=currentName===nextName?0:state.blend;
      const alpha = name => name === "hero" || name === "notes" ? 0.56 : name === "phoenix" ? 0.64 : 0.61;
      material.uniforms.opacity.value=alpha(currentName)*(1-state.blend)+alpha(nextName)*state.blend;
      const elevation=pose?.[3]||0,azimuth=pose?.[4]||0;
      camera.position.set(orbitRadius*Math.cos(elevation)*Math.sin(azimuth),orbitRadius*Math.sin(elevation),orbitRadius*Math.cos(elevation)*Math.cos(azimuth));
      camera.lookAt(0,0,0);
      camera.rotateZ(pose?.[5]||0);
      userRotation=interaction?.rotation||[0,0];dragging=!!interaction?.dragging;
      dragEuler.set(userRotation[0],userRotation[1],0,"YXZ");
      dragQuaternion.setFromEuler(dragEuler);
      inverseView.copy(camera.quaternion).invert();
      pivot.quaternion.copy(camera.quaternion).multiply(dragQuaternion).multiply(inverseView);
      for(const route of routes){
        const smooth = value => {const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
        const presence=currentName===route.model ? 1-smooth(state.blend/.2) : nextName===route.model ? smooth((state.blend-.8)/.2) : 0;
        const ascent=route.kind==="ascent",context=route.kind==="context";
        const fraction=ascent ? Math.min(1,(time%10)/7) : route.model==="surface" ? project.path : 1;
        const cycleFade=ascent ? smooth((time%10)/.4)*(1-smooth((time%10)-9)) : 1;
        route.line.material.opacity=presence*cycleFade*(context?.38:1);
        route.line.visible=presence>0.001 &&
          (route.kind==="route" || route.kind===project.shortcut || route.kind==="boundary" || ascent || context);
        route.shown=Math.max(2,Math.floor(route.count*fraction));
        const shownSegments=ascent ? Math.floor((route.count-1)*2*fraction) : route.shown-1;
        route.line.geometry.setDrawRange(0,route.unitsPerPoint===1?route.shown:shownSegments*route.unitsPerPoint);
        if(route.marker){
          route.marker.visible=route.line.visible;
          route.marker.material.opacity=presence*cycleFade;
          const progress=(route.count-1)*fraction,at=Math.min(route.count-2,Math.floor(progress)),amount=progress-at;
          route.marker.position.set(...[0,1,2].map(k=>route.points[at*3+k]*(1-amount)+route.points[(at+1)*3+k]*amount));
        }
      }
      renderer.render(scene,camera);
      if(shaderFailed)throw new Error("Sculpture shader initialization failed");
      frames++;
    },
    snapshot:()=>({frames,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality:currentQuality,dpr:renderer.getPixelRatio(),geometries:renderer.info.memory.geometries,contextLost:renderer.getContext().isContextLost(),target:currentName,nextTarget:nextName,blend:material.uniforms.progress.value,opacity:material.uniforms.opacity.value,camera:camera.position.toArray(),rotation:[...userRotation],orientation:pivot.quaternion.toArray(),dragging,facets:count,decodedTargets:decoded.size,finiteActiveBuffers,visibleRoutes:routes.filter(r=>r.line.visible).map(r=>r.kind),activePathPoints:routes.filter(r=>r.line.visible).map(r=>r.shown),width,height}),
    dispose(){
      if(disposed)return;disposed=true;canvas.removeEventListener("webglcontextlost",contextLost);
      mesh.geometry.dispose();material.dispose();routes.forEach(({line,marker})=>{line.geometry.dispose();line.material.dispose();marker?.geometry.dispose();marker?.material.dispose();});
      decoded.clear();renderer.dispose();canvas.remove();
    },
  };
}
