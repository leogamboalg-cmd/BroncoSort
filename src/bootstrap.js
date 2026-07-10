// src/bootstrap.js

(function () {
  if (window.__BRONCOSORT_BOOTSTRAPPED__) {
    return;
  }

  window.__BRONCOSORT_BOOTSTRAPPED__ = true;

  window.BroncoSort = window.BroncoSort || {};

  let watcher = null;
  let activeAdapterId = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForAdapter(context, timeoutMs = 30000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const adapter =
        window.BroncoSort.core.pageContext.getAdapterForPage(context);

      if (adapter) {
        return adapter;
      }

      await sleep(500);
    }

    return null;
  }

  async function start() {
    const context = window.BroncoSort.core.pageContext.createPageContext();

    if (!context) return;

    console.log("BroncoSort frame URL", context.url);

    const adapter = await waitForAdapter(context);

    if (!adapter) {
      console.log("BroncoSort no adapter found", context.url);
      return;
    }

    console.log("BroncoSort selected adapter", adapter.id);
    console.log(
      "BroncoSort watch strategy",
      adapter.watchStrategy === "polling" ? "polling" : "mutation",
    );

    if (watcher && activeAdapterId === adapter.id) return;

    watcher?.disconnect();
    activeAdapterId = adapter.id;

    const doc = await window.BroncoSort.core.observer.waitForDocument({
      getDocument: () => adapter.getTargetDocument(context),
      isReady: adapter.isReady,
    });

    if (!doc) return;

    window.BroncoSort.core.ratingsApi.wakeServer();

    const process = () =>
      window.BroncoSort.core.courseProcessor.processCourses({
        school: context.school,
        adapter,
        context,
      });

    if (adapter.watchStrategy === "polling") {
      watcher = window.BroncoSort.core.observer.watchWithPolling({
        getDocument: () => adapter.getTargetDocument(context),
        getSignature: (currentDoc) =>
          adapter.getChangeSignature(currentDoc, context),
        onChange: process,
        pollIntervalMs: adapter.pollIntervalMs || 2000,
      });
    } else {
      watcher = window.BroncoSort.core.observer.watchWithMutationObserver({
        doc,
        getSignature: () => adapter.getChangeSignature(doc, context),
        onChange: process,
        debounceMs: adapter.debounceMs || 700,
      });
    }
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  window.BroncoSort.core.schoolRequest.installMessageListener();
  onReady(start);

  window.addEventListener(
    "scroll",
    () => {
      window.BroncoSort.core.professorPopup.closePopup(document);
      window.BroncoSort.core.premiumPopup?.closePremiumPopup(document);
    },
    true,
  );
})();
