import * as THREE from 'three';
import { NOISE, valueNoise as noise } from './astronomy-materials.js';

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
 float orbit=a-time*.28/pow(max(r,.75),1.5);
 vec2 flow=vec2(cos(orbit),sin(orbit));
 float pixel=max(.0015,footprint);
 float eddies=diskNoise(vec3(flow*r*3.2,time*.045),pixel*3.2);
 // Anisotropic noise draws irregular filaments, never evenly spaced rings.
 float stream=diskNoise(vec3(r*18.0+eddies*1.8,flow*3.8+time*.025),pixel*18.0);
 float fine=mix(.5,noise(vec3(r*63.0+eddies*2.0,flow*9.0+time*.05)),1.0-smoothstep(.25,.75,pixel*63.0));
 float knots=diskNoise(vec3(flow*r*8.5+eddies*.7,time*.06),pixel*8.5);
 float threads=mix(.5,noise(vec3(r*121.0+stream*2.8,flow*17.0+time*.035)),1.0-smoothstep(.25,.75,pixel*121.0));
 float fade=smoothstep(.73,.91,r)*(1.0-smoothstep(2.50+eddies*.15,3.05,r));
 float heat=pow(.85/max(r,.75),1.05);
 return fade*heat*(.09+.32*eddies+.86*smoothstep(.25,.73,stream)+.19*fine+.09*threads)*(.74+.52*knots);
}
void main(){
 vec3 direction=normalize(vLocal-localCamera),p=vLocal+direction*.001;
 float pixelCone=length(fwidth(direction));
 float emission=0.0,transmission=1.0,captured=0.0;
 for(int i=0;i<176;i++){
   float r=length(p);if(r<.43){captured=1.0;break;}if(r>3.34)break;
   float stepSize=clamp((r-.34)*.095,.018,.17);
   vec3 acceleration=-.60*p/(r*r*r);
   acceleration-=direction*dot(acceleration,direction);
   vec3 nextDirection=normalize(direction+acceleration*stepSize);
   vec3 next=p+(direction+nextDirection)*(.5*stepSize);
   float sigma=.018+.010*length((p.xz+next.xz)*.5);
   if(min(abs(p.y),abs(next.y))<sigma*6.0||p.y*next.y<0.0){
     float dy=next.y-p.y;
     float mass=abs(dy)>.00001?(atan(next.y/sigma)-atan(p.y/sigma))/dy*stepSize/3.14159265:stepSize*sigma/(3.14159265*(p.y*p.y+sigma*sigma));
     float nearest=abs(dy)>.00001?clamp(-p.y/dy,0.0,1.0):.5;
     vec3 hit=mix(p,next,nearest);
     float density=disk(hit,pixelCone*length(hit-localCamera));
     float weight=mass*max(.20,abs((next.y-p.y)/stepSize));
     emission+=transmission*density*weight;transmission*=exp(-density*weight*.36);
   }
   direction=nextDirection;p=next;
 }
 float light=1.0-exp(-emission*2.65);
 // Captured rays form an unshaded void; foreground plasma stays readable over it.
 float ink=mix(light,.94-.40*light,captured)*presence;
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
function fbm(x,y,z){let v=0,a=.5;for(let i=0;i<4;i++){v+=a*noise(x,y,z);x=x*2.03+7.1;y=y*2.03+3.7;z=z*2.03+1.3;a*=.5;}return v;}
export function traceBlackHole(px,py,pz,dx,dy,dz,time=0){
  let emission=0,transmission=1,captured=false;
  for(let i=0;i<176;i++){
    const r=Math.hypot(px,py,pz);if(r<.43){captured=true;break;}if(r>3.34)break;
    const step=Math.max(.018,Math.min(.17,(r-.34)*.095)),factor=-.60/(r*r*r);
    let ax=px*factor,ay=py*factor,az=pz*factor;
    const along=ax*dx+ay*dy+az*dz;ax-=dx*along;ay-=dy*along;az-=dz*along;
    let nx=dx+ax*step,ny=dy+ay*step,nz=dz+az*step;
    const length=Math.hypot(nx,ny,nz);nx/=length;ny/=length;nz/=length;
    const qx=px+(dx+nx)*step*.5,qy=py+(dy+ny)*step*.5,qz=pz+(dz+nz)*step*.5;
    const sigma=.018+.010*Math.hypot((px+qx)*.5,(pz+qz)*.5);
    if(Math.min(Math.abs(py),Math.abs(qy))<sigma*6||py*qy<0){
      const dy=qy-py,mass=Math.abs(dy)>.00001?(Math.atan(qy/sigma)-Math.atan(py/sigma))/dy*step/Math.PI:step*sigma/(Math.PI*(py*py+sigma*sigma));
      const t=Math.abs(dy)>.00001?Math.max(0,Math.min(1,-py/dy)):.5,x=px+(qx-px)*t,z=pz+(qz-pz)*t;
      const radius=Math.hypot(x,z),angle=Math.atan2(z,x)-time*.28/Math.max(radius,.75)**1.5;
      const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
      const fx=Math.cos(angle),fz=Math.sin(angle);
      const eddies=fbm(fx*radius*3.2,fz*radius*3.2,time*.045);
      const stream=fbm(radius*18+eddies*1.8,fx*3.8+time*.025,fz*3.8+time*.025);
      const fine=noise(radius*63+eddies*2,fx*9+time*.05,fz*9+time*.05);
      const knots=fbm(fx*radius*8.5+eddies*.7,fz*radius*8.5+eddies*.7,time*.06);
      const threads=noise(radius*121+stream*2.8,fx*17+time*.035,fz*17+time*.035);
      const fade=smooth(.73,.91,radius)*(1-smooth(2.50+eddies*.15,3.05,radius));
      const density=fade*(.85/Math.max(radius,.75))**1.05*(.09+.32*eddies+.86*smooth(.25,.73,stream)+.19*fine+.09*threads)*(.74+.52*knots),weight=mass*Math.max(.20,Math.abs(dy/step));
      emission+=transmission*density*weight;transmission*=Math.exp(-density*weight*.36);
    }
    dx=nx;dy=ny;dz=nz;px=qx;py=qy;pz=qz;
  }
  const light=1-Math.exp(-emission*2.65);
  return Math.min(.98,captured?.94-.40*light:light);
}
