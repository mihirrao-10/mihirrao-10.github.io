import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
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
  const surface = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(...held.orientation));
  assert.ok(surface.x > 0 && surface.y < 0, 'Right/down drag moves the visible surface right/down');
  assert.ok(Math.abs(-surface.y / surface.x - 30 / 40) < 1e-12, 'A diagonal gesture preserves its screen direction');
  control.step(1);
  assert.deepEqual(control.snapshot().rotation, held.rotation);
  assert.deepEqual(control.snapshot().orientation, held.orientation);
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
  const qa = new THREE.Quaternion(...a.snapshot().orientation), qb = new THREE.Quaternion(...b.snapshot().orientation);
  assert.ok(1 - Math.abs(qa.dot(qb)) < 1e-12, 'Inertia reaches the same physical orientation at either display rate');
  const before = a.snapshot();
  a.step(NaN); a.step(-1);
  assert.deepEqual(a.snapshot(), before);
});

test("entering another sculpture releases a held drag and clears its inherited orientation and momentum", () => {
  const { control, element, send } = setup();
  control.setEnabled(true); send('pointerdown');
  send('pointermove', { clientX: 330, clientY: 260, timeStamp: 40 });
  assert.notDeepEqual(control.snapshot().orientation, [0, 0, 0, 1]);
  control.reset(); control.step(1);
  assert.deepEqual(control.snapshot().orientation, [0, 0, 0, 1]);
  assert.deepEqual(control.snapshot().velocity, [0, 0]);
  assert.equal(control.snapshot().dragging, false);
  assert.equal(element.captures.size, 0);
  assert.equal(control.snapshot().enabled, true);
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
  assert.deepEqual(control.snapshot().orientation, [0, 0, 0, 1]);
  send("pointerdown", { pointerType: "touch", timeStamp: 60 });
  const horizontal = send("pointermove", { pointerType: "touch", clientX: 255, clientY: 208, timeStamp: 90 });
  assert.equal(horizontal.defaultPrevented, true);
  assert.equal(control.snapshot().dragging, true);
  assert.equal(element.hasPointerCapture(1), true);
  assert.equal(control.snapshot().rotation[0], 0);
  assert.ok(control.snapshot().rotation[1] > 0);
  const surface = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(...control.snapshot().orientation));
  assert.ok(surface.x > 0 && surface.y === 0, 'Horizontal touch turns the front surface right without vertical rotation');
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

test("vertical rotation passes through complete turns without a pole clamp or discontinuity", () => {
  const { control, send } = setup();
  control.setEnabled(true);
  send("pointerdown");
  let previous = new THREE.Quaternion();
  for (let step = 1; step <= 120; step++) {
    send("pointermove", { clientY: 200 + step * 10, timeStamp: step * 16 });
    const next = new THREE.Quaternion(...control.snapshot().orientation);
    assert.ok(next.angleTo(previous) > 0.05 && next.angleTo(previous) < 0.053, 'Every movement continues through the poles and the full revolution');
    assert.ok(Math.abs(next.length() - 1) < 1e-12);
    previous = next;
  }
  assert.ok(previous.angleTo(new THREE.Quaternion()) < 1e-6, 'One complete drag revolution returns to the original physical orientation');
  assert.ok(Math.abs(control.snapshot().rotation[0] - 2 * Math.PI) < 1e-12);
  send("pointermove", { clientY: 1410, timeStamp: 1936 });
  assert.ok(control.snapshot().rotation[0] > 2 * Math.PI, 'Rotation continues beyond one turn');
});

test("all drag directions move a currently visible surface point correctly after arbitrary orientation and camera changes", () => {
  const cameras = [new THREE.Quaternion(), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6, 1.2, 0.35))];
  for (const cameraOrientation of cameras) for (const prior of [false, true]) {
    for (const [dx, dy] of [[12, 0], [-12, 0], [0, 12], [0, -12], [12, 12], [-12, 12], [12, -12], [-12, -12]]) {
      const { control, send } = setup(); control.setEnabled(true); send("pointerdown");
      let x = 200, y = 200, time = 0;
      if (prior) for (const [mx, my] of [[370, 210], [-190, 340], [530, -280]]) {
        x += mx; y += my; time += 30;
        send("pointermove", { clientX: x, clientY: y, timeStamp: time });
      }
      const before = new THREE.Quaternion(...control.snapshot().orientation);
      const point = new THREE.Vector3(0, 0, 1).applyQuaternion(before.clone().invert()).applyQuaternion(cameraOrientation);
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
      camera.position.set(0, 0, 12).applyQuaternion(cameraOrientation); camera.quaternion.copy(cameraOrientation); camera.updateMatrixWorld(true);
      const project = (orientation) => point.clone().applyQuaternion(cameraOrientation.clone().multiply(orientation).multiply(cameraOrientation.clone().invert())).project(camera);
      const start = project(before);
      send("pointermove", { clientX: x + dx, clientY: y + dy, timeStamp: time + 30 });
      const end = project(new THREE.Quaternion(...control.snapshot().orientation));
      const screenDx = end.x - start.x, screenDy = start.y - end.y;
      if (dx) assert.ok(screenDx * dx > 0, 'Visible surface follows the horizontal pointer direction');
      else assert.ok(Math.abs(screenDx) < 1e-12, 'Vertical drag adds no horizontal movement');
      if (dy) assert.ok(screenDy * dy > 0, 'Visible surface follows the vertical pointer direction');
      else assert.ok(Math.abs(screenDy) < 1e-12, 'Horizontal drag adds no vertical movement');
      if (dx && dy) assert.ok(Math.abs(screenDy / screenDx - dy / dx) < 1e-10, 'Diagonal direction is preserved after previous rotations');
      control.dispose();
    }
  }
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
  const surface = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(...control.snapshot().orientation));
  assert.ok(surface.x > 0 && surface.y > 0, 'ArrowRight then ArrowUp moves the visible surface right then up');
  assert.equal(send("keydown", { key: "Home" }).defaultPrevented, true);
  assert.deepEqual(control.snapshot().rotation, [0, 0]);
  assert.deepEqual(control.snapshot().orientation, [0, 0, 0, 1]);
});

for (const reason of ["pointercancel", "lostpointercapture", "disable", "dispose"])
  test(`${reason} clears capture and momentum while retaining the chosen orientation`, () => {
    const { control, element, hint, send } = setup();
    control.setEnabled(true);
    send("pointerdown");
    send("pointermove", { clientX: 260, timeStamp: 30 });
    const chosen = control.snapshot().orientation;
    if (reason === "disable") control.setEnabled(false);
    else if (reason === "dispose") control.dispose();
    else send(reason);
    assert.equal(control.snapshot().dragging, false);
    assert.equal(control.snapshot().pointerId, null);
    assert.equal(element.captures.size, 0);
    control.step(1);
    assert.deepEqual(control.snapshot().orientation, chosen);
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
  const chosen = control.snapshot().orientation;
  control.step(1);
  assert.deepEqual(control.snapshot().orientation, chosen);
  assert.deepEqual(control.snapshot().velocity, [0, 0]);
});
