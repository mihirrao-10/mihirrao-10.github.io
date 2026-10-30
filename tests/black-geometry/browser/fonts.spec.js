import { test, expect } from '@playwright/test';

test('the original typeface loads locally when external font services are unavailable', async ({ page }) => {
  const externalRequests = [];
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => {
    externalRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready', { timeout: 30000 });
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = await document.fonts.load('400 17px "STIX Two Text"', 'Mihir Rao');
    return { loaded: faces.length, state: faces.map(face => face.status),
      resources: performance.getEntriesByType('resource').filter(entry => entry.name.endsWith('.woff2')).map(entry => entry.name) };
  });
  expect(fonts.loaded).toBeGreaterThan(0);
  expect(fonts.state.every(state => state === 'loaded')).toBe(true);
  expect(fonts.resources.some(url => url.includes('/assets/fonts/stix-two-text-normal-latin-'))).toBe(true);
  expect(fonts.resources.every(url => url.startsWith('http://127.0.0.1:8000/assets/fonts/'))).toBe(true);
  expect(externalRequests).toEqual([]);
});
