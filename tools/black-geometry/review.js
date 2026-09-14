import fs from "node:fs/promises";
import { chromium } from "playwright";
const output = ".artifacts/black-geometry/review";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const observations = [];
try {
  for (const [label, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:8000/?bg-debug");
    await page.waitForFunction(
      () => document.body.dataset.experienceState === "ready",
    );
    await page.waitForTimeout(700);
    for (const [name, id] of [
      ["hero", "top"],
      ["education", "education"],
      ["industry", "experience"],
      ["research", "research"],
      ["teaching", "teaching"],
      ["surface", "project-surface"],
      ["congestion-open", "project-congestion"],
      ["congestion-closed", "project-congestion"],
      ["notes", "notes"],
      ["footer", "contact"],
    ]) {
      await page.evaluate(
        (id) =>
          window.scrollTo(
            0,
            document.getElementById(id).getBoundingClientRect().top +
              scrollY -
              (id === "top" ? 0 : 100),
          ),
        id,
      );
      if (name === "congestion-closed")
        await page
          .getByRole("button", { name: "Shortcut closed", exact: true })
          .click();
      await page.waitForTimeout(name === "surface" ? 2900 : 250);
      await page.screenshot({ path: `${output}/${label}-${name}.png` });
      observations.push({
        label,
        name,
        ...(await page.evaluate(() => ({
          snapshot: window.__blackGeometry.snapshot(),
          overflow: document.documentElement.scrollWidth > innerWidth,
          height: document.documentElement.scrollHeight,
        }))),
      });
    }
    observations.push({ label, errors });
    await page.close();
  }
  await fs.writeFile(
    `${output}/observations.json`,
    JSON.stringify(observations, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      observations.map((o) => ({
        label: o.label,
        name: o.name,
        chapter: o.snapshot?.state.chapter,
        world: o.snapshot?.world,
        overflow: o.overflow,
        errors: o.errors,
      })),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
