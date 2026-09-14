export const ENTRIES = Object.freeze([
  { id: "hero", target: "hero", section: "top" },
  { id: "education-uchicago", target: "harper", section: "education" },
  { id: "education-drexel", target: "dragon", section: "education" },
  { id: "experience-mathworks", target: "membrane", section: "experience" },
  { id: "experience-resolution", target: "resolution", section: "experience" },
  { id: "project-surface", target: "surface", section: "personal-projects" },
  { id: "project-congestion", target: "congestion", section: "personal-projects" },
  { id: "notes", target: "notes", section: "notes" },
  { id: "contact", target: "notes", section: "contact" },
]);
export const CHAPTERS = ENTRIES.map(({ id }) => id);
export const clamp = (x, lo = 0, hi = 1) =>
  Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : lo));
export const mix = (a, b, t) => a + (b - a) * clamp(t);
export const ease = (t) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const entryFor = (id) => ENTRIES.find((entry) => entry.id === id) || ENTRIES[0];

// Smooth only the artwork's sampled scroll position. Native scrolling, text and
// anchors stay immediate. Exponential damping is independent of refresh rate;
// long jumps and restored anchors resolve directly instead of touring the page.
export function smoothScroll(current, target, delta, snapDistance = 700) {
  if (!Number.isFinite(current) || Math.abs(target - current) > snapDistance) return target;
  if (Math.abs(target - current) < 0.1) return target;
  return mix(current, target, 1 - Math.exp(-Math.max(0, delta) / 0.14));
}

// These intervals are cached from DOM layout. The reading position stays fully
// visible, with an arrival fade and a gentle departure in the inter-entry gap.
export function entryReveal(y, range, next, viewportHeight) {
  const arrival = ease((y - range.start + viewportHeight * 0.42) / (viewportHeight * 0.42));
  const departure = next ? 1 - ease(((y - range.start) / Math.max(1, next.start - range.start) - 0.65) / 0.33) : 1;
  return arrival * departure;
}

// Starts are measured from individual DOM entries relative to the reading focus.
// Holding the first half gives every identity a readable settled interval. The
// second half transports material toward the next entry; no scroll history is
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
    blend: target === nextTarget ? 0 : ease((progress - 0.5) / 0.5),
  };
}

// The authored geometry already carries its recognition-preserving viewpoint.
// These are small camera changes around that view, not a second model rotation.
const TARGET_POSES = {
  hero: [0.5, 0.5, 9, 0.7, 0, 0, 1],
  harper: [0.5, 0.5, 9, 0, 0, 0, 1],
  dragon: [0.5, 0.5, 9, 0, 0.015, 0, 1],
  membrane: [0.5, 0.5, 9, 0, -0.025, 0, 1],
  resolution: [0.5, 0.5, 9, 0, 0, 0, 1],
  notes: [0.5, 0.5, 9, 0, 0, 0, 1],
  surface: [0.5, 0.5, 9, 0, 0, 0, 1],
  congestion: [0.5, 0.5, 9, 0, 0, 0, 1],
};
export const POSES = ENTRIES.map(({ target }) => TARGET_POSES[target]);
export function cameraPose(state, { time = 0, pointer = [0, 0], fullMotion = true } = {}) {
  const a = TARGET_POSES[state.target] || TARGET_POSES.hero;
  const b = TARGET_POSES[state.nextTarget] || a;
  const pose = a.map((value, i) => mix(value, b[i], state.blend));
  if (fullMotion) {
    // A slow ellipse in azimuth/elevation moves the camera around a fixed
    // center. Shared phase keeps the orbit continuous through every identity.
    const phase = time / 12;
    const elevationRange = mix(state.target === "hero" ? 0.06 : 0.12, state.nextTarget === "hero" ? 0.06 : 0.12, state.blend);
    pose[3] += Math.sin(phase) * elevationRange + clamp(pointer[1], -1, 1) * 0.025;
    pose[4] += Math.cos(phase) * 0.3 + clamp(pointer[0], -1, 1) * 0.04;
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
