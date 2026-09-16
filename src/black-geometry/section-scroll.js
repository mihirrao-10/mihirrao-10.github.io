import { chapterState } from './scene-state.js';

// Native snapping is retained for reading, keyboard, hashes and scrollbars.
// Wheel notches need an explicit page step: Chromium otherwise snaps a small
// Windows mouse-wheel delta back to the same page. Absorb a trackpad's fading
// momentum, but let a wheel that keeps turning advance after each page settles.
export function createSectionScroll({ getRanges, getY, getHeight, move, isReduced, isLoading, afterInput = callback => callback() }) {
  let destination = null, direction = 0, lastInput = -Infinity, moving = false, started = 0;
  let lastMagnitude = 0, lastDecay = -Infinity;
  let touch = null, gestureVersion = 0;
  const handle = event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || isLoading() ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const now = performance.now(), sign = Math.sign(event.deltaY), y = getY();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? getHeight() : 1);
    const magnitude = Math.abs(delta);
    const continuing = sign === direction && now - lastInput < 180;
    if (!continuing || magnitude > lastMagnitude * 1.05) lastDecay = -Infinity;
    else if (magnitude < lastMagnitude * .995) lastDecay = now;
    lastMagnitude = magnitude;
    lastInput = now;
    if (destination !== null && sign === direction) {
      const arriving = moving && now - started < 1500 && Math.abs(y - destination) > 2;
      const momentum = continuing && (now - started < 700 || now - lastDecay < 180);
      if (arriving || momentum) { event.preventDefault(); return; }
    }
    destination = null;
    direction = sign;
    const ranges = getRanges(), index = chapterState(y, ranges).index, current = ranges[index];
    if (!current) return;
    const boundary = sign > 0 ? current.stop : current.start;
    const reading = sign > 0 ? y < boundary - 2 : y > boundary + 2;
    if (reading && (sign > 0 ? y + delta < boundary : y + delta > boundary)) return;
    event.preventDefault();
    const adjacent = ranges[index + sign];
    destination = reading ? boundary : adjacent ? (sign > 0 ? adjacent.start : adjacent.stop) : boundary;
    lastDecay = -Infinity;
    moving = true; started = now;
    move(destination, isReduced() ? 'instant' : 'smooth');
  };
  handle.finish = () => { moving = false; };
  handle.reset = () => {
    destination = null; direction = lastMagnitude = 0;
    lastInput = lastDecay = -Infinity; moving = false;
    touch = null; gestureVersion++;
  };
  handle.touchStart = event => {
    handle.reset();
    if (isLoading() || event.touches.length !== 1) return;
    const point = event.touches[0];
    touch = { x: point.clientX, y: point.clientY, origin: getY(), dx: 0, dy: 0 };
  };
  handle.touchMove = event => {
    if (!touch) return;
    if (event.touches.length !== 1) { touch = null; return; }
    const point = event.touches[0];
    touch.dx = point.clientX - touch.x;
    touch.dy = touch.y - point.clientY;
    // Horizontal dragging belongs to sculpture rotation; multi-touch to zoom.
    if (Math.abs(touch.dx) > 8 && Math.abs(touch.dx) > Math.abs(touch.dy)) touch = null;
  };
  handle.touchEnd = () => {
    const gesture = touch; touch = null;
    if (!gesture || isLoading() || Math.abs(gesture.dy) < 36) return;
    const ranges = getRanges(), index = chapterState(gesture.origin, ranges).index, current = ranges[index];
    if (!current) return;
    const sign = Math.sign(gesture.dy), boundary = sign > 0 ? current.stop : current.start;
    const reading = sign > 0 ? gesture.origin < boundary - 2 : gesture.origin > boundary + 2;
    if (reading && Math.abs(gesture.dy) < Math.abs(boundary - gesture.origin)) return;
    const adjacent = ranges[index + sign];
    const top = reading ? boundary : adjacent ? (sign > 0 ? adjacent.start : adjacent.stop) : boundary;
    const version = gestureVersion;
    // Let the browser finish handling touch release, then settle on the entry
    // selected by this swipe, even if native snapping would bounce back.
    afterInput(() => {
      if (version === gestureVersion) move(top, isReduced() ? 'instant' : 'smooth');
    });
  };
  return handle;
}
