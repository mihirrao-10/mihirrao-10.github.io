import * as THREE from "three";
import { QUALITY, renderingDpr, createResolutionBudget } from "./preferences.js";
import { cameraPose } from "./scene-state.js";
import { createCosmos, COSMIC_TARGETS } from "./cosmos.js";

export const SCULPTURE_PALETTES = Object.freeze({
  education: ["#555555", "#888888", "#aaaaaa", "#dddddd"],
  experience: ["#555555", "#888888", "#aaaaaa", "#dddddd"],
  projects: ["#555555", "#888888", "#aaaaaa", "#dddddd"],
  hero: ["#5146c8", "#a08af5", "#df82a4", "#ffe2bd"],
  phoenix: ["#580000", "#800000", "#767676", "#D6D6CE"],
  dragon: ["#063766", "#087fcc", "#f4b411", "#fff176"],
  membrane: ["#066ae2", "#31d3ef", "#ff6c18", "#ffcf4f"],
  resolution: ["#202945", "#476cba", "#e53e51", "#ff6a6b"],
  surface: ["#093fbc", "#126dff", "#08c7ba", "#69ffe1"],
  congestion: ["#ae1425", "#f13b30", "#ff6729", "#ffb24b"],
  notes: ["#e8e2f7", "#ddeef9", "#ffe4d4", "#fafaff"],
});
export const SCULPTURE_STYLE = Object.freeze({ scale: .91, opacity: .88 });
export const sculptureOpacity = name => name === 'hero' ? .30 : name === 'notes' || COSMIC_TARGETS.includes(name) ? .32 : SCULPTURE_STYLE.opacity;

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
  const horizontalRadius=Math.hypot(1,1/horizontal),verticalRadius=Math.hypot(1,1/vertical);
  const point=new THREE.Vector3();let distance=0;
  for(const sphere of bounds){
    point.fromArray(sphere.center).applyQuaternion(cameraSpaceRotation);
    distance=Math.max(distance,
      point.z+Math.abs(point.x)/horizontal+sphere.radius*horizontalRadius,
      point.z+Math.abs(point.y)/vertical+sphere.radius*verticalRadius);
  }
  return Math.max(4,distance*margin);
}

export class PreparedPath extends THREE.Curve {
  constructor(points) { super(); this.points=points; this.count=points.length/3; }
  getPoint(t,target=new THREE.Vector3()) {
    const at=Math.min(this.count-2,Math.floor(t*(this.count-1))),f=t*(this.count-1)-at;
    return target.set(...[0,1,2].map(k=>this.points[at*3+k]*(1-f)+this.points[(at+1)*3+k]*f));
  }
  getPointAt(t,target) { return this.getPoint(t,target); }
  getTangentAt(t,target) { return this.getTangent(t,target); }
}


/** All pages share one renderer and keep their prepared cosmic buffers resident. */
export async function createWorld({container,quality='high',onFailure,initialTarget='hero'}) {
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xf5f2eb,0);
  const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');container.append(canvas);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,60);
  // Each visible cosmos updates its own matrices after animation. Avoid a second
  // traversal of every scene, including hidden ones, inside renderer.render().
  scene.matrixWorldAutoUpdate=false;
  camera.position.set(0,0,12);camera.lookAt(0,0,0);
  const viewCamera=new THREE.PerspectiveCamera(),rotation=new THREE.Quaternion(),drag=new THREE.Quaternion(),inverseView=new THREE.Quaternion();
  // Resolve each complete scene before fading. Fading particle opacities changes
  // optical density nonlinearly; shared depth also makes solid bodies pop.
  const layer=new THREE.WebGLRenderTarget(64,64,{samples:4,depthBuffer:true});
  const composite=new THREE.Scene(),compositeCamera=new THREE.Camera();
  const compositeMaterial=new THREE.ShaderMaterial({
    uniforms:{image:{value:layer.texture},weight:{value:1}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:'uniform sampler2D image;uniform float weight;varying vec2 vUv;void main(){gl_FragColor=texture2D(image,vUv)*weight;}',
    transparent:true,depthTest:false,depthWrite:false,blending:THREE.CustomBlending,
    blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation,
  });
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),compositeMaterial);quad.frustumCulled=false;composite.add(quad);
  renderer.autoClear=false;
  const models=new Map();
  function disposeResources(){
    for(const model of models.values())model.cosmos.dispose();
    models.clear();layer.dispose();quad.geometry.dispose();compositeMaterial.dispose();renderer.dispose();canvas.remove();
  }
  try{
    for(const name of COSMIC_TARGETS){
      const cosmos=createCosmos(name);cosmos.root.visible=false;scene.add(cosmos.root);
      models.set(name,{name,cosmos,orbitStart:0,orientation:[0,0,0,1]});
    }
  }catch(error){disposeResources();throw error;}
  let disposed=false,shaderFailed=false,frames=0,warmedTargets=0,currentQuality=quality,preparing=true;
  let width=1,height=1,lastDpr=devicePixelRatio,dprCeiling=QUALITY[quality].dpr;
  let bufferWidth=0,bufferHeight=0,bufferDpr=0;
  let resolution=createResolutionBudget(dprCeiling),resolutionTarget='hero';resolution.select(resolutionTarget);
  let orbitClock=0,currentName='hero',nextName='hero',blend=0,activeNames=new Set(),nextActiveNames=new Set();
  let entranceProgress=1,entranceScale=1,fitScales=[],sceneWeights={};
  const preparedScenes=[];let gpuReady=false,liveFrameReady=false,drawCalls=0,triangles=0;
  let userRotation=[0,0],userOrientation=[0,0,0,1],dragging=false;
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{shaderFailed=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n')||'Unknown shader error';};
  const contextLost=event=>{event.preventDefault();onFailure(new Error('WebGL context lost'));};
  canvas.addEventListener('webglcontextlost',contextLost);
  function resize(_width,_height,dpr=lastDpr){
    width=Math.max(1,container.clientWidth);height=Math.max(1,container.clientHeight);lastDpr=dpr;
    const nextWidth=preparing?64:width,nextHeight=preparing?64:height;
    const nextDpr=preparing?1:renderingDpr(width,height,dpr,dprCeiling);
    if(nextWidth!==bufferWidth||nextHeight!==bufferHeight||nextDpr!==bufferDpr){
      renderer.setDrawingBufferSize(nextWidth,nextHeight,nextDpr);
      layer.setSize(Math.floor(nextWidth*nextDpr),Math.floor(nextHeight*nextDpr));
      bufferWidth=nextWidth;bufferHeight=nextHeight;bufferDpr=nextDpr;
    }
    if(camera.aspect!==width/height){camera.aspect=width/height;camera.updateProjectionMatrix();}
  }
  async function waitForGpu(){
    const gl=renderer.getContext(),fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
    if(!fence)throw new Error('Graphics preparation could not be synchronized');
    gl.flush();
    try{await new Promise((resolve,reject)=>{
      const poll=()=>{
        if(disposed||gl.isContextLost()){reject(new Error('Graphics context lost during preparation'));return;}
        const status=gl.clientWaitSync(fence,0,0);
        if(status===gl.WAIT_FAILED)reject(new Error('Graphics preparation failed'));
        else if(status===gl.TIMEOUT_EXPIRED)setTimeout(poll,8);
        else resolve();
      };poll();
    });}finally{gl.deleteSync(fence);}
  }
  const world={
    async preparePresentation(){await waitForGpu();liveFrameReady=true;},
    resize,setQuality(next){currentQuality=next;dprCeiling=QUALITY[next].dpr;resolution=createResolutionBudget(dprCeiling);resolution.select(resolutionTarget);resize();},
    recordFrame(milliseconds){
      if(Object.values(sceneWeights).filter(weight=>weight>0).length!==1)return;
      const next=resolution.record(milliseconds);
      if(next!==undefined){dprCeiling=next;resize();}
    },
    entryOrientation:name=>activeNames.has(name)?models.get(name)?.orientation.slice():undefined,
    render({state,time,orbitTime=time,pointer=[0,0],interaction,interactionTarget=state.nextTarget||state.target,entrance=1}){
      if(disposed)return;
      orbitClock=orbitTime;currentName=state.target||'hero';nextName=state.nextTarget||currentName;
      blend=THREE.MathUtils.clamp(state.blend,0,1);
      sceneWeights=state.weights || (currentName===nextName?{[currentName]:1}:{[currentName]:1-blend,[nextName]:blend});
      if(Object.values(sceneWeights).filter(weight=>weight>0).length===1&&currentName===nextName&&resolutionTarget!==currentName){resolutionTarget=currentName;dprCeiling=resolution.select(currentName);if(!preparing)resize();}
      entranceProgress=THREE.MathUtils.clamp(entrance,0,1);entranceScale=.08+.92*(1-(1-entranceProgress)**4);
      userRotation=interaction?.rotation||[0,0];userOrientation=interaction?.orientation||[0,0,0,1];dragging=!!interaction?.dragging;
      nextActiveNames.clear();
      for(const [name,weight] of Object.entries(sceneWeights))if(weight>0)nextActiveNames.add(name);
      for(const name of nextActiveNames){
        if(!models.has(name))throw new Error(`Unknown cosmic scene: ${name}`);
        if(!activeNames.has(name)){const model=models.get(name);model.orbitStart=orbitClock;model.orientation=[0,0,0,1];}
      }
      const previousActiveNames=activeNames;activeNames=nextActiveNames;nextActiveNames=previousActiveNames;fitScales.length=0;
      for(const model of models.values())model.cosmos.root.visible=false;
      renderer.setRenderTarget(null);renderer.setClearColor(0x000000,0);renderer.clear();
      drawCalls=triangles=0;
      for(const name of activeNames){
        const presence=sceneWeights[name];
        const model=models.get(name),age=Math.max(0,orbitClock-model.orbitStart);
        if(name===interactionTarget)for(let i=0;i<4;i++)model.orientation[i]=userOrientation[i];
        const pose=cameraPose({target:name,nextTarget:name,blend:0},{time:age,pointer});
        viewCamera.position.set(Math.cos(pose[3])*Math.sin(pose[4]),Math.sin(pose[3]),Math.cos(pose[3])*Math.cos(pose[4]));
        viewCamera.lookAt(0,0,0);viewCamera.rotateZ(pose[5]);
        drag.fromArray(model.orientation).normalize();rotation.copy(drag).multiply(inverseView.copy(viewCamera.quaternion).invert());
        const scale=entranceScale*SCULPTURE_STYLE.scale*12/fitSurfaceDistance(model.cosmos.bounds,rotation,camera.aspect);
        const root=model.cosmos.root;root.visible=true;root.quaternion.copy(rotation);root.scale.setScalar(scale);fitScales.push(scale);
        model.cosmos.update(age,1,renderer.getPixelRatio());
        renderer.setRenderTarget(layer);renderer.clear();renderer.render(scene,camera);
        drawCalls+=renderer.info.render.calls;triangles+=renderer.info.render.triangles;
        renderer.setRenderTarget(null);compositeMaterial.uniforms.weight.value=presence;renderer.render(composite,compositeCamera);
        drawCalls+=renderer.info.render.calls;triangles+=renderer.info.render.triangles;
        root.visible=false;
      }
      if(shaderFailed)throw new Error(`Cosmic shader initialization failed: ${shaderFailed}`);frames++;
    },
    snapshot:()=>({
      frames,warmedTargets,preparedMaps:[],programs:renderer.info.programs.length,preparedScenes:[...preparedScenes],gpuReady,liveFrameReady,sceneWeights:{...sceneWeights},drawCalls,triangles,
      quality:currentQuality,dpr:renderer.getPixelRatio(),geometries:renderer.info.memory.geometries,
      contextLost:renderer.getContext().isContextLost(),target:currentName,nextTarget:nextName,blend,
      depthPrepass:false,activeInteriorMeshes:0,decodedTargets:models.size,packedTargets:0,
      cosmicTargets:[...activeNames],
      cosmicAges:Object.fromEntries([...models].map(([name,model])=>[name,model.cosmos.uniforms.time.value])),
      transparentCosmos:[...models.values()].every(model=>[...model.cosmos.materials].every(m=>m.transparent)),
      coherentDepth:[...models.values()].some(model=>[...model.cosmos.materials].some(m=>m.userData.bodyDepth&&m.depthTest)),
      finiteActiveBuffers:true,presentationScale:SCULPTURE_STYLE.scale,entranceProgress,entranceScale,
      orbitAges:[...activeNames].map(name=>Math.max(0,orbitClock-models.get(name).orbitStart)),
      camera:camera.position.toArray(),cameraOrientation:camera.quaternion.toArray(),
      rotation:[...userRotation],userOrientation:[...userOrientation],orientation:models.get(currentName).cosmos.root.quaternion.toArray(),
      dragging,width,height,orbitRadius:12,fitScales:[...fitScales],
    }),
    dispose(){
      if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',contextLost);
      disposeResources();
    },
  };
  try{
    resize();
    await renderer.compileAsync(composite,compositeCamera);
    // Compile visible objects, then draw all geometry and maps into the same
    // multisampled target used live. Invisible roots are skipped by compileAsync.
    for(const name of COSMIC_TARGETS){
      if(disposed||renderer.getContext().isContextLost())throw new Error('Graphics preparation interrupted');
      const root=models.get(name).cosmos.root;root.visible=true;
      await renderer.compileAsync(scene,camera);root.visible=false;
      world.render({state:{target:name,nextTarget:name,blend:0},time:0});
      warmedTargets++;preparedScenes.push(name);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    preparing=false;resize();
    world.render({state:{target:initialTarget,nextTarget:initialTarget,blend:0},time:0});
    await waitForGpu();gpuReady=true;
    return world;
  }catch(error){world.dispose();throw error;}
}
