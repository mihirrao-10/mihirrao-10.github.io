const TRACKING_PARAMETERS = new Set([
  "campaign",
  "gh_src",
  "lever-origin",
  "lever-source",
  "ref",
  "referrer",
  "source",
]);

function isTrackingParameter(name) {
  const lower = name.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_PARAMETERS.has(lower);
}

export function canonicalizeUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }

  const parameters = [...url.searchParams.entries()]
    .filter(([name]) => !isTrackingParameter(name))
    .sort(([leftName, leftValue], [rightName, rightValue]) =>
      `${leftName}=${leftValue}`.localeCompare(`${rightName}=${rightValue}`),
    );

  url.search = "";
  for (const [name, parameterValue] of parameters) {
    url.searchParams.append(name, parameterValue);
  }

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function normalizeIdentityPart(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function jobIdentityKey(job) {
  const locations = [...job.locations]
    .map(normalizeIdentityPart)
    .filter(Boolean)
    .sort()
    .join("|");
  return [job.company, job.title]
    .map(normalizeIdentityPart)
    .concat(locations)
    .join("::");
}
