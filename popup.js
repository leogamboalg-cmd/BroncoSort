// popup.js

const schoolInput = document.getElementById("schoolSearch");
const schoolDropdown = document.getElementById("schoolDropdown");
const requestSchoolBtn = document.getElementById("requestSchoolBtn");

let selectedSchool = null;
let debounceTimer = null;

schoolInput.addEventListener("input", () => {
  const query = schoolInput.value.trim();

  selectedSchool = null;
  clearTimeout(debounceTimer);

  if (query.length < 2) {
    hideDropdown();
    return;
  }

  debounceTimer = setTimeout(() => {
    searchSchools(query);
  }, 300);
});

requestSchoolBtn.addEventListener("click", async () => {
  if (!selectedSchool) {
    alert("Please select a school from the dropdown.");
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      {
        action: "RUN_COLLECT_SCRIPT",
        school: selectedSchool,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Message error:", chrome.runtime.lastError.message);
          alert(chrome.runtime.lastError.message);
          return;
        }

        if (!response?.success) {
          console.error("Collect script failed:", response?.error);
          alert(response?.error || "Failed to send request.");
          return;
        }

        alert(`Request submitted for ${selectedSchool.name}`);
      },
    );
  } catch (err) {
    console.error(err);
    alert("Failed to run request script.");
  }
});

async function searchSchools(query) {
  schoolDropdown.innerHTML = `
    <div class="school-option">
      <div class="school-name">Searching...</div>
    </div>
  `;

  schoolDropdown.classList.remove("hidden");

  try {
    const res = await fetch(
      `https://broncosort.onrender.com/api/schools/search?q=${encodeURIComponent(query)}`,
    );

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    const schools = await res.json();

    renderDropdown(schools);
  } catch (err) {
    console.error("School search failed:", err);

    schoolDropdown.innerHTML = `
      <div class="school-option">
        <div class="school-name">Could not search schools.</div>
      </div>
    `;
  }
}

function renderDropdown(schools) {
  schoolDropdown.innerHTML = "";

  if (!schools.length) {
    schoolDropdown.innerHTML = `
      <div class="school-option">
        <div class="school-name">No schools found.</div>
      </div>
    `;
    return;
  }

  schools.forEach((school) => {
    const option = document.createElement("div");
    option.className = "school-option";

    option.innerHTML = `
      <div class="school-name">${school.name}</div>
      <div class="school-meta">${school.city}, ${school.state}</div>
    `;

    option.addEventListener("click", () => {
      selectedSchool = school;
      schoolInput.value = school.name;
      hideDropdown();

      console.log("Selected school:", selectedSchool);
    });

    schoolDropdown.appendChild(option);
  });
}

function hideDropdown() {
  schoolDropdown.classList.add("hidden");
  schoolDropdown.innerHTML = "";
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".school-search-wrap")) {
    hideDropdown();
  }
});
