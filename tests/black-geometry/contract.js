import { parse } from "parse5";

export const attr = (node, name) =>
  node.attrs?.find((a) => a.name === name)?.value;
export const hasClass = (node, name) =>
  (attr(node, "class") || "").split(/\s+/).includes(name);
export function all(node, predicate) {
  const result = [];
  if (predicate(node)) result.push(node);
  for (const child of node.childNodes || [])
    result.push(...all(child, predicate));
  return result;
}
export const text = (node) =>
  node.nodeName === "#text"
    ? node.value
    : (node.childNodes || []).map(text).join("");
export const normalize = (value) => value.replace(/\s+/g, " ").trim();
export function contentContract(html) {
  const doc = parse(html);
  const first = (predicate) => all(doc, predicate)[0];
  const link = (node) => ({
    href: attr(node, "href"),
    text: normalize(text(node)),
    label: attr(node, "aria-label") || "",
  });
  return {
    name: normalize(text(first((n) => n.tagName === "h1"))),
    title: normalize(text(first((n) => hasClass(n, "hero-title")))),
    contacts: all(
      first((n) => hasClass(n, "hero-links")),
      (n) => n.tagName === "a",
    ).map((n) => ({ href: attr(n, "href"), label: attr(n, "aria-label") })),
    sections: all(
      doc,
      (n) =>
        n.tagName === "section" &&
        [
          "education",
          "experience",
          "research",
          "teaching",
          "personal-projects",
          "notes",
        ].includes(attr(n, "id")),
    ).map((section) => ({
      id: attr(section, "id"),
      heading: normalize(text(all(section, (n) => n.tagName === "h2")[0])),
      // Every original entry is preserved as one semantic block. New project visuals live outside it.
      entries: all(section, (n) => hasClass(n, "entry")).map((n) =>
        normalize(text(n)),
      ),
      links: all(
        section,
        (n) => n.tagName === "a" && !hasClass(n, "open-project") && !hasClass(n, "scene-next"),
      ).map(link),
    })),
  };
}
