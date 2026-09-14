# mihirrao-10.github.io

Mihir Rao's framework-free personal website. GitHub Pages serves the repository
root from `main`; the production site therefore keeps real directories and
relative links instead of client-side routing.

The repository also hosts the **New Graduate Job Tracker (2027)**
at [`/new-grad-job-tracker-2027/`](https://mihirrao-10.github.io/new-grad-job-tracker-2027/).
The homepage has two mathematical project features; the tracker is a separate hosted route.
It is a static, generated board of technically relevant U.S. graduate roles
for undergraduate or master's candidates, with documented evidence about
international-hiring support. Search, filtering, application state, and
private notes run entirely in the visitor's browser.

It links to **The Shortest Path Through a Curved World** at
[`/shortest-path-through-a-curved-world/`](https://mihirrao-10.github.io/shortest-path-through-a-curved-world/),
a guided Heat Method story backed by a standalone C++20 CPU geometry engine on
generated meshes with one to three handles. That implementation, its exported
numerical data, and its Pages workflow live in the sibling
`shortest-path-through-a-curved-world` repository.

The Personal Projects section also links to **When Every Agent Finds the
Shortcut** at
[`/multi-agent-reinforcement-learning-in-congestion-games/`](https://mihirrao-10.github.io/multi-agent-reinforcement-learning-in-congestion-games/),
an exact atomic Braess congestion game study with deterministic learning
experiments involving multiple agents and an interactive Three.js potential
landscape. Its Python analysis, exported story data, web experience, tests, and
Pages workflow live in the sibling
`multi-agent-reinforcement-learning-in-congestion-games` repository.

## Repository layout

```text
index.html  personal-site homepage
assets/     shared static assets
notes/      published book-note and course-note PDFs
new-grad-job-tracker-2027/     tracker UI and generated public JSON
data/job-tracker/              schemas, source configuration, curated records
tools/job-tracker/             collectors, validation, and generator
tests/job-tracker/             data-pipeline and browser-logic tests
dist/       ignored production-build output
```

## Local development

```sh
npm ci
npm run check
python3 -m http.server 8000 --bind 127.0.0.1
# In a second terminal, inspect the production copy:
python3 -m http.server 8001 --bind 127.0.0.1 -d dist
```

Run `npm run update:jobs` for a live refresh against the configured official
career pages and ATS feeds. The updater validates and deduplicates records,
preserves first-seen history, and advances verification dates only after a
successful observation. Temporary source failures never close prior jobs.
Detailed scope, evidence, and lifecycle rules are documented in
[`data/job-tracker/README.md`](data/job-tracker/README.md).

This repository owns the scheduled GitHub Actions refresh and GitHub Pages
deployment. The workflow refreshes and validates the three public JSON files
each day, runs the tests and production build, and commits only changed
generated data. The standalone tracker repository remains a private working
copy; the public static mirror lives here so Pages can serve it at the website
subpath without changing that repository's visibility.

## Personal notes

`notes/` holds generated PDFs only. Book- and course-note LaTeX sources live in
the sibling `web/course-notes/` project. Do not edit the PDFs here by hand. Run
`make publish` there to rebuild, verify that active source directories,
published PDFs, and homepage links agree, and copy the files here. Each note
set also requires one `<li>` in the homepage `notes-list`; `make check` detects
missing or extra links.

## Black Geometry homepage

The homepage remains real HTML with STIX Two Text, native anchor navigation, and
all biography/project/note content available without JavaScript. An original
procedural folded surface and sparse geometric chapters enhance the reading
experience. The two project stages use an illustrative surface path and a
directed congestion schematic. Neither runs or reproduces the sibling studies.

The header's **Index** links to all six sections. **Display** provides Motion
(System preference, On, Off) and Quality (Auto, Low, High). System reduced motion
and Motion off use static SVG artwork and stop rendering. An explicit On override
lasts for the current visit; Off and quality preferences may persist. Denied or
malformed storage falls back safely. Auto uses simpler geometry on narrow/modest
devices and downgrades after sustained slow frames; it never oscillates between
profiles. Low targets 30 fps with DPR capped at 1; other profiles cap DPR at 1.5.

**Sound off** is the default on every load. Only that control initializes audio.
Optional, short synthesized cues accompany explicit project controls and a
deliberate path replay's completion. No music or ambient loop is downloaded.
Mute and a hidden/navigated-away page suspend audio; returning stays silent until
another explicit Sound gesture. Motion and sound are independent.

One Three.js renderer uses one background pass and at most one visible project
pass. The scene derives from measured HTML positions, so native hashes, reverse
scrolling and restored positions work. Renderer import/initialization/shader
failure and context loss keep the complete static page; context loss deliberately
does not attempt an automatic restart. Print removes controls/art and uses white
paper with dark text.

### Build and maintenance

Use Node 20.19+ (the scheduled Node 20 workflow resolves a compatible release).
Runtime source is in `src/black-geometry/`, styling in
`assets/css/black-geometry.css`, and bundling/static-poster generation in
`tools/black-geometry/`. Dependencies are pinned in `package-lock.json`.

```sh
npm run build:experience      # update browser assets after editing the experience
npm run verify:experience     # compare generated content without rewriting files
npm run test:experience       # pure state, audio, content and build contracts
npm run check                # tracker validation + all unit tests + build + parity

# Browser binaries are optional and are not needed by the scheduled job refresh.
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright npx playwright install chromium webkit
npm run test:browser          # serves root/dist on 8000/8001 if not already running
```

`assets/black-geometry/generated/` must be included in an ordinary later user
commit because Pages serves the repository root. esbuild emits a stable entry,
hashed dynamic chunks, and license notices there; the procedural SVGs share the
runtime surface definition. Builds write only changed files and delete stale
files only within that owned directory. `dist/` is produced afterwards by the
existing static copy build and remains ignored, as do `node_modules/` and browser
evidence under `.artifacts/`. The workflow's three-file tracker commit allowlist
is unchanged. A build alone does not publish homepage changes.

The preservation fixture captures the local pre-redesign semantic content, not
whitespace or layout. Update it only for a deliberate content edit. The separate
`node tools/black-geometry/verify-preservation.js` check records the original local
implementation session's HEAD, PDFs/tracker files and sibling states. It is an
archival check outside the normal suite: later commits and authorized job refreshes
deliberately no longer match that snapshot. Use `npm run check` for ongoing validation.

For local diagnostics, append `?bg-debug` to the homepage. The read-only
`window.__blackGeometry.snapshot()` reports production scene state, frame counts,
draw calls, quality and audio lifecycle. It does not change rendering or expose
private data. Browser tests use this observation hook and real production code.

See [implementation log](docs/black-geometry/implementation-log.md) and
[acceptance report](docs/black-geometry/acceptance-report.md) for evidence,
screenshots, measured limits and the local-only handoff.
