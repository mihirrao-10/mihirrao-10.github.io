import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDerivedStatus,
  closeAfterMiss,
  deriveStatus,
} from "../../tools/job-tracker/lib/status.js";
import { sampleJob } from "./helpers.js";

const settings = { staleAfterDays: 7, closingSoonDays: 7 };

test("recent jobs with near deadlines are closing soon", () => {
  const result = deriveStatus(
    sampleJob({ lastVerified: "2026-07-31", deadline: "2026-08-05" }),
    "2026-07-31T12:00:00Z",
    settings,
  );
  assert.deepEqual(result, { status: "closing-soon", closedDate: null });
});

test("not recently verified jobs become stale", () => {
  const result = applyDerivedStatus(
    sampleJob({ lastVerified: "2026-07-20" }),
    "2026-07-31T12:00:00Z",
    settings,
  );
  assert.equal(result.status, "stale");
});

test("passed application deadlines move jobs to the archive state", () => {
  const result = deriveStatus(
    sampleJob({ deadline: "2026-07-30" }),
    "2026-07-31T12:00:00Z",
    settings,
  );
  assert.deepEqual(result, { status: "closed", closedDate: "2026-07-30" });
});

test("one successful miss does not close a job and a second does", () => {
  const once = closeAfterMiss(sampleJob(), "2026-07-31", 2);
  const twice = closeAfterMiss(once, "2026-08-01", 2);
  assert.equal(once.status, "active");
  assert.equal(once.missCount, 1);
  assert.equal(twice.status, "closed");
  assert.equal(twice.closedDate, "2026-08-01");
});
