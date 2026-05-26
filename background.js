chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "openRequestSchool") {
    chrome.windows.create({
      url: chrome.runtime.getURL("request-school.html"),
      type: "popup",
      width: 520,
      height: 650,
    });
  }
});
