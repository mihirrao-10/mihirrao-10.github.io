import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium, webkit } from '@playwright/test';
import { openPortfolio } from './browser-utils.js';
const engine=process.env.BG_ENGINE||'chromium',label=process.env.BG_AUDIT_LABEL||'final';
const output=`.artifacts/black-geometry/${label}-${engine}`;
await fs.mkdir(output,{recursive:true});
const browser=await ({chromium,webkit}[engine]).launch();
try{
 const page=await browser.newPage({viewport:{width:1000,height:750}});
 await page.addInitScript(()=>{
  const raf=window.requestAnimationFrame;
  window.auditFrames=[];window.auditImages=[];
  window.requestAnimationFrame=callback=>raf.call(window,now=>{
   callback(now);
   if(!window.auditRecording||!window.__blackGeometry)return;
   const snapshot=window.__blackGeometry.snapshot(),canvas=document.querySelector('.world canvas');
   if(!canvas||!snapshot.world||window.auditLastFrame===snapshot.world.frames)return;
   window.auditLastFrame=snapshot.world.frames;
   const gl=canvas.getContext('webgl2'),pixels=new Uint8Array(canvas.width*canvas.height*4);
   gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let ink=0,peak=0;for(let i=3;i<pixels.length;i+=16){ink+=pixels[i];peak=Math.max(peak,pixels[i]);}
   if(window.auditCapture&&window.auditImages.length<32){
    window.auditImages.push({weights:snapshot.world.sceneWeights,data:canvas.toDataURL('image/png').split(',')[1]});
   }
   window.auditFrames.push({now,phase:window.auditPhase,ink:ink/(pixels.length/16),peak,world:snapshot.world});
  });
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openPortfolio(page);await page.locator('.site-loader').waitFor({state:'hidden'});
 const assignments=await page.evaluate(()=>window.__blackGeometry.snapshot().assignments);
 const sections=Object.fromEntries(Object.entries(assignments).map(([page,target])=>[target,page]));
 const select=async target=>page.evaluate(section=>document.querySelector(`.site-index a[href="#${section}"]`).click(),sections[target]);
 await select('hero');await page.waitForTimeout(700);
 await page.evaluate(()=>{window.auditRecording=true;window.auditPhase='visits';});
 for(let pass=0;pass<2;pass++)for(const target of Object.keys(sections)){
  await select(target);await page.waitForTimeout(650);
 }
 await page.evaluate(()=>{window.auditPhase='quasar';});
 await select('hero');await page.waitForTimeout(650);
 await page.evaluate(()=>{window.auditCapture=true;});
 await select('projects');await page.waitForTimeout(650);
 await page.evaluate(()=>{window.auditCapture=false;});
 const images=await page.evaluate(()=>window.auditImages);
 for(let i=0;i<images.length;i++)await fs.writeFile(`${output}/live-frame-${i}.png`,Buffer.from(images[i].data,'base64'));
 await fs.writeFile(`${output}/captured-weights.json`,JSON.stringify(images.map(({weights})=>weights)));
 assert.ok(images.some(({weights})=>Object.values(weights).filter(weight=>weight>0).length>1),'Capture an actual intermediate dissolve frame');
 await page.evaluate(()=>{window.auditPhase='interruptions';});
 for(const target of ['hero','projects','notes','projects','teaching','education','experience','publications']){await select(target);await page.waitForTimeout(65);}
 await page.waitForTimeout(700);
 await page.evaluate(()=>{window.auditPhase='drag';});
 const box=await page.locator('.world').boundingBox();
 await page.mouse.move(box.x+box.width*.4,box.y+box.height*.5);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.7,box.y+box.height*.8,{steps:12});await select('projects');
 await page.mouse.move(box.x+box.width*.2,box.y+box.height*.2,{steps:12});await page.mouse.up();await page.waitForTimeout(650);
 await page.evaluate(()=>{window.auditPhase='resize';});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);
 const frames=await page.evaluate(()=>{window.auditRecording=false;return window.auditFrames;});
 await fs.writeFile(`${output}/frames.json`,JSON.stringify({assignments,errors,frames}));
 assert.equal(errors.length,0);
 assert.ok(frames.length>100);
 for(const {ink,world} of frames){
  assert.ok(ink>0,'Every presented frame must contain artwork');
  assert.equal(world.fitScales.length,Object.values(world.sceneWeights).filter(weight=>weight>0).length,'Render every visible contribution on its first frame');
  assert.ok(world.gpuReady&&world.liveFrameReady&&world.preparedScenes.length===7);
  assert.ok(Math.abs(Object.values(world.sceneWeights).reduce((a,b)=>a+b,0)-1)<1e-10);
 }
 console.log(JSON.stringify({output,errors,frames:frames.length,ready:frames[0]?.world,minimumInk:Math.min(...frames.map(f=>f.ink)),maximumInk:Math.max(...frames.map(f=>f.ink))}));
}finally{await browser.close();}
