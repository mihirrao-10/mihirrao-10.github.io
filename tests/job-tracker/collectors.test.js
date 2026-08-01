import assert from "node:assert/strict";
import test from "node:test";

import { collectAshby } from "../../tools/job-tracker/collectors/ashby.js";
import { collectGreenhouse } from "../../tools/job-tracker/collectors/greenhouse.js";
import { collectLever } from "../../tools/job-tracker/collectors/lever.js";

async function withMockFetch(payload, callback) {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await callback(requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("Greenhouse uses the official published board response conservatively", async () => {
  await withMockFetch(
    {
      jobs: [
        {
          id: 123,
          internal_job_id: 456,
          title: "Software Engineer, New Graduate",
          absolute_url: "https://boards.greenhouse.io/example/jobs/123",
          updated_at: "2026-07-31T10:00:00Z",
          location: { name: "New York, NY" },
          content: "<p>Start in 2027</p>",
        },
      ],
    },
    async (requests) => {
      const jobs = await collectGreenhouse(
        { id: "example", boardToken: "example" },
        { retries: 0, timeoutMs: 1000 },
      );
      assert.equal(jobs[0].datePosted, null);
      assert.equal(jobs[0].description, "Start in 2027");
      assert.equal(jobs[0].isProspect, false);
      assert.match(requests[0].url, /boards-api\.greenhouse\.io/);
      assert.match(
        requests[0].options.headers["User-Agent"],
        /NewGradJobTracker/,
      );
    },
  );
});

test("Lever uses official apply URLs, all locations, and EU boards", async () => {
  await withMockFetch(
    [
      {
        id: "lever-123",
        text: "Graduate Software Engineer",
        categories: {
          location: "London, UK",
          allLocations: ["London, UK", "Dublin, Ireland"],
          commitment: "Full-time",
        },
        descriptionPlain: "Start in 2027",
        hostedUrl: "https://jobs.eu.lever.co/example/lever-123",
        applyUrl: "https://jobs.eu.lever.co/example/lever-123/apply",
        workplaceType: "hybrid",
      },
    ],
    async (requests) => {
      const jobs = await collectLever(
        { id: "example", site: "example", instance: "eu" },
        { retries: 0, timeoutMs: 1000 },
      );
      assert.deepEqual(jobs[0].locations, [
        "London, UK",
        "Dublin, Ireland",
      ]);
      assert.match(jobs[0].applicationUrl, /\/apply$/);
      assert.equal(jobs[0].datePosted, null);
      assert.match(requests[0].url, /^https:\/\/api\.eu\.lever\.co\//);
    },
  );
});

test("Ashby falls back to the documented job URL as its stable ID", async () => {
  await withMockFetch(
    {
      jobs: [
        {
          title: "Graduate ML Engineer",
          location: "San Francisco, CA",
          secondaryLocations: [{ location: "New York, NY" }],
          workplaceType: "Hybrid",
          descriptionPlain: "Start in 2027",
          publishedAt: "2026-07-30T10:00:00Z",
          employmentType: "FullTime",
          jobUrl: "https://jobs.ashbyhq.com/example/ashby-123",
          applyUrl: "https://jobs.ashbyhq.com/example/ashby-123/application",
          compensation: { compensationTierSummary: "$130K–$150K" },
        },
      ],
    },
    async () => {
      const jobs = await collectAshby(
        { id: "example", boardName: "example" },
        { retries: 0, timeoutMs: 1000 },
      );
      assert.equal(
        jobs[0].externalId,
        "https://jobs.ashbyhq.com/example/ashby-123",
      );
      assert.deepEqual(jobs[0].locations, [
        "San Francisco, CA",
        "New York, NY",
      ]);
      assert.equal(jobs[0].datePosted, "2026-07-30");
      assert.equal(jobs[0].compensation, "$130K–$150K");
    },
  );
});
