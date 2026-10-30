import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { ENTRIES, openPortfolio, selectPage, frameTimings } from './browser-utils.js';

const output = '.artifacts/black-geometry/reports';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = { browser: browser.version(), mode: 'headless', startup: [], performance: [] };
try {
  for (const [label, width, height, rate] of [['desktop-high', 1440, 900, 1], ['phone-high', 390, 844, 1], ['phone-throttled', 390, 844, 4]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    try {
      const page = await context.newPage(), client = await context.newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate });
      const startup = await openPortfolio(page);
      report.startup.push({ label, width, height, cpuThrottle: rate, ...startup });
      if (!report.graphics) report.graphics = await page.evaluate(() => {
        const gl = document.querySelector('canvas').getContext('webgl2'), extension = gl.getExtension('WEBGL_debug_renderer_info');
        return gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
      });
      for (const entry of ENTRIES) {
        await selectPage(page, entry);
        const result = await frameTimings(page);
        assert.equal(result.state.quality, 'high');
        assert.ok(result.state.dpr <= 2);
        assert.equal(result.state.contextLost, false);
        assert.equal(result.state.decodedTargets, ENTRIES.length);
        assert.equal(result.state.warmedTargets, ENTRIES.length);
        report.performance.push({ label, width, height, cpuThrottle: rate, target: entry.target, ...result });
      }
    } finally { await context.close(); }
  }
  await fs.writeFile(`${output}/performance.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    startup: report.startup.map(({ resources, ...summary }) => summary),
    performance: report.performance.map(({ state, ...summary }) => summary),
  }, null, 2));
} finally { await browser.close(); }
