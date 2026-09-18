import { test, expect } from '@playwright/test';
import { swipe } from './gestures.js';

test('native movement starts while the gesture is active without an application snap timer', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'WebKit automation supplies wheel deltas without gesture phases.');
  await page.addInitScript(() => {
    window.snapTiming = { wheels: [], positions: [], calls: [] };
    window.addEventListener('wheel', () => snapTiming.wheels.push(performance.now()), { passive: true });
    window.addEventListener('scroll', () => snapTiming.positions.push({ at: performance.now(), y: scrollY }), { passive: true });
    const scrollTo = window.scrollTo;
    window.scrollTo = function(...args) {
      snapTiming.calls.push(args);
      return scrollTo.apply(this, args);
    };
  });
  await page.goto('/?bg-debug');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 20000 });
  const first = await page.evaluate(() => window.__blackGeometry.snapshot().ranges[1].start);
  for (const [direction, target] of [[1, first], [-1, 0]]) {
    await page.evaluate(() => { snapTiming.wheels = []; snapTiming.positions = []; snapTiming.calls = []; });
    await swipe(page, browserName, direction);
    await expect.poll(() => page.evaluate(top => Math.abs(scrollY - top), target)).toBeLessThan(2);
    const timing = await page.evaluate(() => window.snapTiming);
    expect(timing.calls).toEqual([]);
    expect(timing.wheels.length).toBeGreaterThan(1);
    const moved = timing.positions.find(position => direction > 0 ? position.y > 2 : position.y < first - 2);
    expect(moved).toBeDefined();
    // Check event ordering rather than wall-clock deadlines: content must move
    // during the user's gesture, without waiting for an idle timeout afterward.
    expect(moved.at).toBeLessThan(timing.wheels.at(-1));
  }
});
