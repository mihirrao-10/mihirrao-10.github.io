import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';

const baseline = JSON.parse(await fs.readFile(new URL('../fixtures/content-baseline.json', import.meta.url), 'utf8'));
const output = '.artifacts/black-geometry/screenshots';
await fs.mkdir(output, { recursive: true });
const snapshot = page => page.evaluate(() => window.__blackGeometry.snapshot());
const identities = [
  ['hero', 'hero'], ['education-uchicago', 'phoenix'], ['education-drexel', 'dragon'],
  ['experience-mathworks', 'membrane'], ['experience-resolution', 'resolution'],
  ['project-surface', 'surface'], ['project-congestion', 'congestion'], ['notes', 'notes'], ['contact', 'notes'],
];
async function ready(page, url = '/?bg-debug') {
  await page.goto(url);
  await page.evaluate(() => document.fonts?.ready);
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready');
  await expect.poll(() => page.locator('#sculpture-poster').evaluate(el => getComputedStyle(el).opacity)).toBe('0');
}
async function settled(page, chapter) {
  await expect.poll(async () => (await snapshot(page)).state.chapter).toBe(chapter);
  const current = await snapshot(page);
  expect(current.state.blend).toBe(0);
  expect(current.state.nextTarget).toBe(current.state.target);
  if (current.motion === 'full' && current.world) {
    await expect.poll(async () => {
      const { visualState, world } = await snapshot(page);
      return { chapter: visualState.chapter, target: world.target, nextTarget: world.nextTarget, blend: world.blend };
    }).toEqual({ chapter, target: current.state.target, nextTarget: current.state.target, blend: 0 });
  }
}
async function jump(page, chapter) {
  await page.evaluate(chapter => {
    const range = window.__blackGeometry.snapshot().ranges.find(range => range.id === chapter);
    if (!range) throw new Error(`Missing measured scene ${chapter}`);
    // Instant positioning is only this helper; wheel tests exercise native snap.
    window.scrollTo({ top: range.start, behavior: 'instant' });
  }, chapter);
  await settled(page, chapter);
}
function assertActiveGeometry(state, target) {
  expect(state.world.target).toBe(target);
  expect(state.world.drawCalls).toBeGreaterThan(0);
  expect(state.world.facets).toBeGreaterThanOrEqual(65536);
  expect(state.world.triangles).toBeGreaterThanOrEqual(65536);
  expect(state.world.decodedTargets).toBeLessThanOrEqual(2);
  expect(state.world.finiteActiveBuffers).toBe(true);
  expect(state.profile).toBe('high');
  expect(state.world.quality).toBe('high');
  expect(state.world.opaque).toBe(false);
  expect(state.world.opacity).toBeCloseTo(target === 'notes' ? 0.70 : 0.88, 3);
  expect(state.world.depthPrepass).toBe(true);
  expect(state.world.shading).toBe('tessellated');
  expect(state.world.presentationScale).toBeCloseTo(0.84, 3);
  expect(state.world.activeMeshes).toBe(1);
  expect(state.world.activeDepthMeshes).toBe(1);
}
async function content(page) {
  await expect(page.locator('h1')).toHaveText(baseline.name);
  await expect(page.locator('.hero-title')).toHaveText(baseline.title);
  await expect(page.locator('main > section')).toHaveCount(4);
  for (const section of baseline.sections) {
    await expect(page.locator(`#${section.id} h2`)).toHaveText(section.heading);
    const entries = await page.locator(`#${section.id} .entry`).allTextContents();
    expect(entries.map(value => value.replace(/\s+/g, ' ').trim())).toEqual(section.entries);
    for (const link of section.links) await expect(page.locator(`#${section.id} a`).filter({ hasText: link.text }).first()).toHaveAttribute('href', link.href);
  }
  expect(await page.locator('.hero-links a').evaluateAll(links => links.map(link => ({ href: link.getAttribute('href'), label: link.getAttribute('aria-label') })))).toEqual(baseline.contacts);
}
async function scrollStopped(page) {
  let previous = NaN, stable = 0;
  await expect.poll(async () => {
    const y = await page.evaluate(() => scrollY);
    stable = Math.abs(y - previous) < 0.5 ? stable + 1 : 0;
    previous = y;
    return stable >= 2;
  }).toBe(true);
}

for (const port of [8000, 8001]) test(`root/dist ${port}: reviewed content, local assets, PDFs and hosted tracker remain available`, async ({ page, request }) => {
  const failures = [];
  page.on('response', response => { if (response.url().startsWith(`http://127.0.0.1:${port}`) && response.status() >= 400) failures.push(response.url()); });
  await ready(page, `http://127.0.0.1:${port}/?bg-debug`);
  await content(page);
  for (const file of await fs.readdir('assets/black-geometry/generated')) expect((await request.get(`http://127.0.0.1:${port}/assets/black-geometry/generated/${file}`)).ok()).toBe(true);
  for (const pdf of baseline.sections.at(-1).links) {
    const response = await request.get(`http://127.0.0.1:${port}/${pdf.href}`);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }
  await page.goto(`http://127.0.0.1:${port}/new-grad-job-tracker-2027/`);
  const jobs = await request.get(`http://127.0.0.1:${port}/new-grad-job-tracker-2027/data/jobs.json`);
  expect(jobs.ok()).toBe(true);
  const published = await jobs.json(); expect(published.length).toBeGreaterThan(0);
  await expect(page.locator('#active-role-count')).toHaveText(String(published.length));
  await page.getByLabel('Keyword', { exact: true }).fill('no-such-company-xyz');
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.locator('#reset-filters').click();
  await expect(page.locator('#empty-state')).toBeHidden();
  await page.getByRole('button', { name: 'Archived / closed' }).click();
  await expect(page.locator('#archive-view')).toHaveAttribute('aria-pressed', 'true');
  expect(failures).toEqual([]);
});

test('minimal interface stays silent and uses highest quality despite legacy preferences', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.addInitScript(() => {
    localStorage.setItem('mihir.black-geometry.display.v1', JSON.stringify({ motion: 'off', quality: 'low' }));
    window.__audioConstructions = 0;
    for (const name of ['AudioContext', 'webkitAudioContext']) {
      const Native = window[name];
      if (Native) window[name] = class extends Native { constructor(...args) { super(...args); window.__audioConstructions++; } };
    }
  });
  await ready(page);
  await expect(page.locator('.site-header, #section-index, #sound-toggle, #sound-status, #motion-setting, #quality-setting, .scroll-cue, #replay-path, #shortcut-controls, #route-status, .project-visual, .project-controls')).toHaveCount(0);
  await expect(page.locator('main button, .world button')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toMatch(/[←→↑↓↗↘↙↖]/);
  const initial = await snapshot(page);
  expect(initial.preferences).toEqual({ motion: 'on', quality: 'high' });
  expect(initial.motion).toBe('full');
  expect(initial).not.toHaveProperty('audio');
  assertActiveGeometry(initial, 'hero');
  await page.locator('.hero-name').click();
  await jump(page, 'project-congestion');
  await page.locator('.world').focus(); await page.keyboard.press('ArrowRight');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await snapshot(page)).world.quality).toBe('high');
  expect(await page.evaluate(() => window.__audioConstructions)).toBe(0);
  expect(requests.some(url => /\/audio[^/]*\.js(?:\?|$)/.test(url))).toBe(false);
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('all nine entries resolve to complete distinct sculptures forward and backward without accumulating buffers', async ({ page }, info) => {
  test.setTimeout(60000);
  await ready(page);
  const posters = [];
  page.on('request', request => { if (/sculpture-[^/]+\.svg(?:\?|$)/.test(request.url())) posters.push(request.url()); });
  const hashes = new Map(), initialGeometries = (await snapshot(page)).world.geometries;
  for (const [id, target] of [...identities, ...identities.slice(1, 8).reverse()]) {
    await jump(page, id);
    const current = await snapshot(page); assertActiveGeometry(current, target);
    expect(current.world.geometries).toBeLessThanOrEqual(initialGeometries + 4);
    if (!hashes.has(target)) {
      hashes.set(target, createHash('sha256').update(await page.locator('.world canvas').screenshot()).digest('hex'));
      if (['phoenix', 'membrane', 'surface'].includes(target)) await page.screenshot({ path: `${output}/${info.project.name}-final-${id}.png` });
    }
  }
  // Different output pixels establish distinct renderings, not mascot recognition.
  expect(new Set(hashes.values()).size).toBe(8);
  await expect(page.locator('canvas')).toHaveCount(1);
  // Native preload may start static artwork before enhancement. Once the
  // canvas is ready, traversal must not fetch further hidden fallback images.
  expect(posters).toEqual([]);
});

test('stopping at a former partial-scroll position finishes the selected sculpture automatically', async ({ page }) => {
  await ready(page);
  let observedTransitions = 0;
  for (const id of ['hero', 'education-uchicago', 'education-drexel']) {
    await jump(page, id);
    const samples = await page.evaluate(async id => {
      const ranges = window.__blackGeometry.snapshot().ranges, index = ranges.findIndex(range => range.id === id);
      const at = ranges[index].start + (ranges[index + 1].start - ranges[index].start) * 0.79;
      const samples = [], begin = performance.now();
      window.scrollTo({ top: at, behavior: 'instant' });
      await new Promise(resolve => {
        function collect() {
          const { state, world, transition } = window.__blackGeometry.snapshot();
          samples.push({ at: performance.now() - begin, chapter: state.chapter, target: state.target, next: state.nextTarget, desiredBlend: state.blend, worldTarget: world.target, worldNext: world.nextTarget, blend: world.blend, decoded: world.decodedTargets, opaque: world.opaque, opacity: world.opacity, depthPrepass: world.depthPrepass, activeDepthMeshes: world.activeDepthMeshes, activeMeshes: world.activeMeshes, transition });
          if (performance.now() - begin < 1500) requestAnimationFrame(collect); else resolve();
        }
        requestAnimationFrame(collect);
      });
      return samples;
    }, id);
    expect(samples.length).toBeGreaterThan(3);
    expect(samples.every(sample => sample.target === sample.next && sample.desiredBlend === 0 && sample.decoded <= 2)).toBe(true);
    const moving = samples.filter(sample => sample.blend > 0 && sample.blend < 1);
    observedTransitions += moving.length;
    expect(moving.every(sample => !sample.opaque && sample.opacity === (sample.worldTarget === 'notes' ? .70 : .88) && sample.depthPrepass && sample.activeMeshes === 2 && sample.activeDepthMeshes === 2)).toBe(true);
    const final = samples.at(-1);
    expect(final.blend).toBe(0);
    expect(final.worldTarget).toBe(final.target);
    expect(final.worldNext).toBe(final.target);
    // A former fractional position may now belong to the valid reading interval
    // of an oversized area. It must still show a complete sculpture; changed
    // identities must finish their timed transition while the page stands still.
    if (moving.length) expect(samples.some(sample => sample.at > moving[0].at && sample.at < moving[0].at + 1000 && sample.blend === 0 && sample.worldTarget === final.target)).toBe(true);
  }
  expect(observedTransitions).toBeGreaterThan(0);
});

test('mouse dragging follows screen directions after prior rotations, with a paused camera and live rendering', async ({ page }) => {
  await ready(page); await jump(page, 'education-uchicago');
  const stage = page.locator('.world'), rect = await stage.boundingBox();
  await expect(stage).toHaveAttribute('tabindex', '0');
  let x = rect.x + rect.width * 0.5, y = rect.y + rect.height * 0.5;
  await page.mouse.move(x, y); await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).world.dragging).toBe(true);
  expect(await stage.evaluate(element => element.hasPointerCapture(window.__blackGeometry.snapshot().interaction.pointerId))).toBe(true);
  // Establish an arbitrary orientation before measuring the visible front point.
  for (const [dx, dy] of [[160, 140], [-210, 80], [70, -190]]) { x += dx; y += dy; await page.mouse.move(x, y, { steps: 5 }); }
  const prepared = (await snapshot(page)).interaction.orientation;
  await expect.poll(async () => (await snapshot(page)).world.userOrientation).toEqual(prepared);
  for (const [dx, dy] of [[20, 0], [0, 20], [20, 20], [-20, 0], [0, -20], [-20, -20]]) {
    const before = await snapshot(page), orientationBefore = new THREE.Quaternion(...before.world.orientation);
    const cameraBefore = new THREE.Quaternion(...before.world.cameraOrientation);
    const point = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraBefore).applyQuaternion(orientationBefore.clone().invert());
    const project = state => {
      const camera = new THREE.PerspectiveCamera(35, state.world.width / state.world.height, 0.1, 100);
      camera.position.fromArray(state.world.camera); camera.quaternion.fromArray(state.world.cameraOrientation); camera.updateMatrixWorld(true);
      const position = point.clone().multiplyScalar(state.world.fitScales[0]).applyQuaternion(new THREE.Quaternion(...state.world.orientation)).project(camera);
      return [position.x * state.world.width / 2, -position.y * state.world.height / 2];
    };
    const start = project(before); x += dx; y += dy;
    await page.mouse.move(x, y);
    const desired = (await snapshot(page)).interaction.orientation;
    await expect.poll(async () => (await snapshot(page)).world.userOrientation).toEqual(desired);
    const after = await snapshot(page), end = project(after), sx = end[0] - start[0], sy = end[1] - start[1];
    if (dx) expect(sx * dx).toBeGreaterThan(0); else expect(Math.abs(sx)).toBeLessThan(0.1);
    if (dy) expect(sy * dy).toBeGreaterThan(0); else expect(Math.abs(sy)).toBeLessThan(0.1);
    if (dx && dy) expect(sy / sx).toBeCloseTo(dy / dx, 2);
    expect(after.orbitTime).toBe(before.orbitTime);
    expect(after.world.cameraOrientation).toEqual(before.world.cameraOrientation);
  }
  const held = await snapshot(page); await page.waitForTimeout(80);
  expect((await snapshot(page)).time).toBeGreaterThan(held.time);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).interaction.dragging).toBe(false);
  await expect.poll(async () => (await snapshot(page)).orbitTime).toBeGreaterThan(held.orbitTime);
});

test('MathWorks and Resolution start at their authored view on later visits without inherited drag', async ({ page }) => {
  test.setTimeout(45000);
  await ready(page);
  await page.locator('.world').focus(); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1400);
  for (const id of ['experience-mathworks', 'experience-resolution', 'experience-mathworks']) {
    await jump(page, id);
    const state = await snapshot(page);
    expect(state.interaction.orientation).toEqual([0, 0, 0, 1]);
    const effective = new THREE.Quaternion(...state.world.cameraOrientation).invert().multiply(new THREE.Quaternion(...state.world.orientation));
    expect(effective.angleTo(new THREE.Quaternion())).toBeLessThan(.07);
    expect(state.world.orbitAges[0]).toBeLessThan(1.6);
    await page.locator('.world').focus(); await page.keyboard.press('ArrowRight');
    expect((await snapshot(page)).interaction.orientation).not.toEqual([0, 0, 0, 1]);
  }
});

test('a rapid sculpture reversal preserves the visible visit while a completed departure resets the next visit', async ({ page }) => {
  test.setTimeout(45000);
  await ready(page); await jump(page, 'experience-mathworks');
  await page.locator('.world').focus(); await page.keyboard.press('ArrowRight');
  const orientation = (await snapshot(page)).interaction.orientation;
  await expect.poll(async () => (await snapshot(page)).world.userOrientation).toEqual(orientation);
  await expect.poll(async () => (await snapshot(page)).world.orbitAges[0]).toBeGreaterThan(0.9);
  const before = await snapshot(page);
  const reversal = await page.evaluate(async () => {
    const initial = window.__blackGeometry.snapshot();
    const move = id => window.scrollTo({ top: initial.ranges.find(range => range.id === id).start, behavior: 'instant' });
    const begin = performance.now(); let reversed = false, sawPair = false, allDepthPassesAligned = true;
    move('experience-resolution');
    return new Promise((resolve, reject) => {
      function observe() {
        const state = window.__blackGeometry.snapshot();
        allDepthPassesAligned &&= state.world.depthPrepass;
        if (!reversed && state.world.target === 'membrane' && state.world.nextTarget === 'resolution' && state.world.blend > 0 && state.world.blend < 0.5) {
          sawPair = state.world.activeMeshes === 2 && state.world.activeDepthMeshes === 2;
          reversed = true; move('experience-mathworks');
        } else if (reversed && state.state.chapter === 'experience-mathworks' && state.world.target === 'membrane' && state.world.nextTarget === 'membrane' && state.world.blend === 0) {
          resolve({ state, sawPair, allDepthPassesAligned }); return;
        }
        if (performance.now() - begin > 4000) { reject(new Error('The partial transition did not reverse and settle')); return; }
        requestAnimationFrame(observe);
      }
      requestAnimationFrame(observe);
    });
  });
  expect(reversal.sawPair).toBe(true);
  expect(reversal.allDepthPassesAligned).toBe(true);
  expect(reversal.state.interaction.orientation).toEqual(before.interaction.orientation);
  expect(reversal.state.world.orbitAges[0]).toBeGreaterThanOrEqual(before.world.orbitAges[0]);
  expect(reversal.state.world.decodedTargets).toBeLessThanOrEqual(2);
  await jump(page, 'experience-resolution'); await jump(page, 'experience-mathworks');
  const fresh = await snapshot(page);
  expect(fresh.interaction.orientation).toEqual([0, 0, 0, 1]);
  expect(fresh.world.orbitAges[0]).toBeLessThan(1.6);
  expect(fresh.world.depthPrepass).toBe(true);
  expect(fresh.world.decodedTargets).toBeLessThanOrEqual(2);
});

test('education entries are separate reading screens with native downward navigation', async ({ page }) => {
  test.setTimeout(45000);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await ready(page);
    await jump(page, 'education-uchicago'); await scrollStopped(page);
    const drexel = await page.locator('#education-drexel .entry-title').boundingBox();
    expect(drexel.y).toBeGreaterThanOrEqual(900);
    const next = page.locator('#education-uchicago .scene-next');
    await next.click(); await scrollStopped(page); await settled(page, 'education-drexel');
    expect(await page.evaluate(() => location.hash)).toBe('#education-drexel');
  }
});

test('lightly translucent tessellated surfaces retain their shape while the color gradient continues under a held pointer', async ({ page }) => {
  await ready(page); await jump(page, 'project-surface');
  const stage = page.locator('.world'), rect = await stage.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).world.dragging).toBe(true);
  const before = await snapshot(page), first = await page.locator('.world canvas').screenshot();
  await expect.poll(async () => (await snapshot(page)).world.gradientTime).toBeGreaterThan(before.world.gradientTime + 0.2);
  const second = await page.locator('.world canvas').screenshot(), after = await snapshot(page);
  assertActiveGeometry(after, 'surface');
  expect(after.world.orientation).toEqual(before.world.orientation);
  expect(after.world.cameraOrientation).toEqual(before.world.cameraOrientation);
  expect(createHash('sha256').update(second).digest('hex')).not.toBe(createHash('sha256').update(first).digest('hex'));
  await page.mouse.up();
});

test('keyboard rotation and Home work without stealing page keys; hidden documents release a held pointer', async ({ page }) => {
  await ready(page); const stage = page.locator('.world'); await stage.focus();
  const y = await page.evaluate(() => scrollY);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).world.rotation).toEqual([-0.12, 0.12]);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await page.keyboard.press('Home');
  await expect.poll(async () => (await snapshot(page)).interaction.orientation).toEqual([0, 0, 0, 1]);
  await page.locator('.hero-links a').first().focus();
  await page.evaluate(() => document.addEventListener('keydown', event => { window.__outsideArrowPrevented = event.defaultPrevented; }, { once: true }));
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => window.__outsideArrowPrevented)).toBe(false);
  await page.keyboard.press('PageDown'); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y);
  await jump(page, 'hero'); const rect = await stage.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).interaction.dragging).toBe(true);
  const pointerId = (await snapshot(page)).interaction.pointerId;
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hidden = await snapshot(page);
  expect(hidden.interaction).toMatchObject({ enabled: false, dragging: false, pointerId: null, velocity: [0, 0] });
  expect(hidden.pendingFrame).toBe(false);
  expect(await stage.evaluate((element, id) => element.hasPointerCapture(id), pointerId)).toBe(false);
  await expect(stage).not.toHaveAttribute('tabindex'); await page.mouse.up();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(stage).toHaveAttribute('data-interactive', 'true');
});

test('native wheel snapping permits reading complete education, industry and notes entries', async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 390, height: 844 }); await ready(page);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toBe('y mandatory');
  await page.mouse.move(25, 720); await page.mouse.wheel(0, 640); await scrollStopped(page);
  const snapped = await page.evaluate(() => ({ y: scrollY, ranges: window.__blackGeometry.snapshot().ranges }));
  expect(snapped.y).toBeGreaterThan(100);
  expect(snapped.ranges.some(range => snapped.y >= range.start - 3 && snapped.y <= range.stop + 3)).toBe(true);
  for (const [id, lastSelector] of [
    ['education-drexel', '.awards-list li:last-child'],
    ['experience-mathworks', '.experience-points > li:last-child'],
    ['experience-resolution', '.experience-points > li:last-child'],
    ['notes', '.notes-list:last-child li:last-child'],
  ]) {
    await jump(page, id);
    const range = (await snapshot(page)).ranges.find(range => range.id === id);
    expect(range.stop - range.start).toBeGreaterThan(100);
    const amount = Math.min(150, (range.stop - range.start) / 3);
    await page.mouse.wheel(0, amount); await scrollStopped(page);
    const y = await page.evaluate(() => scrollY);
    expect(y).toBeGreaterThan(range.start + 20);
    expect(y).toBeLessThanOrEqual(range.stop + 3);
    expect((await snapshot(page)).state.chapter).toBe(id);
    // Read farther using the native gesture. Playwright's center-aligned
    // scrollIntoView request can land beyond this area's valid snap interval.
    await page.mouse.wheel(0, Math.max(0, range.stop - y - 8)); await scrollStopped(page);
    const last = page.locator(`#${id} ${lastSelector}`);
    await expect(last).toBeInViewport();
    const lastBox = await last.boundingBox(), artwork = await page.locator('.world').boundingBox();
    expect(lastBox.y).toBeGreaterThanOrEqual(artwork.y + artwork.height);
    // The footer and final notes share one sculpture; bringing the final notes
    // link into view may also select that adjacent footer snap area.
    expect((await snapshot(page)).state.target).toBe(identities.find(([entry]) => entry === id)[1]);
  }
  await page.mouse.wheel(0, 2000); await scrollStopped(page);
  await expect(page.locator('#notes .notes-list:last-child li:last-child')).toBeInViewport();
  const back = page.locator('.back-to-top'); await expect(back).toBeInViewport();
  await back.click(); await settled(page, 'hero');
});

test('native touch swipes preserve vertical page scrolling and horizontal model rotation', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Native touch injection uses Chromium protocol; gesture arbitration also has engine-independent unit coverage.');
  await page.setViewportSize({ width: 390, height: 844 });
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); await ready(page);
  expect(await page.locator('.world').evaluate(element => getComputedStyle(element).touchAction)).toBe('pan-y pinch-zoom');
  const touch = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', 190, 310);
  for (let y = 285; y >= 135; y -= 25) { await touch('touchMove', 191, y); await page.waitForTimeout(20); }
  await touch('touchEnd'); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(50);
  expect((await snapshot(page)).interaction.orientation).toEqual([0, 0, 0, 1]);
  await scrollStopped(page); await jump(page, 'hero');
  const before = await page.evaluate(() => scrollY);
  await touch('touchStart', 90, 210);
  for (let x = 120; x <= 270; x += 30) { await touch('touchMove', x, 212); await page.waitForTimeout(20); }
  await expect.poll(async () => (await snapshot(page)).world.rotation[1]).toBeGreaterThan(1);
  expect((await snapshot(page)).interaction.dragging).toBe(true);
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThanOrEqual(3);
  await touch('touchEnd'); await expect.poll(async () => (await snapshot(page)).interaction.dragging).toBe(false); await client.detach();
});

test('teaching and industry remain complete, section links use matching colors, and projects open separate tabs', async ({ page, context }) => {
  await ready(page);
  await expect(page.locator('.teaching-role, .teaching-dates, #research, #teaching')).toHaveCount(0);
  await expect(page.locator('#education-uchicago .course-list li')).toHaveCount(3);
  await expect(page.locator('#education-drexel .course-list li')).toHaveCount(4);
  await expect(page.locator('.course-code')).toHaveCount(7);
  await expect(page.locator('#experience-mathworks .experience-points > li')).toHaveCount(4);
  await expect(page.locator('#experience-resolution .experience-points > li')).toHaveCount(4);
  await expect(page.locator('#education-drexel .awards-list li')).toHaveText(['A* Award', 'Jeffrey L. Popyack Teaching Assistant Award', 'Student Teaching Excellence Award']);
  const colors = await page.locator('#notes .notes-list a').evaluateAll(links => links.map(link => getComputedStyle(link).color));
  expect(colors.every(color => color === 'rgb(216, 237, 243)')).toBe(true);
  expect(await page.locator('.hero-link').evaluateAll(links => links.every(link => getComputedStyle(link).color === 'rgb(250, 250, 250)'))).toBe(true);
  expect(await page.locator('.back-to-top, .open-project').evaluateAll(links => links.every(link => getComputedStyle(link).borderRadius === '0px'))).toBe(true);
  await expect(page.locator('#contact .back-to-top')).toHaveAttribute('href', '#top');
  for (const [id, link] of [['project-surface', baseline.sections[2].links[0]], ['project-congestion', baseline.sections[2].links[1]]]) {
    await jump(page, id); const open = page.locator(`#${id} .open-project`);
    await expect(open).toHaveText('Open project'); await expect(open).toHaveAttribute('href', link.href);
    await expect(open).toHaveAttribute('target', '_blank'); await expect(open).toHaveAttribute('rel', /noopener/);
    // Fulfill the destination only; the real anchor must still create a popup.
    await context.route(link.href, route => route.fulfill({ contentType: 'text/html', body: '<title>Project destination</title><p>Project destination</p>' }));
    const popupPromise = page.waitForEvent('popup'); await open.click(); const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded'); expect(popup.url()).toBe(link.href);
    expect(await popup.evaluate(() => window.opener)).toBe(null); await popup.close();
  }
});

for (const width of [1440, 390]) test(`institutional hashes, resize and reload retain the chosen entry at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  for (const [id, target] of identities.slice(1, 4)) {
    await ready(page, `/?bg-debug#${id}`); await settled(page, id); assertActiveGeometry(await snapshot(page), target);
  }
  await page.setViewportSize({ width: width === 390 ? 430 : 1280, height: 820 });
  await jump(page, 'experience-mathworks'); await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready');
  await settled(page, 'experience-mathworks'); assertActiveGeometry(await snapshot(page), 'membrane');
});

test('OS reduced motion skips heavy imports, renders fallback identities, and stops an existing renderer when changed', async ({ page }) => {
  const requests = []; page.on('request', request => requests.push(request.url()));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/?bg-debug');
  await expect.poll(async () => (await snapshot(page)).motion).toBe('reduced');
  await expect(page.locator('.world')).not.toHaveAttribute('tabindex'); await expect(page.locator('canvas')).toHaveCount(0);
  expect(requests.some(url => /world-.*\.js/.test(url))).toBe(false);
  for (const [id, target] of identities.slice(1, 4)) {
    await jump(page, id); await expect(page.locator('#sculpture-poster')).toHaveAttribute('src', new RegExp(`sculpture-${target}\\.svg$`));
    await expect.poll(() => page.locator('#sculpture-poster').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await expect.poll(async () => (await snapshot(page)).motion).toBe('reduced');
  const before = await snapshot(page); await page.mouse.wheel(0, 500); await page.waitForTimeout(200);
  const after = await snapshot(page); expect(after.world.frames).toBe(before.world.frames); expect(after.pendingFrame).toBe(false);
  expect(after.interaction.enabled).toBe(false); await expect(page.locator('.world')).not.toHaveAttribute('tabindex');
});

for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [740, 390], [1440, 900], [1920, 1080]]) test(`responsive ${width}x${height}: content and high-quality artwork fit without horizontal overflow`, async ({ page }, info) => {
  test.setTimeout(45000); await page.setViewportSize({ width, height }); await ready(page);
  for (const id of ['hero', 'education-drexel', 'project-surface', 'notes']) {
    await jump(page, id);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    assertActiveGeometry(await snapshot(page), identities.find(([entry]) => entry === id)[1]);
    const stage = await page.locator('.world').boundingBox(), stacked = width < 800 && !(width >= 600 && height <= 500);
    expect(stage.width).toBeGreaterThan(stacked ? width * 0.9 : width * 0.4);
    expect(stage.height).toBeGreaterThan(stacked ? 150 : height * 0.75);
  }
  if ([390, 1440].includes(width)) await page.screenshot({ path: `${output}/${info.project.name}-${width}-notes.png` });
});

for (const mode of ['module', 'asset', 'renderer', 'shader', 'context']) test(`${mode} graphics failure keeps the complete portfolio and static artwork`, async ({ page }) => {
  if (mode === 'module') await page.route('**/world-*.js', route => route.abort());
  if (mode === 'asset') await page.route('**/sculpture-data.bin*', route => route.abort());
  if (mode === 'renderer') await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return String(type).includes('webgl') ? null : original.call(this, type, ...args); };
  });
  if (mode === 'shader') await page.addInitScript(() => { WebGL2RenderingContext.prototype.compileShader = function() {}; });
  if (mode === 'context') {
    await ready(page); await page.evaluate(() => document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  } else await page.goto('/?bg-debug');
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'fallback'); await content(page);
  await expect(page.locator('#sculpture-poster')).toBeVisible(); await expect(page.locator('.world')).not.toHaveAttribute('tabindex');
  expect((await snapshot(page)).interaction.enabled).toBe(false); expect((await snapshot(page)).pendingFrame).toBe(false);
  await jump(page, 'project-congestion'); await expect(page.locator('#sculpture-poster')).toHaveAttribute('src', /sculpture-congestion\.svg$/);
  expect(await page.locator('[data-scene]').evaluateAll(entries => entries.every(entry => getComputedStyle(entry).opacity === '1'))).toBe(true);
  await expect(page.locator('#project-congestion .open-project')).toHaveAttribute('target', '_blank');
});

for (const [width, height] of [[1440, 900], [390, 844]]) test(`skip link, native hashes/back, tracker restoration and page scrolling remain functional at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height });
  await ready(page); await page.keyboard.press(info.project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused(); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => location.hash)).toBe('#main');
  await scrollStopped(page);
  // Entering the viewport is not scroll completion. Let deliberate smooth
  // anchors finish before recording another history entry or navigating back.
  await page.goto('/?bg-debug#notes'); await scrollStopped(page); await expect(page.locator('#notes h2')).toBeInViewport();
  await page.goto('/?bg-debug#personal-projects'); await scrollStopped(page); await expect(page.locator('#personal-projects h2')).toBeInViewport();
  await page.goBack(); await scrollStopped(page); await expect(page.locator('#notes h2')).toBeInViewport();
  await jump(page, 'education-drexel'); await scrollStopped(page); const before = await page.evaluate(() => scrollY), beforeURL = page.url();
  await page.goto('/new-grad-job-tracker-2027/'); await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-experience-state', 'ready'); await settled(page, 'education-drexel');
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(5);
  expect(page.url()).toBe(beforeURL);
  expect(await page.evaluate(() => history.state?.portfolioReading)).toEqual({ href: beforeURL, y: before });
});

test('without JavaScript all content, static sculptures, projects and PDFs stay native', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } }), page = await context.newPage();
  await page.goto('http://127.0.0.1:8000/'); await content(page);
  for (const [id, target] of identities.slice(1, 4)) {
    const art = page.locator(`#${id} .scene-fallback`); await art.scrollIntoViewIfNeeded(); await expect(art).toBeVisible();
    await expect(art).toHaveAttribute('src', new RegExp(`sculpture-${target}\\.svg$`));
    await expect.poll(() => art.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await page.goto('http://127.0.0.1:8000/#notes'); await expect(page.locator('#notes h2')).toBeInViewport();
  await expect(page.locator('#notes a')).toHaveCount(11);
  await expect(page.locator('.open-project')).toHaveCount(2);
  await expect(page.locator('.open-project').first()).toHaveAttribute('target', '_blank'); await context.close();
});

test('denied storage and missing font/icon resources preserve readable native links', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } }));
  await page.route(/https:\/\/(fonts\.|cdnjs\.)/, route => route.abort()); await ready(page); await content(page);
  await expect(page.locator('.hero-links')).toContainText('GitHub'); expect((await snapshot(page)).profile).toBe('high');
});

test('200 percent zoom and print preserve readable content', async ({ page }) => {
  await ready(page); await page.evaluate(() => { document.documentElement.style.zoom = '2'; }); await page.waitForTimeout(150);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.zoom = ''; }); await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.world')).toBeHidden();
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  await expect(page.locator('#notes a')).toHaveCount(11);
});
