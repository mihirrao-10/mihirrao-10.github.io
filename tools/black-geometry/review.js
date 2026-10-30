import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { ENTRIES, openPortfolio, selectPage } from './browser-utils.js';

const output = '.artifacts/black-geometry/review';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const observations = [];
try {
  for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    try {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await openPortfolio(page);
      for (const entry of ENTRIES) {
        await selectPage(page, entry);
        await page.screenshot({ path: `${output}/${label}-${entry.id}.png` });
        observations.push({ label, name: entry.id, ...await page.evaluate(() => ({
          snapshot: window.__blackGeometry.snapshot(),
          overflow: document.documentElement.scrollWidth > innerWidth,
          height: document.documentElement.scrollHeight,
        })) });
      }
      observations.push({ label, errors });
    } finally { await page.close(); }
  }
  await fs.writeFile(`${output}/observations.json`, JSON.stringify(observations, null, 2) + '\n');
  console.log(JSON.stringify(observations.map(({ snapshot, ...observation }) => ({
    ...observation, chapter: snapshot?.state.chapter, world: snapshot?.world,
  })), null, 2));
} finally { await browser.close(); }
