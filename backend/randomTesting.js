(function () {
  // 1. Define your backend target URL
  const BACKEND_URL = "http://localhost:5000/api/save-html";

  // 2. Gather the main page and all independent iframes
  let payload = {
    "url": window.location.href,
    "timestamp": new Date().toISOString(),
    "main_page": document.documentElement.outerHTML,
    "iframes": []
  };

  document.querySelectorAll('iframe').forEach((frame, index) => {
    try {
      if (frame.contentWindow && frame.contentWindow.document) {
        payload.iframes.push({
          "index": index,
          "id": frame.id || "no-id",
          "name": frame.name || "no-name",
          "src": frame.src || "about:blank",
          "html": frame.contentWindow.document.documentElement.outerHTML
        });
      }
    } catch (e) {
      payload.iframes.push({
        "index": index,
        "id": frame.id || "no-id",
        "error": "Cross-origin restriction or unreadable frame content."
      });
    }
  });

  // 3. Send the gathered content to your backend
  fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (response.ok) {
        console.log("🚀 Data successfully transmitted to backend!");
      } else {
        console.error("❌ Server responded with error status:", response.status);
      }
    })
    .catch(error => {
      console.error("❌ Network error connecting to backend:", error);
    });
})();
