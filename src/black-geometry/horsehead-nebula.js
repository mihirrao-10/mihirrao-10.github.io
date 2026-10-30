import * as THREE from 'three';
import { NOISE, valueNoise, random } from './astronomy-materials.js';

const lobes = [
  [.30,-1.72,0,.83,.83,.53], [.40,-.65,.02,.57,1.15,.46],
  [.36,.52,0,.43,1.02,.35], [-.06,1.37,0,.65,.43,.36],
  [-.73,1.17,.03,.52,.22,.25], [-.05,1.70,0,.43,.20,.27],
  [.20,1.94,0,.14,.38,.17], [.72,-.34,-.08,.30,1.47,.34],
];
function ellipsoid(x,y,z,lobe) {
  const [cx,cy,cz,a,b,c] = lobe;
  return (Math.hypot((x-cx)/a,(y-cy)/b,(z-cz)/c)-1)*Math.min(a,b,c);
}
function field(x,y,z) {
  let d = 10;
  for (const lobe of lobes) {
    const e = ellipsoid(x,y,z,lobe), h = Math.max(.22-Math.abs(d-e),0)/.22;
    d = Math.min(d,e)-h*h*.055;
  }
  const rough = .085*(valueNoise(x*6+9,y*6,z*6)-.5)+.035*(valueNoise(x*19,y*19+5,z*19)-.5);
  return d + rough;
}
let cached, dustCache;
function pillarGeometry() {
  if (!cached) {
    // A smooth implicit surface joins the trunk, neck and hooked head into one
    // spatial volume. Grid gradients keep the fine silhouette smoothly shaded.
    const nx=72,ny=128,nz=48, lo=[-1.5,-2.7,-.85], step=[3.1/(nx-1),5.25/(ny-1),1.7/(nz-1)];
    const values=new Float32Array(nx*ny*nz), index=(x,y,z)=>(y*nz+z)*nx+x;
    for(let y=0;y<ny;y++)for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)values[index(x,y,z)]=field(lo[0]+x*step[0],lo[1]+y*step[1],lo[2]+z*step[2]);
    const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    const tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]], edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    const positions=[],normals=[];
    const gradient=(x,y,z)=>new THREE.Vector3(
      (values[index(Math.min(nx-1,x+1),y,z)]-values[index(Math.max(0,x-1),y,z)])/step[0],
      (values[index(x,Math.min(ny-1,y+1),z)]-values[index(x,Math.max(0,y-1),z)])/step[1],
      (values[index(x,y,Math.min(nz-1,z+1))]-values[index(x,y,Math.max(0,z-1))])/step[2]).normalize();
    function triangle(a,b,c) {
      const face=b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p));
      if(face.lengthSq()<1e-16)return;
      if(face.dot(a.n.clone().add(b.n).add(c.n))<0)[b,c]=[c,b];
      for(const v of [a,b,c]){positions.push(...v.p);normals.push(...v.n);}
    }
    for(let y=0;y<ny-1;y++)for(let z=0;z<nz-1;z++)for(let x=0;x<nx-1;x++) {
      const grid=corners.map(([dx,dy,dz])=>[x+dx,y+dy,z+dz]), f=grid.map(([a,b,c])=>values[index(a,b,c)]);
      if(f.every(v=>v<0)||f.every(v=>v>=0))continue;
      const points=grid.map(([a,b,c])=>new THREE.Vector3(lo[0]+a*step[0],lo[1]+b*step[1],lo[2]+c*step[2]));
      const gradients=grid.map(([a,b,c])=>gradient(a,b,c));
      for(const tet of tets) {
        const cross=[];
        for(const [a,b] of edges){const i=tet[a],j=tet[b];if((f[i]<0)===(f[j]<0))continue;
          const t=f[i]/(f[i]-f[j]);cross.push({p:points[i].clone().lerp(points[j],t),n:gradients[i].clone().lerp(gradients[j],t).normalize()});}
        if(cross.length<3)continue;
        if(cross.length===4){
          const center=cross.reduce((sum,v)=>sum.add(v.p),new THREE.Vector3()).multiplyScalar(.25);
          const normal=cross.reduce((sum,v)=>sum.add(v.n),new THREE.Vector3()).normalize(),u=cross[0].p.clone().sub(center).normalize(),v=new THREE.Vector3().crossVectors(normal,u);
          cross.sort((a,b)=>Math.atan2(a.p.clone().sub(center).dot(v),a.p.clone().sub(center).dot(u))-Math.atan2(b.p.clone().sub(center).dot(v),b.p.clone().sub(center).dot(u)));
        }
        triangle(cross[0],cross[1],cross[2]);if(cross.length===4)triangle(cross[0],cross[2],cross[3]);
      }
    }
    cached={positions:new Float32Array(positions),normals:new Float32Array(normals),values,nx,ny,nz,lo,step};
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(cached.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(cached.normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(Array(cached.positions.length/3*2).fill(0),2));
  return geometry;
}

function sampledField(x,y,z) {
  const {values,nx,nz,lo,step}=cached, p=[x,y,z].map((v,i)=>(v-lo[i])/step[i]);
  const [a,b,c]=p.map(Math.floor),[u,v,w]=p.map((n,i)=>n-Math.floor(p[i]));
  const at=(i,j,k)=>values[((b+j)*nz+c+k)*nx+a+i],mix=(a,b,t)=>a+(b-a)*t;
  return mix(mix(mix(at(0,0,0),at(1,0,0),u),mix(at(0,1,0),at(1,1,0),u),v),
    mix(mix(at(0,0,1),at(1,0,1),u),mix(at(0,1,1),at(1,1,1),u),v),w);
}

export function createHorseheadNebula(scene) {
  const content=new THREE.Group();scene.root.add(content);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,uniforms:{...scene.uniforms},
    vertexShader:`varying vec3 localPosition,normalView,viewDirection;
      void main(){localPosition=position;normalView=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);viewDirection=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform float presence;varying vec3 localPosition,normalView,viewDirection;${NOISE}
      void main(){vec3 p=localPosition,n=normalize(normalView),v=normalize(viewDirection);
        float knots=fbm(p*13.0+vec3(4.0,0,9.0)),fine=noise(p*85.0);
        float flow=fbm(vec3(p.x*24.0+knots*2.0,p.y*4.0,p.z*24.0));
        float veins=smoothstep(.44,.65,flow),light=max(0.0,dot(n,normalize(vec3(-.7,.8,1.0))));
        float rim=pow(1.0-abs(dot(n,v)),1.5);
        float ink=clamp(.045+.12*knots+.075*veins+.025*fine-.05*light-.04*rim,.025,.25);
        float foot=smoothstep(-2.6,-1.9,p.y);
        gl_FragColor=vec4(vec3(.025),ink*foot*presence);}`,
  });
  scene.materials.add(material);
  const pillar=new THREE.Mesh(pillarGeometry(),material);pillar.userData={posterKind:'horsehead-nebula',role:'nebula-pillar'};content.add(pillar);
  // World-sized grains resolve individual knots without screen-sized blurry
  // sprites. Subpixel alpha compensation keeps the phone view from saturating.
  if(!dustCache){
  const rng=random(182933),positions=[],sizes=[],strength=[];
  while(sizes.length<240000){
    const x=-1.4+rng()*2.8,y=-2.65+rng()*5.1,z=-.7+rng()*1.4;
    const d=sampledField(x,y,z);if(d>0)continue;
    const knot=valueNoise(x*4+2,y*3,z*4),grain=valueNoise(x*37,y*21+4,z*37);
    const warp=valueNoise(x*3+5,y*2,z*3),flow=valueNoise(x*12+warp*3,y*3,z*12);
    const foot=THREE.MathUtils.smoothstep(y,-2.65,-1.85);if(rng()>foot)continue;
    const ridge=THREE.MathUtils.smoothstep(flow,.28,.74),clump=THREE.MathUtils.smoothstep(knot,.18,.75);
    positions.push(x,y,z);sizes.push(.010+rng()*.014);strength.push((.012+.95*ridge*ridge*clump)*(.6+.4*grain));
  }
  dustCache={positions,sizes,strength};
  }
  const {positions,sizes,strength}=dustCache;
  const geometry=new THREE.BufferGeometry();
  for(const [name,data,width] of [['position',positions,3],['starSize',sizes,1],['strength',strength,1]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,width));
  const dustMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,uniforms:{...scene.uniforms,viewportHeight:{value:900}},
    vertexShader:`attribute float starSize,strength;uniform float viewportHeight,pixelRatio;varying float alpha;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;
        float size=starSize*length(modelViewMatrix[0].xyz)*viewportHeight*.5*projectionMatrix[1][1]/max(1.0,-p.z);
        float minimum=.65*pixelRatio;gl_PointSize=max(minimum,size);alpha=strength*min(1.0,size*size/(minimum*minimum));}`,
    fragmentShader:`uniform float presence;varying float alpha;
      void main(){float d=length(gl_PointCoord-.5);float grain=exp(-d*d*18.0)*(1.0-smoothstep(.35,.5,d));
      gl_FragColor=vec4(vec3(.025),grain*alpha*presence);}`,
  });
  scene.materials.add(dustMaterial);
  const dust=new THREE.Points(geometry,dustMaterial),viewport=new THREE.Vector2();
  dust.onBeforeRender=renderer=>{dustMaterial.uniforms.viewportHeight.value=renderer.getDrawingBufferSize(viewport).y;};
  dust.userData={posterKind:'stars',posterSoft:1,posterWorldSize:true,role:'nebula-dust'};dust.renderOrder=1;dust.frustumCulled=false;content.add(dust);
  scene.animate=time=>content.rotation.set(.08+Math.sin(time*.025)*.025,-.12+Math.sin(time*.035)*.12,-.20);
  scene.theme='Nebula';scene.volumeKind='horsehead-pillar';scene.radius=3.15;
}
