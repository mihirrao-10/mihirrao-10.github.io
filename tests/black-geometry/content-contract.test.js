import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parse } from "parse5";
import { contentContract, all, attr, hasClass } from "./contract.js";
const root = new URL("../../", import.meta.url);
test("all identity, biography, entries, categories, dates and destinations match the untouched local baseline", async () => {
  const html = await fs.readFile(new URL("index.html", root), "utf8");
  const baseline = JSON.parse(
    await fs.readFile(
      new URL("fixtures/content-baseline.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(contentContract(html), baseline);
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
