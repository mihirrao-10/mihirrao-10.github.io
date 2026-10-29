import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { MAP_FILES, decodeMap } from '../../src/black-geometry/astronomy-maps.js';
import { traceBlackHole } from '../../src/black-geometry/black-hole.js';

for (const [name,file] of Object.entries(MAP_FILES)) test(`${name} map retains its dimensions, content hash, and compressed fallback parity`,()=>{
  const url=new URL(`../../assets/black-geometry/textures/${file}`,import.meta.url),bytes=fs.readFileSync(url);
  assert.ok(file.includes(createHash('sha256').update(bytes).digest('hex').slice(0,12)));
  assert.deepEqual(gunzipSync(fs.readFileSync(new URL(`${url}.gz`))),bytes);
  const map=decodeMap(bytes),{width,height,pixels}=map.userData;
  assert.equal(width,2048);assert.equal(height,1024);assert.equal(pixels.length,width*height);
  const values=new Set(pixels);assert.ok(values.size>128, 'Terrain shading must retain a broad grayscale range');
  map.dispose();
});

test('light-bending samples retain a clear shadow surrounded by structured accretion light',()=>{
  const samples=[];
  const origin=[0,1.7,12];
  for(let y=-1.5;y<=1.5;y+=.15)for(let x=-3;x<=3;x+=.15){
    const direction=[x-origin[0],y-origin[1],-origin[2]],norm=Math.hypot(...direction);
    for(let i=0;i<3;i++)direction[i]/=norm;
    const b=origin.reduce((s,v,i)=>s+v*direction[i],0),disc=b*b-(origin.reduce((s,v)=>s+v*v,0)-3.3**2);
    if(disc<0)continue;
    const distance=-b-Math.sqrt(disc),p=origin.map((v,i)=>v+direction[i]*(distance+.001));
    samples.push(traceBlackHole(...p,...direction));
  }
  assert.ok(samples.every(v=>Number.isFinite(v)&&v>=0&&v<=.98));
  assert.ok(samples.filter(v=>v<.01).length>20);
  assert.ok(samples.filter(v=>v>.6).length>20);
  assert.ok(new Set(samples.map(v=>Math.round(v*100))).size>60, 'The disk must have tonal detail instead of one opaque band');
});
