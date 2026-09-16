import test from 'node:test';
import assert from 'node:assert/strict';
import { createSectionScroll } from '../../src/black-geometry/section-scroll.js';

function setup(t, { longEntry = false, reduced = false } = {}) {
  let time = 0, y = 0;
  t.mock.method(performance, 'now', () => time);
  const ranges = Array.from({ length: 6 }, (_, index) => ({
    id: `entry-${index}`, start: index * 1000, stop: index * 1000 + (longEntry ? 300 : 0),
  }));
  const moves = [];
  const handle = createSectionScroll({
    getRanges: () => ranges, getY: () => y, getHeight: () => 1000,
    move: (top, behavior) => { moves.push({ top, behavior }); },
    isReduced: () => reduced, isLoading: () => false,
  });
  return {
    moves, handle,
    land() { y = moves.at(-1).top; handle.finish(); },
    wheel(deltaY, at, options = {}) {
      time = at;
      const event = { deltaY, deltaX: 0, deltaMode: 0, ...options, preventDefault() { this.defaultPrevented = true; } };
      handle(event);
      return event;
    },
  };
}

test('small mouse and trackpad movements advance without using an arrow', t => {
  const scroll = setup(t);
  scroll.wheel(3, 0);
  assert.deepEqual(scroll.moves, [{ top: 1000, behavior: 'smooth' }]);
});

test('continuous wheel notches keep advancing after each page settles', t => {
  const scroll = setup(t);
  for (let time = 0; time <= 2400; time += 80) {
    scroll.wheel(120, time);
    if (scroll.moves.length) scroll.land();
  }
  assert.ok(scroll.moves.length >= 3, 'holding the wheel must not lock on the first entry');
  assert.ok(scroll.moves.length <= 5, 'each entry gets time to settle');
  assert.deepEqual(scroll.moves.map(move => move.top), scroll.moves.map((_, index) => (index + 1) * 1000));
});

test('a decaying trackpad fling settles on one whole entry', t => {
  const scroll = setup(t);
  for (let time = 0; time <= 1600; time += 40) {
    scroll.wheel(200 * Math.exp(-time / 400), time);
    scroll.land();
  }
  assert.equal(scroll.moves.length, 1);
  scroll.wheel(12, 1900);
  assert.equal(scroll.moves.at(-1).top, 2000);
});

test('slowing the wheel and continuing at that speed does not leave it locked', t => {
  const scroll = setup(t);
  for (let time = 0; time <= 2400; time += 80) {
    scroll.wheel(time < 480 ? 120 : 80, time);
    scroll.land();
  }
  assert.ok(scroll.moves.length >= 3);
});

test('gradual high-frequency trackpad momentum does not skip another entry', t => {
  const scroll = setup(t);
  for (let time = 0; time <= 2000; time += 16) {
    scroll.wheel(80 * Math.exp(-time / 800), time);
    scroll.land();
  }
  assert.equal(scroll.moves.length, 1);
});

test('a new gesture can reverse the current page transition', t => {
  const scroll = setup(t);
  scroll.wheel(120, 0);
  scroll.land();
  scroll.wheel(-120, 100);
  assert.equal(scroll.moves.at(-1).top, 0);
});

test('long entries retain reading scroll and stop at their boundary', t => {
  const scroll = setup(t, { longEntry: true });
  assert.equal(scroll.wheel(120, 0).defaultPrevented, undefined);
  assert.equal(scroll.moves.length, 0);
  assert.equal(scroll.wheel(500, 250).defaultPrevented, true);
  assert.equal(scroll.moves.at(-1).top, 300);
  scroll.land();
  scroll.wheel(120, 600);
  assert.equal(scroll.moves.at(-1).top, 1000);
});

test('line and page wheel units, reduced motion, and pinch zoom remain usable', t => {
  const scroll = setup(t, { reduced: true });
  assert.equal(scroll.wheel(120, 0, { ctrlKey: true }).defaultPrevented, undefined);
  assert.equal(scroll.wheel(120, 0, { deltaX: 200 }).defaultPrevented, undefined);
  scroll.wheel(1, 0, { deltaMode: 1 });
  assert.deepEqual(scroll.moves, [{ top: 1000, behavior: 'instant' }]);
  scroll.land();
  scroll.wheel(1, 500, { deltaMode: 2 });
  assert.equal(scroll.moves.at(-1).top, 2000);
});

const finger = (x, y) => ({ touches: [{ clientX: x, clientY: y }] });

test('intentional vertical swipes move to the adjacent entry in either direction', t => {
  const scroll = setup(t);
  scroll.handle.touchStart(finger(190, 300));
  scroll.handle.touchMove(finger(192, 200));
  scroll.handle.touchEnd();
  assert.equal(scroll.moves.at(-1).top, 1000);
  scroll.land();
  scroll.handle.touchStart(finger(190, 200));
  scroll.handle.touchMove(finger(192, 300));
  scroll.handle.touchEnd();
  assert.equal(scroll.moves.at(-1).top, 0);
});

test('touch reading within a long entry remains native', t => {
  const scroll = setup(t, { longEntry: true });
  scroll.handle.touchStart(finger(190, 300));
  scroll.handle.touchMove(finger(192, 200));
  scroll.handle.touchEnd();
  assert.equal(scroll.moves.length, 0);
});

test('horizontal drags, taps, cancelled touches and pinch zoom do not turn a page', t => {
  const scroll = setup(t);
  for (const movement of [finger(290, 298), finger(192, 290), { touches: [finger(190, 200).touches[0], finger(250, 200).touches[0]] }]) {
    scroll.handle.touchStart(finger(190, 300));
    scroll.handle.touchMove(movement);
    scroll.handle.touchEnd();
  }
  scroll.handle.touchStart(finger(190, 300));
  scroll.handle.touchMove(finger(192, 200));
  scroll.handle.reset();
  scroll.handle.touchEnd();
  assert.equal(scroll.moves.length, 0);
});
