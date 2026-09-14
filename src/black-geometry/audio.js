// Original, brief sine partials. No ambient loop or downloaded audio.
export function createAudio({
  Context = globalThis.AudioContext || globalThis.webkitAudioContext,
  onChange = () => {},
  now = () => performance.now(),
} = {}) {
  let context,
    master,
    enabled = false,
    ticket = 0,
    lastCue = -Infinity,
    disposed = false;
  const voices = new Set();
  const publish = () => onChange(enabled && context?.state === "running");
  function stopVoices() {
    for (const voice of voices) {
      try {
        voice.stop();
      } catch {}
    }
    voices.clear();
  }
  async function off() {
    ticket++;
    enabled = false;
    if (context && context.state !== "closed") {
      const t = context.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(0, t, 0.015);
      stopVoices();
      try {
        await context.suspend();
      } catch {}
    }
    publish();
  }
  async function enable() {
    const attempt = ++ticket;
    try {
      if (disposed || !Context) return false;
      if (!context) {
        context = new Context();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        context.onstatechange = () => {
          if (context.state !== "running") {
            enabled = false;
            stopVoices();
            master.gain.cancelScheduledValues(context.currentTime);
            master.gain.setValueAtTime(0, context.currentTime);
          }
          publish();
        };
      }
      // Only an explicit Sound interaction reaches this method.
      await context.resume();
      if (attempt !== ticket || disposed) return false;
      enabled = context.state === "running";
      if (enabled)
        master.gain.setTargetAtTime(0.035, context.currentTime, 0.035);
      publish();
      return enabled;
    } catch {
      enabled = false;
      publish();
      return false;
    }
  }
  function cue(kind = "tick") {
    if (
      !enabled ||
      context?.state !== "running" ||
      now() - lastCue < 180 ||
      voices.size >= 4
    )
      return;
    lastCue = now();
    const t = context.currentTime,
      duration = kind === "complete" ? 0.42 : 0.14;
    const voice = context.createOscillator(),
      envelope = context.createGain();
    voice.type = "sine";
    voice.frequency.setValueAtTime(kind === "complete" ? 440 : 660, t);
    voice.frequency.exponentialRampToValueAtTime(
      kind === "complete" ? 330 : 420,
      t + duration,
    );
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(0.25, t + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    voice.connect(envelope);
    envelope.connect(master);
    voices.add(voice);
    voice.onended = () => {
      voices.delete(voice);
      voice.disconnect();
      envelope.disconnect();
    };
    voice.start(t);
    voice.stop(t + duration + 0.02);
  }
  return {
    enable,
    off,
    cue,
    snapshot: () => ({
      initialized: !!context,
      enabled,
      state: context?.state || "uninitialized",
      voices: voices.size,
    }),
    async dispose() {
      disposed = true;
      await off();
      if (context) {
        context.onstatechange = null;
        try {
          await context.close();
        } catch {}
        master.disconnect();
      }
    },
  };
}
