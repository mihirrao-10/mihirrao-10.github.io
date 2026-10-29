import { test, expect } from '@playwright/test';
const snapshot = page => page.evaluate(() => window.__blackGeometry.snapshot());

async function ready(page) {
  await page.goto('/?bg-debug');
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready', { timeout: 30000 });
}

test('reduced-motion visitors can navigate posters and explicitly enable animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?bg-debug');
  const enable = page.getByRole('button', { name: 'Enable animation' });
  await expect(enable).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Notes', exact: true }).click();
  await expect(page.locator('#sculpture-poster')).toHaveAttribute('src', /sculpture-notes\.svg$/);
  await enable.click();
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready', { timeout: 30000 });
  await expect(enable).toBeHidden();
  const before = await snapshot(page);
  expect(before.world.warmedTargets).toBe(5);
  await expect.poll(async () => (await snapshot(page)).orbitTime).toBeGreaterThan(before.orbitTime + .2);
});

test('sculpture drag and keyboard rotation remain independent of page navigation', async ({ page }) => {
  await ready(page);
  const world = page.locator('.world');
  const box = await world.boundingBox();
  const before = await snapshot(page);
  await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .55, { steps: 8 });
  await page.mouse.up();
  expect((await snapshot(page)).interaction.orientation).not.toEqual(before.interaction.orientation);
  await world.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  expect((await snapshot(page)).state.chapter).toBe('hero');
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

for (const [width, height] of [[390, 844], [768, 1024]]) test(`touch layout at ${width}px stays live after rotation`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await ready(page);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Education', exact: true }).click();
    await page.setViewportSize({ width: height, height: width });
    await expect(page.locator('#education')).toBeVisible();
    const before = await snapshot(page);
    await expect.poll(async () => (await snapshot(page)).world.frames).toBeGreaterThan(before.world.frames + 5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await snapshot(page)).world.dpr).toBeLessThanOrEqual(2);
  } finally { await context.close(); }
});
