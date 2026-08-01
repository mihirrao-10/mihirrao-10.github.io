import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SITE_ROOT, TRACKER_ROOT } from "./constants.js";
import { pathExists } from "./lib/io.js";
import { validateData } from "./validate-data.js";

const DIST = path.join(SITE_ROOT, "dist");
const PUBLIC_DIRECTORIES = ["assets", "notes"];
const PUBLIC_ROOT_FILES = new Set([
  ".nojekyll",
  "404.html",
  "CNAME",
  "favicon.ico",
  "index.html",
  "robots.txt",
  "site.webmanifest",
  "sitemap.xml",
]);

export async function buildSite() {
  await validateData();
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  for (const fileName of PUBLIC_ROOT_FILES) {
    const source = path.join(SITE_ROOT, fileName);
    if (await pathExists(source)) {
      await fs.copyFile(source, path.join(DIST, fileName));
    }
  }

  for (const directory of PUBLIC_DIRECTORIES) {
    const source = path.join(SITE_ROOT, directory);
    if (await pathExists(source)) {
      await fs.cp(source, path.join(DIST, directory), { recursive: true });
    }
  }

  if (await pathExists(TRACKER_ROOT)) {
    await fs.cp(
      TRACKER_ROOT,
      path.join(DIST, "new-grad-job-tracker-2027"),
      { recursive: true },
    );
  }

  if (!(await pathExists(path.join(DIST, "index.html")))) {
    throw new Error("Production build is missing the root index.html");
  }
  if (
    !(await pathExists(
      path.join(DIST, "new-grad-job-tracker-2027", "index.html"),
    ))
  ) {
    throw new Error("Production build is missing the job tracker index.html");
  }

  return DIST;
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  buildSite()
    .then((directory) => console.log(`Built static site in ${directory}`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
