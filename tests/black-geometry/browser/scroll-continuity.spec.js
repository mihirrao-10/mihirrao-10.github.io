import { test, expect } from '@playwright/test';
import { swipe } from './gestures.js';

async function ready(page) {
  await page.addInitScript(() => {
    window.scrollAudit = { calls: [], positions: [], wheels: [] };
    const original = window.scrollTo;
    window.scrollTo = function(...args) {
      window.scrollAudit.calls.push(args);
      return original.apply(this, args);
    };
    window.addEventListener('scroll', () => {
      window.scrollAudit.positions.push({ y: scrollY, at: performance.now() });
    }, { passive: true });
    window.addEventListener('wheel', event => {
      const record = { deltaY: event.deltaY, at: performance.now(), cancelled: null };
      window.scrollAudit.wheels.push(record);
      // A microtask can run before later listeners for the same trusted event.
      setTimeout(() => { record.cancelled = event.defaultPrevented; }, 0);
    }, { passive: true });
  });
  await page.goto('/?bg-debug');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 20000 });
  return page.evaluate(() => window.__blackGeometry.snapshot().ranges);
}

async function resetAudit(page) {
  await page.evaluate(() => {
    scrollAudit.calls = [];
    scrollAudit.positions = [];
    scrollAudit.wheels = [];
  });
}

async function atEntry(page, top) {
  await expect.poll(() => page.evaluate(target => Math.abs(scrollY - target), top)).toBeLessThan(2);
}

function expectNativeMotion(audit, direction) {
  expect(audit.calls).toEqual([]);
  expect(audit.wheels.length).toBeGreaterThan(0);
  expect(audit.wheels.every(wheel => wheel.cancelled === false)).toBe(true);
  expect(audit.positions.length).toBeGreaterThan(0);
  for (let i = 1; i < audit.positions.length; i++) {
    expect(direction * (audit.positions[i].y - audit.positions[i - 1].y)).toBeGreaterThanOrEqual(-2);
  }
}

for (const [column, x] of [['text', 300], ['sculpture', 1100]]) {
  test(`successive native gestures move down and back over the ${column} column`, async ({ page, browserName }) => {
    const ranges = await ready(page);
    let previous = 0;
    // Issue the next gesture as soon as the preceding entry is reached. There
    // is no application cooldown or artificial pause between separate swipes.
    for (const index of [1, 2, 1, 0, 1]) {
      const direction = Math.sign(index - previous);
      await resetAudit(page);
      await swipe(page, browserName, direction, { x });
      await atEntry(page, ranges[index].start);
      expectNativeMotion(await page.evaluate(() => window.scrollAudit), direction);
      previous = index;
    }
  });
}

test('native gestures remain usable when renderer animation frames stop', async ({ page, browserName }) => {
  const ranges = await ready(page);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  for (const [direction, index] of [[1, 1], [1, 2], [-1, 1], [-1, 0]]) {
    await resetAudit(page);
    await swipe(page, browserName, direction);
    await atEntry(page, ranges[index].start);
    expectNativeMotion(await page.evaluate(() => window.scrollAudit), direction);
  }
});
