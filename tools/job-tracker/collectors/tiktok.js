import {
  mapWithConcurrency,
  requestWithRetry,
} from "../lib/fetch.js";

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#8203;", "");
}

function pageText(html) {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html, externalId) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  if (!title) {
    throw new Error(`TikTok posting ${externalId} is missing its title`);
  }
  return decodeHtml(title).trim();
}

function extractApplicationUrl(html, externalId) {
  const expected = `https://careers.tiktok.com/resume/${externalId}/apply`;
  if (!html.includes(expected)) {
    throw new Error(
      `TikTok posting ${externalId} is missing its official application URL`,
    );
  }
  return expected;
}

function extractCompensation(text) {
  const match = text.match(
    /base salary range[^$]{0,120}\$([\d,]+)\s*[-–—]\s*\$?([\d,]+)\s+annually/i,
  );
  if (!match) {
    return null;
  }
  const format = (value) => Number(value.replaceAll(",", "")).toLocaleString("en-US");
  return `$${format(match[1])}–$${format(match[2])} base`;
}

async function collectPosting(externalId, requestOptions) {
  const sourceUrl = `https://lifeattiktok.com/search/${externalId}`;
  const response = await requestWithRetry(sourceUrl, requestOptions);

  if (response.status === 404 || response.status === 410) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) {
    const status = `${response.status} ${response.statusText}`.trim();
    await response.body?.cancel();
    throw new Error(`Request for ${sourceUrl} returned ${status}`);
  }

  const html = await response.text();
  const description = pageText(html);
  return {
    externalId,
    title: extractTitle(html, externalId),
    applicationUrl: extractApplicationUrl(html, externalId),
    sourceUrl,
    locations: [],
    workplaceType: "Hybrid",
    compensation: extractCompensation(description),
    datePosted: null,
    description,
    employmentType: "FullTime",
  };
}

export async function collectTikTok(source, requestOptions) {
  const postings = await mapWithConcurrency(
    source.selection.externalIds,
    4,
    (externalId) => collectPosting(externalId, requestOptions),
  );
  return postings.filter(Boolean);
}
