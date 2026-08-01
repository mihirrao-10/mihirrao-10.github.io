import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarDate,
  normalizeCategory,
  normalizeLocations,
  normalizeWorkplaceType,
  stableJobId,
} from "../../tools/job-tracker/lib/normalization.js";

test("board dates use the configured calendar timezone", () => {
  assert.equal(
    calendarDate("2026-08-01T02:00:00Z", "America/New_York"),
    "2026-07-31",
  );
  assert.throws(
    () => calendarDate("2026-08-01T02:00:00Z", "Not/A_Time_Zone"),
    RangeError,
  );
});

test("category normalization prioritizes specialized roles", () => {
  assert.equal(
    normalizeCategory("New Grad Quantitative Developer"),
    "Quantitative Development",
  );
  assert.equal(
    normalizeCategory("Machine Learning Engineer, University Graduate"),
    "Machine Learning / AI Engineering",
  );
  assert.equal(
    normalizeCategory("Entry Level Applied Scientist"),
    "Data Science / Applied Science / Analytics",
  );
  assert.equal(
    normalizeCategory("Graduate Compiler Engineer"),
    "Systems / Infrastructure / Performance Engineering",
  );
  assert.equal(normalizeCategory("Technical Analyst"), "Other Technical");
});

test("location and workplace normalization is deterministic", () => {
  assert.deepEqual(
    normalizeLocations(["New York, NY | Boston, MA", "new york, ny"]),
    ["New York, NY", "Boston, MA"],
  );
  assert.equal(normalizeWorkplaceType("Hybrid - New York"), "Hybrid");
  assert.equal(normalizeWorkplaceType("Remote, US"), "Remote");
});

test("stable job IDs do not change with repeated generation", () => {
  const first = stableJobId("example-greenhouse", "123", "https://example.com");
  const second = stableJobId("example-greenhouse", "123", "https://example.com");
  assert.equal(first, second);
  assert.match(first, /^example-greenhouse-[a-f0-9]{16}$/);
});
