//content.js
const USE_LOCAL = false;
const SCALE = 0.6;
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

    const hasReviews = (ratingInfo?.numRatings ?? 0) > 0;

    const ratingText = hasReviews
        ? `<span style="color:#1B5E20;font-size:30px;margin-right:3px;">★</span> ${rating}${numRatings ? ` (${numRatings})` : ""}`
        : "No reviews";

    if (professorId) {
        const link = doc.createElement("a");
        link.href = `https://www.ratemyprofessors.com/professor/${professorId}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.textDecoration = "none";
        link.style.color = "#444";
        link.innerHTML = ratingText;

        ratingEl.appendChild(link);
    } else {
        ratingEl.innerHTML = ratingText;
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
        injectBroncoSortStyles(doc);

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
        <div class="bs-name">${prof.profName || prof.name}</div>
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
          <div class="bs-bar"><div style="width:${rating !== "N/A" ? Math.min((rating / 5) * 100, 100) : 0}%"></div></div>
        </div>

        <div class="bs-stat-card">
          <div class="bs-icon">▰</div>
          <div class="bs-stat-label">Difficulty</div>
          <div class="bs-stat-value">${difficulty}<span>/5</span></div>
          <div class="bs-bar"><div style="width:${difficulty !== "N/A" ? Math.min((difficulty / 5) * 100, 100) : 0}%"></div></div>
        </div>

        <div class="bs-stat-card">
          <div class="bs-icon">↻</div>
          <div class="bs-stat-label">Take Again</div>
          <div class="bs-stat-value">${takeAgain}</div>
          <div class="bs-bar"><div style="width:${takeAgain !== "N/A" ? parseInt(takeAgain) : 0}%"></div></div>
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

    doc.body.appendChild(popup);

    popup.style.position = "fixed";

    const r = e.currentTarget.getBoundingClientRect();

    const popupHeight = popup.offsetHeight * SCALE;
    const popupWidth = popup.offsetWidth * SCALE;
    const win = doc.defaultView;

    const spaceBelow = win.innerHeight - r.bottom;

    const top =
        spaceBelow < popupHeight + 16
            ? r.top - popupHeight - 8
            : r.bottom + 8;

    const left = Math.min(r.left, win.innerWidth - popupWidth - 12);

    popup.style.left = `${Math.max(12, left)}px`;
    popup.style.top = `${Math.max(12, top)}px`;

    popup.addEventListener("mouseleave", () => popup.remove());
}

function injectBroncoSortStyles(doc) {
    const existing = doc.querySelector("#broncosort-popup-styles");
    if (existing) existing.remove();

    const style = doc.createElement("style");
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

    .bs-rank-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
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
      /* CHANGING FONT SIZES (SAFE) */

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

/* COMPRESS SPACING SO POPUP DOESN’T GROW */

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

    doc.head.appendChild(style);
}

