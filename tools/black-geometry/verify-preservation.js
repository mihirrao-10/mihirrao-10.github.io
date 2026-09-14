// Session acceptance check, separate from npm test: scheduled tracker updates legitimately change data.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { ROOT } from "./build.js";
const protectedFiles = JSON.parse(
  await fs.readFile(
    path.join(ROOT, "tests/black-geometry/fixtures/protected-baseline.json"),
    "utf8",
  ),
);
for (const [name, hash] of Object.entries(protectedFiles))
  assert.equal(
    createHash("sha256")
      .update(await fs.readFile(path.join(ROOT, name)))
      .digest("hex"),
    hash,
    `Protected file changed: ${name}`,
  );
assert.equal(
  execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim(),
  "7f67c3b154cbec6d6e0155dd7ccc3358bce4d70c",
  "HEAD changed during local-only implementation",
);
for (const project of [
  "shortest-path-through-a-curved-world",
  "multi-agent-reinforcement-learning-in-congestion-games",
]) {
  const baseline = await fs.readFile(
    path.join(ROOT, `.artifacts/black-geometry/baseline/${project}-status.txt`),
    "utf8",
  );
  assert.equal(
    execFileSync("git", ["status", "--porcelain=v1"], {
      cwd: path.join(ROOT, "..", project),
      encoding: "utf8",
    }),
    baseline,
    `Sibling Git state changed: ${project}`,
  );
}
// Read-only equivalent of the note publisher's path contract; never execute a generator.
const slugs = [];
for (const type of ["courses", "books"])
  for (const item of await fs.readdir(
    path.join(ROOT, "../course-notes", type),
    { withFileTypes: true },
  ))
    if (item.isDirectory()) slugs.push(item.name);
const html = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
const links = [...html.matchAll(/notes\/([a-z0-9-]+)\.pdf/g)].map(
  (match) => match[1],
);
assert.deepEqual([...new Set(links)].sort(), slugs.sort());
assert.equal(links.length, new Set(links).size);
console.log(
  `Verified ${Object.keys(protectedFiles).length} unchanged protected files, unchanged HEAD and sibling Git states, and ${links.length} unique note links matching active sources.`,
);
