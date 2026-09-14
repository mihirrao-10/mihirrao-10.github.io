# Black Geometry acceptance report

Date: 2026-09-14. Scope: this repository only. **Pre-publication acceptance snapshot.** The implementation phase ended without committing, pushing, or deploying. The user subsequently authorized all three actions.

The integrated check passes **60 Node tests** (41 existing tracker tests and 19 experience tests), and the final browser run passes **46 checks across Chromium and WebKit**. All 20 acceptance gates below pass within the stated review scope. Human listening, physical Safari/iPhone use, and a physical background-tab observation remain bounded verification items; they are not represented as tested.

## Publication follow-up

The publishing checkout was fast-forwarded to upstream main at 6f2e539c2ad80e034099daeddb19424721228964, preserving twelve scheduled tracker refresh commits. All 52 other protected files still match the original baseline; the three refreshed tracker JSON files match upstream exactly. The browser check now derives the role count from the served dataset so scheduled updates remain compatible.

Publication validation passed all 60 Node tests, the build/generated/root-dist checks, and four focused root/dist browser checks across Chromium and WebKit. The unchanged visual runtime retains the earlier 46-check evidence. Local logs are [publish-check.log](../../.artifacts/black-geometry/reports/publish-check.log), [publish-browser.log](../../.artifacts/black-geometry/reports/publish-browser.log) and [publish-preservation.json](../../.artifacts/black-geometry/reports/publish-preservation.json).

The local-only statements, original HEAD and preservation observations below describe the completed implementation phase. They do not restrict the later user-authorized GitHub Pages publication.

## Delivered experience

Mihir Rao's academic serif portfolio retains its identity, black background, six sections, original biography and two project destinations. The hero uses an original asymmetric triangulated surface with a folded opening, dark faces, restrained blue edges, depth and slow bounded movement. Scroll shifts the emphasis through an education trajectory, industry cells, a research neighborhood graph, a teaching traversal, the two project features, and a quieter notes grid that recedes at the footer.

The first project offers an illustrative path replay over the authored surface and explicitly points visitors to the standalone project for computed Heat Method results. The second offers a directed congestion schematic with accessible open/closed shortcut controls and labels its flow as illustrative. Both retain direct native project links.

Index, Display and Sound controls use native elements. The page keeps ordinary scrolling, anchor jumps, browser history and keyboard navigation. Motion off, reduced motion, unavailable WebGL and no JavaScript retain composed static artwork and the full document.

## Baseline and preservation

The worktree was clean at HEAD **7f67c3b154cbec6d6e0155dd7ccc3358bce4d70c**, which remains unchanged. The original homepage blob **18dc9ad08f12996d9886c1ca4e863c2462aad8cc** matched the master plan's inspected source. The local content has six ordered sections, two mathematical project entries and eleven note PDFs. The README's old claim that the tracker was a homepage project was stale and has been corrected; the tracker remains a separate hosted route.

Baseline validation passed for 182 active, 7 archived and 69 manually curated jobs across 26 ATS sources. All 41 original tests and the original static build passed. There was no pre-existing validation, test or build failure.

[The semantic fixture](../../tests/black-geometry/fixtures/content-baseline.json) captures the original identity, entry text, dates, categories, section order and destinations. [The protected fixture](../../tests/black-geometry/fixtures/protected-baseline.json) captures SHA-256 hashes of 55 protected files, including published PDFs, tracker data/code/tests and its workflow. Their final verification passes.

Both mathematical project siblings retain their initial clean Git states. Course-notes is not itself a Git repository. Its Makefile was read without execution, and a read-only comparison confirms the eleven homepage note slugs match its active source directories. No sibling generator, jobs refresh, PDF publication, or master-plan edit was performed.

## Architecture and changed files

The site remains framework-free static HTML. The authored files are:

| Area | Files and responsibility |
| --- | --- |
| Document and styling | [index.html](../../index.html), [black-geometry.css](../../assets/css/black-geometry.css): preserved content, responsive composition, native controls, static and print presentation |
| Runtime | [main.js](../../src/black-geometry/main.js): measured layout, one clock, event lifecycle and controls; [world.js](../../src/black-geometry/world.js): shared Three.js renderer and scenes |
| Pure behavior | [geometry.js](../../src/black-geometry/geometry.js), [scene-state.js](../../src/black-geometry/scene-state.js), [preferences.js](../../src/black-geometry/preferences.js): deterministic surface, chapter/replay state, motion and quality policy |
| Optional audio | [audio.js](../../src/black-geometry/audio.js): lazy explicit context, envelopes, bounded cues, mute/interruption/disposal |
| Build and verification | [build.js](../../tools/black-geometry/build.js), [posters.js](../../tools/black-geometry/posters.js), [verify-site.js](../../tools/black-geometry/verify-site.js), [verify-preservation.js](../../tools/black-geometry/verify-preservation.js) |
| Tests and review | [experience tests](../../tests/black-geometry/), [browser suite](../../tests/black-geometry/browser/homepage.spec.js), [Playwright configuration](../../playwright.config.js), review/diagnostics scripts in tools/black-geometry |
| Setup and documentation | [package.json](../../package.json), package-lock.json, .gitignore, [README](../../README.md), [implementation log](implementation-log.md), this report |

Generated deliverables are the ten files in [assets/black-geometry/generated](../../assets/black-geometry/generated/): a stable entry, three hashed JavaScript chunks, four deterministic SVG posters, an esbuild legal notice and the full Three.js license. These files are present and **not ignored**; they must accompany a later user-authorized commit for root Pages serving. They remain untracked in this local handoff.

The existing static copy build runs after experience generation and supplies the same public assets in dist. The original job-tracker build code, scheduled workflow and three-file data commit allowlist are unchanged. No hosting or routing migration is required. dist, node_modules and local browser evidence remain ignored.

One renderer draws the background and at most one visible scissored project stage. Heavy rendering code loads only when motion is allowed; audio loads on explicit Sound input. Native requestAnimationFrame and interpolation from measured section positions avoid a second animation clock or scroll library. Geometry, materials and listeners are disposed on terminal navigation; context loss enters a stable fallback without automatic retry.

## Commands and results

All commands ran from the repository root on macOS with Node 25.9.0 and npm 11.19.0. The documented minimum is Node 20.19, matching the installed development dependency requirements; Node 20 itself was not separately exercised locally. The existing workflow continues to select Node 20.

| Command/check | Result |
| --- | --- |
| Baseline npm run check | Pass: original validation, 41 tests and static build |
| Dependency installation and npm ls --depth=0 | Pass: Three.js 0.186.0, esbuild 0.28.2, Playwright 1.63.0, parse5 8.0.1; original tracker dependencies retained |
| npm run build:experience | Pass: ten deterministic assets generated; stale owned chunks removed |
| npm run check | Pass: tracker validation, 60 tests, experience/static builds, generated verification and root/dist parity |
| npm run verify:experience | Pass: zero differences, without rewriting output |
| npm run test:browser | Pass: 46/46, no skips or failures, Chromium and WebKit, final duration 1.7 minutes |
| node tools/black-geometry/verify-preservation.js | Pass: 55 hashes, unchanged HEAD and sibling states, eleven unique note links matching active sources |
| Chromium diagnostics.js | Pass: rendered frame sampling, composited contrast, controlled visibility path, touch input and zoom/reflow evidence |
| WebKit profile-webkit.js | Pass: hero and both project frame sampling with reported Apple GPU |
| git diff --check; git status --short; git check-ignore | Pass: no whitespace errors or unrelated changed paths; intended generated files visible to Git; dist, dependencies and evidence ignored |

The final logs are [final-check.log](../../.artifacts/black-geometry/reports/final-check.log), [final-browser.log](../../.artifacts/black-geometry/reports/final-browser.log) and [browser-results.json](../../.artifacts/black-geometry/browser-results.json). After the final audio source edit, the generated-contract test correctly rejected the stale runtime; regeneration resolved it. The rejection is retained in [stale-assets-check.log](../../.artifacts/black-geometry/reports/stale-assets-check.log). No unresolved test failure remains.

The in-app browser skill's required runtime tool was unavailable. Standalone local Playwright provided the browser evidence. The macOS sandbox prevented ordinary browser startup; narrow browser execution outside that sandbox was automatically approved. npm and Playwright caches were kept under node_modules/.cache. Browser tests use the actual production renderer and the read-only ?bg-debug snapshot; there is no alternate test scene.

To reproduce the supplemental measurements while the root preview server is running:

~~~sh
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright node tools/black-geometry/diagnostics.js
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright node tools/black-geometry/profile-webkit.js
~~~

The earlier review.js script uses the installed macOS Google Chrome application; the final browser suite uses the downloaded Chromium/WebKit engines.

## Acceptance gates

| ID | Status | Concrete evidence |
| --- | --- | --- |
| BG-01 | Pass | Initial clean worktree, final Git inspection, unchanged HEAD, 55 protected hashes and sibling-state verification. All authored changes are inside this repository. |
| BG-02 | Pass | Semantic baseline comparison preserves six ordered sections, identity/subtitle, original entry wording, project/contact destinations and eleven note links. Browser content checks pass on root/dist. |
| BG-03 | Pass | Both engines tested with JavaScript disabled: all content, native Index, project destinations and PDF links remain. Inspected no-JS phone screenshots. |
| BG-04 | Pass | Original deterministic surface in geometry.js; inspected enhanced desktop/phone hero with asymmetric opening, dark faces, depth and blue triangulation. |
| BG-05 | Pass | Actual rendered canvas output and nonzero draw calls checked at all nine chapter positions, including research, teaching and footer; reverse jump and restored position checks pass. Continuous bounded camera interpolation has pure tests. |
| BG-06 | Pass | Keyboard replay starts, advances and completes; static/failure replay completes immediately. Screenshot shows surface-following path/endpoints; honest caption and original link remain. |
| BG-07 | Pass | Native shortcut buttons update aria-pressed, live status, edge/flow state and static poster. Both states inspected; schematic caption avoids claiming a training replay. |
| BG-08 | Pass | Default/unrelated input never initializes audio. Explicit enable, mute, reload, navigation, rapid toggling and external context suspension pass. Human listening remains unverified. |
| BG-09 | Pass | OS reduced motion skips the heavy import; OS changes update behavior. Motion off cancels the frame loop and uses posters; replay is immediate. |
| BG-10 | Pass | Auto/Low/High, repeated toggling, one canvas, bounded geometry count and automatic sustained-load downgrade verified. Renderer failure disables unavailable quality control and retains static output. |
| BG-11 | Pass | Skip link, Index, Escape/focus return, keyboard project controls, native hashes/back, PageDown and Chromium native touch events pass. No wheel/touch scroll interception. |
| BG-12 | Pass | Six viewport sizes in both engines have no horizontal overflow. Inspected narrow and zoom/reflow images; 133 composited text samples pass with minimum 9.29:1. Zoom methods are qualified below. |
| BG-13 | Pass | Both engines exercised blocked renderer import, forced context creation failure, shader failure and forced context loss. Full content, links and static artwork persist. |
| BG-14 | Pass | Root port 8000 and dist port 8001 pass resource/route checks; PDFs return actual %PDF bytes. Static verification matches 32 public files and all 17 local HTML references. |
| BG-15 | Pass | Ten generated outputs verified reproducible with zero differences; missing/stale/extra outputs detected without silent writes. Generated assets are not ignored; dist and node_modules are ignored. |
| BG-16 | Pass | Final npm run check passes 60 tests and validation; final browser suite passes 46. Original 41 tests remain intact. |
| BG-17 | Pass | Published PDFs and protected tracker files match all baseline hashes. Tracker keyword/reset/archive controls work in both serving modes. Read-only note publishing path contract passes. |
| BG-18 | Pass | Required screenshot set captured and opened for inspection. Mobile framing, footer activation, project scale and label ambiguity were fixed during review. See evidence and rubric below. |
| BG-19 | Pass | Bundle estimates and measured frame cadence recorded. Auto reduced the observed software-rendering load. Controlled hidden-state testing stops frames/audio; the lack of a physical hidden-tab observation is explicitly recorded. |
| BG-20 | Pass | README, implementation log and this report provide setup, preview, build, maintenance, verification and limitations. Both managed preview servers were stopped. HEAD unchanged; no commit, push or deployment performed. |

## Visual review evidence

All paths below are local ignored evidence under [.artifacts/black-geometry](../../.artifacts/black-geometry/). Required screenshots were opened and inspected, not merely saved. The browser suite also compared real rendered output across chapters. No screen recording was captured.

| Required view | Inspected examples | Observation |
| --- | --- | --- |
| Enhanced desktop hero | [Chromium](../../.artifacts/black-geometry/screenshots/chromium-desktop-top.png), [wide WebKit](../../.artifacts/black-geometry/screenshots/webkit-1920-top.png) | Large silhouette occupies the right side; name/title stay immediately readable. Wide framing intentionally extends the art beyond the right edge. |
| Education/industry | [Education](../../.artifacts/black-geometry/screenshots/chromium-desktop-education.png), [industry](../../.artifacts/black-geometry/screenshots/chromium-desktop-experience.png) | Sparse trajectory and cells sit beside the reading column; dates and institutions retain clear alignment. |
| Research/teaching | [Research](../../.artifacts/black-geometry/screenshots/chromium-desktop-research.png), [teaching](../../.artifacts/black-geometry/screenshots/chromium-desktop-teaching.png) | Neighborhood/traversal motifs remain quiet; courses and biography are not obscured. |
| Surface project | [Completed replay](../../.artifacts/black-geometry/screenshots/chromium-surface-finished.png) | Path sits on the visible surface with distinct endpoints; direct link, caption and keyboard focus are clear. |
| Congestion project | [Open](../../.artifacts/black-geometry/screenshots/chromium-desktop-project-congestion.png), [closed](../../.artifacts/black-geometry/screenshots/chromium-congestion-closed.png) | Node labels remain attached and readable; removal of the middle edge and outer-route flow are apparent. |
| Notes/footer | [Notes](../../.artifacts/black-geometry/screenshots/webkit-desktop-notes.png), [footer](../../.artifacts/black-geometry/screenshots/webkit-desktop-contact.png) | Institution grouping and all links remain; grid recedes and footer is reachable at the real document end. |
| Mobile hero/projects | [Hero](../../.artifacts/black-geometry/screenshots/webkit-390-top.png), [surface](../../.artifacts/black-geometry/screenshots/webkit-390-project-surface.png), [network](../../.artifacts/black-geometry/screenshots/webkit-390-project-congestion.png) | Art is reframed below text; controls and captions follow naturally in document flow. At 320 px the subtitle wraps cleanly to two lines. |
| Reduced/static | [Hero](../../.artifacts/black-geometry/screenshots/chromium-reduced-hero.png), [surface](../../.artifacts/black-geometry/screenshots/chromium-reduced-surface.png) | Same visual identity without an active renderer; completed route remains visible. |
| Failed/no-JS | [Context loss](../../.artifacts/black-geometry/screenshots/webkit-failure-context.png), [no-JS projects](../../.artifacts/black-geometry/screenshots/webkit-no-js-projects.png) | Composed art and original information remain without broken controls or blank stages. |
| Additional review | [Blocked fonts/icons](../../.artifacts/black-geometry/screenshots/webkit-blocked-fonts.png), [focus](../../.artifacts/black-geometry/screenshots/webkit-keyboard-focus.png), [zoom reflow](../../.artifacts/black-geometry/screenshots/zoom-200-reflow.png), [print](../../.artifacts/black-geometry/screenshots/webkit-print.png) | Text labels survive icon failure; focus is visible; zoom remains readable; print uses dark text on white. |

Baseline root/dist desktop/phone images remain in [baseline](../../.artifacts/black-geometry/baseline/); static foundation images and the first integrated [review](../../.artifacts/black-geometry/review/) are also retained. Final viewport families cover 320×740, 390×844, 768×1024, 1024×768, 1440×900 and 1920×1080 in both engines. Measured document heights were 4,872 px at desktop 1440×900 and 5,783 px at phone 390×844.

The focused visual cycle corrected a tightly cropped mobile hero, an unreachable footer state, and an undersized surface feature. A later capture waited for the initial poster fade to finish so the hero evidence showed the settled enhanced state. Native labels were separated from select option text after browser checks exposed ambiguous labeling.

Self-review scores are subjective and tied to the inspected output:

| Dimension | Score / 5 | Observation |
| --- | --- | --- |
| Identity | 5 | Academic serif hierarchy, content and restrained black/blue palette remain recognizably Mihir's portfolio. |
| Hero | 4 | Asymmetric surface and dark shaded depth create a strong silhouette; no extra effect is needed. |
| Continuity | 4 | Measured section transitions, shared graph structure and reverse/restored scrolling stay coherent. Evidence includes state/frame checks and stills, not a motion recording. |
| Restraint | 5 | Reading sections are quiet; visual emphasis rises at the hero and projects. |
| Project relevance | 5 | Surface path and directed shortcut diagram relate directly to the two actual projects, with honest preview labels. |
| Typography | 4 | Comfortable reading measure, preserved hierarchy and deliberate narrow wrapping; fallback serif also remains readable. |
| Interaction | 4 | Native links, keyboard focus, disclosures and project controls work predictably. |
| Mobile | 4 | Smaller surface framing and stacked project composition work across tested widths; physical iPhone review remains open. |
| Fallback | 4 | Original static artwork retains the composition without a renderer. |
| Audio | 3, provisional | Silence by default and event/lifecycle behavior verified. Pleasantness, loudness and timbre are not scored as listened-to. |

## Bundle and rendering measurements

[Bundle sizes](../../.artifacts/black-geometry/reports/bundle-sizes.json) are exact emitted file sizes. **Gzip is a disk compression estimate, not observed transfer.** The local Python server did not supply those compressed transfers.

| Asset | Raw bytes | Gzip estimate, bytes |
| --- | ---: | ---: |
| Entry main.js | 9,068 | 4,008 |
| Shared chunk | 989 | 554 |
| Lazy world/Three.js chunk | 565,741 | 143,051 |
| Lazy audio chunk | 1,618 | 799 |
| All JavaScript | 577,416 | 148,412 |
| Four SVG posters | 464,721 | 40,596 |
| Authored CSS | 15,172 | 3,737 |
| HTML | 14,861 | 3,751 |

No downloaded mesh, texture, video or audio asset is required. Third-party license files are included separately.

Measured rendered-frame intervals used 150 samples per case, after warm-up, with emulated device scale 2. These are local frame-cadence observations, not GPU timing or a universal device benchmark. [Chromium diagnostics](../../.artifacts/black-geometry/reports/diagnostics.json) and [WebKit measurements](../../.artifacts/black-geometry/reports/webkit-performance.json) include full snapshots.

| Engine/environment | View and policy | Render DPR | p50 / p95 interval |
| --- | --- | ---: | --- |
| Chromium 153.0.8010.12, headless, ANGLE SwiftShader software renderer | 1440×900 hero, Auto settled to Low | 1 | 33.3 / 33.4 ms |
| Same Chromium software renderer | 1440×900 hero, explicit High | 1.5 | 49.9 / 50.0 ms |
| Same Chromium software renderer | 390×844 hero, Low | 1 | 33.3 / 33.4 ms |
| WebKit 26.6, headless, reported Apple GPU | 1440×900 hero, Auto/medium | 1.5 | 17 / 18 ms |
| Same WebKit environment | Surface project, Auto/medium | 1.5 | 17 / 18 ms |
| Same WebKit environment | Congestion project, Auto/medium | 1.5 | 17 / 18 ms |

WebKit observed 5, 7 and 26 draw calls for hero, surface and congestion respectively. No exact physical GPU model is inferred from the reported Apple GPU label. These measurements use the unchanged current world-B4DZOE4O.js rendering chunk; the last subsequent runtime edit concerns audio interruption handling only.

The initial software-rendering observation showed about 50 ms p95 before Auto had completed its assessment. Auto now uses 60 warm-up frames and two 60-frame windows to detect sustained p95 above 33 ms, then remains downgraded for that visit. Low caps DPR at 1 and targets 30 fps. Narrow/modest devices start with the conservative profile. Explicit High is still available, with the measured software cost reported honestly.

## Controls, lifecycle and review limits

Motion System respects OS changes; explicit On overrides for the current visit, and Off/quality can persist through guarded namespaced storage. Missing, malformed and denied storage pass regression tests. Static modes stop the render loop and make replay immediate. Repeated quality/motion changes keep one renderer and bounded resources.

Sound stays off on every load, reload and return from navigation. Only explicit Sound input initializes/resumes the context. Short original sine cues accompany project controls and a deliberate replay completion, with a 180 ms cooldown and at most four voices. Mute, page suspension and external audio interruption clear voices. The final regression confirms one explicit click can re-enable after external suspension; obsolete asynchronous toggles cannot overwrite a newer request. Resume rejection has a truthful off state.

In the controlled visibility test, document.hidden and a visibilitychange event drove the production lifecycle: frame count stayed **142 → 142**, pendingFrame was false, audio was suspended with zero voices, and return resumed frames to 158 with sound still off. Frame delta is capped at 0.05 seconds. Bringing other windows forward and minimizing the automated browser continued to report visible, so a real physical hidden-tab transition was **not verified**. Actual navigation to the tracker and back was tested in both engines and restored the teaching scroll position silently.

Native Chromium CDP touch events scrolled by 507 px and selected the closed shortcut. Both engines tested CSS root zoom at 200%; an additional 720×450 CSS viewport at DPR 2 provided a 1440×900 equivalent reflow image. Direct physical browser UI zoom was not verified. Composited contrast sampling excluded closed disclosure content and removed foreground text/underlines before sampling the scene behind 133 visible text rectangles; minimum observed contrast was 9.29:1. This scoped check is not a blanket accessibility certification.

WebKit automation is engine coverage, not an actual Safari application or physical iPhone test. Its link traversal test uses Option-Tab, consistent with [Apple's Safari keyboard documentation](https://support.apple.com/guide/safari/keyboard-shortcuts-and-gestures-cpsh003/mac). Human audio monitoring was unavailable: perceived loudness and timbre remain **unverified**. The master plan explicitly permits these bounded human review items.

## Handoff

No core implementation blocker remains. Optional bloom, ambient music, chapter sounds, cursor halo, grain and free object rotation were omitted to preserve restraint and keep the native document simple. No extra project, synthetic research result or heavyweight sibling computation was introduced.

Both managed HTTP servers were stopped after verification; browser contexts were closed. All intended changes remain in the working tree for review.

For the current local preview:

~~~sh
cd "/Users/mihirrao/Documents/Personal Projects/web/personal-website"
python3 -m http.server 8000 --bind 127.0.0.1
~~~

Open [the local homepage](http://127.0.0.1:8000/). In a second terminal, from the same directory, serve the already-verified build with:

~~~sh
python3 -m http.server 8001 --bind 127.0.0.1 -d dist
~~~

The next human review is to scroll through the two projects in Safari, try Motion off, explicitly enable Sound and listen at an ordinary volume, then switch tabs and confirm the return stays silent. Physical iPhone and browser UI zoom checks can be done in that same review. No publishing command is required or authorized for this handoff.
