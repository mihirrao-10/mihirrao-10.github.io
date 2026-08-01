import assert from "node:assert/strict";
import test from "node:test";

import {
  candidateIsSelected,
  normalizeSourceCandidate,
  validateSourceSemantics,
} from "../../tools/job-tracker/lib/source-jobs.js";

function source(overrides = {}) {
  return {
    id: "example-greenhouse",
    company: "Example Systems",
    platform: "greenhouse",
    enabled: true,
    boardToken: "example",
    selection: {
      externalIds: ["123"],
      includeTitle: [],
      includeDescription: [],
      exclude: [],
    },
    defaults: {
      country: "United States",
      graduationWindow: "December 2026 through August 2027",
      graduationMonths: ["2026-12", "2027-05", "2027-08"],
      degreeLevels: ["Undergraduate / Master's"],
    },
    visaEvidence: {
      level: "Supported",
      explanation:
        "The official university recruiting policy supports eligible international hires.",
      url: "https://example.com/university/immigration",
    },
    ...overrides,
  };
}

const candidate = {
  externalId: "123",
  title: "Software Engineer, New Graduate 2027",
  applicationUrl: "https://boards.greenhouse.io/example/jobs/123",
  sourceUrl: "https://boards.greenhouse.io/example/jobs/123",
  locations: ["New York, NY"],
  workplaceType: "Hybrid",
  compensation: null,
  datePosted: "2026-07-20",
  description: "For graduates available to start in 2027.",
};

test("an explicit ATS allowlist can select a qualifying role", () => {
  assert.equal(candidateIsSelected(source(), candidate), true);
  const job = normalizeSourceCandidate(source(), candidate, "2026-07-31");
  assert.equal(job.visaEvidence.level, "Supported");
  assert.equal(job.category, "Software Engineering");
  assert.deepEqual(job.degreeLevels, ["Undergraduate / Master's"]);
});

test("source normalization trims ATS title whitespace", () => {
  const job = normalizeSourceCandidate(
    source(),
    { ...candidate, title: "  Software Engineer, New Graduate 2027  " },
    "2026-07-31",
  );
  assert.equal(job.title, "Software Engineer, New Graduate 2027");
});

test("global exclusions override an ATS allowlist", () => {
  assert.equal(
    candidateIsSelected(source(), {
      ...candidate,
      description: "Applicants must be U.S. citizens.",
    }),
    false,
  );
  assert.equal(
    candidateIsSelected(source(), {
      ...candidate,
      title: "Software Engineering Intern",
    }),
    false,
  );
  assert.equal(
    candidateIsSelected(source(), {
      ...candidate,
      title: "Quantitative Researcher, PhD Graduate",
    }),
    false,
  );
  assert.equal(
    candidateIsSelected(source(), {
      ...candidate,
      title: "Machine Learning Engineer, MS/PhD New Graduate",
    }),
    true,
  );
});

test("work authorization language does not imply a citizenship restriction", () => {
  assert.equal(
    candidateIsSelected(source(), {
      ...candidate,
      description:
        "Authorization to work in the U.S. is required. F-1 OPT and STEM OPT candidates may apply.",
    }),
    true,
  );
});

test("Strong evidence must be job-specific rather than a board default", () => {
  const strongDefault = source({
    visaEvidence: {
      level: "Strong",
      explanation:
        "The individual role says sponsorship is available for eligible candidates.",
      url: "https://example.com/jobs/123",
    },
  });
  assert.throws(() => validateSourceSemantics(strongDefault), /board-wide/);

  const jobSpecific = source({
    visaEvidence: undefined,
    overrides: {
      123: {
        visaEvidence: {
          level: "Strong",
          explanation:
            "The individual role says sponsorship is available for eligible candidates.",
          url: "https://example.com/jobs/123",
        },
      },
    },
  });
  assert.doesNotThrow(() => validateSourceSemantics(jobSpecific));
});
