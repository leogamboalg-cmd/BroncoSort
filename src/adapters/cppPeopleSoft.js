// src/adapters/cppPeopleSoft.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.adapters = window.BroncoSort.adapters || {};

  const { cleanProfessorName, isRealProfessorName } =
    window.BroncoSort.core.professorNames;

  function getTargetDocument(context) {
    return context?.currentDocument || document;
  }

  function getCourseTitle(courseBox) {
    const lines = (courseBox.innerText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return (
      lines.find((line) => /^[A-Z]{2,4}\s+\d{4}\s*-/.test(line)) ||
      lines.find((line) => /^[A-Z]{2,4}\s+\d{4}/.test(line)) ||
      courseBox.id
    );
  }

  function collectCourses(doc) {
    const courseBoxes = Array.from(
      doc.querySelectorAll('[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]'),
    );

    return courseBoxes
      .map((courseBox) => {
        const optionBlocks = Array.from(
          courseBox.querySelectorAll(
            '[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX3$"]',
          ),
        ).filter((block) => block.querySelector('[id^="MTG_INSTR"]'));

        const options = optionBlocks
          .map((block) => {
            const instrEl = block.querySelector('[id^="MTG_INSTR"]');
            const name = cleanProfessorName(instrEl?.innerText || "");

            return {
              name,
              block,
              instrEl,
              department: null,
            };
          })
          .filter((option) => option.name && isRealProfessorName(option.name));

        return {
          courseBox,
          courseTitle: getCourseTitle(courseBox),
          options,
        };
      })
      .filter((course) => course.options.length > 0);
  }

  function getChangeSignature(doc) {
    return Array.from(
      doc.querySelectorAll('[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX3$"]'),
    )
      .map((block) => {
        const instructor = block.querySelector('[id^="MTG_INSTR"]');
        const professorName = cleanProfessorName(
          instructor?.textContent || instructor?.innerText || "",
        );

        if (!professorName) return null;

        return `${block.id}:${professorName}`;
      })
      .filter(Boolean)
      .sort()
      .join("|");
  }

  window.BroncoSort.adapters["cpp-peoplesoft"] = {
    id: "cpp-peoplesoft",
    pageType: "course-search",
    ratingRenderer: {
      ratingTag: "div",
      ratingClass: "broncosort-rating--block",
      starSize: "30px",
    },
    matchesPage(context) {
      if (context.school.id !== "cpp") return false;
      if (window.location.href.includes("select-sections")) return false;

      const doc = getTargetDocument(context);
      return Boolean(
        doc?.querySelector('[id^="MTG_INSTR"]') ||
        doc?.querySelector('[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]'),
      );
    },
    getTargetDocument,
    collectCourses,
    getProfessorElements(doc) {
      return Array.from(doc.querySelectorAll('[id^="MTG_INSTR"]'));
    },
    insertRating({ option, ratingElement }) {
      option.instrEl.textContent = cleanProfessorName(
        option.instrEl.innerText || "",
      );
      option.instrEl.insertAdjacentElement("afterend", ratingElement);
    },
    canReorderOptions: true,
    watchStrategy: "polling",
    pollIntervalMs: 2000,
    reorderCourse(course) {
      const parent = course.options[0]?.block?.parentElement;

      if (!parent) return;

      course.options.forEach((option) => {
        parent.appendChild(option.block);
      });
    },
    getChangeSignature,
    isReady(doc) {
      return Boolean(doc.querySelector('[id^="MTG_INSTR"]'));
    },
  };
})();
