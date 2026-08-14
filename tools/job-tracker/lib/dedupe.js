import { canonicalizeUrl, jobIdentityKey } from "./url.js";
import { uniqueStrings } from "./normalization.js";
import { DEGREE_LEVELS } from "../constants.js";

const EVIDENCE_STRENGTH = Object.freeze({
  Unstated: 0,
  Historical: 1,
  Supported: 2,
  Strong: 3,
  Restricted: 4,
});

function selectEvidence(left, right) {
  return EVIDENCE_STRENGTH[right.level] > EVIDENCE_STRENGTH[left.level]
    ? right
    : left;
}

function mergeJobs(left, right) {
  const preferred = Object.values(right).filter(
    (value) => value !== null && value !== "" && value !== "Unspecified",
  ).length >
    Object.values(left).filter(
      (value) => value !== null && value !== "" && value !== "Unspecified",
    ).length
    ? right
    : left;

  const hasActiveCopy = left.status !== "closed" || right.status !== "closed";

  return {
    ...left,
    ...preferred,
    id: left.id,
    locations: uniqueStrings([...left.locations, ...right.locations]),
    graduationMonths: uniqueStrings([
      ...left.graduationMonths,
      ...right.graduationMonths,
    ]).sort(),
    degreeLevels: DEGREE_LEVELS.filter(
      (level) => left.degreeLevels.includes(level) || right.degreeLevels.includes(level),
    ),
    visaEvidence: selectEvidence(left.visaEvidence, right.visaEvidence),
    firstSeen: left.firstSeen < right.firstSeen ? left.firstSeen : right.firstSeen,
    lastVerified:
      left.lastVerified > right.lastVerified
        ? left.lastVerified
        : right.lastVerified,
    tags: uniqueStrings([...left.tags, ...right.tags]).sort(),
    missCount: Math.min(left.missCount, right.missCount),
    status: hasActiveCopy
      ? left.status !== "closed"
        ? left.status
        : right.status
      : "closed",
    closedDate: hasActiveCopy
      ? null
      : left.closedDate ?? right.closedDate,
  };
}

export function dedupeJobs(jobs) {
  const deduped = [];
  const duplicateGroups = [];
  const indexByUrl = new Map();
  const indexByIdentity = new Map();

  for (const job of jobs) {
    const urlKey = canonicalizeUrl(job.applicationUrl);
    const identityKey = jobIdentityKey(job);
    const existingIndex = indexByUrl.get(urlKey) ?? indexByIdentity.get(identityKey);

    if (existingIndex !== undefined) {
      const existing = deduped[existingIndex];
      deduped[existingIndex] = mergeJobs(existing, job);
      duplicateGroups.push([existing.id, job.id]);
      indexByUrl.set(urlKey, existingIndex);
      indexByIdentity.set(identityKey, existingIndex);
      continue;
    }

    const nextIndex = deduped.length;
    deduped.push(structuredClone(job));
    indexByUrl.set(urlKey, nextIndex);
    indexByIdentity.set(identityKey, nextIndex);
  }

  return { jobs: deduped, duplicateGroups };
}

export function findDuplicateGroups(jobs) {
  return dedupeJobs(jobs).duplicateGroups;
}
