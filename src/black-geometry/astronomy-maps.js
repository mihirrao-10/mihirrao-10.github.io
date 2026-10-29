import * as THREE from 'three';

export const MAP_FILES = {
  "earth": "earth-28448cc004a0.bin",
  "moon": "moon-d4139e619240.bin"
};

export function decodeMap(buffer) {
  const view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);
  const width=view.getUint16(0,true),height=view.getUint16(2,true);
  const pixels=new Uint8Array(buffer.buffer,buffer.byteOffset+4,buffer.byteLength-4);
  if(pixels.length!==width*height)throw new Error('Invalid astronomy surface map');
  const texture=new THREE.DataTexture(pixels,width,height,THREE.RedFormat);
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.wrapS=THREE.RepeatWrapping;texture.needsUpdate=true;
  texture.userData={width,height,pixels};return texture;
}
export async function loadAstronomyMaps() {
  const entries=await Promise.all(Object.entries(MAP_FILES).map(async([name,file])=>{
    const compressed=typeof DecompressionStream==='function';
    const response=await fetch(new URL(`../textures/${file}${compressed?'.gz':''}`,import.meta.url));
    if(!response.ok)throw new Error('The astronomy surface maps could not load');
    let data=await response.arrayBuffer();
    if(compressed&&new Uint8Array(data)[0]===31)data=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return [name,decodeMap(new Uint8Array(data))];
  }));
  return Object.fromEntries(entries);
}
