import { test, expect } from '@playwright/test';

test('wheel alignment starts without an idle pause in either direction', async ({ page }) => {
  await page.addInitScript(() => {
    window.snapTiming = [];
    let inputAt = null;
    window.addEventListener('wheel', () => { inputAt = performance.now(); }, { passive: true });
    const scrollTo = window.scrollTo;
    window.scrollTo = function(options, ...args) {
      if (options?.behavior === 'smooth' && inputAt !== null)
        window.snapTiming.push({ delay: performance.now() - inputAt, top: options.top });
      return scrollTo.call(this, options, ...args);
    };
  });
  await page.goto('/?bg-debug');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 20000 });
  const first = await page.evaluate(() => window.__blackGeometry.snapshot().ranges[1].start);
  await page.mouse.move(1100, 450);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(first, 0);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  const timings = await page.evaluate(() => window.snapTiming);
  expect(timings.map(timing => timing.top)).toEqual([first, 0]);
  // Allow browser task scheduling, but never the old 180ms idle wait.
  for (const timing of timings) expect(timing.delay).toBeLessThan(100);
});
