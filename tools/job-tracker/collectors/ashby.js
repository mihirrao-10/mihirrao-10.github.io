import { fetchJson } from "../lib/fetch.js";
import { isoDate, normalizeWorkplaceType } from "../lib/normalization.js";

function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function collectAshby(source, requestOptions) {
  const boardName = encodeURIComponent(source.boardName);
  const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${boardName}?includeCompensation=true`;
  const payload = await fetchJson(endpoint, requestOptions);

  if (!Array.isArray(payload.jobs)) {
    throw new Error(`Ashby board ${source.id} returned no jobs array`);
  }

  return payload.jobs.map((job) => ({
    // The public API does not document a separate ID field; jobUrl is the
    // stable published-posting identity when an implementation omits one.
    externalId: String(job.id ?? job.jobUrl ?? job.applyUrl),
    title: job.title,
    applicationUrl: job.applyUrl ?? job.jobUrl,
    sourceUrl: job.jobUrl ?? job.applyUrl,
    locations: [
      job.location,
      ...(job.secondaryLocations ?? []).map((location) => location.location),
    ].filter(Boolean),
    workplaceType: normalizeWorkplaceType(
      `${job.isRemote ? "remote" : ""} ${job.workplaceType ?? ""} ${job.location ?? ""}`,
    ),
    compensation:
      job.compensationTierSummary ?? job.compensation?.compensationTierSummary ?? null,
    datePosted: isoDate(job.publishedAt),
    description: job.descriptionPlain ?? stripHtml(job.descriptionHtml),
    employmentType: job.employmentType,
  }));
}
