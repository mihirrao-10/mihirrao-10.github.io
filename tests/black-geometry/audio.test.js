import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "../../src/black-geometry/audio.js";
function fixture({ fail = false } = {}) {
  const contexts = [],
    oscillators = [],
    gains = [];
  class Context {
    constructor() {
      this.state = "suspended";
      this.currentTime = 0;
      this.destination = {};
      contexts.push(this);
    }
    createGain() {
      const calls = [];
      const node = {
        gain: {
          value: 0,
          cancelScheduledValues: (...a) => calls.push(["cancel", ...a]),
          setTargetAtTime: (...a) => calls.push(["target", ...a]),
          setValueAtTime: (...a) => calls.push(["value", ...a]),
          linearRampToValueAtTime: (...a) => calls.push(["linear", ...a]),
          exponentialRampToValueAtTime: (...a) => calls.push(["exp", ...a]),
        },
        calls,
        connect() {},
        disconnect() {},
      };
      gains.push(node);
      return node;
    }
    createOscillator() {
      const node = {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() {},
        stop() {
          this.stopped = true;
        },
      };
      oscillators.push(node);
      return node;
    }
    async resume() {
      if (fail) throw new Error("autoplay denied");
      this.state = "running";
      this.onstatechange?.();
    }
    async suspend() {
      this.state = "suspended";
      this.onstatechange?.();
    }
    async close() {
      this.state = "closed";
    }
  }
  return { Context, contexts, oscillators, gains };
}
test("audio is lazy, explicit, bounded, enveloped and suspended by mute", async () => {
  const f = fixture();
  let clock = 0;
  const bus = createAudio({ Context: f.Context, now: () => clock });
  bus.cue();
  assert.equal(f.contexts.length, 0);
  assert.equal(await bus.enable(), true);
  assert.equal(f.contexts.length, 1);
  for (let i = 0; i < 12; i++) {
    clock += 200;
    bus.cue();
  }
  assert.equal(f.oscillators.length, 4);
  assert.equal(bus.snapshot().voices, 4);
  assert.ok(f.gains[1].calls.some((call) => call[0] === "linear"));
  assert.ok(f.gains[1].calls.some((call) => call[0] === "exp"));
  await bus.off();
  assert.equal(bus.snapshot().state, "suspended");
  assert.equal(bus.snapshot().enabled, false);
  assert.ok(f.oscillators.every((node) => node.stopped));
  await bus.enable();
  assert.equal(f.contexts.length, 1);
  await bus.dispose();
  assert.equal(f.contexts[0].state, "closed");
});
test("cue cooldown prevents repeated input from piling up voices", async () => {
  const f = fixture(),
    bus = createAudio({ Context: f.Context, now: () => 200 });
  await bus.enable();
  for (let i = 0; i < 20; i++) bus.cue();
  assert.equal(f.oscillators.length, 1);
  await bus.dispose();
});
test("resume rejection leaves a truthful, reusable off state without a rejected promise", async () => {
  const f = fixture({ fail: true }),
    bus = createAudio({ Context: f.Context });
  assert.equal(await bus.enable(), false);
  assert.equal(bus.snapshot().enabled, false);
  await bus.off();
  await bus.dispose();
});
test("rapid enable/mute never marks obsolete enable requests as audible", async () => {
  const f = fixture(),
    bus = createAudio({ Context: f.Context });
  const pending = bus.enable();
  await bus.off();
  assert.equal(await pending, false);
  assert.equal(bus.snapshot().enabled, false);
  await bus.dispose();
});

test("an external interruption clears queued voices and stays silent after context recovery", async () => {
  const f = fixture(),
    bus = createAudio({ Context: f.Context });
  await bus.enable();
  bus.cue("complete");
  assert.equal(bus.snapshot().voices, 1);
  const context = f.contexts[0];
  context.state = "interrupted";
  context.onstatechange();
  assert.equal(bus.snapshot().enabled, false);
  assert.equal(bus.snapshot().voices, 0);
  assert.deepEqual(f.gains[0].calls.at(-1), ["value", 0, 0]);
  await context.resume();
  assert.equal(bus.snapshot().enabled, false);
  assert.equal(await bus.enable(), true);
  assert.equal(f.contexts.length, 1);
  await bus.dispose();
});
