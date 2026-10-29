import * as THREE from 'three';
import { deflateSync } from 'node:zlib';
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return out;}
function png(width,height,pixels){
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)pixels.copy(rows,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

// Software rasterization uses the same triangles, facet colors, and edge widths.
export function cosmicPoster(scene) {
  scene.update(0);
  const width=1600,height=1200,focal=height/(2*Math.tan(35*Math.PI/360));
  const pixels=Buffer.alloc(width*height*4),depth=new Float32Array(width*height).fill(-Infinity);
  const view=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.14,-.18,0));
  const scale=new THREE.Matrix4().makeScale(...Array(3).fill(3.45/scene.radius));
  const triangles=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
  const lightDirection=new THREE.Vector3(-.5,.7,1).normalize();
  const project=p=>[width/2+p.x/(12-p.z)*focal,height/2-p.y/(12-p.z)*focal,p.z];
  scene.root.traverse(object=>{
    if(!object.isMesh)return;
    const p=object.geometry.attributes.position,values=object.geometry.attributes.facetValue;
    const matrix=new THREE.Matrix4().multiplyMatrices(view,new THREE.Matrix4().multiplyMatrices(scale,object.matrixWorld));
    const style=object.material.userData.facetStyle;
    const low=new THREE.Color(style.palette[0]),high=new THREE.Color(style.palette[1]);
    for(let i=0;i<p.count;i+=3) {
      a.fromBufferAttribute(p,i).applyMatrix4(matrix);b.fromBufferAttribute(p,i+1).applyMatrix4(matrix);c.fromBufferAttribute(p,i+2).applyMatrix4(matrix);
      normal.crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
      const center=a.clone().add(b).add(c).multiplyScalar(1/3),front=normal.dot(new THREE.Vector3(0,0,12).sub(center))>0;
      if(style.voidCore&&!front)continue;
      const shade=.72+.28*Math.abs(normal.dot(lightDirection)),value=values.getX(i);
      const color=low.clone().lerp(high,value).multiplyScalar(shade),line=high.clone().multiplyScalar(.55);
      let alpha=style.fill*(.55+.45*value),edge=style.edge;
      if(!front){alpha*=style.back;edge*=style.back;}
      if(style.voidCore){color.setRGB(.009,.010,.014);line.setRGB(.016,.018,.023);alpha=.98;edge=.99;}
      color.convertLinearToSRGB();line.convertLinearToSRGB();
      triangles.push({points:[project(a),project(b),project(c)],z:center.z,color:color.toArray(),line:line.toArray(),alpha,edge,width:style.width*2,write:style.voidCore});
    }
  });
  triangles.sort((a,b)=>Number(b.write)-Number(a.write)||a.z-b.z);
  for(const t of triangles) {
    const [[ax,ay,az],[bx,by,bz],[cx,cy,cz]]=t.points;
    const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<.00001)continue;
    const deriv=[Math.abs(cy-by)+Math.abs(cx-bx),Math.abs(ay-cy)+Math.abs(ax-cx),Math.abs(by-ay)+Math.abs(bx-ax)].map(v=>v/Math.abs(area)*t.width);
    const xmin=Math.max(0,Math.floor(Math.min(ax,bx,cx))),xmax=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
    const ymin=Math.max(0,Math.floor(Math.min(ay,by,cy))),ymax=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
    for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++) {
      const w1=((bx-x-.5)*(cy-y-.5)-(by-y-.5)*(cx-x-.5))/area;
      const w2=((cx-x-.5)*(ay-y-.5)-(cy-y-.5)*(ax-x-.5))/area,w3=1-w1-w2;
      if(w1<0||w2<0||w3<0)continue;
      const z=w1*az+w2*bz+w3*cz,index=y*width+x;if(z<depth[index]-.001)continue;
      const wire=1-Math.min(...[w1,w2,w3].map((w,i)=>smooth(deriv[i]*.22,deriv[i]*1.15,w)));
      const alpha=t.alpha*(1-wire)+t.edge*wire,at=index*4,old=pixels[at+3]/255,next=alpha+old*(1-alpha);
      if(next<.001)continue;
      for(let k=0;k<3;k++){const color=t.color[k]*(1-wire)+t.line[k]*wire;pixels[at+k]=Math.round((color*255*alpha+pixels[at+k]*old*(1-alpha))/next);}
      pixels[at+3]=Math.round(next*255);if(t.write)depth[index]=z;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-hidden="true"><image width="${width}" height="${height}" href="data:image/png;base64,${png(width,height,pixels).toString('base64')}"/></svg>\n`;
}
