import assert from "node:assert/strict";
import test from "node:test";

import { collectManualJobs } from "../../tools/job-tracker/lib/manual.js";
import { sampleJob } from "./helpers.js";

const settings = {
  requestRetries: 0,
  requestTimeoutMs: 1000,
  sourceConcurrency: 2,
};

test("manual source results expose per-link probe outcomes", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) =>
    new Response(null, { status: String(url).includes("available") ? 200 : 403 });

  try {
    const jobs = [
      sampleJob({
        id: "manual-example-available",
        applicationUrl: "https://jobs.example.com/available",
      }),
      sampleJob({
        id: "manual-example-unavailable",
        applicationUrl: "https://jobs.example.com/restricted",
      }),
    ];
    const result = await collectManualJobs({
      jobs,
      previousJobs: [],
      configuredSourceIds: new Set(),
      offline: false,
      settings,
    });

    assert.equal(result.sourceResults[0].status, "success");
    assert.equal(
      result.sourceResults[0].message,
      "1 verified, 0 confirmed missing, 1 temporarily unavailable",
    );
    assert.deepEqual(
      result.observations.map((observation) => observation.verification),
      ["verified", "unverified"],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
