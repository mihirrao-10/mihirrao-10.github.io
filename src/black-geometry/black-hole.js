import * as THREE from 'three';
import { NOISE } from './astronomy-materials.js';

const VERTEX=`varying vec3 vLocal;void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const FRAGMENT=`
uniform float time,presence;
uniform vec3 localCamera;
varying vec3 vLocal;
${NOISE}
float disk(vec3 p){
 float r=length(p.xz),a=atan(p.z,p.x);
 float fade=smoothstep(.73,.91,r)*(1.0-smoothstep(2.65,3.08,r));
 float warp=fbm(vec3(p.xz*8.0,time*.035));
 float filaments=.5+.5*sin(r*151.0+a*11.0+warp*24.0-time*.1);
 float eddies=fbm(vec3(p.xz*32.0+vec2(warp*3.0),time*.025));
 float heat=pow(.85/max(r,.75),.82);
 return fade*heat*(.18+.30*filaments+.95*eddies)*(.78+.22*cos(a-.5));
}
void main(){
 vec3 direction=normalize(vLocal-localCamera),p=vLocal+direction*.001;
 float emission=0.0,transmission=1.0;
 for(int i=0;i<144;i++){
   float r=length(p);if(r<.43||r>3.34)break;
   float stepSize=clamp((r-.34)*.095,.018,.17);
   vec3 acceleration=-.60*p/(r*r*r);
   acceleration-=direction*dot(acceleration,direction);
   vec3 nextDirection=normalize(direction+acceleration*stepSize);
   vec3 next=p+(direction+nextDirection)*(.5*stepSize);
   if(p.y*next.y<0.0){
     vec3 hit=mix(p,next,p.y/(p.y-next.y));
     float density=disk(hit);
     emission+=transmission*density;transmission*=1.0-density*.36;
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
// The static poster follows the same adaptive ray path and accretion crossings.
export function traceBlackHole(px,py,pz,dx,dy,dz){
  let emission=0,transmission=1;
  for(let i=0;i<144;i++){
    const r=Math.hypot(px,py,pz);if(r<.43||r>3.34)break;
    const step=Math.max(.018,Math.min(.17,(r-.34)*.095)),factor=-.60/(r*r*r);
    let ax=px*factor,ay=py*factor,az=pz*factor;
    const along=ax*dx+ay*dy+az*dz;ax-=dx*along;ay-=dy*along;az-=dz*along;
    let nx=dx+ax*step,ny=dy+ay*step,nz=dz+az*step;
    const length=Math.hypot(nx,ny,nz);nx/=length;ny/=length;nz/=length;
    const qx=px+(dx+nx)*step*.5,qy=py+(dy+ny)*step*.5,qz=pz+(dz+nz)*step*.5;
    if(py*qy<0){
      const t=py/(py-qy),x=px+(qx-px)*t,z=pz+(qz-pz)*t;
      const radius=Math.hypot(x,z),angle=Math.atan2(z,x);
      const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
      const fade=smooth(.73,.91,radius)*(1-smooth(2.65,3.08,radius));
      const warp=.5+.25*Math.sin(x*8+Math.sin(z*11))+.25*Math.sin(z*17+Math.sin(x*9));
      const filaments=.5+.5*Math.sin(radius*151+angle*11+warp*24);
      const eddies=.5+.25*Math.sin(x*31+z*47+warp*3)+.25*Math.sin(z*63-x*59);
      const density=fade*(.85/Math.max(radius,.75))**.82*(.18+.30*filaments+.95*eddies)*(.78+.22*Math.cos(angle-.5));
      emission+=transmission*density;transmission*=1-density*.36;
    }
    dx=nx;dy=ny;dz=nz;px=qx;py=qy;pz=qz;
  }
  return Math.min(.98,1-Math.exp(-emission*2.15));
}
