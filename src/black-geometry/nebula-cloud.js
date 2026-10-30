import * as THREE from 'three';
import { valueNoise, random, pointMaterial } from './astronomy-materials.js';

export const NEBULA_SIZE = Object.freeze([5.6, 6.8, 3.2]);
const RESOLUTION = [160, 224, 112];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const densityCache=new WeakMap(),fallback={};

function imageSample(image,u,v) {
  if(!image)return .5;
  const x=clamp(u)*(image.width-1),y=clamp(v)*(image.height-1),a=Math.floor(x),b=Math.floor(y),fx=x-a,fy=y-b;
  const right=Math.min(a+1,image.width-1),bottom=Math.min(b+1,image.height-1),d=image.pixels,w=image.width;
  return ((d[b*w+a]*(1-fx)+d[b*w+right]*fx)*(1-fy)+(d[bottom*w+a]*(1-fx)+d[bottom*w+right]*fx)*fy)/255;
}

function dustDetail(image,x,y,z,nx,ny,nz) {
  if(!image)return .75;
  const weights=[nx**4+.0001,ny**4+.0001,nz**4+.0001],sum=weights.reduce((a,b)=>a+b);
  const value=(weights[0]*imageSample(image,.5+z/3.2,.5-y/6.8)+weights[1]*imageSample(image,.5+x/5.6,.5+z/3.2)+weights[2]*imageSample(image,.5+x/5.6,.5-y/6.8))/sum;
  return clamp(1.16-1.65*value,.08,.95);
}

// Hubble supplies the front silhouette and fine dust detail. Curled, varying
// thickness and spatial turbulence supply an authored three-dimensional volume.
export function nebulaDensity(maps={}) {
  const mask=maps['nebula-mask']?.userData,key=mask||fallback;
  if(densityCache.has(key))return densityCache.get(key);
  const [nx,ny,nz]=RESOLUTION,data=new Uint8Array(nx*ny*nz);
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const px=(x/(nx-1)-.5)*NEBULA_SIZE[0],py=(y/(ny-1)-.5)*NEBULA_SIZE[1],pz=(z/(nz-1)-.5)*NEBULA_SIZE[2];
    const distance=mask?(imageSample(mask,.5+px/5.6,.5-py/6.8)-.5)*1.6:
      Math.min(...[-1,0,1].map((cx,i)=>Math.hypot((px-cx)*1.2,Math.max(0,Math.abs(py+.4)-[2.0,1.4,1.0][i]))-.36));
    if(distance>.12)continue;
    const warp=valueNoise(px*2.2+8,py*2.2,pz*2.2)-.5;
    const center=.26*Math.sin(py*1.4)+.18*Math.sin(px*2.8)+warp*.18;
    const thickness=.95*Math.sqrt(Math.max(0,-distance));
    const depth=Math.abs(pz-center)-thickness+.035*(valueNoise(px*16,py*11,pz*16)-.5);
    const gas=smooth(.04,-.035,depth)*smooth(.025,-.012,distance);
    const edge=.08*Math.exp(-Math.abs(depth)*20)*smooth(.05,-.02,distance);
    const fade=smooth(-3.3,-1.8,py)*smooth(3.25,2.8,py);
    data[(z*ny+y)*nx+x]=Math.round(clamp((gas+edge)*fade)*255);
  }
  const field={data,width:nx,height:ny,depth:nz,reference:maps.nebula?.userData};
  densityCache.set(key,field);return field;
}

// Trilinear density filtering matches the live 3D texture.
export function sampleNebula(data,x,y,z) {
  const {width:nx,height:ny,depth:nz}=data;
  let u=(x/NEBULA_SIZE[0]+.5)*(nx-1),v=(y/NEBULA_SIZE[1]+.5)*(ny-1),w=(z/NEBULA_SIZE[2]+.5)*(nz-1);
  if(u<0||v<0||w<0||u>=nx-1||v>=ny-1||w>=nz-1)return 0;
  const a=Math.floor(u),b=Math.floor(v),c=Math.floor(w);u-=a;v-=b;w-=c;
  const base=(c*ny+b)*nx+a,plane=nx*ny,d=data.data;
  const low0=d[base]+(d[base+1]-d[base])*u,low1=d[base+nx]+(d[base+nx+1]-d[base+nx])*u;
  const high0=d[base+plane]+(d[base+plane+1]-d[base+plane])*u,high1=d[base+plane+nx]+(d[base+plane+nx+1]-d[base+plane+nx])*u;
  const low=low0+(low1-low0)*v,high=high0+(high1-high0)*v;
  return (low+(high-low)*w)/255;
}

// Both renderers integrate translucent gas and light the density gradients.
export function traceNebula(origin,direction,data=nebulaDensity()) {
  let near=-Infinity,far=Infinity;
  for(let i=0;i<3;i++){
    const half=NEBULA_SIZE[i]/2,d=direction[i];
    if(Math.abs(d)<1e-10){if(Math.abs(origin[i])>half)return 0;continue;}
    let a=(-half-origin[i])/d,b=(half-origin[i])/d;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);
  }
  near=Math.max(0,near);if(far<=near)return 0;
  const step=(far-near)/128,e=.035;let ink=0,transmission=1,reference=.75,foundDetail=false,previous=0;
  for(let i=0;i<128&&transmission>.015;i++){
    const t=near+(i+.5)*step,x=origin[0]+direction[0]*t,y=origin[1]+direction[1]*t,z=origin[2]+direction[2]*t;
    const d=sampleNebula(data,x,y,z);if(d<.004){previous=d;continue;}
    let nx=sampleNebula(data,x-e,y,z)-sampleNebula(data,x+e,y,z),ny=sampleNebula(data,x,y-e,z)-sampleNebula(data,x,y+e,z),nz=sampleNebula(data,x,y,z-e)-sampleNebula(data,x,y,z+e);
    const length=Math.hypot(nx,ny,nz)||1;nx/=length;ny/=length;nz/=length;
    const light=Math.max(0,(-.6*nx+ny+.8*nz)/Math.sqrt(2));
    if(!foundDetail&&d>.15){
      const back=step*(1-clamp((.15-previous)/(d-previous)));
      reference=dustDetail(data.reference,x-direction[0]*back,y-direction[1]*back,z-direction[2]*back,nx,ny,nz);
      foundDetail=true;
    }
    const shade=1-.09*light,absorption=1-Math.exp(-d*step*7.0);
    ink+=transmission*absorption*shade;transmission*=1-absorption;
    previous=d;
  }
  return ink*reference;
}

export function createNebulaCloud(scene,maps={}) {
  const content=new THREE.Group();scene.root.add(content);
  const density=nebulaDensity(maps),texture=new THREE.Data3DTexture(density.data,density.width,density.height,density.depth);
  texture.format=THREE.RedFormat;texture.type=THREE.UnsignedByteType;texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.unpackAlignment=1;texture.needsUpdate=true;scene.textures.add(texture);
  const material=new THREE.ShaderMaterial({
    glslVersion:THREE.GLSL3,side:THREE.BackSide,transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,densityMap:{value:texture},detailMap:{value:maps.nebula||null},hasReference:{value:maps.nebula?1:0}},
    vertexShader:`out vec3 localPosition,localCamera;
      void main(){localPosition=position;localCamera=(inverse(modelMatrix)*vec4(cameraPosition,1.0)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`precision highp sampler3D;
      uniform sampler3D densityMap;uniform sampler2D detailMap;uniform float presence,time,hasReference;in vec3 localPosition,localCamera;out vec4 color;
      float field(vec3 p){vec3 size=vec3(5.6,6.8,3.2),resolution=vec3(160,224,112);
        vec3 uv=(p/size+.5)*(resolution-1.0)/resolution+.5/resolution;
        return textureLod(densityMap,uv,0.0).r;}
      float dust(vec3 p,vec3 n,vec3 dx,vec3 dy){
        vec3 w=pow(abs(n),vec3(4.0))+.0001;w/=w.x+w.y+w.z;
        float side=textureGrad(detailMap,vec2(.5+p.z/3.2,.5-p.y/6.8),dx.zy/vec2(3.2,-6.8),dy.zy/vec2(3.2,-6.8)).r;
        float top=textureGrad(detailMap,vec2(.5+p.x/5.6,.5+p.z/3.2),dx.xz/vec2(5.6,3.2),dy.xz/vec2(5.6,3.2)).r;
        float front=textureGrad(detailMap,vec2(.5+p.x/5.6,.5-p.y/6.8),dx.xy/vec2(5.6,-6.8),dy.xy/vec2(5.6,-6.8)).r;
        return clamp(1.16-1.65*dot(w,vec3(side,top,front)),.08,.95);
      }
      void main(){vec3 halfSize=vec3(2.8,3.4,1.6),ray=normalize(localPosition-localCamera);
        // Derivatives must be evaluated before the ray loop diverges per pixel.
        vec3 detailDx=dFdx(localPosition),detailDy=dFdy(localPosition);
        vec3 inverseRay=(step(vec3(0),ray)*2.0-1.0)/max(abs(ray),vec3(.000001));
        vec3 a=(-halfSize-localCamera)*inverseRay,b=(halfSize-localCamera)*inverseRay;
        vec3 lo=min(a,b),hi=max(a,b);float start=max(0.0,max(lo.x,max(lo.y,lo.z))),stop=min(hi.x,min(hi.y,hi.z));
        if(stop<=start)discard;float stepSize=(stop-start)/128.0,ink=0.0,transmission=1.0,reference=.75,previous=0.0;bool foundDetail=false;
        vec3 e=vec3(.035,0,0),lightDirection=normalize(vec3(-.6,1,.8));
        for(int i=0;i<128;i++){
          vec3 p=localCamera+ray*(start+(float(i)+.5)*stepSize);float d=field(p);
          if(d>.004){
            vec3 g=vec3(field(p-e.xyy)-field(p+e.xyy),field(p-e.yxy)-field(p+e.yxy),field(p-e.yyx)-field(p+e.yyx));
            vec3 n=g/max(length(g),.000001);
            if(!foundDetail&&d>.15){
              float back=stepSize*(1.0-clamp((.15-previous)/(d-previous),0.0,1.0));
              reference=hasReference>.5?dust(p-ray*back,n,detailDx,detailDy):.75;
              foundDetail=true;
            }
            float shade=1.0-.09*max(0.0,dot(n,lightDirection)),absorption=1.0-exp(-d*stepSize*7.0);
            ink+=transmission*absorption*shade;transmission*=1.0-absorption;
          }
          previous=d;
          if(transmission<.015)break;
        }
        color=vec4(vec3(.025),ink*reference*presence);
      }`,
  });
  scene.materials.add(material);
  const volume=new THREE.Mesh(new THREE.BoxGeometry(...NEBULA_SIZE),material);
  volume.userData={posterKind:'nebula-volume',role:'nebula-volume',density};content.add(volume);
  const rng=random(289170),positions=[],sizes=[],strength=[],phase=[],rate=[],center=[],axis=[];
  for(let i=0;i<260;i++){
    positions.push((rng()-.5)*4.6,(rng()-.5)*5.8,(rng()-.5)*2.6);sizes.push(.6+rng()**5*2.2);
    strength.push(.15+rng()*.5);phase.push(rng()*Math.PI*2);rate.push(0);center.push(0,0,0);axis.push(0,1,0);
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,data,width] of [['position',positions,3],['starSize',sizes,1],['strength',strength,1],['phase',phase,1],['rate',rate,1],['orbitCenter',center,3],['orbitAxis',axis,3]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,width));
  const stars=new THREE.Points(geometry,pointMaterial(scene));stars.userData={posterKind:'stars',posterSoft:0};stars.renderOrder=1;content.add(stars);
  scene.animate=time=>content.rotation.set(.04+Math.sin(time*.025)*.04,-.12+Math.sin(time*.035)*.10,-.08);
  scene.theme='Nebula';scene.volumeKind='dust-pillars';scene.renderMode='nebula-raymarch';scene.radius=4.85;
}
