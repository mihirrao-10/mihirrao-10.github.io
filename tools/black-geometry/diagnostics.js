import fs from "node:fs/promises";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const output = ".artifacts/black-geometry/reports";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {
  browser: browser.version(),
  mode: "headless",
  performance: [],
  contrast: [],
  visibilityMethod:
    "Controlled document.hidden + visibilitychange in the real browser. Window minimization/foreground selection remained visible under automation; not claimed as physical tab observation.",
};
const ready = async (page) => {
  await page.goto("http://127.0.0.1:8000/?bg-debug");
  await page.waitForFunction(
    () =>
      document.body.dataset.experienceState === "ready" &&
      getComputedStyle(document.querySelector(".hero-art")).opacity === "0",
  );
};
try {
  for (const [label, width, height, choice] of [
    ["desktop-auto", 1440, 900, "auto"],
    ["desktop-high", 1440, 900, "high"],
    ["phone-low", 390, 844, "low"],
  ]) {
    const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
      }),
      page = await context.newPage();
    await ready(page);
    if (choice !== "auto") {
      await page.locator("#display-settings summary").click();
      await page.locator("#quality-setting").selectOption(choice);
      await page.keyboard.press("Escape");
    }
    if (choice === "auto")
      await page.waitForFunction(
        () => window.__blackGeometry.snapshot().world.frames >= 230,
        {},
        { timeout: 25000 },
      );
    else await page.waitForTimeout(1000);
    const metrics = await page.evaluate(async () => {
      const initial = window.__blackGeometry.snapshot(),
        intervals = [];
      let previous = 0,
        frames = initial.world.frames;
      await new Promise((resolve) => {
        function sample(t) {
          const current = window.__blackGeometry.snapshot();
          if (current.world.frames !== frames) {
            if (previous) intervals.push(t - previous);
            previous = t;
            frames = current.world.frames;
          }
          if (intervals.length >= 150) resolve();
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      intervals.sort((a, b) => a - b);
      const gl = document.querySelector("canvas").getContext("webgl2"),
        ext = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        viewport: [innerWidth, innerHeight],
        deviceScale: devicePixelRatio,
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unreported",
        samples: intervals.length,
        p50: intervals[75],
        p95: intervals[142],
        max: intervals.at(-1),
        mean: intervals.reduce((a, b) => a + b, 0) / intervals.length,
        snapshot: window.__blackGeometry.snapshot(),
      };
    });
    report.performance.push({ label, ...metrics });
    console.log(
      `${label}: p95 ${metrics.p95.toFixed(2)} ms, ${metrics.snapshot.profile}, DPR ${metrics.snapshot.world.dpr}`,
    );
    await context.close();
  }
  const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    }),
    page = await context.newPage();
  await ready(page);
  for (const id of [
    "top",
    "education",
    "experience",
    "research",
    "teaching",
    "project-surface",
    "project-congestion",
    "notes",
    "contact",
  ]) {
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
    await page.waitForTimeout(100);
    const rectangles = await page.evaluate(() => {
      const result = [],
        walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode,
          parent = node.parentElement;
        if (
          !node.textContent.trim() ||
          !parent ||
          parent.closest('script,style,[hidden],[aria-hidden="true"],.sr-only')
        )
          continue;
        if (parent.closest("details:not([open])") && !parent.closest("summary"))
          continue;
        const style = getComputedStyle(parent);
        if (style.visibility === "hidden" || style.display === "none") continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects())
          if (
            rect.width > 1 &&
            rect.height > 1 &&
            rect.top > 75 &&
            rect.bottom < innerHeight &&
            rect.left >= 0 &&
            rect.right <= innerWidth
          ) {
            const fontSize = parseFloat(style.fontSize),
              bold = parseInt(style.fontWeight) >= 700;
            result.push({
              text: node.textContent.trim().slice(0, 70),
              color: style.color,
              minimum: fontSize >= 24 || (fontSize >= 18.66 && bold) ? 3 : 4.5,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            });
          }
      }
      return result;
    });
    const style = await page.addStyleTag({
      content:
        "body * { color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; -webkit-text-fill-color: transparent !important; }",
    });
    const background = await page.screenshot();
    await style.evaluate((el) => el.remove());
    const contrasts = await page.evaluate(
      async ({ data, rectangles }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
        function luminance(rgb) {
          return rgb
            .map((v) => {
              v /= 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        }
        return rectangles.map((rect) => {
          const fg = luminance(
            rect.color
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number),
          );
          let maximum = 0;
          for (let y = Math.ceil(rect.y); y < rect.y + rect.height; y += 2)
            for (let x = Math.ceil(rect.x); x < rect.x + rect.width; x += 2) {
              const i = (y * img.width + x) * 4;
              maximum = Math.max(
                maximum,
                luminance([pixels[i], pixels[i + 1], pixels[i + 2]]),
              );
            }
          return {
            text: rect.text,
            ratio: (fg + 0.05) / (maximum + 0.05),
            minimum: rect.minimum,
          };
        });
      },
      { data: background.toString("base64"), rectangles },
    );
    report.contrast.push({
      chapter: id,
      sampledTextRects: contrasts.length,
      worst: contrasts.sort((a, b) => a.ratio - b.ratio)[0],
      failures: contrasts.filter((item) => item.ratio < item.minimum),
    });
  }
  assert.ok(
    report.contrast.every((check) => check.failures.length === 0),
    "Composited text contrast failed",
  );
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  await page.waitForFunction(
    () => window.__blackGeometry.snapshot().audio.enabled,
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(150);
  const hiddenA = await page.evaluate(() => window.__blackGeometry.snapshot());
  await page.waitForTimeout(250);
  const hiddenB = await page.evaluate(() => window.__blackGeometry.snapshot());
  assert.equal(hiddenA.world.frames, hiddenB.world.frames);
  assert.equal(hiddenB.pendingFrame, false);
  assert.equal(hiddenB.audio.state, "suspended");
  assert.equal(hiddenB.audio.voices, 0);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(250);
  const returned = await page.evaluate(() => window.__blackGeometry.snapshot());
  assert.ok(returned.world.frames > hiddenB.world.frames);
  assert.equal(returned.audio.enabled, false);
  assert.ok(returned.lastDelta <= 0.05);
  report.visibility = { hiddenA, hiddenB, returned };
  await context.close();

  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const touchPage = await touchContext.newPage();
  await ready(touchPage);
  const cdp = await touchContext.newCDPSession(touchPage);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 180, y: 680 }],
  });
  for (let y = 650; y >= 290; y -= 30) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 180, y }],
    });
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touchPage.waitForTimeout(250);
  report.touch = { scrollY: await touchPage.evaluate(() => scrollY) };
  assert.ok(
    report.touch.scrollY > 200,
    "Native touch scroll did not move the document",
  );
  await touchPage.goto("http://127.0.0.1:8000/?bg-debug#project-congestion");
  await touchPage
    .getByRole("button", { name: "Shortcut closed", exact: true })
    .tap();
  report.touch.shortcut = await touchPage
    .locator('[data-shortcut="closed"]')
    .getAttribute("aria-pressed");
  assert.equal(report.touch.shortcut, "true");
  await touchContext.close();

  const zoomContext = await browser.newContext({
      viewport: { width: 720, height: 450 },
      deviceScaleFactor: 2,
    }),
    zoomPage = await zoomContext.newPage();
  await ready(zoomPage);
  report.zoom = {
    method:
      "200% desktop reflow equivalent: 720×450 CSS pixels rendered at DPR 2 into a 1440×900 image. CSS root zoom is separately tested in both engines.",
    overflow: await zoomPage.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  };
  assert.equal(report.zoom.overflow, false);
  await zoomPage.screenshot({
    path: ".artifacts/black-geometry/screenshots/zoom-200-reflow.png",
  });
  await zoomContext.close();
  await fs.writeFile(
    `${output}/diagnostics.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        contrast: report.contrast,
        touch: report.touch,
        hiddenFrames: [hiddenA.world.frames, hiddenB.world.frames],
        returnedFrame: returned.world.frames,
      },
      null,
      2,
    ),
  );
} finally {
  await fs.writeFile(
    `${output}/diagnostics.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
