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
const ranges = CHAPTERS.map((id, index) => ({
  id,
  start: index * 400,
  end: 3600,
}));
test("chapter selection handles beginnings, exact boundaries, jumps and the end", () => {
  assert.equal(chapterState(-100, ranges).chapter, "hero");
  assert.equal(chapterState(399, ranges).chapter, "hero");
  assert.equal(chapterState(400, ranges).chapter, "education");
  assert.equal(chapterState(1420, ranges).chapter, "research");
  assert.equal(chapterState(99999, ranges).chapter, "contact");
  assert.equal(chapterState(99999, ranges).progress, 1);
  assert.equal(chapterState(NaN, []).chapter, "hero");
});
test("scene reconstruction is independent of forward, backward or restored scroll history", () => {
  const initial = chapterState(1777, ranges);
  [0, 1600, 300, 3700, 900].forEach((y) => chapterState(y, ranges));
  assert.deepEqual(chapterState(1777, ranges), initial);
  for (let y = 0; y < 3600; y += 11) {
    const state = chapterState(y, ranges),
      pose = cameraPose(state);
    assert.ok(pose.every(Number.isFinite));
    assert.ok(state.progress >= 0 && state.progress <= 1);
  }
});
test("camera transforms are continuous at every chapter boundary and bounded", () => {
  for (let i = 1; i < CHAPTERS.length; i++) {
    const a = cameraPose(chapterState(i * 400 - 0.001, ranges)),
      b = cameraPose(chapterState(i * 400, ranges));
    assert.ok(a.every((value, j) => Math.abs(value - b[j]) < 0.0001));
  }
  assert.equal(clamp(NaN), 0);
  assert.equal(clamp(Infinity), 0);
  assert.equal(mix(2, 4, 2), 4);
  const s = chapterState(0, ranges);
  assert.deepEqual(
    cameraPose(s, { time: 50, pointer: [9, -9], fullMotion: false }),
    cameraPose(s, { fullMotion: false }),
  );
  const a = cameraPose(s, { pointer: [1, -1] }),
    b = cameraPose(s, { pointer: [999, -999] });
  assert.deepEqual(a, b);
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
