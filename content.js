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

wakeServer();

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

const courseBoxes = Array.from(
  document.querySelectorAll('[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]'),
);

const courses = courseBoxes
  .map((courseBox) => {
    const optionBlocks = Array.from(
      courseBox.querySelectorAll(
        ':scope [id^="win0divSSR_CLSRSLT_WRK_GROUPBOX3$"]',
      ),
    ).filter((block) => {
      return (
        block.closest('[id^="MTG_INSTR"]') === null &&
        block.closest('[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]') === courseBox
      );
    });

    const options = optionBlocks
      .map((block) => {
        const instrEl = block.querySelector('[id^="MTG_INSTR"]');
        const rawName = instrEl ? instrEl.innerText : "";
        const name = rawName ? cleanName(rawName) : "";

        return {
          name,
          blockId: block.id,
          block,
        };
      })
      .filter((opt) => opt.name);

    return {
      courseBoxId: courseBox.id,
      courseTitle: getCourseTitle(courseBox),
      options,
    };
  })
  .filter((course) => course.options.length > 0);

const uniqueProfessorNames = [
  ...new Set(
    courses.flatMap((course) => course.options.map((opt) => opt.name)),
  ),
].sort();

console.log({ courses, uniqueProfessorNames });

async function fetchRatingsAndSortCourses() {
  try {
    const payload = {
      school: "Cal Poly Pomona",
      professors: uniqueProfessorNames,
    };

    console.log("Sending to backend:", payload);
    console.log("Using API base:", API_BASE);

    const res = await fetch(`${API_BASE}/api/professor/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text(); // raw response (important)

      console.error("❌ Backend error response:");
      console.error("Status:", res.status);
      console.error("Body:", text);

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

      const parent = course.options[0]?.block?.parentElement;
      if (!parent) return;

      course.options.forEach((opt) => {
        const instrEl = opt.block.querySelector('[id^="MTG_INSTR"]');
        if (instrEl) {
          instrEl.textContent = cleanName(instrEl.innerText);
        }

        // avoid duplicates
        const existing = opt.block.querySelector(".broncosort-rating");
        if (existing) existing.remove();

        const rating = ratingsByName[opt.name]?.rating;
        const numRatings = ratingsByName[opt.name]?.numRatings;
        const professorId = ratingsByName[opt.name]?.id;

        const ratingEl = document.createElement("div");
        ratingEl.className = "broncosort-rating";
        ratingEl.style.marginTop = "4px";
        ratingEl.style.fontSize = "12px";
        ratingEl.style.fontWeight = "600";
        ratingEl.style.color = "#444";
        console.log(opt.name, ratingsByName[opt.name]);
        const ratingText =
          rating != null
            ? `⭐ ${rating}${numRatings ? ` (${numRatings})` : ""}`
            : "No rating";

        const link = document.createElement("a");
        link.href = `https://www.ratemyprofessors.com/professor/${professorId}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.textDecoration = "none";
        link.style.color = "#444";
        link.textContent = ratingText;
        console.log("Link added!");

        ratingEl.appendChild(link);

        instrEl.insertAdjacentElement("afterend", ratingEl);
      });

      course.options.forEach((opt) => parent.appendChild(opt.block));

      console.log(
        "Sorted:",
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

fetchRatingsAndSortCourses();
