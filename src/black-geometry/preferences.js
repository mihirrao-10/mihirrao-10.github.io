// One highest-quality presentation; legacy stored display choices are ignored.
export const DEFAULTS = Object.freeze({ motion: 'on', quality: 'high' });
export const QUALITY = Object.freeze({ high: Object.freeze({ dpr: 2, fps: 60 }) });
export const motionPolicy = systemReduced => systemReduced ? 'reduced' : 'full';
