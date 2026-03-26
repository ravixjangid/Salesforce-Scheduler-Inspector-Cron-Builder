const SalesforceAPI = {

API_VERSION: "v59.0",

async getActiveSalesforceTab() {

  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  const activeTab = tabs[0];

  if (!activeTab?.url) {
    throw new Error("Open Salesforce in the active Chrome tab, then refresh.");
  }

  let url;

  try {
    url = new URL(activeTab.url);
  }
  catch (error) {
    throw new Error("Active tab URL is invalid.");
  }

  if (!this.isSalesforceUrl(url)) {
    throw new Error("Open Salesforce in the active Chrome tab, then refresh.");
  }

  return activeTab;

},


async getSalesforceTabs() {

  const tabs = await chrome.tabs.query({});

  return tabs
    .filter(tab => Boolean(tab?.url))
    .map(tab => {
      try {
        return {
          tab,
          url: new URL(tab.url)
        };
      }
      catch (error) {
        return null;
      }
    })
    .filter(Boolean)
    .filter(entry => this.isSalesforceUrl(entry.url))
    .filter(entry => !this.isLoginPage(entry.url))
    .map(entry => ({
      id: entry.tab.id,
      title: entry.tab.title || entry.url.hostname,
      url: entry.tab.url,
      host: entry.url.hostname,
      origin: entry.url.origin,
      label: entry.url.hostname.replace(".lightning.force.com", ""),
      isActive: Boolean(entry.tab.active)
    }))
    .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.host.localeCompare(right.host));

},


isSalesforceHost(hostname) {

  return SalesforceHostSupport.isSchedulerHost(hostname);

},


isSalesforceUrl(url) {

  return SalesforceHostSupport.isSchedulerUrl(url);

},


isLoginPage(url) {

  return url.hostname.startsWith("login.")
    || url.pathname.toLowerCase().includes("login");

},


async resolveTabContext(context = {}) {

  if (context.tabUrl) {
    return {
      url: context.tabUrl,
      tabId: context.tabId || null
    };
  }

  if (context.tabId) {
    const tab = await chrome.tabs.get(context.tabId);

    if (tab?.url) {
      return {
        url: tab.url,
        tabId: tab.id
      };
    }
  }

  const activeTab = await this.getActiveSalesforceTab();

  return {
    url: activeTab.url,
    tabId: activeTab.id
  };

},


getCandidateApiOrigins(tabUrl) {

  const url = new URL(tabUrl);
  const host = url.hostname;
  const origins = [url.origin];

  if (host.endsWith(".lightning.force.com")) {
    origins.unshift(`https://${host.replace(".lightning.force.com", ".my.salesforce.com")}`);
  }

  if (host.endsWith(".my.salesforce-setup.com")) {
    origins.unshift(`https://${host.replace(".my.salesforce-setup.com", ".my.salesforce.com")}`);
  }

  if (host.endsWith(".visual.force.com")) {
    origins.unshift(`https://${host.replace(".visual.force.com", ".my.salesforce.com")}`);
  }

  return [...new Set(origins)];

},


getCookie(url, name) {

  return new Promise((resolve, reject) => {
    chrome.cookies.get({ url, name }, cookie => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(cookie || null);
    });
  });

},


async runQuery(query, context = {}) {

  const result = await this.runQueryWithMeta(query, context);
  return result.records;

},


async runToolingQuery(query, context = {}) {

  const result = await this.runQueryWithMeta(query, context, "tooling/query");
  return result.records;

},


async runQueryWithMeta(query, context = {}, queryPath = "query") {

  const tabContext = await this.resolveTabContext(context);
  const origins = this.getCandidateApiOrigins(tabContext.url);
  let lastError = new Error("Salesforce query failed.");
  let lastPayload = null;
  let lastOrigin = origins[0] || null;

  for (const origin of origins) {
    try {
      const sidCookie = await this.getCookie(origin, "sid");
      const payload = await this.fetchJson(origin, query, sidCookie?.value || null, queryPath);
      lastPayload = payload;
      lastOrigin = origin;

      if ((payload.records || []).length > 0) {
        return {
          records: payload.records,
          origin,
          tabId: tabContext.tabId,
          tabUrl: tabContext.url
        };
      }
    }
    catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lastPayload) {
    return {
      records: lastPayload.records || [],
      origin: lastOrigin,
      tabId: tabContext.tabId,
      tabUrl: tabContext.url
    };
  }

  throw lastError;

},


async fetchJson(origin, query, sid, queryPath = "query") {

  const url = `${origin}/services/data/${this.API_VERSION}/${queryPath}?q=${encodeURIComponent(query)}`;
  const headers = {
    Accept: "application/json"
  };

  if (sid) {
    headers.Authorization = `Bearer ${sid}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers
  });

  const rawText = await response.text();
  let payload;

  try {
    payload = JSON.parse(rawText);
  }
  catch (error) {
    throw new Error(rawText || `HTTP ${response.status}`);
  }

  if (!response.ok) {
    const message = Array.isArray(payload) && payload[0]?.message
      ? payload[0].message
      : payload?.message || response.statusText;
    throw new Error(message);
  }

  return payload;

},


mapScheduledJobs(records, apexClassNamesById = {}) {

  return records.map(record => {
    const apexClassId = record.CronJobDetail?.ApexClassId || null;

    return {
      id: record.Id,
      schedulerName: record.CronJobDetail?.Name || record.Id || "Unknown Scheduler",
      apexClassName: record.CronJobDetail?.ApexClass?.Name || apexClassNamesById[apexClassId] || "-",
      jobType: this.normalizeSchedulerJobType(record.CronJobDetail?.JobType),
      state: record.State || "-",
      nextFireTime: record.NextFireTime || null,
      previousFireTime: record.PreviousFireTime || null,
      timesTriggered: Number(record.TimesTriggered || 0),
      cronExpression: record.CronExpression || ""
    };
  });

},


mapAsyncJobs(records) {

  return records.map(record => ({
    id: record.Id,
    cronTriggerId: record.CronTriggerId || record.CronTrigger?.Id || null,
    schedulerName: record.CronTrigger?.CronJobDetail?.Name || null,
    apexClassName: record.ApexClass?.Name || "-",
    status: record.Status || "-",
    jobType: record.JobType || "-",
    createdDate: record.CreatedDate || null,
    completedDate: record.CompletedDate || null,
    numberOfErrors: Number(record.NumberOfErrors || 0)
  }));

},


async getApexClassNamesByIds(ids, context = {}) {

  const normalizedIds = [...new Set(ids
    .map(id => String(id || "").trim())
    .filter(id => /^[a-zA-Z0-9]{15,18}$/.test(id)))];

  if (!normalizedIds.length) {
    return {};
  }

  const query = `
    SELECT Id,
           Name
    FROM ApexClass
    WHERE Id IN (${normalizedIds.map(id => `'${id}'`).join(", ")})
  `;

  try {
    const records = await this.runToolingQuery(query, context);
    return Object.fromEntries(records.map(record => [record.Id, record.Name || "-"]));
  }
  catch (error) {
    return {};
  }

},


normalizeSchedulerJobType(jobType) {

  if (jobType === "7" || jobType === 7) {
    return "Scheduled Apex";
  }

  if (jobType === "9" || jobType === 9) {
    return "Batch Apex";
  }

  return jobType || "-";

},


async getOrgContext(context = {}) {

  const queries = [
    `
      SELECT Name,
             DefaultTimezoneSidKey,
             InstanceName,
             OrganizationType,
             IsSandbox
      FROM Organization
      LIMIT 1
    `
  ];

  let lastError;

  for (const query of queries) {
    try {
      const result = await this.runQueryWithMeta(query, context);
      const record = result.records[0] || {};

      return {
        orgName: record.Name || null,
        orgTimeZone: record.DefaultTimezoneSidKey || null,
        apiOrigin: result.origin || null,
        instanceName: record.InstanceName || null,
        organizationType: record.OrganizationType || null,
        isSandbox: Boolean(record.IsSandbox),
        tabId: result.tabId || null,
        tabUrl: result.tabUrl || null,
        orgKey: this.buildOrgKey(result.origin || result.tabUrl || "")
      };
    }
    catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    return {
      orgName: null,
      orgTimeZone: null,
      apiOrigin: null,
      instanceName: null,
      organizationType: null,
      isSandbox: false,
      tabId: context.tabId || null,
      tabUrl: context.tabUrl || null,
      orgKey: this.buildOrgKey(context.tabUrl || ""),
      error: lastError instanceof Error ? lastError.message : String(lastError)
    };
  }

  return {
    orgName: null,
    orgTimeZone: null,
    apiOrigin: null,
    instanceName: null,
    organizationType: null,
    isSandbox: false,
    tabId: context.tabId || null,
    tabUrl: context.tabUrl || null,
    orgKey: this.buildOrgKey(context.tabUrl || "")
  };

},


buildOrgKey(value) {

  if (!value) {
    return "default-org";
  }

  try {
    return new URL(value).hostname.toLowerCase();
  }
  catch (error) {
    return String(value).toLowerCase();
  }

},


async getScheduledJobs(context = {}) {

  const queries = [
    {
      type: "direct-name",
      query: `
        SELECT Id,
               CronJobDetail.Name,
               CronJobDetail.JobType,
               CronJobDetail.ApexClass.Name,
               State,
               NextFireTime,
               PreviousFireTime,
               TimesTriggered,
               CronExpression
        FROM CronTrigger
        ORDER BY NextFireTime ASC
      `
    },
    {
      type: "direct-id",
      query: `
        SELECT Id,
               CronJobDetail.Name,
               CronJobDetail.JobType,
               CronJobDetail.ApexClassId,
               State,
               NextFireTime,
               PreviousFireTime,
               TimesTriggered,
               CronExpression
        FROM CronTrigger
        ORDER BY NextFireTime ASC
      `
    },
    {
      type: "base",
      query: `
        SELECT Id,
               CronJobDetail.Name,
               CronJobDetail.JobType,
               State,
               NextFireTime,
               PreviousFireTime,
               TimesTriggered,
               CronExpression
        FROM CronTrigger
        ORDER BY NextFireTime ASC
      `
    }
  ];

  let lastError;

  for (const entry of queries) {
    try {
      const records = await this.runQuery(entry.query, context);

      if (entry.type === "direct-id") {
        const apexClassNamesById = await this.getApexClassNamesByIds(
          records.map(record => record.CronJobDetail?.ApexClassId),
          context
        );
        return this.mapScheduledJobs(records, apexClassNamesById);
      }

      return this.mapScheduledJobs(records);
    }
    catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];

},


async getAsyncJobs(context = {}) {

  const queries = [
    `
      SELECT Id,
             CronTriggerId,
             ApexClass.Name,
             CronTrigger.CronJobDetail.Name,
             Status,
             JobType,
             CreatedDate,
             CompletedDate,
             NumberOfErrors
      FROM AsyncApexJob
      ORDER BY CreatedDate DESC
      LIMIT 100
    `,
    `
      SELECT Id,
             CronTriggerId,
             ApexClass.Name,
             Status,
             JobType,
             CreatedDate,
             CompletedDate,
             NumberOfErrors
      FROM AsyncApexJob
      ORDER BY CreatedDate DESC
      LIMIT 100
    `
  ];

  let lastError;

  for (const query of queries) {
    try {
      const records = await this.runQuery(query, context);
      return this.mapAsyncJobs(records);
    }
    catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];

}

};
