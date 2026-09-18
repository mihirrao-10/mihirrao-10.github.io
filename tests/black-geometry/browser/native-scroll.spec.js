import { test, expect } from '@playwright/test';
import { swipe } from './gestures.js';

async function observeInput(page) {
  await page.addInitScript(() => {
    window.inputAudit = { listeners: [], cancelled: [] };
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, callback, options) {
      if (['wheel', 'touchmove'].includes(type)) window.inputAudit.listeners.push({ type, passive: options?.passive === true });
      return add.call(this, type, callback, options);
    };
    window.addEventListener('wheel', event => {
      // Microtasks can run between listeners for a trusted browser event.
      // Observe the result after the paging listener has also received it.
      setTimeout(() => window.inputAudit.cancelled.push(event.defaultPrevented), 0);
    }, { passive: true });
  });
}
async function ready(page) {
  await observeInput(page);
  await page.goto('/?bg-debug');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 20000 });
}
const y = page => page.evaluate(() => scrollY);
const firstEntry = page => page.evaluate(() => window.__blackGeometry.snapshot().ranges[1].start);

for (const [width, height] of [[1440, 900], [390, 844], [768, 1024]]) test(`native scrolling remains available at ${width}px`, async ({ page, browserName }) => {
  await page.setViewportSize({ width, height });
  await ready(page);
  const first = await firstEntry(page);
  await swipe(page, browserName, 1, { x: 10, y: height - 100, distance: height * .7 });
  await expect.poll(async () => Math.abs(await y(page) - first)).toBeLessThan(2);
  const audit = await page.evaluate(() => window.inputAudit);
  expect(audit.cancelled.length).toBeGreaterThan(0);
  expect(audit.cancelled.every(value => value === false)).toBe(true);
  expect(audit.listeners.every(listener => listener.passive)).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toBe('y mandatory');
});

test('native scrolling over the sculpture works even without renderer frames', async ({ page, browserName }) => {
  await ready(page);
  expect(await page.locator('.world').evaluate(el => getComputedStyle(el).overflowY)).toBe('clip');
  const first = await firstEntry(page);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await swipe(page, browserName, 1);
  await expect.poll(async () => Math.abs(await y(page) - first)).toBeLessThan(2);
  expect(await page.evaluate(() => window.inputAudit.cancelled.every(cancelled => !cancelled))).toBe(true);
});

test('keyboard and reverse wheel input complete native scrolling', async ({ page, browserName }) => {
  await ready(page);
  const first = await firstEntry(page);
  await page.keyboard.press('PageDown', { delay: 80 });
  await expect.poll(async () => Math.abs(await y(page) - first)).toBeLessThan(2);
  await swipe(page, browserName, -1);
  await expect.poll(() => y(page)).toBeLessThan(2);
  await swipe(page, browserName, 1);
  await expect.poll(async () => Math.abs(await y(page) - first)).toBeLessThan(2);
});

test('a synthetic wheel packet cannot replace actual browser scrolling', async ({ page }) => {
  await ready(page);
  await page.dispatchEvent('.world', 'wheel', { deltaY: 5000, bubbles: true, cancelable: true });
  await page.waitForTimeout(350);
  expect(await y(page)).toBe(0);
  expect(await page.evaluate(() => window.inputAudit.cancelled)).toEqual([false]);
});

test('the page still scrolls if the entire enhancement module fails to load', async ({ page, browserName }) => {
  await observeInput(page);
  await page.route('**/generated/main.js*', route => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'fallback');
  await swipe(page, browserName, 1, { x: 30, y: 700 });
  await expect.poll(() => y(page)).toBeGreaterThan(40);
  expect(await page.evaluate(() => window.inputAudit.cancelled.every(value => value === false))).toBe(true);
});
