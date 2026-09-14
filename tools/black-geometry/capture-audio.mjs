import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// The root server must be running. This uses the production synth/limiter graph
// unchanged in OfflineAudioContext; it does not claim to measure speakers or ears.
const baseURL = process.env.AUDIO_CHECK_URL || 'http://127.0.0.1:8000';
const artifactRoot = path.resolve('.artifacts/black-geometry/revision-audio');
await mkdir(artifactRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(baseURL);
  const result = await page.evaluate(async () => {
    const { createSoundGraph, scheduleSculptureCue, AUDIO_MASTER_LEVEL } = await import('/src/black-geometry/audio.js');
    const rate = 48000;
    const context = new OfflineAudioContext(1, rate * 9, rate);
    const graph = createSoundGraph(context);
    graph.input.gain.setValueAtTime(AUDIO_MASTER_LEVEL, 0);
    const sequence = [
      { at: 0.25, kind: 'enable', identity: 'neutral' },
      { at: 1.25, kind: 'transition', identity: 'uchicago' },
      { at: 2.0, kind: 'settle', identity: 'uchicago' },
      { at: 3.0, kind: 'transition', identity: 'drexel' },
      { at: 3.75, kind: 'settle', identity: 'drexel' },
      { at: 4.75, kind: 'transition', identity: 'mathworks' },
      { at: 5.5, kind: 'settle', identity: 'mathworks' },
      { at: 6.4, kind: 'path', identity: 'neutral' },
      { at: 7.25, kind: 'network', identity: 'neutral' },
    ];
    for (const event of sequence) scheduleSculptureCue(context, graph.input, event.kind, event.identity, event.at);
    const buffer = await context.startRendering();
    const samples = buffer.getChannelData(0);
    const level = (start, end) => {
      let peak = 0, sum = 0, clipped = 0, nonfinite = 0;
      const a = Math.floor(start * rate), b = Math.min(samples.length, Math.floor(end * rate));
      for (let i = a; i < b; i++) {
        const value = samples[i];
        if (!Number.isFinite(value)) nonfinite++;
        peak = Math.max(peak, Math.abs(value)); sum += value * value;
        if (Math.abs(value) >= 0.999) clipped++;
      }
      const rms = Math.sqrt(sum / (b - a));
      return { peak, rms, peakDbFS: peak ? 20 * Math.log10(peak) : null, rmsDbFS: rms ? 20 * Math.log10(rms) : null, clipped, nonfinite };
    };
    const stats = {
      sampleRate: rate, duration: samples.length / rate,
      whole: level(0, 9), initialSilence: level(0, 0.2),
      events: sequence.map((event) => ({ ...event, ...level(event.at, event.at + 0.65) })),
      limitation: 'Actual Chromium OfflineAudioContext output of production synthesis and compressor. Not a recording of a user device, and not human-listened.',
    };
    return { samples: Array.from(samples), stats };
  });
  const samples = result.samples;
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + samples.length * 2, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(result.stats.sampleRate, 24); wav.writeUInt32LE(result.stats.sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2));
  await writeFile(path.join(artifactRoot, 'production-cues.wav'), wav);
  await writeFile(path.join(artifactRoot, 'levels.json'), JSON.stringify(result.stats, null, 2) + '\n');
  if (result.stats.whole.nonfinite || result.stats.whole.clipped || result.stats.initialSilence.peak !== 0 || result.stats.events.some((event) => event.peak < 0.04 || event.peak > 0.7)) {
    throw new Error(`Audio output calibration failed: ${JSON.stringify(result.stats)}`);
  }
  console.log(JSON.stringify({ artifacts: artifactRoot, ...result.stats }, null, 2));
  if (process.argv.includes('--live')) {
    const live = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    await live.addInitScript(() => {
      const NativeContext = window.AudioContext;
      const probe = window.__audioProbe = { contexts: 0, starts: 0, peak: 0 };
      window.AudioContext = class extends NativeContext {
        constructor(...args) { super(...args); probe.contexts++; }
        createOscillator() {
          const oscillator = super.createOscillator(), start = oscillator.start.bind(oscillator);
          oscillator.start = (...args) => { probe.starts++; return start(...args); };
          return oscillator;
        }
        createGain() {
          const gain = super.createGain(), connect = gain.connect.bind(gain), context = this;
          gain.connect = (...args) => {
            if (args[0] === context.destination) {
              const analyser = context.createAnalyser(); analyser.fftSize = 2048;
              connect(analyser);
              const samples = new Float32Array(analyser.fftSize);
              const sample = () => {
                analyser.getFloatTimeDomainData(samples);
                for (const value of samples) probe.peak = Math.max(probe.peak, Math.abs(value));
                if (context.state !== 'closed') requestAnimationFrame(sample);
              };
              requestAnimationFrame(sample);
            }
            return connect(...args);
          };
          return gain;
        }
      };
    });
    await live.goto(`${baseURL}/?bg-debug=1`);
    await live.waitForFunction(() => window.__blackGeometry?.snapshot().ranges.length > 3);
    const before = await live.evaluate(() => ({ ...window.__audioProbe, audio: window.__blackGeometry.snapshot().audio }));
    if (before.contexts || before.starts) throw new Error('Live page initialized audio before opt-in');
    await live.locator('#sound-toggle').click();
    await live.waitForTimeout(600);
    const enabled = await live.evaluate(() => ({ ...window.__audioProbe, audio: window.__blackGeometry.snapshot().audio }));
    if (!enabled.audio.enabled || enabled.starts !== 4 || enabled.peak < 0.04) throw new Error(`Live Sound confirmation failed: ${JSON.stringify(enabled)}`);
    const visits = [];
    for (const target of ['harper', 'dragon', 'membrane']) {
      const y = await live.evaluate((target) => window.__blackGeometry.snapshot().ranges.find((range) => range.target === target).start + 30, target);
      const from = await live.evaluate(() => window.scrollY);
      for (let step = 1; step <= 6; step++) {
        await live.mouse.wheel(0, (y - from) / 6);
        await live.waitForTimeout(90);
      }
      await live.waitForTimeout(800);
      visits.push(await live.evaluate(() => ({ ...window.__audioProbe, sculpture: document.body.dataset.sculpture, audio: window.__blackGeometry.snapshot().audio })));
    }
    await live.locator('#sound-toggle').click();
    await live.waitForTimeout(100);
    const muted = await live.evaluate(() => ({ ...window.__audioProbe, audio: window.__blackGeometry.snapshot().audio }));
    if (muted.audio.enabled || muted.audio.wanted || muted.audio.contextState !== 'suspended') throw new Error(`Live mute failed: ${JSON.stringify(muted)}`);
    if (visits.some((visit, i) => visit.starts <= (i ? visits[i - 1].starts : enabled.starts))) throw new Error(`Normal traversal failed to trigger cues: ${JSON.stringify(visits)}`);
    const liveResult = { before, enabled, visits, muted, limitation: 'Production page Web Audio output sampled by an AnalyserNode; headless browser, not human-listened.' };
    await writeFile(path.join(artifactRoot, 'live-interaction.json'), JSON.stringify(liveResult, null, 2) + '\n');
    console.log(JSON.stringify({ live: liveResult }, null, 2));
    await live.close();
  }
} finally {
  await browser.close();
}
