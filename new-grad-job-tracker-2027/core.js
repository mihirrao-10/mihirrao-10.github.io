export const TRACKING_STORAGE_KEY = "new-grad-job-tracker-2027:tracking";
export const TRACKING_VERSION = 1;

export const PERSONAL_STATUSES = [
  "Interested",
  "Saved",
  "Applied",
  "Interviewing",
  "Rejected",
  "Offer",
  "Hidden",
];

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

export const DEGREE_LEVELS = ["Undergraduate / Master's", "PhD"];

export const DEFAULT_FILTERS = Object.freeze({
  keyword: "",
  category: "",
  company: "",
  location: "",
  workplace: "",
  evidence: "",
  degree: "",
  graduation: "",
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

  const status = value.status ?? "";
  const notes = value.notes ?? "";
  const updatedAt = value.updatedAt ?? null;

  if (status && !PERSONAL_STATUSES.includes(status)) {
    if (strict) throw new Error(`Unknown personal status: ${status}`);
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

  if (strict && value.version !== TRACKING_VERSION) {
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
  return normalizeTracking(tracking).jobs[jobId]?.status || "Untracked";
}

function containsKeyword(job, keyword) {
  if (!keyword.trim()) return true;
  const haystack = [
    job.company,
    job.title,
    job.category,
    job.region,
    job.country,
    job.workplaceType,
    ...(job.degreeLevels ?? []),
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

function matchesGraduationWindow(job, filter) {
  if (!filter) return true;
  const months = Array.isArray(job.graduationMonths) ? job.graduationMonths : [];
  const description = String(job.graduationWindow ?? "").toLocaleLowerCase();

  if (filter === "2026-12") {
    return months.includes("2026-12") || description.includes("december 2026");
  }

  const monthNumbers = months
    .filter((month) => month.startsWith("2027-"))
    .map((month) => Number(month.slice(5, 7)));

  if (filter === "2027-spring") {
    return monthNumbers.some((month) => month >= 1 && month <= 5) || description.includes("spring 2027");
  }
  if (filter === "2027-summer") {
    return monthNumbers.some((month) => month >= 6 && month <= 9) || description.includes("summer 2027");
  }
  return true;
}

function timestamp(value) {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time) ? null : time;
}

export function sortJobs(jobs, sort = "newest") {
  return [...jobs].sort((a, b) => {
    if (sort === "company") {
      return collator.compare(a.company, b.company) || collator.compare(a.title, b.title);
    }

    if (sort === "deadline") {
      const aDate = timestamp(a.deadline);
      const bDate = timestamp(b.deadline);
      if (aDate === null && bDate !== null) return 1;
      if (aDate !== null && bDate === null) return -1;
      if (aDate !== bDate) return (aDate ?? 0) - (bDate ?? 0);
      return collator.compare(a.company, b.company);
    }

    if (sort === "verified") {
      return (timestamp(b.lastVerified) ?? 0) - (timestamp(a.lastVerified) ?? 0) || collator.compare(a.company, b.company);
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
    const personalStatus = normalizedTracking.jobs[job.id]?.status || "Untracked";

    if (!filters.personalStatus && personalStatus === "Hidden") return false;
    if (filters.personalStatus && personalStatus !== filters.personalStatus) return false;
    if (!containsKeyword(job, filters.keyword ?? "")) return false;
    if (filters.category && job.category !== filters.category) return false;
    if (filters.company && job.company !== filters.company) return false;
    if (filters.location && !(job.locations ?? []).includes(filters.location)) return false;
    if (filters.workplace && job.workplaceType !== filters.workplace) return false;
    if (filters.evidence && job.visaEvidence?.level !== filters.evidence) return false;
    if (filters.degree && !(job.degreeLevels ?? []).includes(filters.degree)) return false;
    if (!matchesGraduationWindow(job, filters.graduation)) return false;
    return true;
  });

  return sortJobs(filtered, filters.sort);
}

export function exportTrackingPayload(tracking, now = new Date()) {
  return {
    ...normalizeTracking(tracking),
    exportedAt: now.toISOString(),
    notice: "This backup contains browser-local application tracking data and notes.",
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
    "Personal status",
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
        entry.status || "Untracked",
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
