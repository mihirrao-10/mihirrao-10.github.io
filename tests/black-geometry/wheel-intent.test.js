import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWheelIntent } from '../../src/black-geometry/wheel-intent.js';

const flick = [3, 8, 20, 45, 80, 100, 80, 60, 40, 24, 15, 9, 5, 3, 2, 1];
function recognize(samples) {
  const intent = createWheelIntent();
  return samples.flatMap((delta, index) => intent.push(delta, index * 16) ? [index] : []);
}

test('initial acceleration and a long momentum tail form one gesture', () => {
  assert.deepEqual(recognize([...flick, ...Array(100).fill(1)]), [0]);
  assert.deepEqual(recognize(Array(100).fill(120)), [0]);
});

test('a second and third swipe are recognized before previous momentum stops', () => {
  const stroke = [...flick, ...Array(40).fill(1)];
  assert.deepEqual(recognize([...stroke, ...stroke, ...stroke]), [0, stroke.length + 1, stroke.length * 2 + 1]);
  assert.deepEqual(recognize([...stroke, ...stroke].map(delta => -delta)), [0, stroke.length + 1]);
});

test('a soft sustained push or a sharp impulse can interrupt a momentum tail', () => {
  assert.deepEqual(recognize([...flick, 3, 3, 3, 3]), [0, flick.length + 1]);
  assert.deepEqual(recognize([...flick, 60, 45, 30, 15, 5, 1]), [0, flick.length]);
});

test('isolated larger packets in a decaying tail do not skip extra slides', () => {
  assert.deepEqual(recognize([3, 20, 60, 100, 70, 40, 20, 19, 18, 26, 24, 22, 15, 9, 5, 26, 4, 2, 1]), [0]);
});

test('small wobble during the initial push does not split the gesture', () => {
  assert.deepEqual(recognize([3, 8, 20, 15, 12, 25, 45, 70, 100, 80, 60, 30, 10, 5, 1]), [0]);
});

test('coalesced momentum packets do not look like renewed force', () => {
  const intent = createWheelIntent();
  flick.forEach((delta, index) => intent.push(delta, index * 16));
  let time = (flick.length - 1) * 16;
  for (const interval of [16, 32, 64, 16, 48, 32, 16]) {
    time += interval;
    assert.equal(intent.push(interval / 16, time), false);
  }
});

test('uneven timing alone cannot turn steady input into extra gestures', () => {
  const intent = createWheelIntent();
  intent.push(120, 0);
  let time = 0;
  for (const interval of [40, 44, 40, 35, 50, 32, 20, 40, 16, 16, 50, 10, 10, 40]) {
    time += interval;
    assert.equal(intent.push(120, time), false);
  }
});

test('pauses, reversals and other navigation start fresh gestures', () => {
  const intent = createWheelIntent();
  assert.equal(intent.push(120, 0), true);
  assert.equal(intent.push(120, 16), false);
  assert.equal(intent.push(120, 240), true);
  assert.equal(intent.push(-3, 256), true);
  intent.reset();
  assert.equal(intent.push(-3, 272), true);
});

// Real Chromium delivery combines some injected wheel packets. Keep those
// observed timings and deltas, including the cases that originally failed.
const recorded = JSON.parse(readFileSync(new URL('./fixtures/wheel-gestures.json', import.meta.url)));
for (const fixture of recorded) test(`recorded input: ${fixture.name}`, () => {
  const intent = createWheelIntent();
  const gestures = fixture.events.filter(([time, delta]) => intent.push(delta, time));
  assert.equal(gestures.length, fixture.expectedGestures);
});
