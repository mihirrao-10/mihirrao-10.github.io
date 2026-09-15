import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

test('a fingerprinted stylesheet replaces a still-fresh legacy CSS cache entry', async ({ page }) => {
  const html = await fs.readFile(new URL('../../../index.html', import.meta.url), 'utf8');
  const href = html.match(/href="(assets\/black-geometry\/generated\/black-geometry-[a-f0-9]{12}\.css)"/)?.[1];
  expect(href, 'Build the homepage before testing its published stylesheet URL').toBeTruthy();
  const currentCSS = await fs.readFile(new URL('../../../assets/css/black-geometry.css', import.meta.url));
  expect(await fs.readFile(new URL(`../../../${href}`, import.meta.url))).toEqual(currentCSS);
  expect(href).toContain(createHash('sha256').update(currentCSS).digest('hex').slice(0, 12));

  const legacyPath = '/assets/css/black-geometry.css', currentPath = `/${href}`;
  let legacyCSS = Buffer.from('main > section { border-top: 7px solid white; padding-top: 96px; }');
  let legacyRequests = 0, fingerprintedRequests = 0;
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === legacyPath || pathname === currentPath) {
      if (pathname === legacyPath) legacyRequests++; else fingerprintedRequests++;
      response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      response.end(pathname === legacyPath ? legacyCSS : currentCSS);
    } else if (['/warm', '/stale', '/fingerprinted'].includes(pathname)) {
      const stylesheet = pathname === '/fingerprinted' ? currentPath : legacyPath;
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(`<!doctype html><html><head><title>Stylesheet cache regression</title><link rel="stylesheet" href="${stylesheet}"></head><body><main><section id="notes" class="reading scene-page"><h2 class="section-heading">Personal notes</h2></section></main></body></html>`);
    } else {
      response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end();
    }
  });
  const appearance = () => page.locator('#notes').evaluate(element => {
    const style = getComputedStyle(element);
    return { border: style.borderTopWidth, padding: style.paddingTop };
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    // Use real HTTP caching: Playwright routing would disable the cache.
    await page.goto(`${origin}/warm`);
    expect(await appearance()).toEqual({ border: '7px', padding: '96px' });
    expect(legacyRequests).toBe(1);

    legacyCSS = currentCSS;
    await page.goto(`${origin}/stale`);
    expect(await appearance()).toEqual({ border: '7px', padding: '96px' });
    expect(legacyRequests, 'The browser must reuse its fresh legacy CSS without contacting the updated server').toBe(1);

    const responsePromise = page.waitForResponse(response => response.url() === `${origin}${currentPath}`);
    await page.goto(`${origin}/fingerprinted`);
    const stylesheetResponse = await responsePromise;
    expect(await stylesheetResponse.body()).toEqual(currentCSS);
    expect(stylesheetResponse.headers()['cache-control']).toBe('public, max-age=3600');
    expect(await appearance()).toEqual({ border: '0px', padding: '25.5px' });
    expect(legacyRequests).toBe(1);
    expect(fingerprintedRequests, 'The new content-derived pathname must fetch the current stylesheet').toBe(1);
    await expect(page.locator('canvas, script')).toHaveCount(0);
  } finally {
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
});
