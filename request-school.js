requestSchoolBtn.addEventListener("click", async () => {
  if (!selectedSchool) {
    alert("Please select a school from the dropdown.");
    return;
  }

  try {
    console.log("Sending request for:", selectedSchool);

    // later:
    // const sanitizedHTML = ...

    /*
    await fetch("https://broncosort.onrender.com/api/collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        school: selectedSchool,
        html: sanitizedHTML,
      }),
    });
    */

    alert(`Request submitted for ${selectedSchool.name}`);
  } catch (err) {
    console.error(err);

    alert("Failed to submit request.");
  }
});
