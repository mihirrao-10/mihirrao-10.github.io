# mihirrao-10.github.io

Mihir Rao's framework-free personal website. GitHub Pages serves the repository
root from `main`; the production site therefore keeps real directories and
relative links instead of client-side routing.

The site includes the public **New Graduate Job Tracker (2027)** at
[`/new-grad-job-tracker-2027/`](https://mihirrao-10.github.io/new-grad-job-tracker-2027/).
It is a static, generated job board for technically relevant, U.S.-based 2027
graduate roles with documented evidence that international candidates may be
considered. The board is limited to roles open to undergraduate or master's
candidates. Visitors can search and filter by category, company, and their
browser-local applied state; exact `City, ST` locations remain visible on every
listing.

It also links to **The Shortest Path Through a Curved World** at
[`/shortest-path-through-a-curved-world/`](https://mihirrao-10.github.io/shortest-path-through-a-curved-world/),
a guided Heat Method story backed by a standalone C++20 CPU geometry engine
on a generated toroidal mesh.
That implementation, its exported numerical data, and its Pages workflow live
in the sibling `shortest-path-through-a-curved-world` repository.

## Repository layout

```text
index.html                              personal-site homepage
assets/                                 shared static assets
notes/                                  published course-note PDFs
../new-grad-job-tracker-2027/           tracker page, styles, browser logic, public JSON
data/job-tracker/                       schemas, ATS source config, curated source data
tools/job-tracker/                      collectors, normalization, validation, generator
tests/job-tracker/                      focused Node tests
.github/workflows/update-job-tracker.yml  daily and manual updater
dist/                                   ignored production-build output
```

The tracker intentionally has no database, authentication layer, analytics
dependency, or paid API. A visitor's binary applied state and private notes are
kept only in that browser's `localStorage`; the page can export JSON/CSV and
restore a JSON backup. Existing multi-status browser data is migrated
conservatively to applied or not applied.

## Local development

Node.js 20 or newer is required for the data tooling.

```sh
npm ci
npm run update:jobs:offline
npm test
npm run build
python3 -m http.server 8000 -d dist
```

From the `web/` directory, open `http://localhost:8000/new-grad-job-tracker-2027/`. The offline updater
merges and validates the checked-in source data without contacting job sites.
To perform live verification against public endpoints, run:

```sh
npm run update:jobs
```

Other useful commands:

```sh
npm run validate   # schemas, semantic checks, metadata counts, duplicates
npm test           # normalization, dedupe, lifecycle, filters, local tracking
npm run build      # validate and copy the deployable static tree to dist/
npm run check      # validate, test, and build
```

## Tracker data and update architecture

The browser reads three generated files:

- `../new-grad-job-tracker-2027/data/jobs.json` — active, closing-soon, and stale jobs
- `../new-grad-job-tracker-2027/data/archive.json` — confirmed closed jobs
- `../new-grad-job-tracker-2027/data/metadata.json` — counts, last successful run,
  thresholds, and per-source results

`data/job-tracker/sources.json` contains conservative allowlists for public
Greenhouse, Lever, and Ashby boards. Collectors use those official JSON
endpoints, a descriptive user agent, two concurrent requests, 12-second
timeouts, and bounded retries. Source-specific code is isolated under
`tools/job-tracker/collectors/`; one failing source does not abort the update or
close its jobs.

Calendar dates use the configured `America/New_York` timezone, matching this
site's maintenance context even when GitHub's runner clock is already on the
next UTC day.

Sites without a reliable public endpoint are represented in
`data/job-tracker/manual/jobs.json`. The updater probes each official application
URL but keeps the human-verified title, requirements, and evidence. An
aggregator can be used to discover a role, but never becomes its application or
international-evidence source.

During generation the updater validates input, normalizes fields, deduplicates
canonical application URLs and normalized company/title/location identities,
preserves `firstSeen`, and advances `lastVerified` only after a successful live
observation. Schema and semantic checks reject non-U.S. records and locations
that are not normalized as `City, ST`. It never treats a timeout, rate limit, or
source failure as proof that all jobs closed.

Detailed schema and maintenance instructions are in
[`data/job-tracker/README.md`](data/job-tracker/README.md).

## Job lifecycle

- **Active:** successfully verified within the last seven days.
- **Closing soon:** verified and its listed deadline is within seven days.
- **Not recently verified:** more than seven days have elapsed since successful
  verification; the listing remains visible but is clearly marked stale.
- **Closed:** the deadline passed, the curated record was explicitly closed, or
  an automated/application source returned a definite missing response on two
  successful update runs. Closed records move to the archive instead of being
  deleted.

A temporary network error preserves the prior status, miss counter, and
`lastVerified` date.

## International-hiring evidence

Every published job must have one of these evidence levels and a source URL:

- **Strong:** the exact posting or a relevant official company page explicitly
  discusses international-candidate consideration, OPT, sponsorship, or
  immigration support.
- **Supported:** an official company recruiting policy describes support for
  eligible international early-career hires, but the job itself is silent.
- **Historical:** recent, credible public records show comparable employer
  sponsorship; this says nothing definitive about the current job.

Historical sponsorship is not a company policy. A general company policy is not
a guarantee for an individual role. Even job-specific language is subject to
candidate, role, location, and legal eligibility. The tracker makes no
immigration or legal guarantee; applicants must re-read the current official
posting and confirm with the employer.

## Scheduled updates

`.github/workflows/update-job-tracker.yml` runs at 09:23 UTC each day and also
supports `workflow_dispatch`. It installs locked dependencies, fetches sources,
validates and deduplicates data, runs all tests, and performs a production build.
Only the three generated public JSON files are staged, and the bot commits and
pushes only when those files differ. No secrets or paid services are needed.

The repository must allow GitHub Actions read/write access for the bot commit.
Branch protection must also permit the workflow's push, or the final step will
need to be changed to a pull-request workflow.

## Deployment

GitHub Pages currently publishes the root of `main`. The tracker is a real
subdirectory, so direct navigation and refreshes work without a SPA fallback.
`npm run build` verifies the exact static tree in `dist/`, while Pages continues
to publish the checked-in source tree. A reviewed push to `main` deploys both the
homepage project link and the tracker; no separate hosting project is required.

## Known limitations

- Some employers do not expose stable public APIs. Those listings require human
  review; an HTTP success only confirms that the official page responds.
- ATS fields are inconsistent, so compensation, workplace type, dates, and
  deadlines remain blank rather than being inferred.
- Degree eligibility is an internal scope guard: every record must accept
  undergraduate or master's candidates, and PhD-only roles are rejected.
- Public ATS formats, career URLs, immigration policies, and legal eligibility
  can change without notice.
- Source allowlists intentionally favor accuracy over breadth and must be
  revisited as each recruiting cycle changes.

## Course notes

`notes/` holds generated PDFs only. The LaTeX sources live in the sibling
`web/course-notes/` project. Do not edit the PDFs here by hand. Run
`make publish` from `course-notes/` to rebuild, verify that course directories,
published PDFs, and homepage links agree, and copy the files here. Adding a
course also requires one `<li>` in the homepage `notes-list`; `make check`
detects missing or extra links.
