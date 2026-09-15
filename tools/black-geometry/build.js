import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { posterOutputs } from "./posters.js";
import { sculptureOutputs } from "./sculptures.js";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const OUTPUT = path.join(ROOT, "assets/black-geometry/generated");
const STYLESHEET_NAME = /^black-geometry-[a-f0-9]{12}\.css$/;
const STYLESHEET_REFERENCE = /^assets\/(?:css\/black-geometry\.css|black-geometry\/generated\/black-geometry-[a-f0-9]+\.css)(?:[?#].*)?$/;

export function fingerprintedStylesheet(source) {
  const contents = Buffer.from(source);
  const hash = createHash("sha256").update(contents).digest("hex").slice(0, 12);
  return { name: `black-geometry-${hash}.css`, contents };
}

/** Replace only the portfolio stylesheet URL, preserving the authored HTML. */
export function withStylesheetReference(html, name) {
  if (!STYLESHEET_NAME.test(name)) throw new Error(`Invalid generated stylesheet name: ${name}`);
  let references = 0;
  const updated = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel\s*=\s*(["'])stylesheet\1/i.test(tag)) return tag;
    return tag.replace(/\bhref\s*=\s*(["'])(.*?)\1/i, (attribute, quote, reference) => {
      if (!STYLESHEET_REFERENCE.test(reference)) return attribute;
      references++;
      const prefix = attribute.slice(0, attribute.indexOf(quote) + 1);
      return `${prefix}assets/black-geometry/generated/${name}${quote}`;
    });
  });
  if (references !== 1)
    throw new Error(`Expected exactly one portfolio stylesheet link; found ${references}.`);
  return updated;
}

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
  const stylesheet = fingerprintedStylesheet(
    await fs.readFile(path.join(ROOT, "assets/css/black-geometry.css")),
  );
  files.set(stylesheet.name, stylesheet.contents);
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
  const indexPath = path.join(ROOT, "index.html");
  const html = await fs.readFile(indexPath, "utf8");
  const stylesheetName = [...expected.keys()].find(name => STYLESHEET_NAME.test(name));
  const updatedHTML = withStylesheetReference(html, stylesheetName);
  const stylesheetChanged = updatedHTML !== html;
  const stale = [...differences, ...(stylesheetChanged ? ["index.html stylesheet reference"] : [])];
  if (check && stale.length)
    throw new Error(
      `Generated assets or stylesheet reference are stale or missing: ${stale.join(", ")}. Run npm run build:experience.`,
    );
  if (!check) {
    await fs.mkdir(OUTPUT, { recursive: true });
    for (const name of differences) {
      const target = path.join(OUTPUT, name);
      if (expected.has(name)) await fs.writeFile(target, expected.get(name));
      else await fs.unlink(target);
    }
    if (stylesheetChanged) await fs.writeFile(indexPath, updatedHTML);
  }
  const sizes = [...expected].map(([name, contents]) => ({
    name,
    bytes: contents.length,
    gzip: gzipSync(contents).length,
  }));
  const js = sizes.filter((file) => file.name.endsWith(".js"));
  console.log(
    `${check ? "Verified" : "Built"} ${expected.size} homepage assets (${differences.length} ${check ? "differences" : "changed"}${stylesheetChanged ? ", updated stylesheet reference" : ""}). JS: ${js.reduce((sum, file) => sum + file.bytes, 0)} bytes, ${js.reduce((sum, file) => sum + file.gzip, 0)} gzip bytes (disk estimate).`,
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
