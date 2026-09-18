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

// A wheel gesture either reads the current entry or moves to its neighbor.
// Its magnitude must never choose a more distant entry.
export function wheelDestination(y, ranges, direction) {
  for (let index = 0; index < ranges.length; index++) {
    const range = ranges[index];
    if (y >= range.start - 1 && y <= range.stop + 1) {
      const edge = direction > 0 ? range.stop : range.start;
      if (direction * (edge - y) > 1) return { top: edge, reading: true };
      const next = ranges[index + direction];
      return next ? { top: direction > 0 ? next.start : next.stop, reading: false } : null;
    }
  }
  const top = snapDestination(y, ranges, direction);
  return top === null ? null : { top, reading: false };
}

// Keyboard, touch and scrollbar movement remain native. Wheel paging owns only
// entry transitions and their momentum tails; the browser animates each snap.
export function createSectionSnap({ getY, getRanges, move, isReduced, isLoading,
  setTimer = setTimeout, clearTimer = clearTimeout, now = () => performance.now(), getPageHeight = () => innerHeight }) {
  let previous = getY(), direction = 0, snapDirection = 0, timer = null, destination = null;
  let active = false, touching = false, pressing = false, gesture = null;
  const clear = () => { clearTimer(timer); timer = null; };
  const interrupt = () => {
    clear();
    if (destination !== null) { destination = null; move(getY(), 'instant'); }
  };
  const schedule = () => {
    clear();
    if (active && !touching && !pressing && !isLoading()) timer = setTimer(settle, 0);
  };
  function align(top) {
    clear();
    active = false;
    const y = getY();
    destination = top;
    snapDirection = Math.sign(top - y);
    // Commit the compositor's current offset before starting a new animation.
    // WebKit can otherwise animate from the preceding snap's stale position.
    if (!isReduced()) move(y, 'instant');
    move(top, isReduced() ? 'instant' : 'smooth');
    if (Math.abs(top - y) <= 1) destination = null;
  }
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
    align(destination);
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
    if (event.type !== 'wheel') gesture = null;
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
  function wheel(event) {
    if (isLoading() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey ||
      !event.deltaY || Math.abs(event.deltaX || 0) > Math.abs(event.deltaY) || event.isTrusted === false) return;
    if (pressing || touching || !event.cancelable) { input(event); return; }
    const time = Number.isFinite(event.timeStamp) ? event.timeStamp : now(), travel = Math.sign(event.deltaY);
    // This is a gap between wheel packets, not a delay before navigation.
    // Continue consuming momentum even after the destination is reached.
    const fresh = !gesture || time - gesture.at > 200 || gesture.direction !== travel;
    if (fresh) {
      const origin = gesture?.claimed && destination === gesture.top ? gesture.top : getY();
      const target = wheelDestination(origin, getRanges(), travel);
      gesture = target ? { ...target, direction: travel, at: time, claimed: false } : null;
    }
    if (!gesture) { input(event); return; }
    gesture.at = time;
    // Reading within a tall entry stays native, but a large delta or its tail
    // cannot skip the rest of that entry and several following slides.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? getPageHeight() : 1;
    if (gesture.reading && !gesture.claimed && travel * (getY() + event.deltaY * unit - gesture.top) < 0) {
      input(event);
      return;
    }
    event.preventDefault();
    if (!gesture.claimed) {
      gesture.claimed = true;
      align(gesture.top);
    }
  }
  return {
    scroll, input, wheel,
    pointerDown() { gesture = null; pressing = true; if (destination !== null) active = true; interrupt(); },
    pointerUp() { pressing = false; schedule(); },
    touchStart(event) { input(event); touching = event.touches.length > 0; if (event.touches.length > 1) active = false; },
    touchEnd(event) { touching = event.touches.length > 0; schedule(); },
    reset() { gesture = null; active = touching = pressing = false; interrupt(); direction = 0; },
  };
}
