const USE_LOCAL = false;

const API_BASE = USE_LOCAL
  ? "http://localhost:3000"
  : "https://broncosort.onrender.com";
console.log("BroncoSort loaded:", window.location.href);
async function wakeServer() {
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      method: "GET",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.error || `Request failed with status ${response.status}`,
      );
    }

    console.log("Waking up server");
  } catch (error) {
    console.error("Could not wake up server");
  }
}

function getTargetDocument() {
  const iframe =
    document.querySelector('iframe[name="TargetContent"]') ||
    document.querySelector("#ptifrmtgtframe");

  if (!iframe) {
    // console.error("TargetContent iframe not found");
    return null;
  }

  const innerDoc = iframe.contentDocument || iframe.contentWindow?.document;

  if (!innerDoc) {
    console.error("Could not access iframe document");
    return null;
  }

  return innerDoc;
}

function cleanName(name) {
  name = name.replace(/\s+/g, " ").trim();

  const parts = name.split(" ");
  if (parts.length % 2 === 0) {
    const half = parts.length / 2;
    const first = parts.slice(0, half).join(" ");
    const second = parts.slice(half).join(" ");
    if (first === second) name = first;
  }

  return name;
}

function getCourseTitle(courseBox) {
  const allText = courseBox.innerText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const match = allText.find((line) => /^[A-Z]{2,4}\s+\d{4}\s*-/.test(line));
  if (match) return match;

  const fallback = allText.find((line) => /^[A-Z]{2,4}\s+\d{4}/.test(line));
  return fallback || courseBox.id;
}

function collectCourses(doc) {
  const courseBoxes = Array.from(
    doc.querySelectorAll('[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]'),
  );

  const courses = courseBoxes
    .map((courseBox) => {
      // only look inside THIS course box
      const optionBlocks = Array.from(
        courseBox.querySelectorAll('[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX3$"]'),
      ).filter((block) => {
        const instrEl = block.querySelector('[id^="MTG_INSTR"]');
        return !!instrEl;
      });

      const options = optionBlocks
        .map((block) => {
          const instrEl = block.querySelector('[id^="MTG_INSTR"]');
          const rawName = instrEl ? instrEl.innerText : "";
          const name = rawName ? cleanName(rawName) : "";

          return {
            name,
            block,
            instrEl,
          };
        })
        .filter((opt) => opt.name && isRealProfessorName(opt.name));

      return {
        courseBox,
        courseTitle: getCourseTitle(courseBox),
        options,
      };
    })
    .filter((course) => course.options.length > 0);

  return courses;
}

function addOrUpdateRating(opt, ratingInfo, doc) {
  const instrEl = opt.instrEl;
  if (!instrEl) return;

  instrEl.textContent = cleanName(instrEl.innerText);

  const existing = opt.block.querySelector(".broncosort-rating");
  if (existing) existing.remove();

  const rating = ratingInfo?.rating;
  const numRatings = ratingInfo?.numRatings;
  const professorId = ratingInfo?.id;

  const ratingEl = doc.createElement("div");
  ratingEl.className = "broncosort-rating";
  ratingEl.style.marginTop = "4px";
  ratingEl.style.fontSize = "12px";
  ratingEl.style.fontWeight = "600";
  ratingEl.style.color = "#444";

  const ratingText =
    rating != null
      ? `⭐ ${rating}${numRatings ? ` (${numRatings})` : ""}`
      : "No rating";

  if (professorId) {
    const link = doc.createElement("a");
    link.href = `https://www.ratemyprofessors.com/professor/${professorId}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.textDecoration = "none";
    link.style.color = "#444";
    link.textContent = ratingText;
    ratingEl.appendChild(link);
  } else {
    ratingEl.textContent = ratingText;
  }

  instrEl.insertAdjacentElement("afterend", ratingEl);

  let popupTimer;

  ratingEl.style.cursor = "pointer";
  ratingEl.title = "Professor details";

  ratingEl.addEventListener("mouseenter", (e) => {
    clearTimeout(popupTimer);

    showProfessorPopup(
      {
        name: opt.name,
        ...ratingInfo,
      },
      doc,
      e,
    );
  });

  ratingEl.addEventListener("mouseleave", () => {
    popupTimer = setTimeout(() => {
      const popup = doc.querySelector(".bs-prof-popup");
      if (!popup || !popup.matches(":hover")) {
        popup?.remove();
      }
    }, 200);
  });
}

async function fetchRatingsAndSortCourses() {
  try {
    const doc = getTargetDocument();
    if (!doc) return;
    injectBroncoSortStyles(doc); // ✅ ADD THIS

    const courses = collectCourses(doc);

    console.log(
      "Courses found:",
      courses.map((c) => ({
        title: c.courseTitle,
        names: c.options.map((o) => o.name),
      })),
    );

    const uniqueProfessorNames = [
      ...new Set(
        courses.flatMap((course) => course.options.map((opt) => opt.name)),
      ),
    ].sort();

    if (!uniqueProfessorNames.length) {
      console.log("No professors found.");
      return;
    }

    const payload = {
      school: "Cal Poly Pomona",
      professors: uniqueProfessorNames,
    };

    console.log("Sending to backend:", payload);

    const res = await fetch(`${API_BASE}/api/professor/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Backend error:", res.status, text);
      throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();
    const ratingsByName = data.ratingsByName || {};

    console.log("Received ratings:", ratingsByName);

    courses.forEach((course) => {
      course.options.sort((a, b) => {
        const rA = ratingsByName[a.name]?.rating || 0;
        const rB = ratingsByName[b.name]?.rating || 0;
        return rB - rA;
      });

      // only move option blocks inside THIS course box
      const parent = course.options[0]?.block?.parentElement;
      if (!parent) return;

      course.options.forEach((opt) => {
        addOrUpdateRating(opt, ratingsByName[opt.name], doc);
      });

      course.options.forEach((opt) => {
        parent.appendChild(opt.block);
      });

      console.log(
        "Sorted within course only:",
        course.courseTitle,
        course.options.map(
          (opt) => `${opt.name} (${ratingsByName[opt.name]?.rating || 0})`,
        ),
      );
    });
  } catch (err) {
    console.error("Error:", err);
  }
}

function isRealProfessorName(name) {
  const cleaned = cleanName(name).toLowerCase();

  return ![
    "to be announced",
    "tba",
    "staff",
    "instructor tba",
    "unknown",
  ].includes(cleaned);
}

let broncoSortSignature = "";

function getCurrentSignature(doc) {
  const names = Array.from(doc.querySelectorAll('[id^="MTG_INSTR"]'))
    .map((el) => cleanName(el.innerText || ""))
    .filter(Boolean);

  return names.join("|");
}

function startWhenReady() {
  setInterval(() => {
    const doc = getTargetDocument();
    if (!doc) return;

    const count = doc.querySelectorAll('[id^="MTG_INSTR"]').length;
    if (count === 0) return;

    const newSignature = getCurrentSignature(doc);
    if (!newSignature) return;

    if (newSignature === broncoSortSignature) return;

    broncoSortSignature = newSignature;
    console.log("BroncoSort running...");
    fetchRatingsAndSortCourses();
  }, 2000);
}

wakeServer();

if (document.readyState === "complete") {
  startWhenReady();
} else {
  window.addEventListener("load", () => {
    startWhenReady();
  });
}

function showProfessorPopup(prof, doc, e) {
  doc.querySelector(".bs-prof-popup")?.remove();

  const popup = doc.createElement("div");
  popup.className = "bs-prof-popup";

  const rating = prof.rating ?? "N/A";
  const reviews = prof.numRatings ?? 0;
  const difficulty = prof.difficulty ?? "N/A";
  const takeAgain =
    prof.percentTakeAgain != null
      ? `${Math.round(prof.percentTakeAgain)}%`
      : "N/A";

  popup.innerHTML = `
    <div class="bs-popup-title"></div>
    <div class="bs-popup-subtitle"></div>

    <div class="bs-popup-stats">
      <div><strong>${rating}</strong><span>Rating</span></div>
      <div><strong>${reviews}</strong><span>Reviews</span></div>
      <div><strong>${difficulty}</strong><span>Difficulty</span></div>
      <div><strong>${takeAgain}</strong><span>Take Again</span></div>
    </div>

    <a class="bs-popup-link" target="_blank">View on RMP</a>
  `;

  popup.querySelector(".bs-popup-title").textContent =
    prof.profName || prof.name;

  popup.querySelector(".bs-popup-subtitle").textContent =
    prof.department || "Professor Snapshot";

  const link = popup.querySelector(".bs-popup-link");

  if (prof.id) {
    link.href = `https://www.ratemyprofessors.com/professor/${prof.id}`;
  } else {
    link.remove();
  }

  popup.style.position = "absolute";

  e.currentTarget.style.position = "relative";
  e.currentTarget.appendChild(popup);

  popup.style.position = "absolute";
  popup.style.left = "0px";
  popup.style.top = "22px";
}

function injectBroncoSortStyles(doc) {
  if (doc.querySelector("#broncosort-popup-styles")) return;

  const style = doc.createElement("style");
  style.id = "broncosort-popup-styles";

  style.textContent = `
    .bs-prof-popup {
      z-index: 999999;
      width: 260px;
      background: #ffffff;
      border: 1px solid #d9e2ec;
      border-radius: 14px;
      padding: 14px;
      box-shadow: 0 14px 35px rgba(15, 23, 42, 0.22);
      font-family: Arial, sans-serif;
      color: #172033;
    }

    .bs-popup-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f766e;
      margin-bottom: 2px;
    }

    .bs-popup-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 12px;
    }

    .bs-popup-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .bs-popup-stats div {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 9px;
    }

    .bs-popup-stats strong {
      display: block;
      font-size: 16px;
      color: #111827;
    }

    .bs-popup-stats span {
      font-size: 11px;
      color: #64748b;
    }

    .bs-popup-link {
      display: block;
      margin-top: 12px;
      padding: 9px;
      border-radius: 10px;
      background: #0f766e;
      color: white !important;
      text-align: center;
      text-decoration: none;
      font-weight: 700;
      font-size: 12px;
    }
  `;

  doc.head.appendChild(style);
}
