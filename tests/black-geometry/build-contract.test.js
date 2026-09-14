import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  expectedOutputs,
  outputDifferences,
  OUTPUT,
} from "../../tools/black-geometry/build.js";
test("generated assets are deterministic and every browser import resolves to a supplied local file", async () => {
  const a = await expectedOutputs(),
    b = await expectedOutputs();
  assert.deepEqual(outputDifferences(a, b), []);
  assert.ok(
    a.has("main.js") && a.has("sculpture-hero.svg") && a.has("sculpture-data.bin") && a.has("THREE-LICENSE.txt"),
  );
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
