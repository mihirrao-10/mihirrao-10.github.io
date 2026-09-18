// WheelEvent has no portable finger-up or momentum-phase flag. Recognize a
// renewed push from the input's velocity shape, as well as a pause or reversal.
// In particular, a new swipe need not wait for the previous momentum to stop.
export function createWheelIntent() {
  let at = -Infinity, direction = 0, last = 0, peak = 0, low = Infinity, lowSpeed = Infinity;
  let falls = 0, renewal = 0, coasting = false;
  function begin(size, speed, travel, time) {
    at = time; direction = travel; last = peak = low = size;
    lowSpeed = speed;
    falls = renewal = 0; coasting = false;
    return true;
  }
  return {
    reset() { at = -Infinity; },
    push(delta, time) {
      const gap = time - at, travel = Math.sign(delta), size = Math.abs(delta);
      // Coalesced packets contain more distance over a longer interval. Compare
      // their speed so uneven browser delivery does not invent a fresh push.
      const speed = size * 16 / (gap > 200 ? 16 : Math.max(8, gap));
      if (!size) return false;
      if (gap > 200 || travel !== direction) return begin(size, speed, travel, time);
      at = time;
      if (size < last - .05) falls++;
      else if (size > last + .05) falls = 0;
      if (!coasting && falls >= 2 && size <= peak * .5) {
        coasting = true;
        low = size;
        lowSpeed = speed;
      }
      if (coasting) {
        // One stray larger packet in a decaying tail is not a new swipe.
        // Confirm renewed or sustained force across packets; a large impulse
        // out of a nearly exhausted tail can be recognized immediately.
        const renewed = size >= Math.max(3, low * 1.6, low + 2) && speed >= Math.max(3, lowSpeed * 1.6, lowSpeed + 2);
        renewal = renewed && size >= last - .05 ? renewal + 1 : 0;
        const impulse = size >= Math.max(12, low * 6) && speed >= Math.max(12, lowSpeed * 6);
        if (renewal >= 2 || impulse) return begin(size, speed, travel, time);
        low = Math.min(low, size);
        lowSpeed = Math.min(lowSpeed, speed);
      }
      last = size;
      peak = Math.max(peak, size);
      return false;
    },
  };
}
