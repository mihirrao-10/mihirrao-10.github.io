import * as THREE from 'three';
import { surfaceMaterial } from './astronomy-materials.js';

function magneticMaterial(scene){
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,
    uniforms:{...scene.uniforms,opacity:{value:.42}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float time,presence,opacity;varying vec2 vUv;
      void main(){float flow=.42+.58*pow(.5+.5*sin(vUv.x*13.0-time*1.25),2.0);
      gl_FragColor=vec4(vec3(.02),flow*opacity*presence);}`});
  scene.materials.add(material);return material;
}
export function dipolePoint(theta,azimuth,extent){
  const r=extent*Math.sin(theta)**2;
  return new THREE.Vector3(r*Math.sin(theta)*Math.cos(azimuth),r*Math.cos(theta),r*Math.sin(theta)*Math.sin(azimuth));
}
export function createNeutronStar(scene,grid){
  const spin=new THREE.Group(),magnet=new THREE.Group();magnet.rotation.z=.47;spin.add(magnet);scene.root.add(spin);
  const core=new THREE.Mesh(new THREE.SphereGeometry(.86,512,256),surfaceMaterial(scene,8,null,{opacity:1.16,detail:384}));
  core.userData.posterKind='body';core.userData.surfaceKind=8;magnet.add(core);
  const fieldMaterial=magneticMaterial(scene);
  for(const extent of [1.35,1.9,2.55])for(let i=0;i<24;i++){
    const azimuth=i/24*Math.PI*2,theta0=Math.asin(Math.sqrt(.86/extent)),path=[];
    for(let j=0;j<=96;j++)path.push(dipolePoint(theta0+(Math.PI-2*theta0)*j/96,azimuth,extent));
    const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),192,.0035,6,false);
    const uv=geometry.attributes.uv;for(let j=0;j<uv.count;j++)uv.setX(j,uv.getX(j)+i*.073);
    const field=new THREE.Mesh(geometry,fieldMaterial);field.userData.posterKind='magnetic-field';magnet.add(field);
  }
  const beamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
    uniforms:{...scene.uniforms,opacity:{value:.26}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float time,presence,opacity;varying vec2 vUv;
      void main(){float flow=.65+.35*sin(vUv.y*22.0-time*3.0);
      gl_FragColor=vec4(vec3(.025),pow(1.0-vUv.y,1.5)*flow*opacity*presence);}`});
  scene.materials.add(beamMaterial);
  for(const sign of [-1,1])for(const width of [1,.34]){
    const geometry=grid((u,v)=>{
      const a=u*Math.PI*2,r=(.025+.18*v)*width;
      return[r*Math.cos(a),sign*(.82+1.95*v),r*Math.sin(a)];
    },128,96);
    const beam=new THREE.Mesh(geometry,beamMaterial);beam.userData.posterKind='pulsar-beam';magnet.add(beam);
  }
  scene.animate=t=>{spin.rotation.set(.10,t*.33,-.12);core.rotation.y=t*.72;};
  scene.theme='Neutron star';scene.volumeKind='magnetosphere';scene.radius=3.0;
}
