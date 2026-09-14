export const ENTRIES = Object.freeze([
  { id: "hero", target: "hero", section: "top" },
  { id: "education-uchicago", target: "harper", section: "education" },
  { id: "education-drexel", target: "dragon", section: "education" },
  { id: "experience-mathworks", target: "membrane", section: "experience" },
  { id: "experience-resolution", target: "neutral", section: "experience" },
  { id: "research-drexel", target: "dragon", section: "research" },
  { id: "teaching-uchicago", target: "harper", section: "teaching" },
  { id: "teaching-drexel", target: "dragon", section: "teaching" },
  { id: "project-surface", target: "surface", section: "personal-projects" },
  { id: "project-congestion", target: "congestion", section: "personal-projects" },
  { id: "notes", target: "neutral", section: "notes" },
  { id: "contact", target: "neutral", section: "contact" },
]);
export const CHAPTERS = ENTRIES.map(({ id }) => id);
export const clamp = (x, lo = 0, hi = 1) =>
  Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : lo));
export const mix = (a, b, t) => a + (b - a) * clamp(t);
export const ease = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const entryFor = (id) => ENTRIES.find((entry) => entry.id === id) || ENTRIES[0];

// Starts are measured from individual DOM entries relative to the reading focus.
// Holding the first 58% gives every identity a readable settled interval. Only
// the final 42% transports material toward the next entry; no scroll history is
// involved, so reversals, interrupted transitions and restored positions agree.
export function chapterState(scrollY, ranges) {
  const y = Math.max(0, Number.isFinite(scrollY) ? scrollY : 0);
  if (!ranges.length) return {
    chapter: "hero", section: "top", target: "hero", nextTarget: "hero",
    index: 0, next: 0, progress: 0, blend: 0,
  };
  let index = 0;
  while (index < ranges.length - 1 && y >= ranges[index + 1].start) index++;
  const range = ranges[index];
  const next = Math.min(index + 1, ranges.length - 1);
  const following = ranges[next];
  const end = index === next ? range.end : following.start;
  const progress = clamp((y - range.start) / Math.max(1, end - range.start));
  const entry = entryFor(range.id);
  const target = range.target || entry.target;
  const nextTarget = following.target || entryFor(following.id).target;
  return {
    chapter: range.id,
    section: range.section || entry.section,
    target,
    nextTarget,
    index,
    next,
    progress,
    blend: target === nextTarget ? 0 : ease((progress - 0.58) / 0.42),
  };
}

// The authored geometry already carries its recognition-preserving viewpoint.
// These are small camera changes around that view, not a second model rotation.
const TARGET_POSES = {
  hero: [0.5, 0.5, 9, 0, 0, 0, 1],
  harper: [0.5, 0.5, 9, 0, 0, 0, 1],
  dragon: [0.5, 0.5, 9, 0, 0.015, 0, 1],
  membrane: [0.5, 0.5, 9, 0, -0.025, 0, 1],
  neutral: [0.5, 0.5, 9, 0.018, 0.025, 0, 0.94],
  surface: [0.5, 0.5, 9, 0, 0, 0, 1],
  congestion: [0.5, 0.5, 9, 0, 0, 0, 1],
};
export const POSES = ENTRIES.map(({ target }) => TARGET_POSES[target]);
export function cameraPose(state, { time = 0, pointer = [0, 0], fullMotion = true } = {}) {
  const a = TARGET_POSES[state.target] || TARGET_POSES.hero;
  const b = TARGET_POSES[state.nextTarget] || a;
  const pose = a.map((value, i) => mix(value, b[i], state.blend));
  if (fullMotion) {
    const idle = (target) => {
      const hero = target === "hero";
      const amplitude = hero ? 0.12 : target === "neutral" ? 0.065 : 0.021;
      return [Math.sin(time / (hero ? 3.8 : 5.7)) * amplitude * 0.5,
        Math.sin(time / (hero ? 5.1 : 7.3)) * amplitude];
    };
    const from = idle(state.target), to = idle(state.nextTarget);
    pose[3] += mix(from[0], to[0], state.blend) + clamp(pointer[1], -1, 1) * 0.014;
    pose[4] += mix(from[1], to[1], state.blend) + clamp(pointer[0], -1, 1) * 0.023;
  }
  return pose;
}
export function createProjectState() {
  return { shortcut: "open", path: 1, replaying: false, deliberate: false, seen: false };
}
export function startReplay(state, motion, deliberate = true) {
  return { ...state, path: motion === "full" ? 0 : 1, replaying: motion === "full", deliberate, seen: true };
}
export function advanceReplay(state, delta) {
  if (!state.replaying) return state;
  const path = clamp(state.path + clamp(delta, 0, 0.05) / 2.7);
  return { ...state, path, replaying: path < 1 };
}
export function chooseShortcut(state, choice) {
  return { ...state, shortcut: choice === "closed" ? "closed" : "open" };
}
