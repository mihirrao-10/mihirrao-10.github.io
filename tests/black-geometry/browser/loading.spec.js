import { test, expect } from '@playwright/test';

test('graphics warmup uploads every scene in a small buffer and restores full resolution before reveal', async ({ page }) => {
  await page.addInitScript(() => {
    const buffers = [], originals = new Map();
    for (const method of ['drawArrays', 'drawElements']) {
      const original = WebGL2RenderingContext.prototype[method];
      originals.set(method, original);
      WebGL2RenderingContext.prototype[method] = function (...args) {
        buffers.push([this.drawingBufferWidth, this.drawingBufferHeight]);
        return original.apply(this, args);
      };
    }
    window.addEventListener('portfolio:boot-complete', () => {
      for (const [method, original] of originals) WebGL2RenderingContext.prototype[method] = original;
      const canvas = document.querySelector('.world canvas');
      window.preparedBuffers = { draws: buffers, width: canvas.width, height: canvas.height,
        world: window.__blackGeometry.snapshot().world };
    }, { once: true });
  });
  await page.goto('/?bg-debug');
  await expect.poll(() => page.evaluate(() => !!window.preparedBuffers)).toBe(true);
  const { draws, width, height, world } = await page.evaluate(() => window.preparedBuffers);
  expect(world.warmedTargets).toBe(7);
  expect(draws[0]).toEqual([64, 64]);
  expect(draws.at(-1)).toEqual([width, height]);
  expect(width).toBe(Math.floor(world.width * world.dpr));
  expect(height).toBe(Math.floor(world.height * world.dpr));
  expect(Math.min(width, height)).toBeGreaterThan(64);
  await expect(page.locator('.site-loader')).toBeHidden();
  await page.evaluate(() => {
    const canvas = document.querySelector('.world canvas');
    window.bufferResizes = 0;
    for (const property of ['width', 'height']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, property);
      Object.defineProperty(canvas, property, { get: descriptor.get, set(value) {
        window.bufferResizes++;
        descriptor.set.call(this, value);
      } });
    }
  });
  await page.locator('.site-index a[href="#education"]').click();
  const target = await page.locator('#education').getAttribute('data-target');
  await expect.poll(() => page.evaluate(() => {
    const world = window.__blackGeometry.snapshot().world;
    return [world.target, world.nextTarget, world.blend];
  })).toEqual([target, target, 0]);
  expect(await page.evaluate(() => window.bufferResizes)).toBe(0);
  const repeatedAttributes = await page.evaluate(async () => {
    const changes = [], start = window.__blackGeometry.snapshot().world.frames;
    const observer = new MutationObserver(records => changes.push(...records.map(record => record.attributeName)));
    observer.observe(document.body, { attributes: true });
    await new Promise(resolve => {
      function sample() {
        if (window.__blackGeometry.snapshot().world.frames >= start + 6) resolve();
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    observer.disconnect();
    return changes;
  });
  expect(repeatedAttributes).toEqual([]);
});

for (const [port, width, height] of [[8000, 1440, 900], [8001, 390, 844]]) {
  test(`loading screen waits for prepared graphics and fades into the site on ${port}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    let release, requested = false;
    const pending = new Promise(resolve => { release = resolve; });
    await page.route('**/generated/world-*.js', async route => {
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
      // WebKit can keep fonts.ready pending while the module preload is held.
      // Verify the blocked loader above, then capture after releasing the resource.
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
  await page.route('**/generated/world-*.js', async route => {
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
