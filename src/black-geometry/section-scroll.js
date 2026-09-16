import { chapterState } from './scene-state.js';

// Native snapping is retained for touch, keyboard, hashes and scrollbars.
// Wheel notches need an explicit page step: Chromium otherwise snaps a small
// Windows mouse-wheel delta back to the same page. A gesture owns one step,
// including its trailing trackpad momentum.
export function createSectionScroll({ getRanges, getY, getHeight, move, isReduced, isLoading }) {
  let destination = null, direction = 0, lastInput = -Infinity, accumulated = 0, moving = false, started = 0;
  const handle = event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || isLoading() ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const now = performance.now(), sign = Math.sign(event.deltaY), y = getY();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? getHeight() : 1);
    const continuing = sign === direction && now - lastInput < 180;
    if (destination !== null && sign === direction && (continuing || (moving && now - started < 1500 && Math.abs(y - destination) > 2))) {
      event.preventDefault(); lastInput = now; return;
    }
    destination = null;
    accumulated = continuing ? accumulated + delta : delta;
    direction = sign; lastInput = now;
    const ranges = getRanges(), index = chapterState(y, ranges).index, current = ranges[index];
    if (!current) return;
    const boundary = sign > 0 ? current.stop : current.start;
    const reading = sign > 0 ? y < boundary - 2 : y > boundary + 2;
    if (reading && (sign > 0 ? y + delta < boundary : y + delta > boundary)) return;
    event.preventDefault();
    if (Math.abs(accumulated) < 32) return;
    const adjacent = ranges[index + sign];
    destination = reading ? boundary : adjacent ? (sign > 0 ? adjacent.start : adjacent.stop) : boundary;
    accumulated = 0;
    moving = true; started = now;
    move(destination, isReduced() ? 'instant' : 'smooth');
  };
  handle.finish = () => { moving = false; };
  handle.reset = () => { destination = null; direction = accumulated = 0; lastInput = -Infinity; moving = false; };
  return handle;
}
