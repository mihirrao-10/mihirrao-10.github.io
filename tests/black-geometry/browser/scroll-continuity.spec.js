import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.addInitScript(() => {
    window.scrollAudit = { calls: [], positions: [], wheels: [] };
    const original = window.scrollTo;
    window.scrollTo = function(options, ...args) {
      window.scrollAudit.calls.push({ y: scrollY, ...options });
      return original.call(this, options, ...args);
    };
    window.addEventListener('scroll', () => window.scrollAudit.positions.push(scrollY), { passive: true });
    window.addEventListener('wheel', event => window.scrollAudit.wheels.push({ y: scrollY, deltaY: event.deltaY }), { passive: true });
  });
  await page.goto('/?bg-debug');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 20000 });
  await page.mouse.move(1100, 450);
}

async function aligned(page) {
  let previous = -1, stable = 0;
  await expect.poll(async () => {
    const state = await page.evaluate(() => ({ y: scrollY, ranges: window.__blackGeometry.snapshot().ranges }));
    stable = Math.abs(state.y - previous) < .5 ? stable + 1 : 0;
    previous = state.y;
    return stable >= 2 && state.ranges.some(r => state.y >= r.start - 2 && state.y <= r.stop + 2);
  }).toBe(true);
}

function expectContinuous(state, direction) {
  // A new snap commits its current offset once. It must never cancel and
  // restart the same destination as further packets arrive.
  for (let i = 0; i < state.calls.length; i += 2) {
    expect(state.calls[i]).toEqual({ y: state.calls[i].y, top: state.calls[i].y, behavior: 'instant' });
    expect(state.calls[i + 1]?.behavior).toBe('smooth');
  }
  const targets = state.calls.filter(call => call.behavior === 'smooth').map(call => call.top);
  expect(targets.length).toBeGreaterThan(0);
  expect(new Set(targets).size).toBe(targets.length);
  const positions = state.positions.map(y => Math.max(0, Math.min(state.max, y)));
  for (let i = 1; i < positions.length; i++) expect(direction * (positions[i] - positions[i - 1])).toBeGreaterThanOrEqual(-1);
}

test('sustained wheel scrolling never restarts a snap or moves against the gesture', async ({ page }) => {
  test.setTimeout(60000);
  await ready(page);
  for (const direction of [1, -1]) {
    await page.evaluate(() => { scrollAudit.calls = []; scrollAudit.positions = []; });
    for (let i = 0; i < 32; i++) {
      await page.mouse.wheel(0, direction * 120);
      await page.waitForTimeout(40);
    }
    await aligned(page);
    const state = await page.evaluate(() => ({ ...scrollAudit, y: scrollY, ranges: window.__blackGeometry.snapshot().ranges, max: document.documentElement.scrollHeight - innerHeight }));
    expectContinuous(state, direction);
    if (direction > 0) expect(state.y).toBeGreaterThanOrEqual(state.ranges[2].start - 2);
    else expect(state.y).toBeLessThan(2);
  }
});

test('short accelerating and decaying wheel bursts stay smooth in both directions', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  for (const direction of [1, -1]) {
    const before = await page.evaluate(() => {
      scrollAudit.calls = []; scrollAudit.positions = [];
      return scrollY;
    });
    for (const delta of [3, 8, 20, 45, 70, 100, 80, 60, 40, 24, 15, 9, 5, 3, 1, .5, .25]) {
      await page.mouse.wheel(0, direction * delta);
      await page.waitForTimeout(10);
    }
    await aligned(page);
    const state = await page.evaluate(() => ({ ...scrollAudit, y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
    expectContinuous(state, direction);
    expect(direction * (state.y - before)).toBeGreaterThan(100);
  }
});

test('a deliberate reversal returns before reaching the original snap target', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => { scrollAudit.calls = []; scrollAudit.positions = []; });
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(() => scrollAudit.calls.some(call => call.behavior === 'smooth'));
  await page.mouse.wheel(0, -3);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  const state = await page.evaluate(() => ({ ...scrollAudit, first: window.__blackGeometry.snapshot().ranges[1].start }));
  expect(state.wheels.find(wheel => wheel.deltaY < 0).y).toBeGreaterThan(0);
  expect(Math.max(...state.positions)).toBeLessThan(state.first - 2);
  expect(state.calls.filter(call => call.behavior === 'smooth').map(call => call.top)).toEqual([state.first, 0]);
});
