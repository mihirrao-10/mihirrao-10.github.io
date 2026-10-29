import * as THREE from 'three';
import { valueNoise } from './astronomy-materials.js';

export const TAU = Math.PI * 2;
export const PALETTES = Object.freeze({
  earth: ['#b8d0cc', '#254b50'], moon: ['#b7b3ac', '#50565e'],
  jupiter: ['#dfcdb0', '#5c4840'], sun: ['#c2a16c', '#795344'],
  neutron: ['#a6a4bb', '#4b425c'], hole: ['#a69caa', '#383141'],
  galaxy: ['#9ba7bc', '#3c4b66'], cluster: ['#a6b6b8', '#354d5c'],
});
const clamp = v => THREE.MathUtils.clamp(v, 0, 1);

export function sampleSurface(map, p) {
  if (!map?.userData?.pixels) return .5;
  const { pixels, width, height } = map.userData;
  const r = Math.hypot(...p), u = (Math.atan2(p[2], -p[0]) / TAU + 1) % 1;
  const v = Math.acos(THREE.MathUtils.clamp(p[1] / r, -1, 1)) / Math.PI;
  const x = Math.floor(u * (width - 1)), y = Math.floor(v * (height - 1));
  return pixels[y * width + x] / 255;
}

// Each triangle owns its barycentric coordinates and one sampled surface value.
export function facetGeometry(source, field = () => .5) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  source.dispose();
  const p = geometry.attributes.position, bary = new Float32Array(p.count * 3), values = new Float32Array(p.count);
  for (let i = 0; i < p.count; i += 3) {
    const center = [0, 0, 0];
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) center[k] += p.array[(i + j) * 3 + k] / 3;
    const value = clamp(field(center, i / 3));
    for (let j = 0; j < 3; j++) { bary[(i + j) * 3 + j] = 1; values[i + j] = value; }
  }
  geometry.setAttribute('barycentric', new THREE.BufferAttribute(bary, 3));
  geometry.setAttribute('facetValue', new THREE.BufferAttribute(values, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function triangleSurface(point, columns, rows, wrap = false) {
  const positions = [], indices = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    const stagger = wrap && j % 2 ? .5 : 0;
    positions.push(...point((i + stagger) / columns, j / rows));
    if (i && j) { const d = j * (columns + 1) + i, c = d - 1, b = d - columns - 1, a = b - 1; indices.push(a, c, d, a, d, b); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);return geometry;
}

export function deformFacet(p, time, flow = 0, ripple = 0) {
  const [x, y, z] = p, r = Math.hypot(x, z), angle = time * flow * .35 + flow * .9 * Math.sin(time * .35) / (r + .5) ** 1.25;
  const wave = Math.atan2(z, x) * 3 + r * 5;
  return [x * Math.cos(angle) + z * Math.sin(angle), y + ripple * (Math.sin(wave - time * .65) - Math.sin(wave)), z * Math.cos(angle) - x * Math.sin(angle)];
}

export function facetMaterial(scene, {
  palette = PALETTES.earth, fill = .36, edge = .72, width = .62,
  back = .18, flow = 0, ripple = 0, pulse = .025, voidCore = false,
} = {}) {
  const style = { palette, fill, edge, width, back, flow, ripple, pulse, voidCore };
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: voidCore, depthTest: true,
    side: voidCore ? THREE.FrontSide : THREE.DoubleSide,
    forceSinglePass: true,
    uniforms: { ...scene.uniforms, low: { value: new THREE.Color(palette[0]) }, high: { value: new THREE.Color(palette[1]) },
      fill: { value: fill }, edge: { value: edge }, lineWidth: { value: width }, back: { value: back },
      flow: { value: flow }, ripple: { value: ripple }, pulse: { value: pulse }, voidCore: { value: voidCore ? 1 : 0 } },
    vertexShader: `attribute vec3 barycentric;attribute float facetValue;
      uniform float time,flow,ripple;varying vec3 vBary,vView;varying float vValue;
      void main(){vec3 p=position;float r=length(p.xz),a=time*flow*.35+flow*.9*sin(time*.35)/pow(r+.5,1.25);
        float wave=atan(p.z,p.x)*3.+r*5.;p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
        p.y+=ripple*(sin(wave-time*.65)-sin(wave));
        vBary=barycentric;vValue=facetValue;vec4 view=modelViewMatrix*vec4(p,1.);vView=view.xyz;
        gl_Position=projectionMatrix*view;}`,
    fragmentShader: `uniform float time,presence,pixelRatio,fill,edge,lineWidth,back,pulse,voidCore;
      uniform vec3 low,high;varying vec3 vBary,vView;varying float vValue;
      void main(){vec3 fw=max(fwidth(vBary),vec3(.00001));
        vec3 aa=smoothstep(fw*lineWidth*pixelRatio*.22,fw*lineWidth*pixelRatio*1.15,vBary);
        float wire=1.-min(aa.x,min(aa.y,aa.z));
        vec3 normal=normalize(cross(dFdx(vView),dFdy(vView)));
        float light=.72+.28*abs(dot(normal,normalize(vec3(-.5,.7,1.))));
        float value=clamp(vValue+pulse*sin(time*.6+vValue*12.),0.,1.);
        vec3 face=mix(low,high,value)*light;
        float faceAlpha=fill*(.55+.45*value),lineAlpha=edge;
        if(!gl_FrontFacing){faceAlpha*=back;lineAlpha*=back;}
        if(voidCore>.5){face=vec3(.009,.010,.014);faceAlpha=.98;lineAlpha=.99;}
        vec3 line=voidCore>.5?vec3(.016,.018,.023):high*.55;
        gl_FragColor=vec4(mix(face,line,wire),mix(faceAlpha,lineAlpha,wire)*presence);
        #include <colorspace_fragment>
      }`,
  });
  material.userData.facetStyle = style;material.userData.bodyDepth = voidCore;
  scene.materials.add(material);return material;
}

export function facetMesh(scene, parent, geometry, options = {}) {
  const mesh = new THREE.Mesh(geometry, facetMaterial(scene, options));
  mesh.userData.tessellated = true;mesh.userData.posterKind = 'facets';parent.add(mesh);return mesh;
}

export function globe(scene, parent, radius, detail, options = {}) {
  const { map, kind = 4, field, scale = [1, 1, 1], ...style } = options;
  const sample = field || (p => {
    const texture = sampleSurface(map, p), grain = valueNoise(...p.map(v => v * 19));
    if (kind === 0) return clamp((texture - .08) * 2.4 + .08 * grain);
    if (kind === 1) return clamp(.18 + .70 * texture + .06 * grain);
    if (kind === 2) return clamp(.14 + .80 * (1 - texture));
    if (kind === 3) return clamp(.25 + .65 * texture + .1 * grain);
    return .30 + .45 * grain;
  });
  const mesh = facetMesh(scene, parent, facetGeometry(new THREE.IcosahedronGeometry(radius, detail), sample), style);
  mesh.scale.fromArray(scale);mesh.userData.surfaceKind = kind;return mesh;
}
