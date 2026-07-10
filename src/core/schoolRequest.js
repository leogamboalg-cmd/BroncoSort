// src/core/schoolRequest.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.core = window.BroncoSort.core || {};

  function sanitizeHTML(doc) {
    const REDACTED = "[REDACTED]";
    const clone = doc.documentElement.cloneNode(true);

    clone
      .querySelectorAll("script, object, embed, iframe[srcdoc], noscript")
      .forEach((element) => element.remove());

    clone.querySelectorAll("input[type='hidden']").forEach((element) => {
      element.remove();
    });

    clone.querySelectorAll("form").forEach((form) => {
      form.removeAttribute("action");
      form.removeAttribute("method");
    });

    clone.querySelectorAll("input, textarea, select").forEach((element) => {
      element.removeAttribute("value");
      element.removeAttribute("checked");
      element.removeAttribute("selected");

      if (element.tagName === "TEXTAREA") {
        element.textContent = "";
      }
    });

    clone
      .querySelectorAll("#pt_envinfo_win0, #pt_pageinfo_win0")
      .forEach((element) => element.remove());

    clone
      .querySelectorAll(
        ".gh-username, #DERIVED_SSTSNAV_PERSON_NAME, .PALEVEL0PRIMARY",
      )
      .forEach((element) => {
        element.textContent = REDACTED;
      });

    const walker = doc.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
    const comments = [];

    while (walker.nextNode()) {
      comments.push(walker.currentNode);
    }

    comments.forEach((comment) => comment.remove());

    clone.querySelectorAll("*").forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        const attributeName = attribute.name.toLowerCase();
        const attributeValue = attribute.value;

        if (attributeName.startsWith("on")) {
          element.removeAttribute(attribute.name);
          return;
        }

        const blockedKeywords = [
          "token",
          "session",
          "sid",
          "icsid",
          "password",
          "passwd",
          "secret",
          "auth",
          "cookie",
          "csrf",
        ];

        if (
          blockedKeywords.some((keyword) => attributeName.includes(keyword))
        ) {
          element.removeAttribute(attribute.name);
          return;
        }

        const safeDesignAttributes = [
          "href",
          "src",
          "class",
          "id",
          "rel",
          "type",
          "media",
          "style",
        ];

        if (!safeDesignAttributes.includes(attributeName)) {
          const suspiciousPatterns = [
            /^eyJ[A-Za-z0-9_-]+\./,
            /^[A-Za-z0-9+/=_-]{40,}$/,
          ];

          if (
            suspiciousPatterns.some((pattern) => pattern.test(attributeValue))
          ) {
            element.setAttribute(attribute.name, REDACTED);
          }
        }
      });
    });

    let html = clone.outerHTML;

    [
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      /\b\d{8,12}\b/g,
      /ICSID[^"&<\s]*/gi,
      /cpoprd\d+/gi,
      /CPOMPRD\/ORACLE/gi,
      /CHROME\/[\d.]+\/WIN\d+/gi,
    ].forEach((pattern) => {
      html = html.replace(pattern, REDACTED);
    });

    return `<!DOCTYPE html>\n${html}`;
  }

  async function runSchoolRequest(school) {
    const pages = [
      {
        type: "parent",
        name: "main_parent_page",
        url: window.location.href,
        html: sanitizeHTML(document),
      },
    ];

    const response = await fetch(
      `${window.BroncoSort.core.ratingsApi.API_BASE}/api/collect/store`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          school,
          pageUrl: window.location.href,
          collectedAt: new Date().toISOString(),
          pages,
        }),
      },
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        data?.error || `Request failed with status ${response.status}`,
      );
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function installMessageListener() {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime?.onMessage?.addListener
    ) {
      return;
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action !== "RUN_COLLECT_SCRIPT") {
        return undefined;
      }

      runSchoolRequest(message.school)
        .then((result) => {
          sendResponse({ success: true, result });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            status: error.status,
            error: error.message,
          });
        });

      return true;
    });
  }

  window.BroncoSort.core.schoolRequest = {
    sanitizeHTML,
    runSchoolRequest,
    installMessageListener,
  };
})();
