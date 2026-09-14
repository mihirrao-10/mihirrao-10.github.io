import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAPTERS,
  chapterState,
  cameraPose,
  clamp,
  mix,
  createProjectState,
  startReplay,
  advanceReplay,
  chooseShortcut,
} from "../../src/black-geometry/scene-state.js";
import {
  surfaceData,
  surfacePoint,
  pathPoint,
  TAU,
} from "../../src/black-geometry/geometry.js";
const starts = [0, 710, 1095, 1510, 1950, 2390, 2820, 3270, 3775, 4420, 5100, 6490];
const ranges = CHAPTERS.map((id, index) => ({ id, start: starts[index], end: 6650 }));
test("individual entries resolve the correct institution, project and recurring identity", () => {
  const targets = ["hero", "harper", "dragon", "membrane", "neutral", "dragon", "harper", "dragon", "surface", "congestion", "neutral", "neutral"];
  assert.equal(chapterState(-100, ranges).chapter, "hero");
  for (let index = 0; index < ranges.length; index++) {
    const state = chapterState(starts[index], ranges);
    assert.equal(state.chapter, CHAPTERS[index]);
    assert.equal(state.target, targets[index]);
    assert.equal(state.nextTarget, targets[Math.min(index + 1, targets.length - 1)]);
    assert.equal(state.blend, 0);
  }
  assert.equal(chapterState(99999, ranges).chapter, "contact");
  assert.equal(chapterState(99999, ranges).progress, 1);
  assert.equal(chapterState(NaN, []).target, "hero");
  assert.equal(chapterState(1095, ranges).section, "education");
  assert.equal(chapterState(1510, ranges).section, "experience");
  assert.equal(chapterState(3775, ranges).section, "personal-projects");
});
test("measured unequal entry intervals have substantial holds and continuous reversible morphs", () => {
  for (let i = 0; i < ranges.length - 1; i++) {
    const length = starts[i + 1] - starts[i];
    assert.equal(chapterState(starts[i] + length * 0.5, ranges).blend, 0);
    const during = chapterState(starts[i] + length * 0.8, ranges);
    if (during.target !== during.nextTarget) assert.ok(during.blend > 0 && during.blend < 1);
    else assert.equal(during.blend, 0);
    const justBefore = chapterState(starts[i + 1] - 0.0001, ranges);
    const at = chapterState(starts[i + 1], ranges);
    assert.equal(justBefore.nextTarget, at.target);
    const a = cameraPose(justBefore, { fullMotion: false });
    const b = cameraPose(at, { fullMotion: false });
    assert.ok(a.every((value, j) => Math.abs(value - b[j]) < 0.0001));
    const movingA = cameraPose(justBefore, { time: 37, pointer: [0.3, -0.2] });
    const movingB = cameraPose(at, { time: 37, pointer: [0.3, -0.2] });
    assert.ok(movingA.every((value, j) => Math.abs(value - movingB[j]) < 0.0001));
  }
  // Layout changes alter ranges, not a hidden page-wide percentage or direction state.
  const resized = ranges.map((range, i) => ({ ...range, start: range.start + i * 73 }));
  assert.equal(chapterState(resized[3].start, resized).target, "membrane");
  assert.notEqual(chapterState(resized[3].start, ranges).progress, 0);
});
test("reverse, fast jumps and restored positions reconstruct identical finite state", () => {
  const initial = chapterState(1800, ranges);
  [0, 4800, 300, 6500, 900, 3200].forEach((y) => chapterState(y, ranges));
  assert.deepEqual(chapterState(1800, ranges), initial);
  for (let y = 0; y < 6650; y += 11) {
    const state = chapterState(y, ranges);
    assert.ok(cameraPose(state).every(Number.isFinite));
    assert.ok(state.progress >= 0 && state.progress <= 1);
    assert.ok(state.blend >= 0 && state.blend <= 1);
  }
  assert.equal(clamp(NaN), 0);
  assert.equal(clamp(Infinity), 0);
  assert.equal(mix(2, 4, 2), 4);
  const state = chapterState(0, ranges);
  assert.deepEqual(cameraPose(state, { time: 50, pointer: [9, -9], fullMotion: false }), cameraPose(state, { fullMotion: false }));
  assert.deepEqual(cameraPose(state, { pointer: [1, -1] }), cameraPose(state, { pointer: [999, -999] }));
  // Mobile retains the authored sculpture size; composition happens in its viewport.
  assert.equal(cameraPose(state, { mobile: true, width: 320 })[6], cameraPose(state)[6]);
});
test("replay restarts, pauses outside updates, finishes, and is immediate with reduced/off motion", () => {
  let state = startReplay(createProjectState(), "full");
  assert.equal(state.path, 0);
  state = advanceReplay(state, 0.02);
  assert.ok(state.path > 0 && state.path < 1);
  state = startReplay(state, "full");
  assert.equal(state.path, 0);
  for (let i = 0; i < 200; i++) state = advanceReplay(state, 0.025);
  assert.equal(state.path, 1);
  assert.equal(state.replaying, false);
  for (const motion of ["reduced", "off"])
    assert.equal(startReplay(state, motion).path, 1);
  assert.equal(advanceReplay(startReplay(state, "full"), 50).path, 0.05 / 2.7);
});
test("shortcut selection is deterministic and independent of replay", () => {
  const state = startReplay(createProjectState(), "full");
  const closed = chooseShortcut(state, "closed");
  assert.equal(closed.shortcut, "closed");
  assert.equal(closed.path, state.path);
  assert.equal(chooseShortcut(closed, "open").shortcut, "open");
});
test("procedural surface is deterministic, closed, finite, and free of zero-area triangles", () => {
  const mesh = surfaceData(40, 16);
  assert.deepEqual(mesh, surfaceData(40, 16));
  const edges = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = mesh.indices.slice(i, i + 3),
      [a, b, c] = ids.map((j) => mesh.positions.slice(j * 3, j * 3 + 3));
    const u = b.map((v, j) => v - a[j]),
      v = c.map((value, j) => value - a[j]);
    const cross = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    assert.ok(Math.hypot(...cross) > 1e-5);
    for (let j = 0; j < 3; j++) {
      const key = [ids[j], ids[(j + 1) % 3]].sort((x, y) => x - y).join(",");
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  assert.ok([...edges.values()].every((count) => count === 2));
  assert.ok(mesh.positions.every(Number.isFinite));
  const p = surfacePoint(0.7, 1.2),
    q = surfacePoint(0.7 + TAU, 1.2 + TAU);
  assert.ok(p.every((v, i) => Math.abs(v - q[i]) < 1e-12));
});
test("illustrative route follows the original surface with a small positive separation", () => {
  for (let i = 0; i <= 100; i++) {
    const t = i / 100,
      a = pathPoint(t),
      b = surfacePoint(0.15 + t * 2.65, 1.2 + 0.28 * Math.sin(t * Math.PI));
    const distance = Math.hypot(...a.map((v, j) => v - b[j]));
    assert.ok(distance > 0.016 && distance < 0.032);
  }
});
