// src/core/courseProcessor.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.core = window.BroncoSort.core || {};

  function buildNormalizedRatingsMap(ratingsByName) {
    const normalize =
      window.BroncoSort.core.professorNames.normalizeProfessorName;
    const normalizedMap = new Map();

    Object.entries(ratingsByName || {}).forEach(([name, ratingInfo]) => {
      const possibleNames = [name, ratingInfo?.profName, ratingInfo?.name].filter(
        Boolean,
      );

      possibleNames.forEach((possibleName) => {
        const key = normalize(possibleName);

        if (key && !normalizedMap.has(key)) {
          normalizedMap.set(key, ratingInfo);
        }
      });
    });

    return normalizedMap;
  }

  function getRatingForOption(option, normalizedRatings) {
    const normalize =
      window.BroncoSort.core.professorNames.normalizeProfessorName;

    return normalizedRatings.get(normalize(option.name));
  }

  function getOptionRating(option, normalizedRatings) {
    return Number(getRatingForOption(option, normalizedRatings)?.rating || 0);
  }

  async function processCourses({ school, adapter, context }) {
    const doc = adapter.getTargetDocument(context);

    if (!doc) return { courses: [], professorNames: [] };

    await window.BroncoSort.core.styleLoader.injectStyles(doc);

    const courses = adapter.collectCourses(doc, context);
    const professorNames =
      window.BroncoSort.core.professorNames.getUniqueProfessorNames(courses);

    if (!professorNames.length) {
      return { courses, professorNames };
    }

    const ratingsByName =
      await window.BroncoSort.core.ratingsApi.fetchProfessorRatings({
        school: school.apiSchoolName,
        professors: professorNames,
      });

    const normalizedRatings = buildNormalizedRatingsMap(ratingsByName);

    courses.forEach((course) => {
      course.options.sort((a, b) => {
        return (
          getOptionRating(b, normalizedRatings) -
          getOptionRating(a, normalizedRatings)
        );
      });

      course.options.forEach((option) => {
        const ratingInfo = getRatingForOption(option, normalizedRatings);

        window.BroncoSort.core.ratingRenderer.renderRating({
          option,
          ratingInfo,
          adapter,
          doc,
          context,
        });
      });

      if (
        adapter.canReorderOptions &&
        typeof adapter.reorderCourse === "function"
      ) {
        adapter.reorderCourse(course, context);
      }
    });

    if (typeof adapter.reorderCourses === "function") {
      adapter.reorderCourses({
        courses,
        ratingsByName,
        normalizedRatings,
        context,
      });
    }

    return { courses, professorNames };
  }

  window.BroncoSort.core.courseProcessor = {
    buildNormalizedRatingsMap,
    getRatingForOption,
    processCourses,
  };
})();
