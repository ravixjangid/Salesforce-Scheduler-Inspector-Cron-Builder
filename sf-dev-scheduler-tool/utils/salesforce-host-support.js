const SalesforceHostSupport = {

  SUPPORTED_URL_PATTERNS: [
    "https://*.builder.salesforce-experience.com/*",
    "https://*.cloudforce.com/*",
    "https://*.cloudforce.mil/*",
    "https://*.crmforce.mil/*",
    "https://*.force.com.mcas.ms/*",
    "https://*.force.com/*",
    "https://*.force.mil/*",
    "https://*.salesforce-setup.com/*",
    "https://*.salesforce.com/*",
    "https://*.salesforce.mil/*",
    "https://*.sfcrmapps.cn/*",
    "https://*.sfcrmproducts.cn/*",
    "https://*.visualforce.com/*",
    "https://*.visualforce.mil/*"
  ],

  SUPPORTED_HOST_SUFFIXES: [
    ".builder.salesforce-experience.com",
    ".cloudforce.com",
    ".cloudforce.mil",
    ".crmforce.mil",
    ".force.com.mcas.ms",
    ".force.com",
    ".force.mil",
    ".salesforce-setup.com",
    ".salesforce.com",
    ".salesforce.mil",
    ".sfcrmapps.cn",
    ".sfcrmproducts.cn",
    ".visualforce.com",
    ".visualforce.mil"
  ],

  SCHEDULER_HOST_SUFFIXES: [
    ".cloudforce.com",
    ".cloudforce.mil",
    ".crmforce.mil",
    ".force.com",
    ".force.mil",
    ".salesforce.com",
    ".salesforce.mil",
    ".sfcrmapps.cn",
    ".sfcrmproducts.cn"
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
