import { test, expect } from '@playwright/test';
import { MAP_FILES, MAP_IMAGE_FILES } from '../../../src/black-geometry/astronomy-maps.js';

async function mapTestPage(page) {
  // Runtime modules normally live beside ../textures/ after bundling.
  await page.route('**/src/textures/*', route => route.continue({
    url: route.request().url().replace('/src/textures/', '/assets/black-geometry/textures/'),
  }));
  await page.route('**/surface-map-test', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>',
  }));
  await page.goto('/surface-map-test');
}

for (const name of Object.keys(MAP_FILES)) {
  test(`${name} lossless image preserves every surface pixel and texture setting`, async ({ page }) => {
    await mapTestPage(page);
    const result = await page.evaluate(async ({ rawFile, imageFile }) => {
      const { decodeMap, decodeMapImage } = await import('/src/black-geometry/astronomy-maps.js');
      const [rawResponse, imageResponse] = await Promise.all([
        fetch(`/assets/black-geometry/textures/${rawFile}`),
        fetch(`/assets/black-geometry/textures/${imageFile}`),
      ]);
      const original = decodeMap(new Uint8Array(await rawResponse.arrayBuffer()));
      const decoded = await decodeMapImage(await imageResponse.blob());
      const actual = decoded.userData, expected = original.userData;
      let mismatches = 0;
      for (let i = 0; i < expected.pixels.length; i++) if (actual.pixels[i] !== expected.pixels[i]) mismatches++;
      const settings = texture => [texture.magFilter, texture.minFilter, texture.generateMipmaps, texture.wrapS, texture.format];
      const result = { mismatches, dimensions: [actual.width, actual.height], originalDimensions: [expected.width, expected.height], settings: settings(decoded), originalSettings: settings(original) };
      original.dispose();decoded.dispose();return result;
    }, { rawFile: MAP_FILES[name], imageFile: MAP_IMAGE_FILES[name] });
    expect(result.mismatches).toBe(0);
    expect(result.dimensions).toEqual(result.originalDimensions);
    expect(result.settings).toEqual(result.originalSettings);
  });
}

for (const mode of ['supported', 'unavailable', 'unsupported-image']) {
  test(`surface loading retains full detail when image decoding is ${mode}`, async ({ page }) => {
    await mapTestPage(page);
    const requested = [];
    page.on('request', request => { if (request.url().includes('/textures/')) requested.push(request.url()); });
    const result = await page.evaluate(async mode => {
      if (mode === 'unavailable') window.createImageBitmap = undefined;
      if (mode === 'unsupported-image') window.createImageBitmap = async () => { throw new Error('Unsupported image decoder'); };
      const { loadAstronomyMaps } = await import('/src/black-geometry/astronomy-maps.js');
      const maps = await loadAstronomyMaps();
      const result = Object.fromEntries(Object.entries(maps).map(([name, map]) => [name, [map.userData.width, map.userData.height, map.userData.pixels.length]]));
      Object.values(maps).forEach(map => map.dispose());return result;
    }, mode);
    expect(result).toEqual({ moon: [2048, 1024, 2097152], sun: [2048, 1024, 2097152] });
    const images = requested.filter(url => url.endsWith('.webp'));
    const binary = requested.filter(url => /\.bin(?:\.gz)?$/.test(url));
    expect(images).toHaveLength(mode === 'unavailable' ? 0 : 2);
    expect(binary).toHaveLength(mode === 'supported' ? 0 : 2);
  });
}
