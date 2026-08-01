import { createHash } from "node:crypto";

const CATEGORY_RULES = [
  [
    "Quantitative Development",
    /\b(quant(?:itative)? (?:developer|engineer)|quant dev)\b/i,
  ],
  [
    "Quantitative Research",
    /\b(quant(?:itative)? research(?:er)?|research quant)\b/i,
  ],
  [
    "Quantitative Trading",
    /\b(quant(?:itative)? trad(?:er|ing)|algorithmic trad(?:er|ing))\b/i,
  ],
  [
    "Machine Learning / AI Engineering",
    /\b(machine learning|ml engineer|artificial intelligence|ai engineer|deep learning|computer vision|nlp engineer)\b/i,
  ],
  [
    "Data Science / Applied Science / Analytics",
    /\b(data scien(?:ce|tist)|applied scien(?:ce|tist)|analytics?|data analyst|decision scientist)\b/i,
  ],
  [
    "Systems / Infrastructure / Performance Engineering",
    /\b(infrastructure|distributed systems?|systems? engineer|site reliability|sre|performance engineer|compiler|kernel|network engineer|platform engineer)\b/i,
  ],
  [
    "Software Engineering",
    /\b(software|developer|development engineer|full[ -]?stack|front[ -]?end|back[ -]?end|mobile engineer|product engineer)\b/i,
  ],
];

const REMOTE_PATTERN = /\b(remote|distributed)\b/i;
const HYBRID_PATTERN = /\bhybrid\b/i;

export function normalizeCategory(title) {
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(title)) {
      return category;
    }
  }
  return "Other Technical";
}

export function normalizeWorkplaceType(value) {
  if (!value) {
    return "Unspecified";
  }
  if (HYBRID_PATTERN.test(value)) {
    return "Hybrid";
  }
  if (REMOTE_PATTERN.test(value)) {
    return "Remote";
  }
  if (/\b(on[ -]?site|in office|office-based)\b/i.test(value)) {
    return "On-site";
  }
  return "Unspecified";
}

export function normalizeLocations(locations) {
  const values = Array.isArray(locations) ? locations : [locations];
  const unique = new Map();
  for (const raw of values) {
    if (typeof raw !== "string") {
      continue;
    }
    for (const part of raw.split(/\s*(?:;|\||\n)\s*/)) {
      const location = part.trim().replace(/\s+/g, " ");
      if (location) {
        const key = location.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, location);
        }
      }
    }
  }
  return [...unique.values()];
}

export function isoDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function calendarDate(value, timeZone = "UTC") {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new TypeError(`Invalid date: ${value}`);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function stableJobId(sourceId, externalId, applicationUrl) {
  const safeSource = sourceId
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const digest = createHash("sha256")
    .update(`${sourceId}\0${externalId ?? applicationUrl}`)
    .digest("hex")
    .slice(0, 16);
  return `${safeSource}-${digest}`;
}

export function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map((value) => value.trim()))];
}
