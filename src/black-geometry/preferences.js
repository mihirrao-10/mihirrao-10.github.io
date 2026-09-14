export const STORAGE_KEY = "mihir.black-geometry.display.v1";
export const DEFAULTS = Object.freeze({ motion: "system", quality: "auto" });
export function readPreferences(storage) {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    return {
      motion: ["system", "off"].includes(value?.motion)
        ? value.motion
        : "system",
      quality: ["auto", "low", "high"].includes(value?.quality)
        ? value.quality
        : "auto",
    };
  } catch {
    return { ...DEFAULTS };
  }
}
export function savePreferences(storage, preferences) {
  try {
    // Enabling motion over an OS request is a deliberate choice for this visit only.
    storage?.setItem(
      STORAGE_KEY,
      JSON.stringify({
        motion: preferences.motion === "on" ? "system" : preferences.motion,
        quality: preferences.quality,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function motionPolicy(choice, systemReduced) {
  if (choice === "off") return "off";
  if (choice === "on") return "full";
  return systemReduced ? "reduced" : "full";
}
export const QUALITY = {
  low: { around: 40, across: 16, dpr: 1, fps: 30 },
  medium: { around: 64, across: 24, dpr: 1.5, fps: 60 },
  high: { around: 84, across: 32, dpr: 1.5, fps: 60 },
};
export function qualityPolicy(
  choice,
  { width = 1440, cores = 8, downgraded = false } = {},
) {
  if (choice === "low" || choice === "high") return choice;
  return downgraded || width < 800 || cores <= 4 ? "low" : "medium";
}
// Warm-up is handled by the caller. Two slow windows downgrade once per visit.
export function assessPerformance(samples, slowWindows = 0) {
  if (samples.length < 60) return { slowWindows, downgrade: false };
  const sorted = [...samples].sort((a, b) => a - b);
  const slow = sorted[Math.floor(sorted.length * 0.95)] > 33;
  const next = slow ? slowWindows + 1 : 0;
  return { slowWindows: next, downgrade: next >= 2 };
}
