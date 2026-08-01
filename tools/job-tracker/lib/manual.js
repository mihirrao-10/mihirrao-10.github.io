import { mapWithConcurrency, probeUrl } from "./fetch.js";

const AUTOMATED_PLATFORMS = new Set(["Ashby", "Greenhouse", "Lever"]);

export async function collectManualJobs({
  jobs,
  previousJobs,
  configuredSourceIds,
  offline,
  settings,
}) {
  const currentSourceIds = new Set(jobs.map((job) => job.sourceId));
  for (const previous of previousJobs) {
    if (
      !configuredSourceIds.has(previous.sourceId) &&
      !AUTOMATED_PLATFORMS.has(previous.sourcePlatform)
    ) {
      currentSourceIds.add(previous.sourceId);
    }
  }

  const requestOptions = {
    retries: settings.requestRetries,
    timeoutMs: settings.requestTimeoutMs,
  };
  const observations = await mapWithConcurrency(
    jobs,
    settings.sourceConcurrency,
    async (job) => {
      if (offline || job.status === "closed") {
        return { job, verification: "unverified" };
      }
      const result = await probeUrl(job.applicationUrl, requestOptions);
      return { job, verification: result.state };
    },
  );

  const sourceResults = [...currentSourceIds]
    .sort()
    .map((sourceId) => {
      const sourceObservations = observations.filter(
        (observation) => observation.job.sourceId === sourceId,
      );
      const counts = sourceObservations.reduce(
        (result, observation) => {
          result[observation.verification] += 1;
          return result;
        },
        { verified: 0, missing: 0, unverified: 0 },
      );
      const allUnavailable =
        sourceObservations.length > 0 &&
        counts.verified === 0 &&
        counts.missing === 0;

      return {
        sourceId,
        platform: "Manual",
        status: offline ? "skipped" : allUnavailable ? "failed" : "success",
        jobsFound: sourceObservations.length,
        message: offline
          ? "Offline update: application URLs not probed"
          : `${counts.verified} verified, ${counts.missing} confirmed missing, ${counts.unverified} temporarily unavailable`,
      };
    });

  return { observations, sourceResults };
}
