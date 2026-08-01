import {
  isoDate,
  normalizeCategory,
  normalizeLocations,
  stableJobId,
  uniqueStrings,
} from "./normalization.js";
import { DEGREE_LEVELS } from "../constants.js";

const PLATFORM_LABELS = Object.freeze({
  ashby: "Ashby",
  greenhouse: "Greenhouse",
  lever: "Lever",
});

const EXCLUDED_TITLE =
  /\b(intern(?:ship)?|co-?op|senior|staff|principal|lead|manager|director|head|vice president)\b/i;
const PHD_ONLY_TITLE = /\b(?:ph\.?d|doctoral)\b/i;
const MIXED_DEGREE_TITLE =
  /\b(?:bachelor'?s?|bs|master'?s?|ms)\b.{0,12}\b(?:ph\.?d|doctoral)\b/i;
const EXCLUDED_DESCRIPTION =
  /\b(?:must (?:be|hold)|requires?) (?:a )?(?:U\.?S\.? citizen|United States citizen)|\b(?:U\.?S\.?|United States) citizenship (?:is )?required|\b(?:active )?(?:security )?clearance (?:is )?(?:required|mandatory)|\bmust (?:be able to )?obtain (?:a )?(?:security )?clearance|\b(?:visa |employment |immigration )?sponsorship (?:is )?not (?:available|provided|offered)|\b(?:will|does) not (?:sponsor|provide|offer)(?: immigration| visa)? sponsorship/i;
const TOO_MUCH_EXPERIENCE =
  /\b(?:minimum (?:of )?|at least |requires? )?(?:3|4|5|6|7|8|9|[1-9][0-9])\+? years? (?:(?:of )?(?:professional|industry|full[ -]?time|relevant) )?experience\b/i;

function matchesAny(patterns, value) {
  return patterns.some((pattern) => new RegExp(pattern, "i").test(value));
}

export function validateSourceSemantics(source) {
  const patternGroups = [
    source.selection.includeTitle,
    source.selection.includeDescription,
    source.selection.exclude,
  ];
  for (const pattern of patternGroups.flat()) {
    try {
      new RegExp(pattern, "i");
    } catch (error) {
      throw new Error(`Source ${source.id} has invalid regular expression ${pattern}`, {
        cause: error,
      });
    }
  }

  if (
    source.visaEvidence?.level === "Strong" &&
    Object.values(source.overrides ?? {}).some(
      (override) => !override.visaEvidence,
    )
  ) {
    throw new Error(
      `Source ${source.id} cannot use Strong as a board-wide evidence default; put job-specific Strong evidence in each override`,
    );
  }

  if (source.visaEvidence?.level === "Strong") {
    throw new Error(
      `Source ${source.id} cannot use Strong as a board-wide evidence default`,
    );
  }

  const hasSelection =
    source.selection.externalIds.length > 0 ||
    source.selection.includeTitle.length > 0 ||
    source.selection.includeDescription.length > 0;
  if (source.enabled && !hasSelection) {
    throw new Error(
      `Enabled source ${source.id} needs an explicit allowlist or include patterns`,
    );
  }
}

export function candidateIsSelected(source, candidate) {
  const idAllowed = source.selection.externalIds.includes(candidate.externalId);
  const title = candidate.title ?? "";
  const description = candidate.description ?? "";
  const searchable = `${title}\n${description}`;

  if (
    candidate.isProspect ||
    /\b(intern(?:ship)?|co-?op|part[ -]?time|contract|temporary)\b/i.test(
      candidate.employmentType ?? "",
    ) ||
    EXCLUDED_TITLE.test(title) ||
    (PHD_ONLY_TITLE.test(title) && !MIXED_DEGREE_TITLE.test(title)) ||
    EXCLUDED_DESCRIPTION.test(description) ||
    TOO_MUCH_EXPERIENCE.test(description) ||
    matchesAny(source.selection.exclude, searchable)
  ) {
    return false;
  }

  if (idAllowed) {
    return true;
  }

  const titleMatches =
    source.selection.includeTitle.length === 0 ||
    matchesAny(source.selection.includeTitle, title);
  const descriptionMatches =
    source.selection.includeDescription.length === 0 ||
    matchesAny(source.selection.includeDescription, description);

  return (
    titleMatches &&
    descriptionMatches &&
    (source.selection.includeTitle.length > 0 ||
      source.selection.includeDescription.length > 0)
  );
}

function required(value, field, source, candidate) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    throw new Error(
      `Selected job ${candidate.externalId} from ${source.id} is missing ${field}; add a source default or job override`,
    );
  }
  return value;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined);
}

export function normalizeSourceCandidate(source, candidate, today) {
  const override = source.overrides?.[candidate.externalId] ?? {};
  const defaults = source.defaults ?? {};
  const evidence = override.visaEvidence ?? source.visaEvidence;
  const locations = normalizeLocations(
    override.locations ?? defaults.locations ?? candidate.locations,
  );
  const applicationUrl =
    override.applicationUrl ?? candidate.applicationUrl ?? candidate.sourceUrl;
  const sourceUrl =
    override.sourceUrl ?? candidate.sourceUrl ?? candidate.applicationUrl;

  required(evidence, "visaEvidence", source, candidate);
  required(locations, "locations", source, candidate);

  return {
    id: stableJobId(source.id, candidate.externalId, applicationUrl),
    company: source.company,
    title: required(candidate.title, "title", source, candidate).trim(),
    category:
      override.category ?? defaults.category ?? normalizeCategory(candidate.title),
    applicationUrl: required(
      applicationUrl,
      "applicationUrl",
      source,
      candidate,
    ),
    sourceUrl: required(sourceUrl, "sourceUrl", source, candidate),
    sourcePlatform: PLATFORM_LABELS[source.platform],
    locations,
    country: required(
      override.country ?? defaults.country,
      "country",
      source,
      candidate,
    ),
    workplaceType:
      override.workplaceType ??
      defaults.workplaceType ??
      candidate.workplaceType ??
      "Unspecified",
    compensation: firstDefined(
      override.compensation,
      defaults.compensation,
      candidate.compensation,
      null,
    ),
    datePosted: firstDefined(
      override.datePosted,
      defaults.datePosted,
      isoDate(candidate.datePosted),
      null,
    ),
    deadline: firstDefined(override.deadline, defaults.deadline, null),
    startPeriod: firstDefined(
      override.startPeriod,
      defaults.startPeriod,
      null,
    ),
    graduationWindow: firstDefined(
      override.graduationWindow,
      defaults.graduationWindow,
      null,
    ),
    graduationMonths: uniqueStrings(
      override.graduationMonths ?? defaults.graduationMonths ?? [],
    ).sort(),
    degreeLevels: DEGREE_LEVELS.filter((level) =>
      uniqueStrings(
        required(
          override.degreeLevels ?? defaults.degreeLevels,
          "degreeLevels",
          source,
          candidate,
        ),
      ).includes(level),
    ),
    experienceRequirements: firstDefined(
      override.experienceRequirements,
      defaults.experienceRequirements,
      null,
    ),
    visaEvidence: evidence,
    firstSeen: today,
    lastVerified: today,
    status: "active",
    closedDate: null,
    tags: uniqueStrings([
      ...(defaults.tags ?? []),
      ...(override.tags ?? []),
    ]).sort(),
    missCount: 0,
    sourceId: source.id,
  };
}

export function normalizeCollectedSource(source, candidates, today) {
  return candidates
    .filter((candidate) => candidateIsSelected(source, candidate))
    .map((candidate) => ({
      job: normalizeSourceCandidate(source, candidate, today),
      verification: "verified",
    }));
}
