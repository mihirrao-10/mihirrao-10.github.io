import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { posterOutputs } from "./posters.js";
import { sculptureOutputs } from "./sculptures.js";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const OUTPUT = path.join(ROOT, "assets/black-geometry/generated");
export async function expectedOutputs() {
  const result = await build({
    absWorkingDir: ROOT,
    entryPoints: { main: "src/black-geometry/main.js" },
    outdir: OUTPUT,
    bundle: true,
    splitting: true,
    format: "esm",
    target: ["es2020"],
    minify: true,
    write: false,
    legalComments: "external",
    chunkNames: "[name]-[hash]",
    metafile: true,
  });
  const files = new Map(
    result.outputFiles.map((file) => [path.basename(file.path), file.contents]),
  );
  const sculptures = await sculptureOutputs();
  for (const [name, svg] of posterOutputs(sculptures.models)) files.set(name, Buffer.from(svg));
  files.set("sculpture-data.bin", sculptures.binary);
  files.set("sculpture-data.bin.gz", gzipSync(sculptures.binary, { level: 9 }));
  // esbuild preserves notices; include the complete third-party license as well.
  files.set(
    "THREE-LICENSE.txt",
    await fs.readFile(path.join(ROOT, "node_modules/three/LICENSE")),
  );
  return files;
}
export function outputDifferences(expected, actual) {
  const differences = [];
  for (const [name, contents] of expected)
    if (
      !actual.has(name) ||
      !Buffer.from(contents).equals(Buffer.from(actual.get(name)))
    )
      differences.push(name);
  for (const name of actual.keys())
    if (!expected.has(name)) differences.push(name);
  return differences.sort();
}
export async function buildExperience({ check = false } = {}) {
  const expected = await expectedOutputs(),
    actual = new Map();
  for (const name of await fs.readdir(OUTPUT).catch(() => []))
    actual.set(name, await fs.readFile(path.join(OUTPUT, name)));
  const differences = outputDifferences(expected, actual);
  if (check && differences.length)
    throw new Error(
      `Generated assets are stale or missing: ${differences.join(", ")}. Run npm run build:experience.`,
    );
  if (!check) {
    await fs.mkdir(OUTPUT, { recursive: true });
    for (const name of differences) {
      const target = path.join(OUTPUT, name);
      if (expected.has(name)) await fs.writeFile(target, expected.get(name));
      else await fs.unlink(target);
    }
  }
  const sizes = [...expected].map(([name, contents]) => ({
    name,
    bytes: contents.length,
    gzip: gzipSync(contents).length,
  }));
  const js = sizes.filter((file) => file.name.endsWith(".js"));
  console.log(
    `${check ? "Verified" : "Built"} ${expected.size} homepage assets (${differences.length} ${check ? "differences" : "changed"}). JS: ${js.reduce((sum, file) => sum + file.bytes, 0)} bytes, ${js.reduce((sum, file) => sum + file.gzip, 0)} gzip bytes (disk estimate).`,
  );
  return sizes;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  buildExperience({ check: process.argv.includes("--check") }).catch(
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
