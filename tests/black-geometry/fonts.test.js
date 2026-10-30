import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);

test('local STIX fonts retain their licensed original bytes and resolve from published CSS', async () => {
  const [html, css, manifest, license] = await Promise.all([
    fs.readFile(new URL('index.html', root), 'utf8'),
    fs.readFile(new URL('assets/css/black-geometry.css', root), 'utf8'),
    fs.readFile(new URL('assets/fonts/sources.json', root), 'utf8').then(JSON.parse),
    fs.readFile(new URL('assets/fonts/OFL.txt', root), 'utf8'),
  ]);
  assert.doesNotMatch(html, /(?:fonts\.googleapis|fonts\.gstatic)\.com/,
    'Rendering must not depend on an external font service');
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.equal(manifest.files.length, 12, 'Retain both styles and all six original Unicode subsets');
  const publishedCSS = new URL('assets/black-geometry/generated/stylesheet.css', root);
  for (const entry of manifest.files) {
    const reference = `../../fonts/${entry.file}`;
    assert.ok(css.includes(reference));
    const bytes = await fs.readFile(new URL(reference, publishedCSS));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.ok(entry.file.includes(entry.sha256.slice(0, 12)));
    assert.equal(bytes.toString('ascii', 0, 4), 'wOF2');
  }
  const normalLatin = manifest.files.find(entry => entry.style === 'normal' && entry.subset === 'latin');
  assert.match(html, new RegExp(`<link rel="preload" href="assets/fonts/${normalLatin.file}" as="font" type="font/woff2" crossorigin`),
    'The active font should start downloading with the document');
});
