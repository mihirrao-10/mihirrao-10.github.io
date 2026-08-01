import Ajv from "ajv";
import addFormats from "ajv-formats";

import { PATHS } from "../constants.js";
import { readJson } from "./io.js";

function createAjv() {
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
  });
  addFormats(ajv);
  return ajv;
}

function errorMessage(name, errors) {
  const details = (errors ?? [])
    .map((error) => {
      const location = error.instancePath || "/";
      return `${location} ${error.message}`;
    })
    .join("; ");
  return `${name} failed schema validation: ${details}`;
}

export function assertValid(validator, value, name) {
  if (!validator(value)) {
    throw new Error(errorMessage(name, validator.errors));
  }
  return value;
}

export async function loadValidators() {
  const [jobSchema, metadataSchema, sourceSchema] = await Promise.all([
    readJson(PATHS.jobSchema),
    readJson(PATHS.metadataSchema),
    readJson(PATHS.sourceSchema),
  ]);

  const ajv = createAjv();
  return {
    validateJob: ajv.compile(jobSchema),
    validateMetadata: ajv.compile(metadataSchema),
    validateSources: ajv.compile(sourceSchema),
  };
}

export function validateJobs(validator, jobs, name = "jobs") {
  if (!Array.isArray(jobs)) {
    throw new TypeError(`${name} must be an array`);
  }
  jobs.forEach((job, index) => {
    assertValid(validator, job, `${name}[${index}]`);
  });
  return jobs;
}
