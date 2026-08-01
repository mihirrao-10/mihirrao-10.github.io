import assert from "node:assert/strict";
import test from "node:test";

import { reconcileJobs } from "../../tools/job-tracker/lib/reconcile.js";
import { sampleJob } from "./helpers.js";

const settings = {
  staleAfterDays: 7,
  closingSoonDays: 7,
  missThreshold: 2,
  timeZone: "America/New_York",
};

function reconcile(overrides = {}) {
  return reconcileJobs({
    observations: [],
    previousActive: [sampleJob()],
    previousArchive: [],
    sourceResults: [],
    now: new Date("2026-07-31T12:00:00Z"),
    settings,
    ...overrides,
  });
}

test("source failure never increments misses or closes prior jobs", () => {
  const result = reconcile({
    sourceResults: [
      {
        sourceId: "manual-example",
        platform: "Manual",
        status: "failed",
        jobsFound: 0,
      },
    ],
  });
  assert.equal(result.active[0].missCount, 0);
  assert.equal(result.archive.length, 0);
});

test("successful source misses are conservative and eventually archive", () => {
  const first = reconcile({
    sourceResults: [
      {
        sourceId: "manual-example",
        platform: "Manual",
        status: "success",
        jobsFound: 0,
      },
    ],
  });
  assert.equal(first.active[0].missCount, 1);

  const second = reconcile({
    previousActive: first.active,
    sourceResults: [
      {
        sourceId: "manual-example",
        platform: "Manual",
        status: "success",
        jobsFound: 0,
      },
    ],
    now: new Date("2026-08-01T12:00:00Z"),
  });
  assert.equal(second.active.length, 0);
  assert.equal(second.archive[0].status, "closed");
});

test("firstSeen is preserved and lastVerified advances only after success", () => {
  const candidate = sampleJob({
    firstSeen: "2026-07-31",
    lastVerified: "2026-07-31",
  });
  const unavailable = reconcile({
    observations: [{ job: candidate, verification: "unverified" }],
  });
  assert.equal(unavailable.active[0].firstSeen, "2026-07-21");
  assert.equal(unavailable.active[0].lastVerified, "2026-07-30");

  const verified = reconcile({
    observations: [{ job: candidate, verification: "verified" }],
  });
  assert.equal(verified.active[0].firstSeen, "2026-07-21");
  assert.equal(verified.active[0].lastVerified, "2026-07-31");
});

test("closed archive records do not accumulate meaningless misses", () => {
  const archived = sampleJob({
    status: "closed",
    closedDate: "2026-07-29",
    missCount: 2,
  });
  const result = reconcile({
    previousActive: [],
    previousArchive: [archived],
    sourceResults: [
      {
        sourceId: "manual-example",
        platform: "Manual",
        status: "success",
        jobsFound: 0,
      },
    ],
  });
  assert.equal(result.archive[0].missCount, 2);
});
