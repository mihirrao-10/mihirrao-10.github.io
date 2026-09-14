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
all biography/project/note content available without JavaScript. Its central
faceted sculpture changes with individual entries: a white-and-green three-crest
surface with a computed red gradient-ascent trace, wider translucent Harper
Memorial Library in maroon, an original navy-and-gold dragon, an independently
reconstructed MATLAB membrane, a red-and-blue trefoil ribbon for Resolution
Life, and a square-root Riemann-surface projection for notes. A connected folded
scaffold organizes the same mesh between the different target topologies.
Teaching courses and awards sit within the corresponding Education entries.

The two project sculptures use prepared results from the actual studies: the
complete genus-two mesh and computed Heat Method route, and the N=100 Rosenthal
potential landscape. The homepage does not run either numerical solver. Project
captions distinguish the computed route, exact best-response path, and feasible
two-route boundary. See the provenance documents for licenses and extraction.

**Menu** combines native section navigation with Motion and Quality settings.
System reduced motion and Motion off use contextual SVGs generated from the
same target meshes and stop rendering. Explicit Motion on lasts for the visit;
Off and quality choices may persist. Low preserves the same sculptures, caps
DPR at 1 and targets 30 fps; other profiles cap DPR at 1.5 and target 60 fps. Auto
can downgrade after sustained slow frames and never oscillates between profiles.

**Sound off** is the fresh-load default. Only this control constructs/resumes an
AudioContext, directly within its gesture. Enabling sound produces a short
confirmation, then identity changes and project controls produce restrained
synthesized cues. A compressor and bounded envelopes control output. Hidden
pages are silent; suspended context state and the retained opt-in are reported
separately, without queued transition bursts. Motion and sound are independent.

One Three.js context renders one transported mesh, plus the visible paths and
context outlines. A slow camera ellipse keeps each sculpture centered. Native
scrolling stays immediate while the artwork follows with 140ms exponential
damping; quintic transitions and gentle opacity fades work in both directions.
Expensive target authoring, spatial correspondence and subdivision happen at
build time. The browser fetches a prepared compressed packet and retains only
the active source/destination and shared folded scaffold as geometry buffers.
Native hashes, reverse scrolling, and restored positions use measured DOM
anchors. Failed imports/assets/rendering and context loss retain complete HTML
and context-specific artwork. Print uses dark text on white paper.

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
hashed dynamic chunks, and license notices there; the static SVGs use the same
authored target geometry as the runtime packet. Builds write only changed files and delete stale
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

See the [refinement report](docs/black-geometry/refinement-report.md) for the current
visual and content revision. The [implementation log](docs/black-geometry/implementation-log.md),
[acceptance report](docs/black-geometry/acceptance-report.md), and
[revision report](docs/black-geometry/revision-report.md) retain historical evidence
from the earlier passes.
