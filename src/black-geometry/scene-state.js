export const ENTRIES = Object.freeze([
  { id: "hero", target: "hero", section: "top" },
  { id: "education-uchicago", target: "phoenix", section: "education" },
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

// Select the nearest valid native snap interval. Oversized reading areas keep
// their identity while the visitor reads anywhere between start and stop.
export function chapterState(scrollY, ranges) {
  const y = Math.max(0, Number.isFinite(scrollY) ? scrollY : 0);
  if (!ranges.length) return { chapter: "hero", section: "top", target: "hero", nextTarget: "hero", index: 0, next: 0, progress: 0, blend: 0 };
  let index = 0;
  while (index < ranges.length - 1) {
    const current = ranges[index], following = ranges[index + 1];
    const stop = Math.min(following.start, Math.max(current.start, current.stop ?? current.start));
    if (y < (stop + following.start) / 2) break;
    index++;
  }
  const range = ranges[index], entry = entryFor(range.id);
  const target = range.target || entry.target;
  const end = ranges[index + 1]?.start ?? range.end;
  return { chapter: range.id, section: range.section || entry.section, target, nextTarget: target,
    index, next: index, progress: clamp((y-range.start)/Math.max(1,end-range.start)), blend: 0 };
}

export const TRANSITION_SECONDS = 0.38;
export const createTransition = (target = "hero") => ({ from: target, to: target, elapsed: 0, blend: 0 });
// Eased elapsed time always finishes, independent of where scrolling stops.
// Reversals reuse the same dissolve coverage; fast skips take the dominant mesh.
export function advanceTransition(previous, target, delta) {
  let state = previous;
  if (target !== state.to) {
    if (target === state.from) state = { from: state.to, to: state.from, elapsed: TRANSITION_SECONDS-state.elapsed };
    else state = { from: state.blend < 0.5 ? state.from : state.to, to: target, elapsed: 0 };
  }
  if (state.from === state.to) return createTransition(target);
  const elapsed = state.elapsed + (Number.isFinite(delta) ? Math.max(0,delta) : 0);
  if (elapsed >= TRANSITION_SECONDS) return createTransition(target);
  return { ...state, elapsed, blend: ease(elapsed/TRANSITION_SECONDS) };
}

// Authored geometry carries its initial presentation angle. These small target
// offsets preserve one continuous camera orbit across chapter boundaries.
const TARGET_POSES = {
  hero: [0.5, 0.5, 9, 0, 0, 0, 1],
  phoenix: [0.5, 0.5, 9, 0, 0, 0, 1],
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
    // Continuous orbit, with an elevated, gently tilting viewpoint. The shared
    // clock pauses during a grab and stays continuous through every identity.
    pose[3] += 0.2 + Math.sin(time * 0.23) * 0.18 + clamp(pointer[1], -1, 1) * 0.025;
    pose[4] += 0.28 + time * 0.105 + clamp(pointer[0], -1, 1) * 0.04;
    pose[5] += Math.sin(time * 0.17) * 0.08;
  }
  return pose;
}
