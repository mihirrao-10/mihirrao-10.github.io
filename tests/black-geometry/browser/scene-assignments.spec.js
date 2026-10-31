import { test, expect } from '@playwright/test';

test('each launch shuffles all graphics while navigation preserves the assignment', async ({ page }) => {
  await page.addInitScript(() => {
    const launch = Number(sessionStorage.getItem('test-launch') || 0) + 1;
    sessionStorage.setItem('test-launch', String(launch));
    Math.random = () => launch % 2 ? 0 : .999;
  });
  await page.goto('/?bg-debug#notes');
  await expect.poll(() => page.evaluate(() => !!window.__blackGeometry)).toBe(true);
  const assignment = () => page.locator('[data-scene]').evaluateAll(scenes => scenes.map(scene => scene.dataset.target));
  const first = await assignment();
  expect(new Set(first).size).toBe(7);
  await page.locator('.site-index a[href="#education"]').click();
  await page.locator('.site-index a[href="#notes"]').click();
  expect(await assignment()).toEqual(first);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!window.__blackGeometry)).toBe(true);
  const next = await assignment();
  expect([...next].sort()).toEqual([...first].sort());
  expect(next).not.toEqual(first);
});
