import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { correspond, bake } from "../../tools/black-geometry/sculptures.js";
import { createSurface, createCongestion, SURFACE_INFO, CONGESTION_INFO } from "../../src/black-geometry/sculptures/projects.js";

test("prepared sculpture packet has eight complete finite identities and simultaneous institutional colors", async () => {
  const data=await fs.readFile(new URL("../../assets/black-geometry/generated/sculpture-data.bin",import.meta.url));
  const length=data.readUInt32LE(0), manifest=JSON.parse(data.subarray(4,length+4)), offset=length+4;
  assert.deepEqual(manifest.models.map(m=>m.name),["hero","harper","dragon","membrane","resolution","notes","surface","congestion"]);
  assert.equal(data.length,offset+manifest.models.length*manifest.count*manifest.stride);
  assert.ok(manifest.count>=29584);
  for(let i=0;i<manifest.models.length;i++){
    const colors=new Set();let min=Infinity,max=-Infinity;
    for(let j=0;j<manifest.count;j++){
      const at=offset+(i*manifest.count+j)*21;
      for(let k=0;k<9;k++){const p=data.readInt16LE(at+k*2)/4096;min=Math.min(min,p);max=Math.max(max,p);assert.ok(Math.abs(p)<5);}
      colors.add(data.subarray(at+18,at+21).toString("hex"));
    }
    assert.ok(max-min>2,manifest.models[i].name);
    assert.ok(colors.size>=2,manifest.models[i].name);
  }
});

test("spatial transport subdivision preserves surface area and bounds instead of stretching original face indices", () => {
  const source=[{p:[0,0,0,1,0,0,0,1,0],c:[1,.5,0]}];
  const faces=correspond(source,256);
  assert.equal(faces.length,256);
  let area=0;
  for(const {p,c} of faces){
    assert.ok(p.every(v=>v>=0&&v<=1));assert.deepEqual(c,source[0].c);
    area+=Math.abs((p[3]-p[0])*(p[7]-p[1])-(p[4]-p[1])*(p[6]-p[0]))/2;
    assert.ok(Math.hypot(p[3]-p[0],p[4]-p[1])<.2);
  }
  assert.equal(area,.5);
  assert.deepEqual(correspond(source,256),faces);
});

test("project art retains full exported geometry, computed path and finite-player potential data", () => {
  const surface=bake(createSurface(),"surface"), congestion=bake(createCongestion(),"congestion");
  assert.equal(surface.faces.length,29584);assert.equal(surface.paths[0].points.length/3,242);
  assert.equal(SURFACE_INFO.route.tracingReachedSource,true);
  assert.equal(SURFACE_INFO.route.fallbackUsed,false);
  assert.equal(congestion.faces.length,10000);
  assert.equal(CONGESTION_INFO.population,100);
  assert.equal(CONGESTION_INFO.equilibria.length,4);
  assert.ok(congestion.paths.some(p=>p.kind==="open"));
  assert.ok(congestion.paths.some(p=>p.kind==="closed"));
});
