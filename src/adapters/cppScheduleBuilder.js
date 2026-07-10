// src/adapters/cppScheduleBuilder.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.adapters = window.BroncoSort.adapters || {};

  const { cleanProfessorName, isRealProfessorName } =
    window.BroncoSort.core.professorNames;

  function cleanText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isProfessorName(text) {
    const cleaned = cleanProfessorName(text);

    if (!isRealProfessorName(cleaned)) return false;

    return /^[\p{L}][\p{L}.'-]*(?: [\p{L}][\p{L}.'-]*)+$/u.test(cleaned);
  }

  function getRows(doc) {
    return Array.from(
      doc.querySelectorAll(".cx-MuiExpansionPanelSummary-root"),
    );
  }

  function getInstructorFromRow(row) {
    const cells = Array.from(row.querySelectorAll('[role="cell"]'));

    for (const cell of cells) {
      const lines = (cell.innerText || "")
        .split("\n")
        .map(cleanText)
        .filter(Boolean);
      const match = lines.find(isProfessorName);

      if (match) return cleanProfessorName(match);
    }

    return "";
  }

  function getInstructorElement(row, instructor) {
    return Array.from(row.querySelectorAll('[role="cell"]')).find((cell) => {
      const lines = (cell.innerText || "")
        .split("\n")
        .map(cleanText)
        .filter(Boolean);

      return lines.includes(instructor);
    });
  }

  function collectCourses(doc) {
    const options = getRows(doc)
      .map((row) => {
        const name = getInstructorFromRow(row);
        const instrEl = getInstructorElement(row, name);

        return {
          name,
          block: row.closest(".cx-MuiGrid-item"),
          instrEl,
          department: null,
        };
      })
      .filter(
        (option) =>
          option.name &&
          option.block &&
          option.instrEl &&
          isRealProfessorName(option.name),
      );

    if (!options.length) return [];

    return [
      {
        courseBox: options[0].block?.parentElement || doc.body,
        courseTitle: "CPP Schedule Builder",
        options,
      },
    ];
  }

  function getChangeSignature(doc) {
    return getRows(doc)
      .map((row) => {
        const clone = row.cloneNode(true);
        clone
          .querySelectorAll(".broncosort-rating")
          .forEach((el) => el.remove());
        return cleanText(clone.innerText);
      })
      .join("|");
  }

  window.BroncoSort.adapters["cpp-schedule-builder"] = {
    id: "cpp-schedule-builder",
    pageType: "schedule-builder",
    ratingRenderer: {
      ratingTag: "div",
      ratingClass: "broncosort-rating--schedule",
      starSize: "17px",
    },
    matchesPage(context) {
      const doc = context.currentDocument || document;

      return (
        context.school.id === "cpp" &&
        window.location.href.includes("select-sections") &&
        getRows(doc).length > 0
      );
    },
    getTargetDocument(context) {
      return context?.currentDocument || document;
    },
    collectCourses,
    getProfessorElements(doc) {
      return getRows(doc)
        .map((row) => getInstructorElement(row, getInstructorFromRow(row)))
        .filter(Boolean);
    },
    insertRating({ option, ratingElement }) {
      option.instrEl.appendChild(ratingElement);
    },
    canReorderOptions: true,
    reorderCourse(course) {
      const parent = course.options[0]?.block?.parentElement;

      if (!parent) return;

      course.options.forEach((option, index) => {
        parent.insertBefore(option.block, parent.children[index] || null);
      });
    },
    getChangeSignature,
    isReady(doc) {
      return getRows(doc).length > 0;
    },
  };
})();
