const USE_LOCAL = false;

const API_BASE = USE_LOCAL
  ? "http://localhost:3000"
  : "https://broncosort.onrender.com";

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
    console.error("TargetContent iframe not found");
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
}

async function fetchRatingsAndSortCourses() {
  try {
    const doc = getTargetDocument();
    if (!doc) return;

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

function startWhenReady() {
  let tries = 0;
  const maxTries = 20;

  const timer = setInterval(() => {
    const doc = getTargetDocument();
    const count = doc?.querySelectorAll('[id^="MTG_INSTR"]').length || 0;

    console.log("Waiting for instructors in iframe...", count);

    if (count > 0) {
      clearInterval(timer);
      fetchRatingsAndSortCourses();
      return;
    }

    tries += 1;
    if (tries >= maxTries) {
      clearInterval(timer);
      console.log("Timed out waiting for instructor rows.");
    }
  }, 1000);
}

wakeServer();

if (document.readyState === "complete") {
  startWhenReady();
} else {
  window.addEventListener("load", () => {
    startWhenReady();
  });
}
startWhenReady();