import { calendarDate } from "./normalization.js";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function utcStartOfDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new TypeError(`Invalid date: ${value}`);
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysBetween(earlier, later) {
  return Math.floor(
    (utcStartOfDay(later) - utcStartOfDay(earlier)) / DAY_IN_MILLISECONDS,
  );
}

export function deriveStatus(job, now, settings) {
  const today = calendarDate(now, settings.timeZone);

  if (job.status === "closed" || job.closedDate) {
    return { status: "closed", closedDate: job.closedDate ?? today };
  }

  if (job.deadline && job.deadline < today) {
    return { status: "closed", closedDate: job.deadline };
  }

  if (daysBetween(job.lastVerified, today) > settings.staleAfterDays) {
    return { status: "stale", closedDate: null };
  }

  if (
    job.deadline &&
    daysBetween(today, job.deadline) <= settings.closingSoonDays
  ) {
    return { status: "closing-soon", closedDate: null };
  }

  return { status: "active", closedDate: null };
}

export function applyDerivedStatus(job, now, settings) {
  return { ...job, ...deriveStatus(job, now, settings) };
}

export function closeAfterMiss(job, now, missThreshold, timeZone = "UTC") {
  const missCount = job.missCount + 1;
  if (missCount < missThreshold) {
    return { ...job, missCount };
  }

  return {
    ...job,
    missCount,
    status: "closed",
    closedDate: calendarDate(now, timeZone),
  };
}
