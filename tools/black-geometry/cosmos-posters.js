import * as THREE from 'three';
import { deflateSync } from 'node:zlib';
import { traceBlackHole } from '../../src/black-geometry/black-hole.js';
import { sampleRingProfile } from '../../src/black-geometry/ring-profile.js';
import { valueNoise } from '../../src/black-geometry/astronomy-materials.js';

function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return out;}
function png(width,height,pixels){
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)pixels.copy(rows,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const grain=(x,y,z)=>.62*valueNoise(x*28,y*28,z*28)+.27*valueNoise(x*57+7,y*57+3,z*57+1)+.11*valueNoise(x*116+2,y*116+8,z*116+6);
function mapSample(texture,u,v){
  const data=texture?.userData;if(!data?.pixels)return .5;
  const x=Math.floor(((u%1+1)%1)*(data.width-1)),y=Math.floor(clamp(1-v)*(data.height-1));return data.pixels[y*data.width+x]/255;
}
function surfaceInk(object,u,v,x,y,z,nx,ny,nz){
  const material=object.material,kind=object.userData.surfaceKind,opacity=material.uniforms.opacity.value;
  const light=.30+.70*Math.max(0,(-.65*nx+.45*ny+.9*nz)/1.1979);
  const sample=mapSample(material.uniforms.surfaceMap.value,u,v),g=grain(x,y,z);
  if(kind===5)return Math.max(0,(grain(x*.4,y*.4,z*.4)-.48)*2)*opacity;
  if(kind===6)return (1-Math.abs(nz))**4*opacity;
  if(kind===7){const d=Math.sqrt(Math.max(0,1-nz*nz));return d>.65&&d<1?Math.max(0,1-Math.abs(d-.73)*5)*g*g*.12*opacity:0;}
  let density=.40+.52*sample;
  if(kind===1)density=.33+.6*sample+.1*g;
  if(kind===2)density=.20+.73*(1-sample)+.055*g;
  if(kind===3){
    const activity=.69+.58*(sample-.5)+.56*(g-.5);
    return clamp(opacity*clamp(activity,.22,.90)*(.15+.85*Math.abs(nz)**.62),0,.94);
  }
  if(kind===4)density=.35+.38*g;
  if(kind===8)density=.49+.38*g+.25*Math.abs(y/Math.hypot(x,y,z))**9;
  if(kind===9)return Math.max(0,g-.38)*opacity*.45;
  return clamp(opacity*(density*(kind===3||kind===8?.98:light)+.08),0,.94);
}

function monolithAlpha(nx,ny,nz,x,y,z){
  const length=Math.hypot(x,y,12-z),vx=-x/length,vy=-y/length,vz=(12-z)/length;
  const dot=Math.max(0,nx*vx+ny*vy+nz*vz),rx=-vx+2*dot*nx;
  const lx=-.7/Math.sqrt(2.13),ly=.8/Math.sqrt(2.13),lz=1/Math.sqrt(2.13);
  const diffuse=Math.max(0,nx*lx+ny*ly+nz*lz),hy=vy+ly,hx=vx+lx,hz=vz+lz;
  const spec=Math.max(0,(nx*hx+ny*hy+nz*hz)/Math.hypot(hx,hy,hz))**90;
  const ry=-vy+2*dot*ny,strip=Math.exp(-(((rx+.78)/.035)**4))*(.62+.38*THREE.MathUtils.smoothstep(ry,-.8,.8));
  const other=Math.exp(-(((rx-.65)/.10)**4))*.45;
  return 1-(.012+.035*diffuse+.38*strip+.18*other+.22*spec+.10*(1-dot)**4)/.975;
}

// A small deterministic software renderer keeps the fallback detailed without
// shipping megabytes of triangle paths. It uses the live geometry and maps.
export function cosmicPoster(scene){
  scene.update(0);const blackHole=scene.renderMode==='bent-ray-accretion';
  const width=1600,height=1200;
  const pixels=Buffer.alloc(width*height*4),depth=new Float32Array(width*height).fill(-Infinity);
  const view=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.14,-.18,0));
  const focal=height/(2*Math.tan(35*Math.PI/360)),scale=3.14/scene.radius;
  const scaleMatrix=new THREE.Matrix4().makeScale(scale,scale,scale);
  const point=new THREE.Vector3(),normal=new THREE.Vector3();
  const blend=(x,y,z,alpha,write=false)=>{
    if(x<0||x>=width||y<0||y>=height||alpha<.001)return;
    const index=y*width+x;if(z<depth[index]-.001)return;
    const at=index*4,old=pixels[at+3]/255,next=alpha+old*(1-alpha);
    pixels[at]=pixels[at+1]=pixels[at+2]=6;pixels[at+3]=Math.round(clamp(next)*255);
    if(write)depth[index]=z;
  };
  const project=(position,i,matrix)=>{
    point.fromBufferAttribute(position,i).applyMatrix4(matrix);
    return [width*.5+point.x/(12-point.z)*focal,height*.5-point.y/(12-point.z)*focal,point.z];
  };
  if(blackHole){
    let volume;scene.root.traverse(o=>{if(o.userData.posterKind==='black-hole')volume=o;});
    const inverse=new THREE.Matrix4().multiplyMatrices(view,new THREE.Matrix4().multiplyMatrices(scaleMatrix,volume.matrixWorld)).invert();
    const origin=new THREE.Vector3(0,0,12).applyMatrix4(inverse),direction=new THREE.Vector3();
    let xmin=0,xmax=width-1,ymin=0,ymax=height-1;
    for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
      direction.set((x+.5-width*.5)/focal,(height*.5-y-.5)/focal,-1).normalize().transformDirection(inverse);
      const b=origin.dot(direction),c=origin.lengthSq()-3.3**2,discriminant=b*b-c;
      if(discriminant<=0)continue;
      const distance=-b-Math.sqrt(discriminant),p=origin.clone().addScaledVector(direction,distance+.001);
      const ink=traceBlackHole(p.x,p.y,p.z,direction.x,direction.y,direction.z);
      blend(x,y,0,ink);
    }
  }
  if(!blackHole){
    const objects=[];scene.root.traverse(o=>{if(o.geometry)objects.push(o);});objects.sort((a,b)=>a.renderOrder-b.renderOrder);
    for(const object of objects){
      const geometry=object.geometry,positions=geometry.attributes.position;
      let matrix=new THREE.Matrix4().multiplyMatrices(view,new THREE.Matrix4().multiplyMatrices(scaleMatrix,object.matrixWorld));
      if(['event-horizon','photon-rim'].includes(object.userData.posterKind))matrix=scaleMatrix.clone();
      const localCamera=new THREE.Vector3(0,0,12).applyMatrix4(matrix.clone().invert());
      const projected=new Float32Array(positions.count*3);
      for(let i=0;i<positions.count;i++)projected.set(project(positions,i,matrix),i*3);
      if(object.isMesh){
        const normals=geometry.attributes.normal,uv=geometry.attributes.uv,index=geometry.index;
        const normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),count=index?index.count:positions.count;
        for(let at=0;at<count;at+=3){
          const ids=[0,1,2].map(k=>index?index.getX(at+k):at+k),a=ids[0]*3,b=ids[1]*3,c=ids[2]*3;
          const ax=projected[a],ay=projected[a+1],az=projected[a+2],bx=projected[b],by=projected[b+1],bz=projected[b+2],cx=projected[c],cy=projected[c+1],cz=projected[c+2];
          const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<.00001)continue;
          normal.set(0,0,0);for(const id of ids){point.fromBufferAttribute(normals,id);normal.add(point);}normal.normalize().applyMatrix3(normalMatrix).normalize();
          if(object.material.side===THREE.FrontSide&&normal.z<0)continue;
          point.set(0,0,0);let u=0,v=0;for(const id of ids){u+=uv.getX(id)/3;v+=uv.getY(id)/3;point.x+=positions.getX(id)/3;point.y+=positions.getY(id)/3;point.z+=positions.getZ(id)/3;}
          let alpha;
          if(object.userData.posterKind==='monolith'){
            alpha=1;
          }else if(['event-horizon','photon-rim','minimal-disk'].includes(object.userData.posterKind)){
            alpha=object.material.opacity;
          }else if(object.userData.posterKind==='spacetime-sheet'){
            alpha=.035*clamp((3.35-Math.hypot(point.x,point.y))/.8);
          }else if(object.userData.posterKind==='magnetic-field'){
            alpha=(.60+.40*(.5+.5*Math.sin(u*13))**2)*(.65+.35*Math.sin((u%1)*Math.PI))*Math.abs(normal.z)**.35*object.material.uniforms.opacity.value;
          }else if(object.userData.posterKind==='pulsar-beam'){
            alpha=(1-v)**1.65*(.78+.22*Math.sin(v*16))*Math.abs(normal.z)**.80*object.material.uniforms.opacity.value;
          }else if(object.userData.posterKind==='ring'){
            const r=Math.hypot(point.x,point.z),fraction=(r-object.userData.innerRadius)/(object.userData.outerRadius-object.userData.innerRadius);
            const along=(-.65*point.x+.9*point.z)/Math.hypot(.65,.65,.9),distance=Math.sqrt(Math.max(0,point.lengthSq()-along*along));
            const shadow=along<0&&distance<object.userData.innerRadius*.82?.85:0;
            alpha=sampleRingProfile(object.material.uniforms.ringProfile.value,fraction,.0015)*(1-shadow)*object.material.uniforms.opacity.value;
          }else if(object.userData.posterKind==='volume'){
            const path=point.clone().normalize().dot(localCamera.clone().sub(point).normalize());
            alpha=Math.max(0,path)**2.2*object.material.uniforms.opacity.value*.85;
          }else if(object.userData.posterKind==='flare'){
            alpha=Math.exp(-(((v-.5)*5)**2))*(.55+.45*Math.sin(u*16+object.material.uniforms.phase.value))*.16;
          }else alpha=surfaceInk(object,u,v,point.x,point.y,point.z,normal.x,normal.y,normal.z);
          const xmin=Math.max(0,Math.floor(Math.min(ax,bx,cx))),xmax=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
          const ymin=Math.max(0,Math.floor(Math.min(ay,by,cy))),ymax=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
          for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
            const w1=((bx-x-.5)*(cy-y-.5)-(by-y-.5)*(cx-x-.5))/area;
            const w2=((cx-x-.5)*(ay-y-.5)-(cy-y-.5)*(ax-x-.5))/area,w3=1-w1-w2;
            if(w1<0||w2<0||w3<0)continue;
            const z=w1*az+w2*bz+w3*cz;
            const ink=object.userData.posterKind==='monolith'?monolithAlpha(normal.x,normal.y,normal.z,(x+.5-width*.5)*(12-z)/focal,(height*.5-y-.5)*(12-z)/focal,z):alpha;
            blend(x,y,z,ink,object.material.userData.bodyDepth);
          }
        }
      }else if(object.isPoints){
        const sizes=geometry.attributes.starSize,strengths=geometry.attributes.strength,soft=object.userData.posterSoft;
        for(let i=0;i<positions.count;i++){
          const x=projected[i*3],y=projected[i*3+1],z=projected[i*3+2];
          const natural=object.userData.posterWorldSize?sizes.getX(i)*focal*new THREE.Vector3().setFromMatrixScale(matrix).x/(12-z)*.5:Math.min(soft?18:4,sizes.getX(i)*.7);
          const radius=Math.max(.4,natural),strength=strengths.getX(i)*(object.userData.posterWorldSize?Math.min(1,natural*natural/(radius*radius)):1);
          for(let yy=Math.floor(y-radius);yy<=Math.ceil(y+radius);yy++)for(let xx=Math.floor(x-radius);xx<=Math.ceil(x+radius);xx++){
            const d=((xx+.5-x)**2+(yy+.5-y)**2)/(radius*radius);if(d>1)continue;blend(xx,yy,z,Math.exp(-d*(soft?5:4))*strength);
          }
        }
      }else if(object.isLineSegments){
        for(let i=0;i<positions.count;i+=2){
          const a=i*3,b=a+3,dx=projected[b]-projected[a],dy=projected[b+1]-projected[a+1],steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)));
          const radius=Math.hypot(positions.getX(i),positions.getY(i));
          const alpha=object.userData.posterKind==='spacetime-grid'?object.userData.posterOpacity*clamp((3.35-radius)/.8):object.material.opacity*.55*(geometry.attributes.strength?.getX(i)??1);
          for(let j=0;j<=steps;j++){const t=j/steps;blend(Math.round(projected[a]+dx*t),Math.round(projected[a+1]+dy*t),projected[a+2]*(1-t)+projected[b+2]*t,alpha);}
        }
      }
    }
  }
  const data=png(width,height,pixels).toString('base64');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-hidden="true"><image width="${width}" height="${height}" href="data:image/png;base64,${data}"/></svg>\n`;
}
