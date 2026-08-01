import { pathToFileURL } from "node:url";

import { PATHS } from "./constants.js";
import { findDuplicateGroups } from "./lib/dedupe.js";
import { readJson } from "./lib/io.js";
import { calendarDate } from "./lib/normalization.js";
import {
  assertValid,
  loadValidators,
  validateJobs,
} from "./lib/schema.js";
import { validateSourceSemantics } from "./lib/source-jobs.js";

const US_CITY_STATE =
  /^[^,]+, (AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/;

function assertNoDuplicates(jobs, name) {
  const duplicateGroups = findDuplicateGroups(jobs);
  if (duplicateGroups.length > 0) {
    throw new Error(
      `${name} contains duplicate jobs: ${duplicateGroups
        .map((group) => group.join(" / "))
        .join(", ")}`,
    );
  }
}

function validateJobSemantics(job, name) {
  if (job.country !== "United States") {
    throw new Error(`${name} must be a United States role`);
  }
  if (
    job.degreeLevels.length !== 1 ||
    job.degreeLevels[0] !== "Undergraduate / Master's"
  ) {
    throw new Error(`${name} must be eligible for undergraduate or master's candidates`);
  }
  if (job.locations.some((location) => !US_CITY_STATE.test(location))) {
    throw new Error(`${name} locations must use City, ST format`);
  }
  if (job.firstSeen > job.lastVerified) {
    throw new Error(`${name} has firstSeen after lastVerified`);
  }
  if (job.status === "closed" && !job.closedDate) {
    throw new Error(`${name} is closed without closedDate`);
  }
  if (job.status !== "closed" && job.closedDate) {
    throw new Error(`${name} is not closed but has closedDate`);
  }
}

export async function validateData() {
  const [validators, sourceConfig, manualJobs, jobs, archive, metadata] =
    await Promise.all([
      loadValidators(),
      readJson(PATHS.sourceConfig),
      readJson(PATHS.manualJobs),
      readJson(PATHS.jobs),
      readJson(PATHS.archive),
      readJson(PATHS.metadata),
    ]);

  assertValid(validators.validateSources, sourceConfig, "sources.json");
  // Intl performs the IANA time-zone validation that JSON Schema cannot.
  calendarDate(new Date(0), sourceConfig.settings.timeZone);
  const sourceIds = new Set();
  for (const source of sourceConfig.sources) {
    if (sourceIds.has(source.id)) {
      throw new Error(`sources.json repeats source id ${source.id}`);
    }
    sourceIds.add(source.id);
    validateSourceSemantics(source);
  }

  validateJobs(validators.validateJob, manualJobs, "manual/jobs.json");
  validateJobs(validators.validateJob, jobs, "public jobs.json");
  validateJobs(validators.validateJob, archive, "public archive.json");
  [...manualJobs, ...jobs, ...archive].forEach((job, index) =>
    validateJobSemantics(job, `job[${index}]`),
  );

  assertNoDuplicates(manualJobs, "manual/jobs.json");
  assertNoDuplicates([...jobs, ...archive], "public job data");

  if (jobs.some((job) => job.status === "closed")) {
    throw new Error("public jobs.json must not contain closed jobs");
  }
  if (archive.some((job) => job.status !== "closed")) {
    throw new Error("public archive.json must contain only closed jobs");
  }

  assertValid(validators.validateMetadata, metadata, "metadata.json");
  if (metadata.activeCount !== jobs.length) {
    throw new Error(
      `metadata activeCount ${metadata.activeCount} does not match ${jobs.length} jobs`,
    );
  }
  if (metadata.archivedCount !== archive.length) {
    throw new Error(
      `metadata archivedCount ${metadata.archivedCount} does not match ${archive.length} archived jobs`,
    );
  }

  return {
    jobs: jobs.length,
    archive: archive.length,
    manual: manualJobs.length,
    sources: sourceConfig.sources.length,
  };
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  validateData()
    .then((counts) => {
      console.log(
        `Validated ${counts.jobs} active, ${counts.archive} archived, and ${counts.manual} manually curated jobs across ${counts.sources} ATS sources.`,
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
