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
    window.addEventListener('wheel', event => window.scrollAudit.wheels.push({ y: scrollY, deltaY: event.deltaY, at: event.timeStamp }), { passive: true });
  });
  await page.goto('/?bg-debug');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 20000 });
  await page.mouse.move(1100, 450);
}

async function wheelGesture(page, deltas, interval) {
  // Chromium may acknowledge a cancelled wheel only after the smooth scroll.
  // Send at physical gesture cadence, without waiting for each acknowledgement.
  const pending = [];
  for (const delta of deltas) {
    pending.push(page.mouse.wheel(0, delta));
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  await Promise.all(pending);
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

test('one sustained wheel gesture advances exactly one slide even after its animation ends', async ({ page }) => {
  test.setTimeout(60000);
  await ready(page);
  for (const direction of [1, -1]) {
    await page.evaluate(() => { scrollAudit.calls = []; scrollAudit.positions = []; });
    await wheelGesture(page, Array(32).fill(direction * 120), 40);
    await aligned(page);
    const state = await page.evaluate(() => ({ ...scrollAudit, y: scrollY, ranges: window.__blackGeometry.snapshot().ranges, max: document.documentElement.scrollHeight - innerHeight }));
    expectContinuous(state, direction);
    const target = direction > 0 ? state.ranges[1].start : 0;
    expect(Math.abs(state.y - target)).toBeLessThan(2);
    expect(state.calls.filter(call => call.behavior === 'smooth').map(call => call.top)).toEqual([target]);
  }
});

test('accelerating and decaying trackpad packets remain one slide per gesture', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  for (const direction of [1, -1]) {
    const before = await page.evaluate(() => {
      scrollAudit.calls = []; scrollAudit.positions = [];
      return scrollY;
    });
    await wheelGesture(page, [3, 8, 20, 45, 70, 100, 80, 60, 40, 24, 15, 9, 5, 3, 1, .5, .25].map(delta => direction * delta), 16);
    await aligned(page);
    const state = await page.evaluate(() => ({ ...scrollAudit, y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
    expectContinuous(state, direction);
    expect(direction * (state.y - before)).toBeGreaterThan(100);
    expect(state.calls.filter(call => call.behavior === 'smooth')).toHaveLength(1);
  }
});

for (const tailLength of [8, 40]) test(`consecutive swipes work while momentum is still arriving (${tailLength} tail packets)`, async ({ page }) => {
  await ready(page);
  const ranges = await page.evaluate(() => window.__blackGeometry.snapshot().ranges);
  const flick = [3, 8, 20, 45, 80, 100, 80, 60, 40, 24, 15, 9, 5, 3, 2, 1];
  const stroke = [...flick, ...Array(tailLength).fill(1)];
  for (const direction of [1, -1]) {
    await page.evaluate(() => { scrollAudit.calls = []; scrollAudit.positions = []; scrollAudit.wheels = []; });
    // Two pushes in a single uninterrupted stream. There is no quiet gap to
    // release the old gesture, including when the first snap is unfinished.
    await wheelGesture(page, [...stroke, ...stroke].map(delta => delta * direction), 16);
    await aligned(page);
    const state = await page.evaluate(() => ({ ...scrollAudit, y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
    const targets = direction > 0 ? [ranges[1].start, ranges[2].start] : [ranges[1].stop, 0];
    expect(state.calls.filter(call => call.behavior === 'smooth').map(call => call.top)).toEqual(targets);
    expect(Math.abs(state.y - targets[1])).toBeLessThan(2);
    expectContinuous(state, direction);
  }
});

test('large wheel deltas and separate gestures each move only to the adjacent slide', async ({ page }) => {
  await ready(page);
  const ranges = await page.evaluate(() => window.__blackGeometry.snapshot().ranges);
  for (const [delta, index] of [[5000, 1], [5000, 2], [-5000, 1], [-5000, 0]]) {
    await page.mouse.wheel(0, delta);
    await aligned(page);
    expect(Math.abs(await page.evaluate(() => scrollY) - ranges[index].start)).toBeLessThan(2);
    // A physical pause separates this gesture from the next one.
    await page.waitForTimeout(230);
  }
});

test('a deliberate reversal returns before reaching the original snap target', async ({ page }) => {
  await ready(page);
  let reversal;
  await page.exposeFunction('reverseWheel', () => (reversal = page.mouse.wheel(0, -3)));
  await page.evaluate(() => {
    scrollAudit.calls = []; scrollAudit.positions = [];
    // Trigger from observed movement: a wheel acknowledgement or a fixed delay
    // can arrive before the animation starts or after it ends in Chromium.
    const reverse = () => {
      if (scrollY <= 30) return;
      removeEventListener('scroll', reverse);
      void window.reverseWheel();
    };
    addEventListener('scroll', reverse, { passive: true });
  });
  await page.mouse.wheel(0, 120);
  await expect.poll(() => Boolean(reversal)).toBe(true);
  await reversal;
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  const state = await page.evaluate(() => ({ ...scrollAudit, first: window.__blackGeometry.snapshot().ranges[1].start }));
  expect(state.wheels.find(wheel => wheel.deltaY < 0).y).toBeGreaterThan(0);
  expect(Math.max(...state.positions)).toBeLessThan(state.first - 2);
  expect(state.calls.filter(call => call.behavior === 'smooth').map(call => call.top)).toEqual([state.first, 0]);
});
