import { test, expect } from '@playwright/test';
import { ENTRIES } from '../../../src/black-geometry/scene-state.js';

const targets = ENTRIES.map(entry => entry.target).sort();

async function instrumentPreparation(page, identityShuffle = false) {
  await page.addInitScript(identity => {
    if (identity) Math.random = () => .999;
    const counters = {}, originals = new Map();
    const prototype = WebGL2RenderingContext.prototype;
    for (const method of ['compileShader', 'linkProgram', 'bufferData', 'bufferSubData',
      'texImage2D', 'texSubImage2D', 'texStorage2D']) {
      const original = prototype[method];
      counters[method] = 0; originals.set(method, original);
      prototype[method] = function (...args) {
        counters[method]++;
        return original.apply(this, args);
      };
    }
    window.preparationCounters = counters;
    window.restorePreparationInstrumentation = () => {
      for (const [method, original] of originals) prototype[method] = original;
    };
    window.addEventListener('portfolio:boot-complete', () => {
      const snapshot = window.__blackGeometry.snapshot(), canvas = document.querySelector('.world canvas');
      window.preparationAtReveal = {
        snapshot, counters: { ...counters }, canvas: [canvas.width, canvas.height],
        fonts: document.fonts.status, boot: document.documentElement.dataset.boot,
        state: document.body.dataset.experienceState,
      };
    }, { once: true });
  }, identityShuffle);
}

async function waitForReveal(page) {
  await expect.poll(() => page.evaluate(() => !!window.preparationAtReveal), { timeout: 30000 }).toBe(true);
  const reveal = await page.evaluate(() => window.preparationAtReveal);
  const { snapshot, canvas } = reveal, { world } = snapshot;
  expect(reveal.boot).toBe('complete');
  expect(reveal.state).toBe('ready');
  expect(reveal.fonts).toBe('loaded');
  expect(world.preparedScenes.slice().sort()).toEqual(targets);
  expect(world.warmedTargets).toBe(7);
  expect(world.preparedMaps).toEqual([]);
  expect(world.gpuReady).toBe(true);
  expect(world.liveFrameReady).toBe(true);
  expect(world.target).toBe(snapshot.assignments[snapshot.page]);
  expect(world.sceneWeights).toEqual({ [world.target]: 1 });
  expect(world.entranceScale).toBe(1);
  expect(canvas).toEqual([Math.floor(world.width * world.dpr), Math.floor(world.height * world.dpr)]);
  expect(Math.min(...canvas)).toBeGreaterThan(64);
  expect(reveal.counters.compileShader).toBeGreaterThan(0);
  expect(reveal.counters.linkProgram).toBeGreaterThan(0);
  expect(reveal.counters.bufferData).toBeGreaterThan(0);
  expect(reveal.counters.texImage2D + reveal.counters.texSubImage2D).toBeGreaterThan(0);
  return reveal;
}

async function settle(page, target) {
  await expect.poll(() => page.evaluate(() => window.__blackGeometry.snapshot().world.sceneWeights))
    .toEqual({ [target]: 1 });
}

test('all seven first visits and repeats reuse shaders, buffers, and uploaded maps after reveal', async ({ page }) => {
  test.setTimeout(120000);
  await instrumentPreparation(page);
  const errors = [], textureRequests = []; page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/textures/')) textureRequests.push(request.url()); });
  try {
    await page.goto('/?bg-debug');
    const reveal = await waitForReveal(page);
    await expect(page.locator('.site-loader')).toBeHidden();
    const assignments = await page.evaluate(() => window.__blackGeometry.snapshot().assignments);
    expect(Object.values(assignments).sort()).toEqual(targets);
    for (let visit = 0; visit < 2; visit++) for (const [section, target] of Object.entries(assignments)) {
      await page.locator(`.site-index a[href="#${section}"]`).click();
      await settle(page, target);
      expect(await page.evaluate(() => ({ ...window.preparationCounters })), `${target}, visit ${visit + 1}`)
        .toEqual(reveal.counters);
    }
    expect(errors).toEqual([]);
    expect(textureRequests).toEqual([]);
  } finally {
    await page.evaluate(() => window.restorePreparationInstrumentation?.());
  }
});

test('every possible initial graphic completes preparation before the loader disappears', async ({ page }) => {
  test.setTimeout(120000);
  await instrumentPreparation(page, true);
  const initialTargets = [];
  try {
    for (const entry of ENTRIES) {
      // A distinct query forces a fresh document; changing only the hash would reuse it.
      await page.goto(`/?bg-debug&initial=${entry.id}#${entry.section}`);
      const { snapshot } = await waitForReveal(page);
      expect(snapshot.page).toBe(entry.section);
      initialTargets.push(snapshot.world.target);
      await page.evaluate(() => window.restorePreparationInstrumentation());
    }
    expect(initialTargets.sort()).toEqual(targets);
  } finally {
    await page.evaluate(() => window.restorePreparationInstrumentation?.());
  }
});

test('rapid skips and reversals retain complete scene coverage and settle on the latest assignment', async ({ page }) => {
  test.setTimeout(60000);
  await instrumentPreparation(page);
  try {
    await page.goto('/?bg-debug');
    await waitForReveal(page);
    await expect(page.locator('.site-loader')).toBeHidden();
    const result = await page.evaluate(async () => {
      const assignments = window.__blackGeometry.snapshot().assignments, sections = Object.keys(assignments);
      const samples = [];
      async function frames(count) {
        const start = window.__blackGeometry.snapshot().world.frames;
        while (window.__blackGeometry.snapshot().world.frames < start + count) {
          await new Promise(requestAnimationFrame);
          const world = window.__blackGeometry.snapshot().world;
          samples.push({ weights: world.sceneWeights, drawCalls: world.drawCalls, rendered: world.fitScales.length });
        }
      }
      // Include immediate reversals and more than two overlapping destinations.
      const sequence = [sections[1], sections[0], sections[2], sections[4], sections[3], sections[6], sections[5]];
      for (const section of sequence) {
        document.querySelector(`.site-index a[href="#${section}"]`).click();
        await frames(2);
      }
      return { samples, target: assignments[sequence.at(-1)] };
    });
    for (const sample of result.samples) {
      const weights = Object.values(sample.weights);
      expect(weights.length).toBeGreaterThan(0);
      expect(weights.every(weight => Number.isFinite(weight) && weight >= 0 && weight <= 1)).toBe(true);
      expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 10);
      expect(sample.drawCalls).toBeGreaterThan(0);
      expect(sample.rendered).toBe(weights.filter(weight => weight > 0).length);
    }
    expect(result.samples.some(sample => Object.values(sample.weights).filter(weight => weight > 0).length > 2)).toBe(true);
    await settle(page, result.target);
    const final = await page.evaluate(() => window.__blackGeometry.snapshot());
    expect(final.world.target).toBe(result.target);
    expect(final.world.nextTarget).toBe(result.target);
    expect(final.world.contextLost).toBe(false);
  } finally {
    await page.evaluate(() => window.restorePreparationInstrumentation?.());
  }
});
