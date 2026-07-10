// src/core/styleLoader.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.core = window.BroncoSort.core || {};

  const loadedDocs = new WeakSet();
  let cachedCss = null;

  async function fetchCssFile(path) {
    const url =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL(path)
        : path;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Unable to load BroncoSort stylesheet: ${response.status}`);
    }

    return response.text();
  }

  async function loadCssText() {
    if (cachedCss != null) return cachedCss;

    const localStylesheet = document.querySelector(
      "link[data-broncosort-stylesheet]",
    );

    if (localStylesheet?.href) {
      const response = await fetch(localStylesheet.href);

      if (!response.ok) {
        throw new Error(
          `Unable to load BroncoSort stylesheet: ${response.status}`,
        );
      }

      cachedCss = await response.text();
      return cachedCss;
    }

    cachedCss = await fetchCssFile("src/styles/content.css");

    return cachedCss;
  }

  async function injectStyles(doc) {
    if (
      !doc ||
      loadedDocs.has(doc) ||
      doc.querySelector("#broncosort-styles")
    ) {
      return;
    }

    const style = doc.createElement("style");
    style.id = "broncosort-styles";
    style.textContent = await loadCssText();
    doc.head.appendChild(style);
    loadedDocs.add(doc);
  }

  window.BroncoSort.core.styleLoader = {
    injectStyles,
  };
})();
