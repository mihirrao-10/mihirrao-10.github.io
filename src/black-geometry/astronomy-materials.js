import * as THREE from 'three';

export const NOISE = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.13,.27,.41));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.0,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec3(7.1,3.7,1.3);a*=.5;}return v;}
`;
const VERTEX=`
varying vec2 vUv;varying vec3 vNormal;varying vec3 vLocal;varying vec3 vView;
void main(){vUv=uv;vLocal=position;vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);vView=-p.xyz;gl_Position=projectionMatrix*p;}`;
const FRAGMENT=`
uniform float time,presence,kind,opacity,meshDensity,hasSurfaceMap;
uniform sampler2D surfaceMap;
varying vec2 vUv;varying vec3 vNormal,vLocal,vView;
${NOISE}
void main(){
 vec3 n=normalize(vNormal);float facing=abs(dot(n,normalize(vView)));
 float light=.30+.70*max(0.0,dot(n,normalize(vec3(-.65,.45,.9))));
 vec2 mapUv=vec2(vUv.x,1.0-vUv.y);
 if(kind>1.5&&kind<2.5)mapUv.x+=time*.00045*sin(vUv.y*25.0);
 if(kind>2.5&&kind<3.5)mapUv.x+=.003*sin(time*.12+vUv.y*19.0);
 float sampleMap=texture2D(surfaceMap,mapUv).r;
 float grain=fbm(vLocal*28.0+vec3(time*.005,0,0));
 float density=.18+.82*smoothstep(.10,.65,sampleMap);
 if(kind>0.5&&kind<1.5)density=.33+.6*sampleMap+.1*grain;
 if(kind>1.5&&kind<2.5){
   float bands=mix(fbm(vec3(vLocal.y*18.0,0,0)),sampleMap,hasSurfaceMap);
   density=.20+.73*(1.0-bands)+.055*fbm(vLocal*42.0+vec3(time*.025,0,0));}
 if(kind>2.5&&kind<3.5){
   vec3 p=normalize(vLocal),drift=vec3(time*.023,-time*.016,time*.011);
   float convection=fbm(p*12.0+drift);
   float cells=fbm(p*48.0+vec3(convection*2.0,time*.065,0));
   float granules=fbm(p*155.0+vec3(cells,time*.04,convection));
   float activity=mix(convection,sampleMap,hasSurfaceMap);
   float surface=.69+.58*(activity-.5)+.36*(cells-.5)+.20*(granules-.5);
   // Inverse luminance: a dense center softens toward the physical limb, with no halo.
   float limb=.15+.85*pow(facing,.62);
   float stellarInk=opacity*clamp(surface,.22,.90)*limb;
   gl_FragColor=vec4(vec3(.025),clamp(stellarInk,0.0,.94)*presence);return;}
 if(kind>3.5&&kind<4.5)density=.35+.38*grain;
 if(kind>4.5&&kind<5.5){
   float clouds=smoothstep(.49,.68,fbm(normalize(vLocal)*9.0+vec3(time*.006,0,0)));
   float alpha=clouds*opacity*presence*(.35+.65*facing);
   gl_FragColor=vec4(vec3(.08),alpha);return;}
 if(kind>5.5&&kind<6.5){
   float rim=pow(1.0-facing,4.0);gl_FragColor=vec4(vec3(.06),rim*opacity*presence);return;}
 if(kind>6.5&&kind<7.5){
   float d=sqrt(max(0.0,1.0-facing*facing));
   float shell=smoothstep(.62,.70,d)*(1.0-smoothstep(.84,1.0,d));
   vec3 p=normalize(vLocal);
   float stream=pow(fbm(p*15.0+vec3(time*.025,0,0)),2.0);
   float falloff=exp(-max(0.0,d-.69)*8.0);
   gl_FragColor=vec4(vec3(.02),shell*stream*falloff*opacity*presence);return;}
 if(kind>7.5&&kind<8.5){
   vec3 p=normalize(vLocal);float cells=fbm(p*48.0+vec3(time*.08,0,0));
   float poles=pow(abs(p.y),9.0);
   density=.49+.38*cells+.25*poles;light=.78+.22*facing;}
 if(kind>8.5){
   float cloud=smoothstep(.38,.67,fbm(normalize(vLocal)*24.0+vec3(time*.018,0,0)));
   gl_FragColor=vec4(vec3(.03),cloud*opacity*presence*.45);return;}
 float ink=opacity*(density*light+.09*pow(1.0-facing,3.0));
 gl_FragColor=vec4(vec3(.025),clamp(ink,0.0,.94)*presence);
}`;
export function surfaceMaterial(scene,kind=0,map=null,{opacity=1,detail=256,depthWrite=true}={}) {
  const hasSurfaceMap=map?1:0;
  if(!map){
    if(!scene.fallbackSurfaceMap){
      scene.fallbackSurfaceMap=new THREE.DataTexture(new Uint8Array([128]),1,1,THREE.RedFormat);
      scene.fallbackSurfaceMap.needsUpdate=true;scene.textures.add(scene.fallbackSurfaceMap);
    }
    map=scene.fallbackSurfaceMap;
  }
  const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,
    side:THREE.FrontSide,transparent:true,depthWrite,depthTest:true,
    uniforms:{...scene.uniforms,kind:{value:kind},opacity:{value:opacity},meshDensity:{value:detail},surfaceMap:{value:map},hasSurfaceMap:{value:hasSurfaceMap}}});
  material.userData.bodyDepth=depthWrite;scene.materials.add(material);return material;
}
const RING_FRAGMENT=`
uniform float time,presence,innerRadius,outerRadius,opacity;
uniform sampler2D ringProfile;
varying vec2 vUv;varying vec3 vNormal,vLocal,vView;
${NOISE}
void main(){
 float r=length(vLocal.xz),u=(r-innerRadius)/(outerRadius-innerRadius);
 float density=texture2D(ringProfile,vec2(clamp(u,0.0,1.0),.5)).r;
 float angle=atan(vLocal.z,vLocal.x)-time*.24/pow(max(r,.5),1.5);
 vec2 flow=vec2(cos(angle),sin(angle))*r;
 float footprint=length(fwidth(flow));
 float cloud=mix(.5,noise(vec3(flow*19.0,time*.035)),1.0-smoothstep(.25,.8,footprint*19.0));
 float fine=mix(.5,noise(vec3(flow*75.0,time*.055)),1.0-smoothstep(.25,.8,footprint*75.0));
 density*=.94+.14*(cloud-.5)+.06*(fine-.5);
 vec3 light=normalize(vec3(-.65,.65,.9));float along=dot(vLocal,light);
 float distanceToLightRay=length(vLocal-light*along),planetRadius=innerRadius*.82;
 float shadow=(1.0-smoothstep(planetRadius*.92,planetRadius*1.07,distanceToLightRay))*(1.0-smoothstep(-.1,.1,along));
 gl_FragColor=vec4(vec3(.025),density*(1.0-shadow*.85)*opacity*presence);
}`;
export function ringMaterial(scene,inner,outer,opacity=.9,map=null) {
  if(!map){map=new THREE.DataTexture(new Uint8Array([100]),1,1,THREE.RedFormat);map.needsUpdate=true;map.userData={width:1,height:1,pixels:new Uint8Array([100])};scene.textures.add(map);}
  const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:RING_FRAGMENT,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,innerRadius:{value:inner},outerRadius:{value:outer},opacity:{value:opacity},ringProfile:{value:map}}});
  scene.materials.add(material);return material;
}

export function volumeMaterial(scene,opacity=.12){
  const material=new THREE.ShaderMaterial({vertexShader:`
    varying vec3 vLocal,vLocalView;
    void main(){vLocal=position;vec4 p=modelViewMatrix*vec4(position,1.0);vec3 view=-p.xyz;
      vLocalView=vec3(dot(modelViewMatrix[0].xyz,view)/dot(modelViewMatrix[0].xyz,modelViewMatrix[0].xyz),
        dot(modelViewMatrix[1].xyz,view)/dot(modelViewMatrix[1].xyz,modelViewMatrix[1].xyz),
        dot(modelViewMatrix[2].xyz,view)/dot(modelViewMatrix[2].xyz,modelViewMatrix[2].xyz));
      gl_Position=projectionMatrix*p;}`,fragmentShader:`
    uniform float time,presence,opacity;
    varying vec3 vLocal,vLocalView;
    ${NOISE}
    void main(){
      // Local ray length fades even very flat ellipsoids smoothly at their edge.
      float path=max(0.0,dot(normalize(vLocal),normalize(vLocalView)));
      float cloud=.65+.35*fbm(vLocal*16.0+vec3(time*.04,0,0));
      gl_FragColor=vec4(vec3(.015),pow(path,2.2)*cloud*opacity*presence);}`,
    side:THREE.FrontSide,transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,opacity:{value:opacity}}});
  scene.materials.add(material);return material;
}

export function flareMaterial(scene,phase){
  const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:`
    uniform float time,presence,phase;varying vec2 vUv;
    void main(){float width=exp(-pow((vUv.y-.5)*5.0,2.0));
      float flow=.55+.45*sin(vUv.x*16.0-time*.7+phase);
      float envelope=.55+.45*sin(time*.17+phase);
      gl_FragColor=vec4(vec3(.02),width*flow*envelope*.24*presence);}`,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,phase:{value:phase}}});
  scene.materials.add(material);return material;
}
const POINT_VERTEX=`
attribute float starSize,strength,phase,rate;
attribute vec3 orbitCenter,orbitAxis;
uniform float time,pixelRatio,soft;
varying float alpha;
void main(){vec3 p=position-orbitCenter;float a=time*rate;
p=p*cos(a)+cross(orbitAxis,p)*sin(a)+orbitAxis*dot(orbitAxis,p)*(1.0-cos(a))+orbitCenter;
vec4 v=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*v;
gl_PointSize=clamp(starSize*pixelRatio*12.0/max(1.0,-v.z),.65,mix(9.0,45.0,soft)*pixelRatio);
alpha=strength*(.96+.04*sin(time*.35+phase));}`;
const POINT_FRAGMENT=`
uniform float presence,soft;
varying float alpha;
void main(){vec2 p=gl_PointCoord-.5;float d=length(p);
float core=exp(-d*d*27.0)*(1.0-smoothstep(.35,.5,d));
float cross=.15*(exp(-abs(p.x)*100.0-abs(p.y)*9.0)+exp(-abs(p.y)*100.0-abs(p.x)*9.0));
float disc=mix(clamp(core*1.7+cross,0.0,1.0),core,soft);
if(disc*alpha*presence<.001)discard;gl_FragColor=vec4(vec3(.015),disc*alpha*presence);}`;
export function pointMaterial(scene,soft=0) {
  const material=new THREE.ShaderMaterial({vertexShader:POINT_VERTEX,fragmentShader:POINT_FRAGMENT,
    transparent:true,depthWrite:false,depthTest:true,uniforms:{...scene.uniforms,soft:{value:soft}}});
  scene.materials.add(material);return material;
}
export function random(seed){let s=seed>>>0;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
export const gaussian=rng=>Math.sqrt(-2*Math.log(Math.max(1e-9,rng())))*Math.cos(2*Math.PI*rng());

// Matching nonperiodic noise for the software-rendered fallback.
export function valueNoise(x,y,z){
  const fract=n=>n-Math.floor(n),mix=(a,b,t)=>a+(b-a)*t;
  const hash=(x,y,z)=>{x=fract(x*.3183099+.13)*17;y=fract(y*.3183099+.27)*17;z=fract(z*.3183099+.41)*17;return fract(x*y*z*(x+y+z));};
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  let fx=fract(x),fy=fract(y),fz=fract(z);fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
  return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),fx),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);
}
