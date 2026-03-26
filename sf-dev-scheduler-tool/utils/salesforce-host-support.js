const SalesforceHostSupport = {

  SUPPORTED_HOST_SUFFIXES: [
    ".salesforce.com",
    ".salesforce-setup.com",
    ".force.com"
  ],

  SCHEDULER_HOST_SUFFIXES: [
    ".salesforce.com",
    ".salesforce-setup.com",
    ".force.com"
  ],

  isSupportedHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return this.SUPPORTED_HOST_SUFFIXES.some(suffix => host.endsWith(suffix));
  },

  isSchedulerHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return this.SCHEDULER_HOST_SUFFIXES.some(suffix => host.endsWith(suffix));
  },

  isSupportedUrl(value) {
    try {
      const url = value instanceof URL ? value : new URL(String(value));
      return url.protocol === "https:" && this.isSupportedHost(url.hostname);
    }
    catch (error) {
      return false;
    }
  },

  isSchedulerUrl(value) {
    try {
      const url = value instanceof URL ? value : new URL(String(value));
      return url.protocol === "https:" && this.isSchedulerHost(url.hostname);
    }
    catch (error) {
      return false;
    }
  }

};
