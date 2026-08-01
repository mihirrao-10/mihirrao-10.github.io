import assert from "node:assert/strict";
import test from "node:test";

import {
  assertValid,
  loadValidators,
} from "../../tools/job-tracker/lib/schema.js";
import { sampleJob } from "./helpers.js";

test("the public job schema accepts a complete normalized job", async () => {
  const { validateJob } = await loadValidators();
  assert.doesNotThrow(() => assertValid(validateJob, sampleJob(), "fixture"));
});

test("the job schema rejects unsupported evidence levels", async () => {
  const { validateJob } = await loadValidators();
  const job = sampleJob({
    visaEvidence: {
      level: "Likely",
      explanation: "This classification is deliberately not supported.",
      url: "https://jobs.example.com/immigration",
    },
  });
  assert.throws(
    () => assertValid(validateJob, job, "fixture"),
    /visaEvidence\/level.*allowed values/,
  );
});

test("evidence always needs an explanation and an HTTPS source", async () => {
  const { validateJob } = await loadValidators();
  const job = sampleJob({
    visaEvidence: {
      level: "Historical",
      explanation: "Too short",
      url: "http://example.com/evidence",
    },
  });
  assert.throws(() => assertValid(validateJob, job, "fixture"));
});

test("closed jobs need a closed date and active jobs cannot have one", async () => {
  const { validateJob } = await loadValidators();
  assert.throws(() =>
    assertValid(
      validateJob,
      sampleJob({ status: "closed", closedDate: null }),
      "fixture",
    ),
  );
  assert.throws(() =>
    assertValid(
      validateJob,
      sampleJob({ closedDate: "2026-07-31" }),
      "fixture",
    ),
  );
});
