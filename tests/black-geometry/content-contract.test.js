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
  assert.deepEqual(courses(chicago), ["Honors Theory of Algorithms", "Algorithms"]);
  assert.deepEqual(courses(drexel), ["Data Structures", "Algorithms & Analysis", "Artificial Intelligence", "Deep Learning"]);
  assert.equal(all(doc, (node) => ["teaching-role", "teaching-dates", "course-code"].some((name) => hasClass(node, name))).length, 0);
  const awards = all(drexel, (node) => hasClass(node, "awards-list"))
    .flatMap((list) => all(list, (node) => node.tagName === "li")).map((node) => normalize(text(node)));
  assert.deepEqual(awards, ["A* Award", "Jeffrey L. Popyack Teaching Assistant Award", "Student Teaching Excellence Award"]);
  assert.equal(all(doc, (node) => node.tagName === "section" && node.parentNode.tagName === "main").length, 4);
});
test("minimal navigation retains a native return link and opens projects in separate tabs", async () => {
  const html = await fs.readFile(new URL("index.html", root), "utf8");
  const doc = parse(html);
  assert.equal(all(doc, (node) => ["header", "button", "select", "figcaption"].includes(node.tagName)).length, 0);
  assert.equal(all(doc, (node) => ["section-index", "sound-toggle", "motion-setting", "quality-setting", "replay-path", "shortcut-controls", "route-status"].includes(attr(node, "id"))).length, 0);
  assert.doesNotMatch(html, /[\u2190-\u21ff\u27f0-\u27ff]/u);
  const footer = all(doc, (node) => node.tagName === "footer")[0];
  const footerLinks = all(footer, (node) => node.tagName === "a");
  assert.equal(footerLinks.length, 1);
  assert.equal(attr(footerLinks[0], "href"), "#top");
  assert.equal(normalize(text(footer)), "Back to top");
  const projects = all(doc, (node) => attr(node, "id") === "personal-projects")[0];
  const links = all(projects, (node) => node.tagName === "a");
  assert.equal(links.length, 4);
  for (const link of links) {
    assert.equal(attr(link, "target"), "_blank");
    assert.ok(attr(link, "rel").split(/\s+/).includes("noopener"));
  }
  assert.equal(all(projects, (node) => hasClass(node, "open-project")).length, 2);
  assert.doesNotMatch(normalize(text(projects)), /Categories|Replay path|Shortcut open|Shortcut closed/);
});
test("industry roles are concise and their descriptions reflect the resume", async () => {
  const doc = parse(await fs.readFile(new URL("index.html", root), "utf8"));
  const experience = all(doc, (node) => attr(node, "id") === "experience")[0];
  const roles = all(experience, (node) => hasClass(node, "entry-role")).map((node) => normalize(text(node)));
  assert.deepEqual(roles, ["Software Engineering Intern", "Data Science Intern"]);
  assert.doesNotMatch(normalize(text(experience)), /Department/);
  assert.match(normalize(text(experience)), /tetrahedral point-location/);
  assert.match(normalize(text(experience)), /5\.64 times faster/);
  assert.match(normalize(text(experience)), /54 dependent jobs/);
  assert.match(normalize(text(experience)), /FinBERT/);
});
test("notes remain unique real list links and the document has complete native landmarks", async () => {
  const doc = parse(await fs.readFile(new URL("index.html", root), "utf8"));
  assert.equal(all(doc, (n) => n.tagName === "h1").length, 1);
  assert.equal(all(doc, (n) => n.tagName === "main").length, 1);
  const lists = all(doc, (n) => hasClass(n, "notes-list"));
  assert.equal(lists.length, 4);
  const links = lists.flatMap((list) => all(list, (n) => n.tagName === "a"));
  assert.equal(links.length, 11);
  assert.equal(new Set(links.map((n) => attr(n, "href"))).size, 11);
  for (const node of links) {
    assert.equal(node.parentNode.tagName, "li");
    await fs.access(new URL(attr(node, "href"), root));
  }
});
