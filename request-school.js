const params = new URLSearchParams(window.location.search);

const schoolName = params.get("school");

document.getElementById("schoolName").textContent =
  schoolName || "Unknown School";

document.getElementById("sendRequest").addEventListener("click", async () => {
  const status = document.getElementById("status");

  status.textContent = "Sending request...";

  try {
    // Later:
    // generate sanitized HTML here

    // Example future backend request:
    /*
      await fetch("https://broncosort.onrender.com/api/collectData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          schoolName,
          html: sanitizedHTML
        })
      });
      */

    status.textContent = "Request sent successfully!";
  } catch (err) {
    console.error(err);

    status.textContent = "Failed to send request.";
  }
});
