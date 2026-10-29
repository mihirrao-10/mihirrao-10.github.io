import { test, expect } from '@playwright/test';

for (const [port, width, height] of [[8000, 1440, 900], [8001, 390, 844]]) {
  test(`loading screen waits for prepared graphics and fades into the site on ${port}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    let release, requested = false;
    const pending = new Promise(resolve => { release = resolve; });
    await page.route('**/textures/*.bin*', async route => {
      requested = true;
      await pending;
      await route.continue();
    });
    await page.addInitScript(() => {
      window.addEventListener('portfolio:boot-complete', () => {
        window.loaderReveal = {
          state: document.body.dataset.experienceState,
          world: window.__blackGeometry?.snapshot().world,
        };
      }, { once: true });
    });
    try {
      await page.goto(`http://127.0.0.1:${port}/?bg-debug`, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => requested).toBe(true);
      const loader = page.locator('.site-loader');
      await expect(loader).toBeVisible();
      await expect(loader).toHaveCSS('background-color', 'rgb(245, 242, 235)');
      await expect(loader).toHaveCSS('color', 'rgb(0, 0, 0)');
      await expect(page.locator('.site-index')).toBeHidden();
      await expect(page.locator('.world')).toBeHidden();
      await expect(page.locator('.loader-dots span')).toHaveCount(3);
      await expect.poll(() => page.locator('.loader-dots span').evaluateAll(dots => dots.map(dot => {
        const style = getComputedStyle(dot);
        return [style.animationName, style.animationDelay];
      }))).toEqual([['loading-dot', '0s'], ['loading-dot', '0.16s'], ['loading-dot', '0.32s']]);
      await page.screenshot({ path: testInfo.outputPath('loading.png') });
      release();
      await expect(page.locator('html')).toHaveAttribute('data-boot', 'complete', { timeout: 30000 });
      const reveal = await page.evaluate(() => window.loaderReveal);
      expect(reveal.state).toBe('ready');
      expect(reveal.world.warmedTargets).toBe(7);
      expect(reveal.world.frames).toBeGreaterThan(8);
      await expect(loader).toHaveCSS('transition-duration', '0.65s, 0s');
      await expect(loader).toBeHidden();
      await expect(page.locator('.site-index')).toBeVisible();
      await expect(page.locator('.world canvas')).toHaveCSS('opacity', '1');
      await page.screenshot({ path: testInfo.outputPath('revealed.png') });
    } finally { release(); }
  });
}

test('reduced motion keeps the loader still while automatically starting the sculpture', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release, requested = false;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/textures/*.bin*', async route => {
    requested = true;
    await pending;
    await route.continue();
  });
  try {
    await page.goto('/#education', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => requested).toBe(true);
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.locator('.loader-dots span').first()).toHaveCSS('animation-name', 'none');
    release();
    await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready', { timeout: 30000 });
    await expect(page.getByRole('status')).toBeHidden();
    await expect(page.locator('#education')).toBeVisible();
    await expect(page.locator('.site-loader')).toHaveCSS('transition-duration', '0s');
    await expect(page.locator('.world canvas')).toHaveCSS('opacity', '1');
    await expect(page.locator('.animation-action')).toHaveCount(0);
  } finally { release(); }
});

test('a failed entry module releases the loading screen', async ({ page }) => {
  await page.route('**/generated/main.js*', route => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'fallback');
  await expect(page.getByRole('status')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Mihir Rao', exact: true })).toBeVisible();
});

test('a stalled download reaches the static fallback instead of trapping visitors', async ({ page }) => {
  await page.clock.install();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/generated/world-*.js', async route => {
    await pending;
    await route.abort();
  });
  try {
    await page.goto('/?bg-debug', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).toBeVisible();
    await page.clock.fastForward(31000);
    await expect(page.locator('html')).toHaveAttribute('data-boot', 'fallback');
    await expect(page.getByRole('heading', { name: 'Mihir Rao', exact: true })).toBeVisible();
    await expect(page.locator('.animation-action')).toHaveCount(0);
  } finally { release(); }
});

test('visitors without JavaScript see the static page without a loader', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8000/');
    await expect(page.getByRole('status')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Mihir Rao', exact: true })).toBeVisible();
  } finally { await context.close(); }
});
