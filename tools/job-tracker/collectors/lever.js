import { fetchJson } from "../lib/fetch.js";
import { normalizeWorkplaceType } from "../lib/normalization.js";

export async function collectLever(source, requestOptions) {
  const site = encodeURIComponent(source.site);
  const host = source.instance === "eu" ? "api.eu.lever.co" : "api.lever.co";
  // Descriptions make large Lever boards several megabytes. Small sequential
  // pages stay within the shared request timeout without increasing concurrency.
  const pageSize = 20;
  const payload = [];

  for (let skip = 0; skip < 2000; skip += pageSize) {
    const endpoint = `https://${host}/v0/postings/${site}?mode=json&limit=${pageSize}&skip=${skip}`;
    const page = await fetchJson(endpoint, requestOptions);
    if (!Array.isArray(page)) {
      throw new Error(`Lever site ${source.id} returned no postings array`);
    }
    payload.push(...page);
    if (page.length < pageSize) {
      break;
    }
    if (skip + pageSize >= 2000) {
      throw new Error(
        `Lever site ${source.id} exceeded the 2,000-posting safety limit`,
      );
    }
  }

  return payload.map((job) => {
    const location = job.categories?.location ?? "";
    const locations = job.categories?.allLocations ?? [location];
    const description = [
      job.descriptionPlain,
      job.additionalPlain,
      ...(job.lists ?? []).map((list) => `${list.text} ${list.content}`),
    ]
      .filter(Boolean)
      .join(" ");

    return {
      externalId: String(job.id),
      title: job.text,
      applicationUrl: job.applyUrl ?? job.hostedUrl,
      sourceUrl: job.hostedUrl ?? job.applyUrl,
      locations: locations.filter(Boolean),
      workplaceType: normalizeWorkplaceType(
        `${job.workplaceType ?? ""} ${location}`,
      ),
      compensation: job.salaryDescriptionPlain ?? (job.salaryRange
        ? `${job.salaryRange.currency ?? ""} ${job.salaryRange.min ?? ""}–${job.salaryRange.max ?? ""} ${job.salaryRange.interval ?? ""}`.trim()
        : null),
      // The public Postings API does not document a publication timestamp.
      datePosted: null,
      description,
      employmentType: job.categories?.commitment,
    };
  });
}
