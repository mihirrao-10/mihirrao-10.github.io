import {
  CATEGORY_ORDER,
  DEFAULT_FILTERS,
  exportTrackingPayload,
  filterJobs,
  formatDate,
  getPersonalStatus,
  groupJobsByCompany,
  loadTracking,
  mergeTracking,
  parseTrackingImport,
  saveTracking,
  trackingToCsv,
  updateTracking,
} from "./core.js";

const elements = {
  activeCompanyCount: document.querySelector("#active-company-count"),
  activeRoleCount: document.querySelector("#active-role-count"),
  lastUpdated: document.querySelector("#last-updated"),
  activeView: document.querySelector("#active-view"),
  archiveView: document.querySelector("#archive-view"),
  resultCount: document.querySelector("#result-count"),
  roleCount: document.querySelector("#role-count"),
  jobList: document.querySelector("#job-list"),
  emptyState: document.querySelector("#empty-state"),
  emptyHeading: document.querySelector("#empty-heading"),
  emptyCopy: document.querySelector("#empty-copy"),
  errorState: document.querySelector("#error-state"),
  reset: document.querySelector("#reset-filters"),
  emptyReset: document.querySelector("#empty-reset"),
  search: document.querySelector("#keyword-search"),
  sort: document.querySelector("#sort-jobs"),
  category: document.querySelector("#category-filter"),
  company: document.querySelector("#company-filter"),
  personalStatus: document.querySelector("#personal-filter"),
  exportJson: document.querySelector("#export-json"),
  exportCsv: document.querySelector("#export-csv"),
  importJson: document.querySelector("#import-json"),
  toast: document.querySelector("#toast"),
};

const filterElements = {
  keyword: elements.search,
  sort: elements.sort,
  category: elements.category,
  company: elements.company,
  personalStatus: elements.personalStatus,
};

const state = {
  activeJobs: [],
  archivedJobs: [],
  metadata: null,
  view: "active",
  filters: { ...DEFAULT_FILTERS },
  tracking: loadTracking(window.localStorage),
};

const statusLabels = {
  active: "Active",
  upcoming: "Opens soon",
  "closing-soon": "Closing soon",
  stale: "Not recently verified",
  closed: "Closed",
};

const COMPANY_ROLE_PREVIEW = 6;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

function populateSelect(select, values) {
  const defaultOption = select.options[0];
  const currentValue = select.value;
  select.replaceChildren(defaultOption);
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = currentValue;
}

function initializeFilterOptions() {
  const allJobs = [...state.activeJobs, ...state.archivedJobs];
  const presentCategories = new Set(allJobs.map((job) => job.category));
  populateSelect(elements.category, CATEGORY_ORDER.filter((category) => presentCategories.has(category)));
  populateSelect(elements.company, unique(allJobs.map((job) => job.company)));
}

function displayCompensation(value) {
  if (!value) return "Not listed";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value.display) return value.display;
    const range = [value.minimum, value.maximum].filter((item) => item !== null && item !== undefined).join("–");
    return [range, value.currency, value.period].filter(Boolean).join(" ") || "Not listed";
  }
  return String(value);
}

function sourceMarkup(job) {
  if (!job.sourceUrl) return escapeHtml(job.sourcePlatform);
  return `<a class="source-link" href="${escapeHtml(job.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(job.sourcePlatform)}</a>`;
}

function roleMarkup(job) {
  const tracking = state.tracking.jobs[job.id] ?? { status: "", notes: "" };
  const personalStatus = getPersonalStatus(state.tracking, job.id);
  const isApplied = personalStatus === "Applied";
  const status = statusLabels[job.status] ?? job.status;
  const locations = (job.locations ?? []).join(" · ") || "Not listed";
  const evidence = job.visaEvidence;
  const evidenceLink = evidence?.url
    ? `<a class="evidence-link" href="${escapeHtml(evidence.url)}" target="_blank" rel="noopener noreferrer">View evidence</a>`
    : "";
  const deadlineLabel = job.status === "closed" && job.closedDate ? "Closed" : "Deadline";
  const deadline = job.closedDate ?? job.deadline;
  const deadlineValue = deadline ? formatDate(deadline) : "Not published — apply early";

  return `
    <li class="company-role">
      <details class="role-disclosure">
        <summary aria-labelledby="job-${escapeHtml(job.id)}">
          <span class="role-summary-copy">
            <span class="role-title" id="job-${escapeHtml(job.id)}" title="${escapeHtml(job.title)}">${escapeHtml(job.title)}</span>
            <span class="role-location" title="${escapeHtml(locations)}">${escapeHtml(locations)}</span>
          </span>
          <span class="role-summary-meta">
            <span class="status-badge status-${escapeHtml(job.status)}">${escapeHtml(status)}</span>
            <span class="tag">${escapeHtml(job.category)}</span>
            <span class="details-cue">Details</span>
          </span>
        </summary>
        <div class="role-details">
          <dl class="role-facts">
            <div><dt>Location</dt><dd>${escapeHtml(locations)}</dd></div>
            <div><dt>Workplace</dt><dd>${escapeHtml(job.workplaceType || "Not listed")}</dd></div>
            <div><dt>Compensation</dt><dd>${escapeHtml(displayCompensation(job.compensation))}</dd></div>
            <div><dt>Posted</dt><dd>${escapeHtml(formatDate(job.datePosted))}</dd></div>
            <div><dt>${deadlineLabel}</dt><dd>${escapeHtml(deadlineValue)}</dd></div>
            <div><dt>Start</dt><dd>${escapeHtml(job.startPeriod || "Not listed")}</dd></div>
            <div><dt>Candidate window</dt><dd>${escapeHtml(job.graduationWindow || "Not listed")}</dd></div>
            <div><dt>Experience</dt><dd>${escapeHtml(job.experienceRequirements || "Not listed")}</dd></div>
          </dl>
          <div class="role-evidence">
            <span class="evidence-badge">${escapeHtml(evidence?.level || "Unstated")}</span>
            <p class="evidence-copy">${escapeHtml(evidence?.explanation || "The posting does not state a sponsorship policy. Confirm directly with the employer.")}</p>
            <div class="meta-line">${evidenceLink}${sourceMarkup(job)}</div>
          </div>
          <div class="role-actions">
            <button
              class="application-toggle ${isApplied ? "is-applied" : "is-not-applied"}"
              id="tracking-${escapeHtml(job.id)}"
              type="button"
              aria-pressed="${String(isApplied)}"
              data-action="toggle-applied"
              data-job-id="${escapeHtml(job.id)}"
            >${escapeHtml(personalStatus)}</button>
            <details class="notes-control"${tracking.notes ? " open" : ""}>
              <summary>Private notes</summary>
              <label class="sr-only" for="notes-${escapeHtml(job.id)}">Private notes for ${escapeHtml(job.company)} ${escapeHtml(job.title)}</label>
              <textarea
                id="notes-${escapeHtml(job.id)}"
                data-action="tracking-notes"
                data-job-id="${escapeHtml(job.id)}"
                placeholder="Saved only in this browser"
              >${escapeHtml(tracking.notes)}</textarea>
            </details>
            <a class="apply-link" href="${escapeHtml(job.applicationUrl)}" target="_blank" rel="noopener noreferrer">Open official role ↗</a>
            <p class="verified-line">Verified ${escapeHtml(formatDate(job.lastVerified))}</p>
          </div>
        </div>
      </details>
    </li>`;
}

function companyMarkup(group, index) {
  const visibleRoles = group.jobs.slice(0, COMPANY_ROLE_PREVIEW);
  const remainingRoles = group.jobs.slice(COMPANY_ROLE_PREVIEW);
  const categories = unique(group.jobs.map((job) => job.category));
  const companyId = `company-${index + 1}`;
  const roleLabel = `${group.jobs.length} ${group.jobs.length === 1 ? "role" : "roles"}`;

  return `
    <li class="company-card">
      <article aria-labelledby="${companyId}">
        <header class="company-heading">
          <div class="company-heading-main">
            <span class="company-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3 id="${companyId}">${escapeHtml(group.company)}</h3>
              <p>${escapeHtml(roleLabel)} matching this view</p>
            </div>
          </div>
          <div class="company-categories" aria-label="Role categories">
            ${categories.map((category) => `<span class="tag">${escapeHtml(category)}</span>`).join("")}
          </div>
        </header>
        <ul class="company-role-list">
          ${visibleRoles.map(roleMarkup).join("")}
        </ul>
        ${remainingRoles.length ? `
          <details class="company-overflow">
            <summary>Show ${remainingRoles.length} more ${remainingRoles.length === 1 ? "role" : "roles"}</summary>
            <ul class="company-role-list">
              ${remainingRoles.map(roleMarkup).join("")}
            </ul>
          </details>` : ""}
      </article>
    </li>`;
}

function render() {
  const jobs = state.view === "active" ? state.activeJobs : state.archivedJobs;
  const visibleJobs = filterJobs(jobs, state.filters, state.tracking);
  const companyGroups = groupJobsByCompany(visibleJobs);

  elements.resultCount.textContent = String(companyGroups.length);
  elements.roleCount.textContent = String(visibleJobs.length);
  elements.jobList.innerHTML = companyGroups.map(companyMarkup).join("");
  elements.jobList.setAttribute("aria-busy", "false");
  elements.emptyState.hidden = visibleJobs.length !== 0;
  const archiveIsEmpty = state.view === "archive" && state.archivedJobs.length === 0;
  elements.emptyHeading.textContent = archiveIsEmpty
    ? "No closed roles have been archived yet."
    : "No companies match these filters.";
  elements.emptyCopy.textContent = archiveIsEmpty
    ? "Confirmed closures will remain available here instead of disappearing from the board."
    : "Try a broader company, role, location, or skill keyword, or reset the filters.";
  elements.emptyReset.hidden = archiveIsEmpty;
  elements.errorState.hidden = true;
  elements.activeView.setAttribute("aria-pressed", String(state.view === "active"));
  elements.archiveView.setAttribute("aria-pressed", String(state.view === "archive"));
}

function syncFiltersFromControls() {
  for (const [key, element] of Object.entries(filterElements)) {
    state.filters[key] = element.value;
  }
  render();
}

function resetFilters() {
  state.filters = { ...DEFAULT_FILTERS };
  for (const [key, element] of Object.entries(filterElements)) {
    element.value = state.filters[key];
  }
  render();
}

let toastTimer;
function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.textContent = "";
    elements.toast.classList.remove("is-visible");
  }, 4200);
}

function persistTracking() {
  try {
    saveTracking(window.localStorage, state.tracking);
  } catch {
    showToast("This browser could not save local tracking data.");
  }
}

function download(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  for (const element of Object.values(filterElements)) {
    element.addEventListener(element === elements.search ? "input" : "change", syncFiltersFromControls);
  }

  elements.reset.addEventListener("click", resetFilters);
  elements.emptyReset.addEventListener("click", resetFilters);
  elements.activeView.addEventListener("click", () => {
    state.view = "active";
    render();
  });
  elements.archiveView.addEventListener("click", () => {
    state.view = "archive";
    render();
  });

  elements.jobList.addEventListener("click", (event) => {
    const control = event.target.closest("[data-action]");
    if (!control || control.dataset.action !== "toggle-applied") return;
    const jobId = control.dataset.jobId;
    const nextStatus = getPersonalStatus(state.tracking, jobId) === "Applied" ? "" : "Applied";
    state.tracking = updateTracking(state.tracking, jobId, { status: nextStatus });
    persistTracking();
    showToast(`${nextStatus || "Not applied"} — saved only in this browser.`);
    render();
  });

  elements.jobList.addEventListener("change", (event) => {
    const control = event.target.closest("[data-action]");
    if (!control) return;
    const jobId = control.dataset.jobId;
    if (control.dataset.action === "tracking-notes") {
      state.tracking = updateTracking(state.tracking, jobId, { notes: control.value });
      persistTracking();
      showToast("Private note saved in this browser.");
    }
  });

  elements.exportJson.addEventListener("click", () => {
    download(
      "new-grad-job-tracker-2027-backup.json",
      `${JSON.stringify(exportTrackingPayload(state.tracking), null, 2)}\n`,
      "application/json",
    );
    showToast("Local tracking backup exported.");
  });

  elements.exportCsv.addEventListener("click", () => {
    download(
      "new-grad-job-tracker-2027-tracking.csv",
      trackingToCsv([...state.activeJobs, ...state.archivedJobs], state.tracking),
      "text/csv;charset=utf-8",
    );
    showToast("Tracked roles exported as CSV.");
  });

  elements.importJson.addEventListener("change", async () => {
    const [file] = elements.importJson.files;
    if (!file) return;
    try {
      const restored = parseTrackingImport(await file.text());
      state.tracking = mergeTracking(state.tracking, restored);
      persistTracking();
      render();
      showToast("Tracking backup restored in this browser.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The backup could not be imported.");
    } finally {
      elements.importJson.value = "";
    }
  });
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
  return response.json();
}

async function initialize() {
  bindEvents();
  try {
    const [activeJobs, archivedJobs, metadata] = await Promise.all([
      fetchJson("data/jobs.json"),
      fetchJson("data/archive.json"),
      fetchJson("data/metadata.json"),
    ]);
    state.activeJobs = activeJobs;
    state.archivedJobs = archivedJobs;
    state.metadata = metadata;

    const activeCompanyCount = unique(activeJobs.map((job) => job.company)).length;
    const archivedCompanyCount = unique(archivedJobs.map((job) => job.company)).length;
    elements.activeCompanyCount.textContent = String(metadata.activeCompanyCount ?? activeCompanyCount);
    elements.activeRoleCount.textContent = String(metadata.activeCount ?? activeJobs.length);
    elements.lastUpdated.textContent = formatDate(metadata.lastSuccessfulUpdate, { includeTime: true });
    elements.activeView.textContent = `Current (${activeCompanyCount})`;
    elements.archiveView.textContent = `Archived / closed (${archivedCompanyCount})`;
    initializeFilterOptions();
    render();
  } catch (error) {
    console.error(error);
    elements.jobList.setAttribute("aria-busy", "false");
    elements.jobList.replaceChildren();
    elements.resultCount.textContent = "0";
    elements.roleCount.textContent = "0";
    elements.emptyState.hidden = true;
    elements.errorState.hidden = false;
    elements.activeCompanyCount.textContent = "Unavailable";
    elements.activeRoleCount.textContent = "Unavailable";
    elements.lastUpdated.textContent = "Unavailable";
  }
}

initialize();
