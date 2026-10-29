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
 if(kind>2.5&&kind<3.5)mapUv.x+=.003*sin(time*.12+vUv.y*19.0);
 float sampleMap=texture2D(surfaceMap,mapUv).r;
 float grain=fbm(vLocal*28.0+vec3(time*.005,0,0));
 float density=.18+.82*smoothstep(.10,.65,sampleMap);
 if(kind>0.5&&kind<1.5)density=.33+.6*sampleMap+.1*grain;
 if(kind>1.5&&kind<2.5){
   float bands=mix(fbm(vec3(vLocal.y*18.0,0,0)),sampleMap,hasSurfaceMap);
   density=.40+.32*bands+.10*fbm(vLocal*32.0+vec3(time*.025,0,0));}
 if(kind>2.5&&kind<3.5){
   vec3 p=normalize(vLocal)*45.0;
   float cells=fbm(p+vec3(fbm(p*1.7),time*.065,0));
   float activity=mix(cells,sampleMap,hasSurfaceMap);
   density=.16+.70*activity+.12*cells;light=.94+.06*facing;}
 if(kind>3.5&&kind<4.5)density=.35+.38*grain;
 if(kind>4.5&&kind<5.5){
   float clouds=smoothstep(.49,.68,fbm(normalize(vLocal)*9.0+vec3(time*.006,0,0)));
   float alpha=clouds*opacity*presence*(.35+.65*facing);
   gl_FragColor=vec4(vec3(.08),alpha);return;}
 if(kind>5.5&&kind<6.5){
   float rim=pow(1.0-facing,4.0);gl_FragColor=vec4(vec3(.06),rim*opacity*presence);return;}
 if(kind>6.5){
   float d=sqrt(max(0.0,1.0-facing*facing));
   float shell=smoothstep(.62,.70,d)*(1.0-smoothstep(.84,1.0,d));
   vec3 p=normalize(vLocal);
   float stream=pow(fbm(p*15.0+vec3(time*.025,0,0)),2.0);
   float falloff=exp(-max(0.0,d-.69)*8.0);
   gl_FragColor=vec4(vec3(.02),shell*stream*falloff*opacity*presence);return;}
 vec2 cell=vUv*vec2(meshDensity,meshDensity*.5),f=fract(cell),w=max(fwidth(cell),vec2(.0001));
 float edge=min(min(f.x,1.0-f.x)/w.x,min(f.y,1.0-f.y)/w.y);
 float diagonal=abs(f.x-f.y)/max(w.x+w.y,.0001);
 float wire=1.0-smoothstep(.15,.65,min(edge,diagonal));
 wire*=smoothstep(.65,2.0,1.0/max(w.x,w.y));
 float wireInk=kind>2.5&&kind<3.5?.05:mix(.16,.24,step(.5,kind));
 float ink=opacity*(density*light+wireInk*wire+.09*pow(1.0-facing,3.0));
 gl_FragColor=vec4(vec3(.025),clamp(ink,0.0,.94)*presence);
}`;
export function surfaceMaterial(scene,kind=0,map=null,{opacity=1,detail=256,depthWrite=true}={}) {
  const hasSurfaceMap=map?1:0;
  const fallback=new THREE.DataTexture(new Uint8Array([128]),1,1,THREE.RedFormat);fallback.needsUpdate=true;
  if(!map){map=fallback;scene.textures.add(fallback);}else fallback.dispose();
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
 float a=atan(vLocal.z,vLocal.x);
 // Mipmapped aperiodic optical depth avoids moving interference fringes.
 float bands=texture2D(ringProfile,vec2(u,.5)).r;
 vec2 flow=vec2(cos(a-time*.055/pow(max(r,1.0),1.5)),sin(a-time*.055/pow(max(r,1.0),1.5)));
 float grain=noise(vec3(flow*r*45.0,r*18.0));
 float fade=smoothstep(0.0,.025,u)*(1.0-smoothstep(.96,1.0,u));
 float density=bands*(.86+.14*grain);
 gl_FragColor=vec4(vec3(.025),density*fade*opacity*presence);
}`;
export function ringMaterial(scene,inner,outer,opacity=.9,map=null) {
  if(!map){
    const pixels=new Uint8Array(256);
    for(let i=0;i<256;i++){const u=i/255;pixels[i]=Math.round(180*(1-.95*Math.exp(-(((u-.645)/.015)**4))));}
    map=new THREE.DataTexture(pixels,256,1,THREE.RedFormat);map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;scene.textures.add(map);
    map.userData={width:256,height:1,pixels};
  }
  const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:RING_FRAGMENT,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,innerRadius:{value:inner},outerRadius:{value:outer},opacity:{value:opacity},ringProfile:{value:map}}});
  scene.materials.add(material);return material;
}

export function fieldMaterial(scene,map,opacity=.7){
  const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:`
    uniform sampler2D surfaceMap;uniform float time,presence,opacity;
    varying vec2 vUv;varying vec3 vLocal;
    ${NOISE}
    void main(){float light=texture2D(surfaceMap,vUv).r;
      float flow=.94+.06*fbm(vec3(vUv*90.0,time*.04));
      gl_FragColor=vec4(vec3(.015),pow(light,.85)*opacity*flow*presence);}`,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,surfaceMap:{value:map},opacity:{value:opacity}}});
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
uniform float time,pixelRatio,soft;
varying float alpha;
void main(){vec3 p=position;float a=time*rate;p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
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
