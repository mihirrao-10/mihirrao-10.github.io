import * as THREE from 'three';

export const COSMIC_TARGETS = Object.freeze(['hero', 'education', 'experience', 'publications', 'teaching', 'projects', 'notes']);
const TAU = Math.PI * 2;
const SHELL_VERTEX = `
attribute vec3 barycentric;
varying vec3 vBarycentric;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
void main(){
  vBarycentric=barycentric; vLocal=position;
  vNormal=normalize(normalMatrix*normal);
  vec4 p=modelViewMatrix*vec4(position,1.0);
  vView=-p.xyz; gl_Position=projectionMatrix*p;
}`;
const SHELL_FRAGMENT = `
uniform float presence;
uniform float lineOpacity;
uniform float fillOpacity;
uniform float textureFlow;
uniform float time;
varying vec3 vBarycentric;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
void main(){
  vec3 width=max(fwidth(vBarycentric),vec3(.00001));
  vec3 lines=smoothstep(vec3(0.0),width*.55,vBarycentric);
  float edge=1.0-min(min(lines.x,lines.y),lines.z);
  edge*=smoothstep(.45,1.6,1.0/max(max(width.x,width.y),width.z));
  float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.0);
  float r=length(vLocal.xz),a=atan(vLocal.z,vLocal.x);
  float veins=.5+.5*sin(r*108.0+a*9.0+sin(a*17.0-r*16.0-time*.16)*1.8);
  float texture=mix(1.0,.42+.58*veins,textureFlow);
  float alpha=(fillOpacity*(.6+.4*rim)*texture+lineOpacity*edge*(.6+.4*rim))*presence;
  if(alpha<.001)discard;
  gl_FragColor=vec4(vec3(mix(.07,.02,edge)),alpha);
  #include <colorspace_fragment>
}`;
const STAR_VERTEX = `
attribute float starSize;
attribute float phase;
attribute float rate;
attribute float strength;
uniform float time;
uniform float pixelRatio;
uniform float flow;
uniform float soft;
varying float vAlpha;
void main(){
  vec3 p=position;
  if(flow>1.5){
    float f=fract((abs(p.y)-.7+time*.2)/2.35);
    p.y=sign(p.y)*(.7+2.35*f);
  }else{
    float a=time*rate;
    p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
  }
  vec4 view=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*view;
  gl_PointSize=clamp(starSize*pixelRatio*12.0/max(1.0,-view.z),.85,mix(7.0,44.0,soft)*pixelRatio);
  vAlpha=strength*(.92+.08*sin(time*.35+phase));
}`;
const STAR_FRAGMENT = `
uniform float presence;
uniform float soft;
varying float vAlpha;
void main(){
  float d=length(gl_PointCoord-.5);
  float disc=mix(1.0-smoothstep(.08,.5,d),exp(-d*d*22.0)*(1.0-smoothstep(.38,.5,d)),soft);
  float alpha=disc*vAlpha*presence;
  if(alpha<.001)discard;
  gl_FragColor=vec4(vec3(.035),alpha);
  #include <colorspace_fragment>
}`;

function random(seed) {
  let state=seed>>>0;
  return () => { state^=state<<13; state^=state>>>17; state^=state<<5; return (state>>>0)/4294967296; };
}
const normal = rng => Math.sqrt(-2*Math.log(Math.max(1e-9,rng())))*Math.cos(TAU*rng());
function grid(point,columns=256,rows=12) {
  const positions=[],indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
    positions.push(...point(i/columns,j/rows));
    if(i&&j){const d=j*(columns+1)+i,c=d-1,b=d-columns-1,a=b-1;indices.push(a,c,d,a,d,b);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function shell(scene,parent,geometry,line=.24,fill=.018,textureFlow=0) {
  const flat=geometry.index?geometry.toNonIndexed():geometry;
  if(flat!==geometry)geometry.dispose();
  const count=flat.attributes.position.count,barycentric=new Float32Array(count*3);
  for(let i=0;i<count;i++)barycentric[i*3+i%3]=1;
  flat.setAttribute('barycentric',new THREE.BufferAttribute(barycentric,3));
  const material=new THREE.ShaderMaterial({
    vertexShader:SHELL_VERTEX,fragmentShader:SHELL_FRAGMENT,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:false,forceSinglePass:true,
    uniforms:{...scene.uniforms,lineOpacity:{value:line},fillOpacity:{value:fill},textureFlow:{value:textureFlow}},
  });
  const mesh=new THREE.Mesh(flat,material);
  mesh.userData.posterLine=line;mesh.userData.posterFill=fill;
  parent.add(mesh);scene.materials.add(material);return mesh;
}
function globe(scene,parent,radius,detail=96,line=.23,fill=.025) {
  return shell(scene,parent,new THREE.SphereGeometry(radius,detail,Math.round(detail*.65)),line,fill);
}
function stars(scene,parent,count,seed,sample,{flow=0,soft=0}={}) {
  const rng=random(seed),data={position:[],starSize:[],phase:[],rate:[],strength:[]};
  for(let i=0;i<count;i++){
    const star=sample(rng,i);
    data.position.push(...star.position);data.starSize.push(star.size??.65+rng()*1.2);
    data.phase.push(rng()*TAU);data.rate.push(star.rate??0);data.strength.push(star.strength??.22+rng()*.35);
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,values]of Object.entries(data))geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,name==='position'?3:1));
  const material=new THREE.ShaderMaterial({
    vertexShader:STAR_VERTEX,fragmentShader:STAR_FRAGMENT,transparent:true,depthWrite:false,depthTest:false,
    uniforms:{...scene.uniforms,flow:{value:flow},soft:{value:soft}},
  });
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;
  points.userData.posterSoft=soft;parent.add(points);scene.materials.add(material);return points;
}
function spherePoint(rng,radius,flatten=1) {
  const a=rng()*TAU,z=2*rng()-1,s=Math.sqrt(1-z*z);
  return [radius*s*Math.cos(a),radius*z*flatten,radius*s*Math.sin(a)];
}
function orbitTrace(scene,parent,radius,inclination=0) {
  const band=shell(scene,parent,grid((u,v)=>{
    const a=u*TAU,r=radius+(v-.5)*.012;return [r*Math.cos(a),0,r*Math.sin(a)];
  },384,1),.30,0);
  band.rotation.x=inclination;return band;
}

function lensedQuasar(scene) {
  const content=new THREE.Group();scene.root.add(content);content.rotation.z=-.12;
  const disk=new THREE.Group();content.add(disk);
  for(let layer=0;layer<2;layer++)shell(scene,disk,grid((u,v)=>{
    const a=u*TAU,r=1.05+v*2.1;
    return [r*Math.cos(a),.025*Math.sin(a*8+v*18)+layer*.025,r*Math.sin(a)];
  },640,28),.20,.11,1);
  // The upright annulus evokes the far disk lensed over Gargantua's shadow.
  const halo=new THREE.Group();content.add(halo);halo.rotation.y=.18;
  shell(scene,halo,grid((u,v)=>{
    const a=u*TAU,r=1.01+v*.52;
    return [r*Math.cos(a),r*Math.sin(a),-.12+.04*Math.sin(a*6+v*8)];
  },640,28),.20,.13,1);
  const rim=shell(scene,halo,new THREE.TorusGeometry(1.015,.016,8,512),.28,.03);
  rim.renderOrder=1;
  stars(scene,disk,6500,17139,rng=>{
    const r=1.05+2.12*rng()**1.6,a=rng()*TAU;
    return {position:[r*Math.cos(a),normal(rng)*.022,r*Math.sin(a)],rate:.026/(r**1.3),size:.55+rng(),strength:.25+rng()*.35};
  });
  // A clear event-horizon silhouette preserves the opening at every rotation.
  const shadow=new THREE.Mesh(new THREE.SphereGeometry(.97,96,64),new THREE.MeshBasicMaterial({color:0xf5f2eb,transparent:true,depthTest:false,depthWrite:false}));
  shadow.renderOrder=2;content.add(shadow);scene.materials.add(shadow.material);
  shadow.userData.posterMask=true;
  const foreground=shell(scene,content,grid((u,v)=>{
    const a=u*Math.PI,r=1.05+v*2.1;
    return [r*Math.cos(a),-.018+.012*Math.sin(a*8+v*18),r*Math.sin(a)];
  },512,16),.20,.10,1);
  foreground.renderOrder=3;
  scene.animate=time=>{disk.rotation.y=time*.012;shadow.material.opacity=scene.uniforms.presence.value;};
  scene.theme='Lensed quasar';scene.radius=3.3;
}
function orbitalSystem(scene) {
  const content=new THREE.Group();scene.root.add(content);content.rotation.set(.42,.1,-.3);
  const primary=new THREE.Group();primary.position.x=-.35;content.add(primary);
  globe(scene,primary,1.03,144,.27,.025);
  // Fine latitude belts give the globe a gaseous, layered surface.
  for(const latitude of [-.55,-.3,.05,.3,.55])shell(scene,primary,grid((u,v)=>{
    const a=u*TAU,y=latitude+(v-.5)*.034,r=Math.sqrt(1.065-y*y);
    return [r*Math.cos(a),y,r*Math.sin(a)];
  },384,2),.18,.012);
  const rings=new THREE.Group();rings.rotation.set(.15,0,.28);primary.add(rings);
  for(const [inner,outer]of [[1.28,1.48],[1.52,1.88],[1.96,2.1]])shell(scene,rings,grid((u,v)=>{
    const a=u*TAU,r=inner+(outer-inner)*v;return [r*Math.cos(a),.012*Math.sin(a*9+v*5),r*Math.sin(a)];
  },512,12),.21,.012,1);
  stars(scene,rings,3800,19373,rng=>{
    const a=rng()*TAU,r=1.28+rng()*.82;return {position:[r*Math.cos(a),normal(rng)*.014,r*Math.sin(a)],rate:.022/r,size:.65+rng()*.7};
  });
  const moons=[[2.7,.31,.12,.55],[2.3,.16,-.65,3.4],[1.65,.095,.95,1.8]].map(([radius,size,inclination,phase],i)=>{
    const orbit=new THREE.Group();orbit.rotation.x=inclination;content.add(orbit);orbitTrace(scene,orbit,radius);
    return {moon:globe(scene,orbit,size,i?48:80),radius,phase,speed:[.085,.14,.21][i]};
  });
  scene.animate=time=>{
    rings.rotation.y=time*.01;primary.rotation.y=time*.02;
    for(const m of moons){const a=m.phase+time*m.speed;m.moon.position.set(m.radius*Math.cos(a),0,m.radius*Math.sin(a));m.moon.rotation.y=time*.05;}
  };
  scene.theme='Ringed worlds';scene.radius=3.35;
}
function neutronBinary(scene) {
  const content=new THREE.Group();content.rotation.set(.45,.1,-.28);scene.root.add(content);
  const pair=new THREE.Group();content.add(pair);
  const bodies=[-1,1].map((sign,i)=>{
    const body=new THREE.Group();body.position.x=sign*1.15;pair.add(body);
    globe(scene,body,i?.34:.43,112,.29,.08);
    for(let loop=0;loop<8;loop++){
      const field=shell(scene,body,grid((u,v)=>{
        const a=u*TAU,r=.86+.035*(v-.5),shape=.65+.35*Math.sin(a)**2;
        return [r*Math.cos(a)*shape,r*Math.sin(a),.012*Math.sin(a*3)];
      },320,2),.22,.002);
      field.rotation.y=loop*Math.PI/8;field.scale.set(1.05,1.45,1.05);
    }
    stars(scene,body,1800,8527+i,rng=>({position:spherePoint(rng,.45+rng()*.12),strength:.18+rng()*.2,size:.6+rng()}));
    return body;
  });
  orbitTrace(scene,content,1.15);
  for(const sign of [-1,1])shell(scene,content,grid((u,v)=>{
    const a=u*TAU,r=.035+.12*v;return [r*Math.cos(a),sign*(.8+v*2.05),r*Math.sin(a)];
  },40,96),.16,.012);
  scene.animate=time=>{pair.rotation.y=time*.09;bodies.forEach((body,i)=>body.rotation.set(.25,time*(i?-.07:.07),.16));};
  scene.theme='Binary neutron stars';scene.radius=3.2;
}
function galaxy(scene) {
  const content=new THREE.Group();content.rotation.set(.85,.05,-.25);scene.root.add(content);
  const arms=new THREE.Group();content.add(arms);
  for(let arm=0;arm<2;arm++)shell(scene,arms,grid((u,v)=>{
    const r=.36+2.8*u,a=arm*Math.PI+3.3*Math.log(1+4.6*u)+(v-.5)*(.5+.2*u);
    return [r*Math.cos(a),.045*Math.sin(a*3)*u+(v-.5)*.08,r*Math.sin(a)];
  },512,20),.14,.009);
  stars(scene,content,24000,60827,(rng,i)=>{
    const u=rng()**.65,r=.28+2.9*u,arm=i%2;
    const a=arm*Math.PI+3.3*Math.log(1+4.6*u)+normal(rng)*(.13+.1*u);
    return {position:[r*Math.cos(a),normal(rng)*(.038+.1*(1-u)),r*Math.sin(a)],rate:.012,size:.55+rng()*1.4,strength:.18+rng()*.38};
  });
  // The inverted luminance peaks in the dense central bulge and fades outward.
  stars(scene,content,7200,91283,rng=>{
    const r=Math.min(1.45,-Math.log(Math.max(1e-9,rng()))*.36);
    return {position:spherePoint(rng,r,.55),rate:.012,size:.65+rng()*1.25,strength:.23+rng()*.32};
  });
  stars(scene,content,1200,53799,rng=>({position:spherePoint(rng,1.15*rng()**.65,.36),rate:.012,size:10+rng()*15,strength:.028}),{soft:1});
  stars(scene,content,1200,63241,(rng,i)=>{
    const u=rng()**.65,r=.35+2.75*u,a=(i%2)*Math.PI+3.3*Math.log(1+4.6*u)+normal(rng)*.2;
    return {position:[r*Math.cos(a),normal(rng)*.055,r*Math.sin(a)],rate:.012,size:6+rng()*9,strength:.024};
  },{soft:1});
  stars(scene,content,1400,75127,(rng,i)=>{
    const u=.1+rng()*.8,r=.35+2.75*u,a=(i%2)*Math.PI+3.3*Math.log(1+4.6*u)+.6+normal(rng)*.21;
    return {position:[r*Math.cos(a),normal(rng)*.06,r*Math.sin(a)],rate:.012,size:.6+rng(),strength:.12+rng()*.16};
  });
  stars(scene,content,1400,83287,rng=>{
    const r=.5+2.55*rng(),a=rng()*TAU;return {position:[r*Math.cos(a),normal(rng)*.12,r*Math.sin(a)],size:.6+rng(),strength:.10+rng()*.15,rate:.012};
  });
  scene.animate=time=>{arms.rotation.y=time*.012;};
  scene.theme='Spiral galaxy';scene.radius=3.3;
}
function stellarCluster(scene) {
  const content=new THREE.Group();content.rotation.z=.2;scene.root.add(content);
  stars(scene,content,18000,66327,rng=>{
    const r=2.8*rng()**1.6;return {position:spherePoint(rng,r,.86),rate:.012,size:.5+rng()*1.7,strength:.18+rng()*.45};
  });
  stars(scene,content,850,91333,rng=>({position:spherePoint(rng,1.7*rng()**1.8,.8),rate:.012,size:8+rng()*16,strength:.035}),{soft:1});
  const core=globe(scene,content,.32,112,.14,.025);
  for(let i=0;i<5;i++){
    const orbit=orbitTrace(scene,content,1.15+i*.3,i*.7);orbit.rotation.z=i*.45;orbit.material.uniforms.lineOpacity.value=.16;
  }
  scene.animate=time=>{core.rotation.y=time*.04;content.rotation.y=time*.012;};
  scene.theme='Globular star cluster';scene.radius=3.15;
}
function pulsar(scene) {
  const content=new THREE.Group();content.rotation.set(.25,.1,-.6);scene.root.add(content);
  globe(scene,content,.58,144,.24,.06);
  for(let i=0;i<12;i++){
    const field=shell(scene,content,grid((u,v)=>{
      const a=u*TAU,r=1.1+(v-.5)*.035;
      return [r*Math.cos(a)*(.7+.3*Math.sin(a)**2),r*Math.sin(a)*1.9,.02*Math.sin(a*4)];
    },384,3),.19,.003);
    field.rotation.y=i*Math.PI/12;
  }
  for(const sign of [-1,1])shell(scene,content,grid((u,v)=>{
    const a=u*TAU,r=.04+.22*v*v;return [r*Math.cos(a),sign*(.55+v*2.3),r*Math.sin(a)];
  },64,96),.17,.016);
  stars(scene,content,3200,53319,rng=>({position:spherePoint(rng,.6+rng()*.12),size:.55+rng(),strength:.23+rng()*.3}));
  scene.animate=time=>{content.rotation.y=time*.024;};
  scene.theme='Pulsar and magnetic field';scene.radius=3.05;
}
function nebula(scene) {
  const content=new THREE.Group();content.rotation.set(.3,.1,-.3);scene.root.add(content);
  const veils=[];
  for(let layer=0;layer<4;layer++){
    const veil=shell(scene,content,grid((u,v)=>{
      const a=u*TAU,b=(v-.5)*Math.PI,r=1.48+.23*Math.sin(a*5+b*3+layer*.8)+.15*Math.sin(a*9-b*4);
      const s=Math.cos(b),spread=1+layer*.11;
      return [r*s*Math.cos(a)*spread,r*Math.sin(b)*(.65+layer*.11),r*s*Math.sin(a)*spread];
    },256,40),.15,.006);
    veil.rotation.set(layer*.36,layer*.45,layer*.18);veils.push(veil);
  }
  stars(scene,content,4200,98631,rng=>({position:spherePoint(rng,2.55*rng()**.5),size:.55+rng()*1.3,strength:.17+rng()*.3}));
  globe(scene,content,.18,80,.24,.09);
  scene.animate=time=>veils.forEach((veil,i)=>{veil.rotation.y=i*.45+time*(i%2?-.008:.008);});
  scene.theme='Stellar nebula';scene.radius=3.1;
}
export function createCosmos(name) {
  const factory={hero:lensedQuasar,education:orbitalSystem,experience:neutronBinary,publications:pulsar,teaching:stellarCluster,projects:galaxy,notes:nebula}[name];
  if(!factory)throw new Error(`Unknown cosmic scene: ${name}`);
  const scene={root:new THREE.Group(),materials:new Set(),uniforms:{time:{value:0},presence:{value:1},pixelRatio:{value:1}}};
  factory(scene);scene.bounds=[{center:[0,0,0],radius:scene.radius}];scene.root.name=`cosmos-${name}`;
  scene.update=(time=0,presence=1,pixelRatio=1)=>{
    scene.uniforms.time.value=time;scene.uniforms.presence.value=presence;scene.uniforms.pixelRatio.value=pixelRatio;
    scene.animate(time);scene.root.updateMatrixWorld(true);
  };
  scene.dispose=()=>{const geometries=new Set();scene.root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);});geometries.forEach(g=>g.dispose());scene.materials.forEach(m=>m.dispose());};
  scene.update();return scene;
}
