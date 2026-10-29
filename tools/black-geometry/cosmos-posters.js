import * as THREE from 'three';
import { deflateSync } from 'node:zlib';
import { traceBlackHole } from '../../src/black-geometry/black-hole.js';

function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return out;}
function png(width,height,pixels){
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)pixels.copy(rows,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const grain=(x,y,z)=>.5+.18*Math.sin(x*23+y*17+z*13)+.17*Math.sin(x*51-y*41+z*37)+.12*Math.sin(x*109+y*97-z*83);
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
  let density=.40+.52*sample;
  if(kind===1)density=.33+.6*sample+.1*g;
  if(kind===2)density=.38+.28*(.5+.5*Math.sin(y*58+grain(x*.2,y*.2,z*.2)*3.5))+.22*g;
  if(kind===3)density=.5+.35*g;
  if(kind===4)density=.35+.38*g;
  return clamp(opacity*(density*(kind===3?.98:light)+.08),0,.94);
}

// A small deterministic software renderer keeps the fallback detailed without
// shipping megabytes of triangle paths. It uses the live geometry and maps.
export function cosmicPoster(scene){
  scene.update(0);const blackHole=scene.theme==='Black hole';
  const width=blackHole?960:1200,height=blackHole?720:900;
  const pixels=Buffer.alloc(width*height*4),depth=new Float32Array(width*height).fill(-Infinity);
  const view=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.14,-.18,0));
  const focal=height/(2*Math.tan(35*Math.PI/360)),scale=scene.theme==='Earth and Moon'?1.10:scene.radius>3.2?.98:1.04;
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
    const origin=new THREE.Vector3(0,0,12).applyMatrix4(view.clone().invert());
    const inverse=view.clone().invert(),direction=new THREE.Vector3();
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      direction.set((x+.5-width*.5)/focal,(height*.5-y-.5)/focal,-1).normalize().transformDirection(inverse);
      const b=origin.dot(direction),c=origin.lengthSq()-3.3**2,discriminant=b*b-c;
      if(discriminant<=0)continue;
      const distance=-b-Math.sqrt(discriminant),p=origin.clone().addScaledVector(direction,distance+.001);
      const ink=traceBlackHole(p.x,p.y,p.z,direction.x,direction.y,direction.z);
      blend(x,y,0,ink);
    }
  }else{
    const objects=[];scene.root.traverse(o=>{if(o.geometry)objects.push(o);});objects.sort((a,b)=>a.renderOrder-b.renderOrder);
    for(const object of objects){
      const geometry=object.geometry,positions=geometry.attributes.position;
      const matrix=new THREE.Matrix4().multiplyMatrices(view,new THREE.Matrix4().multiplyMatrices(scaleMatrix,object.matrixWorld));
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
          if(object.userData.posterKind==='ring'){
            const r=Math.hypot(point.x,point.z),fraction=(r-object.userData.innerRadius)/(object.userData.outerRadius-object.userData.innerRadius);
            const gap=Math.abs(fraction-.63)<.013?.06:1;
            alpha=(.25+.42*(.5+.5*Math.sin(r*134+Math.sin(r*37)*4))+.28*(.5+.5*Math.sin(r*1250)))*gap*object.material.uniforms.opacity.value;
          }else alpha=surfaceInk(object,u,v,point.x,point.y,point.z,normal.x,normal.y,normal.z);
          const xmin=Math.max(0,Math.floor(Math.min(ax,bx,cx))),xmax=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
          const ymin=Math.max(0,Math.floor(Math.min(ay,by,cy))),ymax=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
          for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
            const w1=((bx-x-.5)*(cy-y-.5)-(by-y-.5)*(cx-x-.5))/area;
            const w2=((cx-x-.5)*(ay-y-.5)-(cy-y-.5)*(ax-x-.5))/area,w3=1-w1-w2;
            if(w1<0||w2<0||w3<0)continue;
            blend(x,y,w1*az+w2*bz+w3*cz,alpha,object.material.userData.bodyDepth);
          }
        }
      }else if(object.isPoints){
        const sizes=geometry.attributes.starSize,strengths=geometry.attributes.strength,soft=object.userData.posterSoft;
        for(let i=0;i<positions.count;i++){
          const x=projected[i*3],y=projected[i*3+1],z=projected[i*3+2];
          const radius=Math.max(.4,Math.min(soft?18:4,sizes.getX(i)*.7)),strength=strengths.getX(i);
          for(let yy=Math.floor(y-radius);yy<=Math.ceil(y+radius);yy++)for(let xx=Math.floor(x-radius);xx<=Math.ceil(x+radius);xx++){
            const d=((xx+.5-x)**2+(yy+.5-y)**2)/(radius*radius);if(d>1)continue;blend(xx,yy,z,Math.exp(-d*(soft?5:4))*strength);
          }
        }
      }else if(object.isLineSegments){
        for(let i=0;i<positions.count;i+=2){
          const a=i*3,b=a+3,dx=projected[b]-projected[a],dy=projected[b+1]-projected[a+1],steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)));
          for(let j=0;j<=steps;j++){const t=j/steps;blend(Math.round(projected[a]+dx*t),Math.round(projected[a+1]+dy*t),projected[a+2]*(1-t)+projected[b+2]*t,object.material.opacity*.55);}
        }
      }
    }
  }
  const data=png(width,height,pixels).toString('base64');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-hidden="true"><image width="${width}" height="${height}" href="data:image/png;base64,${data}"/></svg>\n`;
}
