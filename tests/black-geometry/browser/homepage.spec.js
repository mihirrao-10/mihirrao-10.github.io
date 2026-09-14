import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const baseline = JSON.parse(
  await fs.readFile(
    new URL("../fixtures/content-baseline.json", import.meta.url),
    "utf8",
  ),
);
const output = ".artifacts/black-geometry/screenshots";
await fs.mkdir(output, { recursive: true });
const snapshot = (page) =>
  page.evaluate(() => window.__blackGeometry.snapshot());
async function ready(page, url = "/?bg-debug") {
  await page.goto(url);
  await page.evaluate(() => document.fonts?.ready);
  await expect(page.locator("body")).toHaveAttribute(
    "data-experience-state",
    "ready",
  );
  await expect
    .poll(() =>
      page.locator("#sculpture-poster").evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe("0");
}
const identities = [
  ["hero", "hero"], ["education-uchicago", "harper"],
  ["education-drexel", "dragon"], ["experience-mathworks", "membrane"],
  ["experience-resolution", "neutral"], ["research-drexel", "dragon"],
  ["teaching-uchicago", "harper"], ["teaching-drexel", "dragon"],
  ["project-surface", "surface"], ["project-congestion", "congestion"],
  ["notes", "neutral"], ["contact", "neutral"],
];
async function jump(page, id) {
  const chapter = id === "top" ? "hero" : id;
  await page.evaluate((chapter) => {
    const { ranges } = window.__blackGeometry.snapshot();
    const index = ranges.findIndex((range) => range.id === chapter);
    if (index < 0) throw new Error(`Missing measured entry: ${chapter}`);
    const range = ranges[index];
    const interval = (ranges[index + 1]?.start ?? range.end) - range.start;
    window.scrollTo(0, chapter === "hero" ? 0 : range.start + Math.min(8, interval * 0.1));
  }, chapter);
  await expect.poll(async () => (await snapshot(page)).state.chapter).toBe(chapter);
  await expect.poll(async () => (await snapshot(page)).state.blend).toBe(0);
}
function assertActiveGeometry(state, expectedTarget) {
  expect(state.world.target).toBe(expectedTarget);
  expect(state.world.drawCalls).toBeGreaterThan(0);
  expect(state.world.triangles).toBeGreaterThan(1000);
  expect(state.world.decodedTargets).toBeLessThanOrEqual(2);
  expect(state.world.finiteActiveBuffers).toBe(true);
}
async function audioContextCapture(page) {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext || window.webkitAudioContext;
    const nativeCreateGain = NativeContext.prototype.createGain;
    const nativeConnect = AudioNode.prototype.connect;
    window.__audioContexts = [];
    window.AudioContext = class extends NativeContext {
      constructor(...args) {
        super(...args);
        window.__audioContexts.push(this);
      }
      createGain() {
        const gain = nativeCreateGain.call(this);
        const context = this;
        gain.connect = function (destination, ...args) {
          if (destination === context.destination && !context.__outputAnalyser) {
            const analyser = context.createAnalyser();
            analyser.fftSize = 1024;
            const silentTap = nativeCreateGain.call(context);
            silentTap.gain.value = 0;
            nativeConnect.call(gain, analyser);
            nativeConnect.call(analyser, silentTap);
            nativeConnect.call(silentTap, context.destination);
            context.__outputAnalyser = analyser;
          }
          return nativeConnect.call(gain, destination, ...args);
        };
        return gain;
      }
    };
  });
}
async function display(page) {
  const details = page.locator("#section-index");
  if ((await details.getAttribute("open")) === null)
    await details.locator("summary").click();
}
async function content(page) {
  await expect(page.locator("h1")).toHaveText(baseline.name);
  await expect(page.locator(".hero-title")).toHaveText(baseline.title);
  await expect(page.locator("main > section")).toHaveCount(6);
  for (const section of baseline.sections) {
    await expect(page.locator(`#${section.id} h2`)).toHaveText(section.heading);
    const entries = await page
      .locator(`#${section.id} .entry`)
      .allTextContents();
    expect(entries.map((value) => value.replace(/\s+/g, " ").trim())).toEqual(
      section.entries,
    );
    for (const link of section.links)
      await expect(
        page.locator(`#${section.id} a`).filter({ hasText: link.text }).first(),
      ).toHaveAttribute("href", link.href);
  }
  expect(
    await page.locator(".hero-links a").evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute("href"),
        label: link.getAttribute("aria-label"),
      })),
    ),
  ).toEqual(baseline.contacts);
}

for (const port of [8000, 8001])
  test(`root/dist ${port}: content, enhancement, local requests and hosted tracker`, async ({
    page,
    request,
  }) => {
    const failures = [];
    page.on("response", (response) => {
      if (
        response.url().startsWith(`http://127.0.0.1:${port}`) &&
        response.status() >= 400
      )
        failures.push(response.url());
    });
    await ready(page, `http://127.0.0.1:${port}/?bg-debug`);
    await content(page);
    for (const file of await fs.readdir("assets/black-geometry/generated")) {
      const response = await request.get(
        `http://127.0.0.1:${port}/assets/black-geometry/generated/${file}`,
      );
      expect(response.ok()).toBeTruthy();
    }
    for (const pdf of baseline.sections.at(-1).links) {
      const response = await request.get(
        `http://127.0.0.1:${port}/${pdf.href}`,
      );
      expect(response.ok()).toBeTruthy();
      expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
    }
    await page.getByRole("button", { name: "Sound off", exact: true }).click();
    await expect(page.locator("#sound-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Sound on", exact: true }).click();
    await expect
      .poll(async () => (await snapshot(page)).audio.state)
      .toBe("off");
    await expect.poll(async () => (await snapshot(page)).audio.contextState).toBe("suspended");
    await page.goto(`http://127.0.0.1:${port}/new-grad-job-tracker-2027/`);
    const jobsResponse = await request.get(
      `http://127.0.0.1:${port}/new-grad-job-tracker-2027/data/jobs.json`,
    );
    expect(jobsResponse.ok()).toBeTruthy();
    const publishedJobs = await jobsResponse.json();
    expect(publishedJobs.length).toBeGreaterThan(0);
    await expect(page.locator("#active-role-count")).toHaveText(
      String(publishedJobs.length),
    );
    await page
      .getByLabel("Keyword", { exact: true })
      .fill("no-such-company-xyz");
    await expect(page.locator("#empty-state")).toBeVisible();
    await page.locator("#reset-filters").click();
    await expect(page.locator("#empty-state")).toBeHidden();
    await page.getByRole("button", { name: "Archived / closed" }).click();
    await expect(page.locator("#archive-view")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(failures).toEqual([]);
  });

test("individual entries settle correctly through forward and reverse scrolling", async ({ page }, info) => {
  test.setTimeout(45000);
  await ready(page);
  const hashes = new Map();
  for (const [id, target] of [...identities, ...identities.slice(1, 8).reverse()]) {
    await jump(page, id);
    const state = await snapshot(page);
    assertActiveGeometry(state, target);
    if (!hashes.has(target)) {
      const canvas = await page.locator(".world canvas").screenshot();
      hashes.set(target, createHash("sha256").update(canvas).digest("hex"));
    }
    await page.screenshot({ path: `${output}/${info.project.name}-desktop-${id}.png` });
  }
  // Pixel changes establish distinct outputs, not institutional recognition;
  // visual recognition is reviewed separately from these automated checks.
  expect(new Set(hashes.values()).size).toBe(hashes.size);
});

test("entry positions follow DOM layout and core morphs are finite, reversible and interruptible", async ({ page }, info) => {
  test.setTimeout(45000);
  await ready(page);
  const measured = await page.evaluate(() => {
    const state = window.__blackGeometry.snapshot();
    return state.ranges.slice(1, -1).map((range) => ({
      actual: range.start,
      expected: document.querySelector(`[data-scene="${range.id}"]`).getBoundingClientRect().top + scrollY - innerHeight * 0.34,
    }));
  });
  for (const range of measured) expect(Math.abs(range.actual - range.expected)).toBeLessThan(3);
  for (const [id, target, nextTarget] of [
    ["hero", "hero", "harper"],
    ["education-uchicago", "harper", "dragon"],
    ["education-drexel", "dragon", "membrane"],
  ]) {
    let forward;
    for (const progress of [0.64, 0.79, 0.92, 0.79, 0.64]) {
      await page.evaluate(({ id, progress }) => {
        const ranges = window.__blackGeometry.snapshot().ranges;
        const index = ranges.findIndex((range) => range.id === id);
        window.scrollTo(0, ranges[index].start + (ranges[index + 1].start - ranges[index].start) * progress);
      }, { id, progress });
      await expect.poll(async () => (await snapshot(page)).state.chapter).toBe(id);
      await expect.poll(async () => Math.abs((await snapshot(page)).state.progress - progress)).toBeLessThan(0.002);
      await expect.poll(async () => (await snapshot(page)).world.blend).toBeGreaterThan(0);
      const current = await snapshot(page);
      assertActiveGeometry(current, target);
      expect(current.world.nextTarget).toBe(nextTarget);
      expect(current.world.blend).toBeLessThan(1);
      if (progress === 0.79) {
        if (forward !== undefined) expect(current.state.blend).toBeCloseTo(forward, 4);
        else forward = current.state.blend;
        await page.screenshot({ path: `${output}/${info.project.name}-morph-${id}-${progress}.png` });
      }
    }
  }
  await jump(page, "experience-mathworks");
  assertActiveGeometry(await snapshot(page), "membrane");
  await jump(page, "education-uchicago");
  assertActiveGeometry(await snapshot(page), "harper");
});

for (const width of [1440, 390])
  test(`direct institutional hashes and resize select the correct entry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [id, target] of identities.slice(1, 4)) {
      await ready(page, `/?bg-debug#${id}`);
      await expect.poll(async () => (await snapshot(page)).state.chapter).toBe(id);
      await expect.poll(async () => (await snapshot(page)).world.target).toBe(target);
      await expect.poll(async () => (await snapshot(page)).state.blend).toBe(0);
      assertActiveGeometry(await snapshot(page), target);
    }
    await page.setViewportSize({ width: width === 390 ? 430 : 1280, height: 820 });
    await jump(page, "experience-mathworks");
    assertActiveGeometry(await snapshot(page), "membrane");
    await page.reload();
    await expect.poll(async () => (await snapshot(page)).state.chapter).toBe("experience-mathworks");
    await expect.poll(async () => (await snapshot(page)).world?.target).toBe("membrane");
    expect((await snapshot(page)).audio.initialized).toBe(false);
  });

test("surface replay and shortcut selection are keyboard operable with truthful static states", async ({
  page,
}, info) => {
  await ready(page);
  await jump(page, "project-surface");
  const replay = page.getByRole("button", { name: "Replay path" });
  await replay.focus();
  await page.keyboard.press("Enter");
  expect((await snapshot(page)).project.path).toBeLessThan(0.4);
  await expect.poll(async () => (await snapshot(page)).project.path).toBe(1);
  await page.screenshot({
    path: `${output}/${info.project.name}-surface-finished.png`,
  });
  await jump(page, "project-congestion");
  const closed = page.getByRole("button", {
    name: "Shortcut closed",
    exact: true,
  });
  await closed.focus();
  await page.keyboard.press("Space");
  await expect(closed).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#route-status")).toContainText("closed");
  await page.screenshot({
    path: `${output}/${info.project.name}-congestion-closed.png`,
  });
  await display(page);
  await page.getByLabel("Motion", { exact: true }).selectOption("off");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Shortcut open", exact: true })
    .click();
  await expect(page.locator("#sculpture-poster")).toHaveAttribute("src", /sculpture-congestion.svg$/);
  await expect(page.locator("#route-status")).toContainText("best-response");
  expect((await snapshot(page)).pendingFrame).toBe(false);
  await replay.focus();
  await replay.press("Enter");
  expect((await snapshot(page)).project.path).toBe(1);
});

test("sound stays uninitialized on load, scroll, hover and unrelated gestures; reload starts silent", async ({
  page,
}) => {
  await ready(page);
  expect((await snapshot(page)).audio.initialized).toBe(false);
  await page.locator(".hero-name").click();
  await page.mouse.move(50, 300);
  await jump(page, "project-congestion");
  await page
    .getByRole("button", { name: "Shortcut closed", exact: true })
    .click();
  expect((await snapshot(page)).audio.initialized).toBe(false);
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByRole("button", { name: "Shortcut open", exact: true })
    .click();
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await expect
    .poll(async () => (await snapshot(page)).audio.state)
    .toBe("off");
  await expect.poll(async () => (await snapshot(page)).audio.contextState).toBe("suspended");
  const muted = (await snapshot(page)).audio;
  expect(muted.enabled).toBe(false);
  expect(muted.state).toBe("off");
  expect(muted.wanted).toBe(false);
  expect(muted.voices).toBe(0);
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute(
    "data-experience-state",
    "ready",
  );
  expect((await snapshot(page)).audio.initialized).toBe(false);
  await expect(page.locator("#sound-toggle")).toHaveText("Sound off");
});

test("sound confirmation produces nonzero bounded output and suspension retains the opt-in", async ({ page }) => {
  await audioContextCapture(page);
  await ready(page);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "true");
  const peak = await page.evaluate(async () => {
    const analyser = window.__audioContexts[0].__outputAnalyser;
    if (!analyser) throw new Error("No output tap captured");
    const samples = new Float32Array(analyser.fftSize);
    let peak = 0;
    const until = performance.now() + 450;
    while (performance.now() < until) {
      analyser.getFloatTimeDomainData(samples);
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
      await new Promise(requestAnimationFrame);
    }
    return peak;
  });
  expect(peak).toBeGreaterThan(0.001);
  expect(peak).toBeLessThan(0.9);
  await page.evaluate(() => window.__audioContexts[0].suspend());
  await expect(page.locator("#sound-toggle")).toHaveText("Sound paused");
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "true");
  const paused = (await snapshot(page)).audio;
  expect(paused.wanted).toBe(true);
  expect(paused.enabled).toBe(false);
  expect(paused.voices).toBe(0);
  // A paused toggle first switches the retained opt-in off, then re-enables it.
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#sound-toggle").click();
  await expect.poll(async () => (await snapshot(page)).audio.state).toBe("running");
  expect(await page.evaluate(() => window.__audioContexts.length)).toBe(1);
});

test("hidden lifecycle clears output and rapid traversal leaves no audio backlog", async ({ page }) => {
  await ready(page);
  await page.locator("#sound-toggle").click();
  await expect.poll(async () => (await snapshot(page)).audio.state).toBe("running");
  // Simulate the document visibility signal to exercise the same page handler
  // deterministically in both headless engines; this is not an OS-tab claim.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await snapshot(page)).audio.contextState).toBe("suspended");
  let state = await snapshot(page);
  expect(state.audio.wanted).toBe(true);
  expect(state.audio.voices).toBe(0);
  expect(state.pendingFrame).toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await snapshot(page)).pendingFrame).toBe(true);
  for (const id of ["experience-mathworks", "education-uchicago", "project-congestion", "education-drexel"]) {
    await jump(page, id);
    expect((await snapshot(page)).audio.events).toBeLessThanOrEqual(3);
  }
  await expect.poll(async () => (await snapshot(page)).audio.voices).toBe(0);
  state = await snapshot(page);
  expect(state.audio.wanted).toBe(true);
  expect(state.audio.events).toBe(0);
  await page.locator("#sound-toggle").click();
  await expect.poll(async () => (await snapshot(page)).audio.state).toBe("off");
});

test("failed audio initialization remains honest and can be retried", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext || window.webkitAudioContext;
    let attempts = 0;
    window.AudioContext = class extends NativeContext {
      resume() {
        attempts++;
        if (attempts === 1) return Promise.reject(new Error("Simulated gesture rejection"));
        return super.resume();
      }
    };
  });
  await ready(page);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#sound-status")).toContainText("unavailable");
  expect((await snapshot(page)).audio.enabled).toBe(false);
  await page.locator("#sound-toggle").click();
  await expect.poll(async () => (await snapshot(page)).audio.state).toBe("running");
});

test("OS reduced motion skips heavy imports, reacts to OS changes, and Motion off stops an existing renderer", async ({
  page,
}, info) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?bg-debug");
  await expect(page.locator("#section-index")).toBeVisible();
  expect((await snapshot(page)).motion).toBe("reduced");
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(requests.some((url) => /world-.*\.js/.test(url))).toBe(false);
  await page.screenshot({
    path: `${output}/${info.project.name}-reduced-hero.png`,
  });
  for (const [id, target] of identities.slice(1, 4)) {
    await jump(page, id);
    await expect(page.locator("#sculpture-poster")).toHaveAttribute("src", new RegExp(`sculpture-${target}\\.svg$`));
    await expect.poll(() => page.locator("#sculpture-poster").evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await jump(page, "project-surface");
  await page.getByRole("button", { name: "Replay path" }).click();
  expect((await snapshot(page)).project.path).toBe(1);
  await page.screenshot({
    path: `${output}/${info.project.name}-reduced-surface.png`,
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("body")).toHaveAttribute(
    "data-experience-state",
    "ready",
  );
  await display(page);
  await page.getByLabel("Motion", { exact: true }).selectOption("off");
  const before = await snapshot(page);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(200);
  const after = await snapshot(page);
  expect(after.world.frames).toBe(before.world.frames);
  expect(after.pendingFrame).toBe(false);
});

test("quality and rapid display/audio changes reuse one renderer and do not leak geometries", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await display(page);
  for (const q of ["high", "low", "high", "auto"]) {
    await page.getByLabel("Quality", { exact: true }).selectOption(q);
    await page.waitForTimeout(70);
  }
  expect((await snapshot(page)).profile).toBe("medium");
  await expect(page.locator("canvas")).toHaveCount(1);
  const count = (await snapshot(page)).world.geometries;
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("Motion", { exact: true }).selectOption("off");
    await page.getByLabel("Motion", { exact: true }).selectOption("on");
  }
  await page.keyboard.press("Escape");
  await page.locator("#sound-toggle").click({ clickCount: 6, delay: 20 });
  await page.waitForTimeout(200);
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect((await snapshot(page)).audio.enabled).toBe(false);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect((await snapshot(page)).world.geometries).toBeLessThanOrEqual(
    count + 1,
  );
  expect(errors).toEqual([]);
});

test("keyboard skip, index, Escape, native hashes/back and ordinary page scrolling work", async ({
  page,
}, info) => {
  await ready(page);
  await page.keyboard.press(info.project.name === "webkit" ? "Alt+Tab" : "Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => location.hash)).toBe("#main");
  await page.locator("#section-index summary").focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("link", { name: "Research experience", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => location.hash)).toBe("#research");
  await expect(page.locator("#section-index")).not.toHaveAttribute("open");
  const top = await page
    .locator("#research h2")
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThan(72);
  await display(page);
  await page.getByLabel("Motion", { exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator("#section-index summary")).toBeFocused();
  await page.screenshot({
    path: `${output}/${info.project.name}-keyboard-focus.png`,
  });
  const y = await page.evaluate(() => scrollY);
  await page.keyboard.press("PageDown");
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(y);
  await page.goto("/?bg-debug#notes");
  await expect(page.locator("#notes h2")).toBeInViewport();
  await page.goto("/?bg-debug#personal-projects");
  await expect(page.locator("#personal-projects h2")).toBeInViewport();
  await page.goBack();
  await expect(page.locator("#notes h2")).toBeInViewport();
});

for (const [width, height] of [
  [320, 740],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
])
  test(`responsive ${width}x${height}: hero, projects, notes and no overflow`, async ({
    page,
  }, info) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width, height });
    await ready(page);
    for (const id of [
      "top",
      "education-uchicago",
      "education-drexel",
      "experience-mathworks",
      "project-surface",
      "project-congestion",
      "notes",
    ]) {
      await jump(page, id);
      await page.waitForTimeout(120);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      expect(overflow).toBe(false);
      const target = identities.find(([entry]) => entry === (id === "top" ? "hero" : id))[1];
      assertActiveGeometry(await snapshot(page), target);
      const stage = await page.locator(".world").boundingBox();
      expect(stage.width).toBeGreaterThan(width < 800 ? width * 0.9 : width * 0.4);
      expect(stage.height).toBeGreaterThan(width < 800 ? 150 : height * 0.75);
      if (width < 800 && id !== "top" && id !== "notes") {
        const title = await page.locator(`#${id} h3`).boundingBox();
        expect(title.y).toBeGreaterThanOrEqual(stage.y + stage.height);
      }
      await page.screenshot({
        path: `${output}/${info.project.name}-${width}-${id}.png`,
      });
    }
    await display(page);
    await expect(page.getByLabel("Motion", { exact: true })).toBeVisible();
    expect(
      await page
        .locator(".disclosure-panel")
        .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
    ).toBe(true);
  });

for (const mode of ["module", "asset", "renderer", "shader", "context"])
  test(`${mode} failure keeps the complete portfolio and static artwork`, async ({
    page,
  }, info) => {
    if (mode === "module")
      await page.route("**/world-*.js", (route) => route.abort());
    if (mode === "asset")
      await page.route("**/sculpture-data.bin*", (route) => route.abort());
    if (mode === "renderer")
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return String(type).includes("webgl")
            ? null
            : original.call(this, type, ...args);
        };
      });
    if (mode === "shader")
      await page.addInitScript(() => {
        WebGL2RenderingContext.prototype.compileShader = function () {};
      });
    if (mode === "context") {
      await ready(page);
      await page.evaluate(() =>
        document
          .querySelector("canvas")
          .getContext("webgl2")
          .getExtension("WEBGL_lose_context")
          .loseContext(),
      );
    } else await page.goto("/?bg-debug");
    await expect(page.locator("body")).toHaveAttribute(
      "data-experience-state",
      "fallback",
    );
    await content(page);
    await expect(page.locator("#sculpture-poster")).toBeVisible();
    expect((await snapshot(page)).pendingFrame).toBe(false);
    await page.screenshot({
      path: `${output}/${info.project.name}-failure-${mode}.png`,
    });
    await jump(page, "project-congestion");
    await page
      .getByRole("button", { name: "Shortcut closed", exact: true })
      .click();
    await expect(page.locator("#sculpture-poster")).toHaveAttribute("src", /sculpture-congestion-closed.svg$/);
    await expect(page.locator("#route-status")).toContainText("feasible");
    await page.getByRole("button", { name: "Replay path" }).click();
    expect((await snapshot(page)).project.path).toBe(1);
    await page.locator("#sound-toggle").click();
    await expect.poll(async () => (await snapshot(page)).audio.enabled).toBe(true);
    await page.locator("#sound-toggle").click();
    await expect.poll(async () => (await snapshot(page)).audio.state).toBe("off");
  });

test("returning from the tracker restores the entry without replaying queued sound", async ({
  page,
}) => {
  await ready(page);
  await jump(page, "teaching-uchicago");
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => scrollY);
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.goto("/new-grad-job-tracker-2027/");
  await page.goBack();
  await expect(page.locator("body")).toHaveAttribute(
    "data-experience-state",
    "ready",
  );
  await expect
    .poll(async () => (await snapshot(page)).state.chapter)
    .toBe("teaching-uchicago");
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(
    5,
  );
  await expect.poll(async () => (await snapshot(page)).audio.voices || 0).toBe(0);
  const audio = (await snapshot(page)).audio;
  if (!audio.initialized) {
    expect(audio.enabled).toBe(false);
    await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "false");
  } else {
    expect(audio.wanted).toBe(true);
    expect(audio.events).toBe(0);
  }
});

test("without JavaScript all sections, index, project links and PDFs remain native", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  await page.goto("http://127.0.0.1:8000/");
  await content(page);
  for (const [id, target] of identities.slice(1, 4)) {
    const art = page.locator(`#${id} .scene-fallback`);
    await art.scrollIntoViewIfNeeded();
    await expect(art).toBeVisible();
    await expect(art).toHaveAttribute("src", new RegExp(`sculpture-${target}\\.svg$`));
    await expect.poll(() => art.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await page.locator("#section-index summary").click();
  await page.getByRole("link", { name: "Personal notes", exact: true }).click();
  await expect(page.locator("#notes h2")).toBeInViewport();
  await page.locator("#section-index summary").click();
  await page.screenshot({
    path: `${output}/${info.project.name}-no-js-notes.png`,
  });
  await page.goto("http://127.0.0.1:8000/#personal-projects");
  await page.screenshot({
    path: `${output}/${info.project.name}-no-js-projects.png`,
  });
  await context.close();
});

test("denied storage and font/icon network failures preserve legibility and controls", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("denied");
      },
    }),
  );
  await page.route(/https:\/\/(fonts\.|cdnjs\.)/, (route) => route.abort());
  await ready(page);
  await content(page);
  await display(page);
  await page.getByLabel("Motion", { exact: true }).selectOption("off");
  await page.keyboard.press("Escape");
  await expect(page.locator(".hero-links")).toContainText("GitHub");
  await page.screenshot({
    path: `${output}/${info.project.name}-blocked-fonts.png`,
  });
});

test("200 percent zoom and print retain the content", async ({
  page,
}, info) => {
  await ready(page);
  await page.evaluate(() => (document.documentElement.style.zoom = "2"));
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${output}/${info.project.name}-zoom-200.png`,
  });
  await page.evaluate(() => (document.documentElement.style.zoom = ""));
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".world")).toBeHidden();
  await expect(page.locator(".site-header")).toBeHidden();
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(255, 255, 255)");
  await page.screenshot({
    path: `${output}/${info.project.name}-print.png`,
    fullPage: true,
  });
});
