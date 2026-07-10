// src/core/observer.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.core = window.BroncoSort.core || {};

  function watchWithMutationObserver({
    doc,
    getSignature,
    onChange,
    debounceMs = 700,
  }) {
    if (!doc?.body) return null;

    let lastProcessedSignature = "";
    let timer = null;
    let running = false;

    async function checkForChange() {
      if (running) return;

      const signature = getSignature();

      if (!signature || signature === lastProcessedSignature) return;

      console.log("BroncoSort processing new result set", signature);
      console.log("BroncoSort signature changed");
      running = true;

      try {
        await onChange();
        lastProcessedSignature = getSignature() || signature;
      } catch (error) {
        console.warn("BroncoSort processing failed:", error);
      } finally {
        running = false;
      }
    }

    function scheduleCheck() {
      clearTimeout(timer);
      timer = setTimeout(checkForChange, debounceMs);
    }

    const observer = new MutationObserver(scheduleCheck);
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    scheduleCheck();

    return {
      disconnect() {
        clearTimeout(timer);
        observer.disconnect();
      },
      check: checkForChange,
    };
  }

  function watchWithPolling({
    getDocument,
    getSignature,
    onChange,
    pollIntervalMs = 2000,
  }) {
    let lastProcessedSignature = "";
    let running = false;
    let disconnected = false;
    let timer = null;

    async function checkForChange() {
      if (disconnected || running) return;

      const doc = getDocument();

      if (!doc) return;

      const signature = getSignature(doc);

      if (!signature || signature === lastProcessedSignature) return;

      console.log("BroncoSort processing new result set", signature);
      console.log("BroncoSort signature changed");
      running = true;

      try {
        await onChange(doc);
        lastProcessedSignature = getSignature(doc) || signature;
      } catch (error) {
        console.warn("BroncoSort processing failed:", error);
      } finally {
        running = false;
      }
    }

    function startTimer() {
      timer = setInterval(checkForChange, pollIntervalMs);
    }

    checkForChange();
    startTimer();

    return {
      disconnect() {
        disconnected = true;
        clearInterval(timer);
      },
      check: checkForChange,
    };
  }

  async function waitForDocument({ getDocument, isReady, timeoutMs = 15000 }) {
    const start = Date.now();

    return new Promise((resolve) => {
      const timer = setInterval(() => {
        const doc = getDocument();

        if (doc && (!isReady || isReady(doc))) {
          clearInterval(timer);
          resolve(doc);
          return;
        }

        if (Date.now() - start >= timeoutMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, 300);
    });
  }

  window.BroncoSort.core.observer = {
    watchDocument: watchWithMutationObserver,
    watchWithMutationObserver,
    watchWithPolling,
    waitForDocument,
  };
})();
