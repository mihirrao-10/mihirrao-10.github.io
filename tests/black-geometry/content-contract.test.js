import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parse } from "parse5";
import { contentContract, all, attr, hasClass, text, normalize } from "./contract.js";
const root = new URL("../../", import.meta.url);
test("content matches the authorized minimal revision while preserving facts and destinations", async () => {
  const html = await fs.readFile(new URL("index.html", root), "utf8");
  const baseline = JSON.parse(
    await fs.readFile(
      new URL("fixtures/content-baseline.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(contentContract(html), baseline);
});
test("teaching and awards belong to their education entries and removed sections have no remaining navigation", async () => {
  const doc = parse(await fs.readFile(new URL("index.html", root), "utf8"));
  for (const id of ["research", "teaching"]) {
    assert.equal(all(doc, (node) => attr(node, "id") === id).length, 0);
    assert.equal(all(doc, (node) => attr(node, "href") === `#${id}`).length, 0);
  }
  const education = (id) => all(doc, (node) => attr(node, "id") === id)[0];
  const chicago = education("education-uchicago"), drexel = education("education-drexel");
  const courses = (entry) => all(entry, (node) => hasClass(node, "course-list"))
    .flatMap((list) => all(list, (node) => node.tagName === "li")).map((node) => normalize(text(node)));
  assert.deepEqual(courses(chicago), ["CMSC 27230 | Honors Theory of Algorithms", "MPCS 55001 | Algorithms", "MPCS 50103 | Mathematics for Computer Science: Discrete Mathematics"]);
  assert.deepEqual(courses(drexel), ["CS 260 | Data Structures", "CS 277 | Algorithms & Analysis", "CS 380 | Artificial Intelligence", "CS 615 | Deep Learning"]);
  assert.equal(all(doc, (node) => ["teaching-role", "teaching-dates"].some((name) => hasClass(node, name))).length, 0);
  const honors = all(drexel, (node) => hasClass(node, "degree-honors"))[0];
  assert.equal(normalize(text(honors)), "Magna Cum Laude");
  assert.equal(all(honors, (node) => node.tagName === "em").length, 1);
  const degreeLines = honors.parentNode.childNodes.filter((node) => node.tagName);
  assert.equal(hasClass(degreeLines[0], "entry-role"), true);
  assert.equal(normalize(text(degreeLines[1])), "Concentrations | Algorithms & Data Structures, Artificial Intelligence");
  assert.equal(degreeLines[2], honors);
  assert.equal(normalize(text(all(chicago, (node) => hasClass(node, "degree-specialization"))[0])), "Concentration | Artificial Intelligence - Foundations");
  assert.doesNotMatch(normalize(text(chicago)), /Interests\s*\|/);
  const awards = all(drexel, (node) => hasClass(node, "awards-list"))
    .flatMap((list) => all(list, (node) => node.tagName === "li")).map((node) => normalize(text(node)));
  assert.deepEqual(awards, ["A* Award", "Jeffrey L. Popyack Teaching Assistant Award", "Student Teaching Excellence Award"]);
  assert.equal(all(doc, (node) => node.tagName === "section" && node.parentNode.tagName === "main").length, 4);
});
test("minimal navigation retains a native return link and opens projects in separate tabs", async () => {
  const html = await fs.readFile(new URL("index.html", root), "utf8");
  const doc = parse(html);
  assert.equal(all(doc, (node) => ["header", "select", "figcaption"].includes(node.tagName)).length, 0);
  const buttons = all(doc, node => node.tagName === 'button');
  assert.equal(buttons.length, 1);
  assert.equal(hasClass(buttons[0], 'animation-action'), true);
  assert.equal(attr(buttons[0], 'hidden'), '');
  assert.equal(normalize(text(buttons[0])), 'Enable animation');
  assert.equal(all(doc, (node) => ["section-index", "sound-toggle", "motion-setting", "quality-setting", "replay-path", "shortcut-controls", "route-status"].includes(attr(node, "id"))).length, 0);
  assert.doesNotMatch(html, /[\u2190-\u21ff\u27f0-\u27ff]/u);
  const footer = all(doc, (node) => node.tagName === "footer")[0];
  const footerLinks = all(footer, (node) => node.tagName === "a");
  assert.equal(footerLinks.length, 1);
  assert.equal(attr(footerLinks[0], "href"), "#top");
  assert.equal(normalize(text(footer)), "Back to top");
  const projects = all(doc, (node) => attr(node, "id") === "personal-projects")[0];
  const links = all(projects, (node) => node.tagName === "a" && !hasClass(node, "scene-next"));
  assert.equal(links.length, 4);
  for (const link of links) {
    assert.equal(attr(link, "target"), "_blank");
    assert.ok(attr(link, "rel").split(/\s+/).includes("noopener"));
  }
  assert.equal(all(projects, (node) => hasClass(node, "open-project")).length, 2);
  assert.doesNotMatch(normalize(text(projects)), /Categories|Replay path|Shortcut open|Shortcut closed/);
});
test("next-entry cues have accessible names and follow the native reading order", async () => {
  const doc = parse(await fs.readFile(new URL("index.html", root), "utf8"));
  const scenes = all(doc, (node) => attr(node, "data-scene"));
  const cues = all(doc, (node) => hasClass(node, "scene-next"));
  assert.equal(cues.length, 7);
  for (let index = 0; index < cues.length; index++) {
    const cue = cues[index];
    assert.equal(cue.tagName, "a");
    assert.equal(cue.parentNode, scenes[index]);
    assert.equal(attr(cue, "href"), `#${attr(scenes[index + 1], "id")}`);
    assert.ok(attr(cue, "aria-label")?.length > 10);
    assert.equal(attr(cue, "target"), undefined);
    assert.equal(attr(cue, "tabindex"), undefined);
    const icon = all(cue, (node) => node.tagName === "svg")[0];
    assert.equal(attr(icon, "aria-hidden"), "true");
    assert.equal(attr(icon, "focusable"), "false");
  }
});
test("industry roles remain concise while all eight resume bullets retain their metrics", async () => {
  const doc = parse(await fs.readFile(new URL("index.html", root), "utf8"));
  const experience = all(doc, (node) => attr(node, "id") === "experience")[0];
  const roles = all(experience, (node) => hasClass(node, "entry-role")).map((node) => normalize(text(node)));
  assert.deepEqual(roles, ["Software Engineering Intern", "Data Science Intern"]);
  assert.doesNotMatch(normalize(text(experience)), /Department/);
  const entries = all(experience, (node) => hasClass(node, "entry"));
  const bullets = entries.map((entry) => all(entry, (node) => hasClass(node, "experience-points"))
    .flatMap((list) => all(list, (node) => node.tagName === "li")).map((node) => normalize(text(node))));
  assert.deepEqual(bullets.map((points) => points.length), [4, 4]);
  assert.match(bullets[0][0], /55\.1 s to 9\.77 s \(5\.64×\) across 570,603 queries/);
  assert.match(bullets[0][0], /4\.6× fewer candidate checks and 138× fewer solves with 0 mismatches/);
  assert.match(bullets[0][1], /79 MATLAB functions and found 110\+ error-message defects/);
  assert.match(bullets[0][1], /100-run multi-agent repair evaluations with up to 4 attempts/);
  assert.match(bullets[0][2], /8\+ coverage improvements and 3 evaluations/);
  assert.match(bullets[0][2], /12 end-to-end workflows/);
  assert.match(bullets[0][3], /2\.2× and added 4 performance benchmarks plus 28 correctness tests/);
  assert.match(bullets[1][0], /\$380K\/year vendor Excel workflow/);
  assert.match(bullets[1][0], /54 dependent jobs/);
  assert.match(bullets[1][1], /8,314 × 63 production dataset matching vendor rates within 1e-3 absolute error/);
  assert.match(bullets[1][2], /Fine-tuned FinBERT for fixed-income sentiment classification/);
  assert.match(bullets[1][3], /saved 10\+ hours\/week of manual lookup/);
});
test("the two existing project descriptions use their complete resume bullets", async () => {
  const doc = parse(await fs.readFile(new URL("index.html", root), "utf8"));
  const projects = all(doc, (node) => hasClass(node, "project-feature"));
  assert.equal(projects.length, 2);
  const descriptions = projects.map((project) => normalize(text(all(project, (node) => hasClass(node, "entry-detail"))[0])));
  assert.match(descriptions[0], /Built a deterministic C\+\+20 heat-method solver for genus 1–3/);
  assert.match(descriptions[0], /45K vertices and 91K faces in 180 ms/);
  assert.match(descriptions[0], /6\.15 ms with < 2e-13 relative residuals/);
  assert.match(descriptions[1], /64 seeds and 5,000 episodes/);
  assert.match(descriptions[1], /5\.0-billion-profile state space at 100K agents/);
  assert.match(descriptions[1], /23\.7% inefficiency/);
});
test("generated notes are unique card links to real PDFs, with only non-empty groups", async () => {
  const doc = parse(await fs.readFile(new URL("index.html", root), "utf8"));
  assert.equal(all(doc, (n) => n.tagName === "h1").length, 1);
  assert.equal(all(doc, (n) => n.tagName === "main").length, 1);
  const notes = all(doc, (n) => attr(n, "id") === "notes")[0];
  const cards = all(notes, (n) => hasClass(n, "note"));
  const links = all(notes, (n) => n.tagName === "a");
  assert.equal(links.length, cards.length);
  assert.equal(new Set(links.map((n) => attr(n, "href"))).size, links.length);
  for (const node of links) {
    assert.ok(hasClass(node, "note-link"));
    assert.equal(node.parentNode.tagName, "li");
    assert.match(attr(node, "href"), /^notes\/[a-z0-9-]+\.pdf$/);
    await fs.access(new URL(attr(node, "href"), root));
  }
  for (const group of all(notes, (n) => hasClass(n, "notes-group")))
    assert.ok(all(group, (n) => hasClass(n, "note")).length > 0);
  if (cards.length === 0) assert.equal(all(notes, (n) => hasClass(n, "notes-empty")).length, 1);
});
