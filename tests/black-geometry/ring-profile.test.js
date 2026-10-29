import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MAP_FILES, decodeMap } from '../../src/black-geometry/astronomy-maps.js';
import { sampleRingProfile } from '../../src/black-geometry/ring-profile.js';
const map=decodeMap(fs.readFileSync(new URL(`../../assets/black-geometry/textures/${MAP_FILES.rings}`,import.meta.url)));

test('observed ring profile preserves optical depth and its main division across resolutions',()=>{
  const energies=[];
  for(const footprint of [.0001,.001,.005,.015,.03]){
    let energy=0;
    for(let i=0;i<=4000;i++){
      const value=sampleRingProfile(map,i/4000,footprint);
      assert.ok(Number.isFinite(value)&&value>=0&&value<.9);energy+=value/4000;
    }
    energies.push(energy);
    assert.ok(sampleRingProfile(map,.71,footprint)<sampleRingProfile(map,.48,footprint)*.3);
  }
  assert.ok(Math.max(...energies)-Math.min(...energies)<.015,'Filtering should preserve mean brightness');
});

test('Cassini-derived bands retain fine tonal changes instead of uniform fills',()=>{
  const values=[];
  for(let i=1400;i<=2600;i++)values.push(sampleRingProfile(map,i/4096));
  assert.ok(new Set(values.map(v=>Math.round(v*255))).size>30,'The dense ring must retain observed structure');
  assert.ok(new Set(map.userData.pixels).size>180);
  const smooth=values.map((_,i)=>sampleRingProfile(map,(1400+i)/4096,.02));
  const variation=data=>data.slice(1).reduce((sum,v,i)=>sum+Math.abs(v-data[i]),0);
  assert.ok(variation(smooth)<variation(values)*.4,'Subpixel detail should average out rather than shimmer');
});
