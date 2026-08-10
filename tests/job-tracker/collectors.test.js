import assert from "node:assert/strict";
import test from "node:test";

import { collectAshby } from "../../tools/job-tracker/collectors/ashby.js";
import { collectGreenhouse } from "../../tools/job-tracker/collectors/greenhouse.js";
import { collectLever } from "../../tools/job-tracker/collectors/lever.js";
import { collectTikTok } from "../../tools/job-tracker/collectors/tiktok.js";

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

test("TikTok verifies allowlisted official pages and their direct apply links", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(
      `<!doctype html>
        <title>Software Engineer Graduate - Search &amp; Discovery - 2027 Start</title>
        <p>Completing a Bachelor's or Master's degree.</p>
        <p>The base salary range for this position is $121600 - $243200 annually.</p>
        <a href="https://careers.tiktok.com/resume/123456789/apply">Apply</a>`,
      { status: 200, headers: { "content-type": "text/html" } },
    );
  };

  try {
    const jobs = await collectTikTok(
      {
        selection: {
          externalIds: ["123456789"],
        },
      },
      { retries: 0, timeoutMs: 1000 },
    );
    assert.equal(
      jobs[0].title,
      "Software Engineer Graduate - Search & Discovery - 2027 Start",
    );
    assert.equal(
      jobs[0].applicationUrl,
      "https://careers.tiktok.com/resume/123456789/apply",
    );
    assert.equal(jobs[0].compensation, "$121,600–$243,200 base");
    assert.match(requests[0].url, /lifeattiktok\.com\/search\/123456789$/);
    assert.match(
      requests[0].options.headers["User-Agent"],
      /NewGradJobTracker/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
