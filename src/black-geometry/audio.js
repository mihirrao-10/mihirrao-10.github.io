// Original short additive-synthesis cues. No ambient loop or downloaded audio.
// The same graph and scheduler are exported for the offline output-level check.
export const AUDIO_MASTER_LEVEL = 0.72;

export function createSoundGraph(context, destination = context.destination) {
  const input = context.createGain();
  input.gain.value = 0;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -15;
  compressor.knee.value = 8;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;
  const output = context.createGain();
  output.gain.value = 0.86;
  input.connect(compressor);
  compressor.connect(output);
  output.connect(destination);
  return { input, compressor, output };
}

const TIMBRES = {
  uchicago: { base: 196, partial: 2.01, type: 'sine' },
  drexel: { base: 349.23, partial: 2.76, type: 'sine' },
  mathworks: { base: 293.66, partial: 1.594, type: 'sine' },
  neutral: { base: 261.63, partial: 2, type: 'sine' },
};

/** Schedule one bounded cue with a soft attack and decay; returns its voices. */
export function scheduleSculptureCue(context, destination, kind = 'tick', identity = 'neutral', at = context.currentTime, onEnded = () => {}) {
  const timbre = TIMBRES[String(identity).split('-')[0]] || TIMBRES.neutral;
  const event = { voices: [], ended: false, endTime: at };
  const normalized = kind === 'complete' ? 'settle' : kind === 'tick' ? 'path' : kind;
  const duration = normalized === 'transition' ? 0.46 : normalized === 'enable' ? 0.37 : normalized === 'settle' ? 0.34 : 0.22;
  const notes = normalized === 'enable'
    ? [{ f: 440, delay: 0, amplitude: 0.19 }, { f: 660, delay: 0.095, amplitude: 0.16 }]
    : [{ f: timbre.base * (normalized === 'settle' ? 1.5 : normalized === 'network' ? 1.25 : 1), delay: 0, amplitude: normalized === 'transition' ? 0.21 : 0.19 }];
  let remaining = notes.length * 2;
  for (const note of notes) {
    for (let partial = 0; partial < 2; partial += 1) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const start = at + note.delay;
      const stop = start + duration * (partial ? 0.64 : 1);
      const frequency = note.f * (partial ? timbre.partial : 1);
      oscillator.type = timbre.type;
      oscillator.frequency.setValueAtTime(frequency * (normalized === 'transition' ? 0.88 : 1), start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency, start + Math.min(0.16, duration));
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(note.amplitude * (partial ? 0.24 : 1), start + 0.014);
      envelope.gain.exponentialRampToValueAtTime(0.0001, stop);
      envelope.gain.linearRampToValueAtTime(0, stop + 0.018);
      oscillator.connect(envelope);
      envelope.connect(destination);
      const voice = { oscillator, envelope };
      event.voices.push(voice);
      event.endTime = Math.max(event.endTime, stop + 0.025);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        remaining -= 1;
        if (remaining === 0 && !event.ended) {
          event.ended = true;
          onEnded(event);
        }
      };
      oscillator.start(start);
      oscillator.stop(stop + 0.025);
    }
  }
  event.cancel = (immediate = false) => {
    if (event.ended) return;
    const t = context.currentTime;
    for (const { oscillator, envelope } of event.voices) {
      if (immediate) {
        envelope.gain.cancelScheduledValues(t);
        envelope.gain.setValueAtTime(0, t);
      }
      else {
        if (envelope.gain.cancelAndHoldAtTime) envelope.gain.cancelAndHoldAtTime(t);
        else envelope.gain.cancelScheduledValues(t);
        envelope.gain.setTargetAtTime(0, t, 0.006);
      }
      try { oscillator.stop(t + (immediate ? 0 : 0.035)); } catch {}
    }
    event.ended = true;
    onEnded(event);
  };
  return event;
}

export function createAudio({
  Context = globalThis.AudioContext || globalThis.webkitAudioContext,
  onChange = () => {},
  now = () => performance.now(),
} = {}) {
  let context;
  let graph;
  let wanted = false;
  let hidden = false;
  let ready = false;
  let initializing = false;
  let unavailable = false;
  let disposed = false;
  let ticket = 0;
  let lastCue = -Infinity;
  let lastTransition = -Infinity;
  const events = new Set();
  const enabled = () => wanted && !hidden && ready && !initializing && !disposed && context?.state === 'running';
  function snapshot() {
    return {
      initialized: !!context,
      wanted,
      enabled: !!enabled(),
      state: unavailable ? 'unavailable' : initializing ? 'initializing' : !wanted ? 'off' : enabled() ? 'running' : 'suspended',
      contextState: context?.state || 'uninitialized',
      voices: [...events].reduce((sum, event) => sum + event.voices.length, 0),
      events: events.size,
    };
  }
  const publish = () => onChange(snapshot());
  function silence(immediate = false) {
    if (!context || !graph) return;
    const t = context.currentTime;
    if (immediate) {
      graph.input.gain.cancelScheduledValues(t);
      graph.input.gain.setValueAtTime(0, t);
    } else {
      if (graph.input.gain.cancelAndHoldAtTime) graph.input.gain.cancelAndHoldAtTime(t);
      else graph.input.gain.cancelScheduledValues(t);
      graph.input.gain.setTargetAtTime(0, t, 0.006);
    }
    for (const event of [...events]) event.cancel(immediate);
    events.clear();
  }
  function initialize() {
    if (context && context.state !== 'closed') return;
    context = new Context();
    graph = createSoundGraph(context);
    context.onstatechange = () => {
      if (context.state !== 'running') {
        ready = false;
        silence(true);
      } else if (!wanted || hidden || disposed) {
        silence(true);
        // An obsolete resume can resolve after an immediate mute of a context
        // that was still suspended. Keep the underlying device suspended too.
        try { void Promise.resolve(context.suspend()).catch(() => {}); } catch {}
      }
      publish();
    };
  }
  function play(kind, identity) {
    const event = scheduleSculptureCue(context, graph.input, kind, identity, context.currentTime + 0.005, (done) => events.delete(done));
    events.add(event);
  }
  async function activate(confirm) {
    const attempt = ++ticket;
    ready = false;
    initializing = true;
    unavailable = false;
    // There is deliberately no await/import before these gesture-bound calls.
    let pending;
    try {
      if (disposed || !Context) throw new Error('Web Audio unavailable');
      initialize();
      pending = context.resume();
    } catch {
      if (attempt === ticket) {
        initializing = false;
        unavailable = true;
        wanted = false;
        publish();
      }
      return false;
    }
    publish();
    try {
      await pending;
      if (attempt !== ticket || disposed || !wanted || hidden) return false;
      initializing = false;
      ready = context.state === 'running';
      if (ready) {
        graph.input.gain.cancelScheduledValues(context.currentTime);
        graph.input.gain.setTargetAtTime(AUDIO_MASTER_LEVEL, context.currentTime, 0.008);
        lastCue = now();
        lastTransition = -Infinity;
        if (confirm) play('enable', 'neutral');
      }
      publish();
      return ready;
    } catch {
      if (attempt === ticket) {
        initializing = false;
        ready = false;
        // A failed visibility resume preserves the explicit preference. A
        // rejected opt-in never presents a successful enabled state.
        unavailable = confirm;
        if (confirm) wanted = false;
        silence(true);
        publish();
      }
      return false;
    }
  }
  function enable() {
    wanted = true;
    hidden = false;
    return activate(true);
  }
  async function deactivate(keepPreference) {
    const attempt = ++ticket;
    if (!keepPreference) wanted = false;
    ready = false;
    initializing = false;
    unavailable = false;
    silence(false);
    publish();
    // Only a running context needs time for its release ramp. Re-suspending an
    // already paused context would enqueue a redundant asynchronous state
    // update right across a rapid off/on gesture (particularly in WebKit).
    if (context && context.state !== 'closed') {
      if (context.state === 'running') await new Promise((resolve) => setTimeout(resolve, 40));
      if (attempt !== ticket || disposed) return;
      if (context.state !== 'suspended') {
        try { await context.suspend(); } catch {}
      }
    }
  }
  function off() { return deactivate(false); }
  function suspend() {
    hidden = true;
    return deactivate(true);
  }
  function resume() {
    hidden = false;
    if (!wanted || disposed) return Promise.resolve(false);
    return activate(false);
  }
  function cue(kind = 'tick', identity = 'neutral') {
    if (!enabled()) return false;
    const time = now();
    const transition = kind === 'transition';
    if (time - lastCue < (kind === 'settle' || kind === 'complete' ? 250 : 360)
      || (transition && time - lastTransition < 850) || events.size >= 3) return false;
    lastCue = time;
    if (transition) lastTransition = time;
    play(kind, identity);
    return true;
  }
  async function dispose() {
    ++ticket;
    disposed = true;
    wanted = false;
    ready = false;
    initializing = false;
    silence(true);
    if (context) {
      context.onstatechange = null;
      try { await context.close(); } catch {}
      graph.input.disconnect();
      graph.compressor.disconnect();
      graph.output.disconnect();
    }
    publish();
  }
  return { enable, off, suspend, resume, cue, snapshot, dispose };
}
