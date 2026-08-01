import { fetchJson } from "../lib/fetch.js";
import { normalizeWorkplaceType } from "../lib/normalization.js";

function stripHtml(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function collectGreenhouse(source, requestOptions) {
  const boardToken = encodeURIComponent(source.boardToken);
  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  const payload = await fetchJson(endpoint, requestOptions);

  if (!Array.isArray(payload.jobs)) {
    throw new Error(`Greenhouse board ${source.id} returned no jobs array`);
  }

  return payload.jobs.map((job) => ({
    externalId: String(job.id),
    title: job.title,
    applicationUrl: job.absolute_url,
    sourceUrl: job.absolute_url,
    locations: [job.location?.name].filter(Boolean),
    workplaceType: normalizeWorkplaceType(job.location?.name),
    compensation: null,
    // Greenhouse exposes updated_at, not the original posting date. Treating it
    // as datePosted would be misleading, so a curator may supply an override.
    datePosted: null,
    description: stripHtml(job.content),
    isProspect: job.internal_job_id === null,
  }));
}
