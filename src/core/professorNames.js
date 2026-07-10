// src/core/professorNames.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.core = window.BroncoSort.core || {};

  const invalidNames = new Set([
    "",
    "-",
    "none",
    "to be announced",
    "tba",
    "staff",
    "instructor tba",
    "unknown",
  ]);

  function collapseWhitespace(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function removePronouns(value) {
    return value.replace(/\s*\([^)]*\/[^)]*\)\s*/g, " ").trim();
  }

  function convertLastFirst(value) {
    if (!value.includes(",")) return value;

    const [lastName, ...firstParts] = value.split(",");
    const firstName = firstParts.join(" ").trim();
    const last = lastName.trim();

    return firstName && last ? `${firstName} ${last}` : value;
  }

  function removeRepeatedFullName(value) {
    const parts = value.split(" ").filter(Boolean);

    if (parts.length % 2 !== 0) return value;

    const half = parts.length / 2;
    const first = parts.slice(0, half).join(" ");
    const second = parts.slice(half).join(" ");

    return first === second ? first : value;
  }

  function cleanProfessorName(rawName) {
    let name = collapseWhitespace(rawName);
    name = removePronouns(name);
    name = convertLastFirst(name);
    name = collapseWhitespace(name);
    name = removeRepeatedFullName(name);
    return collapseWhitespace(name);
  }

  function normalizeProfessorName(rawName) {
    return cleanProfessorName(rawName)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/-/g, " ")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isRealProfessorName(rawName) {
    const cleaned = cleanProfessorName(rawName).toLowerCase();
    return !invalidNames.has(cleaned);
  }

  function getUniqueProfessorNames(courses) {
    const names = courses.flatMap((course) =>
      course.options.map((option) => cleanProfessorName(option.name)),
    );

    return [...new Set(names.filter(isRealProfessorName))].sort();
  }

  window.BroncoSort.core.professorNames = {
    cleanProfessorName,
    normalizeProfessorName,
    isRealProfessorName,
    getUniqueProfessorNames,
  };
})();
