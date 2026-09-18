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
// scroll. Align a partial entry on the next task, without an idle delay.
export function createSectionSnap({ getY, getRanges, move, isReduced, isLoading,
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  let previous = getY(), direction = 0, snapDirection = 0, timer = null, destination = null;
  let active = false, touching = false, pressing = false;
  const clear = () => { clearTimer(timer); timer = null; };
  const interrupt = () => {
    clear();
    if (destination !== null) { destination = null; move(getY(), 'instant'); }
  };
  const schedule = () => {
    clear();
    if (active && !touching && !pressing && !isLoading()) timer = setTimer(settle, 0);
  };
  function settle() {
    timer = null;
    if (!active || touching || pressing || isLoading()) return;
    // A compositor scroll may have advanced before its scroll event arrived.
    if (Math.abs(getY() - previous) > .5) { scroll(); return; }
    destination = snapDestination(getY(), getRanges(), direction);
    if (destination === null) {
      // Already on an entry: expire the input intent after native motion stops.
      // Keep it armed for default scrolling that starts after the input task.
      timer = setTimer(() => { active = false; timer = null; }, 180);
      return;
    }
    active = false;
    snapDirection = Math.sign(destination - getY());
    // Commit the compositor's current offset before starting a new animation.
    // WebKit can otherwise animate from the preceding snap's stale position,
    // briefly jumping backwards. This does not change the visible position.
    if (!isReduced()) move(getY(), 'instant');
    move(destination, isReduced() ? 'instant' : 'smooth');
  }
  function scroll() {
    const y = getY(), delta = y - previous;
    previous = y;
    if (delta) direction = Math.sign(delta);
    if (destination !== null) {
      if (snapDirection * (y - destination) < -1) return;
      destination = null;
    }
    schedule();
  }
  function input(event) {
    if (isLoading() || event.defaultPrevented || event.ctrlKey || event.metaKey) return;
    if (event.type === 'wheel' && !event.deltaY) return;
    if (event.type === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(event.key)) return;
    // Wheel packets in the same direction belong to the ongoing movement.
    // Restarting its easing on every packet causes visible stop/start jitter.
    // Keep the input intent, so native movement past the target can continue.
    if (destination !== null && event.type === 'wheel' && Math.sign(event.deltaY) === snapDirection) {
      active = true;
      return;
    }
    const reversing = destination !== null && event.type === 'wheel';
    interrupt();
    if (reversing) {
      // The cancelled animation may have advanced ahead of its scroll event.
      // Start the reversal at that position, without reusing its old direction.
      previous = getY();
      direction = Math.sign(event.deltaY);
    }
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
