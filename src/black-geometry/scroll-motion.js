// Drive page transitions ourselves. Native smooth scrolling can be interrupted
// by additional wheel packets before reaching its destination. While this move
// runs, CSS snapping must not compete with its intermediate positions.
export function createScrollMotion({ read, write, setSnapping, requestFrame, cancelFrame, onComplete,
  now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  let frame = 0, timer = 0, animation = null;
  function finish() {
    if (frame) cancelFrame(frame);
    if (timer) clearTimer(timer);
    frame = timer = 0;
    animation = null;
    setSnapping(true);
    onComplete();
  }
  function step(time) {
    frame = 0;
    if (!animation) return;
    const progress = Math.min(1, Math.max(0, (time - animation.started) / 420));
    const eased = 1 - (1 - progress) ** 3;
    write(animation.from + (animation.top - animation.from) * eased);
    if (progress === 1) finish();
    else frame = requestFrame(step);
  }
  return {
    move(top, behavior) {
      if (frame) cancelFrame(frame);
      if (timer) clearTimer(timer);
      frame = timer = 0;
      const from = read();
      setSnapping(false);
      if (behavior === 'instant' || Math.abs(top - from) <= 1) {
        write(top);
        finish();
      } else {
        animation = { from, top, started: now() };
        frame = requestFrame(step);
        const current = animation;
        // A suspended/stalled animation frame must not leave navigation stuck.
        // This is a scroll completion deadline; asset loading has no deadline.
        timer = setTimer(() => {
          if (animation !== current) return;
          write(top);
          finish();
        }, 700);
      }
    },
    cancel() {
      if (animation) finish();
    },
  };
}
