import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_FILTERS,
  TRACKING_STORAGE_KEY,
  TRACKING_VERSION,
  filterJobs,
  getPersonalStatus,
  loadTracking,
  mergeTracking,
  parseTrackingImport,
  saveTracking,
  sortJobs,
  trackingToCsv,
  updateTracking,
} from "../../new-grad-job-tracker-2027/core.js";

const jobs = [
  {
    id: "role-alpha",
    company: "Alpha",
    title: "Graduate Software Engineer",
    category: "Software Engineering",
    country: "United States",
    locations: ["Chicago, IL"],
    degreeLevels: ["Undergraduate / Master's"],
    workplaceType: "Hybrid",
    visaEvidence: { level: "Strong" },
    graduationMonths: ["2026-12", "2027-05"],
    graduationWindow: "December 2026 through May 2027",
    datePosted: "2026-07-20",
    firstSeen: "2026-07-21",
    lastVerified: "2026-07-31",
    deadline: null,
    applicationUrl: "https://jobs.example.com/alpha",
    tags: ["Python"],
  },
  {
    id: "role-beta",
    company: "Beta",
    title: "Quantitative Researcher",
    category: "Quantitative Research",
    country: "United States",
    locations: ["New York, NY"],
    degreeLevels: ["Undergraduate / Master's"],
    workplaceType: "On-site",
    visaEvidence: { level: "Historical" },
    graduationMonths: ["2027-08"],
    graduationWindow: "Graduating by August 2027",
    datePosted: "2026-07-25",
    firstSeen: "2026-07-25",
    lastVerified: "2026-07-30",
    deadline: "2026-09-01",
    applicationUrl: "https://jobs.example.com/beta",
    tags: ["C++"],
  },
];

function filters(overrides = {}) {
  return { ...DEFAULT_FILTERS, ...overrides };
}

function memoryStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set(TRACKING_STORAGE_KEY, initialValue);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("filters jobs by search, category, company, and binary application status", () => {
  const tracking = updateTracking(
    { version: TRACKING_VERSION, jobs: {} },
    "role-alpha",
    { status: "Applied" },
    new Date("2026-07-31T12:00:00Z"),
  );

  assert.deepEqual(
    filterJobs(jobs, filters({ keyword: "alpha python chicago" }), tracking).map((job) => job.id),
    ["role-alpha"],
  );
  assert.deepEqual(
    filterJobs(jobs, filters({ category: "Quantitative Research", company: "Beta" }), tracking).map(
      (job) => job.id,
    ),
    ["role-beta"],
  );
  assert.deepEqual(
    filterJobs(jobs, filters({ personalStatus: "Applied" }), tracking).map((job) => job.id),
    ["role-alpha"],
  );
  assert.deepEqual(
    filterJobs(jobs, filters({ personalStatus: "Not applied" }), tracking).map((job) => job.id),
    ["role-beta"],
  );
});

test("deadline sort puts published dates first and keeps undated roles useful", () => {
  assert.deepEqual(sortJobs(jobs, "deadline").map((job) => job.id), [
    "role-beta",
    "role-alpha",
  ]);
  assert.deepEqual(
    sortJobs(jobs.map((job) => ({ ...job, deadline: null })), "deadline").map(
      (job) => job.id,
    ),
    ["role-beta", "role-alpha"],
  );
});

test("salary sort uses lower, then upper range bounds and puts missing ranges last", () => {
  const salaryJobs = [
    {
      id: "lower-range",
      company: "Alpha",
      title: "Engineer",
      compensation: "$120,000–$210,000 base",
    },
    {
      id: "equal-lower-smaller-upper",
      company: "Beta",
      title: "Engineer",
      compensation: "$150K - $180K base",
    },
    {
      id: "equal-lower-larger-upper",
      company: "Gamma",
      title: "Engineer",
      compensation: "$150,000 to $220,000 base",
    },
    {
      id: "single-value",
      company: "Delta",
      title: "Engineer",
      compensation: "$300,000 base",
    },
    {
      id: "missing",
      company: "Epsilon",
      title: "Engineer",
      compensation: null,
    },
  ];

  assert.deepEqual(sortJobs(salaryJobs, "salary").map((job) => job.id), [
    "equal-lower-larger-upper",
    "equal-lower-smaller-upper",
    "lower-range",
    "single-value",
    "missing",
  ]);
});

test("legacy browser statuses migrate to binary applied state without losing notes", () => {
  const storage = memoryStorage(
    JSON.stringify({
      version: 1,
      jobs: {
        "role-alpha": {
          status: "Interviewing",
          notes: "Second round",
          updatedAt: "2026-07-31T13:00:00.000Z",
        },
        "role-beta": {
          status: "Saved",
          notes: "Review later",
          updatedAt: "2026-07-31T14:00:00.000Z",
        },
      },
    }),
  );

  const migrated = loadTracking(storage);
  assert.equal(migrated.version, TRACKING_VERSION);
  assert.equal(migrated.jobs["role-alpha"].status, "Applied");
  assert.equal(migrated.jobs["role-alpha"].notes, "Second round");
  assert.equal(migrated.jobs["role-beta"].status, "");
  assert.equal(migrated.jobs["role-beta"].notes, "Review later");
  assert.equal(getPersonalStatus(migrated, "role-alpha"), "Applied");
  assert.equal(getPersonalStatus(migrated, "role-beta"), "Not applied");
});

test("binary local tracking survives save, load, updates, and version-one restore merges", () => {
  const storage = memoryStorage();
  const first = updateTracking(
    { version: TRACKING_VERSION, jobs: {} },
    "role-alpha",
    { status: "Applied", notes: "Submitted July 31" },
    new Date("2026-07-31T13:00:00Z"),
  );
  saveTracking(storage, first);

  assert.deepEqual(loadTracking(storage), first);

  const restored = parseTrackingImport(
    JSON.stringify({
      version: 1,
      jobs: {
        "role-beta": {
          status: "Offer",
          notes: "Legacy backup",
          updatedAt: "2026-07-31T14:00:00.000Z",
        },
      },
    }),
  );
  const merged = mergeTracking(loadTracking(storage), restored);

  assert.equal(merged.jobs["role-alpha"].status, "Applied");
  assert.equal(merged.jobs["role-alpha"].notes, "Submitted July 31");
  assert.equal(merged.jobs["role-beta"].status, "Applied");
});

test("invalid imported personal statuses are rejected", () => {
  assert.throws(
    () =>
      parseTrackingImport(
        JSON.stringify({
          version: TRACKING_VERSION,
          jobs: {
            "role-alpha": { status: "Uploaded", notes: "", updatedAt: null },
          },
        }),
      ),
    /Unknown personal status/,
  );
});

test("CSV exports the binary application status", () => {
  const tracking = {
    version: TRACKING_VERSION,
    jobs: {
      "role-alpha": { status: "Applied", notes: "", updatedAt: null },
      "role-beta": { status: "", notes: "Review later", updatedAt: null },
    },
  };
  const csv = trackingToCsv(jobs, tracking);
  assert.match(csv, /"Application status"/);
  assert.match(csv, /"Applied"/);
  assert.match(csv, /"Not applied"/);
});

test("corrupt browser storage fails closed without losing page functionality", () => {
  const storage = memoryStorage("not json");
  assert.deepEqual(loadTracking(storage), { version: TRACKING_VERSION, jobs: {} });
});
