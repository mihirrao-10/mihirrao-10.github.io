import test from "node:test";
import assert from "node:assert/strict";
import { CHAPTERS, chapterState, cameraPose, createTransition, advanceTransition, TRANSITION_SECONDS } from "../../src/black-geometry/scene-state.js";
import { surfaceData, surfacePoint, pathPoint, TAU } from "../../src/black-geometry/geometry.js";
const starts=[0,910,1895,3010,3850,4675,5320,6100,7490];
const ranges=CHAPTERS.map((id,index)=>({id,start:starts[index],stop:starts[index]+(index===1?350:0),end:7650}));
const targets=["hero","phoenix","dragon","membrane","resolution","surface","congestion","notes","notes"];
test("nearest snap intervals always select a complete identity and keep long reading areas readable",()=>{
  for(let i=0;i<ranges.length;i++) {
    const state=chapterState(starts[i],ranges);
    assert.equal(state.chapter,CHAPTERS[i]);assert.equal(state.target,targets[i]);
    assert.equal(state.nextTarget,state.target);assert.equal(state.blend,0);
  }
  assert.equal(chapterState(1250,ranges).target,"phoenix");
  const boundary=(ranges[1].stop+ranges[2].start)/2;
  assert.equal(chapterState(boundary-.01,ranges).target,"phoenix");
  assert.equal(chapterState(boundary+.01,ranges).target,"dragon");
  assert.equal(chapterState(NaN,[]).target,"hero");
  assert.equal(chapterState(99999,ranges).chapter,"contact");
  const restored=chapterState(1580,ranges);
  [0,9000,100,6700].forEach(y=>chapterState(y,ranges));
  assert.deepEqual(chapterState(1580,ranges),restored);
});
test("every stopped scroll transition reaches an exact endpoint within 380ms at any frame rate",()=>{
  for(const fps of [20,30,60,120])for(const target of targets){
    let state=createTransition("hero");
    for(let i=0;i<Math.ceil(fps*TRANSITION_SECONDS)+1;i++)state=advanceTransition(state,target,1/fps);
    assert.deepEqual(state,createTransition(target));
  }
  assert.deepEqual(advanceTransition(createTransition("hero"),"dragon",3),createTransition("dragon"));
});
test("transition reversal keeps identical coverage and rapid skips converge to the latest target",()=>{
  let state=advanceTransition(createTransition("hero"),"phoenix",.12);
  const reversed=advanceTransition(state,"hero",0);
  assert.equal(reversed.from,"phoenix");assert.equal(reversed.to,"hero");
  assert.ok(Math.abs(reversed.blend-(1-state.blend))<1e-12);
  for(const target of ["dragon","notes","membrane","surface","resolution"])state=advanceTransition(state,target,.05);
  state=advanceTransition(state,"resolution",TRANSITION_SECONDS);
  assert.deepEqual(state,createTransition("resolution"));
});
test("timed transitions use smooth endpoints and have refresh-rate independent progress",()=>{
  let thirty=createTransition("hero"),sixty=createTransition("hero");
  for(let i=0;i<6;i++)thirty=advanceTransition(thirty,"phoenix",1/30);
  for(let i=0;i<12;i++)sixty=advanceTransition(sixty,"phoenix",1/60);
  assert.ok(Math.abs(thirty.blend-sixty.blend)<1e-12);
  assert.equal(advanceTransition(createTransition("hero"),"phoenix",0).blend,0);
  assert.ok(advanceTransition(createTransition("hero"),"phoenix",.001).blend<1e-6);
});
test("each entry camera moves continuously with bounded elevation and an authored static pose",()=>{
  for(const range of ranges){const state=chapterState(range.start,ranges);
    for(let time=0;time<90;time+=.5){const p=cameraPose(state,{time}),next=cameraPose(state,{time:time+.5});
      assert.ok(p.every(Number.isFinite));assert.ok(Math.abs(p[3])<.45&&Math.abs(p[5])<=.08);
      assert.ok(Math.abs(next[4]-p[4])<.18);
    }
    assert.deepEqual(cameraPose(state,{time:20,fullMotion:false}),cameraPose(state,{fullMotion:false}));
  }
});
test("MathWorks and Resolution open at the authored view before smoothly entering an orbit",()=>{
  for(const target of ['membrane','resolution']){
    const state={target,nextTarget:target,blend:0};
    for(const time of [0,.2,.79,.8])assert.deepEqual(cameraPose(state,{time,pointer:[1,1]}).slice(3,6),[0,0,0]);
    const first=cameraPose(state,{time:.801}), later=cameraPose(state,{time:4});
    assert.ok(Math.hypot(...first.slice(3,6))<1e-8);
    assert.ok(later[4]>.25);
    for(const time of [.8,2.8]){
      const a=cameraPose(state,{time:time-1e-5}),b=cameraPose(state,{time:time+1e-5});
      assert.ok(Math.hypot(...a.slice(3,6).map((v,i)=>v-b[i+3]))<1e-4);
    }
  }
});
test("procedural surface is deterministic, closed, finite, and free of zero-area triangles", () => {
  const mesh = surfaceData(40, 16);
  assert.deepEqual(mesh, surfaceData(40, 16));
  const edges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = mesh.indices.slice(i, i + 3),
      [a, b, c] = ids.map((j) => mesh.positions.slice(j * 3, j * 3 + 3));
    const u = b.map((v, j) => v - a[j]),
      v = c.map((value, j) => value - a[j]);
    const cross = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    assert.ok(Math.hypot(...cross) > 1e-5);
    for (let j = 0; j < 3; j++) {
      const key = [ids[j], ids[(j + 1) % 3]].sort((x, y) => x - y).join(",");
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  assert.ok([...edges.values()].every((count) => count === 2));
  assert.ok(mesh.positions.every(Number.isFinite));
  const p = surfacePoint(0.7, 1.2),
    q = surfacePoint(0.7 + TAU, 1.2 + TAU);
  assert.ok(p.every((v, i) => Math.abs(v - q[i]) < 1e-12));
});
test("illustrative route follows the original surface with a small positive separation", () => {
  for (let i = 0; i <= 100; i++) {
    const t = i / 100,
      a = pathPoint(t),
      b = surfacePoint(0.15 + t * 2.65, 1.2 + 0.28 * Math.sin(t * Math.PI));
    const distance = Math.hypot(...a.map((v, j) => v - b[j]));
    assert.ok(distance > 0.016 && distance < 0.032);
  }
});
