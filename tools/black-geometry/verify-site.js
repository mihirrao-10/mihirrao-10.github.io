import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { ROOT } from "./build.js";
async function walk(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(target)));
    else result.push(target);
  }
  return result;
}
const publicFiles = [path.join(ROOT, "index.html")];
for (const name of ["assets", "notes", "new-grad-job-tracker-2027"])
  publicFiles.push(...(await walk(path.join(ROOT, name))));
for (const file of publicFiles) {
  const relative = path.relative(ROOT, file),
    copy = path.join(ROOT, "dist", relative);
  assert.ok(
    (await fs.readFile(file)).equals(await fs.readFile(copy)),
    `Root/dist differ: ${relative}`,
  );
}
const html = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
  .map((match) => match[1])
  .filter((value) => !value.includes(":"));
for (const reference of refs)
  await fs.access(path.join(ROOT, "dist", reference));
for (const privatePath of [
  "src",
  "docs",
  "tests",
  "tools",
  "node_modules",
  ".artifacts",
  ".github",
])
  await assert.rejects(fs.access(path.join(ROOT, "dist", privatePath)));
console.log(
  `Verified byte-for-byte root/dist parity for ${publicFiles.length} public files and all ${refs.length} local HTML references. No source/test/private directories in dist.`,
);
