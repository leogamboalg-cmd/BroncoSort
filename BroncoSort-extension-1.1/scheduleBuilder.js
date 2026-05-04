//scheduleBuilder.js
const IS_LOCAL = false;
const POPUP_SCALE = 0.6;

console.log("Schedule Builder Loaded");

const API_URL = IS_LOCAL
    ? "http://localhost:3000"
    : "https://broncosort.onrender.com";

let lastSignature = "";
let isRunning = false;
let debounceTimer = null;
let activePopupAnchor = null;
let popupTimer = null;

function isCorrectPage() {
    return window.location.href.includes("select-sections");
}

function getRows() {
    return [...document.querySelectorAll(".cx-MuiExpansionPanelSummary-root")];
}

function cleanText(text) {
    return text.replace(/\s+/g, " ").trim();
}

function getSignature(rows) {
    return rows
        .map((row) => {
            const clone = row.cloneNode(true);
            clone.querySelectorAll(".broncosort-rating").forEach((el) => el.remove());
            return cleanText(clone.innerText);
        })
        .join("|");
}

function isRealProfessorName(name) {
    const cleaned = cleanText(name).toLowerCase();

    return ![
        "to be announced",
        "tba",
        "staff",
        "instructor tba",
        "unknown",
        "-",
        "none",
    ].includes(cleaned);
}

function isProfessorName(text) {
    const cleaned = cleanText(text);

    if (!isRealProfessorName(cleaned)) return false;

    return /^[\p{L}][\p{L}.'-]*(?: [\p{L}][\p{L}.'-]*)+$/u.test(cleaned);
}

function getInstructorFromRow(row) {
    const cells = [...row.querySelectorAll('[role="cell"]')];

    for (const cell of cells) {
        const lines = cell.innerText.split("\n").map(cleanText).filter(Boolean);
        const match = lines.find(isProfessorName);

        if (match) return match;
    }

    return "TBA";
}

function scheduleRun() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runBroncoSort, 700);
}

async function runBroncoSort() {
    if (!isCorrectPage()) return;

    injectScheduleStyles();

    const rows = getRows();
    if (!rows.length) return;

    const signature = getSignature(rows);

    if (signature === lastSignature) return;
    if (isRunning) return;

    lastSignature = signature;
    isRunning = true;

    try {
        const classes = rows
            .map((row) => {
                const instructor = getInstructorFromRow(row);

                return {
                    instructor,
                    rating: 0,
                    element: row,
                    block: row.closest(".cx-MuiGrid-item"),
                };
            })
            .filter((c) => c.block);

        const uniqueProfessorNames = [
            ...new Set(
                classes.map((c) => c.instructor).filter((name) => name !== "TBA"),
            ),
        ];

        if (!uniqueProfessorNames.length) return;

        console.log("Fetching ratings:", uniqueProfessorNames);

        const res = await fetch(`${API_URL}/api/professor/ratings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                school: "Cal Poly Pomona",
                professors: uniqueProfessorNames,
            }),
        });

        const data = await res.json();
        const ratingsByName = data.ratingsByName || {};

        classes.forEach((c) => {
            const ratingInfo = ratingsByName[c.instructor];
            c.rating = ratingInfo?.rating || 0;
            addOrUpdateScheduleRating(c.element, c.instructor, ratingInfo);
        });

        const parent = classes[0].block.parentElement;
        const sorted = [...classes].sort((a, b) => b.rating - a.rating);

        sorted.forEach((c, i) => {
            parent.insertBefore(c.block, parent.children[i]);
        });

        lastSignature = getSignature(getRows());

        console.table(
            classes.map((c) => ({
                instructor: c.instructor,
                rating: c.rating,
            })),
        );
    } catch (err) {
        console.error("BroncoSort Schedule Builder error:", err);
    } finally {
        isRunning = false;
    }
}

function addOrUpdateScheduleRating(row, instructor, ratingInfo) {
    if (!ratingInfo) return;

    const instructorEl = [...row.querySelectorAll('[role="cell"]')].find(
        (cell) => {
            const lines = cell.innerText.split("\n").map(cleanText).filter(Boolean);
            return lines.includes(instructor);
        },
    );

    if (!instructorEl) return;

    const existing = instructorEl.querySelector(".broncosort-rating");
    if (existing) return;

    const rating = ratingInfo?.rating;
    const numRatings = ratingInfo?.numRatings;
    const professorId = ratingInfo?.id;

    const ratingEl = document.createElement("div");
    ratingEl.className = "broncosort-rating";
    ratingEl.style.marginTop = "6px";
    ratingEl.style.fontSize = "14px";
    ratingEl.style.fontWeight = "700";
    ratingEl.style.color = "#444";
    ratingEl.style.display = "flex";
    ratingEl.style.alignItems = "center";
    ratingEl.style.gap = "4px";
    ratingEl.style.cursor = "pointer";

    const hasReviews = (ratingInfo?.numRatings ?? 0) > 0;

    const ratingText = hasReviews
        ? `<span style="color:#1B5E20;font-size:17px;margin-right:3px;">★</span> ${rating}${numRatings ? ` (${numRatings})` : ""}`
        : "No reviews";

    ratingEl.addEventListener("mouseenter", (e) => {
        clearTimeout(popupTimer);
        activePopupAnchor = e.currentTarget;

        showScheduleProfessorPopup(
            {
                name: instructor,
                ...ratingInfo,
            },
            e.currentTarget,
        );
    });

    ratingEl.addEventListener("mouseleave", () => {
        popupTimer = setTimeout(() => {
            const popup = document.querySelector(".bs-prof-popup");
            if (!popup || !popup.matches(":hover")) {
                popup?.remove();
                activePopupAnchor = null;
            }
        }, 250);
    });

    if (professorId) {
        const link = document.createElement("a");
        link.href = `https://www.ratemyprofessors.com/professor/${professorId}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.textDecoration = "none";
        link.style.color = "#444";
        link.style.fontSize = "14px";
        link.style.fontWeight = "700";
        link.innerHTML = ratingText;

        ratingEl.appendChild(link);
    } else {
        ratingEl.innerHTML = ratingText;
    }

    instructorEl.appendChild(ratingEl);
}

const observer = new MutationObserver(() => {
    if (!isCorrectPage()) return;
    scheduleRun();
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
});

scheduleRun();

window.addEventListener(
    "scroll",
    () => {
        document.querySelector(".bs-prof-popup")?.remove();
        activePopupAnchor = null;
    },
    true,
);

function showScheduleProfessorPopup(prof, anchorEl) {
    document.querySelector(".bs-prof-popup")?.remove();

    const popup = document.createElement("div");
    popup.className = "bs-prof-popup";

    const isFound = prof.found !== false;
    const reviews = prof.numRatings ?? 0;
    const hasReviews = isFound && reviews > 0;

    const rating = hasReviews ? prof.rating : "N/A";
    const difficulty = hasReviews ? prof.difficulty : "N/A";
    const takeAgain =
        hasReviews && prof.percentTakeAgain != null && prof.percentTakeAgain >= 0
            ? `${Math.round(prof.percentTakeAgain)}%`
            : "N/A";

    const ranking = hasReviews ? prof.ranking : null;
    const topPercent = ranking?.topPercent ?? null;
    const departmentRank = ranking?.rank ?? null;
    const departmentTotal = ranking?.departmentTotal ?? null;

    const ringDegrees =
        topPercent != null
            ? Math.min(((100 - topPercent) / 100) * 360, 360)
            : 88;

    const rankTitle =
        topPercent != null ? `Top ${topPercent}%` : "Coming Soon";

    const rankSub =
        departmentRank != null && departmentTotal != null
            ? `Ranked #${departmentRank} of ${departmentTotal} in department`
            : "Needs department comparison data";

    const initials = (prof.name || "?")
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("");

    popup.innerHTML = `
    <div class="bs-top">
      <div class="bs-avatar">${initials}</div>

      <div class="bs-person">
        <div class="bs-name">
          ${isFound ? (prof.profName || prof.name) : prof.name}
        </div>
        <div class="bs-dept">${prof.department || "Computer Science"}</div>
      </div>

      <div class="bs-rmp-pill">RMP</div>
    </div>

    <div class="bs-body">
      <div class="bs-rank-card">
  <div class="bs-ring" style="--rank-deg:${ringDegrees}deg;">
    <div class="bs-ring-inner">
      <span>TOP</span>
      <strong>${topPercent != null ? `${topPercent}%` : "—"}</strong>
    </div>
  </div>

  <div class="bs-rank-info">
    <div class="bs-rank-label">▦ Department Ranking</div>
    <div class="bs-rank-title">${rankTitle}</div>
    <div class="bs-rank-sub">${rankSub}</div>
  </div>
</div>

      <div class="bs-stats">
        <div class="bs-stat-card">
          <div class="bs-icon">★</div>
          <div class="bs-stat-label">Rating</div>
          <div class="bs-stat-value">${rating}<span>/5</span></div>
          <div class="bs-bar">
            <div style="width:${rating !== "N/A" ? Math.min((rating / 5) * 100, 100) : 0}%"></div>
          </div>
        </div>

        <div class="bs-stat-card">
          <div class="bs-icon">▰</div>
          <div class="bs-stat-label">Difficulty</div>
          <div class="bs-stat-value">${difficulty}<span>/5</span></div>
          <div class="bs-bar">
            <div style="width:${difficulty !== "N/A" ? Math.min((difficulty / 5) * 100, 100) : 0}%"></div>
          </div>
        </div>

        <div class="bs-stat-card">
          <div class="bs-icon">↻</div>
          <div class="bs-stat-label">Take Again</div>
          <div class="bs-stat-value">${takeAgain}</div>
          <div class="bs-bar">
            <div style="width:${takeAgain !== "N/A" ? parseInt(takeAgain) : 0}%"></div>
          </div>
        </div>
      </div>

      <div class="bs-review-row">
        <div class="bs-stars">★ ★ ★ ★ <span>★</span></div>
          <div>${!isFound
            ? "Not on RateMyProfessors"
            : hasReviews
                ? `Based on <strong>${reviews}</strong> student reviews`
                : "No student reviews yet"
        }</div>
      </div>

      <a class="bs-btn" target="_blank">
        <span>View Full Profile</span>
        <b>↗</b>
      </a>

      <div class="bs-footer">
        <span><i></i> Live data</span>
        <span></span>
      </div>
    </div>
  `;

    const link = popup.querySelector(".bs-btn");

    if (prof.id) {
        link.href = `https://www.ratemyprofessors.com/professor/${prof.id}`;
    } else {
        link.remove();
    }

    document.body.appendChild(popup);

    popup.style.position = "fixed";

    const r = anchorEl.getBoundingClientRect();
    const popupHeight = popup.offsetHeight * POPUP_SCALE;
    const popupWidth = popup.offsetWidth * POPUP_SCALE;
    const spaceBelow = window.innerHeight - r.bottom;

    const top =
        spaceBelow < popupHeight + 16
            ? r.top - popupHeight - 8
            : r.bottom + 8;

    const left = Math.min(r.left, window.innerWidth - popupWidth - 12);

    popup.style.left = `${Math.max(12, left)}px`;
    popup.style.top = `${Math.max(12, top)}px`;

    popup.addEventListener("mouseenter", () => {
        clearTimeout(popupTimer);
    });

    popup.addEventListener("mouseleave", () => {
        popup.remove();
        activePopupAnchor = null;
    });
}

function injectScheduleStyles() {
    if (document.querySelector("#broncosort-popup-styles")) return;

    const style = document.createElement("style");
    style.id = "broncosort-popup-styles";

    style.textContent = `
    .bs-prof-popup,
    .bs-prof-popup * {
      box-sizing: border-box;
      font-family: Arial, sans-serif;
    }

    .bs-prof-popup {
      z-index: 999999;
      width: 520px;
      background: #ffffff;
      border-radius: 26px;
      overflow: hidden;
      color: #061f14;
      border: 1px solid rgba(21, 128, 61, 0.22);
      box-shadow: 0 26px 70px rgba(0, 0, 0, 0.28);
      transform: scale(0.60);
      transform-origin: top left;
    }

    .bs-top {
      position: relative;
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 24px 28px 34px;
      background:
        radial-gradient(circle at 88% 28%, rgba(80, 220, 120, 0.2), transparent 28%),
        linear-gradient(135deg, #0b3b27 0%, #0a5a32 48%, #06361f 100%);
      color: white;
      overflow: hidden;
    }

    .bs-top::after {
      content: "";
      position: absolute;
      width: 220px;
      height: 2px;
      right: -20px;
      top: 18px;
      background: linear-gradient(90deg, transparent, rgba(167, 243, 208, 0.9), transparent);
      transform: rotate(-45deg);
      opacity: 0.8;
    }

    .bs-avatar {
      width: 74px;
      height: 74px;
      min-width: 74px;
      border-radius: 20px;
      background: linear-gradient(180deg, #ffffff, #f5fff8);
      color: #087232;
      border: 2px solid #7ee69b;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.5), 0 14px 28px rgba(0,0,0,0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -1px;
      position: relative;
      z-index: 1;
    }

    .bs-person {
      position: relative;
      z-index: 1;
      flex: 1;
      min-width: 0;
    }

    .bs-name {
      font-size: 28px;
      font-weight: 900;
      line-height: 1.05;
      color: white;
      letter-spacing: -0.8px;
    }

    .bs-dept {
      margin-top: 10px;
      font-size: 13px;
      font-weight: 900;
      color: #9ef0ad;
      letter-spacing: 4px;
      text-transform: uppercase;
    }

    .bs-rmp-pill {
      position: relative;
      z-index: 1;
      padding: 10px 16px;
      border-radius: 10px;
      color: #9ef0ad;
      border: 2px solid rgba(134, 239, 172, 0.55);
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 3px;
      background: rgba(5, 46, 22, 0.25);
    }

    .bs-body {
      margin-top: -18px;
      padding: 22px 24px 18px;
      background: #ffffff;
      border-top-left-radius: 26px;
      border-top-right-radius: 26px;
      position: relative;
      z-index: 2;
    }

    .bs-rank-card {
      display: grid;
      grid-template-columns: 132px 1fr;
      align-items: center;
      gap: 22px;
      padding: 20px;
      border-radius: 20px;
      background:
        radial-gradient(circle at 92% 20%, rgba(22, 101, 52, 0.06), transparent 38%),
        linear-gradient(135deg, #ffffff, #f8fbf8);
      border: 1px solid #dfeae2;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.7);
      margin-bottom: 22px;
    }

    .bs-ring {
  width: 118px;
  height: 118px;
  border-radius: 50%;
  background:
    radial-gradient(circle, #ffffff 57%, transparent 58%),
    conic-gradient(#1ca344 0deg var(--rank-deg), #edf3ee var(--rank-deg) 360deg);
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 10px 16px rgba(22, 163, 74, 0.16));
}

    .bs-ring-inner {
      text-align: center;
      line-height: 1;
    }

    .bs-ring-inner span {
      display: block;
      font-size: 15px;
      font-weight: 900;
      color: #26332c;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }

    .bs-ring-inner strong {
      display: block;
      font-size: 42px;
      font-weight: 900;
      color: #061f14;
      letter-spacing: -2px;
    }

    .bs-rank-label {
      font-size: 13px;
      font-weight: 900;
      color: #087232;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .bs-rank-title {
      font-size: 26px;
      font-weight: 900;
      color: #061f14;
      line-height: 1.05;
      letter-spacing: -0.8px;
    }

    .bs-rank-sub {
      margin-top: 10px;
      font-size: 15px;
      color: #6a7370;
    }

    .bs-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 18px;
    }

    .bs-stat-card {
      min-height: 146px;
      padding: 14px;
      border-radius: 17px;
      background: linear-gradient(180deg, #ffffff, #fbfdfb);
      border: 1px solid #dfe8e2;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
    }

    .bs-icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: #e7f5e9;
      color: #0b7c32;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 19px;
      font-weight: 900;
      margin-bottom: 12px;
    }

    .bs-stat-label {
      font-size: 12px;
      font-weight: 900;
      color: #087232;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 16px;
    }

    .bs-stat-value {
      font-size: 34px;
      font-weight: 900;
      color: #061f14;
      line-height: 1;
      letter-spacing: -1px;
    }

    .bs-stat-value span {
      font-size: 18px;
      color: #7a817e;
      font-weight: 500;
      margin-left: 2px;
    }

    .bs-bar {
      height: 8px;
      width: 100%;
      margin-top: 18px;
      border-radius: 999px;
      background: #e6eee8;
      overflow: hidden;
    }

    .bs-bar div {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #087232, #18a247);
      box-shadow: 0 0 14px rgba(24, 162, 71, 0.45);
    }

    .bs-review-row {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 2px 2px 18px;
      color: #6b7470;
      font-size: 15px;
    }

    .bs-review-row strong {
      color: #087232;
      font-weight: 900;
    }

    .bs-stars {
      color: #098636;
      font-size: 20px;
      letter-spacing: 5px;
      white-space: nowrap;
    }

    .bs-stars span {
      color: #cfd9d3;
    }

    .bs-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 18px;
      border-radius: 18px;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.12), transparent 35%),
        linear-gradient(135deg, #137335, #064420);
      color: white !important;
      text-decoration: none;
      text-transform: uppercase;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 2.5px;
      box-shadow: 0 14px 28px rgba(12, 116, 47, 0.28);
      overflow: hidden;
    }

    .bs-btn::after {
      content: "";
      position: absolute;
      right: 34px;
      top: -20px;
      width: 70px;
      height: 90px;
      background: rgba(255,255,255,0.14);
      transform: skewX(-35deg);
    }

    .bs-btn b {
      font-size: 22px;
      position: relative;
      z-index: 1;
    }

    .bs-btn span {
      position: relative;
      z-index: 1;
    }

    .bs-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid #e3e9e5;
      color: #37a45f;
      font-size: 13px;
    }

    .bs-footer span:first-child {
      color: #6b7470;
    }

    .bs-footer i {
      display: inline-block;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #35b66b;
      margin-right: 7px;
    }

    .bs-rank-label {
  font-size: 20px !important;
}

.bs-rank-title {
  font-size: 35px !important;
}

.bs-rank-sub {
  font-size: 21px !important;
}

.bs-stat-label {
  font-size: 19px !important;
}

.bs-review-row {
  font-size: 21px !important;
}

.bs-stars {
  font-size: 29px !important;
  letter-spacing: 6px !important;
}

.bs-footer {
  font-size: 19px !important;
}
  .bs-body {
  padding: 18px 22px 14px !important;
}

.bs-rank-card {
  padding: 16px !important;
  margin-bottom: 16px !important;
  gap: 16px !important;
}

.bs-stats {
  gap: 10px !important;
  margin-bottom: 12px !important;
}

.bs-stat-card {
  min-height: 126px !important;
  padding: 12px !important;
}

.bs-icon {
  margin-bottom: 8px !important;
}

.bs-stat-label {
  margin-bottom: 10px !important;
}

.bs-bar {
  margin-top: 12px !important;
}

.bs-review-row {
  gap: 12px !important;
  padding-bottom: 12px !important;
}

.bs-btn {
  padding: 15px !important;
}

.bs-footer {
  margin-top: 10px !important;
  padding-top: 10px !important;
}
  `;

    document.head.appendChild(style);
}