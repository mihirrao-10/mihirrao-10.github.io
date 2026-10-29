// CPU box filtering of the observed Cassini radial profile, for posters and QA.
const cached=new WeakMap();
export function sampleRingProfile(texture,u,footprint=0){
  const {pixels,width}=texture.userData;
  let integral=cached.get(texture);
  if(!integral){
    integral=new Float64Array(width+1);
    for(let i=0;i<width;i++)integral[i+1]=integral[i]+pixels[i]/255;
    cached.set(texture,integral);
  }
  const at=x=>{
    x=Math.max(0,Math.min(width,x));const i=Math.min(width-1,Math.floor(x));
    return integral[i]+(x-i)*pixels[i]/255;
  };
  const center=Math.max(0,Math.min(1,u))*width,half=Math.max(.5,footprint*width*.5);
  const lo=Math.max(0,center-half),hi=Math.min(width,center+half);
  return (at(hi)-at(lo))/Math.max(.00001,hi-lo);
}
