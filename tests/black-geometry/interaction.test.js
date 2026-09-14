import test from "node:test";
import assert from "node:assert/strict";
import { createInteraction } from "../../src/black-geometry/interaction.js";

class Stage extends EventTarget {
  dataset = {};
  attributes = new Map();
  captures = new Set();
  ownerDocument = { activeElement: null };
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { this.ownerDocument.activeElement = null; }
  getBoundingClientRect() { return { width: 600, height: 700 }; }
}
function setup() {
  const element = new Stage(), hint = { hidden: true };
  const control = createInteraction({ element, hint });
  const send = (type, properties = {}) => {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({
      pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true,
      clientX: 200, clientY: 200, timeStamp: 0, ...properties,
    })) Object.defineProperty(event, key, { value });
    element.dispatchEvent(event);
    return event;
  };
  return { element, hint, control, send };
}
function fling() {
  const setupResult = setup(), { control, send } = setupResult;
  control.setEnabled(true);
  send("pointerdown");
  send("pointermove", { clientX: 260, clientY: 215, timeStamp: 40 });
  send("pointerup", { timeStamp: 45 });
  return setupResult;
}

test("drag captures the pointer, rotates directly and settles after release", () => {
  const { control, element, hint, send } = setup();
  send("pointerdown");
  assert.equal(control.snapshot().dragging, false);
  control.setEnabled(true);
  assert.equal(element.attributes.get("tabindex"), "0");
  assert.equal(hint.hidden, false);
  assert.equal(send("pointerdown").defaultPrevented, true);
  assert.equal(element.hasPointerCapture(1), true);
  assert.equal(element.ownerDocument.activeElement, element);
  send("pointermove", { clientX: 240, clientY: 230, timeStamp: 30 });
  const held = control.snapshot();
  assert.ok(held.rotation[0] > 0 && held.rotation[1] > 0);
  control.step(1);
  assert.deepEqual(control.snapshot().rotation, held.rotation);
  send("pointerup", { timeStamp: 35 });
  assert.equal(element.hasPointerCapture(1), false);
  control.step(0.1);
  const released = control.snapshot();
  assert.ok(released.rotation[1] > held.rotation[1]);
  assert.ok(released.velocity[1] < held.velocity[1]);
  for (let i = 0; i < 300; i++) control.step(1 / 60);
  assert.deepEqual(control.snapshot().velocity, [0, 0]);
});

test("inertial integration is independent of display refresh rate", () => {
  const a = fling().control, b = fling().control;
  for (let i = 0; i < 60; i++) a.step(1 / 60);
  for (let i = 0; i < 30; i++) b.step(1 / 30);
  for (let index = 0; index < 2; index++) {
    assert.ok(Math.abs(a.snapshot().rotation[index] - b.snapshot().rotation[index]) < 1e-12);
    assert.ok(Math.abs(a.snapshot().velocity[index] - b.snapshot().velocity[index]) < 1e-12);
  }
  const before = a.snapshot();
  a.step(NaN); a.step(-1);
  assert.deepEqual(a.snapshot(), before);
});

test("touch reserves vertical gestures for page scrolling and captures horizontal rotation", () => {
  const { control, element, send } = setup();
  control.setEnabled(true);
  assert.equal(send("pointerdown", { pointerType: "touch" }).defaultPrevented, false);
  assert.equal(element.captures.size, 0);
  const vertical = send("pointermove", { pointerType: "touch", clientX: 202, clientY: 240, timeStamp: 30 });
  assert.equal(vertical.defaultPrevented, false);
  assert.equal(control.snapshot().pointerId, null);
  assert.deepEqual(control.snapshot().rotation, [0, 0]);
  send("pointerdown", { pointerType: "touch", timeStamp: 60 });
  const horizontal = send("pointermove", { pointerType: "touch", clientX: 255, clientY: 208, timeStamp: 90 });
  assert.equal(horizontal.defaultPrevented, true);
  assert.equal(control.snapshot().dragging, true);
  assert.equal(element.hasPointerCapture(1), true);
  assert.equal(control.snapshot().rotation[0], 0);
  assert.ok(control.snapshot().rotation[1] > 0);
});

test("secondary buttons, non-primary pointers and unrelated releases cannot disturb a drag", () => {
  const { control, send } = setup();
  control.setEnabled(true);
  send("pointerdown", { button: 2 });
  send("pointerdown", { isPrimary: false });
  assert.equal(control.snapshot().pointerId, null);
  send("pointerdown", { pointerType: "pen" });
  send("pointermove", { pointerId: 2, clientX: 300, timeStamp: 30 });
  send("pointerup", { pointerId: 2 });
  assert.equal(control.snapshot().dragging, true);
  assert.deepEqual(control.snapshot().rotation, [0, 0]);
});

test("pitch stays bounded and yaw crosses full revolutions continuously", () => {
  const { control, send } = setup();
  control.setEnabled(true);
  send("pointerdown");
  send("pointermove", { clientX: 795, clientY: 20000, timeStamp: 40 });
  const before = control.snapshot().rotation;
  send("pointermove", { clientX: 805, clientY: 22000, timeStamp: 80 });
  const after = control.snapshot().rotation;
  assert.equal(after[0], 1.15);
  assert.ok(after[1] > Math.PI * 2);
  assert.ok(after[1] - before[1] < 0.11);
  send("pointermove", { clientX: 805, clientY: -22000, timeStamp: 120 });
  assert.equal(control.snapshot().rotation[0], -1.15);
  assert.equal(control.snapshot().velocity[0], 0);
});

test("focused arrow keys rotate and Home resets without taking unrelated keyboard input", () => {
  const { control, element, send } = setup();
  assert.equal(send("keydown", { key: "ArrowRight" }).defaultPrevented, false);
  control.setEnabled(true);
  assert.equal(send("keydown", { key: "ArrowRight", target: {} }).defaultPrevented, false);
  assert.equal(send("keydown", { key: "ArrowRight", ctrlKey: true }).defaultPrevented, false);
  assert.equal(send("keydown", { key: "PageDown" }).defaultPrevented, false);
  element.focus();
  assert.equal(send("keydown", { key: "ArrowRight" }).defaultPrevented, true);
  send("keydown", { key: "ArrowUp", shiftKey: true });
  assert.deepEqual(control.snapshot().rotation, [-0.3, 0.12]);
  assert.equal(send("keydown", { key: "Home" }).defaultPrevented, true);
  assert.deepEqual(control.snapshot().rotation, [0, 0]);
});

for (const reason of ["pointercancel", "lostpointercapture", "disable", "dispose"])
  test(`${reason} clears capture and momentum while retaining the chosen orientation`, () => {
    const { control, element, hint, send } = setup();
    control.setEnabled(true);
    send("pointerdown");
    send("pointermove", { clientX: 260, timeStamp: 30 });
    const chosen = control.snapshot().rotation;
    if (reason === "disable") control.setEnabled(false);
    else if (reason === "dispose") control.dispose();
    else send(reason);
    assert.equal(control.snapshot().dragging, false);
    assert.equal(control.snapshot().pointerId, null);
    assert.equal(element.captures.size, 0);
    control.step(1);
    assert.deepEqual(control.snapshot().rotation, chosen);
    assert.deepEqual(control.snapshot().velocity, [0, 0]);
    if (["disable", "dispose"].includes(reason)) {
      assert.equal(element.attributes.has("tabindex"), false);
      assert.equal(element.attributes.get("aria-hidden"), "true");
      assert.equal(element.ownerDocument.activeElement, null);
      assert.equal(hint.hidden, true);
    }
    if (reason === "dispose") {
      control.setEnabled(true);
      send("pointerdown");
      assert.equal(control.snapshot().enabled, false);
      assert.equal(control.snapshot().dragging, false);
    }
  });

test("holding still before release does not launch stale momentum", () => {
  const { control, send } = setup();
  control.setEnabled(true);
  send("pointerdown");
  send("pointermove", { clientX: 260, timeStamp: 30 });
  send("pointerup", { timeStamp: 300 });
  const chosen = control.snapshot().rotation;
  control.step(1);
  assert.deepEqual(control.snapshot().rotation, chosen);
  assert.deepEqual(control.snapshot().velocity, [0, 0]);
});
