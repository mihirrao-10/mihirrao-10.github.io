import { test, expect } from '@playwright/test';
const snapshot = page => page.evaluate(() => window.__blackGeometry.snapshot());

async function ready(page) {
  await page.goto('/?bg-debug');
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready', { timeout: 30000 });
  await expect(page.locator('.site-loader')).toBeHidden();
}

for (const [width, height, motion] of [[390, 844, 'reduce'], [768, 1024, 'no-preference'], [1440, 900, 'reduce']]) {
  test(`animation starts automatically at ${width}px with ${motion}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: motion });
    await ready(page);
    await expect(page.locator('.animation-action')).toHaveCount(0);
    const before = await snapshot(page);
    expect(before.motion).toBe('full');
    expect(before.world.warmedTargets).toBe(7);
    await expect.poll(async () => (await snapshot(page)).orbitTime).toBeGreaterThan(before.orbitTime + .2);
  });
}

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
  await expect(world).toHaveCSS('outline-style', 'none');
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

for (const touch of [false, true]) test(`all seven sculptures accept full 3D ${touch ? 'touch' : 'mouse'} rotation`, async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  try {
    await ready(page);
    const world = page.locator('.world');
    for (const id of ['top', 'education', 'experience', 'publications', 'teaching', 'personal-projects', 'notes']) {
      await page.locator(`.site-index a[href="#${id}"]`).click();
      const target = await page.locator(`#${id}`).getAttribute('data-target');
      await expect.poll(async () => {
        const { world } = await snapshot(page);
        return [world.target, world.nextTarget, world.blend];
      }).toEqual([target, target, 0]);
      await world.focus();
      await page.keyboard.press('Home');
      const box = await world.boundingBox(), x = box.x + box.width * .65, y = box.y + box.height * .4;
      if (touch) {
        await world.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y });
        await world.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y + 35 });
      } else {
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x, y + 35, { steps: 4 });
      }
      expect((await snapshot(page)).interaction.rotation[0]).toBeGreaterThan(0);
      if (touch) await world.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x + 35, clientY: y + 35 });
      else await page.mouse.move(x + 35, y + 35, { steps: 4 });
      const held = (await snapshot(page)).interaction;
      expect(held.rotation[1]).toBeGreaterThan(0);
      expect(Math.abs(Math.hypot(...held.orientation) - 1)).toBeLessThan(1e-8);
      await expect.poll(async () => (await snapshot(page)).world.userOrientation).toEqual(held.orientation);
      expect((await snapshot(page)).world.contextLost).toBe(false);
      await expect(page.locator('[data-current-scene]')).toHaveAttribute('id', id);
      if (touch) await world.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
      else await page.mouse.up();
    }
  } finally { await context.close(); }
});

test('native phone touch drags rotate vertically and horizontally without navigating', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native touch movement uses the Chromium input protocol.');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await ready(page);
    const client = await context.newCDPSession(page);
    const box = await page.locator('.world').boundingBox();
    const x = box.x + box.width * .5, y = box.y + box.height * .4;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 5; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + i * 8 }] });
    expect((await snapshot(page)).interaction.rotation[0]).toBeGreaterThan(0);
    for (let i = 1; i <= 5; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 8, y: y + 40 }] });
    expect((await snapshot(page)).interaction.rotation[1]).toBeGreaterThan(0);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('[data-current-scene]')).toHaveAttribute('id', 'top');
  } finally { await context.close(); }
});
