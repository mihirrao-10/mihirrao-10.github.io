import { DEFAULTS, motionPolicy, QUALITY } from './preferences.js';
import { chapterState, cameraPose, createTransition, advanceTransition } from './scene-state.js';
import { createInteraction } from './interaction.js';
import { createSectionSnap } from './section-snap.js';

const body = document.body;
const root = document.documentElement;
const container = document.querySelector('.world');
const poster = document.querySelector('#sculpture-poster');
const animationAction = document.querySelector('.animation-action');
const system = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
const sceneElements = [...document.querySelectorAll('[data-scene]')];
const listeners = new AbortController();
const on = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: listeners.signal });
const debug = new URLSearchParams(location.search).has('bg-debug');
const profile = 'high';
const project = { shortcut: 'open', path: 1 };
const navigation = performance.getEntriesByType('navigation')[0];
let motion = motionPolicy(system.matches);
let motionOverride = false;
let world, worldImport, enhancementPending;
let failed = root.dataset.boot === 'fallback', disposed = false, active = !document.hidden;
const introVisit = root.dataset.boot === 'loading' && navigation?.type !== 'back_forward' && (!location.hash || location.hash === '#top');
const entrance = { started: false, progress: introVisit ? 0 : 1 };
let frame = 0, syncFrame = 0, lastFrame = 0, time = 0, orbitTime = 0;
let scrollY = window.scrollY, width = innerWidth, height = innerHeight, layoutDirty = true;
let ranges = [], pointer = [0, 0], pointerTarget = [0, 0];
let state = chapterState(0, []), visualState = state;
let transition = createTransition(state.target), lastChapter, lastPoster;
const interaction = createInteraction({
  element: container,
  hint: document.querySelector('#rotation-hint'),
  onChange: ({ dragging }) => { if (dragging) pointerTarget = [...pointer]; },
});
body.dataset.enhanced = 'true';
body.dataset.motion = motion;
animationAction.hidden = motion === 'full';
animationAction.title = 'Your device requests reduced motion. Enable the rotating sculptures for this visit.';

function finishBoot(status = 'complete') {
  root.dataset.boot = status;
  window.dispatchEvent(new Event('portfolio:boot-complete'));
}

function pixels(value) {
  if (!value || value === 'auto' || value === 'normal') return 0;
  if (value.endsWith('px') && Number.isFinite(Number(value.slice(0, -2)))) return Number(value.slice(0, -2));
  const probe = document.createElement('div');
  Object.assign(probe.style, { position: 'fixed', visibility: 'hidden', pointerEvents: 'none', width: '0', height: value });
  body.append(probe);
  const size = probe.getBoundingClientRect().height;
  probe.remove();
  return size;
}
function measure() {
  // A width change reflows every preceding entry. Preserve the reading entry
  // across rotation, but let mobile browser chrome change height freely.
  const reading = width !== innerWidth && ranges.length ? { ...state } : null;
  width = innerWidth;
  height = innerHeight;
  scrollY = window.scrollY;
  const css = getComputedStyle(document.documentElement);
  const top = pixels(css.scrollPaddingTop);
  const bottom = pixels(css.scrollPaddingBottom);
  const end = Math.max(1, document.documentElement.scrollHeight - height);
  let previous = -1;
  ranges = sceneElements.map((element, index) => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    const marginTop = pixels(style.scrollMarginTop);
    const marginBottom = pixels(style.scrollMarginBottom);
    const start = index === 0 ? 0 : Math.min(end, Math.max(previous + 1, rect.top + scrollY - top - marginTop));
    previous = start;
    // Long entries allow scrolling freely throughout this reading interval.
    const stop = Math.min(end, Math.max(start, rect.bottom + scrollY + marginBottom - height + bottom));
    return { id: element.dataset.scene, target: element.dataset.target, start, stop, end, snap: element.dataset.snap !== 'none' };
  });
  if (reading) {
    const index = ranges.findIndex(range => range.id === reading.chapter), range = ranges[index];
    const end = ranges[index + 1]?.start ?? range.end;
    window.scrollTo({ top: Math.min(range.stop, range.start + reading.progress * (end - range.start)), behavior: 'instant' });
    scrollY = window.scrollY;
  }
  world?.resize(width, height, devicePixelRatio);
  layoutDirty = false;
}
function updateScene() {
  const previousTarget = state.target;
  state = chapterState(scrollY, ranges);
  if (lastChapter !== state.chapter) {
    if (lastChapter) {
      if (previousTarget !== state.target) interaction.reset(world?.entryOrientation(state.target));
      else interaction.cancel();
    }
    lastChapter = state.chapter;
    body.dataset.chapter = state.chapter;
    for (const element of sceneElements)
      element.toggleAttribute('data-current-scene', element.dataset.scene === state.chapter);
  }
  body.dataset.sculpture = state.target;
  // Parsing a dense, hidden SVG on every live section change stalls scrolling.
  // Load the matching poster only when it is actually serving as the artwork.
  if (lastPoster !== state.target && (motion !== 'full' || !world || failed)) {
    lastPoster = state.target;
    poster.src = `assets/black-geometry/generated/sculpture-${state.target}.svg`;
  }
}
function settlePresentation() {
  transition = createTransition(state.target);
  visualState = { ...state };
}
function showStatic(reason = 'static') {
  entrance.progress = 1;
  finishBoot(reason === 'fallback' ? 'fallback' : 'complete');
  interaction.setEnabled(false);
  cancelAnimationFrame(frame);
  frame = lastFrame = 0;
  body.dataset.experienceState = reason;
  if (layoutDirty) measure();
  updateScene();
  settlePresentation();
}
function fail(error) {
  failed = true;
  showStatic('fallback');
  world?.dispose();
  world = undefined;
  animationAction.textContent = 'Retry animation';
  animationAction.title = 'The animation could not load. Try again.';
  animationAction.hidden = false;
  if (debug) console.warn('Sculpture fallback:', error?.message || error);
}
function draw(now) {
  frame = 0;
  if (disposed || !active || document.hidden || motion !== 'full' || !world || failed) return;
  if (layoutDirty) measure();
  const elapsed = lastFrame ? now - lastFrame : 0;
  if (lastFrame && elapsed < 1000 / QUALITY.high.fps - 2) {
    frame = requestAnimationFrame(draw);
    return;
  }
  const delta = Math.min(elapsed / 1000, 0.05);
  lastFrame = now;
  time += delta;
  updateScene();
  interaction.step(delta);
  const grab = interaction.snapshot();
  if (!grab.dragging) orbitTime += delta;
  pointer = pointer.map((value, i) => value + (pointerTarget[i] - value) * (1 - Math.exp(-delta * 5)));
  // Real elapsed time completes the selected sculpture even when scrolling stops.
  transition = advanceTransition(transition, state.target, elapsed / 1000);
  visualState = { ...state, target: transition.from, nextTarget: transition.to, blend: transition.blend };
  // Only the opening hero grows into view. A deep link or an early scroll
  // always gets its complete sculpture, and returning never replays the intro.
  if (state.target !== 'hero') entrance.progress = 1;
  else if (entrance.started) entrance.progress = Math.min(1, entrance.progress + delta / 1.1);
  try {
    world.recordFrame(elapsed);
    world.render({ state: visualState,
      pose: cameraPose(visualState, { time: orbitTime, pointer, fullMotion: true }),
      time, orbitTime, pointer, project, interactionTarget: state.target,
      entrance: entrance.progress,
      interaction: { orientation: grab.orientation, rotation: grab.rotation, dragging: grab.dragging },
    });
    body.dataset.experienceState = 'ready';
    if (!entrance.started) {
      entrance.started = true;
      // Shader compilation can take time. Start the visible animation after
      // that first successful frame, not while it is still being prepared.
      lastFrame = performance.now();
      finishBoot(entrance.progress < 1 ? 'revealing' : 'complete');
    } else if (entrance.progress === 1 && ['revealing', 'loading'].includes(root.dataset.boot)) finishBoot();
    interaction.setEnabled(entrance.progress === 1);
  } catch (error) { fail(error); return; }
  frame = requestAnimationFrame(draw);
}
function schedule() {
  if (!frame && world && active && !document.hidden && motion === 'full' && !failed && !disposed) frame = requestAnimationFrame(draw);
}
async function enhance() {
  if (motion !== 'full' || failed || disposed || !active || document.hidden) return;
  if (world) { layoutDirty = true; schedule(); return; }
  if (enhancementPending) return enhancementPending;
  enhancementPending = (async () => {
    try {
      worldImport ||= import('./world.js');
      const [module] = await Promise.all([worldImport, document.fonts?.ready]);
      if (disposed || failed || motion !== 'full') return;
      const created = await module.createWorld({ container, quality: profile, onFailure: fail });
      if (disposed || failed) { created?.dispose(); return; }
      world = created;
      if (motion !== 'full') { showStatic(); return; }
      measure();
      updateScene();
      settlePresentation();
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
    settlePresentation();
  });
}
function invalidate() {
  layoutDirty = true;
  if (motion !== 'full' || !world || failed) syncStatic();
}
on(system, 'change', () => {
  motionOverride = false;
  motion = motionPolicy(system.matches);
  body.dataset.motion = motion;
  animationAction.hidden = motion === 'full';
  invalidate();
  if (motion !== 'full') showStatic();
  else enhance();
});
on(animationAction, 'click', () => {
  if (failed) { location.reload(); return; }
  motionOverride = true;
  motion = 'full';
  body.dataset.motion = motion;
  animationAction.hidden = true;
  root.dataset.boot = 'loading';
  enhance();
});
on(window, 'portfolio:boot-fallback', () => fail(new Error('Sculpture entry module failed')));
on(window, 'scroll', () => {
  scrollY = window.scrollY;
  if (motion !== 'full' || !world || failed) syncStatic();
}, { passive: true });
const sectionSnap = createSectionSnap({
  getRanges: () => { if (layoutDirty) measure(); return ranges.filter(range => range.snap); },
  getY: () => window.scrollY,
  move: (top, behavior) => window.scrollTo({ top, behavior }),
  isReduced: () => motion !== 'full',
  isLoading: () => root.dataset.boot === 'loading',
});
on(window, 'scroll', sectionSnap.scroll, { passive: true });
on(window, 'wheel', sectionSnap.wheel, { passive: false });
on(window, 'keydown', sectionSnap.input, { passive: true });
on(window, 'pointerdown', sectionSnap.pointerDown, { passive: true });
for (const event of ['pointerup', 'pointercancel']) on(window, event, sectionSnap.pointerUp, { passive: true });
on(window, 'touchstart', sectionSnap.touchStart, { passive: true });
for (const event of ['touchend', 'touchcancel']) on(window, event, sectionSnap.touchEnd, { passive: true });
for (const event of ['resize', 'hashchange']) on(window, event, sectionSnap.reset, { passive: true });
on(window, 'resize', invalidate, { passive: true });
on(window, 'hashchange', invalidate);
on(document, 'click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!event.target.closest?.('a[href^="#"]')) return;
  // Smooth deliberate anchor navigation, after the reading layout is ready.
  // Startup hashes and reload restoration must never animate toward old bounds.
  document.documentElement.style.scrollBehavior = motion === 'full' ? 'smooth' : 'auto';
});
on(document, 'pointermove', event => {
  if (motion === 'full' && finePointer.matches && event.pointerType !== 'touch' && !interaction.snapshot().dragging)
    pointerTarget = [(event.clientX / width) * 2 - 1, (event.clientY / height) * 2 - 1];
}, { passive: true });
on(document.documentElement, 'pointerleave', () => { if (!interaction.snapshot().dragging) pointerTarget = [0, 0]; });
const observer = new ResizeObserver(invalidate);
for (const element of [document.querySelector('main'), document.querySelector('#top'), container]) observer.observe(element);
document.fonts?.ready.then(() => { if (!disposed) invalidate(); });
function suspend() {
  sectionSnap.reset();
  active = false;
  interaction.setEnabled(false);
  cancelAnimationFrame(frame);
  cancelAnimationFrame(syncFrame);
  frame = syncFrame = lastFrame = 0;
}
function resume() {
  if (disposed) return;
  active = !document.hidden;
  scrollY = window.scrollY;
  invalidate();
  if (active) enhance();
}
on(document, 'visibilitychange', () => document.hidden ? suspend() : resume());
on(window, 'pagehide', event => {
  // Save into this existing entry without changing its URL or adding history.
  // Startup can run before CSS or native scroll restoration on a cold return.
  try {
    const saved = history.state;
    if (saved === null || (typeof saved === 'object' && !Array.isArray(saved)))
      history.replaceState({ ...saved, portfolioReading: { href: location.href, y: window.scrollY } }, '');
  } catch { /* Native restoration remains available when history writes fail. */ }
  suspend();
  if (!event.persisted) {
    disposed = true;
    observer.disconnect();
    listeners.abort();
    interaction.dispose();
    world?.dispose();
  }
});
on(window, 'pageshow', resume);
measure();
updateScene();
settlePresentation();
if (motion !== 'full' || failed) showStatic(failed ? 'fallback' : 'static');
// WebKit can revisit an old fragment after restoring the reading position,
// including after late fonts settle. Correct only that full-history case.
let returnAnchor;
try { returnAnchor = document.getElementById(decodeURIComponent(location.hash.slice(1)))?.dataset.scene; } catch {}
const reading = history.state?.portfolioReading;
if (navigation?.type === 'back_forward' && returnAnchor && reading?.href === location.href && Number.isFinite(reading.y) && reading.y >= 0) {
  let interrupted = false;
  for (const event of ['pointerdown', 'wheel', 'keydown'])
    on(window, event, () => { interrupted = true; }, { once: true, passive: true });
  on(window, 'pageshow', async event => {
    if (event.persisted || interrupted) return;
    await document.fonts?.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (disposed || interrupted || location.href !== reading.href) return;
    measure();
    if (chapterState(reading.y, ranges).chapter === returnAnchor) return;
    if (chapterState(window.scrollY, ranges).chapter !== returnAnchor) return;
    window.scrollTo({ top: reading.y, behavior: 'instant' });
    scrollY = window.scrollY;
    invalidate();
  }, { once: true });
}
if (debug) window.__blackGeometry = {
  snapshot: () => ({
    motion, motionOverride, preferences: { ...DEFAULTS }, profile, state: { ...state }, visualState: { ...visualState },
    transition: { ...transition }, project: { ...project }, time, orbitTime,
    interaction: interaction.snapshot(), active, pendingFrame: !!frame, world: world?.snapshot() || null,
    ranges: structuredClone(ranges), entrance: { ...entrance },
  }),
};
enhance();
