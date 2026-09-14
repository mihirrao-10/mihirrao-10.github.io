import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const output = '.artifacts/black-geometry-minimal';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = { browser: browser.version(), mode: 'headless', performance: [] };
try {
  for (const [label, width, height, rate] of [['desktop-high', 1440, 900, 1], ['phone-high', 390, 844, 1], ['phone-throttled', 390, 844, 4]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    const page = await context.newPage(), client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate });
    await page.goto(`${process.env.BG_BASE_URL || 'http://127.0.0.1:8000'}/?bg-debug`);
    await page.waitForFunction(() => document.body.dataset.experienceState === 'ready');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const result = await page.evaluate(async () => {
      const samples = [], ranges = __blackGeometry.snapshot().ranges;
      const begin = performance.now();let prior = begin, frame = __blackGeometry.snapshot().world.frames, lastScene = -1;
      while (performance.now() - begin < 6000) {
        await new Promise(requestAnimationFrame);
        const now = performance.now(), state = __blackGeometry.snapshot();
        const scene = Math.min(7, Math.floor((now - begin) / 750));
        if (scene !== lastScene) { scrollTo({ top: ranges[scene].start, behavior: 'instant' }); lastScene = scene; }
        if (state.world.frames !== frame) { samples.push(now - prior); prior = now; frame = state.world.frames; }
      }
      const duration = (performance.now() - begin) / 1000;samples.sort((a, b) => a - b);
      return { samples: samples.length, observedFps: samples.length / duration, medianMs: samples[Math.floor(samples.length * .5)], p95Ms: samples[Math.floor(samples.length * .95)], maximumMs: samples.at(-1), state: __blackGeometry.snapshot().world };
    });
    assert.equal(result.state.quality, 'high');assert.equal(result.state.dpr, 2);
    assert.equal(result.state.opaque, true);assert.ok(result.state.decodedTargets <= 2);
    report.performance.push({ label, width, height, cpuThrottle: rate, ...result });
    await context.close();
  }
  await fs.writeFile(`${output}/performance.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.performance.map(({ state, ...summary }) => summary), null, 2));
} finally { await browser.close(); }
