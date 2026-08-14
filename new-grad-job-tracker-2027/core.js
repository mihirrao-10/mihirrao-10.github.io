export const TRACKING_STORAGE_KEY = "new-grad-job-tracker-2027:tracking";
export const TRACKING_VERSION = 2;

const LEGACY_APPLIED_STATUSES = new Set([
  "Applied",
  "Interviewing",
  "Rejected",
  "Offer",
]);
const LEGACY_NOT_APPLIED_STATUSES = new Set([
  "",
  "Untracked",
  "Interested",
  "Saved",
  "Hidden",
]);
const SUPPORTED_TRACKING_VERSIONS = new Set([1, TRACKING_VERSION]);

export const CATEGORY_ORDER = [
  "Software Engineering",
  "Machine Learning / AI Engineering",
  "Data Science / Applied Science / Analytics",
  "Quantitative Research",
  "Quantitative Trading",
  "Quantitative Development",
  "Systems / Infrastructure / Performance Engineering",
  "Other Technical",
];

export const DEFAULT_FILTERS = Object.freeze({
  keyword: "",
  category: "",
  company: "",
  personalStatus: "",
  sort: "newest",
});

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function emptyTracking() {
  return { version: TRACKING_VERSION, jobs: {} };
}

function normalizeTrackingEntry(value, { strict = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (strict) throw new Error("Each tracked job must be an object.");
    return null;
  }

  const rawStatus = value.status ?? "";
  const notes = value.notes ?? "";
  const updatedAt = value.updatedAt ?? null;
  let status;

  if (LEGACY_APPLIED_STATUSES.has(rawStatus)) {
    status = "Applied";
  } else if (LEGACY_NOT_APPLIED_STATUSES.has(rawStatus)) {
    status = "";
  } else {
    if (strict) throw new Error(`Unknown personal status: ${rawStatus}`);
    return null;
  }
  if (typeof notes !== "string") {
    if (strict) throw new Error("Tracking notes must be text.");
    return null;
  }
  if (updatedAt !== null && typeof updatedAt !== "string") {
    if (strict) throw new Error("Tracking updatedAt must be an ISO date string or null.");
    return null;
  }

  if (!status && !notes.trim()) return null;
  return { status, notes, updatedAt };
}

export function normalizeTracking(value, { strict = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (strict) throw new Error("Tracking backup must be a JSON object.");
    return emptyTracking();
  }

  if (strict && !SUPPORTED_TRACKING_VERSIONS.has(value.version)) {
    throw new Error(`Unsupported tracking backup version: ${String(value.version)}`);
  }

  if (!value.jobs || typeof value.jobs !== "object" || Array.isArray(value.jobs)) {
    if (strict) throw new Error("Tracking backup must contain a jobs object.");
    return emptyTracking();
  }

  const jobs = {};
  for (const [id, entry] of Object.entries(value.jobs)) {
    if (!id.trim()) {
      if (strict) throw new Error("Tracked job IDs cannot be empty.");
      continue;
    }
    const normalized = normalizeTrackingEntry(entry, { strict });
    if (normalized) jobs[id] = normalized;
  }

  return { version: TRACKING_VERSION, jobs };
}

export function parseTrackingImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  return normalizeTracking(parsed, { strict: true });
}

export function loadTracking(storage) {
  try {
    const raw = storage.getItem(TRACKING_STORAGE_KEY);
    return raw ? normalizeTracking(JSON.parse(raw)) : emptyTracking();
  } catch {
    return emptyTracking();
  }
}

export function saveTracking(storage, tracking) {
  storage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(normalizeTracking(tracking)));
}

export function mergeTracking(base, restored) {
  const current = normalizeTracking(base);
  const incoming = normalizeTracking(restored);
  return {
    version: TRACKING_VERSION,
    jobs: { ...current.jobs, ...incoming.jobs },
  };
}

export function updateTracking(tracking, jobId, patch, now = new Date()) {
  const current = normalizeTracking(tracking);
  const previous = current.jobs[jobId] ?? { status: "", notes: "", updatedAt: null };
  const next = normalizeTrackingEntry({
    ...previous,
    ...patch,
    updatedAt: now.toISOString(),
  });
  const jobs = { ...current.jobs };
  if (next) jobs[jobId] = next;
  else delete jobs[jobId];
  return { version: TRACKING_VERSION, jobs };
}

export function getPersonalStatus(tracking, jobId) {
  return normalizeTracking(tracking).jobs[jobId]?.status === "Applied"
    ? "Applied"
    : "Not applied";
}

function containsKeyword(job, keyword) {
  if (!keyword.trim()) return true;
  const haystack = [
    job.company,
    job.title,
    job.category,
    job.country,
    ...(job.locations ?? []),
    ...(job.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  return keyword
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

function timestamp(value) {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time) ? null : time;
}

function salaryAmount(value, suffix) {
  const amount = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(amount)) return null;
  if (suffix?.toLocaleLowerCase() === "k") return amount * 1_000;
  if (suffix?.toLocaleLowerCase() === "m") return amount * 1_000_000;
  return amount;
}

function salaryRange(compensation) {
  if (typeof compensation !== "string") return null;
  if (/\b(?:hour|hourly|per hour)\b|\/\s*hr\b/i.test(compensation)) return null;

  const match = compensation.match(
    /\$\s*(\d[\d,]*(?:\.\d+)?)\s*([km])?\s*(?:-|–|—|to)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*([km])?/i,
  );
  if (!match) return null;

  const lower = salaryAmount(match[1], match[2] ?? match[4]);
  const upper = salaryAmount(match[3], match[4] ?? match[2]);
  if (lower === null || upper === null) return null;
  return lower <= upper ? { lower, upper } : { lower: upper, upper: lower };
}

function compareCompanyAndTitle(a, b) {
  return collator.compare(a.company, b.company) || collator.compare(a.title, b.title);
}

export function sortJobs(jobs, sort = "newest") {
  return [...jobs].sort((a, b) => {
    if (sort === "company") {
      return compareCompanyAndTitle(a, b);
    }

    if (sort === "deadline") {
      const aDate = timestamp(a.deadline);
      const bDate = timestamp(b.deadline);
      if (aDate === null && bDate !== null) return 1;
      if (aDate !== null && bDate === null) return -1;
      if (aDate !== bDate) return (aDate ?? 0) - (bDate ?? 0);
      return (
        (timestamp(b.datePosted) ?? timestamp(b.firstSeen) ?? 0) -
          (timestamp(a.datePosted) ?? timestamp(a.firstSeen) ?? 0) ||
        collator.compare(a.company, b.company)
      );
    }

    if (sort === "verified") {
      return (timestamp(b.lastVerified) ?? 0) - (timestamp(a.lastVerified) ?? 0) || collator.compare(a.company, b.company);
    }

    if (sort === "salary") {
      const aRange = salaryRange(a.compensation);
      const bRange = salaryRange(b.compensation);
      if (aRange === null && bRange !== null) return 1;
      if (aRange !== null && bRange === null) return -1;
      if (aRange === null && bRange === null) return compareCompanyAndTitle(a, b);
      return (
        bRange.lower - aRange.lower ||
        bRange.upper - aRange.upper ||
        compareCompanyAndTitle(a, b)
      );
    }

    return (
      (timestamp(b.datePosted) ?? timestamp(b.firstSeen) ?? 0) -
        (timestamp(a.datePosted) ?? timestamp(a.firstSeen) ?? 0) ||
      collator.compare(a.company, b.company)
    );
  });
}

export function filterJobs(jobs, filters = DEFAULT_FILTERS, tracking = emptyTracking()) {
  const normalizedTracking = normalizeTracking(tracking);
  const filtered = jobs.filter((job) => {
    const personalStatus =
      normalizedTracking.jobs[job.id]?.status === "Applied"
        ? "Applied"
        : "Not applied";

    if (filters.personalStatus && personalStatus !== filters.personalStatus) return false;
    if (!containsKeyword(job, filters.keyword ?? "")) return false;
    if (filters.category && job.category !== filters.category) return false;
    if (filters.company && job.company !== filters.company) return false;
    return true;
  });

  return sortJobs(filtered, filters.sort);
}

export function groupJobsByCompany(jobs) {
  const groups = [];
  const groupsByCompany = new Map();

  for (const job of jobs) {
    let group = groupsByCompany.get(job.company);
    if (!group) {
      group = { company: job.company, jobs: [] };
      groupsByCompany.set(job.company, group);
      groups.push(group);
    }
    group.jobs.push(job);
  }

  return groups;
}

export function exportTrackingPayload(tracking, now = new Date()) {
  return {
    ...normalizeTracking(tracking),
    exportedAt: now.toISOString(),
    notice: "This backup contains browser-local applied statuses and private notes.",
  };
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function trackingToCsv(jobs, tracking) {
  const normalized = normalizeTracking(tracking);
  const headers = [
    "Job ID",
    "Company",
    "Title",
    "Location",
    "Official application URL",
    "Application status",
    "Notes",
    "Tracking updated at",
  ];
  const rows = jobs
    .filter((job) => normalized.jobs[job.id])
    .map((job) => {
      const entry = normalized.jobs[job.id];
      return [
        job.id,
        job.company,
        job.title,
        (job.locations ?? []).join("; "),
        job.applicationUrl,
        entry.status || "Not applied",
        entry.notes,
        entry.updatedAt,
      ];
    });
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function formatDate(value, { includeTime = false } = {}) {
  if (!value) return "Not listed";
  const date = new Date(includeTime || value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Not listed";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : { timeZone: "UTC" }),
  }).format(date);
}
