(function () {
  const REDACTED = "[REDACTED]";

  function sanitizeHTML(doc) {
    const clone = doc.documentElement.cloneNode(true);

    // Remove executable/risky elements, but keep CSS/design
    clone
      .querySelectorAll(
        `
      script,
      object,
      embed,
      iframe[srcdoc],
      noscript
    `,
      )
      .forEach((el) => el.remove());

    // Remove PeopleSoft hidden session/state fields
    clone.querySelectorAll("input[type='hidden']").forEach((el) => el.remove());

    // Neutralize forms so exported HTML cannot submit anywhere
    clone.querySelectorAll("form").forEach((form) => {
      form.removeAttribute("action");
      form.removeAttribute("method");
    });

    // Clear user-entered form values
    clone.querySelectorAll("input, textarea, select").forEach((el) => {
      el.removeAttribute("value");
      el.removeAttribute("checked");
      el.removeAttribute("selected");

      if (el.tagName === "TEXTAREA") {
        el.textContent = "";
      }
    });

    // Remove PeopleSoft environment metadata
    clone
      .querySelectorAll(
        `
      #pt_envinfo_win0,
      #pt_pageinfo_win0
    `,
      )
      .forEach((el) => el.remove());

    // Redact common visible user name locations
    clone
      .querySelectorAll(
        `
      .gh-username,
      #DERIVED_SSTSNAV_PERSON_NAME,
      .PALEVEL0PRIMARY
    `,
      )
      .forEach((el) => {
        el.textContent = REDACTED;
      });

    // Remove HTML comments
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
    const comments = [];

    while (walker.nextNode()) {
      comments.push(walker.currentNode);
    }

    comments.forEach((comment) => comment.remove());

    // Clean attributes
    clone.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value;

        // Remove inline JS like onclick, onload, etc.
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
          return;
        }

        // Remove sensitive attribute names
        const blockedAttrKeywords = [
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

        if (blockedAttrKeywords.some((k) => name.includes(k))) {
          el.removeAttribute(attr.name);
          return;
        }

        // Keep design-related attrs intact so page styling still works
        const safeDesignAttrs = [
          "href",
          "src",
          "class",
          "id",
          "rel",
          "type",
          "media",
          "style",
        ];

        if (!safeDesignAttrs.includes(name)) {
          const suspiciousValuePatterns = [
            /^eyJ[A-Za-z0-9_-]+\./, // JWT-like
            /^[A-Za-z0-9+/=_-]{40,}$/, // long token-like value
          ];

          if (suspiciousValuePatterns.some((p) => p.test(value))) {
            el.setAttribute(attr.name, REDACTED);
          }
        }
      });
    });

    let html = clone.outerHTML;

    // Text-level redactions
    const redactions = [
      // Emails
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,

      // Student IDs / long numeric IDs
      /\b\d{8,12}\b/g,

      // ICSID-ish text
      /ICSID[^"&<\s]*/gi,

      // Internal server names
      /cpoprd\d+/gi,

      // Oracle environment string
      /CPOMPRD\/ORACLE/gi,

      // Browser fingerprint-ish text
      /CHROME\/[\d.]+\/WIN\d+/gi,
    ];

    redactions.forEach((pattern) => {
      html = html.replace(pattern, REDACTED);
    });

    return "<!DOCTYPE html>\n" + html;
  }

  function safeFilename(name) {
    return name.replace(/[^\w.-]/g, "_").slice(0, 80);
  }

  function downloadHTML(filename, htmlContent) {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const link = document.createElement("a");

    link.download = safeFilename(filename);
    link.href = URL.createObjectURL(blob);

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 1000);
  }

  downloadHTML("00_main_parent_page_SANITIZED.html", sanitizeHTML(document));

  document.querySelectorAll("iframe").forEach((frame, index) => {
    try {
      const frameDoc = frame.contentWindow?.document;
      if (!frameDoc) return;

      const frameName = frame.id || frame.name || `frame_${index + 1}`;

      downloadHTML(
        `iframe_${index + 1}_${frameName}_SANITIZED.html`,
        sanitizeHTML(frameDoc),
      );
    } catch (e) {
      console.warn(`Skipped iframe ${index}: cross-origin restriction.`);
    }
  });

  console.log("Sanitized HTML export complete.");
})();
