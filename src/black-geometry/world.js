import * as THREE from "three";
import { QUALITY } from "./preferences.js";
import { cameraPose } from "./scene-state.js";

export const SCULPTURE_PALETTES = Object.freeze({
  hero: ["#5146c8", "#a08af5", "#df82a4", "#ffe2bd"],
  phoenix: ["#580000", "#800000", "#767676", "#D6D6CE"],
  dragon: ["#063766", "#087fcc", "#f4b411", "#fff176"],
  membrane: ["#066ae2", "#31d3ef", "#ff6c18", "#ffcf4f"],
  resolution: ["#202945", "#476cba", "#e53e51", "#ff6a6b"],
  surface: ["#093fbc", "#126dff", "#08c7ba", "#69ffe1"],
  congestion: ["#ae1425", "#f13b30", "#ff6729", "#ffb24b"],
  notes: ["#e8e2f7", "#ddeef9", "#ffe4d4", "#fafaff"],
});
export const SCULPTURE_STYLE = Object.freeze({ scale: .84, opacity: .88 });
export const sculptureOpacity = name => name === 'notes' ? .52 : SCULPTURE_STYLE.opacity;

/** Smooth coincident corners without rounding genuine creases or changing data positions. */
export function smoothSurfaceNormals(position, creaseCosine = 0.65) {
  const faces = new Float32Array(position.length / 3), buckets = new Map();
  const normal = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < position.length; i += 9) {
    a.fromArray(position,i);b.fromArray(position,i+3);c.fromArray(position,i+6);
    normal.crossVectors(b.sub(a),c.sub(a)).normalize();
    faces.set(normal.toArray(),i/3);
    for (let j = 0; j < 9; j += 3) {
      const at = i+j, key = `${Math.round(position[at]*4096)},${Math.round(position[at+1]*4096)},${Math.round(position[at+2]*4096)}`;
      if (!buckets.has(key)) buckets.set(key,[]);
      buckets.get(key).push(at);
    }
  }
  const result = new Float32Array(position.length);
  for (const corners of buckets.values()) {
    for (const at of corners) {
      const face = Math.floor(at/9)*3;
      a.fromArray(faces,face);normal.set(0,0,0);
      for (const other of corners) {
        b.fromArray(faces,Math.floor(other/9)*3);
        const dot = a.dot(b);
        // Offline corner alignment can reverse winding. Orient neighbors
        // consistently before averaging their normals, then face the camera.
        if (Math.abs(dot) >= creaseCosine) normal.addScaledVector(b,dot<0?-1:1);
      }
      if (normal.lengthSq()<1e-16) normal.copy(a.lengthSq()?a:c.set(0,0,1));
      normal.normalize();result.set(normal.toArray(),at);
    }
  }
  return result;
}

/** Small enclosing spheres give conservative perspective fits at any user rotation. */
export function surfaceFitBounds(position, extraPositions = []) {
  const cells = new Map();
  for (const points of [position,...extraPositions]) for (let i=0;i<points.length;i+=3) {
    const p=[points[i],points[i+1],points[i+2]], key=p.map(v=>Math.floor(v/.35)).join(',');
    let cell=cells.get(key);
    if(!cell){cell={min:[...p],max:[...p]};cells.set(key,cell);}
    for(let k=0;k<3;k++){cell.min[k]=Math.min(cell.min[k],p[k]);cell.max[k]=Math.max(cell.max[k],p[k]);}
  }
  return [...cells.values()].map(({min,max})=>({
    center:min.map((v,k)=>(v+max[k])/2),
    radius:Math.hypot(...min.map((v,k)=>(max[k]-v)/2))+.025,
  }));
}
export function fitSurfaceDistance(bounds, cameraSpaceRotation, aspect, margin = 1.035) {
  const vertical=Math.tan(35*Math.PI/360), horizontal=vertical*Math.max(.05,aspect);
  const point=new THREE.Vector3();let distance=0;
  for(const sphere of bounds){
    point.fromArray(sphere.center).applyQuaternion(cameraSpaceRotation);
    distance=Math.max(distance,
      point.z+Math.abs(point.x)/horizontal+sphere.radius*Math.hypot(1,1/horizontal),
      point.z+Math.abs(point.y)/vertical+sphere.radius*Math.hypot(1,1/vertical));
  }
  return Math.max(4,distance*margin);
}

const VERTEX = `
attribute vec3 surfaceColor;
attribute vec3 barycentric;
attribute float facetSeed;
varying vec3 vColor;
varying vec3 vBarycentric;
varying float vFacetSeed;
varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vPosition;
void main(){
  vColor=surfaceColor;vBarycentric=barycentric;vPosition=position;vFacetSeed=facetSeed;
  vNormal=normalize(normalMatrix*normal);
  vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
  vViewPosition=viewPosition.xyz;gl_Position=projectionMatrix*viewPosition;
}`;
// Both passes use exactly the same endpoint mask, including during reversals.
const DISSOLVE = `
  float noise=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
  if(endpoint<.5){if(noise<progress)discard;}else{if(noise>=progress)discard;}
`;
const DEPTH_FRAGMENT = `
uniform float progress;
uniform float endpoint;
void main(){${DISSOLVE}gl_FragColor=vec4(0.0);}
`;
const FRAGMENT = `
uniform float progress;
uniform float endpoint;
uniform float time;
uniform float opacity;
uniform float stardust;
uniform vec3 palette0;
uniform vec3 palette1;
uniform vec3 palette2;
uniform vec3 palette3;
varying vec3 vColor;
varying vec3 vBarycentric;
varying float vFacetSeed;
varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vPosition;
void main(){
  // Derivatives must be evaluated before the per-pixel dissolve discards lanes.
  vec3 facetNormal=normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)));
  vec3 width=max(fwidth(vBarycentric),vec3(.00001));
  ${DISSOLVE}
  vec3 view=normalize(-vViewPosition), normal=normalize(vNormal);
  if(dot(normal,view)<0.0)normal=-normal;
  if(dot(facetNormal,view)<0.0)facetNormal=-facetNormal;
  normal=normalize(mix(normal,facetNormal,.55));
  float phase=dot(vPosition,vec3(.48,.66,.38))+time*.68;
  float gradient=.5+.5*sin(phase);
  // Animate within the nearest authored color family. Mixing opposing blue
  // and orange regions together would turn the membrane into a pastel field.
  float authoredValue=max(max(vColor.r,vColor.g),vColor.b);
  vec3 authored=vColor/max(authoredValue,.0001);
  vec3 lowerCenter=(palette0+palette1)*.5;
  vec3 upperCenter=(palette2+palette3)*.5;
  lowerCenter/=max(max(lowerCenter.r,lowerCenter.g),lowerCenter.b);
  upperCenter/=max(max(upperCenter.r,upperCenter.g),upperCenter.b);
  float family=step(distance(authored,upperCenter),distance(authored,lowerCenter));
  vec3 lower=mix(palette0,palette1,gradient);
  vec3 upper=mix(palette2,palette3,gradient);
  vec3 animated=mix(lower,upper,family);
  // Dark eyes, recesses and navy areas retain their authored value as their
  // hue changes; a bright moving palette must not fill every recess with gold.
  animated*=authoredValue/max(max(animated.r,animated.g),animated.b);
  vec3 base=mix(vColor,animated,.24+.04*sin(phase*.71));
  float key=max(dot(normal,normalize(vec3(-.45,.72,1.0))),0.0);
  float fill=max(dot(normal,normalize(vec3(.7,-.25,.65))),0.0);
  float rim=pow(1.0-max(dot(normal,view),0.0),2.2);
  vec3 light=normalize(vec3(-.5+.18*sin(time*.8),.7,1.0));
  float specular=pow(max(dot(normal,normalize(light+view)),0.0),110.0);
  float shimmer=pow(.5+.5*sin(phase*2.1+time*.9),10.0);
  float facetLight=.76+.28*vFacetSeed+.09*sin(phase*1.8+vFacetSeed*6.283);
  vec3 face=base*(.38+.76*key+.12*fill)*facetLight+vec3(.88,.94,1.0)*specular*.30;
  face+=base*(rim*.30+shimmer*.10);
  vec3 lines=smoothstep(vec3(0.0),width*.72,vBarycentric);
  float edge=1.0-min(min(lines.x,lines.y),lines.z);
  float trianglePixels=1.0/max(max(width.x,width.y),width.z);
  // Fine luminous edges reveal the real tessellation; individually lit facets
  // read as a crystalline mesh, while subpixel triangles stay antialiased.
  edge*=smoothstep(.8,4.0,trianglePixels);
  vec3 thread=base*1.85+vec3(.025,.035,.05);
  face=mix(face,thread,edge*.66);
  float spark=pow(max(vBarycentric.x,max(vBarycentric.y,vBarycentric.z)),35.0);
  face+=mix(base,vec3(.8,.9,1.0),.28)*spark*shimmer*.48;
  // Sparse pearl glints ride actual facets rather than filling the bottle
  // with an unrelated particle cloud. Most of the surface stays softly lit.
  float twinkle=pow(.5+.5*sin(time*1.35+vFacetSeed*91.7),24.0);
  float star=step(.975,vFacetSeed)*twinkle;
  face+=mix(vec3(.86,.91,1.0),vec3(1.0,.92,.85),vFacetSeed)*stardust*star*(.22+spark*1.65);
  gl_FragColor=vec4(face,mix(opacity,min(.98,opacity+.18),edge));
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
  if(manifest.version !== 2 || manifest.stride !== 39) throw new Error("Unsupported sculpture data");
  return {data,view,manifest,offset:4+size};
}


/** Mildly translucent, tessellated surfaces with a shared nearest-surface depth pass. */
export async function createWorld({container,quality="high",onFailure}) {
  const packed=await loadSculptures();
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"high-performance"});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x080808,0);
  const canvas=renderer.domElement;canvas.setAttribute("aria-hidden","true");container.append(canvas);
  let disposed=false,shaderFailed=false,frames=0,currentQuality=quality,pair="",currentName="hero",nextName="hero",blend=0,gradientTime=0;
  renderer.debug.onShaderError=()=>{shaderFailed=true;};
  const contextLost=event=>{event.preventDefault();onFailure(new Error("WebGL context lost"));};canvas.addEventListener("webglcontextlost",contextLost);
  const scene=new THREE.Scene(),pivot=new THREE.Group();scene.add(pivot);
  const camera=new THREE.PerspectiveCamera(35,1,.1,60),entryCamera=new THREE.PerspectiveCamera(),dragQuaternion=new THREE.Quaternion(),inverseView=new THREE.Quaternion(),fitRotation=new THREE.Quaternion();
  let orbitClock=0,entranceProgress=1,entranceScale=1;
  let userRotation=[0,0],userOrientation=[0,0,0,1],dragging=false;
  const count=packed.manifest.count,bary=new Float32Array(count*9),facetSeeds=new Float32Array(count*3),decoded=new Map();
  for(let i=0;i<count;i++){
    bary[i*9]=1;bary[i*9+4]=1;bary[i*9+8]=1;
    let seed=Math.imul(i^0x9e3779b9,0x85ebca6b);seed=Math.imul(seed^(seed>>>13),0xc2b2ae35);seed^=seed>>>16;
    facetSeeds.fill((seed>>>0)/4294967296,i*3,i*3+3);
  }
  const makeMaterial=endpoint=>new THREE.ShaderMaterial({
    vertexShader:VERTEX,fragmentShader:FRAGMENT,side:THREE.DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true,
    uniforms:{progress:{value:0},endpoint:{value:endpoint},time:{value:0},opacity:{value:SCULPTURE_STYLE.opacity},stardust:{value:0},...Object.fromEntries([0,1,2,3].map(i=>[`palette${i}`,{value:new THREE.Color()}]))},
  });
  const emptyGeometry=new THREE.BufferGeometry();
  const meshes=[0,1].map(endpoint=>{const mesh=new THREE.Mesh(emptyGeometry,makeMaterial(endpoint));mesh.frustumCulled=false;mesh.renderOrder=1;pivot.add(mesh);return mesh;});
  const depthMeshes=meshes.map(mesh=>{
    const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:DEPTH_FRAGMENT,uniforms:mesh.material.uniforms,
      side:THREE.DoubleSide,colorWrite:false,depthWrite:true,transparent:false,forceSinglePass:true});
    const depth=new THREE.Mesh(emptyGeometry,material);depth.frustumCulled=false;pivot.add(depth);return depth;
  });
  let finiteActiveBuffers=true;
  function decode(name){
    if(decoded.has(name))return decoded.get(name);
    const modelIndex=packed.manifest.models.findIndex(m=>m.name===name);
    if(modelIndex<0)throw new Error(`Unknown sculpture ${name}`);
    const position=new Float32Array(count*9),color=new Float32Array(count*9),normal=new Float32Array(count*9),stride=packed.manifest.stride,offset=packed.offset+modelIndex*count*stride;
    for(let i=0;i<count;i++){
      const at=offset+i*stride;
      for(let j=0;j<9;j++){position[i*9+j]=packed.view.getInt16(at+j*2,true)/4096;normal[i*9+j]=packed.view.getInt16(at+21+j*2,true)/32767;}
      for(let k=0;k<3;k++)for(let j=0;j<3;j++)color[i*9+j*3+k]=packed.view.getUint8(at+18+k)/255;
    }
    const bounds=packed.manifest.models[modelIndex].fitBounds,geometry=new THREE.BufferGeometry();
    for(const [attribute,array] of Object.entries({position,normal,surfaceColor:color,barycentric:bary}))geometry.setAttribute(attribute,new THREE.BufferAttribute(array,3));
    geometry.setAttribute('facetSeed',new THREE.BufferAttribute(facetSeeds,1));
    const finite=position.every(Number.isFinite)&&normal.every(Number.isFinite);
    const result={name,position,color,normal,bounds,geometry,finite,orbitStart:orbitClock,orientation:[0,0,0,1]};decoded.set(name,result);return result;
  }
  let activeModels=[];
  function updatePair(a,b){
    const key=`${a}/${b}`;if(key===pair)return;
    activeModels=[decode(a),decode(b)];
    for(let i=0;i<2;i++){
      // A target owns its geometry across endpoint changes. Both settled
      // meshes can reference it safely; only one endpoint is visible.
      meshes[i].geometry=activeModels[i].geometry;
      depthMeshes[i].geometry=activeModels[i].geometry;
      meshes[i].material.uniforms.opacity.value=sculptureOpacity(i?b:a);
      meshes[i].material.uniforms.stardust.value=(i?b:a)==='notes'?1:0;
      SCULPTURE_PALETTES[i?b:a].forEach((color,k)=>meshes[i].material.uniforms[`palette${k}`].value.set(color));
    }
    finiteActiveBuffers=activeModels.every(model=>model.finite);
    if(!pair)emptyGeometry.dispose();
    pair=key;for(const [name,model] of decoded)if(name!==a&&name!==b){model.geometry.dispose();decoded.delete(name);}
  }
  const routes=[];
  for(const model of packed.manifest.models)for(const path of model.paths){
    const points=path.points,count=points.length/3,context=path.kind==="context";
    const color=context?0xe9d6d5:model.name==="surface"?0xb7fff0:0xffd18a;
    let line,unitsPerPoint=1;
    if(model.name==="surface"||model.name==="congestion"){
      const radius=model.name==="congestion"?.027:.013;
      line=new THREE.Mesh(new THREE.TubeGeometry(new PreparedPath(points),count-1,radius,8,false),new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false}));unitsPerPoint=48;
    }else{
      const geometry=new THREE.BufferGeometry().setAttribute("position",new THREE.Float32BufferAttribute(points,3));
      line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,depthTest:true,transparent:true,depthWrite:false}));
    }
    line.renderOrder=2;line.visible=false;pivot.add(line);routes.push({line,model:model.name,kind:path.kind,count,unitsPerPoint,shown:count});
  }
  let width=1,height=1,lastDpr=1;
  const orbitRadius=12;
  let fitScales=[1,1];
  function resize(_width,_height,dpr=lastDpr){
    width=Math.max(1,container.clientWidth);height=Math.max(1,container.clientHeight);lastDpr=dpr;
    renderer.setPixelRatio(Math.min(dpr,QUALITY[currentQuality].dpr));renderer.setSize(width,height,false);
    canvas.style.filter="drop-shadow(0 0 12px rgb(153 190 240 / .46)) drop-shadow(0 0 3px rgb(229 239 255 / .38))";
    camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  updatePair("hero","hero");resize(0,0,devicePixelRatio);
  return {
    resize,setQuality(next){currentQuality=next;resize();},
    // Reversing a still-visible transition resumes that visit; a target evicted
    // from the two-entry cache starts fresh the next time it is decoded.
    entryOrientation:name=>decoded.get(name)?.orientation.slice(),
    render({state,pose,time,orbitTime=time,pointer=[0,0],project,interaction,interactionTarget=state.nextTarget||state.target,entrance=1}){
      if(disposed)return;
      entranceProgress=THREE.MathUtils.clamp(entrance,0,1);
      entranceScale=.08+.92*(1-Math.pow(1-entranceProgress,4));
      orbitClock=orbitTime;
      currentName=state.target||"hero";nextName=state.nextTarget||currentName;updatePair(currentName,nextName);
      blend=currentName===nextName?0:THREE.MathUtils.clamp(state.blend,0,1);gradientTime=time;
      const elevation=pose?.[3]||0,azimuth=pose?.[4]||0;
      camera.position.set(Math.cos(elevation)*Math.sin(azimuth),Math.sin(elevation),Math.cos(elevation)*Math.cos(azimuth));
      camera.lookAt(0,0,0);camera.rotateZ(pose?.[5]||0);
      userRotation=interaction?.rotation||[0,0];userOrientation=interaction?.orientation||[0,0,0,1];dragging=!!interaction?.dragging;
      // Each endpoint retains its own visit clock and last drag orientation.
      // The outgoing sculpture keeps moving continuously while the incoming
      // one opens at its authored view, without a shared-camera reset jump.
      fitScales=activeModels.map((model,index)=>{
        if(model.name===interactionTarget)model.orientation=[...userOrientation];
        const localPose=cameraPose({target:model.name,nextTarget:model.name,blend:0},{time:Math.max(0,orbitClock-model.orbitStart),pointer});
        const elevation=localPose[3],azimuth=localPose[4];
        entryCamera.position.set(Math.cos(elevation)*Math.sin(azimuth),Math.sin(elevation),Math.cos(elevation)*Math.cos(azimuth));
        entryCamera.lookAt(0,0,0);entryCamera.rotateZ(localPose[5]);
        dragQuaternion.fromArray(model.orientation).normalize();inverseView.copy(entryCamera.quaternion).invert();
        fitRotation.copy(dragQuaternion).multiply(inverseView);
        meshes[index].quaternion.copy(camera.quaternion).multiply(fitRotation);
        depthMeshes[index].quaternion.copy(meshes[index].quaternion);
        return entranceScale*SCULPTURE_STYLE.scale*orbitRadius/fitSurfaceDistance(model.bounds,fitRotation,camera.aspect);
      });
      meshes.forEach((mesh,index)=>{mesh.scale.setScalar(fitScales[index]);depthMeshes[index].scale.copy(mesh.scale);});
      camera.position.multiplyScalar(orbitRadius);
      meshes[0].visible=blend<1;meshes[1].visible=currentName!==nextName&&blend>0;
      depthMeshes.forEach((mesh,index)=>{mesh.visible=meshes[index].visible;});
      for(const mesh of meshes){mesh.material.uniforms.progress.value=blend;mesh.material.uniforms.time.value=time;}
      for(const route of routes){
        const presence=currentName===route.model?1-blend:nextName===route.model?blend:0;
        // Prepared route and host sculpture share the same presentation scale.
        route.line.scale.setScalar(currentName===route.model?fitScales[0]:fitScales[1]);
        route.line.quaternion.copy(meshes[currentName===route.model?0:1].quaternion);
        route.line.material.opacity=presence*(route.kind==="context"?.38:1);
        route.line.visible=presence>.001&&(route.kind==="route"||route.kind===project.shortcut||route.kind==="boundary"||route.kind==="context");
        route.shown=Math.max(2,Math.floor(route.count*(route.model==="surface"?project.path:1)));
        route.line.geometry.setDrawRange(0,route.unitsPerPoint===1?route.shown:(route.shown-1)*route.unitsPerPoint);
      }
      renderer.render(scene,camera);if(shaderFailed)throw new Error("Sculpture shader initialization failed");frames++;
    },
    snapshot:()=>({frames,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality:currentQuality,dpr:renderer.getPixelRatio(),geometries:renderer.info.memory.geometries,contextLost:renderer.getContext().isContextLost(),target:currentName,nextTarget:nextName,blend,opacity:meshes[0].material.uniforms.opacity.value,opaque:meshes.every(mesh=>!mesh.material.transparent),depthPrepass:depthMeshes.every((depth,i)=>depth.geometry===meshes[i].geometry&&depth.material.uniforms===meshes[i].material.uniforms&&depth.material.depthWrite&&!depth.material.colorWrite&&depth.visible===meshes[i].visible&&depth.scale.equals(meshes[i].scale)&&depth.quaternion.equals(meshes[i].quaternion)),presentationScale:SCULPTURE_STYLE.scale,entranceProgress,entranceScale,gradientTime,orbitAges:activeModels.map(model=>Math.max(0,orbitClock-model.orbitStart)),endpointOpacities:meshes.map(mesh=>mesh.material.uniforms.opacity.value),activeMeshes:meshes.filter(m=>m.visible).length,activeDepthMeshes:depthMeshes.filter(m=>m.visible).length,shading:"tessellated",camera:camera.position.toArray(),cameraOrientation:camera.quaternion.toArray(),rotation:[...userRotation],userOrientation:[...userOrientation],orientation:meshes[0].quaternion.toArray(),dragging,facets:count,decodedTargets:decoded.size,finiteActiveBuffers,visibleRoutes:routes.filter(r=>r.line.visible).map(r=>r.kind),activePathPoints:routes.filter(r=>r.line.visible).map(r=>r.shown),width,height,orbitRadius,fitScales:[...fitScales]}),
    dispose(){if(disposed)return;disposed=true;canvas.removeEventListener("webglcontextlost",contextLost);[...meshes,...depthMeshes].forEach(mesh=>mesh.material.dispose());for(const model of decoded.values())model.geometry.dispose();routes.forEach(({line})=>{line.geometry.dispose();line.material.dispose();});decoded.clear();renderer.dispose();canvas.remove();},
  };
}
