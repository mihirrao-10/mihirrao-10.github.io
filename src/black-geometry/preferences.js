// One highest-quality presentation; legacy stored display choices are ignored.
export const DEFAULTS = Object.freeze({ motion: 'on', quality: 'high' });
export const QUALITY = Object.freeze({ high: Object.freeze({ dpr: 2, fps: 60 }) });
export const motionPolicy = systemReduced => systemReduced ? 'reduced' : 'full';

// Keep the authored facets on every device; adjust the number of shaded pixels
// to the viewport and observed frame time instead of disabling animation.
export function renderingDpr(width, height, deviceDpr = 1, ceiling = 2) {
  return Math.max(0.75, Math.min(deviceDpr, ceiling, Math.sqrt(1500000 / Math.max(1, width * height))));
}
