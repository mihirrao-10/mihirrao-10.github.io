import {
  readPreferences, savePreferences, motionPolicy, qualityPolicy, QUALITY, assessPerformance,
} from "./preferences.js";
import {
  chapterState, cameraPose, createProjectState, startReplay, advanceReplay, chooseShortcut,
} from "./scene-state.js";
import { createAudio } from "./audio.js";

const body = document.body;
const container = document.querySelector(".world");
const poster = document.querySelector("#sculpture-poster");
let storage;
try { storage = window.localStorage; } catch {}
const preferences = readPreferences(storage);
const system = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(pointer: fine)");
const motionControl = document.querySelector("#motion-setting");
const qualityControl = document.querySelector("#quality-setting");
const soundControl = document.querySelector("#sound-toggle");
const soundStatus = document.querySelector("#sound-status");
const displayStatus = document.querySelector("#display-status");
const disclosures = [...document.querySelectorAll(".header-controls details")];
const sceneElements = [...document.querySelectorAll("[data-scene]")];
const listeners = new AbortController();
const on = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: listeners.signal });
const debug = new URLSearchParams(location.search).has("bg-debug");
let motion = motionPolicy(preferences.motion, system.matches);
let world, worldImport, enhancementPending, audio;
let failed = false, disposed = false, active = !document.hidden;
let frame = 0, syncFrame = 0, lastFrame = 0, time = 0, lastDelta = 0;
let scrollY = window.scrollY, width = innerWidth, height = innerHeight, layoutDirty = true;
let ranges = [], pointer = [0, 0], pointerTarget = [0, 0];
let state = chapterState(0, []), project = createProjectState();
let lastChapter, lastPoster, lastAudioTarget, settledAudioTarget, settledSince = 0;
let suppressNextAudio = true;
let downgraded = false, samples = [], slowWindows = 0, warmup = 0;
let profile = qualityPolicy(preferences.quality, { width, cores: navigator.hardwareConcurrency });
body.dataset.enhanced = "true";

function updateDisplay() {
  body.dataset.motion = motion;
  displayStatus.textContent = failed ? "Animation unavailable. Static artwork is shown."
    : motion === "reduced" ? "Reduced motion. Static artwork is shown."
      : motion === "off" ? "Motion off. Static artwork is shown."
        : "Motion on.";
}
function soundChanged(result) {
  const { wanted = false, state: audioState = "off", enabled = false } = typeof result === "boolean"
    ? { wanted: result, enabled: result, state: result ? "running" : "off" } : result;
  const starting = audioState === "initializing";
  soundControl.setAttribute("aria-pressed", String(wanted && !starting && audioState !== "unavailable"));
  soundControl.setAttribute("aria-busy", String(starting));
  soundControl.lastElementChild.textContent = starting ? "Starting sound…"
    : enabled ? "Sound on" : wanted ? "Sound paused" : "Sound off";
  soundStatus.textContent = audioState === "unavailable" ? "Sound is unavailable. Try the Sound control again."
    : wanted && !starting && !enabled ? "Sound is paused." : "";
}
function identity(target) {
  return ({ harper: "uchicago", dragon: "drexel", membrane: "mathworks" })[target] || target;
}
function showStatic(reason = "static") {
  cancelAnimationFrame(frame);
  frame = 0;
  lastFrame = 0;
  body.dataset.experienceState = reason;
  updateScene();
}
function fail(error) {
  failed = true;
  showStatic("fallback");
  world?.dispose();
  world = undefined;
  qualityControl.disabled = true;
  updateDisplay();
  if (debug) console.warn("Sculpture fallback:", error?.message || error);
}
function measure() {
  width = innerWidth;
  height = innerHeight;
  scrollY = window.scrollY;
  // On small screens the reading area begins below the fixed sculpture.
  // All anchors come from real entry positions, including after font/layout changes.
  const art = container.getBoundingClientRect();
  const stacked = width < 800 && art.left < 1;
  const focus = stacked ? art.bottom + (height - art.bottom) * 0.2 : height * 0.34;
  const end = Math.max(1, document.documentElement.scrollHeight - height);
  let previous = -1;
  ranges = sceneElements.map((element, index) => {
    const rect = element.getBoundingClientRect();
    let start = index === 0 ? 0 : Math.max(previous + 1, rect.top + scrollY - focus);
    if (element.dataset.scene === "contact") start = Math.max(previous + 1, Math.min(start, end - Math.min(100, height * 0.12)));
    previous = start;
    return { id: element.dataset.scene, target: element.dataset.target, start, end };
  });
  const next = qualityPolicy(preferences.quality, { width, cores: navigator.hardwareConcurrency, downgraded });
  if (next !== profile) {
    profile = next;
    world?.setQuality(profile);
    samples = [];
    warmup = 0;
  }
  world?.resize(width, height, devicePixelRatio);
  layoutDirty = false;
  updateDisplay();
}
function updateScene() {
  state = chapterState(scrollY, ranges);
  if (lastChapter !== state.chapter) {
    lastChapter = state.chapter;
    body.dataset.chapter = state.chapter;
    document.querySelectorAll(".index-links a").forEach((link) => {
      if (link.hash === `#${state.section}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  const visibleTarget = state.blend >= 0.5 ? state.nextTarget : state.target;
  body.dataset.sculpture = visibleTarget;
  const posterTarget = visibleTarget === "congestion" && project.shortcut === "closed"
    ? "congestion-closed" : visibleTarget;
  if (lastPoster !== posterTarget) {
    lastPoster = posterTarget;
    poster.src = `assets/black-geometry/generated/sculpture-${posterTarget}.svg`;
  }
}
function updateAudio(now) {
  const presented = state.blend > (motion === "full" && !failed ? 0.08 : 0.5) ? state.nextTarget : state.target;
  if (suppressNextAudio) {
    lastAudioTarget = settledAudioTarget = presented;
    settledSince = now;
    suppressNextAudio = false;
    return;
  }
  if (presented !== lastAudioTarget) {
    if (lastAudioTarget) audio?.cue("transition", identity(presented));
    lastAudioTarget = presented;
    settledAudioTarget = undefined;
    settledSince = now;
  }
  const settled = state.blend < 0.01 && state.target === presented;
  if (!settled) settledSince = now;
  if (settled && settledAudioTarget !== presented && now - settledSince > 220) {
    audio?.cue("settle", identity(presented));
    settledAudioTarget = presented;
  }
}
function draw(now) {
  frame = 0;
  if (disposed || !active || document.hidden || motion !== "full" || !world || failed) return;
  if (layoutDirty) measure();
  const elapsed = lastFrame ? now - lastFrame : 0;
  if (lastFrame && elapsed < 1000 / QUALITY[profile].fps - 2) {
    frame = requestAnimationFrame(draw);
    return;
  }
  const delta = Math.min(elapsed / 1000, 0.05);
  lastDelta = delta;
  lastFrame = now;
  time += delta;
  pointer = pointer.map((value, i) => value + (pointerTarget[i] - value) * Math.min(1, delta * 5));
  updateScene();
  updateAudio(now);
  if (state.target === "surface" || (state.nextTarget === "surface" && state.blend > 0.85)) {
    if (!project.seen) project = startReplay(project, motion, false);
    const wasReplaying = project.replaying;
    project = advanceReplay(project, delta);
    if (wasReplaying && !project.replaying && project.deliberate) audio?.cue("settle", "surface");
  }
  try {
    world.render({ state, pose: cameraPose(state, { time, pointer, fullMotion: true }), time, project, scrollY, mobile: width < 800 });
    body.dataset.experienceState = "ready";
    if (preferences.quality === "auto" && profile !== "low" && elapsed > 0 && elapsed < 150) {
      warmup++;
      if (warmup > 60) samples.push(elapsed);
      if (samples.length >= 60) {
        const result = assessPerformance(samples, slowWindows);
        slowWindows = result.slowWindows;
        samples = [];
        if (result.downgrade) { downgraded = true; layoutDirty = true; }
      }
    }
  } catch (error) { fail(error); return; }
  frame = requestAnimationFrame(draw);
}
function schedule() {
  if (!frame && world && active && !document.hidden && motion === "full" && !failed && !disposed) frame = requestAnimationFrame(draw);
}
async function enhance() {
  if (motion !== "full" || failed || disposed || !active || document.hidden) return;
  if (world) { layoutDirty = true; schedule(); return; }
  if (enhancementPending) return enhancementPending;
  enhancementPending = (async () => {
    try {
      worldImport ||= import("./world.js");
      const module = await worldImport;
      if (disposed || failed || motion !== "full") return;
      const created = await module.createWorld({ container, quality: profile, onFailure: fail });
      if (disposed || failed) { created?.dispose(); return; }
      world = created;
      layoutDirty = true;
      schedule();
    } catch (error) { fail(error); }
    finally { enhancementPending = undefined; }
  })();
  return enhancementPending;
}
function syncStatic() {
  if (syncFrame || disposed) return;
  syncFrame = requestAnimationFrame(() => {
    syncFrame = 0;
    if (layoutDirty) measure();
    updateScene();
    if (active && !document.hidden) updateAudio(performance.now());
  });
}
function invalidate() {
  layoutDirty = true;
  if (motion !== "full" || !world || failed) syncStatic();
}
function applyPreferences() {
  motion = motionPolicy(preferences.motion, system.matches);
  savePreferences(storage, preferences);
  invalidate();
  updateDisplay();
  if (motion !== "full") {
    project = { ...project, path: 1, replaying: false };
    showStatic();
  } else enhance();
}

for (const detail of disclosures) {
  on(detail, "keydown", (event) => {
    if (event.key === "Escape" && detail.open) {
      detail.open = false;
      detail.querySelector("summary").focus();
      event.stopPropagation();
    }
  });
}
on(document, "pointerdown", (event) => {
  for (const detail of disclosures) if (detail.open && !detail.contains(event.target)) detail.open = false;
});
document.querySelectorAll(".index-links a").forEach((link) => on(link, "click", () => {
  document.querySelector("#section-index").open = false;
}));
motionControl.value = preferences.motion;
qualityControl.value = preferences.quality;
on(motionControl, "change", () => { preferences.motion = motionControl.value; applyPreferences(); });
on(qualityControl, "change", () => { preferences.quality = qualityControl.value; applyPreferences(); });
on(system, "change", applyPreferences);
on(window, "scroll", () => {
  scrollY = window.scrollY;
  if (motion !== "full" || !world || failed) syncStatic();
}, { passive: true });
on(window, "resize", invalidate, { passive: true });
on(window, "hashchange", () => { scrollY = window.scrollY; invalidate(); });
on(document, "pointermove", (event) => {
  if (motion === "full" && finePointer.matches && event.pointerType !== "touch") pointerTarget = [(event.clientX / width) * 2 - 1, (event.clientY / height) * 2 - 1];
}, { passive: true });
on(document.documentElement, "pointerleave", () => { pointerTarget = [0, 0]; });
const observer = new ResizeObserver(invalidate);
observer.observe(document.querySelector("main"));
observer.observe(document.querySelector("#top"));
observer.observe(container);
document.fonts?.ready.then(() => { if (!disposed) invalidate(); });

on(document.querySelector("#replay-path"), "click", () => {
  project = startReplay(project, failed ? "off" : motion);
  audio?.cue("path", "surface");
});
document.querySelectorAll("[data-shortcut]").forEach((button) => on(button, "click", () => {
  project = chooseShortcut(project, button.dataset.shortcut);
  document.querySelectorAll("[data-shortcut]").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.shortcut === project.shortcut)));
  document.querySelector("#route-status").textContent = project.shortcut === "open"
    ? "Shortcut open: an exact best-response trajectory is shown."
    : "Shortcut closed: the curve marks feasible states using the two outer routes.";
  updateScene();
  audio?.cue("network", "congestion");
}));
// The lightweight audio module is loaded with main. Context creation/resume runs
// synchronously inside this genuine click gesture, before the first await.
on(soundControl, "click", () => {
  audio ||= createAudio({ onChange: soundChanged });
  if (audio.snapshot().wanted || audio.snapshot().enabled) { void audio.off(); return; }
  lastAudioTarget = state.blend > 0.08 ? state.nextTarget : state.target;
  settledAudioTarget = lastAudioTarget;
  void audio.enable().catch(() => soundChanged({ wanted: false, enabled: false, state: "unavailable" }));
});
function suspend() {
  active = false;
  void audio?.suspend();
  cancelAnimationFrame(frame);
  cancelAnimationFrame(syncFrame);
  frame = syncFrame = 0;
  lastFrame = 0;
}
function resume() {
  if (disposed) return;
  active = !document.hidden;
  scrollY = window.scrollY;
  invalidate();
  suppressNextAudio = true;
  settledSince = performance.now();
  if (active) { void audio?.resume(); enhance(); }
}
on(document, "visibilitychange", () => document.hidden ? suspend() : resume());
on(window, "pagehide", (event) => {
  suspend();
  if (!event.persisted) {
    disposed = true;
    observer.disconnect();
    listeners.abort();
    world?.dispose();
    void audio?.dispose();
  }
});
on(window, "pageshow", resume);
for (const element of [document.querySelector("#display-settings"), soundControl, document.querySelector("#replay-path"), document.querySelector("#shortcut-controls")]) element.hidden = false;
measure();
updateScene();
updateDisplay();
if (debug) window.__blackGeometry = {
  snapshot: () => ({
    motion, preferences: { ...preferences }, profile, state: { ...state }, project: { ...project },
    time, lastDelta, active, pendingFrame: !!frame, world: world?.snapshot() || null,
    audio: audio?.snapshot() || { initialized: false, enabled: false, wanted: false, state: "uninitialized" },
    ranges: structuredClone(ranges),
  }),
};
if ("requestIdleCallback" in window) requestIdleCallback(() => enhance(), { timeout: 700 });
else setTimeout(() => enhance(), 0);
