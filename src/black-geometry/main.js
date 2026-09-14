import {
  readPreferences,
  savePreferences,
  motionPolicy,
  qualityPolicy,
  QUALITY,
  assessPerformance,
} from "./preferences.js";
import {
  CHAPTERS,
  chapterState,
  cameraPose,
  createProjectState,
  startReplay,
  advanceReplay,
  chooseShortcut,
} from "./scene-state.js";

const body = document.body;
let storage;
try {
  storage = window.localStorage;
} catch {}
const preferences = readPreferences(storage),
  system = matchMedia("(prefers-reduced-motion: reduce)"),
  finePointer = matchMedia("(pointer: fine)");
const motionControl = document.querySelector("#motion-setting"),
  qualityControl = document.querySelector("#quality-setting");
const soundControl = document.querySelector("#sound-toggle"),
  displayStatus = document.querySelector("#display-status");
const stageElements = [...document.querySelectorAll("[data-stage]")],
  disclosures = [...document.querySelectorAll(".header-controls details")];
let motion = motionPolicy(preferences.motion, system.matches),
  world,
  worldImport,
  failed = false,
  disposed = false,
  active = true;
let frame = 0,
  lastFrame = 0,
  time = 0,
  scrollY = window.scrollY,
  width = innerWidth,
  height = innerHeight,
  layoutDirty = true;
let ranges = [],
  stages = [],
  pointer = [0, 0],
  project = createProjectState(),
  state = chapterState(0, []),
  audio,
  audioImport,
  soundWanted = false,
  soundPending = false,
  soundTicket = 0;
let downgraded = false,
  profile = qualityPolicy(preferences.quality, {
    width,
    cores: navigator.hardwareConcurrency,
  }),
  samples = [],
  slowWindows = 0,
  warmup = 0;
let lastStage = null,
  lastChapter = null,
  lastDelta = 0;
const listeners = new AbortController(),
  on = (target, event, callback, options = {}) =>
    target.addEventListener(event, callback, {
      ...options,
      signal: listeners.signal,
    });
const debug = new URLSearchParams(location.search).has("bg-debug");

function soundLabel(enabled) {
  soundControl.setAttribute("aria-pressed", String(enabled));
  soundControl.lastElementChild.textContent = enabled
    ? "Sound on"
    : "Sound off";
}
function updateDisplay() {
  body.dataset.motion = motion;
  displayStatus.textContent = failed
    ? "Static illustrations. The animated display is unavailable."
    : motion !== "full"
      ? "Static illustrations. Motion is off."
      : `Motion on · ${profile === "medium" ? "Auto" : profile[0].toUpperCase() + profile.slice(1)} quality.`;
}
function showStatic(reason = "static") {
  cancelAnimationFrame(frame);
  frame = 0;
  lastFrame = 0;
  body.dataset.experienceState = reason;
  stageElements.forEach((element) => delete element.dataset.rendered);
  lastStage = null;
}
function fail(error) {
  failed = true;
  showStatic("fallback");
  world?.dispose();
  world = undefined;
  qualityControl.disabled = true;
  updateDisplay();
  if (debug) console.warn("Black Geometry fallback:", error.message);
}
function measure() {
  width = innerWidth;
  height = innerHeight;
  scrollY = window.scrollY;
  const elements = [
    document.querySelector("#top"),
    ...[
      "education",
      "experience",
      "research",
      "teaching",
      "project-surface",
      "project-congestion",
      "notes",
      "contact",
    ].map((id) => document.getElementById(id)),
  ];
  const end = Math.max(1, document.documentElement.scrollHeight - height);
  ranges = elements.map((element, index) => ({
    id: CHAPTERS[index],
    start:
      index === 0
        ? 0
        : Math.max(
            1,
            element.getBoundingClientRect().top + scrollY - height * 0.38,
          ),
    end,
  }));
  ranges.at(-1).start = Math.max(
    ranges.at(-2).start + 1,
    end -
      Math.min(height * 0.2, elements.at(-1).getBoundingClientRect().height),
  );
  stages = stageElements.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      element,
      kind: element.dataset.stage,
      top: rect.top + scrollY,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  });
  for (const stage of stages)
    if (stage.kind === "congestion") {
      const view = 2 * 7.6 * Math.tan(Math.PI / 10),
        fit = Math.min(1, stage.width / stage.height / 1.25);
      const labelNodes = [
        [-2, 0],
        [0, 1.28],
        [0, -1.28],
        [2, 0],
      ];
      stage.element.querySelectorAll(".node-label").forEach((label, index) => {
        const [x, y] = labelNodes[index];
        label.style.left = `${50 + ((x * fit) / ((view * stage.width) / stage.height)) * 100}%`;
        label.style.top = `${50 - ((y * fit) / view) * 100}%`;
      });
    }
  const next = qualityPolicy(preferences.quality, {
    width,
    cores: navigator.hardwareConcurrency,
    downgraded,
  });
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
function selectedStage() {
  return stages
    .filter(
      (stage) =>
        stage.top - scrollY < height && stage.top + stage.height - scrollY > 72,
    )
    .sort(
      (a, b) =>
        Math.abs(a.top + a.height / 2 - scrollY - height / 2) -
        Math.abs(b.top + b.height / 2 - scrollY - height / 2),
    )[0];
}
function updateChapter() {
  state = chapterState(scrollY, ranges);
  if (lastChapter !== state.chapter) {
    lastChapter = state.chapter;
    body.dataset.chapter = state.chapter;
    const selected = state.chapter.startsWith("project-")
      ? "personal-projects"
      : state.chapter;
    document.querySelectorAll(".index-links a").forEach((link) => {
      if (link.hash === `#${selected}`)
        link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
}
function draw(now) {
  frame = 0;
  if (
    disposed ||
    !active ||
    document.hidden ||
    motion !== "full" ||
    !world ||
    failed
  )
    return;
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
  updateChapter();
  const stage = selectedStage();
  if (stage?.kind === "surface") {
    if (!project.seen) project = startReplay(project, motion, false);
    const wasReplaying = project.replaying;
    project = advanceReplay(project, delta);
    if (wasReplaying && !project.replaying && project.deliberate)
      audio?.cue("complete");
  }
  try {
    const pose = cameraPose(state, {
      mobile: width < 800,
      width,
      time,
      pointer,
      fullMotion: true,
    });
    world.render({
      state,
      pose,
      time,
      project,
      stage,
      scrollY,
      mobile: width < 800,
      focused: !!stage?.element.parentElement.matches(":focus-within, :hover"),
    });
    body.dataset.experienceState = "ready";
    if (lastStage !== stage?.element) {
      stageElements.forEach((element) => delete element.dataset.rendered);
      if (stage) stage.element.dataset.rendered = "true";
      lastStage = stage?.element;
    }
    if (
      preferences.quality === "auto" &&
      profile !== "low" &&
      elapsed > 0 &&
      elapsed < 150
    ) {
      warmup++;
      if (warmup > 60) samples.push(elapsed);
      if (samples.length >= 60) {
        const result = assessPerformance(samples, slowWindows);
        slowWindows = result.slowWindows;
        samples = [];
        if (result.downgrade) {
          downgraded = true;
          layoutDirty = true;
        }
      }
    }
  } catch (error) {
    fail(error);
    return;
  }
  frame = requestAnimationFrame(draw);
}
function schedule() {
  if (
    !frame &&
    world &&
    active &&
    !document.hidden &&
    motion === "full" &&
    !failed &&
    !disposed
  )
    frame = requestAnimationFrame(draw);
}
async function enhance() {
  if (motion !== "full" || failed || disposed || !active || document.hidden)
    return;
  try {
    worldImport ||= import("./world.js");
    const module = await worldImport;
    if (disposed || failed || motion !== "full" || !active || document.hidden)
      return;
    if (!world)
      world = module.createWorld({
        container: document.querySelector(".world"),
        quality: profile,
        onFailure: fail,
      });
    layoutDirty = true;
    schedule();
  } catch (error) {
    fail(error);
  }
}
function applyPreferences() {
  motion = motionPolicy(preferences.motion, system.matches);
  savePreferences(storage, preferences);
  layoutDirty = true;
  updateDisplay();
  if (motion !== "full") {
    project = { ...project, path: 1, replaying: false };
    showStatic();
  } else enhance();
}

// Native details/anchors work before this enhancement. Escape closes only disclosures.
for (const detail of disclosures) {
  on(detail, "toggle", () => {
    if (detail.open)
      for (const other of disclosures) if (other !== detail) other.open = false;
  });
  on(detail, "keydown", (event) => {
    if (event.key === "Escape" && detail.open) {
      detail.open = false;
      detail.querySelector("summary").focus();
      event.stopPropagation();
    }
  });
}
on(document, "pointerdown", (event) => {
  for (const detail of disclosures)
    if (detail.open && !detail.contains(event.target)) detail.open = false;
});
document.querySelectorAll(".index-links a").forEach((link) =>
  on(link, "click", () => {
    document.querySelector("#section-index").open = false;
  }),
);
motionControl.value = preferences.motion;
qualityControl.value = preferences.quality;
on(motionControl, "change", () => {
  preferences.motion = motionControl.value;
  applyPreferences();
});
on(qualityControl, "change", () => {
  preferences.quality = qualityControl.value;
  applyPreferences();
});
on(system, "change", () => applyPreferences());
on(
  window,
  "scroll",
  () => {
    scrollY = window.scrollY;
    if (motion !== "full") {
      if (layoutDirty) measure();
      updateChapter();
    }
  },
  { passive: true },
);
on(
  window,
  "resize",
  () => {
    layoutDirty = true;
  },
  { passive: true },
);
on(
  document,
  "pointermove",
  (event) => {
    if (
      motion === "full" &&
      finePointer.matches &&
      event.pointerType !== "touch"
    )
      pointer = [
        (event.clientX / width) * 2 - 1,
        (event.clientY / height) * 2 - 1,
      ];
  },
  { passive: true },
);
on(document.documentElement, "pointerleave", () => {
  pointer = [0, 0];
});
const observer = new ResizeObserver(() => {
  layoutDirty = true;
});
observer.observe(document.querySelector("main"));
observer.observe(document.querySelector("#top"));
document.fonts?.ready.then(() => {
  if (!disposed) layoutDirty = true;
});

on(document.querySelector("#replay-path"), "click", () => {
  project = startReplay(project, failed ? "off" : motion);
  audio?.cue();
});
document.querySelectorAll("[data-shortcut]").forEach((button) =>
  on(button, "click", () => {
    project = chooseShortcut(project, button.dataset.shortcut);
    document
      .querySelectorAll("[data-shortcut]")
      .forEach((item) =>
        item.setAttribute(
          "aria-pressed",
          String(item.dataset.shortcut === project.shortcut),
        ),
      );
    document.querySelector("#network-poster").src =
      `assets/black-geometry/generated/project-congestion-${project.shortcut}.svg`;
    document.querySelector("#route-status").textContent =
      project.shortcut === "open"
        ? "The middle connection is open."
        : "The middle connection is closed; flow uses the outer routes.";
    audio?.cue();
  }),
);
on(soundControl, "click", async () => {
  soundWanted = soundPending
    ? !soundWanted
    : !(audio?.snapshot().enabled ?? false);
  const attempt = ++soundTicket;
  soundPending = true;
  try {
    if (!soundWanted) {
      await audio?.off();
      if (attempt === soundTicket) soundLabel(false);
      return;
    }
    audioImport ||= import("./audio.js");
    const { createAudio } = await audioImport;
    if (attempt !== soundTicket || !soundWanted || disposed || document.hidden)
      return;
    audio ||= createAudio({ onChange: soundLabel });
    const enabled = await audio.enable();
    if (attempt !== soundTicket) return;
    if (!soundWanted || disposed || document.hidden) {
      await audio.off();
      return;
    }
    if (!enabled) {
      soundWanted = false;
      document.querySelector("#sound-status").textContent =
        "Sound is unavailable. You can try the Sound control again.";
    }
  } catch {
    if (attempt !== soundTicket) return;
    soundWanted = false;
    soundLabel(false);
    document.querySelector("#sound-status").textContent =
      "Sound is unavailable.";
  } finally {
    if (attempt === soundTicket) soundPending = false;
  }
});
function suspend() {
  active = false;
  soundWanted = false;
  soundPending = false;
  soundTicket++;
  audio?.off();
  soundLabel(false);
  cancelAnimationFrame(frame);
  frame = 0;
  lastFrame = 0;
}
on(document, "visibilitychange", () => {
  if (document.hidden) suspend();
  else {
    active = true;
    layoutDirty = true;
    enhance();
  }
});
on(window, "pagehide", (event) => {
  suspend();
  if (!event.persisted) {
    disposed = true;
    observer.disconnect();
    listeners.abort();
    world?.dispose();
    audio?.dispose();
  }
});
on(window, "pageshow", () => {
  if (!disposed) {
    active = true;
    layoutDirty = true;
    enhance();
  }
});

for (const element of [
  document.querySelector("#display-settings"),
  soundControl,
  document.querySelector("#replay-path"),
  document.querySelector("#shortcut-controls"),
])
  element.hidden = false;
measure();
updateChapter();
updateDisplay();
// Diagnostic-only observations use the production renderer and clock. No alternative scene.
if (debug)
  window.__blackGeometry = {
    snapshot: () => ({
      motion,
      preferences: { ...preferences },
      profile,
      state: { ...state },
      project: { ...project },
      time,
      lastDelta,
      active,
      pendingFrame: !!frame,
      world: world?.snapshot() || null,
      audio: audio?.snapshot() || {
        initialized: false,
        enabled: false,
        state: "uninitialized",
      },
      ranges: structuredClone(ranges),
    }),
  };
// Defer the heavy import until HTML/static artwork have had an opportunity to paint.
if ("requestIdleCallback" in window)
  requestIdleCallback(() => enhance(), { timeout: 700 });
else setTimeout(() => enhance(), 0);
