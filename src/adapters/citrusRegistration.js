// src/adapters/citrusRegistration.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.adapters = window.BroncoSort.adapters || {};

  const { cleanProfessorName, isRealProfessorName } =
    window.BroncoSort.core.professorNames;

  function collectCourses(doc) {
    const rows = Array.from(doc.querySelectorAll("#table1 tbody tr"));

    return rows
      .map((row, originalIndex) => {
        const courseTitle =
          row
            .querySelector('td[data-property="courseTitle"]')
            ?.textContent.trim() || "Unknown course";
        const department =
          row
            .querySelector('td[data-property="subjectDescription"]')
            ?.textContent.trim() || null;
        const instructorLinks = Array.from(
          row.querySelectorAll('td[data-property="instructor"] a.email'),
        );

        const options = instructorLinks
          .map((instrEl) => {
            const name = cleanProfessorName(instrEl.textContent || "");

            return {
              name,
              block: row,
              instrEl,
              department,
            };
          })
          .filter((option) => option.name && isRealProfessorName(option.name));

        return {
          courseBox: row,
          courseTitle,
          options,
          originalIndex,
        };
      })
      .filter((course) => course.options.length > 0);
  }

  function getInstructorElements(doc) {
    return Array.from(
      doc.querySelectorAll('td[data-property="instructor"] a.email'),
    );
  }

  function getStableRowId(row, course) {
    const crn =
      row.querySelector('td[data-property="courseReferenceNumber"]')?.textContent;
    const section =
      row.querySelector('td[data-property="sequenceNumber"]')?.textContent;
    const courseNumber =
      row.querySelector('td[data-property="courseNumber"]')?.textContent;

    return (
      row.dataset.crn ||
      row.getAttribute("data-id") ||
      row.id ||
      [course.courseTitle, courseNumber, section, crn]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(":") ||
      course.courseTitle
    );
  }

  function getChangeSignature(doc) {
    return collectCourses(doc)
      .map((course) => {
        const row = course.courseBox;
        const stableRowId = getStableRowId(row, course);
        const professorNames = course.options
          .map((option) => cleanProfessorName(option.name))
          .filter(Boolean)
          .sort()
          .join(",");

        if (!stableRowId || !professorNames) return null;

        return `${stableRowId}:${professorNames}`;
      })
      .filter(Boolean)
      .sort()
      .join("|");
  }

  function getCourseSortData(course, normalizedRatings) {
    const normalize =
      window.BroncoSort.core.professorNames.normalizeProfessorName;
    const reviewedRatings = course.options
      .map((option) => {
        const ratingInfo = normalizedRatings.get(normalize(option.name));
        const rating = Number(ratingInfo?.rating);
        const numRatings = Number(ratingInfo?.numRatings || 0);

        if (!Number.isFinite(rating) || numRatings <= 0) {
          return null;
        }

        return rating;
      })
      .filter((rating) => rating !== null);

    if (reviewedRatings.length === 0) {
      return {
        hasReviewedRating: false,
        score: 0,
      };
    }

    return {
      hasReviewedRating: true,
      score:
        reviewedRatings.reduce((total, rating) => total + rating, 0) /
        reviewedRatings.length,
    };
  }

  function getCourseRatingScore(course, normalizedRatings) {
    const sortData = getCourseSortData(course, normalizedRatings);
    return sortData.hasReviewedRating ? sortData.score : -1;
  }

  window.BroncoSort.adapters["citrus-registration"] = {
    id: "citrus-registration",
    pageType: "course-search",
    ratingRenderer: {
      ratingTag: "span",
      ratingClass: "broncosort-rating--inline",
      starSize: "14px",
    },
    matchesPage(context) {
      const doc = context.currentDocument || document;

      return (
        context.school.id === "citrus" &&
        Boolean(doc.querySelector("#table1 tbody tr"))
      );
    },
    getTargetDocument(context) {
      return context?.currentDocument || document;
    },
    collectCourses,
    getProfessorElements: getInstructorElements,
    insertRating({ option, ratingElement }) {
      option.instrEl.insertAdjacentElement("afterend", ratingElement);
    },
    canReorderOptions: false,
    reorderCourses({ courses, normalizedRatings }) {
      if (!courses.length) return;

      const tbody = courses[0].courseBox?.parentElement;

      if (!tbody) return;

      const sortedCourses = courses
        .map((course, originalIndex) => ({
          course,
          originalIndex,
          ...getCourseSortData(course, normalizedRatings),
        }))
        .sort((a, b) => {
          if (a.hasReviewedRating !== b.hasReviewedRating) {
            return a.hasReviewedRating ? -1 : 1;
          }

          if (a.hasReviewedRating && b.hasReviewedRating) {
            const ratingDifference = b.score - a.score;

            if (ratingDifference !== 0) {
              return ratingDifference;
            }
          }

          return a.originalIndex - b.originalIndex;
        });

      sortedCourses.forEach(({ course }) => {
        tbody.appendChild(course.courseBox);
      });
    },
    getCourseSortData,
    getCourseRatingScore,
    getChangeSignature,
    isReady(doc) {
      return getInstructorElements(doc).length > 0;
    },
  };
})();
