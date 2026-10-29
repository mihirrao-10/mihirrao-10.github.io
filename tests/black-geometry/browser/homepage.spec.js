import { test, expect } from '@playwright/test';

const snapshot = page => page.evaluate(() => window.__blackGeometry.snapshot());
const scenes = [
  ['top', 'hero'], ['education', 'education'], ['experience', 'experience'],
  ['publications', 'publications'], ['teaching', 'teaching'], ['personal-projects', 'projects'], ['notes', 'notes'],
];
async function select(page, id) {
  await page.locator(`.site-index a[href="#${id}"]`).click();
  await expect(page.locator('[data-current-scene]')).toHaveAttribute('id', id);
}
async function live(page, path = '/?bg-debug') {
  await page.goto(path);
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready', { timeout: 30000 });
  await expect(page.locator('.site-loader')).toBeHidden();
}

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
  test(`every page fits without document scrolling at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.route('**/textures/*.bin*', route => route.abort());
    await page.goto('/?bg-debug');
    for (const [id, target] of scenes) {
      await select(page, id);
      await expect.poll(() => page.locator('#sculpture-poster').evaluate(image => new URL(image.src).pathname)).toBe(`/assets/black-geometry/generated/sculpture-${target}.svg`);
      const dimensions = await page.locator(`#${id}`).evaluate(element => {
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, right: box.right, height: innerHeight,
          width: innerWidth, y: scrollY, scrollWidth: document.documentElement.scrollWidth,
          overflow: element.scrollHeight > element.clientHeight + 1 };
      });
      expect(dimensions.top).toBeGreaterThanOrEqual(80);
      expect(dimensions.bottom).toBeLessThanOrEqual(height);
      expect(dimensions.right).toBeLessThanOrEqual(width);
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(width);
      expect(dimensions.y).toBe(0);
      expect(dimensions.overflow).toBe(false);
      await page.mouse.wheel(0, 900);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await expect(page.locator('[data-current-scene]')).toHaveCount(1);
      await expect(page.locator('.site-index')).toBeVisible();
    }
  });
}

test('menu switches seven translucent cosmic scenes and supports rapid reversals', async ({ page }) => {
  await live(page);
  for (const [id, target] of scenes) {
    await select(page, id);
    await expect.poll(async () => {
      const { world } = await snapshot(page);
      return [world.target, world.nextTarget, world.blend];
    }).toEqual([target, target, 0]);
    const { world } = await snapshot(page);
    expect(world.decodedTargets).toBe(7);
    expect(world.warmedTargets).toBe(7);
    expect(world.finiteActiveBuffers).toBe(true);
    const cosmic = true;
    expect(world.depthPrepass).toBe(!cosmic);
    expect(world.transparentCosmos).toBe(true);
    expect(world.coherentDepth).toBe(true);
    expect(world.cosmicTargets).toEqual(cosmic ? [target] : []);
    expect(world.activeInteriorMeshes).toBe(0);
  }
  await select(page, 'personal-projects');
  await select(page, 'education');
  await select(page, 'top');
  await expect.poll(async () => (await snapshot(page)).world.target).toBe('hero');
  await expect(page.locator('.world')).toHaveCSS('filter', 'none');
});

test('deep links, reload and browser history restore the selected page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#project-congestion');
  await expect(page.locator('#personal-projects')).toBeVisible();
  await select(page, 'notes');
  await select(page, 'education');
  await page.goBack();
  await expect(page.locator('#notes')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#personal-projects')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#notes')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#education')).toBeVisible();
  await page.reload();
  await expect(page.locator('#education')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Education', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('each section shows both entries with no secondary navigation or detail controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const id of ['education', 'experience', 'personal-projects']) {
    await select(page, id);
    await expect(page.locator(`#${id} .entry:visible`)).toHaveCount(2);
    await expect(page.locator(`#${id} button, .page-index`)).toHaveCount(0);
  }
  await expect(page.locator('.site-index a')).toHaveCount(7);
});

test('content and navigation remain usable while sculpture data is unavailable', async ({ page }) => {
  await page.route('**/textures/*.bin*', route => route.abort());
  await page.goto('/?bg-debug');
  await expect(page.getByRole('heading', { name: 'Mihir Rao', exact: true })).toBeVisible();
  await expect(page.locator('.animation-action')).toHaveCount(0);
  await select(page, 'notes');
  await expect(page.locator('#notes .note-link').first()).toBeVisible();
  await expect(page.locator('#sculpture-poster')).toHaveAttribute('src', /sculpture-notes\.svg\?v=/);
});

for (const port of [8000, 8001]) test(`root/dist ${port} preserves PDF links and local assets`, async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}/#notes`);
  for (const href of await page.locator('#notes .note-link').evaluateAll(links => links.map(link => link.href))) {
    const response = await request.get(href);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }
});

test('cosmic orbits advance smoothly while the prepared mesh count stays stable', async ({ page }) => {
  await live(page);
  await select(page, 'education');
  await expect.poll(async () => (await snapshot(page)).world.cosmicTargets).toEqual(['education']);
  const before = (await snapshot(page)).world;
  await expect.poll(async () => (await snapshot(page)).world.cosmicAges.education).toBeGreaterThan(before.cosmicAges.education + .3);
  expect((await snapshot(page)).world.geometries).toBe(before.geometries);
});
