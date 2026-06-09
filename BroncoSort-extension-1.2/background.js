chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "update") return;

  const version = chrome.runtime.getManifest().version;

  if (version === "1.2") {
    chrome.tabs.create({
      url: "https://leogamboalg-cmd.github.io/BroncoSort/",
    });
  }
});
