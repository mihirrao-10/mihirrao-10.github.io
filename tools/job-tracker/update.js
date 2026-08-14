import { pathToFileURL } from "node:url";

import { collectSource } from "./collectors/index.js";
import { PATHS, SCHEMA_VERSION } from "./constants.js";
import { mapWithConcurrency } from "./lib/fetch.js";
import { readJson, writeJsonIfChanged } from "./lib/io.js";
import { collectManualJobs } from "./lib/manual.js";
import { calendarDate } from "./lib/normalization.js";
import { reconcileJobs } from "./lib/reconcile.js";
import { assertValid, loadValidators, validateJobs } from "./lib/schema.js";
import {
  normalizeCollectedSource,
  validateSourceSemantics,
} from "./lib/source-jobs.js";

const PLATFORM_LABELS = Object.freeze({
  ashby: "Ashby",
  greenhouse: "Greenhouse",
  lever: "Lever",
  tiktok: "TikTok Careers",
});

function parseArguments(arguments_) {
  const options = { offline: false, now: new Date() };
  for (const argument of arguments_) {
    if (argument === "--offline") {
      options.offline = true;
    } else if (argument.startsWith("--now=")) {
      options.now = new Date(argument.slice("--now=".length));
      if (Number.isNaN(options.now.valueOf())) {
        throw new Error(`Invalid --now value: ${argument}`);
      }
    } else {
      throw new Error(`Unknown update option: ${argument}`);
    }
  }
  return options;
}

function cleanMessage(error) {
  return error.message.replace(/\s+/g, " ").slice(0, 300);
}

async function collectConfiguredSources(sourceConfig, options) {
  const requestOptions = {
    retries: sourceConfig.settings.requestRetries,
    timeoutMs: sourceConfig.settings.requestTimeoutMs,
  };
  const today = calendarDate(options.now, sourceConfig.settings.timeZone);

  return mapWithConcurrency(
    sourceConfig.sources,
    sourceConfig.settings.sourceConcurrency,
    async (source) => {
      if (!source.enabled || options.offline) {
        return {
          observations: [],
          result: {
            sourceId: source.id,
            platform: PLATFORM_LABELS[source.platform],
            status: "skipped",
            jobsFound: 0,
            message: options.offline ? "Offline update" : "Source disabled",
          },
        };
      }

      try {
        const candidates = await collectSource(source, requestOptions);
        const observations = normalizeCollectedSource(source, candidates, today);
        return {
          observations,
          result: {
            sourceId: source.id,
            platform: PLATFORM_LABELS[source.platform],
            status: "success",
            jobsFound: observations.length,
          },
        };
      } catch (error) {
        return {
          observations: [],
          result: {
            sourceId: source.id,
            platform: PLATFORM_LABELS[source.platform],
            status: "failed",
            jobsFound: 0,
            message: cleanMessage(error),
          },
        };
      }
    },
  );
}

export async function updateJobs(options = parseArguments(process.argv.slice(2))) {
  const [
    validators,
    sourceConfig,
    manualJobs,
    previousActive,
    previousArchive,
    previousMetadata,
  ] = await Promise.all([
    loadValidators(),
    readJson(PATHS.sourceConfig),
    readJson(PATHS.manualJobs),
    readJson(PATHS.jobs, []),
    readJson(PATHS.archive, []),
    readJson(PATHS.metadata, null),
  ]);

  assertValid(validators.validateSources, sourceConfig, "sources.json");
  sourceConfig.sources.forEach(validateSourceSemantics);
  validateJobs(validators.validateJob, manualJobs, "manual/jobs.json");
  validateJobs(validators.validateJob, previousActive, "existing jobs.json");
  validateJobs(validators.validateJob, previousArchive, "existing archive.json");

  const configuredSourceIds = new Set(
    sourceConfig.sources.map((source) => source.id),
  );
  const previousJobs = [...previousActive, ...previousArchive];
  const [collectedSources, manual] = await Promise.all([
    collectConfiguredSources(sourceConfig, options),
    collectManualJobs({
      jobs: manualJobs,
      previousJobs,
      configuredSourceIds,
      offline: options.offline,
      settings: sourceConfig.settings,
    }),
  ]);

  const sourceResults = [
    ...collectedSources.map((collection) => collection.result),
    ...manual.sourceResults,
  ];
  const observations = [
    ...collectedSources.flatMap((collection) => collection.observations),
    ...manual.observations,
  ];
  const reconciled = reconcileJobs({
    observations,
    previousActive,
    previousArchive,
    sourceResults,
    now: options.now,
    settings: sourceConfig.settings,
  });

  validateJobs(validators.validateJob, reconciled.active, "generated jobs.json");
  validateJobs(validators.validateJob, reconciled.archive, "generated archive.json");

  const hadSuccessfulInput = sourceResults.some(
    (result) => result.status === "success",
  );
  const metadata = {
    schemaVersion: SCHEMA_VERSION,
    lastSuccessfulUpdate: hadSuccessfulInput
      ? options.now.toISOString()
      : (previousMetadata?.lastSuccessfulUpdate ?? null),
    activeCount: reconciled.active.length,
    activeCompanyCount: new Set(
      reconciled.active.map((job) => job.company),
    ).size,
    archivedCount: reconciled.archive.length,
    staleAfterDays: sourceConfig.settings.staleAfterDays,
    closingSoonDays: sourceConfig.settings.closingSoonDays,
    missThreshold: sourceConfig.settings.missThreshold,
    sourceResults,
  };
  assertValid(validators.validateMetadata, metadata, "generated metadata.json");

  const changes = await Promise.all([
    writeJsonIfChanged(PATHS.jobs, reconciled.active),
    writeJsonIfChanged(PATHS.archive, reconciled.archive),
    writeJsonIfChanged(PATHS.metadata, metadata),
  ]);

  return {
    active: reconciled.active.length,
    archived: reconciled.archive.length,
    changedFiles: changes.filter(Boolean).length,
    duplicateGroups: reconciled.duplicateGroups,
    sourceResults,
  };
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  updateJobs()
    .then((result) => {
      for (const source of result.sourceResults) {
        const suffix = source.message ? ` — ${source.message}` : "";
        console.log(
          `${source.sourceId}: ${source.status}, ${source.jobsFound} selected${suffix}`,
        );
      }
      console.log(
        `Generated ${result.active} active and ${result.archived} archived jobs; ${result.changedFiles} public data files changed.`,
      );
    })
    .catch((error) => {
      console.error(error.stack ?? error.message);
      process.exitCode = 1;
    });
}
