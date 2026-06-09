chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "update") {
    chrome.tabs.create({
      url: "https://leogamboalg-cmd.github.io/BroncoSort/",
    });
  }
});
