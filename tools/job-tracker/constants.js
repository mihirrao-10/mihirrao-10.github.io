import path from "node:path";
import { fileURLToPath } from "node:url";

export const SITE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const SOURCE_DATA_DIR = path.join(SITE_ROOT, "data", "job-tracker");
export const PUBLIC_DATA_DIR = path.join(
  SITE_ROOT,
  "new-grad-job-tracker-2027",
  "data",
);

export const PATHS = Object.freeze({
  archive: path.join(PUBLIC_DATA_DIR, "archive.json"),
  jobSchema: path.join(SOURCE_DATA_DIR, "schema", "job.schema.json"),
  jobs: path.join(PUBLIC_DATA_DIR, "jobs.json"),
  manualJobs: path.join(SOURCE_DATA_DIR, "manual", "jobs.json"),
  metadata: path.join(PUBLIC_DATA_DIR, "metadata.json"),
  metadataSchema: path.join(
    SOURCE_DATA_DIR,
    "schema",
    "metadata.schema.json",
  ),
  sourceConfig: path.join(SOURCE_DATA_DIR, "sources.json"),
  sourceSchema: path.join(SOURCE_DATA_DIR, "schema", "source.schema.json"),
});

export const SCHEMA_VERSION = "1.0.0";

export const CATEGORIES = Object.freeze([
  "Software Engineering",
  "Machine Learning / AI Engineering",
  "Data Science / Applied Science / Analytics",
  "Quantitative Research",
  "Quantitative Trading",
  "Quantitative Development",
  "Systems / Infrastructure / Performance Engineering",
  "Other Technical",
]);

export const EVIDENCE_LEVELS = Object.freeze([
  "Strong",
  "Supported",
  "Historical",
]);

export const USER_AGENT =
  "MihirRao-NewGradJobTracker/1.0 (+https://mihirrao-10.github.io/new-grad-job-tracker-2027/)";
