importScripts("utils/salesforce-api.js");

const REFRESH_ALARM = "refreshJobs";
const REFRESH_INTERVAL_MINUTES = 5;
const CACHE_KEY = "scheduler-monitor-cache-v2";
const NOTIFY_KEY = "scheduler-monitor-notify-v1";

chrome.runtime.onInstalled.addListener(() => {
  ensureRefreshAlarm();
  refreshAllOrgs();
});

chrome.runtime.onStartup.addListener(() => {
  ensureRefreshAlarm();
  refreshAllOrgs();
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== REFRESH_ALARM) {
    return;
  }

  await refreshAllOrgs();

  try {
    await chrome.runtime.sendMessage({
      type: "AUTO_REFRESH_DASHBOARD",
      source: "background",
      intervalMinutes: REFRESH_INTERVAL_MINUTES
    });
  }
  catch (error) {
    // Ignore the expected case where no popup or embedded panel is open.
  }
});

function ensureRefreshAlarm() {
  chrome.alarms.create(REFRESH_ALARM, {
    periodInMinutes: REFRESH_INTERVAL_MINUTES
  });
}

async function refreshAllOrgs() {
  if (!globalThis.SalesforceAPI?.getSalesforceTabs) {
    return;
  }

  let orgs = [];
  try {
    orgs = await SalesforceAPI.getSalesforceTabs();
  }
  catch (error) {
    return;
  }

  if (orgs.length === 0) {
    return;
  }

  const cacheStore = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
  const notifyStore = (await chrome.storage.local.get(NOTIFY_KEY))[NOTIFY_KEY] || {};

  for (const org of orgs) {
    const context = { tabId: org.id, tabUrl: org.url };
    const key = SalesforceAPI.buildOrgKey(org.url);
    const previousSnapshot = cacheStore[key] || null;

    try {
      const [scheduledResult, asyncResult, orgResult] = await Promise.allSettled([
        SalesforceAPI.getScheduledJobs(context),
        SalesforceAPI.getAsyncJobs(context),
        SalesforceAPI.getOrgContext(context)
      ]);

      if (scheduledResult.status !== "fulfilled") {
        continue;
      }

      const snapshot = {
        scheduledApexJobs: scheduledResult.value || [],
        asyncJobs: asyncResult.status === "fulfilled" ? asyncResult.value || [] : [],
        asyncJobsAvailable: asyncResult.status === "fulfilled",
        orgContext: orgResult.status === "fulfilled" ? orgResult.value : {
          orgName: org.label || null,
          orgTimeZone: null,
          apiOrigin: null,
          tabId: org.id,
          tabUrl: org.url,
          orgKey: key
        },
        lastSuccessfulFetchAt: new Date().toISOString()
      };

      cacheStore[key] = snapshot;
      notifyStore[key] = await buildNotifications(snapshot, previousSnapshot, notifyStore[key] || {});
    }
    catch (error) {
      // Ignore per-org refresh failures and keep prior cache.
    }
  }

  await chrome.storage.local.set({
    [CACHE_KEY]: cacheStore,
    [NOTIFY_KEY]: notifyStore
  });
}

async function buildNotifications(snapshot, previousSnapshot, orgState) {
  const nextState = {
    failed: orgState.failed || {},
    stopped: orgState.stopped || {},
    missed: orgState.missed || {}
  };
  const previousRuns = new Set((previousSnapshot?.asyncJobs || []).map(job => job.id));
  const previousSchedules = new Map((previousSnapshot?.scheduledApexJobs || []).map(job => [job.id, job]));
  const alerts = [];

  snapshot.asyncJobs
    .filter(job => isFailureStatus(job.status) && !previousRuns.has(job.id))
    .slice(0, 3)
    .forEach(job => {
      if (nextState.failed[job.id]) return;
      nextState.failed[job.id] = Date.now();
      alerts.push({
        title: "Scheduled job failed",
        message: `${job.schedulerName || job.apexClassName || "Job"} finished with ${job.status || "Failed"}.`
      });
    });

  snapshot.scheduledApexJobs.forEach(job => {
    const previous = previousSchedules.get(job.id);
    if (!job.nextFireTime && previous?.nextFireTime && !nextState.stopped[job.id]) {
      nextState.stopped[job.id] = Date.now();
      alerts.push({
        title: "Scheduler stopped",
        message: `${job.schedulerName || "Scheduler"} no longer has a next run time.`
      });
    }

    if (isPastDue(job.nextFireTime) && !isFailureStatus(job.state) && !nextState.missed[job.id]) {
      nextState.missed[job.id] = Date.now();
      alerts.push({
        title: "Possible missed run",
        message: `${job.schedulerName || "Scheduler"} is past its next run time.`
      });
    }
  });

  for (const alert of alerts) {
    try {
      await chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: alert.title,
        message: alert.message
      });
    }
    catch (error) {
      // Ignore notification failures.
    }
  }

  return nextState;
}

function isFailureStatus(value) {
  const normalized = String(value || "").toLowerCase();
  return ["failed", "aborted", "error"].includes(normalized);
}

function isPastDue(value) {
  if (!value) {
    return false;
  }

  const normalized = String(value).replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() < Date.now() - 10 * 60 * 1000;
}
