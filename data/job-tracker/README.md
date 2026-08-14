# Job tracker data maintenance

This directory contains reviewed source data for the public 2027 new-graduate
job tracker. Generated browser data lives under
`../new-grad-job-tracker-2027/data/`; edit the source files here, then run the
updater. Do not hand-edit generated JSON.

## Data schema

`schema/job.schema.json` validates every curated and generated record. A job has:

| Field | Meaning |
| --- | --- |
| `id` | Stable source-derived identifier |
| `company`, `title` | Verified employer and official role title |
| `category` | One of the eight normalized technical categories |
| `applicationUrl` | Official employer or official ATS application destination |
| `sourceUrl`, `sourcePlatform` | Official detail source and its platform |
| `locations`, `country` | U.S. `City, ST` locations and fixed U.S. country |
| `workplaceType` | `Remote`, `Hybrid`, `On-site`, or `Unspecified` |
| `compensation` | Posting-supplied display text, otherwise `null` |
| `datePosted`, `deadline` | Verified ISO dates, otherwise `null` |
| `startPeriod`, `graduationWindow`, `graduationMonths` | 2027-cycle timing eligibility |
| `degreeLevels` | Internal scope marker, fixed to `Undergraduate / Master's` |
| `experienceRequirements` | Concise entry-level requirement summary |
| `visaEvidence` | Level, conservative explanation, and evidence URL |
| `firstSeen`, `lastVerified` | Discovery and most recent successful verification dates |
| `status`, `closedDate`, `missCount` | Lifecycle and conservative removal state |
| `tags` | Searchable, verified technical descriptors |
| `sourceId` | Owning configured or manual source |

The source and metadata formats are validated by `source.schema.json` and
`metadata.schema.json`. Schemas reject unknown fields so typos cannot silently
reach production.

Categories are normalized to:

1. Software Engineering
2. Machine Learning / AI Engineering
3. Data Science / Applied Science / Analytics
4. Quantitative Research
5. Quantitative Trading
6. Quantitative Development
7. Systems / Infrastructure / Performance Engineering
8. Other Technical

## Adding an ATS source

Use an official public Greenhouse, Lever, or Ashby board only.

1. Add a uniquely named source to `sources.json` with its platform identifier:
   `boardToken`, `site`, or `boardName`.
2. Add explicit external job IDs to `selection.externalIds`. Broad include
   patterns are supported, but an allowlist is preferred for this high-accuracy
   board.
3. Supply verified defaults and per-job overrides for location, graduation
   window, undergraduate/master's eligibility, category, compensation, and
   evidence. Every location must use `City, ST`, and only U.S. openings belong
   on this board. A `Strong` evidence statement must be attached per job rather
   than assumed for an entire board.
4. Run `npm run update:jobs`, inspect every selected role, then run
   `npm run check`.

Broad automated collection rejects internship/co-op, PhD/doctoral-only, and
senior/leadership titles, explicit citizenship or clearance requirements,
explicit no-sponsorship text, and clearly stated requirements above two years.
An individually reviewed manual entry may retain an otherwise in-scope role with
an authorization barrier only when it is labeled `Restricted`. Those checks are
guardrails, not a substitute for reading each selected posting.

To support another public ATS, add an isolated adapter under
`tools/job-tracker/collectors/`, map it to the normalized candidate interface,
extend the source schema, and add fixture-based tests. Do not bypass logins,
CAPTCHAs, robots rules, or access controls.

## Adding or correcting a manual role

Use `manual/jobs.json` for official sites without a stable public listing API.

1. Confirm the role page and its Apply control are open and official.
2. Check the title, locations, full-time/entry-level fit, 2027 start or graduation
   window, degree level, experience requirement, and absence of citizenship,
   clearance-only, or no-sponsorship language. Include only U.S. locations and
   normalize each as `City, ST`.
3. Add a complete schema-valid object. Use the current verification date for a
   new record, a stable human-readable ID, and a grouped `manual-*` source ID.
4. Cite the strongest available international-hiring evidence and describe
   exactly what it establishes. Leave unknown fields `null` or `Unspecified`.
5. Run the live updater so the official application URL is probed, then validate
   and inspect the generated output.

## Degree eligibility

This board serves undergraduate and master's candidates without separating the
two groups in the UI. Every record carries the single internal scope value
`Undergraduate / Master's`. A role may also accept PhD candidates, but it belongs
here only when the official requirements independently permit a bachelor's or
master's candidate. PhD-only and doctoral-only roles are out of scope and must
not be retained or archived.

Record only what the official requirements establish. Do not infer bachelor's
or master's eligibility from a generic graduate or research-oriented title.

To correct a record, edit the source object rather than generated JSON. Do not
advance `lastVerified` merely because metadata changed; it represents an actual
successful check. To explicitly close a manually reviewed job, set `status` to
`closed` and record `closedDate`; the next update moves it into the archive.

## Deduplication

Generation canonicalizes application URLs by removing fragments, normalizing
host/ports/trailing slashes, sorting query parameters, and dropping recognized
tracking parameters. It also compares a normalized
company/title/sorted-locations identity. Either match forms a duplicate group;
the generator keeps one canonical record and validation fails if duplicates are
committed to source or public data.

## Evidence review

- `Strong` is appropriate only when the posting or a relevant official company
  page explicitly discusses international consideration, OPT, sponsorship, or
  immigration help.
- `Supported` needs an official published employer recruiting policy for
  eligible international early-career hires when the posting is silent.
- `Historical` needs recent credible public evidence, preferably government data
  or a transparent view of government filings, for comparable technical roles.
- `Restricted` means the official posting states a sponsorship, work-authorization,
  citizenship, clearance, or export-control barrier. These roles remain visible for
  candidates who satisfy that restriction, but the label must be explicit.
- `Unstated` means the official posting does not address sponsorship. Do not infer
  support; candidates should confirm eligibility directly with the employer.

Never turn an application question, aggregator badge, anonymous report, or old
filing into a sponsorship promise. Explain limitations in the record itself.

## Stale and closed rules

The thresholds in `sources.json` currently mark a job stale after seven days
without successful verification and closing soon within seven days of a listed
deadline. Its `timeZone` setting controls the calendar date used for discovery
and verification. A passed deadline closes immediately. A definite missing
response on two successful checks archives the job. Timeouts, rate limits,
invalid responses, and whole-source failures preserve the prior job and
verification date.

Use an exact deadline only when the official posting publishes one. Many ATS
records omit this field; leave it `null` and let the UI advise applicants to
apply early rather than inferring a date from the recruiting cycle.

## Running the updater

```sh
npm ci
npm run update:jobs          # live ATS collection and manual URL probes
npm run update:jobs:offline  # deterministic merge without network calls
npm run validate
npm test
npm run build
```

The scheduled workflow runs the same live sequence daily and can be started from
the GitHub Actions UI. It commits only generated public JSON changes. Review its
per-source result summary whenever a collector fails or returns zero selected
jobs.
