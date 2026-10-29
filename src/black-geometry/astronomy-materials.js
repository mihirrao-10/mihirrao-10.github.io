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
uniform float time,presence,kind,opacity,meshDensity;
uniform sampler2D surfaceMap;
varying vec2 vUv;varying vec3 vNormal,vLocal,vView;
${NOISE}
void main(){
 vec3 n=normalize(vNormal);float facing=abs(dot(n,normalize(vView)));
 float light=.30+.70*max(0.0,dot(n,normalize(vec3(-.65,.45,.9))));
 float sampleMap=texture2D(surfaceMap,vec2(vUv.x,1.0-vUv.y)).r;
 float grain=fbm(vLocal*28.0+vec3(time*.005,0,0));
 float density=.18+.82*smoothstep(.10,.65,sampleMap);
 if(kind>0.5&&kind<1.5)density=.33+.6*sampleMap+.1*grain;
 if(kind>1.5&&kind<2.5){
   float bands=.5+.5*sin(vLocal.y*58.0+fbm(vLocal*7.0)*3.5);
   density=.38+.28*bands+.22*fbm(vLocal*38.0);}
 if(kind>2.5&&kind<3.5){
   vec3 p=normalize(vLocal)*45.0;
   float cells=fbm(p+vec3(fbm(p*1.7),time*.008,0));
   float spots=smoothstep(.55,.74,fbm(normalize(vLocal)*8.0));
   density=.38+.45*cells+.2*spots;light=.9+.1*facing;}
 if(kind>3.5&&kind<4.5)density=.35+.38*grain;
 if(kind>4.5&&kind<5.5){
   float clouds=smoothstep(.49,.68,fbm(normalize(vLocal)*9.0+vec3(time*.006,0,0)));
   float alpha=clouds*opacity*presence*(.35+.65*facing);
   gl_FragColor=vec4(vec3(.08),alpha);return;}
 if(kind>5.5&&kind<6.5){
   float rim=pow(1.0-facing,4.0);gl_FragColor=vec4(vec3(.06),rim*opacity*presence);return;}
 vec2 cell=vUv*vec2(meshDensity,meshDensity*.5),f=fract(cell),w=max(fwidth(cell),vec2(.0001));
 float edge=min(min(f.x,1.0-f.x)/w.x,min(f.y,1.0-f.y)/w.y);
 float diagonal=abs(f.x-f.y)/max(w.x+w.y,.0001);
 float wire=1.0-smoothstep(.15,.65,min(edge,diagonal));
 wire*=smoothstep(.65,2.0,1.0/max(w.x,w.y));
 float ink=opacity*(density*light+mix(.16,.24,step(.5,kind))*wire+.09*pow(1.0-facing,3.0));
 gl_FragColor=vec4(vec3(.025),clamp(ink,0.0,.94)*presence);
}`;
export function surfaceMaterial(scene,kind=0,map=null,{opacity=1,detail=256,depthWrite=true}={}) {
  const fallback=new THREE.DataTexture(new Uint8Array([128]),1,1,THREE.RedFormat);fallback.needsUpdate=true;
  if(!map){map=fallback;scene.textures.add(fallback);}else fallback.dispose();
  const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,
    side:THREE.FrontSide,transparent:true,depthWrite,depthTest:true,
    uniforms:{...scene.uniforms,kind:{value:kind},opacity:{value:opacity},meshDensity:{value:detail},surfaceMap:{value:map}}});
  material.userData.bodyDepth=depthWrite;scene.materials.add(material);return material;
}
const RING_FRAGMENT=`
uniform float time,presence,innerRadius,outerRadius,opacity;
varying vec2 vUv;varying vec3 vNormal,vLocal,vView;
${NOISE}
void main(){
 float r=length(vLocal.xz),u=(r-innerRadius)/(outerRadius-innerRadius);
 float a=atan(vLocal.z,vLocal.x);
 float gap=1.0-smoothstep(.007,.014,abs(u-.63));
 float fine=.5+.5*sin(r*1250.0+noise(vec3(r*31.0,0,0))*12.0);
 float bands=.5+.5*sin(r*134.0+sin(r*37.0)*4.0);
 float fade=smoothstep(0.0,.025,u)*(1.0-smoothstep(.96,1.0,u));
 float density=(.25+.42*bands+.28*fine)*(1.0-gap*.96);
 density*=1.0-.8*exp(-pow((u-.87)/.006,2.0));
 float lighting=.75+.25*cos(a-.6);
 gl_FragColor=vec4(vec3(.025),density*lighting*fade*opacity*presence);
}`;
export function ringMaterial(scene,inner,outer,opacity=.9) {
  const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:RING_FRAGMENT,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,innerRadius:{value:inner},outerRadius:{value:outer},opacity:{value:opacity}}});
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
