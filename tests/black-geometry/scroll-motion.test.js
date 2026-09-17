import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollMotion } from '../../src/black-geometry/scroll-motion.js';

function setup() {
  let y = 0, time = 0, snapping = true, completed = 0, serial = 0;
  const frames = new Map();
  const timers = new Map();
  const motion = createScrollMotion({
    read: () => y, write: top => { y = top; },
    setSnapping: enabled => { snapping = enabled; },
    requestFrame: callback => { frames.set(++serial, callback); return serial; },
    cancelFrame: id => frames.delete(id), now: () => time,
    setTimer: callback => { timers.set(++serial, callback); return serial; },
    clearTimer: id => timers.delete(id),
    onComplete: () => completed++,
  });
  return {
    motion,
    state: () => ({ y, snapping, completed, pending: frames.size }),
    frame(at) {
      time = at;
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach(callback => callback(at));
    },
    deadline() { [...timers.values()].forEach(callback => callback()); },
  };
}

test('a section transition advances and lands exactly without native smooth scrolling', () => {
  const scroll = setup();
  scroll.motion.move(900, 'smooth');
  assert.equal(scroll.state().snapping, false);
  scroll.frame(100);
  assert.ok(scroll.state().y > 0 && scroll.state().y < 900);
  scroll.frame(420);
  assert.deepEqual(scroll.state(), { y: 900, snapping: true, completed: 1, pending: 0 });
});

test('a delayed frame completes the move instead of extending a stalled animation', () => {
  const scroll = setup();
  scroll.motion.move(900, 'smooth');
  scroll.frame(2500);
  assert.deepEqual(scroll.state(), { y: 900, snapping: true, completed: 1, pending: 0 });
});

test('a missing animation frame cannot leave a single scroll gesture stuck', () => {
  const scroll = setup();
  scroll.motion.move(900, 'smooth');
  scroll.deadline();
  assert.deepEqual(scroll.state(), { y: 900, snapping: true, completed: 1, pending: 0 });
  scroll.frame(2500);
  assert.equal(scroll.state().completed, 1);
});

test('direction changes replace the previous destination', () => {
  const scroll = setup();
  scroll.motion.move(900, 'smooth');
  scroll.frame(100);
  scroll.motion.move(0, 'smooth');
  scroll.frame(520);
  assert.deepEqual(scroll.state(), { y: 0, snapping: true, completed: 1, pending: 0 });
});

test('instant moves and interrupted gestures restore native snapping', () => {
  const scroll = setup();
  scroll.motion.move(900, 'instant');
  assert.deepEqual(scroll.state(), { y: 900, snapping: true, completed: 1, pending: 0 });
  scroll.motion.move(1800, 'smooth');
  scroll.frame(100);
  scroll.motion.cancel();
  const stopped = scroll.state();
  scroll.frame(1000);
  assert.deepEqual(scroll.state(), stopped);
  assert.equal(stopped.snapping, true);
  assert.equal(stopped.pending, 0);
});
