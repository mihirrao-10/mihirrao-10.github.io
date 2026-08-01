import {
  CATEGORY_ORDER,
  DEFAULT_FILTERS,
  PERSONAL_STATUSES,
  exportTrackingPayload,
  filterJobs,
  formatDate,
  getPersonalStatus,
  loadTracking,
  mergeTracking,
  parseTrackingImport,
  saveTracking,
  trackingToCsv,
  updateTracking,
} from "./core.js";

const elements = {
  activeCount: document.querySelector("#active-count"),
  lastUpdated: document.querySelector("#last-updated"),
  activeView: document.querySelector("#active-view"),
  archiveView: document.querySelector("#archive-view"),
  resultCount: document.querySelector("#result-count"),
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
  location: document.querySelector("#location-filter"),
  workplace: document.querySelector("#workplace-filter"),
  evidence: document.querySelector("#evidence-filter"),
  degree: document.querySelector("#degree-filter"),
  graduation: document.querySelector("#graduation-filter"),
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
  location: elements.location,
  workplace: elements.workplace,
  evidence: elements.evidence,
  degree: elements.degree,
  graduation: elements.graduation,
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
  "closing-soon": "Closing soon",
  stale: "Not recently verified",
  closed: "Closed",
};

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
  populateSelect(elements.location, unique(allJobs.flatMap((job) => job.locations ?? [])));
  populateSelect(elements.workplace, unique(allJobs.map((job) => job.workplaceType)));
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

function trackingOptions(selected) {
  return ["Untracked", ...PERSONAL_STATUSES]
    .map((status) => `<option value="${escapeHtml(status)}"${status === selected ? " selected" : ""}>${escapeHtml(status)}</option>`)
    .join("");
}

function sourceMarkup(job) {
  if (!job.sourceUrl) return escapeHtml(job.sourcePlatform);
  return `<a class="source-link" href="${escapeHtml(job.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(job.sourcePlatform)}</a>`;
}

function jobMarkup(job) {
  const tracking = state.tracking.jobs[job.id] ?? { status: "", notes: "" };
  const personalStatus = getPersonalStatus(state.tracking, job.id);
  const status = statusLabels[job.status] ?? job.status;
  const locations = (job.locations ?? []).join(" · ") || "Not listed";
  const tags = [job.category, ...(job.tags ?? []).slice(0, 2)];
  const evidence = job.visaEvidence;
  const evidenceLink = evidence?.url
    ? `<a class="evidence-link" href="${escapeHtml(evidence.url)}" target="_blank" rel="noopener noreferrer">View evidence</a>`
    : "";
  const deadlineLabel = job.status === "closed" && job.closedDate ? "Closed" : "Deadline";
  const degreeLevels = (job.degreeLevels ?? []).join(" · ") || "Not listed";

  return `
    <li>
      <article class="job-row" aria-labelledby="job-${escapeHtml(job.id)}">
        <div>
          <p class="role-company">${escapeHtml(job.company)}</p>
          <h3 class="role-title" id="job-${escapeHtml(job.id)}">${escapeHtml(job.title)}</h3>
          <div class="role-tags">
            <span class="status-badge status-${escapeHtml(job.status)}">${escapeHtml(status)}</span>
            ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
        <div>
          <dl class="facts-list">
            <div><dt>Location</dt><dd>${escapeHtml(locations)}</dd></div>
            <div><dt>Workplace</dt><dd>${escapeHtml(job.workplaceType)}</dd></div>
            <div><dt>Compensation</dt><dd>${escapeHtml(displayCompensation(job.compensation))}</dd></div>
          </dl>
          <dl class="timing-list">
            <div><dt>Posted</dt><dd>${escapeHtml(formatDate(job.datePosted))}</dd></div>
            <div><dt>${deadlineLabel}</dt><dd>${escapeHtml(formatDate(job.closedDate ?? job.deadline))}</dd></div>
            <div><dt>Start</dt><dd>${escapeHtml(job.startPeriod || "Not listed")}</dd></div>
            <div><dt>Graduation</dt><dd>${escapeHtml(job.graduationWindow || "Not listed")}</dd></div>
            <div><dt>Degree</dt><dd>${escapeHtml(degreeLevels)}</dd></div>
            <div><dt>Experience</dt><dd>${escapeHtml(job.experienceRequirements || "Not listed")}</dd></div>
          </dl>
        </div>
        <div>
          <span class="evidence-badge">${escapeHtml(evidence?.level)}</span>
          <p class="evidence-copy">${escapeHtml(evidence?.explanation)}</p>
          <div class="meta-line">${evidenceLink}${sourceMarkup(job)}</div>
        </div>
        <div>
          <label for="tracking-${escapeHtml(job.id)}"><span>My status</span></label>
          <select
            class="tracking-select"
            id="tracking-${escapeHtml(job.id)}"
            data-action="tracking-status"
            data-job-id="${escapeHtml(job.id)}"
          >${trackingOptions(personalStatus)}</select>
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
          <a class="apply-link" href="${escapeHtml(job.applicationUrl)}" target="_blank" rel="noopener noreferrer">Official application</a>
          <p class="verified-line">Verified ${escapeHtml(formatDate(job.lastVerified))}</p>
        </div>
      </article>
    </li>`;
}

function render() {
  const jobs = state.view === "active" ? state.activeJobs : state.archivedJobs;
  const visibleJobs = filterJobs(jobs, state.filters, state.tracking);

  elements.resultCount.textContent = String(visibleJobs.length);
  elements.jobList.innerHTML = visibleJobs.map(jobMarkup).join("");
  elements.jobList.setAttribute("aria-busy", "false");
  elements.emptyState.hidden = visibleJobs.length !== 0;
  const archiveIsEmpty = state.view === "archive" && state.archivedJobs.length === 0;
  elements.emptyHeading.textContent = archiveIsEmpty
    ? "No closed roles have been archived yet."
    : "No roles match these filters.";
  elements.emptyCopy.textContent = archiveIsEmpty
    ? "Confirmed closures will remain available here instead of disappearing from the board."
    : "Try a broader keyword or reset the filters. Accuracy takes priority over listing volume.";
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

  elements.jobList.addEventListener("change", (event) => {
    const control = event.target.closest("[data-action]");
    if (!control) return;
    const jobId = control.dataset.jobId;
    if (control.dataset.action === "tracking-status") {
      state.tracking = updateTracking(state.tracking, jobId, {
        status: control.value === "Untracked" ? "" : control.value,
      });
      persistTracking();
      showToast(control.value === "Hidden" ? "Role hidden. Filter by Hidden to restore it." : "Application status saved in this browser.");
      render();
    }
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

    elements.activeCount.textContent = String(metadata.activeCount ?? activeJobs.length);
    elements.lastUpdated.textContent = formatDate(metadata.lastSuccessfulUpdate, { includeTime: true });
    elements.activeView.textContent = `Active (${activeJobs.length})`;
    elements.archiveView.textContent = `Archived / closed (${archivedJobs.length})`;
    initializeFilterOptions();
    render();
  } catch (error) {
    console.error(error);
    elements.jobList.setAttribute("aria-busy", "false");
    elements.jobList.replaceChildren();
    elements.resultCount.textContent = "0";
    elements.emptyState.hidden = true;
    elements.errorState.hidden = false;
    elements.activeCount.textContent = "Unavailable";
    elements.lastUpdated.textContent = "Unavailable";
  }
}

initialize();
