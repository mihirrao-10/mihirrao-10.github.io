// Broad optical-depth regions remain stable at grazing angles and small sizes.
const BANDS=[[.015,.265,.014,.18],[.26,.625,.018,.62],[.68,.955,.014,.49],[.979,.993,.004,.16]];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function ringOpticalDepth(u,footprint=0){
  return BANDS.reduce((sum,[lo,hi,edge,density])=>{
    const w=Math.max(edge,footprint*1.5);
    const shape=.48+.52*Math.exp(-(((u-(lo+hi)*.5)/((hi-lo)*.36))**2));
    return sum+density*shape*smooth(lo-w,lo+w,u)*(1-smooth(hi-w,hi+w,u))*Math.min(1,(hi-lo)/Math.max(hi-lo,footprint*2));
  },0);
}
export const RING_PROFILE_GLSL=`
float ringBand(float u,float lo,float hi,float edge,float footprint){
 float w=max(edge,footprint*1.5);
 float shape=.48+.52*exp(-pow((u-(lo+hi)*.5)/((hi-lo)*.36),2.0));
 return shape*smoothstep(lo-w,lo+w,u)*(1.0-smoothstep(hi-w,hi+w,u))*min(1.0,(hi-lo)/max(hi-lo,footprint*2.0));
}
float ringOpticalDepth(float u,float footprint){return ${BANDS.map(([lo,hi,edge,density])=>`${density.toFixed(3)}*ringBand(u,${lo.toFixed(3)},${hi.toFixed(3)},${edge.toFixed(3)},footprint)`).join('+')};}
`;
