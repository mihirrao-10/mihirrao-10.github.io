import { setTimeout as delay } from "node:timers/promises";

import { USER_AGENT } from "../constants.js";

function retryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

export async function requestWithRetry(url, options = {}) {
  const {
    retries = 2,
    timeoutMs = 12000,
    method = "GET",
    headers = {},
    parseJson = false,
  } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json, text/html;q=0.9, */*;q=0.8",
          "User-Agent": USER_AGENT,
          ...headers,
        },
        redirect: "follow",
        signal: controller.signal,
      });

      if (retryableStatus(response.status) && attempt < retries) {
        await response.body?.cancel();
        const retryAfter = Number(response.headers.get("retry-after"));
        await delay(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 5000)
            : 400 * 2 ** attempt,
        );
        continue;
      }

      if (parseJson && response.ok) {
        try {
          return { response, data: await response.json() };
        } catch (error) {
          lastError = new Error(`Response from ${url} was not valid JSON`, {
            cause: error,
          });
          await response.body?.cancel().catch(() => {});
          if (attempt < retries) {
            await delay(400 * 2 ** attempt);
            continue;
          }
          break;
        }
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await delay(400 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Request failed for ${url}: ${lastError?.message}`, {
    cause: lastError,
  });
}

export async function fetchJson(url, options = {}) {
  const result = await requestWithRetry(url, { ...options, parseJson: true });
  const response = result.response ?? result;
  if (!response.ok) {
    const status = `${response.status} ${response.statusText}`.trim();
    await response.body?.cancel();
    throw new Error(`Request for ${url} returned ${status}`);
  }

  return result.data;
}

export async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), values.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function probeUrl(url, options = {}) {
  try {
    const response = await requestWithRetry(url, options);
    const status = response.status;
    await response.body?.cancel();

    if (status >= 200 && status < 400) {
      return { state: "verified", status };
    }
    if (status === 404 || status === 410) {
      return { state: "missing", status };
    }
    return { state: "unverified", status };
  } catch (error) {
    return { state: "unverified", message: error.message };
  }
}
