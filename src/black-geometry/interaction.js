const TAU = Math.PI * 2;
const DRAG_DECAY = 7.5;
const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));

// The stage owns these listeners; page-level arrow keys and native vertical
// touch scrolling remain with the document. No animation loop is created here.
export function createInteraction({ element, hint, onChange = () => {} }) {
  const listeners = new AbortController();
  const on = (type, handler) => element.addEventListener(type, handler, { signal: listeners.signal });
  let enabled = false, disposed = false, dragging = false, pointerId = null;
  let touch = false, pending = false, origin = [0, 0], previous = [0, 0], lastMove = 0;
  let rotation = [0, 0], orientation = [0, 0, 0, 1], velocity = [0, 0];
  const snapshot = () => ({ enabled, dragging, pending, pointerId, rotation: [...rotation], orientation: [...orientation], velocity: [...velocity] });
  const publish = () => {
    element.dataset.dragging = String(dragging);
    onChange(snapshot());
  };
  function releaseCapture(id) {
    if (id === null) return;
    try { if (element.hasPointerCapture(id)) element.releasePointerCapture(id); } catch {}
  }
  function cancel() {
    const id = pointerId;
    pointerId = null;
    dragging = pending = false;
    velocity = [0, 0];
    releaseCapture(id);
    publish();
  }
  function reset(restoredOrientation = [0, 0, 0, 1]) {
    cancel();
    rotation = [0, 0]; orientation = [...restoredOrientation];
    publish();
  }
  function addRotation(pitch, yaw) {
    const angle = Math.hypot(pitch, yaw);
    if (!angle) return;
    // Apply the incremental rotation about the current screen axes, before the
    // accumulated orientation. Euler reconstruction would tilt those axes after
    // a prior turn, and a pitch clamp would prevent exploring the whole object.
    const factor = Math.sin(angle / 2) / angle;
    const ax = pitch * factor, ay = yaw * factor, aw = Math.cos(angle / 2);
    const [bx, by, bz, bw] = orientation;
    orientation = [aw * bx + ax * bw + ay * bz, aw * by + ay * bw - ax * bz,
      aw * bz + ax * by - ay * bx, aw * bw - ax * bx - ay * by];
    const length = Math.hypot(...orientation);
    orientation = orientation.map((value) => value / length);
    // These totals are diagnostics only; the quaternion is the rendered state.
    rotation = [rotation[0] + pitch, rotation[1] + yaw].map((value) => Math.abs(value) > TAU * 1000 ? value % TAU : value);
  }
  function capture() {
    dragging = true;
    pending = false;
    try { element.setPointerCapture(pointerId); } catch {}
    element.focus({ preventScroll: true });
    publish();
  }
  on("pointerdown", (event) => {
    if (!enabled || pointerId !== null || event.isPrimary === false || (event.pointerType !== "touch" && event.button !== 0)) return;
    pointerId = event.pointerId;
    touch = event.pointerType === "touch";
    pending = touch;
    origin = previous = [event.clientX, event.clientY];
    lastMove = event.timeStamp;
    velocity = [0, 0];
    if (!touch) { event.preventDefault(); capture(); }
  });
  on("pointermove", (event) => {
    if (!enabled || event.pointerId !== pointerId) return;
    if (pending) {
      const dx = Math.abs(event.clientX - origin[0]), dy = Math.abs(event.clientY - origin[1]);
      if (Math.max(dx, dy) < 8) return;
      if (dy >= dx) { cancel(); return; }
      capture();
    }
    if (!dragging) return;
    if (event.cancelable) event.preventDefault();
    const bounds = element.getBoundingClientRect();
    const dx = event.clientX - previous[0], dy = event.clientY - previous[1];
    const radiansPerPixel = Math.PI / Math.max(200, Math.min(bounds.width, bounds.height));
    // Positive X rotation moves the front (+Z) surface toward negative Y,
    // following a downward drag. Both axes use the same pixel scale so a
    // diagonal drag moves the surface along the same screen-space diagonal.
    const pitch = touch ? 0 : dy * radiansPerPixel;
    const yaw = dx * radiansPerPixel;
    const delta = clamp((event.timeStamp - lastMove) / 1000, 0.008, 0.08);
    velocity = [pitch, yaw].map((angle, index) => velocity[index] * 0.25 + clamp(angle / delta, -8, 8) * 0.75);
    addRotation(pitch, yaw);
    previous = [event.clientX, event.clientY];
    lastMove = event.timeStamp;
  });
  on("pointerup", (event) => {
    if (event.pointerId !== pointerId) return;
    const id = pointerId;
    pointerId = null;
    if (!dragging || event.timeStamp - lastMove > 120) velocity = [0, 0];
    dragging = pending = false;
    releaseCapture(id);
    publish();
  });
  on("pointercancel", (event) => { if (event.pointerId === pointerId) cancel(); });
  on("lostpointercapture", (event) => { if (event.pointerId === pointerId) cancel(); });
  on("keydown", (event) => {
    if (!enabled || event.target !== element || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 0.3 : 0.12;
    const directions = { ArrowUp: [-step, 0], ArrowDown: [step, 0], ArrowLeft: [0, -step], ArrowRight: [0, step] };
    if (event.key !== "Home" && !directions[event.key]) return;
    event.preventDefault();
    cancel();
    if (event.key === "Home") { rotation = [0, 0]; orientation = [0, 0, 0, 1]; }
    else addRotation(...directions[event.key]);
    publish();
  });
  function setEnabled(value) {
    const next = Boolean(value) && !disposed;
    if (next === enabled) return;
    enabled = next;
    element.dataset.interactive = String(enabled);
    element.setAttribute("aria-hidden", String(!enabled));
    if (hint) hint.hidden = !enabled;
    if (enabled) element.setAttribute("tabindex", "0");
    else {
      cancel();
      element.removeAttribute("tabindex");
      if (element.ownerDocument.activeElement === element) element.blur();
    }
  }
  return {
    snapshot,
    setEnabled,
    cancel,
    reset,
    step(delta) {
      if (!enabled || dragging || pending || !Number.isFinite(delta) || delta <= 0) return;
      const decay = Math.exp(-DRAG_DECAY * delta);
      const distance = (1 - decay) / DRAG_DECAY;
      addRotation(velocity[0] * distance, velocity[1] * distance);
      velocity = velocity.map((value) => Math.abs(value * decay) < 0.0001 ? 0 : value * decay);
    },
    dispose() { setEnabled(false); disposed = true; listeners.abort(); },
  };
}
