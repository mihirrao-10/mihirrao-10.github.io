import * as THREE from 'three';
import { random, gaussian, valueNoise } from './astronomy-materials.js';

const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const FLOW_REACH=2*Math.hypot(.14,.11,.16);

// Individual dust grains orbit local knots and drift on different phases.
// The time-zero displacement is zero, so the static poster uses the same cloud.
export function nebulaParticle(position,center,axis,rate,phase,time) {
  const p=position.map((v,i)=>v-center[i]),a=time*rate,c=Math.cos(a),s=Math.sin(a),dot=p.reduce((v,x,i)=>v+x*axis[i],0);
  const cross=[axis[1]*p[2]-axis[2]*p[1],axis[2]*p[0]-axis[0]*p[2],axis[0]*p[1]-axis[1]*p[0]];
  const q=p.map((v,i)=>v*c+cross[i]*s+axis[i]*dot*(1-c)+center[i]);
  q[0]+=.14*(Math.sin(time*.42+phase*.25+center[1]*1.8)-Math.sin(phase*.25+center[1]*1.8));
  q[1]+=.11*(Math.sin(time*.35+phase*.20+center[2]*2.1)-Math.sin(phase*.20+center[2]*2.1));
  q[2]+=.16*(Math.sin(time*.38+phase*.30+center[0]*1.6)-Math.sin(phase*.30+center[0]*1.6));
  return q;
}

function dustMaterial(scene,soft) {
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,soft:{value:soft},viewportHeight:{value:765}},
    vertexShader:`attribute float starSize,strength,phase,rate;attribute vec3 orbitCenter,orbitAxis;
      uniform float time,pixelRatio,soft,viewportHeight;varying float alpha;
      void main(){vec3 p=position-orbitCenter;float a=time*rate;
        p=p*cos(a)+cross(orbitAxis,p)*sin(a)+orbitAxis*dot(orbitAxis,p)*(1.0-cos(a))+orbitCenter;
        vec3 seed=phase*vec3(.25,.20,.30)+vec3(orbitCenter.y*1.8,orbitCenter.z*2.1,orbitCenter.x*1.6);
        p+=vec3(.14,.11,.16)*(sin(time*vec3(.42,.35,.38)+seed)-sin(seed));
        vec4 v=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*v;
        float natural=starSize*viewportHeight/765.0*12.0/max(1.0,-v.z);
        gl_PointSize=clamp(natural,.7*pixelRatio,mix(6.0,20.0,soft)*pixelRatio);
        alpha=strength*min(1.0,natural*natural/(gl_PointSize*gl_PointSize))*(.90+.10*sin(time*.55+phase));
      }`,
    fragmentShader:`uniform float presence,soft;varying float alpha;
      void main(){float r=length(gl_PointCoord*2.0-1.0);
        float grain=exp(-r*r*mix(3.2,5.0,soft))*(1.0-smoothstep(.68,1.0,r));
        float ink=grain*alpha*presence;if(ink<.001)discard;
        gl_FragColor=vec4(vec3(.02),ink);
      }`,
  });
  scene.materials.add(material);return material;
}

function centerline(u,branch,target) {
  const x=u*2.35;
  target[0]=x+.18*Math.sin(u*6+branch);
  target[1]=.62*Math.sin(u*2.8+branch*.7)+(branch-1.5)*.48;
  target[2]=.60*Math.sin(u*3.2+branch*1.6);
}

export function createNebulaCloud(scene) {
  const content=new THREE.Group();scene.root.add(content);
  let bound=0;const drawingSize=new THREE.Vector2(),axis=new THREE.Vector3();
  const center=[0,0,0],offset=[0,0,0],p=[0,0,0];
  const layers=[
    {count:166000,seed:87129,role:'nebula-dust',soft:0},
    {count:54000,seed:57237,role:'nebula-filaments',soft:0},
    {count:18000,seed:13733,role:'nebula-haze',soft:1},
  ];
  for(const layer of layers){
    // Retain only the final typed buffers; reuse sampling scratch space below.
    const rng=random(layer.seed),count=layer.count,data={
      position:new Float32Array(count*3),starSize:new Float32Array(count),strength:new Float32Array(count),
      phase:new Float32Array(count),rate:new Float32Array(count),
      orbitCenter:new Float32Array(count*3),orbitAxis:new Float32Array(count*3),
    };
    const filament=layer.role==='nebula-filaments',haze=layer.soft===1;
    for(let i=0;i<layer.count;i++){
      const branch=i%4,u=rng()*2-1;centerline(u,branch,center);
      const knot=valueNoise(u*8+branch*3,branch+4,2.7);
      const width=filament?.045+.085*knot:haze?.20+.24*knot:.10+.37*knot;
      const spread=width*(.4+.6*Math.sqrt(Math.max(0,1-u*u)));
      for(let k=0;k<3;k++)offset[k]=clamp(gaussian(rng),-2.4,2.4)*spread;
      if(filament){offset[1]+=.14*Math.sin(u*15+branch);offset[2]+=.10*Math.cos(u*18+branch);}
      for(let k=0;k<3;k++)p[k]=center[k]+offset[k];
      const texture=valueNoise(p[0]*5+3,p[1]*5,p[2]*5+8);
      const density=(.18+.82*texture**2)*(.3+.7*knot);
      const edge=(1-u*u)**.35;
      axis.set(rng()-.5,.35+rng(),rng()-.5).normalize();
      data.position.set(p,i*3);data.orbitCenter.set(center,i*3);axis.toArray(data.orbitAxis,i*3);
      data.starSize[i]=haze?4+rng()*8:filament?.8+rng()**2*2.0:.7+rng()**2*2.0;
      data.strength[i]=(haze?.010+rng()*.013:filament?.65+rng()*.35:.48+rng()*.42)*density*edge;
      data.phase[i]=rng()*TAU;data.rate[i]=(.08+rng()*.13)*(filament?1.1:1);
      bound=Math.max(bound,Math.hypot(...center)+Math.hypot(...offset)+FLOW_REACH);
    }
    const geometry=new THREE.BufferGeometry();
    for(const [name,values] of Object.entries(data))geometry.setAttribute(name,new THREE.BufferAttribute(values,['position','orbitCenter','orbitAxis'].includes(name)?3:1));
    const points=new THREE.Points(geometry,dustMaterial(scene,layer.soft));points.frustumCulled=false;
    // Keep optical density consistent when the same cloud fits a small screen.
    points.onBeforeRender=renderer=>{points.material.uniforms.viewportHeight.value=renderer.getDrawingBufferSize(drawingSize).y;};
    points.renderOrder=haze?0:1;points.userData={role:layer.role,posterKind:'stars',posterSoft:layer.soft};content.add(points);
  }
  scene.animate=time=>content.rotation.set(.32+Math.sin(time*.06)*.10,time*.018,-.25+Math.sin(time*.04)*.04);
  scene.theme='Nebula';scene.volumeKind='flowing-particles';scene.renderMode='particle-nebula';scene.radius=bound*1.035;
  scene.particleCount=layers.reduce((sum,layer)=>sum+layer.count,0);
}
