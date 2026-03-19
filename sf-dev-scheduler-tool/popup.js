document.addEventListener("DOMContentLoaded", init);

const PREFS_KEY = "scheduler-monitor-preferences-v2";
const CACHE_KEY = "scheduler-monitor-cache-v2";
const REFRESH_INTERVAL_MINUTES = 5;
const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

const state = {
  view: "active",
  timezoneMode: "browser",
  searchTerm: "",
  statusFilter: "all",
  availableOrgs: [],
  selectedOrg: null,
  scheduledApexJobs: [],
  asyncJobs: [],
  asyncJobsAvailable: true,
  orgContext: null,
  snapshotSource: "live",
  lastSuccessfulFetchAt: null,
  lastError: "",
  drawerJobId: null
};

async function init() {
  await loadPreferences();
  bindEvents();
  bindRuntimeRefresh();
  syncControlValues();
  renderTimeZoneButtons();
  await loadOrgOptions();
  await bootstrapFromCache();
  await loadDashboard();
}

function bindEvents() {
  document.getElementById("refreshBtn")?.addEventListener("click", () => {
    loadDashboard({ force: true });
  });

  document.querySelectorAll(".stat-tab").forEach(button => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view || "active";
      closeDrawer();
      renderCurrentView();
      savePreferences();
    });
  });

  document.querySelectorAll(".timezone-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const mode = button.dataset.timezoneMode;
      if (mode === "org" && !getOrgTimeZone()) {
        return;
      }
      state.timezoneMode = mode || "browser";
      renderTimeZoneButtons();
      renderCurrentView();
      savePreferences();
    });
  });

  document.getElementById("searchInput")?.addEventListener("input", event => {
    state.searchTerm = event.target.value || "";
    renderCurrentView();
    savePreferences();
  });

  document.getElementById("statusFilter")?.addEventListener("change", event => {
    state.statusFilter = event.target.value || "all";
    renderCurrentView();
    savePreferences();
  });

  document.getElementById("clearFiltersBtn")?.addEventListener("click", () => {
    state.searchTerm = "";
    state.statusFilter = "all";
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    if (searchInput) searchInput.value = "";
    if (statusFilter) statusFilter.value = "all";
    renderCurrentView();
    savePreferences();
  });

  document.getElementById("orgSelector")?.addEventListener("change", async event => {
    const value = event.target.value || "";
    state.selectedOrg = state.availableOrgs.find(org => buildOrgSelectionValue(org) === value) || null;
    closeDrawer();
    await savePreferences();
    await bootstrapFromCache();
    await loadDashboard({ force: true });
  });

  document.getElementById("jobsTable")?.addEventListener("click", event => {
    const row = event.target.closest("tr[data-job-id]");
    if (row) openDrawer(row.dataset.jobId);
  });

  document.getElementById("jobsTable")?.addEventListener("keydown", event => {
    const row = event.target.closest("tr[data-job-id]");
    if (!row) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDrawer(row.dataset.jobId);
    }
  });

  document.getElementById("closeDrawerBtn")?.addEventListener("click", closeDrawer);
  document.getElementById("jobDrawerBackdrop")?.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeDrawer();
  });
}

function bindRuntimeRefresh() {
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "AUTO_REFRESH_DASHBOARD") {
      loadDashboard({ force: true });
    }
  });
}

async function loadPreferences() {
  const result = await chrome.storage.local.get(PREFS_KEY);
  const prefs = result[PREFS_KEY] || {};
  state.view = prefs.view || "active";
  state.timezoneMode = prefs.timezoneMode || "browser";
  state.searchTerm = prefs.searchTerm || "";
  state.statusFilter = prefs.statusFilter || "all";
}

async function savePreferences() {
  await chrome.storage.local.set({
    [PREFS_KEY]: {
      view: state.view,
      timezoneMode: state.timezoneMode,
      searchTerm: state.searchTerm,
      statusFilter: state.statusFilter,
      selectedOrgKey: getSelectedOrgKey()
    }
  });
}

async function loadOrgOptions() {
  try {
    state.availableOrgs = await SalesforceAPI.getSalesforceTabs();
  }
  catch (error) {
    state.availableOrgs = [];
  }

  const saved = (await chrome.storage.local.get(PREFS_KEY))[PREFS_KEY]?.selectedOrgKey;
  state.selectedOrg = state.availableOrgs.find(org =>
    org.isActive
  )
    || state.availableOrgs.find(org => SalesforceAPI.buildOrgKey(org.url) === saved)
    || state.availableOrgs[0]
    || null;
  syncOrgSelector();
}

function syncOrgSelector() {
  const select = document.getElementById("orgSelector");
  if (!select) return;
  select.innerHTML = "";

  if (state.availableOrgs.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No Salesforce tabs found";
    option.value = "";
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  state.availableOrgs.forEach(org => {
    const option = document.createElement("option");
    option.value = buildOrgSelectionValue(org);
    option.textContent = `${org.label || org.host}${org.isActive ? " (Active)" : ""}`;
    select.appendChild(option);
  });

  select.disabled = false;
  select.value = state.selectedOrg ? buildOrgSelectionValue(state.selectedOrg) : buildOrgSelectionValue(state.availableOrgs[0]);
}

async function bootstrapFromCache() {
  const cacheStore = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
  const snapshot = cacheStore[getSelectedOrgKey()];
  if (!snapshot) {
    return;
  }

  applySnapshot(snapshot, "cache");
  renderCurrentView();
}

async function loadDashboard({ force = false } = {}) {
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) refreshBtn.disabled = true;

  const context = getSelectedContext();
  const previousSnapshot = await getCachedSnapshot(getSelectedOrgKey());

  try {
    const [scheduledResult, asyncResult, orgResult] = await Promise.allSettled([
      SalesforceAPI.getScheduledJobs(context),
      SalesforceAPI.getAsyncJobs(context),
      SalesforceAPI.getOrgContext(context)
    ]);

    if (scheduledResult.status !== "fulfilled") {
      throw scheduledResult.reason instanceof Error
        ? scheduledResult.reason
        : new Error(String(scheduledResult.reason || "Could not load jobs."));
    }

    const snapshot = {
      scheduledApexJobs: scheduledResult.value || [],
      asyncJobs: asyncResult.status === "fulfilled" ? asyncResult.value || [] : [],
      asyncJobsAvailable: asyncResult.status === "fulfilled",
      orgContext: orgResult.status === "fulfilled" ? orgResult.value : fallbackOrgContext(context, orgResult.reason),
      lastSuccessfulFetchAt: new Date().toISOString()
    };

    applySnapshot(snapshot, "live");
    await saveSnapshot(snapshot);
    state.lastError = "";
  }
  catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    if (!previousSnapshot) {
      state.scheduledApexJobs = [];
      state.asyncJobs = [];
      state.asyncJobsAvailable = false;
      state.orgContext = fallbackOrgContext(context, error);
    }
  }
  finally {
    if (refreshBtn) refreshBtn.disabled = false;
    renderTimeZoneButtons();
    renderCurrentView(force);
  }
}

function applySnapshot(snapshot, source) {
  state.scheduledApexJobs = Array.isArray(snapshot.scheduledApexJobs) ? snapshot.scheduledApexJobs : [];
  state.asyncJobs = Array.isArray(snapshot.asyncJobs) ? snapshot.asyncJobs : [];
  state.asyncJobsAvailable = snapshot.asyncJobsAvailable !== false;
  state.orgContext = snapshot.orgContext || null;
  state.lastSuccessfulFetchAt = snapshot.lastSuccessfulFetchAt || null;
  state.snapshotSource = source;
}

async function saveSnapshot(snapshot) {
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cacheStore = result[CACHE_KEY] || {};
  cacheStore[getSelectedOrgKey()] = snapshot;
  await chrome.storage.local.set({ [CACHE_KEY]: cacheStore });
}

async function getCachedSnapshot(orgKey) {
  const result = await chrome.storage.local.get(CACHE_KEY);
  return (result[CACHE_KEY] || {})[orgKey] || null;
}

function renderCurrentView(forceMeta = false) {
  const derived = getDerivedData();
  updateStats(derived);
  updateDebugStrip(derived);
  updateHealthStrip(derived);
  renderActiveState();
  renderSchedules(derived.filteredSchedules);
  renderSecondaryView(derived);
  renderDrawer();
  updateMeta(forceMeta, derived);
  return derived;
}

function syncControlValues() {
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  if (searchInput) searchInput.value = state.searchTerm;
  if (statusFilter) statusFilter.value = state.statusFilter;
}

function getDerivedData() {
  const scheduledOnly = state.scheduledApexJobs.filter(job => String(job.jobType || "").toLowerCase() === "scheduled apex");
  const filteredSchedules = scheduledOnly.filter(matchesSearch).filter(job => matchesStatusFilter(job.state));
  const now = new Date();
  const timeZone = getDisplayTimeZone();
  const asyncToday = state.asyncJobs.filter(job => isToday(job.createdDate, timeZone));
  const passedToday = asyncToday.filter(job => isSuccessStatus(job.status));
  const failedToday = asyncToday.filter(job => isFailureStatus(job.status));
  const ranTodaySchedules = scheduledOnly.filter(job => isToday(job.previousFireTime, timeZone));
  const dueTodaySchedules = scheduledOnly.filter(job => isRunnableToday(job, timeZone, now));
  return {
    scheduledOnly,
    filteredSchedules,
    asyncToday,
    passedToday,
    failedToday,
    ranTodaySchedules,
    dueTodaySchedules,
    runsTodayCount: getRunsTodayCount(asyncToday, ranTodaySchedules),
    timeZone,
    now
  };
}

function updateStats(derived) {
  setText("activeSchedulers", String(derived.scheduledOnly.length));
  setText("runsToday", String(derived.runsTodayCount));
  setText("passedToday", String(derived.passedToday.length));
  setText("failedToday", String(derived.failedToday.length));
  setText("willRunToday", String(derived.dueTodaySchedules.length));
}

function getRunsTodayCount(asyncToday, ranTodaySchedules) {
  const asyncSchedulerNames = new Set(asyncToday.map(resolveAsyncSchedulerName));
  const unmatchedScheduleRuns = ranTodaySchedules.filter(job => !asyncSchedulerNames.has(job.schedulerName));
  return asyncToday.length + unmatchedScheduleRuns.length;
}

function getMatchedScheduleForAsyncJob(asyncJob) {
  if (asyncJob?.cronTriggerId) {
    const directMatch = state.scheduledApexJobs.find(job => job.id === asyncJob.cronTriggerId);

    if (directMatch) {
      return directMatch;
    }
  }

  if (asyncJob?.schedulerName) {
    const namedMatch = state.scheduledApexJobs.find(job => job.schedulerName === asyncJob.schedulerName);

    if (namedMatch) {
      return namedMatch;
    }
  }

  if (asyncJob?.apexClassName && asyncJob.apexClassName !== "-") {
    const matchingClassSchedules = state.scheduledApexJobs.filter(job =>
      String(job.jobType || "").toLowerCase() === "scheduled apex"
      && job.apexClassName === asyncJob.apexClassName
    );

    if (matchingClassSchedules.length === 1) {
      return matchingClassSchedules[0];
    }

    const classTimedMatch = findScheduleByTimestamp(
      asyncJob.createdDate,
      job => job.apexClassName === asyncJob.apexClassName
    );

    if (classTimedMatch) {
      return classTimedMatch;
    }
  }

  return findScheduleByTimestamp(asyncJob?.createdDate);
}

function updateDebugStrip(derived) {
  const orgTz = getOrgTimeZone();
  setText("debugTimezone", state.timezoneMode === "org" && orgTz ? `${orgTz} (Org)` : `${BROWSER_TZ} (Browser)`);
  setText("debugScheduleSource", `${derived.scheduledOnly.length} returned | ${derived.filteredSchedules.length} visible`);
  setText("debugAsyncSource", state.asyncJobsAvailable ? `${state.asyncJobs.length} returned` : "Partial unavailable");
  setText("debugStatus", state.lastError ? `Using ${state.snapshotSource} data | ${state.lastError}` : `Using ${state.snapshotSource} data`);
}

function updateHealthStrip(derived) {
  const ageMinutes = getDataAgeMinutes();
  const freshness = state.snapshotSource === "cache"
    ? `Cached${ageMinutes == null ? "" : ` | ${ageMinutes}m old`}`
    : ageMinutes != null && ageMinutes > REFRESH_INTERVAL_MINUTES * 2
      ? `Stale | ${ageMinutes}m old`
      : "Live | Fresh";
  const orgTz = getOrgTimeZone();
  const orgName = state.orgContext?.orgName || state.selectedOrg?.label || "Org timezone not available. Using browser time.";
  const browserDiffers = orgTz && orgTz !== BROWSER_TZ ? ` | Browser ${BROWSER_TZ}` : "";
  setText("healthFreshness", freshness);
  setText("healthLastSuccess", state.lastSuccessfulFetchAt ? DATE_TIME_FORMATTER.format(new Date(state.lastSuccessfulFetchAt)) : "No successful refresh yet");
  setText("healthAsync", state.asyncJobsAvailable ? "Healthy" : "Partial data unavailable");
  setText("healthOrg", `${orgName}${orgTz ? ` | ${orgTz}${browserDiffers}` : ""}`);
}

function renderActiveState() {
  document.querySelectorAll(".stat-tab").forEach(button => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderSchedules(schedules) {
  const tbody = document.getElementById("jobsTable");
  const activePanel = document.getElementById("activePanel");
  const todayPanel = document.getElementById("todayPanel");
  if (!tbody || !activePanel || !todayPanel) return;
  activePanel.hidden = state.view !== "active";
  todayPanel.hidden = state.view === "active";

  if (state.view !== "active") {
    return;
  }

  if (schedules.length === 0) {
    tbody.innerHTML = `<tr><td class="empty-state" colspan="7">${escapeHtml(getEmptyMessage())}</td></tr>`;
    return;
  }

  tbody.innerHTML = schedules.map(job => {
    const relatedRuns = getRelatedRuns(job).length;
    const apexClassName = getRelatedApexClass(job);
    const todayFlags = [];
    if (isToday(job.previousFireTime, getDisplayTimeZone())) todayFlags.push("Ran today");
    if (isRunnableToday(job, getDisplayTimeZone(), new Date())) todayFlags.push("Will run today");
    return `
      <tr class="is-clickable" data-job-id="${escapeHtml(job.id)}" tabindex="0" role="button" aria-label="Open details for ${escapeHtml(job.schedulerName)}">
        <td>${renderIdentityCell(job.schedulerName, apexClassName)}</td>
        <td>${escapeHtml(job.jobType || "-")}</td>
        <td>${renderStatusChip(job.state)}</td>
        <td class="cron-cell" title="${escapeHtml(job.cronExpression || "-")}">${escapeHtml(explainSchedulerCron(job.cronExpression || ""))}</td>
        <td>${escapeHtml(formatDate(job.previousFireTime))}</td>
        <td>${escapeHtml(formatDate(job.nextFireTime))}</td>
        <td>${escapeHtml(todayFlags.join(" | ") || (relatedRuns ? `${relatedRuns} recent run${relatedRuns === 1 ? "" : "s"}` : "No runs today"))}</td>
      </tr>
    `;
  }).join("");
}

function renderSecondaryView(derived) {
  const tbody = document.getElementById("todayRunsTable");
  if (!tbody || state.view === "active") return;
  const config = getViewConfig(derived);
  setText("todayPanelTitle", config.title);
  setText("todayPanelKicker", config.kicker);
  setText("todayPanelBadge", config.badge);

  if (config.rows.length === 0) {
    tbody.innerHTML = `<tr><td class="empty-state" colspan="6">${escapeHtml(config.empty)}</td></tr>`;
    return;
  }

  tbody.innerHTML = config.rows.map(row => `
    <tr>
      <td>${renderIdentityCell(row.schedulerName, row.apexClassName)}</td>
      <td>${escapeHtml(row.type)}</td>
      <td>${renderStatusChip(row.status)}</td>
      <td>${escapeHtml(row.started)}</td>
      <td>${escapeHtml(row.completed)}</td>
      <td>${escapeHtml(row.note)}</td>
    </tr>
  `).join("");
}

function getViewConfig(derived) {
  const runRows = applyRowFilters(derived.asyncToday.map(job => ({
    schedulerName: resolveAsyncSchedulerName(job),
    apexClassName: getAsyncApexClass(job),
    type: job.jobType || "Scheduled Apex",
    status: job.status || "-",
    started: formatDate(job.createdDate),
    completed: getAsyncCompletedValue(job),
    note: getAsyncRowNote(job)
  })));
  const syntheticRanRows = applyRowFilters(derived.ranTodaySchedules
    .filter(job => !runRows.some(row => row.schedulerName === job.schedulerName))
    .map(job => ({
      schedulerName: job.schedulerName,
      apexClassName: getRelatedApexClass(job),
      type: job.jobType || "Scheduled Apex",
      status: job.state || "Completed",
      started: formatDate(job.previousFireTime),
      completed: formatDate(job.previousFireTime),
      note: "Detected from scheduler history"
    })));
  const dueRows = applyRowFilters(derived.dueTodaySchedules.map(job => ({
    schedulerName: job.schedulerName,
    apexClassName: getRelatedApexClass(job),
    type: job.jobType || "Scheduled Apex",
    status: job.state || "Waiting",
    started: formatDate(job.nextFireTime),
    completed: "-",
    note: "Scheduled later today"
  })));

  if (state.view === "runs-today") {
    return {
      title: "Runs Today",
      kicker: "Execution Timeline",
      badge: "Completed runs and scheduler history for today",
      rows: [...runRows, ...syntheticRanRows],
      empty: "No scheduled Apex runs found for today."
    };
  }

  if (state.view === "passed-today") {
    return {
      title: "Passed Today",
      kicker: "Execution Timeline",
      badge: "Successful scheduled jobs for today",
      rows: runRows.filter(row => isSuccessStatus(row.status)),
      empty: "No successful scheduled Apex runs found for today."
    };
  }

  if (state.view === "failed-today") {
    return {
      title: "Failed Today",
      kicker: "Execution Timeline",
      badge: "Failed or aborted scheduled jobs for today",
      rows: runRows.filter(row => isFailureStatus(row.status)),
      empty: "No failed scheduled Apex runs found for today."
    };
  }

  return {
    title: "Will Run Today",
    kicker: "Execution Timeline",
    badge: "Upcoming scheduled runs due later today",
    rows: dueRows,
    empty: "No scheduled Apex jobs are due later today."
  };
}

function applyRowFilters(rows) {
  return rows.filter(row => {
    const haystack = [row.schedulerName, row.apexClassName, row.type, row.status, row.started, row.completed, row.note]
      .join(" ")
      .toLowerCase();
    const term = state.searchTerm.trim().toLowerCase();
    if (term && !haystack.includes(term)) {
      return false;
    }
    return matchesStatusFilter(row.status);
  });
}

function resolveAsyncSchedulerName(asyncJob) {
  const matchedSchedule = getMatchedScheduleForAsyncJob(asyncJob);

  if (matchedSchedule?.schedulerName) {
    return matchedSchedule.schedulerName;
  }

  if (asyncJob.schedulerName) {
    return asyncJob.schedulerName;
  }

  if (asyncJob.apexClassName && asyncJob.apexClassName !== "-") {
    return asyncJob.apexClassName;
  }

  return "Scheduler unavailable";
}

function findScheduleByTimestamp(timestamp, predicate = () => true) {
  const target = parseSalesforceDate(timestamp);
  if (!target) {
    return null;
  }

  const candidates = state.scheduledApexJobs
    .filter(job => String(job.jobType || "").toLowerCase() === "scheduled apex")
    .filter(predicate)
    .map(job => {
      const previous = parseSalesforceDate(job.previousFireTime);
      if (!previous) {
        return null;
      }

      return {
        job,
        diff: Math.abs(previous.getTime() - target.getTime())
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.diff - right.diff);

  if (!candidates.length) {
    return null;
  }

  return candidates[0].diff <= 10 * 60 * 1000
    ? candidates[0].job
    : null;
}

function renderDrawer() {
  const drawer = document.getElementById("jobDrawer");
  const backdrop = document.getElementById("jobDrawerBackdrop");
  if (!drawer || !backdrop) return;

  const job = state.scheduledApexJobs.find(item => item.id === state.drawerJobId);
  if (!job) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    return;
  }

  const relatedRuns = getRelatedRuns(job);
  setText("drawerTitle", job.schedulerName || "Scheduler Detail");
  setText("drawerStatus", job.state || "-");
  setText("drawerType", job.jobType || "-");
  setText("drawerSchedulePattern", explainSchedulerCron(job.cronExpression || ""));
  setText("drawerCron", job.cronExpression || "-");
  setText("drawerPreviousRun", formatDate(job.previousFireTime));
  setText("drawerNextRun", formatDate(job.nextFireTime));
  setText("drawerTimesTriggered", String(job.timesTriggered || 0));
  setText("drawerApexClass", getRelatedApexClass(job));
  setText(
    "drawerRunSummary",
    relatedRuns.length
      ? relatedRuns.slice(0, 4).map(run => `${run.status || "-"} | ${formatDate(run.createdDate)}`).join(" || ")
      : "No recent Async Apex runs found."
  );

  backdrop.hidden = false;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
}

function openDrawer(jobId) {
  state.drawerJobId = jobId;
  renderDrawer();
}

function closeDrawer() {
  state.drawerJobId = null;
  renderDrawer();
}

function getRelatedRuns(job) {
  return state.asyncJobs
    .filter(run => {
      if (run.cronTriggerId === job.id) {
        return true;
      }

      const matchedSchedule = getMatchedScheduleForAsyncJob(run);
      return matchedSchedule?.id === job.id || resolveAsyncSchedulerName(run) === job.schedulerName;
    })
    .sort((left, right) => new Date(right.createdDate || 0) - new Date(left.createdDate || 0));
}

function getAsyncApexClass(asyncJob) {
  if (asyncJob?.apexClassName && asyncJob.apexClassName !== "-") {
    return asyncJob.apexClassName;
  }

  const matchedSchedule = getMatchedScheduleForAsyncJob(asyncJob);
  if (matchedSchedule?.apexClassName && matchedSchedule.apexClassName !== "-") {
    return matchedSchedule.apexClassName;
  }

  return "-";
}

function getRelatedApexClass(job) {
  if (job?.apexClassName && job.apexClassName !== "-") {
    return job.apexClassName;
  }

  const runWithClass = getRelatedRuns(job).find(run => getAsyncApexClass(run) !== "-");
  return runWithClass ? getAsyncApexClass(runWithClass) : "-";
}

function getAsyncCompletedValue(asyncJob) {
  if (asyncJob?.completedDate) {
    return formatDate(asyncJob.completedDate);
  }

  if (isTerminalStatus(asyncJob?.status) && asyncJob?.createdDate) {
    return formatDate(asyncJob.createdDate);
  }

  const matchedSchedule = getMatchedScheduleForAsyncJob(asyncJob);
  if (isTerminalStatus(asyncJob?.status) && matchedSchedule?.previousFireTime) {
    return formatDate(matchedSchedule.previousFireTime);
  }

  return "-";
}

function getAsyncRowNote(asyncJob) {
  const parts = [];
  const status = String(asyncJob?.status || "").trim();

  if (status) {
    parts.push(status);
  }

  if (Number(asyncJob?.numberOfErrors || 0) > 0) {
    const count = Number(asyncJob.numberOfErrors || 0);
    parts.push(`${count} error${count === 1 ? "" : "s"}`);
  }

  if (!asyncJob?.completedDate && isTerminalStatus(asyncJob?.status)) {
    parts.push("completion time unavailable");
  }

  return parts.join(" | ") || "-";
}

function renderTimeZoneButtons() {
  const orgTimeZone = getOrgTimeZone();
  if (!orgTimeZone && state.timezoneMode === "org") {
    state.timezoneMode = "browser";
  }
  document.querySelectorAll(".timezone-toggle").forEach(button => {
    const active = button.dataset.timezoneMode === state.timezoneMode;
    if (button.dataset.timezoneMode === "org") {
      button.disabled = !orgTimeZone;
      button.textContent = orgTimeZone ? `Org Time (${shortTimeZone(orgTimeZone)})` : "Org Time Unavailable";
    }
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateMeta(force, derived = getDerivedData()) {
  const parts = [];
  if (state.lastSuccessfulFetchAt) {
    parts.push(`Last updated: ${DATE_TIME_FORMATTER.format(new Date(state.lastSuccessfulFetchAt))}`);
  }
  parts.push(`Schedules: ${derived.scheduledOnly.length}`);
  parts.push(`Today runs: ${derived.runsTodayCount}`);
  parts.push(`Due today: ${derived.dueTodaySchedules.length}`);
  if (state.snapshotSource === "cache") {
    parts.push("Showing cached data");
  }
  if (state.lastError) {
    parts.push(`Warning: ${state.lastError}`);
  }
  if (force) {
    parts.push("Refreshed");
  }
  setText("lastUpdated", parts.join(" | "));
}

function matchesSearch(job) {
  const term = state.searchTerm.trim().toLowerCase();
  if (!term) return true;
  const haystack = [job.schedulerName, job.jobType, job.state, job.cronExpression, getRelatedApexClass(job)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function matchesStatusFilter(value) {
  const normalized = String(value || "").toLowerCase();
  if (state.statusFilter === "all") return true;
  if (state.statusFilter === "waiting") return ["waiting", "acquired", "queued"].includes(normalized);
  if (state.statusFilter === "completed") return ["complete", "completed", "success"].includes(normalized);
  if (state.statusFilter === "failed") return isFailureStatus(normalized);
  if (state.statusFilter === "running") return ["running", "processing", "holding"].includes(normalized);
  return true;
}

function isSuccessStatus(value) {
  const normalized = String(value || "").toLowerCase();
  return ["completed", "complete", "success"].includes(normalized);
}

function isFailureStatus(value) {
  const normalized = String(value || "").toLowerCase();
  return ["failed", "aborted", "error"].includes(normalized);
}

function isTerminalStatus(value) {
  return isSuccessStatus(value) || isFailureStatus(value);
}

function formatDate(value) {
  if (!value) return "-";
  const date = parseSalesforceDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: getDisplayTimeZone()
  }).format(date);
}

function parseSalesforceDate(value) {
  if (!value) return null;
  const normalized = String(value).replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isToday(value, timeZone) {
  const date = parseSalesforceDate(value);
  if (!date) return false;
  return getDayKey(date, timeZone) === getDayKey(new Date(), timeZone);
}

function isFutureToday(value, timeZone, now) {
  const date = parseSalesforceDate(value);
  if (!date) return false;
  return date.getTime() > now.getTime() && getDayKey(date, timeZone) === getDayKey(now, timeZone);
}

function isRunnableToday(job, timeZone, now) {
  return !isPausedState(job?.state) && isFutureToday(job?.nextFireTime, timeZone, now);
}

function isPausedState(value) {
  return String(value || "").toLowerCase() === "paused";
}

function isPastDue(value) {
  const date = parseSalesforceDate(value);
  if (!date) return false;
  return date.getTime() < Date.now() - 10 * 60 * 1000;
}

function getDayKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function getDisplayTimeZone() {
  return state.timezoneMode === "org" && getOrgTimeZone() ? getOrgTimeZone() : BROWSER_TZ;
}

function getOrgTimeZone() {
  return state.orgContext?.orgTimeZone || null;
}

function shortTimeZone(value) {
  return String(value).split("/").pop()?.replace(/_/g, " ") || value;
}

function getDataAgeMinutes() {
  if (!state.lastSuccessfulFetchAt) return null;
  return Math.max(0, Math.round((Date.now() - new Date(state.lastSuccessfulFetchAt).getTime()) / 60000));
}

function getSelectedContext() {
  return state.selectedOrg ? { tabId: state.selectedOrg.id, tabUrl: state.selectedOrg.url } : {};
}

function getSelectedOrgKey() {
  return state.selectedOrg ? SalesforceAPI.buildOrgKey(state.selectedOrg.url) : "default-org";
}

function buildOrgSelectionValue(org) {
  return `${org.id}:${org.host}`;
}

function fallbackOrgContext(context, error) {
  return {
    orgName: state.selectedOrg?.label || null,
    orgTimeZone: null,
    apiOrigin: null,
    tabId: context?.tabId || null,
    tabUrl: context?.tabUrl || null,
    orgKey: SalesforceAPI.buildOrgKey(context?.tabUrl || ""),
    error: error instanceof Error ? error.message : String(error || "")
  };
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderStatusChip(value) {
  const label = escapeHtml(value || "-");
  const lower = String(value || "").toLowerCase();
  let className = "status-pending";
  if (isSuccessStatus(lower)) className = "status-ok";
  else if (isFailureStatus(lower)) className = "status-failed";
  else if (["running", "processing"].includes(lower)) className = "status-running";
  return `<span class="status-chip ${className}">${label}</span>`;
}

function renderIdentityCell(schedulerName, apexClassName) {
  const resolvedSchedulerName = schedulerName || "-";
  const resolvedClassName = apexClassName && apexClassName !== "-"
    ? apexClassName
    : "Class unavailable";

  return `
    <div class="identity-cell">
      <span class="identity-primary">${escapeHtml(resolvedSchedulerName)}</span>
      <span class="identity-secondary">Class: ${escapeHtml(resolvedClassName)}</span>
    </div>
  `;
}

function getEmptyMessage() {
  if (state.searchTerm.trim()) {
    return "No schedulers match the current search and filter settings.";
  }
  if (state.lastError) {
    return `Could not load jobs: ${state.lastError}`;
  }
  return "No scheduled Apex jobs found.";
}

function explainSchedulerCron(cron) {
  const parts = String(cron || "").trim().split(/\s+/);
  if (parts.length < 6 || parts.length > 7) {
    return cron || "-";
  }

  const [, minutes, hours, dayOfMonth, month, dayOfWeek] = parts;
  const timeText = describeTime(minutes, hours);
  const dayText = describeDayExpression(dayOfMonth, dayOfWeek);
  const monthText = describeMonthExpression(month);
  if (!timeText) {
    return cron || "-";
  }

  if (dayText === "every day" && monthText === "every month") {
    return `${capitalize(dayText)} ${timeText}`;
  }

  return `${capitalize(dayText)} ${timeText} ${monthText}`.replace(/\s+/g, " ").trim();
}

function describeTime(minutes, hours) {
  if (/^\d+$/.test(minutes) && /^\d+$/.test(hours)) {
    return `at ${pad(hours)}:${pad(minutes)}`;
  }
  if (/^0\/\d+$/.test(minutes) && (hours === "*" || hours === "*/1")) {
    const interval = minutes.split("/")[1];
    return `every ${interval} minute${interval === "1" ? "" : "s"}`;
  }
  if (/^0\/\d+$/.test(hours) && /^\d+$/.test(minutes)) {
    const interval = hours.split("/")[1];
    return `every ${interval} hour${interval === "1" ? "" : "s"} at :${pad(minutes)}`;
  }
  return null;
}

function describeDayExpression(dayOfMonth, dayOfWeek) {
  if (dayOfMonth === "*" && (dayOfWeek === "?" || dayOfWeek === "*")) {
    return "every day";
  }
  if (dayOfMonth === "L") {
    return "on the last day";
  }
  if (dayOfMonth === "LW") {
    return "on the last weekday";
  }
  if (/^\d+W$/.test(dayOfMonth)) {
    return `on the weekday nearest ${pad(dayOfMonth.replace("W", ""))}`;
  }
  if (/^\d+$/.test(dayOfMonth) && dayOfWeek === "?") {
    return `on day ${pad(dayOfMonth)}`;
  }
  if (dayOfMonth === "?" && dayOfWeek) {
    return `on ${describeDayOfWeek(dayOfWeek)}`;
  }
  return "on schedule";
}

function describeMonthExpression(value) {
  if (!value || value === "*") {
    return "every month";
  }
  if (/^\d+$/.test(value)) {
    return `in ${monthNameFromToken(value)}`;
  }
  if (/^[A-Z]{3}$/.test(value)) {
    return `in ${monthNameFromToken(value)}`;
  }
  if (/^[A-Z]{3}-[A-Z]{3}$/.test(value)) {
    const [start, end] = value.split("-");
    return `from ${monthNameFromToken(start)} to ${monthNameFromToken(end)}`;
  }
  if (value.includes(",")) {
    return `in ${value.split(",").map(monthNameFromToken).join(", ")}`;
  }
  return `in ${value}`;
}

function describeDayOfWeek(value) {
  if (/^[A-Z]{3}$/.test(value)) {
    return weekdayName(value);
  }
  if (/^[A-Z]{3}-[A-Z]{3}$/.test(value)) {
    const [start, end] = value.split("-");
    return `${weekdayName(start)} through ${weekdayName(end)}`;
  }
  if (/^[A-Z]{3}#[1-5]$/.test(value)) {
    const [day, occurrence] = value.split("#");
    return `the ${ordinal(Number(occurrence))} ${weekdayName(day)}`;
  }
  if (/^[A-Z]{3}L$/.test(value)) {
    return `the last ${weekdayName(value.replace("L", ""))}`;
  }
  if (value.includes(",")) {
    return value.split(",").map(weekdayName).join(", ");
  }
  return value;
}

function monthNameFromToken(value) {
  const months = {
    "1": "January", "2": "February", "3": "March", "4": "April",
    "5": "May", "6": "June", "7": "July", "8": "August",
    "9": "September", "10": "October", "11": "November", "12": "December",
    JAN: "January", FEB: "February", MAR: "March", APR: "April",
    MAY: "May", JUN: "June", JUL: "July", AUG: "August",
    SEP: "September", OCT: "October", NOV: "November", DEC: "December"
  };
  return months[String(value).toUpperCase()] || value;
}

function weekdayName(value) {
  const days = {
    SUN: "Sunday",
    MON: "Monday",
    TUE: "Tuesday",
    WED: "Wednesday",
    THU: "Thursday",
    FRI: "Friday",
    SAT: "Saturday"
  };
  return days[String(value).toUpperCase()] || value;
}

function ordinal(value) {
  if (value === 1) return "1st";
  if (value === 2) return "2nd";
  if (value === 3) return "3rd";
  return `${value}th`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function capitalize(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}
