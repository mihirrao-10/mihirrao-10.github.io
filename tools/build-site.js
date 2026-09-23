// Copy the public site into dist/ so it can be served and verified exactly as
// GitHub Pages serves the repository root.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const PUBLIC_DIRECTORIES = ["assets", "notes"];
const PUBLIC_ROOT_FILES = [
  ".nojekyll",
  "404.html",
  "CNAME",
  "favicon.ico",
  "index.html",
  "robots.txt",
  "site.webmanifest",
  "sitemap.xml",
];

const exists = (target) =>
  fs.access(target).then(() => true, () => false);

await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(DIST, { recursive: true });
for (const name of PUBLIC_ROOT_FILES)
  if (await exists(path.join(ROOT, name)))
    await fs.copyFile(path.join(ROOT, name), path.join(DIST, name));
for (const name of PUBLIC_DIRECTORIES)
  if (await exists(path.join(ROOT, name)))
    await fs.cp(path.join(ROOT, name), path.join(DIST, name), { recursive: true });
if (!(await exists(path.join(DIST, "index.html"))))
  throw new Error("Production build is missing the root index.html");
console.log(`Built static site in ${DIST}`);
