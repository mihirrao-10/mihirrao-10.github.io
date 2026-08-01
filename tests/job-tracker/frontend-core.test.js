import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_FILTERS,
  TRACKING_STORAGE_KEY,
  filterJobs,
  loadTracking,
  mergeTracking,
  parseTrackingImport,
  saveTracking,
  updateTracking,
} from "../../new-grad-job-tracker-2027/core.js";

const jobs = [
  {
    id: "role-alpha",
    company: "Alpha",
    title: "Graduate Software Engineer",
    category: "Software Engineering",
    region: "United States — Midwest",
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
    tags: ["Python"],
  },
  {
    id: "role-beta",
    company: "Beta",
    title: "Quantitative Researcher",
    category: "Quantitative Research",
    region: "United States — Northeast",
    country: "United States",
    locations: ["New York, NY"],
    degreeLevels: ["Undergraduate / Master's", "PhD"],
    workplaceType: "On-site",
    visaEvidence: { level: "Historical" },
    graduationMonths: ["2027-08"],
    graduationWindow: "Graduating by August 2027",
    datePosted: "2026-07-25",
    firstSeen: "2026-07-25",
    lastVerified: "2026-07-30",
    deadline: "2026-09-01",
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

test("filters jobs by search, normalized facets, and graduation window", () => {
  assert.deepEqual(
    filterJobs(jobs, filters({ keyword: "alpha python chicago" })).map((job) => job.id),
    ["role-alpha"],
  );
  assert.deepEqual(
    filterJobs(jobs, filters({ category: "Quantitative Research", location: "New York, NY" })).map(
      (job) => job.id,
    ),
    ["role-beta"],
  );
  assert.deepEqual(
    filterJobs(jobs, filters({ evidence: "Strong", workplace: "Hybrid" })).map((job) => job.id),
    ["role-alpha"],
  );
  assert.deepEqual(
    filterJobs(jobs, filters({ graduation: "2027-summer" })).map((job) => job.id),
    ["role-beta"],
  );
  assert.deepEqual(
    filterJobs(jobs, filters({ degree: "PhD" })).map((job) => job.id),
    ["role-beta"],
  );
  assert.deepEqual(
    filterJobs(jobs, filters({ degree: "Undergraduate / Master's" })).map((job) => job.id),
    ["role-beta", "role-alpha"],
  );
});

test("hidden roles stay hidden by default and remain recoverable by status filter", () => {
  const tracking = updateTracking(
    { version: 1, jobs: {} },
    "role-alpha",
    { status: "Hidden", notes: "Not a fit" },
    new Date("2026-07-31T12:00:00Z"),
  );

  assert.deepEqual(filterJobs(jobs, filters(), tracking).map((job) => job.id), ["role-beta"]);
  assert.deepEqual(
    filterJobs(jobs, filters({ personalStatus: "Hidden" }), tracking).map((job) => job.id),
    ["role-alpha"],
  );
});

test("local tracking survives save, load, updates, and restore merges", () => {
  const storage = memoryStorage();
  const first = updateTracking(
    { version: 1, jobs: {} },
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
          status: "Saved",
          notes: "Review later",
          updatedAt: "2026-07-31T14:00:00.000Z",
        },
      },
    }),
  );
  const merged = mergeTracking(loadTracking(storage), restored);

  assert.equal(merged.jobs["role-alpha"].status, "Applied");
  assert.equal(merged.jobs["role-alpha"].notes, "Submitted July 31");
  assert.equal(merged.jobs["role-beta"].status, "Saved");
});

test("invalid imported personal statuses are rejected", () => {
  assert.throws(
    () =>
      parseTrackingImport(
        JSON.stringify({
          version: 1,
          jobs: {
            "role-alpha": { status: "Uploaded", notes: "", updatedAt: null },
          },
        }),
      ),
    /Unknown personal status/,
  );
});

test("corrupt browser storage fails closed without losing page functionality", () => {
  const storage = memoryStorage("not json");
  assert.deepEqual(loadTracking(storage), { version: 1, jobs: {} });
});
