// src/core/pageContext.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.core = window.BroncoSort.core || {};

  function createPageContext() {
    const hostname = window.location.hostname.toLowerCase();
    const school = window.BroncoSort.config.findSchoolByHostname(hostname);

    if (!school) {
      return null;
    }

    let isTopFrame = false;

    try {
      isTopFrame = window === window.top;
    } catch {
      isTopFrame = false;
    }

    return {
      school,
      hostname,
      url: window.location.href,
      currentDocument: document,
      isTopFrame,
      pageType: null,
    };
  }

  function getAdapterForPage(context) {
    if (!context) return null;

    const adapters = window.BroncoSort.adapters || {};

    for (const adapterId of context.school.adapters) {
      const adapter = adapters[adapterId];

      if (!adapter) continue;

      try {
        if (adapter.matchesPage(context)) {
          return adapter;
        }
      } catch (error) {
        console.warn(`BroncoSort adapter skipped: ${adapterId}`, error);
      }
    }

    return null;
  }

  window.BroncoSort.core.pageContext = {
    createPageContext,
    getAdapterForPage,
  };
})();
