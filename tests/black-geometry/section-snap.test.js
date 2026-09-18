import test from 'node:test';
import assert from 'node:assert/strict';
import { createSectionSnap, snapDestination, wheelDestination } from '../../src/black-geometry/section-snap.js';

const ranges = [{ start: 0, stop: 0 }, { start: 1000, stop: 1400 }, { start: 2400, stop: 2400 }];
function setup(reduced = false, entries = ranges) {
  let y = 0, timer = null, time = 0;
  const moves = [], delays = [];
  const snap = createSectionSnap({
    getY: () => y, getRanges: () => entries, now: () => time, getPageHeight: () => 1000,
    move: (top, behavior) => moves.push({ top, behavior }),
    isReduced: () => reduced, isLoading: () => false,
    setTimer: (callback, delay) => { delays.push(delay); timer = callback; return 1; }, clearTimer: () => { timer = null; },
  });
  return {
    snap, moves, delays,
    wheel: deltaY => snap.input({ type: 'wheel', deltaY, preventDefault() { assert.fail('native input must not be cancelled'); } }),
    page(deltaY, options = {}) {
      let cancelled = false;
      time += 16;
      snap.wheel({ type: 'wheel', deltaY, deltaX: 0, deltaMode: 0, cancelable: true, isTrusted: true,
        preventDefault() { cancelled = true; }, ...options });
      return cancelled;
    },
    advance(ms) { time += ms; },
    native(yNext) { y = yNext; snap.scroll(); },
    compositor(yNext) { y = yNext; },
    idle() { const callback = timer; timer = null; callback?.(); },
  };
}

test('only positions between entries snap, in the direction of native movement', () => {
  assert.equal(snapDestination(3, ranges, 1), 1000);
  assert.equal(snapDestination(997, ranges, -1), 0);
  assert.equal(snapDestination(1800, ranges, 1), 2400);
  assert.equal(snapDestination(1800, ranges, -1), 1400);
  for (const y of [0, 1000, 1200, 1400, 2400]) assert.equal(snapDestination(y, ranges, 1), null);
});

test('passive input observation itself never drives or blocks native scrolling', () => {
  const scroll = setup();
  for (const delta of [3, 120, 5000, -5000]) scroll.wheel(delta);
  scroll.idle();
  assert.deepEqual(scroll.moves, []);
});

test('wheel destinations preserve tall reading intervals and only choose adjacent entries', () => {
  assert.deepEqual(wheelDestination(0, ranges, 1), { top: 1000, reading: false });
  assert.deepEqual(wheelDestination(1000, ranges, 1), { top: 1400, reading: true });
  assert.deepEqual(wheelDestination(1400, ranges, 1), { top: 2400, reading: false });
  assert.deepEqual(wheelDestination(1400, ranges, -1), { top: 1000, reading: true });
  assert.deepEqual(wheelDestination(1000, ranges, -1), { top: 0, reading: false });
  assert.deepEqual(wheelDestination(1700, ranges, -1), { top: 1400, reading: false });
  assert.equal(wheelDestination(0, ranges, -1), null);
  assert.equal(wheelDestination(2400, ranges, 1), null);
});

test('one large wheel gesture and its long momentum tail advance exactly one entry', () => {
  const scroll = setup();
  assert.equal(scroll.page(5000), true);
  assert.deepEqual(scroll.moves, [{ top: 0, behavior: 'instant' }, { top: 1000, behavior: 'smooth' }]);
  scroll.native(1000);
  for (let i = 0; i < 100; i++) assert.equal(scroll.page(Math.max(.1, 120 - i * 2)), true);
  assert.equal(scroll.moves.length, 2, 'Momentum remains consumed after the animation finishes');
});

test('delayed delivery does not split wheel packets from the same physical gesture', () => {
  const scroll = setup();
  scroll.page(120, { timeStamp: 1000 }); scroll.native(1000);
  scroll.advance(1000); scroll.page(60, { timeStamp: 1016 });
  assert.equal(scroll.moves.length, 2);
});

test('fresh wheel gestures advance immediately without waiting for animation completion', () => {
  const scroll = setup(false, [0, 1000, 2000, 3000].map(start => ({ start, stop: start })));
  scroll.page(3); scroll.native(400); scroll.advance(210); scroll.page(3);
  assert.deepEqual(scroll.moves.at(-1), { top: 2000, behavior: 'smooth' });
  scroll.native(2000); scroll.advance(210); scroll.page(3);
  assert.deepEqual(scroll.moves.at(-1), { top: 3000, behavior: 'smooth' });
});

test('reversing a wheel gesture immediately returns to the previous entry', () => {
  const scroll = setup();
  scroll.page(120); scroll.native(400); scroll.page(-.3);
  assert.deepEqual(scroll.moves.at(-1), { top: 0, behavior: 'smooth' });
  scroll.native(0);
  const count = scroll.moves.length;
  for (let i = 0; i < 60; i++) scroll.page(-3);
  assert.equal(scroll.moves.length, count);
});

test('native reading stops at the entry boundary before a new gesture can leave it', () => {
  const scroll = setup();
  scroll.native(1000);
  assert.equal(scroll.page(120), false);
  scroll.native(1120); scroll.idle();
  assert.deepEqual(scroll.moves, []);
  assert.equal(scroll.page(5000), true);
  assert.deepEqual(scroll.moves.at(-1), { top: 1400, behavior: 'smooth' });
  scroll.native(1400);
  const count = scroll.moves.length;
  for (let i = 0; i < 60; i++) scroll.page(60);
  assert.equal(scroll.moves.length, count);
  scroll.advance(210); scroll.page(120);
  assert.deepEqual(scroll.moves.at(-1), { top: 2400, behavior: 'smooth' });
});

test('line and page wheel deltas cannot escape a long reading entry', () => {
  for (const [deltaY, deltaMode] of [[30, 1], [1, 2]]) {
    const scroll = setup(); scroll.native(1000);
    assert.equal(scroll.page(deltaY, { deltaMode }), true);
    assert.deepEqual(scroll.moves.at(-1), { top: 1400, behavior: 'smooth' });
  }
});

test('zoom, horizontal gestures and synthetic input are never claimed by wheel paging', () => {
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { deltaX: 200 }, { isTrusted: false }, { cancelable: false }]) {
    const scroll = setup();
    assert.equal(scroll.page(120, options), false);
    assert.deepEqual(scroll.moves, []);
  }
});

test('native movement schedules alignment without an idle delay', () => {
  const scroll = setup();
  scroll.wheel(120); scroll.native(120); scroll.native(300);
  assert.deepEqual(scroll.moves, []);
  assert.ok(scroll.delays.every(delay => delay === 0));
  scroll.idle();
  assert.deepEqual(scroll.moves, [{ top: 300, behavior: 'instant' }, { top: 1000, behavior: 'smooth' }]);
});

test('long entries remain at the reading position chosen by the visitor', () => {
  const scroll = setup();
  scroll.native(1000); scroll.wheel(120); scroll.native(1120); scroll.idle();
  assert.deepEqual(scroll.moves, []);
});

test('native movement can begin after the input task without losing alignment', () => {
  const scroll = setup();
  scroll.wheel(120); scroll.idle();
  assert.deepEqual(scroll.moves, []);
  scroll.native(120); scroll.idle();
  assert.deepEqual(scroll.moves.at(-1), { top: 1000, behavior: 'smooth' });
});

test('one native scroll can cross a long reading interval and align immediately', () => {
  const scroll = setup();
  scroll.native(1000); scroll.wheel(120); scroll.native(1120); scroll.idle();
  assert.deepEqual(scroll.moves, []);
  scroll.native(1700);
  assert.equal(scroll.delays.at(-1), 0);
  scroll.idle();
  assert.deepEqual(scroll.moves.at(-1), { top: 2400, behavior: 'smooth' });
});

test('passive wheel delivery after compositor movement preserves direction', () => {
  const scroll = setup();
  scroll.compositor(120); scroll.wheel(120); scroll.snap.scroll(); scroll.idle();
  assert.deepEqual(scroll.moves.at(-1), { top: 1000, behavior: 'smooth' });
  scroll.native(1000);
  scroll.native(880); scroll.wheel(-120); scroll.idle();
  assert.deepEqual(scroll.moves.at(-1), { top: 0, behavior: 'smooth' });
});

test('fractional trackpad movement keeps its direction without a minimum delta', () => {
  const scroll = setup();
  for (let y = .3; y < 3; y += .3) { scroll.wheel(.3); scroll.native(y); }
  scroll.idle();
  assert.deepEqual(scroll.moves.at(-1), { top: 1000, behavior: 'smooth' });
});

test('new input interrupts alignment and the browser can immediately reverse', () => {
  const scroll = setup();
  scroll.wheel(120); scroll.native(120); scroll.idle();
  scroll.native(400); scroll.wheel(-120);
  assert.deepEqual(scroll.moves.at(-1), { top: 400, behavior: 'instant' });
  scroll.native(280); scroll.idle();
  assert.deepEqual(scroll.moves.at(-1), { top: 0, behavior: 'smooth' });
});

test('continued wheel input lets a snap finish without restarting its easing', () => {
  const scroll = setup();
  scroll.wheel(120); scroll.native(120); scroll.idle();
  for (const y of [200, 350, 600, 850]) { scroll.native(y); scroll.wheel(120); scroll.idle(); }
  assert.deepEqual(scroll.moves, [{ top: 120, behavior: 'instant' }, { top: 1000, behavior: 'smooth' }]);
  scroll.native(1000); scroll.idle();
  scroll.wheel(120); scroll.native(1120); scroll.idle();
  assert.equal(scroll.moves.length, 2, 'The long entry remains readable');
});

test('a reversed wheel cancels even when native reversal arrives before the input event', () => {
  const scroll = setup();
  scroll.wheel(120); scroll.native(120); scroll.idle();
  scroll.native(400); scroll.native(350); scroll.wheel(-120);
  assert.deepEqual(scroll.moves.at(-1), { top: 350, behavior: 'instant' });
  scroll.idle();
  assert.deepEqual(scroll.moves.at(-1), { top: 0, behavior: 'smooth' });
});

test('a tiny reversal cannot inherit the cancelled animation direction', () => {
  const scroll = setup();
  scroll.wheel(120); scroll.native(120); scroll.idle();
  scroll.native(400); scroll.compositor(420); scroll.wheel(-3);
  scroll.snap.scroll(); scroll.idle();
  assert.deepEqual(scroll.moves.at(-1), { top: 0, behavior: 'smooth' });
});

test('native movement past a snap target cannot leave alignment stuck', () => {
  const scroll = setup();
  scroll.wheel(120); scroll.native(120); scroll.idle();
  scroll.wheel(2000); scroll.native(1700); scroll.idle();
  assert.deepEqual(scroll.moves, [
    { top: 120, behavior: 'instant' }, { top: 1000, behavior: 'smooth' },
    { top: 1700, behavior: 'instant' }, { top: 2400, behavior: 'smooth' },
  ]);
});

test('holding a pointer or finger prevents snapping until release', () => {
  const scroll = setup();
  scroll.snap.pointerDown(); scroll.wheel(120); scroll.native(120); scroll.idle();
  assert.equal(scroll.moves.length, 0);
  scroll.snap.pointerUp(); scroll.idle();
  assert.equal(scroll.moves.at(-1).top, 1000);
  const touch = setup();
  touch.snap.touchStart({ type: 'touchstart', touches: [{}] });
  touch.native(200); touch.snap.pointerUp(); touch.idle();
  assert.deepEqual(touch.moves, []);
  touch.snap.touchEnd({ touches: [] }); touch.idle();
  assert.equal(touch.moves.at(-1).top, 1000);
});

test('hashes, focus and programmatic positioning are not rewritten', () => {
  const scroll = setup();
  scroll.native(700); scroll.idle();
  assert.deepEqual(scroll.moves, []);
  scroll.wheel(120); scroll.native(800); scroll.snap.reset(); scroll.idle();
  assert.deepEqual(scroll.moves, []);
});

test('reduced motion uses an immediate final alignment', () => {
  const scroll = setup(true);
  scroll.wheel(120); scroll.native(120); scroll.idle();
  assert.deepEqual(scroll.moves, [{ top: 1000, behavior: 'instant' }]);
});
