import test from 'node:test';
import assert from 'node:assert/strict';
import { ringOpticalDepth } from '../../src/black-geometry/ring-profile.js';

test('ring bands retain optical depth and their major division as resolution changes',()=>{
  const energies=[];
  for(const footprint of [.0001,.001,.005,.015,.03]){
    let energy=0;
    for(let i=0;i<=4000;i++){
      const value=ringOpticalDepth(i/4000,footprint);
      assert.ok(Number.isFinite(value)&&value>=0&&value<.85);energy+=value/4000;
    }
    energies.push(energy);
    assert.ok(ringOpticalDepth(.65,footprint)<ringOpticalDepth(.48,footprint)*.3);
  }
  assert.ok(Math.max(...energies)-Math.min(...energies)<.025,'Minification should not create brightness waves');
});

test('ring optical depth has broad smooth regions rather than repeated fine ridges',()=>{
  let rising=false,peaks=0,last=ringOpticalDepth(0);
  for(let i=1;i<=4000;i++){
    const value=ringOpticalDepth(i/4000);
    assert.ok(Math.abs(value-last)<.03);
    if(value>last+1e-8)rising=true;
    if(value<last-1e-8&&rising){peaks++;rising=false;}
    last=value;
  }
  assert.ok(peaks>=4&&peaks<=6,'Only the major optical-depth regions should form peaks');
});
