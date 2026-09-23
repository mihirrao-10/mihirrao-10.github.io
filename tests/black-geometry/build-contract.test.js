import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  expectedOutputs,
  outputDifferences,
  fingerprintedStylesheet,
  withStylesheetReference,
  withEntryReference,
  ROOT,
  OUTPUT,
} from "../../tools/black-geometry/build.js";
test("generated assets are deterministic and every browser import resolves to a supplied local file", async () => {
  const a = await expectedOutputs(),
    b = await expectedOutputs();
  assert.deepEqual(outputDifferences(a, b), []);
  assert.ok(
    a.has("main.js") && a.has("sculpture-hero.svg") && a.has("sculpture-data.bin") && a.has("THREE-LICENSE.txt"),
  );
  const stylesheet = await fs.readFile(`${ROOT}/assets/css/black-geometry.css`);
  const stylesheetName = `black-geometry-${createHash("sha256").update(stylesheet).digest("hex").slice(0, 12)}.css`;
  assert.ok(Buffer.from(a.get(stylesheetName)).equals(stylesheet), "The published stylesheet URL must fingerprint the exact source bytes");
  const html = await fs.readFile(`${ROOT}/index.html`, "utf8");
  assert.equal(withStylesheetReference(html, stylesheetName), html,
    "The homepage must reference the current generated stylesheet; run build:experience after CSS edits");
  assert.equal(withEntryReference(html, a.get('main.js')), html,
    'Returning visitors must fetch the current entry module rather than stale chunk references');
  for (const [name, contents] of a) {
    if (!name.endsWith(".js")) continue;
    for (const match of Buffer.from(contents)
      .toString()
      .matchAll(/(?:from|import\()\s*["']\.\/([^"']+)["']/g))
      assert.ok(a.has(match[1]), match[1]);
  }
  const actual = new Map();
  for (const name of await fs.readdir(OUTPUT))
    actual.set(name, await fs.readFile(`${OUTPUT}/${name}`));
  assert.deepEqual(
    outputDifferences(a, actual),
    [],
    "Run build:experience after source edits; checks never silently regenerate runtime assets.",
  );
});

test('entry module versions change with runtime bytes and preserve the surrounding page', () => {
  const html = '<p>Keep me</p><script type="module" data-experience-entry src="assets/black-geometry/generated/main.js"></script>';
  const updated = withEntryReference(html, Buffer.from('abc'));
  assert.equal(updated, html.replace('main.js', 'main.js?v=ba7816bf8f01'));
  assert.equal(withEntryReference(updated, Buffer.from('abc')), updated);
  assert.notEqual(withEntryReference(updated, Buffer.from('changed')), updated);
});
test("verification detects a missing, stale or extra asset without overwriting it", () => {
  const expected = new Map([
    ["main.js", Buffer.from("good")],
    ["part.js", Buffer.from("chunk")],
  ]);
  const actual = new Map([
    ["main.js", Buffer.from("old")],
    ["stale.js", Buffer.from("extra")],
  ]);
  assert.deepEqual(outputDifferences(expected, actual), [
    "main.js",
    "part.js",
    "stale.js",
  ]);
  assert.equal(actual.get("main.js").toString(), "old");
});

test("gzip assets compare by payload so zlib versions cannot make them stale", () => {
  const payload = Buffer.from("sculpture ".repeat(1000));
  const fast = gzipSync(payload, { level: 1 }), best = gzipSync(payload, { level: 9 });
  assert.ok(!fast.equals(best), "The fixture must differ in compressed bytes");
  assert.deepEqual(outputDifferences(new Map([["data.bin.gz", best]]), new Map([["data.bin.gz", fast]])), []);
  const changed = gzipSync(Buffer.from("changed"));
  assert.deepEqual(outputDifferences(new Map([["data.bin.gz", best]]), new Map([["data.bin.gz", changed]])), ["data.bin.gz"]);
  assert.deepEqual(outputDifferences(new Map([["data.bin.gz", best]]), new Map([["data.bin.gz", Buffer.from("junk")]])), ["data.bin.gz"]);
});

test("stylesheet fingerprints change with exact bytes and retain the source contents", () => {
  const original = Buffer.from("abc"), stylesheet = fingerprintedStylesheet(original);
  assert.equal(stylesheet.name, "black-geometry-ba7816bf8f01.css", "Known SHA-256 prefix, not a build timestamp");
  assert.ok(stylesheet.contents.equals(original));
  assert.equal(fingerprintedStylesheet(Buffer.from(original)).name, stylesheet.name);
  const changed = fingerprintedStylesheet(Buffer.from("abc\n"));
  assert.notEqual(changed.name, stylesheet.name, "Even a byte-only CSS revision needs a new cache key");
  assert.deepEqual(outputDifferences(
    new Map([[changed.name, changed.contents]]),
    new Map([[stylesheet.name, stylesheet.contents]]),
  ), [changed.name, stylesheet.name].sort(), "The old fingerprint is removed as the new one is published");
});

test("stylesheet references update deterministically without changing surrounding HTML", () => {
  const name = fingerprintedStylesheet("a { color: white; }\n").name;
  const source = `<!doctype html>\n<link rel="stylesheet" href="https://example.com/font.css">\n<link media='all' href = 'assets/css/black-geometry.css' rel='stylesheet'>\n<script src="assets/black-geometry/generated/main.js"></script>\n<p>Retain this exact text.</p>\n`;
  const expected = source.replace("assets/css/black-geometry.css", `assets/black-geometry/generated/${name}`);
  assert.equal(withStylesheetReference(source, name), expected);
  assert.equal(withStylesheetReference(expected, name), expected, "An unchanged stylesheet leaves HTML untouched");
  const stale = expected.replace(name, "black-geometry-000000000000.css?v=old");
  assert.equal(withStylesheetReference(stale, name), expected, "A stale fingerprint is detected even when all generated files are current");
  assert.throws(() => withStylesheetReference("<p>No stylesheet</p>", name), /exactly one/);
  assert.throws(() => withStylesheetReference(`${source}<link rel="stylesheet" href="assets/css/black-geometry.css">`, name), /found 2/);
  assert.throws(() => withStylesheetReference(source, "../other.css"), /Invalid generated/);
});
