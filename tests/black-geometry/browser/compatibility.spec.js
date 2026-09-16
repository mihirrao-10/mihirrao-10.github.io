import { test, expect } from '@playwright/test';

const snapshot = page => page.evaluate(() => window.__blackGeometry.snapshot());
async function ready(page) {
  await page.goto('/?bg-debug');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 20000 });
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready');
}
async function stopped(page) {
  let last = -1, stable = 0;
  await expect.poll(async () => {
    const y = await page.evaluate(() => scrollY);
    stable = Math.abs(y - last) < .5 ? stable + 1 : 0;
    last = y;
    return stable >= 3;
  }).toBe(true);
}

for (const width of [390, 1366]) test(`wheel gestures stop at the adjacent entry at ${width}px`, async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width, height: 768 });
  await ready(page);
  await page.mouse.move(30, 700);
  // Test Windows-style wheel notches as well as a large touchpad fling.
  for (const delta of [120, 5000]) {
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await stopped(page);
    await page.mouse.wheel(0, delta);
    await stopped(page);
    const state = await snapshot(page);
    expect(state.state.chapter).toBe('education-uchicago');
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(state.ranges[1].start, 0);
    await page.mouse.wheel(0, -5000);
    await stopped(page);
    expect((await snapshot(page)).state.chapter).toBe('hero');
  }
  // The footer extends Notes' reading area; it must not become a zero-length
  // wheel destination that traps the visitor at the bottom of the document.
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await stopped(page);
  const bottom = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, -120);
  await stopped(page);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(bottom - 20);
});

test('reduced-motion visitors can explicitly enable prepared, moving sculptures', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?bg-debug');
  const enable = page.getByRole('button', { name: 'Enable animation' });
  await expect(enable).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toBe('y mandatory');
  await enable.click();
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 20000 });
  await expect(enable).toBeHidden();
  const state = await snapshot(page);
  expect(state.motion).toBe('full');
  expect(state.world.warmedTargets).toBe(8);
  await expect.poll(async () => (await snapshot(page)).orbitTime).toBeGreaterThan(state.orbitTime + .2);
  // Re-enabling an already-created renderer must release the loader too.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(async () => (await snapshot(page)).motionOverride).toBe(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(enable).toBeVisible();
  await enable.click();
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete');
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready');
});

test('throttled Chromium prepares every mesh and continues animating through a resize', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'CPU throttling uses Chromium protocol.');
  test.setTimeout(60000);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await ready(page);
  expect((await snapshot(page)).world.warmedTargets).toBe(8);
  for (const id of ['education-drexel', 'project-surface', 'notes']) {
    await page.evaluate(id => {
      scrollTo({ top: window.__blackGeometry.snapshot().ranges.find(r => r.id === id).start, behavior: 'instant' });
    }, id);
    await expect.poll(async () => (await snapshot(page)).state.chapter).toBe(id);
    const before = await snapshot(page);
    await expect.poll(async () => (await snapshot(page)).orbitTime).toBeGreaterThan(before.orbitTime + .15);
    expect((await snapshot(page)).world.decodedTargets).toBe(8);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await snapshot(page);
  await expect.poll(async () => (await snapshot(page)).world.frames).toBeGreaterThan(before.world.frames + 5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await client.detach();
});

for (const [width, height] of [[390, 844], [768, 1024]]) test(`high-DPI touch device ${width}px remains live after rotation`, async ({ browser }) => {
  test.setTimeout(45000);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:8000/?bg-debug');
    await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 20000 });
    for (const viewport of [{ width, height }, { width: height, height: width }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => { location.hash = 'education-drexel'; });
      await expect.poll(async () => (await snapshot(page)).state.chapter).toBe('education-drexel');
      const before = await snapshot(page);
      expect(before.world.warmedTargets).toBe(8);
      expect(before.world.dpr).toBeLessThanOrEqual(2);
      await expect.poll(async () => (await snapshot(page)).orbitTime).toBeGreaterThan(before.orbitTime + .2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const title = await page.locator('#education-drexel .section-heading').boundingBox();
      const stage = await page.locator('.world').boundingBox();
      if (stage.x < 1) expect(title.y).toBeGreaterThanOrEqual(stage.y + stage.height);
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
