const USE_LOCAL = false;

const API_BASE = USE_LOCAL
  ? "http://localhost:3000"
  : "https://broncosort.onrender.com";

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

  // look for lines like "CS 2400 - Data Structures..."
  const match = allText.find((line) => /^[A-Z]{2,4}\s+\d{4}\s*-/.test(line));

  if (match) return match;

  // backup: return first line that looks like department + number
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

    const res = await fetch(`${API_BASE}/api/professor/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();
    const ratingsByName = data.ratingsByName || {};

    console.log("Received ratings:", ratingsByName);

    // 🔥 SORT EACH COURSE
    courses.forEach((course) => {
      course.options.sort((a, b) => {
        const rA = ratingsByName[a.name]?.rating || 0;
        const rB = ratingsByName[b.name]?.rating || 0;
        return rB - rA;
      });

      const parent = course.options[0]?.block?.parentElement;
      if (!parent) return;

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
