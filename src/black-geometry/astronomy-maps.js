import * as THREE from 'three';

export const MAP_FILES = {
  moon: 'moon-d4139e619240.bin',
  sun: 'sun-84afb4c32ecd.bin',
};

// Lossless browser downloads; raw fields remain the poster source and fallback.
export const MAP_IMAGE_FILES = {
  moon: 'moon-a0fa60493e96.webp',
  sun: 'sun-ffabe59ecedf.webp',
};

// Retained reference fields are not fetched by the current page.
export const ARCHIVE_MAP_FILES = {
  nebula: 'nebula-7bd45e2fc655.bin', 'nebula-mask': 'nebula-mask-547d32930345.bin',
  earth: 'earth-28448cc004a0.bin', jupiter: 'jupiter-c9363143c882.bin',
  cluster: 'cluster-001b58dbcf10.bin', saturn: 'saturn-73e5f977646b.bin',
  rings: 'rings-0354fe9b7f4f.bin', galaxy: 'galaxy-f1a00ed7869c.bin',
};

export function decodeMap(buffer) {
  const view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);
  const width=view.getUint16(0,true),height=view.getUint16(2,true);
  const pixels=new Uint8Array(buffer.buffer,buffer.byteOffset+4,buffer.byteLength-4);
  if(pixels.length!==width*height)throw new Error('Invalid astronomy surface map');
  return surfaceTexture(pixels,width,height);
}

function surfaceTexture(pixels,width,height) {
  const texture=new THREE.DataTexture(pixels,width,height,THREE.RedFormat);
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.wrapS=THREE.RepeatWrapping;texture.needsUpdate=true;
  texture.userData={width,height,pixels};return texture;
}

export async function decodeMapImage(blob) {
  const bitmap=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'});
  try {
    const {width,height}=bitmap,canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('Surface image decoding is unavailable');
    context.drawImage(bitmap,0,0);
    const rgba=context.getImageData(0,0,width,height).data,pixels=new Uint8Array(width*height);
    for(let i=0;i<pixels.length;i++)pixels[i]=rgba[i*4];
    canvas.width=canvas.height=0;
    return surfaceTexture(pixels,width,height);
  } finally { bitmap.close(); }
}

export async function loadAstronomyMaps() {
  const entries=await Promise.all(Object.entries(MAP_FILES).map(async([name,file])=>{
    if(typeof createImageBitmap==='function'){
      try {
        const response=await fetch(new URL(`../textures/${MAP_IMAGE_FILES[name]}`,import.meta.url));
        if(!response.ok)throw new Error('The astronomy surface image could not load');
        return [name,await decodeMapImage(await response.blob())];
      } catch { /* Older image decoders can still read the raw surface field. */ }
    }
    const compressed=typeof DecompressionStream==='function';
    const response=await fetch(new URL(`../textures/${file}${compressed?'.gz':''}`,import.meta.url));
    if(!response.ok)throw new Error('The astronomy surface maps could not load');
    let data=await response.arrayBuffer();
    if(compressed&&new Uint8Array(data)[0]===31)data=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return [name,decodeMap(new Uint8Array(data))];
  }));
  return Object.fromEntries(entries);
}
