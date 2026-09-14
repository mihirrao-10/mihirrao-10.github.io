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
  await expect(page.locator("body")).toHaveAttribute(
    "data-experience-state",
    "ready",
  );
  await expect
    .poll(() =>
      page.locator(".hero-art").evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe("0");
}
async function jump(page, id) {
  await page.evaluate(
    (id) =>
      window.scrollTo(
        0,
        document.getElementById(id).getBoundingClientRect().top + scrollY - 105,
      ),
    id,
  );
}
async function display(page) {
  const details = page.locator("#display-settings");
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
      .toBe("suspended");
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

test("scene changes across actual chapters, supports jumps/reverse scrolling and reaches the footer", async ({
  page,
}, info) => {
  await ready(page);
  const images = [];
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
    "research",
  ]) {
    await jump(page, id);
    await page.waitForTimeout(100);
    const state = await snapshot(page);
    expect(state.state.chapter).toBe(id === "top" ? "hero" : id);
    expect(state.world.drawCalls).toBeGreaterThan(0);
    const buffer = await page.locator(".world canvas").screenshot();
    images.push(createHash("sha256").update(buffer).digest("hex"));
    await page.screenshot({
      path: `${output}/${info.project.name}-desktop-${id}.png`,
    });
  }
  expect(new Set(images).size).toBe(images.length);
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
  await expect(page.locator("#network-poster")).toHaveAttribute(
    "src",
    /congestion-open.svg$/,
  );
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
    .toBe("suspended");
  const muted = (await snapshot(page)).audio;
  expect(muted.enabled).toBe(false);
  expect(muted.state).toBe("suspended");
  expect(muted.voices).toBe(0);
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute(
    "data-experience-state",
    "ready",
  );
  expect((await snapshot(page)).audio.initialized).toBe(false);
  await expect(page.locator("#sound-toggle")).toHaveText("Sound off");
});

test("external audio suspension clears cues and one explicit click enables sound again", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext || window.webkitAudioContext;
    window.__audioContexts = [];
    window.AudioContext = class extends NativeContext {
      constructor(...args) {
        super(...args);
        window.__audioContexts.push(this);
      }
    };
  });
  await ready(page);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await jump(page, "project-congestion");
  await page
    .getByRole("button", { name: "Shortcut closed", exact: true })
    .click();
  await page.evaluate(() => window.__audioContexts[0].suspend());
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect((await snapshot(page)).audio.voices).toBe(0);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect((await snapshot(page)).audio.state).toBe("running");
  expect(await page.evaluate(() => window.__audioContexts.length)).toBe(1);
});

test("OS reduced motion skips heavy imports, reacts to OS changes, and Motion off stops an existing renderer", async ({
  page,
}, info) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?bg-debug");
  await expect(page.locator("#display-settings")).toBeVisible();
  expect((await snapshot(page)).motion).toBe("reduced");
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(requests.some((url) => /world-.*\.js/.test(url))).toBe(false);
  await page.screenshot({
    path: `${output}/${info.project.name}-reduced-hero.png`,
  });
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
  await expect(page.locator("#display-settings summary")).toBeFocused();
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
    await page.setViewportSize({ width, height });
    await ready(page);
    for (const id of [
      "top",
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
      await page.screenshot({
        path: `${output}/${info.project.name}-${width}-${id}.png`,
      });
    }
    await display(page);
    await expect(page.getByLabel("Motion", { exact: true })).toBeVisible();
    expect(
      await page
        .locator(".disclosure-panel.display-panel")
        .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
    ).toBe(true);
  });

for (const mode of ["module", "renderer", "shader", "context"])
  test(`${mode} failure keeps the complete portfolio and static artwork`, async ({
    page,
  }, info) => {
    if (mode === "module")
      await page.route("**/world-*.js", (route) => route.abort());
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
    await expect(page.locator(".hero-art")).toBeVisible();
    expect((await snapshot(page)).pendingFrame).toBe(false);
    await page.screenshot({
      path: `${output}/${info.project.name}-failure-${mode}.png`,
    });
    await jump(page, "project-congestion");
    await page
      .getByRole("button", { name: "Shortcut closed", exact: true })
      .click();
    await expect(page.locator("#network-poster")).toHaveAttribute(
      "src",
      /closed.svg$/,
    );
    await page.getByRole("button", { name: "Replay path" }).click();
    expect((await snapshot(page)).project.path).toBe(1);
  });

test("returning from the tracker reconstructs a mid-page position and keeps sound off", async ({
  page,
}) => {
  await ready(page);
  await jump(page, "teaching");
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
    .toBe("teaching");
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(
    5,
  );
  await expect(page.locator("#sound-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
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
