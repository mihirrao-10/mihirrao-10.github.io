import { collectAshby } from "./ashby.js";
import { collectGreenhouse } from "./greenhouse.js";
import { collectLever } from "./lever.js";

const COLLECTORS = Object.freeze({
  ashby: collectAshby,
  greenhouse: collectGreenhouse,
  lever: collectLever,
});

export async function collectSource(source, requestOptions) {
  const collector = COLLECTORS[source.platform];
  if (!collector) {
    throw new Error(`Unsupported source platform: ${source.platform}`);
  }
  return collector(source, requestOptions);
}
