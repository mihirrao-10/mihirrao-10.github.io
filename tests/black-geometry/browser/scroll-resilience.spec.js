import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/?bg-debug');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 20000 });
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready');
}

test('wheel navigation completes even when browser smooth scrolling does not advance', async ({ page }) => {
  await page.addInitScript(() => {
    const scroll = window.scrollTo.bind(window);
    window.scrollTo = (...args) => {
      if (args[0]?.behavior === 'smooth') return;
      scroll(...args);
    };
  });
  await ready(page);
  await page.mouse.move(1100, 450);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => Math.abs(scrollY - window.__blackGeometry.snapshot().ranges[1].start)), { timeout: 3000 }).toBeLessThan(2);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 3000 }).toBeLessThan(2);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toBe('y mandatory');
});

for (const continuedInput of [false, true]) test(`scroll recovers while animation frames are delayed, continued input: ${continuedInput}`, async ({ page }) => {
  await ready(page);
  await page.mouse.move(1100, 450);
  await page.evaluate(() => {
    const originalRequest = window.requestAnimationFrame.bind(window);
    const originalCancel = window.cancelAnimationFrame.bind(window);
    const pending = new Map();
    let serial = -1;
    window.requestAnimationFrame = callback => { pending.set(--serial, callback); return serial; };
    window.cancelAnimationFrame = id => { if (id < 0) pending.delete(id); else originalCancel(id); };
    setTimeout(() => {
      window.requestAnimationFrame = originalRequest;
      window.cancelAnimationFrame = originalCancel;
      pending.forEach(callback => originalRequest(callback));
    }, 2000);
  });
  await page.mouse.wheel(0, 120);
  if (continuedInput) {
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, 120);
  }
  await expect.poll(() => page.evaluate(() => Math.abs(scrollY - window.__blackGeometry.snapshot().ranges[1].start)), { timeout: 1200, intervals: [50] }).toBeLessThan(2);
});

test('reversing a transition and clicking the sculpture cannot leave scrolling locked', async ({ page }) => {
  await ready(page);
  await page.mouse.move(1100, 450);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(100);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  await page.mouse.click(1100, 450);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => Math.abs(scrollY - window.__blackGeometry.snapshot().ranges[1].start))).toBeLessThan(2);
});

test('a new trackpad swipe is accepted while the previous swipe is settling', async ({ page }) => {
  await ready(page);
  // Two overlapping finger strokes delivered after a busy frame. Preserve
  // their original cadence independently of browser-automation round trips.
  await page.evaluate(() => {
    const start = performance.now() - 400;
    [120, 60, 15, 3, 20, 40, 60, 40].forEach((deltaY, index) => {
      const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'timeStamp', { value: start + index * 40 });
      document.querySelector('.world').dispatchEvent(event);
    });
  });
  await expect.poll(() => page.evaluate(() => Math.abs(scrollY - window.__blackGeometry.snapshot().ranges[2].start)), { timeout: 3000 }).toBeLessThan(2);
});
