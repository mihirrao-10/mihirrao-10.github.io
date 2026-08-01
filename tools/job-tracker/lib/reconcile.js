import { dedupeJobs } from "./dedupe.js";
import { calendarDate } from "./normalization.js";
import { applyDerivedStatus, closeAfterMiss } from "./status.js";
import { canonicalizeUrl, jobIdentityKey } from "./url.js";

function buildPreviousIndex(previousJobs) {
  const byId = new Map();
  const byUrl = new Map();
  const byIdentity = new Map();
  for (const job of previousJobs) {
    byId.set(job.id, job);
    byUrl.set(canonicalizeUrl(job.applicationUrl), job);
    byIdentity.set(jobIdentityKey(job), job);
  }
  return { byId, byUrl, byIdentity };
}

function findPrevious(job, index) {
  return (
    index.byId.get(job.id) ??
    index.byUrl.get(canonicalizeUrl(job.applicationUrl)) ??
    index.byIdentity.get(jobIdentityKey(job))
  );
}

function reconcileObservation(observation, previous, now, settings) {
  const today = calendarDate(now, settings.timeZone);
  const previousFirstSeen = previous?.firstSeen;
  let job = {
    ...observation.job,
    id: previous?.id ?? observation.job.id,
    // Correct a future date if an older UTC-based updater crossed midnight
    // before the board's configured local calendar day.
    firstSeen:
      previousFirstSeen && previousFirstSeen <= today
        ? previousFirstSeen
        : observation.job.firstSeen <= today
          ? observation.job.firstSeen
          : today,
  };

  if (observation.verification === "verified") {
    job = {
      ...job,
      lastVerified: today,
      missCount: 0,
      status: job.status === "closed" ? "closed" : "active",
      closedDate: job.status === "closed" ? job.closedDate ?? today : null,
    };
  } else if (observation.verification === "missing") {
    job = closeAfterMiss(
      {
        ...job,
        lastVerified: previous?.lastVerified ?? job.lastVerified,
        missCount: previous?.missCount ?? job.missCount,
      },
      now,
      settings.missThreshold,
      settings.timeZone,
    );
  } else if (previous) {
    job = {
      ...job,
      lastVerified: previous.lastVerified,
      missCount: previous.missCount,
      status: previous.status,
      closedDate: previous.closedDate,
    };
  }

  return applyDerivedStatus(job, now, settings);
}

function sortJobs(jobs) {
  return jobs.sort((left, right) =>
    `${left.company}\0${left.title}\0${left.id}`.localeCompare(
      `${right.company}\0${right.title}\0${right.id}`,
    ),
  );
}

export function reconcileJobs({
  observations,
  previousActive,
  previousArchive,
  sourceResults,
  now,
  settings,
}) {
  const previousJobs = [...previousActive, ...previousArchive];
  const previousIndex = buildPreviousIndex(previousJobs);
  const resultBySource = new Map(
    sourceResults.map((result) => [result.sourceId, result]),
  );
  const matchedPreviousIds = new Set();
  const reconciled = [];

  for (const observation of observations) {
    const previous = findPrevious(observation.job, previousIndex);
    if (previous) {
      matchedPreviousIds.add(previous.id);
    }
    reconciled.push(
      reconcileObservation(observation, previous, now, settings),
    );
  }

  for (const previous of previousJobs) {
    if (matchedPreviousIds.has(previous.id)) {
      continue;
    }
    // Closed records are historical snapshots. Do not churn missCount forever;
    // an observed, verified copy can still reopen one through the loop above.
    if (previous.status === "closed") {
      reconciled.push(previous);
      continue;
    }
    const sourceResult = resultBySource.get(previous.sourceId);
    const next =
      sourceResult?.status === "success"
        ? closeAfterMiss(
            previous,
            now,
            settings.missThreshold,
            settings.timeZone,
          )
        : previous;
    reconciled.push(applyDerivedStatus(next, now, settings));
  }

  const { jobs, duplicateGroups } = dedupeJobs(reconciled);
  return {
    active: sortJobs(jobs.filter((job) => job.status !== "closed")),
    archive: sortJobs(jobs.filter((job) => job.status === "closed")),
    duplicateGroups,
  };
}
