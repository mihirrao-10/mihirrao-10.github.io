import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parse } from "parse5";
import { contentContract, all, attr, hasClass, text, normalize } from "./contract.js";
const root = new URL("../../", import.meta.url);
test("content matches the authorized consolidation while preserving unrelated facts and destinations", async () => {
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
  assert.deepEqual(courses(chicago), ["Honors Theory of Algorithms (CMSC 27230)", "Algorithms (MPCS 55001)"]);
  assert.deepEqual(courses(drexel), ["Data Structures (CS260)", "Algorithms & Analysis (CS277)", "Artificial Intelligence (CS380)", "Deep Learning (CS615)"]);
  assert.match(normalize(text(chicago)), /Graduate Teaching Assistant & Lecturer/);
  assert.match(normalize(text(chicago)), /Jan 2026 – Mar 2026/);
  assert.match(normalize(text(drexel)), /Undergraduate Teaching Assistant/);
  assert.match(normalize(text(drexel)), /Jun 2022 – Jun 2024/);
  const awards = all(drexel, (node) => hasClass(node, "awards-list"))
    .flatMap((list) => all(list, (node) => node.tagName === "li")).map((node) => normalize(text(node)));
  assert.deepEqual(awards, ["A* Award", "Jeffrey L. Popyack Outstanding Undergraduate Teaching/Course Assistant Award", "Student Teaching Excellence Award"]);
  assert.equal(all(doc, (node) => node.tagName === "section" && node.parentNode.tagName === "main").length, 4);
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
