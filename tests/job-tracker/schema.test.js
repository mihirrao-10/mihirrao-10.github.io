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

test("the job schema requires a supported degree eligibility group", async () => {
  const { validateJob } = await loadValidators();
  assert.throws(() =>
    assertValid(
      validateJob,
      sampleJob({ degreeLevels: ["MBA"] }),
      "fixture",
    ),
  );
  assert.throws(() =>
    assertValid(validateJob, sampleJob({ degreeLevels: [] }), "fixture"),
  );
});

test("the job schema restricts the board to normalized U.S. city and state locations", async () => {
  const { validateJob } = await loadValidators();
  assert.throws(() =>
    assertValid(
      validateJob,
      sampleJob({ country: "Canada", locations: ["Toronto, ON"] }),
      "fixture",
    ),
  );
  assert.throws(() =>
    assertValid(
      validateJob,
      sampleJob({ locations: ["United States — Northeast"] }),
      "fixture",
    ),
  );
  assert.throws(() =>
    assertValid(validateJob, sampleJob({ locations: ["Springfield, ZZ"] }), "fixture"),
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
