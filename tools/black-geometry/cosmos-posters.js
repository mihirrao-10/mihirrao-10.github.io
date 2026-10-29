import * as THREE from 'three';

// Reduced-motion artwork projects the same shells and seeded star fields.
export function cosmicPoster(scene) {
  scene.update(0);
  const point=new THREE.Vector3(),view=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.14,-.18,0));
  const project=(position,i,matrix)=>{
    point.fromBufferAttribute(position,i).applyMatrix4(matrix).applyMatrix4(view);
    return [400+point.x/(12-point.z)*1040,300-point.y/(12-point.z)*1040];
  };
  const n=value=>value.toFixed(2),layers=[],objects=[];
  scene.root.traverse(object=>{if(object.geometry)objects.push(object);});
  objects.sort((a,b)=>a.renderOrder-b.renderOrder);
  for(const object of objects){
    const position=object.geometry.attributes.position;
    if(object.isMesh){
      if(object.userData.posterMask){
        const p=project(position,0,object.matrixWorld);
        point.set(0,0,0).applyMatrix4(object.matrixWorld).applyMatrix4(view);
        const cx=400+point.x/(12-point.z)*1040,cy=300-point.y/(12-point.z)*1040;
        layers.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(Math.hypot(p[0]-cx,p[1]-cy))}" fill="#f5f2eb"/>`);
        continue;
      }
      const paths=[];
      for(let i=0;i<position.count;i+=3){
        const corners=[i,i+1,i+2].map(j=>project(position,j,object.matrixWorld));
        paths.push(`M${corners.map(p=>p.map(n).join(' ')).join('L')}Z`);
      }
      layers.push(`<path d="${paths.join('')}" fill="#666" fill-opacity="${object.userData.posterFill}" stroke="#393835" stroke-opacity="${object.userData.posterLine}" stroke-width=".35" stroke-linejoin="round"/>`);
    }else if(object.isPoints){
      const size=object.geometry.attributes.starSize,strength=object.geometry.attributes.strength,soft=object.userData.posterSoft;
      for(let i=0;i<position.count;i++){
        const p=project(position,i,object.matrixWorld);
        layers.push(`<circle cx="${n(p[0])}" cy="${n(p[1])}" r="${n(size.getX(i)*.4)}" fill="${soft?'url(#mist)':'#363532'}" opacity="${n(strength.getX(i)*.8)}"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" aria-hidden="true"><defs><radialGradient id="mist"><stop stop-color="#282725"/><stop offset="1" stop-color="#282725" stop-opacity="0"/></radialGradient></defs>${layers.join('')}</svg>\n`;
}
