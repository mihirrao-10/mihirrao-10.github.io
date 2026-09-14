import fs from "node:fs/promises";
import { webkit } from "playwright";
const browser = await webkit.launch();
const report = {
  browser: browser.version(),
  engine: "WebKit",
  mode: "headless",
  viewport: [1440, 900],
  deviceScale: 2,
  measurements: [],
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto("http://127.0.0.1:8000/?bg-debug");
  await page.waitForFunction(
    () => document.body.dataset.experienceState === "ready",
  );
  await page.waitForTimeout(1000);
  for (const id of ["top", "project-surface", "project-congestion"]) {
    await page.evaluate(
      (id) =>
        window.scrollTo(
          0,
          document.getElementById(id).getBoundingClientRect().top +
            scrollY -
            105,
        ),
      id,
    );
    const measurement = await page.evaluate(async () => {
      const intervals = [];
      let previous = 0,
        frames = window.__blackGeometry.snapshot().world.frames;
      await new Promise((resolve) => {
        function sample(t) {
          const count = window.__blackGeometry.snapshot().world.frames;
          if (count !== frames) {
            if (previous) intervals.push(t - previous);
            previous = t;
            frames = count;
          }
          if (intervals.length === 150) resolve();
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      intervals.sort((a, b) => a - b);
      const gl = document.querySelector("canvas").getContext("webgl2"),
        ext = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        samples: intervals.length,
        p50: intervals[75],
        p95: intervals[142],
        max: intervals.at(-1),
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unreported",
        snapshot: window.__blackGeometry.snapshot(),
      };
    });
    report.measurements.push({ chapter: id, ...measurement });
    console.log(
      `${id}: p95 ${measurement.p95.toFixed(2)} ms; ${measurement.gpu}`,
    );
  }
} finally {
  await fs.writeFile(
    ".artifacts/black-geometry/reports/webkit-performance.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
