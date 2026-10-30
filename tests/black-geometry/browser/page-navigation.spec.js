import { test, expect } from '@playwright/test';

async function openStatic(page, path = '/') {
  await page.route('**/textures/*.bin*', route => route.abort());
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'fallback', { timeout: 30000 });
}

async function current(page, id) {
  await expect(page.locator('[data-current-scene]')).toHaveAttribute('id', id);
}

test('trackpad scrolling and mouse drags outside the artwork do not change pages', async ({ page }) => {
  await openStatic(page);
  await expect(page.locator('.site-loader')).toBeHidden();
  await page.mouse.move(100, 600);
  await page.mouse.wheel(200, 0);
  await page.mouse.wheel(-200, 0);
  await page.mouse.wheel(0, 250);
  await page.mouse.move(400, 650);
  await page.mouse.down();
  await page.mouse.move(180, 650, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await current(page, 'top');
  await expect(page.locator('.navigation-hint')).toBeVisible();
});

test('tabs keep the hint until a successful arrow-key page change, then only reload restores it', async ({ page }) => {
  await openStatic(page);
  const hint = page.locator('.navigation-hint');
  await expect(hint).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(hint).toBeVisible();
  await page.locator('.site-index a[href="#education"]').click();
  await current(page, 'education');
  await expect(hint).toBeVisible();
  await page.locator('.site-index a[href="#top"]').click();
  await expect(hint).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await current(page, 'education');
  await expect(hint).toBeHidden();
  await page.locator('.site-index a[href="#teaching"]').click();
  await expect(hint).toBeHidden();
  await page.keyboard.press('ArrowLeft');
  await current(page, 'publications');
  await page.goBack();
  await current(page, 'teaching');
  await expect(hint).toBeHidden();
  await page.locator('.site-index a[href="#top"]').click();
  await expect(hint).toBeHidden();
  await page.reload();
  await expect(hint).toBeVisible();
});

test('every destination resets to the top after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openStatic(page, '/#teaching');
  const teaching = page.locator('#teaching');
  await teaching.evaluate(element => { element.style.maxHeight = '100px'; element.scrollTop = 100; });
  expect(await teaching.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('ArrowRight');
  await current(page, 'personal-projects');
  await page.keyboard.press('ArrowLeft');
  await current(page, 'teaching');
  expect(await teaching.evaluate(element => element.scrollTop)).toBe(0);
});

test('the sculpture retains its own mouse and keyboard controls', async ({ page }) => {
  await page.goto('/?bg-debug');
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready', { timeout: 30000 });
  await expect(page.locator('.site-loader')).toBeHidden();
  const world = page.locator('.world');
  const box = await world.boundingBox();
  await page.mouse.move(box.x + box.width * .4, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .5, { steps: 5 });
  await page.mouse.up();
  await current(page, 'top');
  await world.focus();
  const before = await page.evaluate(() => window.__blackGeometry.snapshot().interaction.orientation);
  await page.keyboard.press('ArrowRight');
  const after = await page.evaluate(() => window.__blackGeometry.snapshot().interaction.orientation);
  expect(after).not.toEqual(before);
  await current(page, 'top');
  await expect(page.locator('.navigation-hint')).toBeVisible();
});
