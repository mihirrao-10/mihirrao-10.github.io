import fs from 'node:fs/promises';
import { webkit } from '@playwright/test';
import { ENTRIES, openPortfolio, selectPage, frameTimings } from './browser-utils.js';

const output = '.artifacts/black-geometry/reports';
await fs.mkdir(output, { recursive: true });
const browser = await webkit.launch();
const report = { browser: browser.version(), engine: 'WebKit', mode: 'headless',
  viewport: [1440, 900], deviceScale: 2, measurements: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  report.startup = await openPortfolio(page);
  console.log(`Startup: ${report.startup.startupMs.toFixed(2)} ms; ${report.startup.encodedBytes} encoded bytes`);
  for (const entry of ENTRIES) {
    await selectPage(page, entry);
    const measurement = await frameTimings(page, 3000);
    report.measurements.push({ chapter: entry.id, ...measurement });
    console.log(`${entry.id}: p95 ${measurement.p95Ms?.toFixed(2) ?? 'unavailable'} ms`);
  }
} finally {
  await fs.writeFile(`${output}/webkit-performance.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
