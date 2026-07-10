const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = global;
global.location = {
  href: "https://cmsweb.cms.cpp.edu/psp/example",
  hostname: "cmsweb.cms.cpp.edu",
};
global.document = {
  querySelector() {
    return null;
  },
};
global.chrome = {
  runtime: {
    getURL(filePath) {
      return path.join(root, filePath);
    },
    onMessage: {
      addListener() {},
    },
  },
};

function loadScript(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInThisContext(source, { filename: relativePath });
}

[
  "src/config/schools.js",
  "src/core/professorNames.js",
  "src/core/courseProcessor.js",
  "src/core/professorPopup.js",
  "src/core/ratingRenderer.js",
  "src/adapters/cppPeopleSoft.js",
  "src/adapters/cppScheduleBuilder.js",
  "src/adapters/citrusRegistration.js",
].forEach(loadScript);

class FakeElement {
  constructor({
    tagName = "div",
    id = "",
    className = "",
    role = "",
    dataProperty = "",
    text = "",
    children = [],
  } = {}) {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = className;
    this.role = role;
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.eventHandlers = {};
    this.children = [];
    this.parentElement = null;
    this.textContent = text;
    this.innerText = text;

    if (dataProperty) {
      this.dataset.property = dataProperty;
      this.attributes["data-property"] = dataProperty;
    }

    children.forEach((child) => this.appendChild(child));
  }

  appendChild(child) {
    if (child && typeof child === "object") {
      if (child.parentElement) {
        child.parentElement.children = child.parentElement.children.filter(
          (existingChild) => existingChild !== child,
        );
      }
      child.parentElement = this;
    }
    this.children.push(child);
    return child;
  }

  insertAdjacentElement(position, element) {
    const parent = this.parentElement;

    if (!parent || position !== "afterend") {
      return this.appendChild(element);
    }

    const index = parent.children.indexOf(this);
    element.parentElement = parent;
    parent.children.splice(index + 1, 0, element);
    return element;
  }

  remove() {
    const parent = this.parentElement;

    if (!parent) return;

    parent.children = parent.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  addEventListener() {}

  dispatchEvent(event) {
    (this.eventHandlers[event.type] || []).forEach((handler) => handler(event));
  }

  addEventListener(type, handler) {
    this.eventHandlers[type] = this.eventHandlers[type] || [];
    this.eventHandlers[type].push(handler);
  }

  getBoundingClientRect() {
    return {
      top: 10,
      bottom: 20,
      left: 10,
      width: 20,
      height: 20,
    };
  }

  matches(selector) {
    return matchesSelector(this, selector);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];

    const visit = (element) => {
      if (matchesSelector(element, selector, this)) {
        matches.push(element);
      }

      (element.children || []).forEach(visit);
    };

    this.children.forEach(visit);
    return matches;
  }

  closest(selector) {
    let current = this;

    while (current) {
      if (matchesSelector(current, selector, this)) return current;
      current = current.parentElement;
    }

    return null;
  }

  cloneNode(deep) {
    return new FakeElement({
      tagName: this.tagName,
      id: this.id,
      className: this.className,
      role: this.role,
      dataProperty: this.dataset.property,
      text: this.innerText,
      children: deep ? this.children.map((child) => child.cloneNode(true)) : [],
    });
  }
}

function matchesSelector(element, selector) {
  if (!element || typeof element !== "object") return false;

  if (selector === "#table1 tbody tr") {
    return element.tagName === "TR" && element.parentElement?.tagName === "TBODY";
  }

  if (selector === 'td[data-property="instructor"] a.email') {
    return (
      element.tagName === "A" &&
      element.className.split(" ").includes("email") &&
      element.parentElement?.dataset.property === "instructor"
    );
  }

  const dataPropertyMatch = selector.match(/^td\[data-property="([^"]+)"\]$/);
  if (dataPropertyMatch) {
    return (
      element.tagName === "TD" &&
      element.dataset.property === dataPropertyMatch[1]
    );
  }

  if (selector === '[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]') {
    return element.id.startsWith("win0divSSR_CLSRSLT_WRK_GROUPBOX2$");
  }

  if (selector === '[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX3$"]') {
    return element.id.startsWith("win0divSSR_CLSRSLT_WRK_GROUPBOX3$");
  }

  if (selector === '[id^="MTG_INSTR"]') {
    return element.id.startsWith("MTG_INSTR");
  }

  if (selector === ".broncosort-rating") {
    return String(element.className || "")
      .split(" ")
      .includes("broncosort-rating");
  }

  if (selector === ".bs-prof-popup") {
    return String(element.className || "").split(" ").includes("bs-prof-popup");
  }

  if (selector === ".cx-MuiExpansionPanelSummary-root") {
    return String(element.className || "")
      .split(" ")
      .includes("cx-MuiExpansionPanelSummary-root");
  }

  if (selector === '[role="cell"]') {
    return element.role === "cell";
  }

  if (selector === ".cx-MuiGrid-item") {
    return String(element.className || "")
      .split(" ")
      .includes("cx-MuiGrid-item");
  }

  return false;
}

function makeCitrusDocument() {
  const row = new FakeElement({
    tagName: "tr",
    children: [
      new FakeElement({
        tagName: "td",
        dataProperty: "courseTitle",
        text: "Human Genetics",
      }),
      new FakeElement({
        tagName: "td",
        dataProperty: "subjectDescription",
        text: "Biology",
      }),
      new FakeElement({
        tagName: "td",
        dataProperty: "instructor",
        children: [
          new FakeElement({
            tagName: "a",
            className: "email",
            text: "Harker, Kathy (She/Her)",
          }),
        ],
      }),
    ],
  });

  return new FakeElement({
    children: [
      new FakeElement({
        tagName: "table",
        id: "table1",
        children: [new FakeElement({ tagName: "tbody", children: [row] })],
      }),
    ],
  });
}

function makeCitrusSortingDocument() {
  function makeCourseRow(title, instructors) {
    return new FakeElement({
      tagName: "tr",
      children: [
        new FakeElement({
          tagName: "td",
          dataProperty: "courseTitle",
          text: title,
        }),
        new FakeElement({
          tagName: "td",
          dataProperty: "subjectDescription",
          text: "Biology",
        }),
        new FakeElement({
          tagName: "td",
          dataProperty: "instructor",
          children: instructors.map(
            (instructor) =>
              new FakeElement({
              tagName: "a",
              className: "email",
              text: instructor,
            }),
          ),
        }),
      ],
    });
  }

  const lowRatedRow = makeCourseRow("Low Rated Course", ["Low Rated"]);
  const helperRow = new FakeElement({ tagName: "tr", text: "Pagination" });
  const highRatedRow = makeCourseRow("High Rated Course", ["High Rated"]);
  const tbody = new FakeElement({
    tagName: "tbody",
    children: [lowRatedRow, helperRow, highRatedRow],
  });

  return {
    doc: new FakeElement({
      children: [
        new FakeElement({
          tagName: "table",
          id: "table1",
          children: [tbody],
        }),
      ],
    }),
    tbody,
    lowRatedRow,
    helperRow,
    highRatedRow,
  };
}

function makeCitrusSortingScenario(rows) {
  function makeCourseRow(title, instructors) {
    return new FakeElement({
      tagName: "tr",
      children: [
        new FakeElement({
          tagName: "td",
          dataProperty: "courseTitle",
          text: title,
        }),
        new FakeElement({
          tagName: "td",
          dataProperty: "subjectDescription",
          text: "Biology",
        }),
        new FakeElement({
          tagName: "td",
          dataProperty: "instructor",
          children: instructors.map(
            (instructor) =>
              new FakeElement({
                tagName: "a",
                className: "email",
                text: instructor,
              }),
          ),
        }),
      ],
    });
  }

  const courseRows = rows.map((row) => makeCourseRow(row.title, row.instructors));
  const tbody = new FakeElement({
    tagName: "tbody",
    children: courseRows,
  });
  const doc = new FakeElement({
    children: [
      new FakeElement({
        tagName: "table",
        id: "table1",
        children: [tbody],
      }),
    ],
  });

  return { doc, tbody, courseRows };
}

function makeMultiProfessorCitrusDocument() {
  const row = new FakeElement({
    tagName: "tr",
    children: [
      new FakeElement({
        tagName: "td",
        dataProperty: "courseTitle",
        text: "Team Taught Biology",
      }),
      new FakeElement({
        tagName: "td",
        dataProperty: "subjectDescription",
        text: "Biology",
      }),
      new FakeElement({
        tagName: "td",
        dataProperty: "instructor",
        children: [
          new FakeElement({
            tagName: "a",
            className: "email",
            text: "Smith, Jane",
          }),
          new FakeElement({
            tagName: "a",
            className: "email",
            text: "Doe, John",
          }),
        ],
      }),
    ],
  });

  return new FakeElement({
    children: [
      new FakeElement({
        tagName: "table",
        id: "table1",
        children: [new FakeElement({ tagName: "tbody", children: [row] })],
      }),
    ],
  });
}

function makeCppDocument() {
  const instr = new FakeElement({
    tagName: "span",
    id: "MTG_INSTR$0",
    text: "John Smith John Smith",
  });
  const block = new FakeElement({
    id: "win0divSSR_CLSRSLT_WRK_GROUPBOX3$0",
    children: [instr],
  });
  const course = new FakeElement({
    id: "win0divSSR_CLSRSLT_WRK_GROUPBOX2$0",
    text: "CS 2400 - Data Structures",
    children: [block],
  });

  return new FakeElement({ children: [course] });
}

function makeScheduleDocument() {
  const row = new FakeElement({
    className: "cx-MuiExpansionPanelSummary-root",
    children: [
      new FakeElement({
        role: "cell",
        text: "Online\nJane Doe",
      }),
    ],
  });

  return new FakeElement({
    children: [
      new FakeElement({
        className: "cx-MuiGrid-item",
        children: [row],
      }),
    ],
  });
}

const names = window.BroncoSort.core.professorNames;

assert.strictEqual(
  names.cleanProfessorName("Harker, Kathy (She/Her)"),
  "Kathy Harker",
);
assert.strictEqual(names.cleanProfessorName("John Smith John Smith"), "John Smith");
assert.strictEqual(names.normalizeProfessorName("Jose Alvarez"), "jose alvarez");
assert.strictEqual(names.isRealProfessorName("TBA"), false);
assert.strictEqual(names.isRealProfessorName("Instructor TBA"), false);
assert.strictEqual(names.isRealProfessorName("Jane Doe"), true);

const citrusAdapter = window.BroncoSort.adapters["citrus-registration"];
const citrusCourses = citrusAdapter.collectCourses(makeCitrusDocument(), {});
assert.strictEqual(citrusCourses.length, 1);
assert.strictEqual(citrusCourses[0].courseTitle, "Human Genetics");
assert.strictEqual(citrusCourses[0].options[0].name, "Kathy Harker");
assert.strictEqual(citrusCourses[0].options[0].department, "Biology");
assert.strictEqual(
  citrusAdapter.getChangeSignature(makeCitrusDocument(), {}),
  "Human Genetics:Kathy Harker",
);

const multiProfessorCourses = citrusAdapter.collectCourses(
  makeMultiProfessorCitrusDocument(),
  {},
);
assert.deepStrictEqual(
  multiProfessorCourses[0].options.map((option) => option.name),
  ["Jane Smith", "John Doe"],
);

const normalizedRatings =
  window.BroncoSort.core.courseProcessor.buildNormalizedRatingsMap({
    "Smith, Jane": {
      found: true,
      profName: "Jane Smith",
      rating: 4.8,
      numRatings: 10,
    },
    "John Doe": {
      found: true,
      profName: "John Doe",
      rating: 3.2,
      numRatings: 5,
    },
  });

assert.strictEqual(
  window.BroncoSort.core.courseProcessor.getRatingForOption(
    multiProfessorCourses[0].options[0],
    normalizedRatings,
  ).rating,
  4.8,
);
assert.strictEqual(
  window.BroncoSort.core.courseProcessor.getRatingForOption(
    { name: "Unmatched Professor" },
    normalizedRatings,
  ),
  undefined,
);
assert.strictEqual(
  citrusAdapter.getCourseRatingScore(multiProfessorCourses[0], normalizedRatings),
  4,
);
assert.deepStrictEqual(
  citrusAdapter.getCourseSortData(multiProfessorCourses[0], normalizedRatings),
  {
    hasReviewedRating: true,
    score: 4,
  },
);

const oneReviewedMap =
  window.BroncoSort.core.courseProcessor.buildNormalizedRatingsMap({
    "Jane Smith": { found: true, rating: 4.8, numRatings: 10 },
  });
assert.strictEqual(
  citrusAdapter.getCourseRatingScore(multiProfessorCourses[0], oneReviewedMap),
  4.8,
);
assert.strictEqual(
  citrusAdapter.getCourseRatingScore(
    multiProfessorCourses[0],
    new Map(),
  ),
  -1,
);
assert.deepStrictEqual(
  citrusAdapter.getCourseSortData(multiProfessorCourses[0], new Map()),
  {
    hasReviewedRating: false,
    score: 0,
  },
);

const citrusSorting = makeCitrusSortingDocument();
const citrusSignatureBeforeSort = citrusAdapter.getChangeSignature(
  citrusSorting.doc,
  {},
);
const citrusSortingCourses = citrusAdapter.collectCourses(citrusSorting.doc, {});
citrusAdapter.reorderCourses({
  courses: citrusSortingCourses,
  normalizedRatings:
    window.BroncoSort.core.courseProcessor.buildNormalizedRatingsMap({
    "Low Rated": { rating: 1.5, numRatings: 3 },
    "High Rated": { rating: 4.9, numRatings: 8 },
    }),
});
assert.deepStrictEqual(citrusSorting.tbody.children, [
  citrusSorting.helperRow,
  citrusSorting.highRatedRow,
  citrusSorting.lowRatedRow,
]);
assert.strictEqual(
  citrusAdapter.getChangeSignature(citrusSorting.doc, {}),
  citrusSignatureBeforeSort,
);

const reviewedFirstScenario = makeCitrusSortingScenario([
  { title: "Not Found Course", instructors: ["Missing Professor"] },
  { title: "No Reviews Course", instructors: ["No Reviews"] },
  { title: "High Course", instructors: ["High Rated"] },
  { title: "Low Course", instructors: ["Low Rated"] },
]);
const reviewedFirstCourses = citrusAdapter.collectCourses(
  reviewedFirstScenario.doc,
  {},
);
citrusAdapter.reorderCourses({
  courses: reviewedFirstCourses,
  normalizedRatings:
    window.BroncoSort.core.courseProcessor.buildNormalizedRatingsMap({
      "Missing Professor": { found: false, rating: 0, numRatings: 0 },
      "No Reviews": { found: true, rating: 5, numRatings: 0 },
      "High Rated": { found: true, rating: 4.8, numRatings: 10 },
      "Low Rated": { found: true, rating: 3.2, numRatings: 8 },
    }),
});
assert.deepStrictEqual(reviewedFirstScenario.tbody.children, [
  reviewedFirstScenario.courseRows[2],
  reviewedFirstScenario.courseRows[3],
  reviewedFirstScenario.courseRows[0],
  reviewedFirstScenario.courseRows[1],
]);

const equalScoreScenario = makeCitrusSortingScenario([
  { title: "First Equal", instructors: ["Equal One"] },
  { title: "Second Equal", instructors: ["Equal Two"] },
  { title: "Unmatched", instructors: ["Unmatched"] },
]);
const equalScoreCourses = citrusAdapter.collectCourses(equalScoreScenario.doc, {});
citrusAdapter.reorderCourses({
  courses: equalScoreCourses,
  normalizedRatings:
    window.BroncoSort.core.courseProcessor.buildNormalizedRatingsMap({
      "Equal One": { found: true, rating: 4.5, numRatings: 12 },
      "Equal Two": { found: true, rating: 4.5, numRatings: 9 },
    }),
});
assert.deepStrictEqual(equalScoreScenario.tbody.children, [
  equalScoreScenario.courseRows[0],
  equalScoreScenario.courseRows[1],
  equalScoreScenario.courseRows[2],
]);

const cppAdapter = window.BroncoSort.adapters["cpp-peoplesoft"];
const cppCourses = cppAdapter.collectCourses(makeCppDocument(), {});
assert.strictEqual(cppCourses.length, 1);
assert.strictEqual(cppCourses[0].courseTitle, "CS 2400 - Data Structures");
assert.strictEqual(cppCourses[0].options[0].name, "John Smith");
assert.strictEqual(
  cppAdapter.matchesPage({
    school: { id: "cpp" },
    currentDocument: new FakeElement(),
  }),
  false,
);
assert.strictEqual(
  cppAdapter.matchesPage({
    school: { id: "cpp" },
    currentDocument: makeCppDocument(),
  }),
  true,
);
assert.strictEqual(
  cppAdapter.getChangeSignature(makeCppDocument(), {}),
  "win0divSSR_CLSRSLT_WRK_GROUPBOX3$0:John Smith",
);

const scheduleAdapter = window.BroncoSort.adapters["cpp-schedule-builder"];
const scheduleCourses = scheduleAdapter.collectCourses(makeScheduleDocument(), {});
assert.strictEqual(scheduleCourses.length, 1);
assert.strictEqual(scheduleCourses[0].options[0].name, "Jane Doe");
assert.strictEqual(
  citrusAdapter.matchesPage({
    school: { id: "citrus" },
    currentDocument: makeCitrusDocument(),
  }),
  true,
);

const doc = {
  createElement(tagName) {
    return new FakeElement({ tagName });
  },
  createDocumentFragment() {
    return {
      children: [],
      append(...items) {
        this.children.push(...items);
      },
    };
  },
};
const parent = new FakeElement();
const instrEl = new FakeElement({ text: "Jane Doe" });
parent.appendChild(instrEl);
const option = { name: "Jane Doe", instrEl, block: parent };

window.BroncoSort.core.ratingRenderer.renderRating({
  option,
  ratingInfo: { found: true, rating: 4.5, numRatings: 12 },
  adapter: {
    ratingRenderer: { ratingTag: "span" },
    insertRating({ option: opt, ratingElement }) {
      opt.instrEl.insertAdjacentElement("afterend", ratingElement);
    },
  },
  doc,
  context: {},
});
window.BroncoSort.core.ratingRenderer.renderRating({
  option,
  ratingInfo: { found: true, rating: 4.6, numRatings: 13 },
  adapter: {
    ratingRenderer: { ratingTag: "span" },
    insertRating({ option: opt, ratingElement }) {
      opt.instrEl.insertAdjacentElement("afterend", ratingElement);
    },
  },
  doc,
  context: {},
});

assert.strictEqual(parent.querySelectorAll(".broncosort-rating").length, 1);

const multiDoc = {
  createElement(tagName) {
    return new FakeElement({ tagName });
  },
  createDocumentFragment() {
    return {
      children: [],
      append(...items) {
        this.children.push(...items);
      },
    };
  },
};
const instructorCell = new FakeElement({
  tagName: "td",
  dataProperty: "instructor",
});
const janeLink = new FakeElement({
  tagName: "a",
  className: "email",
  text: "Smith, Jane",
});
const johnLink = new FakeElement({
  tagName: "a",
  className: "email",
  text: "Doe, John",
});
instructorCell.appendChild(janeLink);
instructorCell.appendChild(johnLink);

const multiRenderAdapter = {
  ratingRenderer: {
    ratingTag: "span",
  },
  insertRating({ option: opt, ratingElement }) {
    opt.instrEl.insertAdjacentElement("afterend", ratingElement);
  },
};

window.BroncoSort.core.ratingRenderer.renderRating({
  option: { name: "Jane Smith", instrEl: janeLink, block: instructorCell },
  ratingInfo: { found: true, rating: 4.8, numRatings: 10 },
  adapter: multiRenderAdapter,
  doc: multiDoc,
  context: {},
});
window.BroncoSort.core.ratingRenderer.renderRating({
  option: { name: "John Doe", instrEl: johnLink, block: instructorCell },
  ratingInfo: { found: true, rating: 3.2, numRatings: 5 },
  adapter: multiRenderAdapter,
  doc: multiDoc,
  context: {},
});
assert.strictEqual(
  instructorCell.querySelectorAll(".broncosort-rating").length,
  2,
);
window.BroncoSort.core.ratingRenderer.renderRating({
  option: { name: "Jane Smith", instrEl: janeLink, block: instructorCell },
  ratingInfo: { found: true, rating: 4.9, numRatings: 11 },
  adapter: multiRenderAdapter,
  doc: multiDoc,
  context: {},
});
assert.strictEqual(
  instructorCell.querySelectorAll(".broncosort-rating").length,
  2,
);

let popupOpenCount = 0;
const originalShowProfessorPopup =
  window.BroncoSort.core.professorPopup.showProfessorPopup;
window.BroncoSort.core.professorPopup.showProfessorPopup = () => {
  popupOpenCount += 1;
};
const hoverRating = parent.querySelector(".broncosort-rating");
hoverRating.dispatchEvent({ type: "pointerenter", currentTarget: hoverRating });
assert.strictEqual(popupOpenCount, 1);
window.BroncoSort.core.professorPopup.showProfessorPopup =
  originalShowProfessorPopup;

console.log("BroncoSort focused tests passed.");
