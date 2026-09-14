# Black Geometry implementation log

## 2026-09-14 — baseline

- Read the complete 1,294-line workspace master plan. Work is restricted to this repository; no commit, push, deployment, data refresh, or sibling generator is authorized.
- Repository initially clean at `7f67c3b154cbec6d6e0155dd7ccc3358bce4d70c`. Homepage blob `18dc9ad08f12996d9886c1ca4e863c2462aad8cc` matches the plan. Six sections, two projects, eleven PDFs. README's claim that the tracker is a homepage project is stale.
- Baseline `npm run check`: validation passed (182 active, 7 archived, 69 curated roles, 26 ATS sources), 41 tests passed, static build passed. Build owns only this repository's `dist/`.
- Node 25.9.0 / npm 11.19.0 on macOS. Documented minimum is Node 20.19, matching the installed development dependencies; browser output targets ES2020. Existing workflow stays unchanged.
- In-app Browser skill read; the required Node browser tool is absent from the complete callable-tool inventory. Use standalone local Playwright for the requested browser tests. No remote website content or private documents are uploaded.
- npm's default cache is outside the writable scope; installations use `node_modules/.cache/npm`. Browser downloads will also stay inside `node_modules/.cache/`.

## Architecture decisions

- Keep real HTML, native anchors and serif typography. One small CSS file, dynamic Three.js import, native requestAnimationFrame scheduling. GSAP is unnecessary for interpolation from measured document positions; one clock simplifies suspension and motion policy.
- One renderer: background pass plus, only while visible, a single scissored project pass. Static SVGs use the same deterministic surface parameterization; they remain available before initialization and on failure. No external project data.
- Root Pages assets are generated reproducibly inside `assets/black-geometry/generated/`, then copied by the existing build. Verification compares in memory before writing. Only the owned generated directory is cleaned.
- Sound is a separate lazy module with one explicit-gesture context, a master gain bus, bounded voices and no remembered on state.

## Static foundation and first visual review

- Captured the semantic baseline in `tests/black-geometry/fixtures/content-baseline.json` and SHA-256 hashes of 55 protected files in `protected-baseline.json` before editing HTML. The two project siblings had clean Git states; course-notes is not itself a Git repository.
- Captured desktop/phone baseline screenshots from root and dist under `.artifacts/black-geometry/baseline/`. Browser startup was blocked by the macOS sandbox; narrow, automatically approved browser execution outside that sandbox succeeded.
- Inspected the static desktop/phone hero before integrating WebGL. All original `.entry` text and links matched the baseline. Kept note list/institution grouping intact. Added readable labels beside existing social icons for CDN failure.
- Original geometry uses fixed periodic coefficients and no RNG or external mesh data. The asymmetric opening, broad fold and varying tube cross-section are shared by the static posters and runtime surface.

## Integrated experience and observed refinements

- Implemented the shared renderer, measured section state, six quieter mathematical chapter motifs, two scissored project previews, accessible controls and separate opt-in audio.
- First complete browser review: the phone hero's right edge was cropped too tightly, the footer state was unreachable at maximum scroll, and the surface feature deserved more visual space. Adjusted camera framing/mobile scale, derived the footer's activation from its actual bottom position, and enlarged the project surface.
- Captured and inspected desktop education/industry, research/teaching, surface, both congestion states, notes/footer and phone hero/projects. Reading copy stays over a dark scrim; project art sits beside or below the prose. Observed page heights: 4,872 px at 1440×900 and 5,783 px at 390×844.
- Form labels originally wrapped their select and option text. Browser label lookup exposed the ambiguity; separated the native labels and selects. WebKit audio suspension completes asynchronously, so the browser check waits for actual suspended state. WebKit keyboard link traversal uses Option-Tab, matching Apple's documented Safari behavior. The focused 10-test rerun passed in both engines.
- Renderer import, context initialization, shader compilation and forced context-loss checks all retained the full portfolio. Replay in a failed-renderer state now immediately reveals the finished static state, just as Motion off does.

## Regression and performance evidence

- All 59 Node tests passed (41 unchanged tracker tests, 18 new experience tests). Root/dist parity covers 32 public files, and all 55 protected hashes plus sibling Git states remained unchanged. Read the course-notes Makefile without executing it; its path contract matches all 11 preserved note links and active source directories.
- Chromium headless reports SwiftShader software rendering. At emulated DPR 2 with a 1.5 render cap, its initial p95 frame interval was about 50 ms. Shortened Auto's observation windows to 60 warm-up frames plus two 60-frame windows; a subsequent run downgraded to Low/DPR 1 and measured p95 33.4 ms. Explicit High remains available and is reported separately as slower in this software environment. Phone Low also measured p95 33.4 ms.
- Corrected the contrast measurement to exclude closed disclosure content and foreground underlines from background samples. All 133 sampled visible text rectangles across nine positions passed; minimum observed text contrast was 9.29:1. This is a scoped composited-pixel check, not a blanket accessibility certification.
- Native Chromium touch events scrolled the document by 507 px; touch shortcut selection worked. Controlled visibilitychange testing held frame count at 142 → 142, suspended audio with zero voices, then resumed rendering at 158 while sound stayed off. Physical window minimization under automation continued to report visibility=visible, so that is not claimed as real hidden-tab verification.
- Human listening review is unavailable. Audio lifecycle is tested; perceived loudness/timbre and physical Safari/iPhone use remain explicitly unverified, as allowed by the master plan's bounded-review exception.

## Final audit and handoff

- The first full final browser suite passed all 44 checks in Chromium and WebKit. Opened the required final screenshot set, including reduced-motion, no-JavaScript, failed-context, both project states, notes/footer, six viewport families and zoom/print evidence. No remaining core visual defect was found.
- The final audio audit found that an external context interruption could retain queued voices and require two enable clicks. Cleared voices/master gain on interruption, derived the next toggle from actual state, and guarded obsolete asynchronous requests. Added one meaningful unit test and a real-context browser regression in each engine.
- Regenerated the audio/entry assets after the stale-asset guard correctly rejected them. Final integrated check passed all 60 tests (41 original + 19 new), validation, build, ten generated assets with zero differences, 32-file root/dist parity and 17 local HTML references.
- Final browser run: **46/46 passed**, no skips, both Chromium and WebKit, 1.7 minutes. Full logs/JSON remain in ignored `.artifacts/black-geometry/`.
- Supplemental WebKit 26.6 headless profiling reported Apple GPU with p50 17 ms / p95 18 ms across hero, surface and congestion at capped DPR 1.5. The renderer chunk is unchanged by the final audio fix. Do not confuse the separate Chromium SwiftShader measurements with physical GPU performance.
- Final generated JavaScript is 577,416 raw bytes / 148,412 gzip bytes (disk estimates, not measured transfer). Bundle, contrast, touch, controlled visibility and frame evidence are recorded in the acceptance report.
- Protected-file/sibling/note-contract verification and `git diff --check` pass. Intended generated files are not ignored; `dist/`, dependencies and browser artifacts remain ignored. HEAD is unchanged.
- Wrote `docs/black-geometry/acceptance-report.md` with all BG-01–BG-20 evidence, inspected screenshot links, rubric, measurements, qualified human-review limitations and exact preview commands.
- Stopped both managed local HTTP servers; all browser contexts closed. Nothing committed, pushed or deployed. Remaining human review is listening, physical Safari/iPhone, actual browser UI zoom and a physical background-tab transition.

## 2026-09-14 — authorized publication preparation

- The user subsequently requested committing, pushing and deploying. This supersedes the local-only publishing restriction for the completed implementation above.
- Confirmed GitHub Pages serves public `main` at the repository root. Fast-forwarded the current branch to `6f2e539c2ad80e034099daeddb19424721228964`, preserving twelve upstream scheduled tracker refreshes. The separately existing local `main` branch was not changed.
- Verified 52 original protected hashes and the three refreshed JSON files against current upstream. No tracker refresh or sibling generator was run.
- Replaced the browser test's historical hard-coded role count with the current served dataset count. All 60 Node tests, generated/static builds and root/dist parity pass; all four focused Chromium/WebKit root/dist browser checks pass. No visual/runtime source change was needed for publication.
- Publishing uses the existing current branch plus the Pages `main` branch, with ordinary forward-only pushes. Pre-publication logs are under `.artifacts/black-geometry/reports/publish-*`; the earlier acceptance report remains a dated local-phase snapshot.
