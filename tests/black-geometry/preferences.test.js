import test from "node:test";
import assert from "node:assert/strict";
import {
  readPreferences,
  savePreferences,
  motionPolicy,
  qualityPolicy,
  assessPerformance,
  DEFAULTS,
} from "../../src/black-geometry/preferences.js";
test("missing, malformed, denied, and unknown preferences use conservative defaults", () => {
  for (const value of [
    null,
    "nonsense",
    "null",
    "[]",
    '{"motion":"yes","quality":"ultra"}',
  ])
    assert.deepEqual(readPreferences({ getItem: () => value }), DEFAULTS);
  assert.deepEqual(
    readPreferences({
      getItem() {
        throw new Error("denied");
      },
    }),
    DEFAULTS,
  );
  assert.equal(
    savePreferences(
      {
        setItem() {
          throw new Error("denied");
        },
      },
      DEFAULTS,
    ),
    false,
  );
});
test("motion follows OS changes unless explicitly overridden, and On is session-only", () => {
  assert.equal(motionPolicy("system", false), "full");
  assert.equal(motionPolicy("system", true), "reduced");
  assert.equal(motionPolicy("on", true), "full");
  assert.equal(motionPolicy("off", false), "off");
  let saved;
  savePreferences(
    {
      setItem: (_, value) => {
        saved = value;
      },
    },
    { motion: "on", quality: "high" },
  );
  assert.deepEqual(readPreferences({ getItem: () => saved }), {
    motion: "system",
    quality: "high",
  });
});
test("quality respects explicit choices, viewport capability and one-way automatic downgrade", () => {
  assert.equal(qualityPolicy("auto", { width: 390, cores: 8 }), "low");
  assert.equal(qualityPolicy("auto", { width: 1440, cores: 4 }), "low");
  assert.equal(qualityPolicy("auto", { width: 1440, cores: 8 }), "medium");
  assert.equal(
    qualityPolicy("auto", { width: 1440, cores: 8, downgraded: true }),
    "low",
  );
  assert.equal(qualityPolicy("high", { width: 390, downgraded: true }), "high");
  assert.equal(assessPerformance(Array(90).fill(40), 0).downgrade, false);
  assert.equal(assessPerformance(Array(90).fill(40), 1).downgrade, true);
  assert.equal(assessPerformance(Array(90).fill(16), 1).slowWindows, 0);
  assert.equal(assessPerformance([200], 1).downgrade, false);
});
