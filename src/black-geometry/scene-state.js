export const CHAPTERS = [
  "hero",
  "education",
  "experience",
  "research",
  "teaching",
  "project-surface",
  "project-congestion",
  "notes",
  "contact",
];
export const clamp = (x, lo = 0, hi = 1) =>
  Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : lo));
export const mix = (a, b, t) => a + (b - a) * clamp(t);
export const ease = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
// x/y are fractions of the viewport, z is camera distance. One source for all poses.
export const POSES = [
  [0.7, 0.51, 8.0, -0.64, -0.32, -0.32, 1.08],
  [0.74, 0.5, 8.7, -0.48, -0.18, -0.25, 0.77],
  [0.74, 0.5, 8.4, -0.36, 0.04, -0.23, 0.8],
  [0.74, 0.5, 8.3, -0.42, 0.16, -0.2, 0.8],
  [0.74, 0.51, 8.5, -0.5, 0.22, -0.18, 0.78],
  [0.78, 0.54, 8.1, -0.64, -0.32, -0.32, 0.68],
  [0.78, 0.53, 8.8, -0.48, -0.12, -0.24, 0.65],
  [0.79, 0.53, 9.4, -0.25, 0.24, -0.24, 0.72],
  [0.8, 0.58, 10, -0.25, 0.24, -0.24, 0.4],
];
export function chapterState(scrollY, ranges) {
  if (!ranges.length)
    return { chapter: "hero", index: 0, next: 0, progress: 0, blend: 0 };
  const y = Math.max(0, Number.isFinite(scrollY) ? scrollY : 0);
  let index = 0;
  while (index < ranges.length - 1 && y >= ranges[index + 1].start) index++;
  const range = ranges[index];
  const end = ranges[index + 1]?.start ?? range.end;
  const progress = clamp((y - range.start) / Math.max(1, end - range.start));
  return {
    chapter: range.id,
    index,
    next: Math.min(index + 1, ranges.length - 1),
    progress,
    blend: ease((progress - 0.7) / 0.3),
  };
}
export function cameraPose(
  state,
  {
    mobile = false,
    width = 390,
    time = 0,
    pointer = [0, 0],
    fullMotion = true,
  } = {},
) {
  const a = POSES[state.index] || POSES[0],
    b = POSES[state.next] || a;
  const pose = a.map((value, i) => mix(value, b[i], state.blend));
  if (mobile) {
    pose[0] = 0.46;
    pose[1] = state.index === 0 ? 0.68 : 0.6;
    pose[6] *= 0.41 * Math.min(1.7, width / 390);
  }
  if (fullMotion) {
    pose[3] += Math.sin(time / 11) * 0.025 + clamp(pointer[1], -1, 1) * 0.025;
    pose[4] += Math.sin(time / 13) * 0.04 + clamp(pointer[0], -1, 1) * 0.035;
  }
  return pose;
}
export function createProjectState() {
  return {
    shortcut: "open",
    path: 1,
    replaying: false,
    deliberate: false,
    seen: false,
  };
}
export function startReplay(state, motion, deliberate = true) {
  return {
    ...state,
    path: motion === "full" ? 0 : 1,
    replaying: motion === "full",
    deliberate,
    seen: true,
  };
}
export function advanceReplay(state, delta) {
  if (!state.replaying) return state;
  const path = clamp(state.path + clamp(delta, 0, 0.05) / 2.7);
  return { ...state, path, replaying: path < 1 };
}
export function chooseShortcut(state, choice) {
  return { ...state, shortcut: choice === "closed" ? "closed" : "open" };
}
