const fakeRatings = {
  "Antoine Si": 4.8,
  "Qichao Dong": 4.2,
  "Edwin Rodríguez": 3.9,
};

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

const courseBoxes = Array.from(
  document.querySelectorAll('[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]'),
);

courseBoxes.forEach((courseBox) => {
  const optionBlocks = Array.from(
    courseBox.querySelectorAll(
      ':scope [id^="win0divSSR_CLSRSLT_WRK_GROUPBOX3$"]',
    ),
  ).filter((block) => {
    // only keep direct course option blocks, not nested duplicates
    return (
      block.closest('[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]') === courseBox
    );
  });

  if (optionBlocks.length < 2) return;

  const data = optionBlocks.map((block) => {
    const instrEl = block.querySelector('[id^="MTG_INSTR"]');
    const name = instrEl ? cleanName(instrEl.innerText) : "";
    return { block, name };
  });

  data.sort((a, b) => {
    const rA = fakeRatings[a.name] || 0;
    const rB = fakeRatings[b.name] || 0;
    return rB - rA;
  });

  const parent = optionBlocks[0].parentElement;
  if (!parent) return;

  data.forEach(({ block }) => parent.appendChild(block));

  console.log(
    "Sorted course:",
    courseBox.id,
    data.map((x) => `${x.name} (${fakeRatings[x.name] || 0})`),
  );
});

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
