// Scroll position, not wheel packet size or timing, determines the destination.
// Long entries have a readable interval; only the gaps between entries snap.
export function snapDestination(y, ranges, direction) {
  if (!ranges.length || ranges.some(r => y >= r.start - 1 && y <= r.stop + 1)) return null;
  for (let index = 1; index < ranges.length; index++) {
    const before = ranges[index - 1].stop, after = ranges[index].start;
    if (y > before && y < after)
      return direction > 0 ? after : direction < 0 ? before : y - before < after - y ? before : after;
  }
  return null;
}

// Every input listener is passive. The browser performs the entire user's
// scroll, including momentum. Only after it stops do we align a partial entry.
export function createSectionSnap({ getY, getRanges, move, isReduced, isLoading,
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  let previous = getY(), direction = 0, timer = null, destination = null;
  let active = false, touching = false, pressing = false;
  const clear = () => { clearTimer(timer); timer = null; };
  const interrupt = () => {
    clear();
    if (destination !== null) { destination = null; move(getY(), 'instant'); }
  };
  const schedule = () => {
    clear();
    if (active && !touching && !pressing && !isLoading()) timer = setTimer(settle, 180);
  };
  function settle() {
    timer = null;
    if (!active || touching || pressing || isLoading()) return;
    // A compositor scroll may have advanced before its scroll event arrived.
    if (Math.abs(getY() - previous) > .5) { scroll(); return; }
    active = false;
    destination = snapDestination(getY(), getRanges(), direction);
    if (destination !== null) move(destination, isReduced() ? 'instant' : 'smooth');
  }
  function scroll() {
    const y = getY(), delta = y - previous;
    previous = y;
    if (delta) direction = Math.sign(delta);
    if (destination !== null) {
      if (Math.abs(y - destination) <= 1) destination = null;
      return;
    }
    schedule();
  }
  function input(event) {
    if (isLoading() || event.defaultPrevented || event.ctrlKey || event.metaKey) return;
    if (event.type === 'wheel' && !event.deltaY) return;
    if (event.type === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(event.key)) return;
    interrupt();
    active = true;
    // Passive input may arrive after the compositor has moved the page. Keep
    // the position history, and settle even if its scroll event arrived first.
    schedule();
  }
  return {
    scroll, input,
    pointerDown() { pressing = true; if (destination !== null) active = true; interrupt(); },
    pointerUp() { pressing = false; schedule(); },
    touchStart(event) { input(event); touching = event.touches.length > 0; if (event.touches.length > 1) active = false; },
    touchEnd(event) { touching = event.touches.length > 0; schedule(); },
    reset() { active = touching = pressing = false; interrupt(); direction = 0; },
  };
}
