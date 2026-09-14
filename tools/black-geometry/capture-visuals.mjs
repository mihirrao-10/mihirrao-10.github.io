import {chromium} from "@playwright/test";
import { fileURLToPath } from "node:url";
import fs from 'node:fs/promises';
const out=fileURLToPath(new URL("../../.artifacts/black-geometry-revision/visual",import.meta.url));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();const errors=[],observations=[];
for(const [name,width,height] of [['desktop',1365,900],['phone',390,844],['laptop',1024,768],['landscape',740,390]]){
const context=await browser.newContext({viewport:{width,height},recordVideo:name==='desktop'?{dir:out+'/video',size:{width:1365,height:900}}:undefined});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${process.env.BG_BASE_URL || "http://127.0.0.1:8000"}/?bg-debug`);await page.waitForFunction(()=>document.body.dataset.experienceState==='ready');
for(const id of ['hero','education-uchicago','education-drexel','experience-mathworks','experience-resolution','research-drexel','teaching-uchicago','teaching-drexel','project-surface','project-congestion','notes','contact']){
 await page.evaluate(id=>{const r=__blackGeometry.snapshot().ranges.find(r=>r.id===id);scrollTo(0,r.start+35)},id);
 await page.waitForTimeout(300);
 await page.screenshot({path:`${out}/${name}-${id}.png`});
 observations.push({name,id,...await page.evaluate(()=>__blackGeometry.snapshot())});
}
if(name==='desktop'){
for(let i=0;i<3;i++)for(const t of [.25,.5,.75]){
await page.evaluate(({i,t})=>{const ranges=__blackGeometry.snapshot().ranges;scrollTo(0,ranges[i].start+(ranges[i+1].start-ranges[i].start)*(.58+.42*t))},{i,t});
await page.waitForTimeout(150);await page.screenshot({path:`${out}/transition-${i}-${t}.png`});}
await page.evaluate(()=>scrollTo(0,0));
const end=await page.evaluate(()=>__blackGeometry.snapshot().ranges[4].start);
for(let y=0;y<end;y+=14){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(16);}
}
await context.close();}
await fs.writeFile(out+'/observations.json',JSON.stringify({errors,observations},null,2));await browser.close();console.log('Captured production targets, intermediate states and scroll video',errors);
