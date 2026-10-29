import * as THREE from 'three';
import { NOISE } from './astronomy-materials.js';

const VERTEX=`varying vec3 vLocal;void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const FRAGMENT=`
uniform float time,presence;
uniform vec3 localCamera;
varying vec3 vLocal;
${NOISE}
float diskNoise(vec3 p,float footprint){
 float value=0.0,amplitude=.5;
 for(int j=0;j<4;j++){
   value+=amplitude*mix(.5,noise(p),1.0-smoothstep(.25,.75,footprint));
   p=p*2.03+vec3(7.1,3.7,1.3);footprint*=2.03;amplitude*=.5;
 }return value;
}
float disk(vec3 p,float footprint){
 float r=length(p.xz),a=atan(p.z,p.x);
 float fade=smoothstep(.73,.91,r)*(1.0-smoothstep(2.65,3.08,r));
 // Differential orbital flow, with no periodic rings or one-sided brightness.
 float orbit=a-time*.34/pow(max(r,.75),1.5);
 vec2 flow=vec2(cos(orbit),sin(orbit));
 float pixel=max(.0015,footprint);
 float eddies=diskNoise(vec3(flow*r*4.0,time*.075),pixel*4.0);
 float stream=diskNoise(vec3(flow*r*19.0+vec2(eddies*.8),time*.12),pixel*19.0);
 float fine=mix(.5,noise(vec3(flow*r*67.0,time*.17)),1.0-smoothstep(.25,.75,pixel*67.0));
 float heat=pow(.85/max(r,.75),.82);
 return fade*heat*(.10+.55*eddies+.78*smoothstep(.28,.70,stream)+.12*fine);
}
void main(){
 vec3 direction=normalize(vLocal-localCamera),p=vLocal+direction*.001;
 float pixelCone=length(fwidth(direction));
 float emission=0.0,transmission=1.0;
 for(int i=0;i<176;i++){
   float r=length(p);if(r<.43||r>3.34)break;
   float stepSize=clamp((r-.34)*.095,.018,.17);
   vec3 acceleration=-.60*p/(r*r*r);
   acceleration-=direction*dot(acceleration,direction);
   vec3 nextDirection=normalize(direction+acceleration*stepSize);
   vec3 next=p+(direction+nextDirection)*(.5*stepSize);
   float sigma=.026+.012*length((p.xz+next.xz)*.5);
   if(min(abs(p.y),abs(next.y))<sigma*6.0||p.y*next.y<0.0){
     float dy=next.y-p.y;
     float mass=abs(dy)>.00001?(atan(next.y/sigma)-atan(p.y/sigma))/dy*stepSize/3.14159265:stepSize*sigma/(3.14159265*(p.y*p.y+sigma*sigma));
     float nearest=abs(dy)>.00001?clamp(-p.y/dy,0.0,1.0):.5;
     vec3 hit=mix(p,next,nearest);
     float density=disk(hit,pixelCone*length(hit-localCamera));
     float weight=mass*max(.20,abs(direction.y));
     emission+=transmission*density*weight;transmission*=exp(-density*weight*.36);
   }
   direction=nextDirection;p=next;
 }
 float ink=(1.0-exp(-emission*2.15))*presence;
 if(ink<.002)discard;
 gl_FragColor=vec4(vec3(.015),min(.98,ink));
}`;
export function createBlackHole(scene,parent){
  const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,
    transparent:true,side:THREE.FrontSide,depthWrite:false,depthTest:false,
    uniforms:{...scene.uniforms,localCamera:{value:new THREE.Vector3()}}});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(3.3,192,128),material);
  const inverse=new THREE.Matrix4();
  mesh.onBeforeRender=(_renderer,_scene,camera)=>{
    inverse.copy(mesh.matrixWorld).invert();
    material.uniforms.localCamera.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse);
  };
  mesh.userData.posterKind='black-hole';parent.add(mesh);scene.materials.add(material);
  return mesh;
}
// CPU noise matches the live shader; posters keep the same continuous disk flow.
const fract=x=>x-Math.floor(x);
function noise(x,y,z){
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  let fx=fract(x),fy=fract(y),fz=fract(z);fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
  const hash=(x,y,z)=>{x=fract(x*.3183099+.13)*17;y=fract(y*.3183099+.27)*17;z=fract(z*.3183099+.41)*17;return fract(x*y*z*(x+y+z));};
  const mix=(a,b,t)=>a+(b-a)*t;
  return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),fx),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);
}
function fbm(x,y,z){let v=0,a=.5;for(let i=0;i<4;i++){v+=a*noise(x,y,z);x=x*2.03+7.1;y=y*2.03+3.7;z=z*2.03+1.3;a*=.5;}return v;}
export function traceBlackHole(px,py,pz,dx,dy,dz,time=0){
  let emission=0,transmission=1;
  for(let i=0;i<176;i++){
    const r=Math.hypot(px,py,pz);if(r<.43||r>3.34)break;
    const step=Math.max(.018,Math.min(.17,(r-.34)*.095)),factor=-.60/(r*r*r);
    let ax=px*factor,ay=py*factor,az=pz*factor;
    const along=ax*dx+ay*dy+az*dz;ax-=dx*along;ay-=dy*along;az-=dz*along;
    let nx=dx+ax*step,ny=dy+ay*step,nz=dz+az*step;
    const length=Math.hypot(nx,ny,nz);nx/=length;ny/=length;nz/=length;
    const qx=px+(dx+nx)*step*.5,qy=py+(dy+ny)*step*.5,qz=pz+(dz+nz)*step*.5;
    const sigma=.026+.012*Math.hypot((px+qx)*.5,(pz+qz)*.5);
    if(Math.min(Math.abs(py),Math.abs(qy))<sigma*6||py*qy<0){
      const dy=qy-py,mass=Math.abs(dy)>.00001?(Math.atan(qy/sigma)-Math.atan(py/sigma))/dy*step/Math.PI:step*sigma/(Math.PI*(py*py+sigma*sigma));
      const t=Math.abs(dy)>.00001?Math.max(0,Math.min(1,-py/dy)):.5,x=px+(qx-px)*t,z=pz+(qz-pz)*t;
      const radius=Math.hypot(x,z),angle=Math.atan2(z,x)-time*.34/Math.max(radius,.75)**1.5;
      const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
      const fade=smooth(.73,.91,radius)*(1-smooth(2.65,3.08,radius));
      const eddies=fbm(Math.cos(angle)*radius*4,Math.sin(angle)*radius*4,time*.075);
      const stream=fbm(Math.cos(angle)*radius*19+eddies*.8,Math.sin(angle)*radius*19+eddies*.8,time*.12);
      const fine=noise(Math.cos(angle)*radius*67,Math.sin(angle)*radius*67,time*.17);
      const density=fade*(.85/Math.max(radius,.75))**.82*(.10+.55*eddies+.78*smooth(.28,.70,stream)+.12*fine),weight=mass*Math.max(.20,Math.abs(dy/step));
      emission+=transmission*density*weight;transmission*=Math.exp(-density*weight*.36);
    }
    dx=nx;dy=ny;dz=nz;px=qx;py=qy;pz=qz;
  }
  return Math.min(.98,1-Math.exp(-emission*2.15));
}
