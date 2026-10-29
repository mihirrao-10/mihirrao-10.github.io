import { DEFAULTS, motionPolicy, QUALITY } from './preferences.js';
import { cameraPose, createTransition, advanceTransition } from './scene-state.js';
import { createInteraction } from './interaction.js';
import { createNavigation } from './navigation.js';

const body = document.body;
const root = document.documentElement;
const container = document.querySelector('.world');
const poster = document.querySelector('#sculpture-poster');
const posterVersions = typeof __SCULPTURE_POSTER_VERSIONS__ === 'object' ? __SCULPTURE_POSTER_VERSIONS__ : {};
const animationAction = document.querySelector('.animation-action');
const system = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
const sceneElements = [...document.querySelectorAll('[data-scene]')];
const listeners = new AbortController();
const on = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: listeners.signal });
const debug = new URLSearchParams(location.search).has('bg-debug');
const profile = 'high';
const project = { shortcut: 'open', path: 1 };
let motion = motionPolicy(system.matches);
let motionOverride = false;
let world, worldImport, enhancementPending;
let failed = root.dataset.boot === 'fallback', disposed = false, active = !document.hidden;
const entrance = { started: false, progress: 1 };
let bootFinished = false;
let frame = 0, syncFrame = 0, lastFrame = 0, time = 0, orbitTime = 0;
let width = innerWidth, height = innerHeight, layoutDirty = true;
let pointer = [0, 0], pointerTarget = [0, 0];
let state = { chapter: 'hero', target: 'hero', nextTarget: 'hero', blend: 0, progress: 0 }, visualState = state;
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
  if (bootFinished) return;
  bootFinished = true;
  // Reveal on the next frame so the prepared canvas has reached the screen.
  requestAnimationFrame(() => {
    root.dataset.boot = failed ? 'fallback' : status;
    window.dispatchEvent(new Event('portfolio:boot-complete'));
  });
}

function measure() {
  width = innerWidth;
  height = innerHeight;
  world?.resize(width, height, devicePixelRatio);
  layoutDirty = false;
}
function updateScene() {
  const previousTarget = state.target;
  const selected = navigation.current();
  state = { chapter: selected.dataset.scene, target: selected.dataset.target,
    nextTarget: selected.dataset.target, blend: 0, progress: 0 };
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
  // Load a poster only while it is serving as the artwork.
  if (lastPoster !== state.target && (motion !== 'full' || !world || failed)) {
    lastPoster = state.target;
    const version = posterVersions[state.target];
    poster.src = `assets/black-geometry/generated/sculpture-${state.target}.svg${version ? `?v=${version}` : ''}`;
  }
}
function settlePresentation() {
  transition = createTransition(state.target);
  visualState = { ...state };
}
function showStatic(reason = 'static') {
  entrance.progress = 1;
  interaction.setEnabled(false);
  cancelAnimationFrame(frame);
  frame = lastFrame = 0;
  body.dataset.experienceState = reason;
  if (layoutDirty) measure();
  updateScene();
  settlePresentation();
  Promise.allSettled([document.fonts?.ready, poster.decode()]).then(() => {
    finishBoot(reason === 'fallback' ? 'fallback' : 'complete');
  });
}
function fail(error) {
  failed = true;
  showStatic('fallback');
  world?.dispose();
  world = undefined;
  animationAction.textContent = 'Retry animation';
  animationAction.title = 'The animation could not load. Try again.';
  animationAction.hidden = false;
  if (debug) {
    animationAction.title = String(error?.message || error);
    console.warn('Sculpture fallback:', error?.message || error);
  }
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
  // Real elapsed time completes the selected sculpture after the page selection.
  transition = advanceTransition(transition, state.target, elapsed / 1000);
  visualState = { ...state, target: transition.from, nextTarget: transition.to, blend: transition.blend };
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
  enhance();
});
on(window, 'portfolio:boot-fallback', () => fail(new Error('Sculpture entry module failed')));
on(window, 'resize', invalidate, { passive: true });
on(document, 'pointermove', event => {
  if (motion === 'full' && finePointer.matches && event.pointerType !== 'touch' && !interaction.snapshot().dragging)
    pointerTarget = [(event.clientX / width) * 2 - 1, (event.clientY / height) * 2 - 1];
}, { passive: true });
on(document.documentElement, 'pointerleave', () => { if (!interaction.snapshot().dragging) pointerTarget = [0, 0]; });
const observer = new ResizeObserver(invalidate);
for (const element of [document.querySelector('main'), document.querySelector('#top'), container]) observer.observe(element);
document.fonts?.ready.then(() => { if (!disposed) invalidate(); });
function suspend() {
  active = false;
  interaction.setEnabled(false);
  cancelAnimationFrame(frame);
  cancelAnimationFrame(syncFrame);
  frame = syncFrame = lastFrame = 0;
}
function resume() {
  if (disposed) return;
  active = !document.hidden;
  invalidate();
  if (active) enhance();
}
on(document, 'visibilitychange', () => document.hidden ? suspend() : resume());
on(window, 'pagehide', event => {
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
const navigation = createNavigation({ scenes: sceneElements, signal: listeners.signal, onChange: invalidate });
measure();
updateScene();
settlePresentation();
if (motion !== 'full' || failed) showStatic(failed ? 'fallback' : 'static');
if (debug) window.__blackGeometry = {
  snapshot: () => ({
    motion, motionOverride, preferences: { ...DEFAULTS }, profile, state: { ...state }, visualState: { ...visualState },
    transition: { ...transition }, project: { ...project }, time, orbitTime,
    interaction: interaction.snapshot(), active, pendingFrame: !!frame, world: world?.snapshot() || null,
    page: navigation.current().id, entrance: { ...entrance },
  }),
};
enhance();
