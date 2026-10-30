import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { ENTRIES, openPortfolio, selectPage } from './browser-utils.js';

const output = fileURLToPath(new URL('../../.artifacts/black-geometry/visual', import.meta.url));
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [], observations = [];
try {
  for (const [name, width, height] of [['desktop', 1365, 900], ['phone', 390, 844], ['laptop', 1024, 768], ['landscape', 740, 390]]) {
    const context = await browser.newContext({ viewport: { width, height },
      recordVideo: name === 'desktop' ? { dir: `${output}/video`, size: { width, height } } : undefined });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await openPortfolio(page);
      for (const entry of ENTRIES) {
        await selectPage(page, entry);
        await page.screenshot({ path: `${output}/${name}-${entry.id}.png` });
        observations.push({ name, id: entry.id, ...await page.evaluate(() => window.__blackGeometry.snapshot()) });
      }
      if (name === 'desktop') for (let i = 0; i < ENTRIES.length - 1; i++) {
        await selectPage(page, ENTRIES[i]);
        await page.locator(`.site-index a[href="#${ENTRIES[i + 1].section}"]`).click();
        await page.waitForTimeout(150);
        await page.screenshot({ path: `${output}/transition-${ENTRIES[i].id}-${ENTRIES[i + 1].id}.png` });
      }
    } finally { await context.close(); }
  }
  await fs.writeFile(`${output}/observations.json`, JSON.stringify({ errors, observations }, null, 2) + '\n');
  console.log('Captured all seven pages, transitions, and a desktop video.', errors);
} finally { await browser.close(); }
