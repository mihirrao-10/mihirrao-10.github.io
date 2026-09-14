import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_MASTER_LEVEL, createAudio, createSoundGraph, scheduleSculptureCue } from '../../src/black-geometry/audio.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture({ resumePlans = [] } = {}) {
  const contexts = [], oscillators = [], gains = [], compressors = [];
  const param = (value = 0) => ({
    value, calls: [],
    cancelScheduledValues(...a) { this.calls.push(['cancel', ...a]); },
    cancelAndHoldAtTime(...a) { this.calls.push(['hold', ...a]); },
    setTargetAtTime(...a) { this.calls.push(['target', ...a]); },
    setValueAtTime(...a) { this.calls.push(['value', ...a]); },
    linearRampToValueAtTime(...a) { this.calls.push(['linear', ...a]); },
    exponentialRampToValueAtTime(...a) { this.calls.push(['exponential', ...a]); },
  });
  const connection = () => ({ connect(target) { this.target = target; }, disconnect() { this.disconnected = true; } });
  class Context {
    constructor() {
      this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.resumeCalls = 0; this.suspendCalls = 0;
      contexts.push(this);
    }
    createGain() {
      const node = { ...connection(), gain: param() }; gains.push(node); return node;
    }
    createDynamicsCompressor() {
      const node = { ...connection(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() };
      compressors.push(node); return node;
    }
    createOscillator() {
      const node = { ...connection(), frequency: param(), start(time) { this.startTime = time; }, stop(time) { this.stopTime = time; }, finish() { if (!this.finished) { this.finished = true; this.onended?.(); } } };
      oscillators.push(node); return node;
    }
    async resume() {
      const plan = resumePlans[this.resumeCalls++];
      if (plan) await plan;
      this.state = 'running'; this.onstatechange?.();
    }
    async suspend() { this.suspendCalls++; this.state = 'suspended'; this.onstatechange?.(); }
    async close() { this.state = 'closed'; }
    interrupt() { this.state = 'interrupted'; this.onstatechange?.(); }
  }
  return { Context, contexts, oscillators, gains, compressors, finish: () => oscillators.forEach((o) => o.finish()) };
}

test('fresh bus is silent; opt-in resumes synchronously and schedules a two-tone confirmation', async () => {
  const pending = deferred(), f = fixture({ resumePlans: [pending.promise] }), changes = [];
  const bus = createAudio({ Context: f.Context, onChange: (state) => changes.push(state) });
  assert.equal(bus.cue('transition', 'drexel'), false);
  assert.equal(f.contexts.length, 0);
  assert.deepEqual(bus.snapshot(), { initialized: false, wanted: false, enabled: false, state: 'off', contextState: 'uninitialized', voices: 0, events: 0 });
  const enabling = bus.enable();
  // Checked before resolving or awaiting: preserves the browser click gesture.
  assert.equal(f.contexts.length, 1);
  assert.equal(f.contexts[0].resumeCalls, 1);
  assert.equal(bus.snapshot().state, 'initializing');
  assert.equal(bus.snapshot().enabled, false);
  assert.equal(f.oscillators.length, 0);
  pending.resolve();
  assert.equal(await enabling, true);
  assert.equal(f.oscillators.length, 4);
  assert.equal(bus.snapshot().state, 'running');
  assert.ok(changes.every((s) => typeof s.wanted === 'boolean' && typeof s.enabled === 'boolean'));
  assert.ok(f.gains[0].gain.calls.some((c) => c[0] === 'target' && c[1] === AUDIO_MASTER_LEVEL));
  assert.equal(f.compressors[0].ratio.value, 8);
  assert.ok(f.oscillators.every((o) => o.stopTime - o.startTime < 0.5));
  const audiblePeaks = f.gains.slice(2).flatMap((g) => g.gain.calls).filter((c) => c[0] === 'linear' && c[1] > 0.1);
  assert.equal(audiblePeaks.length, 2);
  await bus.dispose();
});

test('identity timbres differ and every voice has bounded duration and softened edges', () => {
  const f = fixture(), context = new f.Context(), graph = createSoundGraph(context);
  graph.input.gain.value = AUDIO_MASTER_LEVEL;
  const fundamentals = [];
  for (const identity of ['uchicago', 'drexel', 'mathworks']) {
    const event = scheduleSculptureCue(context, graph.input, 'transition', identity, 0.1);
    fundamentals.push(event.voices[0].oscillator.frequency.calls[0][1]);
    assert.equal(event.voices.length, 2);
    assert.ok(event.endTime <= 0.6);
    for (const voice of event.voices) {
      const calls = voice.envelope.gain.calls;
      assert.ok(calls.some((c) => c[0] === 'linear' && c[1] > 0));
      assert.ok(calls.some((c) => c[0] === 'exponential' && c[1] === 0.0001));
      assert.ok(calls.some((c) => c[0] === 'linear' && c[1] === 0));
    }
  }
  assert.equal(new Set(fundamentals).size, 3);
  assert.equal(graph.input.target, graph.compressor);
  assert.equal(graph.compressor.target, graph.output);
  assert.equal(graph.output.target, context.destination);
});

test('normal transition and settle cues schedule bounded events; rapid scrolling does not queue cues', async () => {
  const f = fixture(); let time = 0;
  const bus = createAudio({ Context: f.Context, now: () => time });
  await bus.enable(); f.finish();
  time = 400;
  assert.equal(bus.cue('transition', 'drexel'), true);
  for (let i = 0; i < 50; i++) { time += 4; assert.equal(bus.cue('transition', 'mathworks'), false); }
  assert.equal(bus.snapshot().events, 1);
  time = 900;
  assert.equal(bus.cue('settle', 'drexel'), true);
  time = 1300;
  assert.equal(bus.cue('path'), true);
  time = 1800;
  assert.equal(bus.cue('network'), false);
  assert.equal(bus.snapshot().events, 3);
  assert.equal(bus.snapshot().voices, 6);
  f.finish();
  assert.equal(bus.snapshot().voices, 0);
  // No rejected cue was saved for later playback.
  assert.equal(f.oscillators.length, 10);
  await bus.dispose();
});

test('pending enable followed by mute never confirms or reports stale success', async () => {
  const pending = deferred(), f = fixture({ resumePlans: [pending.promise] });
  const bus = createAudio({ Context: f.Context });
  const enabling = bus.enable();
  const muting = bus.off();
  pending.resolve();
  assert.equal(await enabling, false);
  await muting;
  assert.equal(bus.snapshot().wanted, false);
  assert.equal(bus.snapshot().enabled, false);
  assert.equal(bus.snapshot().state, 'off');
  assert.equal(f.oscillators.length, 0);
  assert.equal(f.contexts[0].state, 'suspended');
  await bus.dispose();
});

test('enable–mute–enable preserves the newest action despite an obsolete resume', async () => {
  const old = deferred(), fresh = deferred(), f = fixture({ resumePlans: [old.promise, fresh.promise] });
  const bus = createAudio({ Context: f.Context });
  const first = bus.enable(), muting = bus.off(), second = bus.enable();
  fresh.resolve();
  assert.equal(await second, true);
  old.resolve();
  assert.equal(await first, false);
  await muting;
  assert.equal(bus.snapshot().enabled, true);
  assert.equal(f.contexts[0].suspendCalls, 0);
  assert.equal(f.oscillators.length, 4);
  await bus.dispose();
});

test('visibility suspension preserves wanted sound, empties voices, and resumes without queued sounds', async () => {
  const f = fixture(); let time = 0;
  const bus = createAudio({ Context: f.Context, now: () => time });
  await bus.enable();
  await bus.suspend();
  assert.equal(bus.snapshot().wanted, true);
  assert.equal(bus.snapshot().enabled, false);
  assert.equal(bus.snapshot().state, 'suspended');
  assert.equal(bus.snapshot().voices, 0);
  time = 1200;
  assert.equal(bus.cue('transition', 'drexel'), false);
  assert.equal(await bus.resume(), true);
  assert.equal(f.oscillators.length, 4);
  assert.equal(bus.snapshot().enabled, true);
  time = 1800;
  assert.equal(bus.cue('transition', 'mathworks'), true);
  await bus.off();
  assert.equal(await bus.resume(), false);
  assert.equal(bus.snapshot().wanted, false);
  await bus.dispose();
});

test('hidden while opt-in is pending cancels confirmation without forgetting intent', async () => {
  const pending = deferred(), f = fixture({ resumePlans: [pending.promise] }), bus = createAudio({ Context: f.Context });
  const enabling = bus.enable(), hiding = bus.suspend();
  pending.resolve();
  assert.equal(await enabling, false);
  await hiding;
  assert.equal(bus.snapshot().wanted, true);
  assert.equal(bus.snapshot().state, 'suspended');
  assert.equal(f.oscillators.length, 0);
  await bus.dispose();
});

test('rejected opt-in is truthful and retryable; rejected visibility resume retains preference', async () => {
  const first = deferred(), second = deferred();
  const f = fixture({ resumePlans: [first.promise, Promise.resolve(), second.promise] });
  const bus = createAudio({ Context: f.Context });
  const failed = bus.enable(); first.reject(new Error('autoplay denied'));
  assert.equal(await failed, false);
  assert.equal(bus.snapshot().state, 'unavailable');
  assert.equal(bus.snapshot().wanted, false);
  assert.equal(bus.snapshot().enabled, false);
  assert.equal(await bus.enable(), true);
  await bus.suspend();
  const resuming = bus.resume(); second.reject(new Error('gesture needed'));
  assert.equal(await resuming, false);
  assert.equal(bus.snapshot().wanted, true);
  assert.equal(bus.snapshot().state, 'suspended');
  await bus.dispose();
});

test('external interruption cancels old voices and recovery cannot replay them', async () => {
  const f = fixture(), bus = createAudio({ Context: f.Context });
  await bus.enable();
  f.contexts[0].interrupt();
  assert.equal(bus.snapshot().voices, 0);
  assert.equal(bus.snapshot().wanted, true);
  assert.equal(bus.snapshot().state, 'suspended');
  await f.contexts[0].resume();
  assert.equal(bus.snapshot().enabled, false);
  assert.equal(bus.cue('settle'), false);
  assert.equal(await bus.resume(), true);
  assert.equal(f.oscillators.length, 4);
  await bus.dispose();
});

test('muting an already suspended context has no delayed state update across the next enable', async () => {
  const f = fixture(), changes = [], bus = createAudio({ Context: f.Context, onChange: (state) => changes.push(state.state) });
  await bus.enable();
  await f.contexts[0].suspend();
  assert.equal(bus.snapshot().state, 'suspended');
  const before = f.contexts[0].suspendCalls;
  await bus.off();
  assert.equal(f.contexts[0].suspendCalls, before);
  const start = changes.length;
  assert.equal(await bus.enable(), true);
  await new Promise((resolve) => setTimeout(resolve, 55));
  assert.equal(bus.snapshot().state, 'running');
  assert.equal(f.contexts[0].suspendCalls, before);
  assert.equal(changes.slice(start).filter((state) => state === 'running').length, 1);
  await bus.dispose();
});

test('unsupported and disposed audio remain silent without rejecting application promises', async () => {
  const bus = createAudio({ Context: null });
  assert.equal(await bus.enable(), false);
  assert.equal(bus.snapshot().state, 'unavailable');
  assert.equal(bus.snapshot().enabled, false);
  await bus.dispose();
  assert.equal(await bus.enable(), false);
  assert.equal(bus.cue(), false);
});
