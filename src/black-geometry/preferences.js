// One highest-quality presentation; legacy stored display choices are ignored.
export const DEFAULTS = Object.freeze({ motion: 'on', quality: 'high' });
export const QUALITY = Object.freeze({ high: Object.freeze({ dpr: 2, fps: 60 }) });
export const motionPolicy = systemReduced => systemReduced ? 'reduced' : 'full';

// Keep the authored facets on every device; adjust the number of shaded pixels
// to the viewport and observed frame time instead of disabling animation.
export function renderingDpr(width, height, deviceDpr = 1, ceiling = 2) {
  return Math.max(0.75, Math.min(deviceDpr, ceiling, Math.sqrt(3000000 / Math.max(1, width * height))));
}

// Expensive ray tracing should not lower resolution on subsequent planet pages.
export function createResolutionBudget(maximum=2){
  const ceilings=new Map();let selected,elapsed=0,samples=0;
  return {
    select(name){if(name!==selected){selected=name;elapsed=samples=0;}return ceilings.get(name)??maximum;},
    record(milliseconds){
      if(!selected||!Number.isFinite(milliseconds)||milliseconds<=0)return;
      elapsed+=Math.min(milliseconds,100);samples++;
      if(samples<12||elapsed<1500)return;
      const average=elapsed/samples;elapsed=samples=0;
      const previous=ceilings.get(selected)??maximum;
      if(average>28&&previous>1.25){
        const next=Math.max(1.25,previous*.85);ceilings.set(selected,next);return next;
      }
    },
  };
}
