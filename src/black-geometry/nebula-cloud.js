import * as THREE from 'three';
import { NOISE, valueNoise, random, pointMaterial } from './astronomy-materials.js';

export const NEBULA_SIZE = Object.freeze([6.4, 4, 3.4]);
const RESOLUTION = [192, 128, 96];
const sq=x=>x*x,q4=x=>sq(sq(x));
const smooth = (a,b,x) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t); };
let cached;

// A seeded spatial density field: unequal branches, eroded cavities, and fine
// turbulent lanes. The silhouette emerges from gas density, not a solid mesh.
export function nebulaDensity() {
  if(cached)return cached;
  const [nx,ny,nz]=RESOLUTION,data=new Uint8Array(nx*ny*nz);
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const px=(x/(nx-1)-.5)*NEBULA_SIZE[0],py=(y/(ny-1)-.5)*NEBULA_SIZE[1],pz=(z/(nz-1)-.5)*NEBULA_SIZE[2];
    const warp=valueNoise(px*1.8+8,py*1.8,pz*1.8)-.5;
    const yy=py-.34*Math.sin(px*1.5)-warp*.35,zz=pz-.25*Math.cos(px*1.8)+warp*.25;
    const spine=Math.exp(-q4(px/2.35)-sq(yy/.58)-sq(zz/.60));
    const upper=Math.exp(-q4((px+.50)/1.65)-sq((py-.85+.20*Math.sin(px*2.0))/.27)-sq((pz+.20)/.43));
    const lower=Math.exp(-q4((px-.65)/1.45)-sq((py+.72+.25*Math.cos(px*1.7))/.32)-sq((pz-.25)/.42));
    const noise=.56*valueNoise(px*3.4+warp*2,py*3.4+7,pz*3.4)+.29*valueNoise(px*7.2+3,py*7.2,pz*7.2+9)+.15*valueNoise(px*15.4,py*15.4+4,pz*15.4);
    const cavity=1-.96*Math.exp(-sq((px-.05)/.59)-sq((py-.02)/.45)-sq((pz-.05)/1.0));
    const envelope=(spine+.70*upper+.62*lower)*cavity;
    const edge=smooth(0,.18,3.2-Math.abs(px))*smooth(0,.18,2-Math.abs(py))*smooth(0,.18,1.7-Math.abs(pz));
    const boundary=smooth(.065,.20,envelope+(noise-.5)*.22);
    const density=boundary*envelope*smooth(.30,.65,noise+warp*.13)*edge;
    data[(z*ny+y)*nx+x]=Math.round(Math.min(1,density)*255);
  }
  cached={data,width:nx,height:ny,depth:nz};return cached;
}

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

// The static fallback integrates the same volume along each camera ray.
export function traceNebula(origin,direction,data=nebulaDensity()) {
  let near=-Infinity,far=Infinity;
  for(let i=0;i<3;i++){
    const half=NEBULA_SIZE[i]/2,d=direction[i];
    if(Math.abs(d)<1e-10){if(Math.abs(origin[i])>half)return 0;continue;}
    let a=(-half-origin[i])/d,b=(half-origin[i])/d;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);
  }
  near=Math.max(0,near);if(far<=near)return 0;
  const step=(far-near)/80;let alpha=0;
  for(let i=0;i<80&&alpha<.98;i++){
    const t=near+(i+.5)*step,x=origin[0]+direction[0]*t,y=origin[1]+direction[1]*t,z=origin[2]+direction[2]*t;
    const d=sampleNebula(data,x,y,z);if(d<.006)continue;
    const detail=.12+1.9*smooth(.32,.70,valueNoise(x*24+3,y*24,z*24));
    alpha+=(1-alpha)*(1-Math.exp(-d*detail*step*2.8));
  }
  return alpha;
}

export function createNebulaCloud(scene) {
  const content=new THREE.Group();scene.root.add(content);
  const density=nebulaDensity(),texture=new THREE.Data3DTexture(density.data,density.width,density.height,density.depth);
  texture.format=THREE.RedFormat;texture.type=THREE.UnsignedByteType;texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.unpackAlignment=1;texture.needsUpdate=true;scene.textures.add(texture);
  const material=new THREE.ShaderMaterial({
    glslVersion:THREE.GLSL3,side:THREE.BackSide,transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,densityMap:{value:texture}},
    vertexShader:`out vec3 localPosition,localCamera;
      void main(){localPosition=position;localCamera=(inverse(modelMatrix)*vec4(cameraPosition,1.0)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`precision highp sampler3D;
      uniform sampler3D densityMap;uniform float presence,time;in vec3 localPosition,localCamera;out vec4 color;
      ${NOISE}
      void main(){vec3 halfSize=vec3(3.2,2.0,1.7),ray=normalize(localPosition-localCamera);
        vec3 inverseRay=(step(vec3(0),ray)*2.0-1.0)/max(abs(ray),vec3(.000001));
        vec3 a=(-halfSize-localCamera)*inverseRay,b=(halfSize-localCamera)*inverseRay;
        vec3 lo=min(a,b),hi=max(a,b);float start=max(0.0,max(lo.x,max(lo.y,lo.z))),stop=min(hi.x,min(hi.y,hi.z));
        if(stop<=start)discard;float stepSize=(stop-start)/96.0,alpha=0.0;
        for(int i=0;i<96;i++){
          vec3 p=localCamera+ray*(start+(float(i)+.5)*stepSize);
          float d=texture(densityMap,p/(halfSize*2.0)+.5).r;
          if(d>.006){float detail=.12+1.9*smoothstep(.32,.70,noise(p*24.0+vec3(3.0,time*.012,0)));
            float ink=1.0-exp(-d*detail*stepSize*2.8);alpha+=(1.0-alpha)*ink;}
          if(alpha>.98)break;
        }
        color=vec4(vec3(.025),alpha*presence);
      }`,
  });
  scene.materials.add(material);
  const volume=new THREE.Mesh(new THREE.BoxGeometry(...NEBULA_SIZE),material);
  volume.userData={posterKind:'nebula-volume',role:'nebula-volume'};content.add(volume);
  const rng=random(289170),positions=[],sizes=[],strength=[],phase=[],rate=[],center=[],axis=[];
  for(let i=0;i<380;i++){
    positions.push((rng()-.5)*5.8,(rng()-.5)*3.4,(rng()-.5)*3);sizes.push(.45+rng()**3*1.15);
    strength.push(.12+rng()*.40);phase.push(rng()*Math.PI*2);rate.push(0);center.push(0,0,0);axis.push(0,1,0);
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,data,width] of [['position',positions,3],['starSize',sizes,1],['strength',strength,1],['phase',phase,1],['rate',rate,1],['orbitCenter',center,3],['orbitAxis',axis,3]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,width));
  const stars=new THREE.Points(geometry,pointMaterial(scene));stars.userData={posterKind:'stars',posterSoft:0};stars.renderOrder=1;content.add(stars);
  scene.animate=time=>content.rotation.set(.24+Math.sin(time*.025)*.06,-.12+Math.sin(time*.035)*.13,-.23);
  scene.theme='Nebula';scene.volumeKind='turbulent-cloud';scene.renderMode='nebula-raymarch';scene.radius=4.35;
}
