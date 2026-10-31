import { ENTRIES } from '../../src/black-geometry/scene-state.js';

export { ENTRIES };
export const baseURL = process.env.BG_BASE_URL || 'http://127.0.0.1:8000';

export async function openPortfolio(page) {
  await page.addInitScript(() => {
    window.addEventListener('portfolio:boot-complete', () => {
      const startupMs = performance.now();
      const resources = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')]
        .map(entry => ({ name: entry.name, initiator: entry.initiatorType,
          startMs: entry.startTime, durationMs: entry.duration,
          encodedBytes: entry.encodedBodySize, transferBytes: entry.transferSize }));
      window.__portfolioDiagnosticsStartup = { startupMs, resources,
        encodedBytes: resources.reduce((total, resource) => total + resource.encodedBytes, 0),
        transferBytes: resources.reduce((total, resource) => total + resource.transferBytes, 0) };
    }, { once: true });
  });
  await page.goto(`${baseURL}/?bg-debug`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.experienceState === 'ready' &&
    document.documentElement.dataset.boot !== 'loading' && window.__portfolioDiagnosticsStartup,
  undefined, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => window.__portfolioDiagnosticsStartup);
}

export async function selectPage(page, entry) {
  await page.locator(`.site-index a[href="#${entry.section}"]`).click();
  const target = await page.locator(`#${entry.section}`).getAttribute('data-target');
  await page.waitForFunction(target => {
    const world = window.__blackGeometry.snapshot().world;
    return world.target === target && world.nextTarget === target && world.blend === 0 &&
      (!world.sceneWeights || (world.sceneWeights[target] === 1 && Object.values(world.sceneWeights).filter(weight => weight > 0).length === 1));
  }, target);
}

/** Observe rendered frames for a fixed window, so a stalled canvas cannot hang a report. */
export async function frameTimings(page, duration = 1500) {
  return page.evaluate(async duration => {
    const intervals = [], begin = performance.now();
    let previous = begin, frames = window.__blackGeometry.snapshot().world.frames;
    while (performance.now() - begin < duration) {
      await new Promise(requestAnimationFrame);
      const now = performance.now(), count = window.__blackGeometry.snapshot().world.frames;
      if (count !== frames) {
        intervals.push(now - previous);
        previous = now;
        frames = count;
      }
    }
    intervals.sort((a, b) => a - b);
    return { samples: intervals.length, observedFps: intervals.length * 1000 / (performance.now() - begin),
      medianMs: intervals[Math.floor(intervals.length * .5)] ?? null,
      p95Ms: intervals[Math.floor(intervals.length * .95)] ?? null,
      maximumMs: intervals.at(-1) ?? null, state: window.__blackGeometry.snapshot().world };
  }, duration);
}

/** Exercise overlapping live scenes without synchronous pixel readback. */
export async function rapidNavigationTimings(page) {
  return page.evaluate(async () => {
    const links = [...document.querySelectorAll('.site-index a')], intervals = [];
    const start = performance.now();
    let previous = start, lastSelection = start, index = 0;
    let frames = window.__blackGeometry.snapshot().world.frames, maxActive = 0, maxDrawCalls = 0;
    while (performance.now() - start < 1800) {
      await new Promise(requestAnimationFrame);
      const now = performance.now(), world = window.__blackGeometry.snapshot().world;
      if (now - start < 1300 && now - lastSelection > 50) {
        links[(++index) % links.length].click(); lastSelection = now;
      }
      if (world.frames !== frames) {
        intervals.push(now - previous); previous = now; frames = world.frames;
        maxActive = Math.max(maxActive, Object.values(world.sceneWeights).filter(weight => weight > 0).length);
        maxDrawCalls = Math.max(maxDrawCalls, world.drawCalls);
      }
    }
    intervals.sort((a,b) => a-b);
    return { samples: intervals.length, medianMs: intervals[Math.floor(intervals.length*.5)],
      p95Ms: intervals[Math.floor(intervals.length*.95)], maxActive, maxDrawCalls };
  });
}
