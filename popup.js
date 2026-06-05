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
    showToast("Please select a school from the dropdown.");
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
          alert(chrome.runtime.lastError.message);
          return;
        }

        if (!response?.success) {
          if (response?.status === 409) {
            showToast("School already requested.");
          } else {
            showToast(
              `Request failed: ${response?.status || "unknown"} ${response?.error || ""}`,
              "error",
            );
          }

          return;
        }

        showToast("Request submitted!", "success");
      },
    );
  } catch (err) {
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

function showToast(message, type = "info") {
  const existing = document.querySelector(".bs-toast");

  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.className = `bs-toast bs-toast-${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3000);
}

const toastStyle = document.createElement("style");

toastStyle.textContent = `
  .bs-toast {
    position: fixed;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: #1b1b1b;
    color: white;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    opacity: 0;
    transition:
      opacity 0.25s ease,
      transform 0.25s ease;
    z-index: 999999;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    max-width: 320px;
    text-align: center;
  }

  .bs-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  .bs-toast-success {
    background: #1b5e20;
  }

  .bs-toast-error {
    background: #b42318;
  }

  .bs-toast-info {
    background: #1f2937;
  }
`;

document.head.appendChild(toastStyle);
