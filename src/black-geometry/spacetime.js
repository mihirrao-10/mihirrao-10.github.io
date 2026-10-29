import * as THREE from 'three';

export function warpSpacetime(x,y,time=0){
  const r=Math.hypot(x,y),bend=1+.34*Math.exp(-r*r/2.0);
  const z=-.35-1.65/(1+(r/.92)**2)+.035*Math.sin(r*5-time*.65)*Math.exp(-r*.65);
  return [x*bend,y*bend,z];
}
function gridMaterial(scene,opacity){
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,opacity:{value:opacity}},
    vertexShader:`uniform float time;varying float radius;void main(){vec3 p=position;radius=length(p.xy);
      p.z+=.035*(sin(radius*5.0-time*.65)-sin(radius*5.0))*exp(-radius*.65);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader:`uniform float presence,opacity;varying float radius;
      void main(){float fade=1.0-smoothstep(2.55,3.35,radius);
      gl_FragColor=vec4(vec3(.015),opacity*fade*presence);}`});
  scene.materials.add(material);return material;
}
export function createSpacetime(scene){
  const fabric=new THREE.Group();scene.root.add(fabric);
  const major=[],minor=[];
  for(let axis=0;axis<2;axis++)for(let row=-20;row<=20;row++){
    const fixed=row*.16,target=row%5===0?major:minor;
    for(let i=0;i<320;i++){
      const a=-3.2+i*.02,b=a+.02;
      if(Math.hypot(fixed,(a+b)*.5)>3.2)continue;
      target.push(...warpSpacetime(axis?a:fixed,axis?fixed:a),...warpSpacetime(axis?b:fixed,axis?fixed:b));
    }
  }
  for(const [positions,opacity]of [[minor,.30],[major,.58]]){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const mesh=new THREE.LineSegments(geometry,gridMaterial(scene,opacity));
    mesh.userData.posterKind='spacetime-grid';mesh.userData.posterOpacity=opacity;fabric.add(mesh);
  }
  const plane=new THREE.RingGeometry(0,3.2,256,96),p=plane.attributes.position;
  for(let i=0;i<p.count;i++)p.setXYZ(i,...warpSpacetime(p.getX(i),p.getY(i)));
  plane.computeVertexNormals();
  const veil=gridMaterial(scene,.035);veil.side=THREE.DoubleSide;
  const membrane=new THREE.Mesh(plane,veil);membrane.userData.posterKind='spacetime-sheet';fabric.add(membrane);

  // An unshaded, camera-facing shadow reads as a void instead of a lit planet.
  const shadowMaterial=new THREE.MeshBasicMaterial({color:0x030303,transparent:true,opacity:.995,depthTest:false,depthWrite:false});
  shadowMaterial.userData.baseOpacity=.995;scene.materials.add(shadowMaterial);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.94,384),shadowMaterial);
  shadow.userData.posterKind='event-horizon';shadow.renderOrder=10;scene.root.add(shadow);
  const rimMaterial=new THREE.MeshBasicMaterial({color:0x171715,transparent:true,opacity:.18,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
  rimMaterial.userData.baseOpacity=.18;scene.materials.add(rimMaterial);
  const rim=new THREE.Mesh(new THREE.RingGeometry(.965,.982,384),rimMaterial);rim.renderOrder=9;rim.userData.posterKind='photon-rim';scene.root.add(rim);
  const parentRotation=new THREE.Quaternion();
  const faceCamera=(_renderer,_scene,camera)=>{
    scene.root.getWorldQuaternion(parentRotation).invert();shadow.quaternion.copy(parentRotation).multiply(camera.quaternion);rim.quaternion.copy(shadow.quaternion);
    shadow.updateMatrixWorld();rim.updateMatrixWorld();
  };
  shadow.onBeforeRender=faceCamera;rim.onBeforeRender=faceCamera;

  const diskMaterial=new THREE.MeshBasicMaterial({color:0x1a1917,transparent:true,opacity:.10,depthWrite:false,depthTest:false,side:THREE.DoubleSide});
  diskMaterial.userData.baseOpacity=.10;scene.materials.add(diskMaterial);
  const disk=new THREE.Mesh(new THREE.RingGeometry(1.08,1.38,512,6),diskMaterial);
  disk.rotation.set(1.18,.12,-.18);disk.renderOrder=8;disk.userData.posterKind='minimal-disk';scene.root.add(disk);
  scene.animate=t=>{fabric.rotation.set(.18+Math.sin(t*.065)*.08,Math.sin(t*.05)*.13,-.13);disk.rotation.z=-.18+t*.045;};
  scene.theme='Black hole';scene.volumeKind='spacetime-well';scene.radius=3.55;
}
