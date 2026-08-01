import assert from "node:assert/strict";
import test from "node:test";

import { dedupeJobs } from "../../tools/job-tracker/lib/dedupe.js";
import {
  canonicalizeUrl,
  jobIdentityKey,
} from "../../tools/job-tracker/lib/url.js";
import { sampleJob } from "./helpers.js";

test("canonical URLs discard fragments and tracking without losing job IDs", () => {
  assert.equal(
    canonicalizeUrl(
      "https://WWW.Example.com/jobs/?utm_source=board&gh_jid=123#apply",
    ),
    "https://example.com/jobs?gh_jid=123",
  );
});

test("identity keys normalize company, title, and sorted locations", () => {
  const left = sampleJob();
  const right = sampleJob({
    company: "EXAMPLE  SYSTEMS",
    title: "Software Engineer - New Graduate 2027",
    locations: ["New York, NY"],
  });
  assert.equal(jobIdentityKey(left), jobIdentityKey(right));
});

test("deduplication catches canonical URL and identity collisions", () => {
  const original = sampleJob();
  const sameUrl = sampleJob({
    id: "manual-example-duplicate-url",
    applicationUrl:
      "https://www.jobs.example.com/jobs/123?utm_campaign=students#apply",
    visaEvidence: {
      level: "Strong",
      explanation:
        "The official posting explicitly says eligible candidates receive sponsorship support.",
      url: "https://jobs.example.com/jobs/123#immigration",
    },
    degreeLevels: ["Undergraduate / Master's"],
  });
  const sameIdentity = sampleJob({
    id: "manual-example-duplicate-identity",
    applicationUrl: "https://apply.example.com/positions/other",
  });
  const result = dedupeJobs([original, sameUrl, sameIdentity]);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.duplicateGroups.length, 2);
  assert.equal(result.jobs[0].visaEvidence.level, "Strong");
  assert.deepEqual(result.jobs[0].degreeLevels, ["Undergraduate / Master's"]);
});
