import * as THREE from "three";
import { createHero } from "../../src/black-geometry/sculptures/hero.js";
import { createHarper } from "../../src/black-geometry/sculptures/harper.js";
import { createDragon } from "../../src/black-geometry/sculptures/dragon.js";
import { createMembrane } from "../../src/black-geometry/sculptures/membrane.js";

const COMPONENTS = ["hero", "harper", "dragon", "membrane", "neutral"];
const factories = [createHero, createHarper, createDragon, createMembrane, () => createHero(true)];
const xyz = new THREE.Vector3();
const center = (face) => [0, 1, 2].map(k => (face.p[k] + face.p[k + 3] + face.p[k + 6]) / 3);
const area = (face) => {
  const p = face.p, a = [p[3]-p[0],p[4]-p[1],p[5]-p[2]], b = [p[6]-p[0],p[7]-p[1],p[8]-p[2]];
  return Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]);
};

/** Bake original volumes, material colors and transforms; no browser authoring work. */
export function bake(group, name) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group), size = box.getSize(new THREE.Vector3());
  const middle = box.getCenter(new THREE.Vector3());
  const scale = Math.min(5.9 / size.x, 4.65 / size.y, 5.6 / size.z) * (name === "neutral" ? 0.86 : name === "hero" ? 1.22 : 1);
  const faces = [], paths = [];
  group.traverse(object => {
    if (!object.geometry) return;
    const p = object.geometry.attributes.position;
    if (!object.isMesh) {
      if (object.userData.path || object.isLine) {
        const points = [];
        for (let i = 0; i < p.count; i++) points.push(...xyz.fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld).sub(middle).multiplyScalar(scale).toArray());
        paths.push({ points, kind: object.userData.kind || "route" });
      }
      return;
    }
    const index = object.geometry.index, c = object.geometry.attributes.color;
    const length = index?.count || p.count;
    for (let i = 0; i < length; i += 3) {
      const face = {p: [], c: [0,0,0]};
      let material = object.material;
      if (Array.isArray(material)) {
        const group = object.geometry.groups.find(g => i >= g.start && i < g.start + g.count);
        material = material[group?.materialIndex || 0];
      }
      for (let j = 0; j < 3; j++) {
        const id = index ? index.getX(i+j) : i+j;
        face.p.push(...xyz.fromBufferAttribute(p,id).applyMatrix4(object.matrixWorld).sub(middle).multiplyScalar(scale).toArray());
        for (let k=0;k<3;k++) face.c[k] += ((c && material.vertexColors ? c.array[id*3+k] : 1) * (material.color?.["rgb"[k]] ?? 1))/3;
      }
      if (name === "hero" || name === "neutral") face.c = face.c.map(v => v * ((i / 3) % 2 ? 0.99 : 0.86));
      if (area(face) > 1e-10) faces.push(face);
    }
  });
  const geometries = new Set(), materials = new Set();
  group.traverse(o => { if(o.geometry) geometries.add(o.geometry); if(o.material) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m)); });
  geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
  return { name, faces, paths };
}

function split(face) {
  const p = [face.p.slice(0,3),face.p.slice(3,6),face.p.slice(6,9)];
  const lengths = p.map((a,i)=>a.reduce((s,v,k)=>s+(v-p[(i+1)%3][k])**2,0));
  const i = lengths.indexOf(Math.max(...lengths)), a=p[i], b=p[(i+1)%3], c=p[(i+2)%3], m=a.map((v,k)=>(v+b[k])/2);
  return [{p:[...a,...m,...c],c:face.c},{p:[...m,...b,...c],c:face.c}];
}

/** Balanced recursive spatial partitions give coherent facet neighborhoods across identities.
 * Long faces subdivide before matching, so transport never stretches one triangle across a model.
 */
export function correspond(original, count) {
  const heap = [];
  const push = face => {
    const p = face.p;
    const edge = Math.max(...[0,3,6].map((a,i)=>{const b=((i+1)%3)*3;return (p[a]-p[b])**2+(p[a+1]-p[b+1])**2+(p[a+2]-p[b+2])**2;}));
    const item = {face, size:edge}; let i=heap.length; heap.push(item);
    while(i) {const p=(i-1)>>1;if(heap[p].size>=item.size)break;heap[i]=heap[p];i=p;} heap[i]=item;
  };
  const pop = () => {
    const result=heap[0], last=heap.pop();
    if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].size>heap[c].size)c++;if(heap[c].size<=last.size)break;heap[i]=heap[c];i=c;}heap[i]=last;}
    return result.face;
  };
  original.forEach(push);
  while(heap.length < count) split(pop()).forEach(push);
  const faces=heap.map(({face})=>({...face,center:center(face)}));
  function order(items, depth=0) {
    if(items.length <= 1) return items;
    const axis = depth % 3;
    items.sort((a,b)=>a.center[axis]-b.center[axis]);
    const half=items.length>>1;
    return order(items.slice(0,half),depth+1).concat(order(items.slice(half),depth+1));
  }
  return order(faces);
}

const CORNER_PERMUTATIONS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2],
  [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

/** Match local corners to the connected hero scaffold without moving a vertex.
 * Reversing winding is safe for the renderer's double-sided surface material.
 * The scaffold scale must match the global affine transform in world.js.
 */
export function alignCorners(faces, scaffold, scale = [1.1, 0.7, 0.5]) {
  if (faces.length !== scaffold.length) throw new Error("Scaffold face count mismatch");
  return faces.map((face, index) => {
    const target = scaffold[index];
    const sourceCenter = face.center || center(face);
    const targetCenter = target.center || center(target);
    const sourceLocal = face.p.map((value, component) => value - sourceCenter[component % 3]);
    const targetLocal = target.p.map((value, component) =>
      (value - targetCenter[component % 3]) * scale[component % 3]);
    let best = CORNER_PERMUTATIONS[0], bestCost = Infinity;
    for (const permutation of CORNER_PERMUTATIONS) {
      let cost = 0;
      for (let corner = 0; corner < 3; corner++) {
        for (let axis = 0; axis < 3; axis++) {
          const difference = sourceLocal[permutation[corner] * 3 + axis]
            - targetLocal[corner * 3 + axis];
          cost += difference * difference;
        }
      }
      if (cost < bestCost) { bestCost = cost; best = permutation; }
    }
    return { ...face, p: best.flatMap(corner => face.p.slice(corner * 3, corner * 3 + 3)) };
  });
}

export async function sculptureOutputs() {
  const models = factories.map((factory,i)=>bake(factory(),COMPONENTS[i]));
  const {createSurface, createCongestion} = await import("../../src/black-geometry/sculptures/projects.js");
  models.push(bake(createSurface(),"surface"),bake(createCongestion(),"congestion"));
  const count = 2 ** Math.ceil(Math.log2(Math.max(...models.map(m=>m.faces.length))));
  const manifest = {version:1, count, stride:21, quantization:4096, models:[]};
  const buffers=[];
  // Reuse this exact ordered topology for every model's corner alignment.
  // Positive diagonal scaling leaves the hero's own corner order unchanged.
  const scaffold = correspond(models[0].faces, count);
  for(const model of models){
    const ordered = model === models[0] ? scaffold : correspond(model.faces, count);
    const faces=alignCorners(ordered,scaffold), data=Buffer.alloc(count*21);
    faces.forEach((face,i)=>{
      face.p.forEach((v,j)=>data.writeInt16LE(Math.round(v*4096),i*21+j*2));
      face.c.forEach((v,j)=>data[i*21+18+j]=Math.round(Math.min(1,Math.max(0,v))*255));
    });
    manifest.models.push({name:model.name,originalFaces:model.faces.length,paths:model.paths});
    buffers.push(data);
  }
  const header=Buffer.from(JSON.stringify(manifest)), length=Buffer.alloc(4);length.writeUInt32LE(header.length);
  return {models, manifest, binary:Buffer.concat([length,header,...buffers])};
}
