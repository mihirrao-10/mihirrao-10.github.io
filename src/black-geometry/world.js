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
  // One connected folded sheet organizes the material between different topologies.
  // All facets meet their true neighbors at the bridge; no independent-model fade.
  float unfold = smoothstep(0.0, 0.48, progress);
  float assemble = smoothstep(0.52, 1.0, progress);
  vec3 transformed = mix(mix(position, scaffold, unfold), destination, assemble);
  vColor = mix(mix(originColor, vec3(0.58,0.49,0.38), unfold), destinationColor, assemble);
  vBarycentric = barycentric;
  vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
  vViewPosition = viewPosition.xyz;
  gl_Position = projectionMatrix * viewPosition;
}`;
const FRAGMENT = `
uniform float progress;
varying vec3 vColor;
varying vec3 vBarycentric;
varying vec3 vViewPosition;
void main() {
  vec3 normal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  // Screen-space derivatives already orient the visible face toward the viewer.
  // Corner correspondence may reverse winding; it must not reverse the lighting.
  if(normal.z < 0.0) normal = -normal;
  float key = max(dot(normal, normalize(vec3(-0.45,0.7,1.0))), 0.0);
  float rim = pow(1.0-abs(normal.z), 2.0);
  float shade = 0.42 + 0.64 * key + 0.15 * rim;
  vec3 face = vColor * shade;
  vec3 width = fwidth(vBarycentric);
  vec3 line = smoothstep(vec3(0.0), width * 0.65, vBarycentric);
  float edge = (1.0 - min(min(line.x,line.y),line.z)) * 0.55;
  edge *= 1.0 - 0.7 * sin(progress * 3.14159265);
  float presence = smoothstep(0.003,0.06,max(max(vColor.r,vColor.g),vColor.b));
  vec3 edgeColor = min(vec3(1.0),vColor * 1.2 + vec3(0.055)) * (0.7+0.3*key);
  float ivory = smoothstep(0.35,0.65,vColor.b) * (1.0-smoothstep(0.18,0.38,abs(vColor.r-vColor.b)));
  edgeColor = mix(edgeColor, vColor * 0.34, ivory);
  gl_FragColor = vec4(mix(face, edgeColor, edge * presence),1.0);
  #include <colorspace_fragment>
}`;

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
  const material=new THREE.ShaderMaterial({
    vertexShader:VERTEX,fragmentShader:FRAGMENT,side:THREE.DoubleSide,
    uniforms:{progress:{value:0}},
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
    if(model.name==="surface"){
      class PreparedPath extends THREE.Curve {
        getPoint(t,target=new THREE.Vector3()){
          const at=Math.min(count-2,Math.floor(t*(count-1))),f=t*(count-1)-at;
          return target.set(...[0,1,2].map(k=>path.points[at*3+k]*(1-f)+path.points[(at+1)*3+k]*f));
        }
      }
      const geometry=new THREE.TubeGeometry(new PreparedPath(),count-1,0.012,5,false);
      line=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xffa846}));
      unitsPerPoint=30;
    }else{
      const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(path.points,3));
      line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffcf83,depthTest:true}));
    }
    line.visible=false;pivot.add(line);routes.push({line,model:model.name,kind:path.kind,count,unitsPerPoint,shown:count});
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
  let width=1,height=1,lastDpr=1;
  function resize(_width,_height,dpr=lastDpr){
    width=Math.max(1,container.clientWidth);height=Math.max(1,container.clientHeight);lastDpr=dpr;
    renderer.setPixelRatio(Math.min(dpr,QUALITY[currentQuality].dpr));renderer.setSize(width,height,false);
    camera.aspect=width/height;
    // Fit both axes with enough depth clearance for the membrane and wing tips.
    camera.position.z=Math.max(11.5,10.6/camera.aspect);
    camera.updateProjectionMatrix();
  }
  updatePair("hero","hero");resize(0,0,devicePixelRatio);
  return {
    resize,
    setQuality(next){currentQuality=next;resize();},
    render({state,pose,time,project}){
      if(disposed)return;
      currentName=state.target||"hero";nextName=state.nextTarget||currentName;
      updatePair(currentName,nextName);
      material.uniforms.progress.value=currentName===nextName?0:state.blend;
      pivot.rotation.set(pose?.[3]||0,pose?.[4]||0,pose?.[5]||0);
      for(const route of routes){
        route.line.visible=currentName===route.model && state.blend<0.03 &&
          (route.kind==="route" || route.kind===project.shortcut || route.kind==="boundary");
        route.shown=route.model==="surface"?Math.max(2,Math.floor(route.count*project.path)):route.count;
        route.line.geometry.setDrawRange(0,route.unitsPerPoint===1?route.shown:(route.shown-1)*route.unitsPerPoint);
      }
      renderer.render(scene,camera);
      if(shaderFailed)throw new Error("Sculpture shader initialization failed");
      frames++;
    },
    snapshot:()=>({frames,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality:currentQuality,dpr:renderer.getPixelRatio(),geometries:renderer.info.memory.geometries,contextLost:renderer.getContext().isContextLost(),target:currentName,nextTarget:nextName,blend:material.uniforms.progress.value,facets:count,decodedTargets:decoded.size,finiteActiveBuffers,visibleRoutes:routes.filter(r=>r.line.visible).map(r=>r.kind),activePathPoints:routes.filter(r=>r.line.visible).map(r=>r.shown),width,height}),
    dispose(){
      if(disposed)return;disposed=true;canvas.removeEventListener("webglcontextlost",contextLost);
      mesh.geometry.dispose();material.dispose();routes.forEach(({line})=>{line.geometry.dispose();line.material.dispose();});
      decoded.clear();renderer.dispose();canvas.remove();
    },
  };
}
