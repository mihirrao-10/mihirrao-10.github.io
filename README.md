# mihirrao-10.github.io

Mihir Rao's framework-free personal website. GitHub Pages serves the repository
root from `main`; the production site therefore keeps real directories and
relative links instead of client-side routing.

The Personal Projects section publishes the **New Graduate Job Tracker (2027)**
at [`/new-grad-job-tracker-2027/`](https://mihirrao-10.github.io/new-grad-job-tracker-2027/).
It is a static, generated board of technically relevant U.S. graduate roles
for undergraduate or master's candidates, with documented evidence about
international-hiring support. Search, filtering, application state, and
private notes run entirely in the visitor's browser.

It links to **The Shortest Path Through a Curved World** at
[`/shortest-path-through-a-curved-world/`](https://mihirrao-10.github.io/shortest-path-through-a-curved-world/),
a guided Heat Method story backed by a standalone C++20 CPU geometry engine on
a generated toroidal mesh. That implementation, its exported numerical data,
and its Pages workflow live in the sibling
`shortest-path-through-a-curved-world` repository.

The Personal Projects section also links to **When Every Agent Finds the
Shortcut** at
[`/multi-agent-reinforcement-learning-in-congestion-games/`](https://mihirrao-10.github.io/multi-agent-reinforcement-learning-in-congestion-games/),
an exact atomic Braess-game study with deterministic multi-agent learning
experiments and an interactive Three.js potential landscape. Its Python
analysis, exported story data, web experience, tests, and Pages workflow live
in the sibling `multi-agent-reinforcement-learning-in-congestion-games`
repository.

## Repository layout

```text
index.html  personal-site homepage
assets/     shared static assets
notes/      published course-note PDFs
../new-grad-job-tracker-2027/  tracker UI and generated public JSON
data/job-tracker/              schemas, source configuration, curated records
tools/job-tracker/             collectors, validation, and generator
tests/job-tracker/             data-pipeline and browser-logic tests
dist/       ignored production-build output
```

## Local development

```sh
npm ci
npm run update:jobs:offline
npm test
npm run build
python3 -m http.server 8000 -d dist
```

Run `npm run update:jobs` for a live refresh against the configured official
career pages and ATS feeds. The updater validates and deduplicates records,
preserves first-seen history, and advances verification dates only after a
successful observation. Temporary source failures never close prior jobs.
Detailed scope, evidence, and lifecycle rules are documented in
[`data/job-tracker/README.md`](data/job-tracker/README.md).

The sibling tracker repository owns the scheduled GitHub Actions workflow and
its GitHub Pages deployment. The workflow checks out this repository for the
pipeline, refreshes and validates the three public JSON files each day, runs
the tests and production build, and commits only changed generated data.

## Course notes

`notes/` holds generated PDFs only. The LaTeX sources live in the sibling
`web/course-notes/` project. Do not edit the PDFs here by hand. Run
`make publish` from `course-notes/` to rebuild, verify that course directories,
published PDFs, and homepage links agree, and copy the files here. Adding a
course also requires one `<li>` in the homepage `notes-list`; `make check`
detects missing or extra links.
