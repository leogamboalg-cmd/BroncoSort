# BroncoSort `src/` Folder Guide

This document explains the production Chrome extension code in `src/`: what each folder is for, what each file does, how the files are loaded, and where to make changes when adding or debugging features.

BroncoSort currently uses a no-build Manifest V3 architecture. There are no ES module imports in the content scripts. Instead, files are loaded in a fixed order from `manifest.json` and attach their public functions to the shared `window.BroncoSort` namespace.

## High-Level Layout

```text
src/
├── background.js
├── bootstrap.js
├── content.css
├── content.js
├── scheduleBuilder.js
├── adapters/
│   ├── citrusRegistration.js
│   ├── cppPeopleSoft.js
│   └── cppScheduleBuilder.js
├── config/
│   └── schools.js
├── core/
│   ├── courseProcessor.js
│   ├── observer.js
│   ├── pageContext.js
│   ├── professorNames.js
│   ├── professorPopup.js
│   ├── ratingRenderer.js
│   ├── ratingsApi.js
│   ├── schoolRequest.js
│   └── styleLoader.js
├── popup/
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
└── styles/
    └── content.css
```

## Runtime Model

The extension has three main runtime surfaces:

1. The content-script pipeline that runs on supported school pages.
2. The extension popup UI that opens from the browser toolbar.
3. The background service worker.

The content-script pipeline is the largest part. It detects the current school, selects the correct adapter for the page, extracts course/professor data, fetches RateMyProfessors ratings through the BroncoSort backend, renders ratings, shows professor popups, and watches the page for changes.

The popup UI is separate from the course-rating pipeline. It lets the user search for a school and submit a sanitized school request from the active tab.

The background service worker currently handles extension update behavior.

## Script Loading Order

`manifest.json` controls the order of content scripts. This order matters because files communicate through globals, not imports.

Current content-script order:

```text
src/config/schools.js
src/core/professorNames.js
src/core/ratingsApi.js
src/core/professorPopup.js
src/core/ratingRenderer.js
src/core/styleLoader.js
src/core/observer.js
src/core/pageContext.js
src/core/courseProcessor.js
src/core/schoolRequest.js
src/adapters/cppPeopleSoft.js
src/adapters/cppScheduleBuilder.js
src/adapters/citrusRegistration.js
src/bootstrap.js
```

The basic dependency rule is:

- Config loads first.
- Shared core modules load before anything that uses them.
- Adapters load after core modules.
- `bootstrap.js` loads last because it starts the runtime.

If a new adapter file is added, it must be listed before `src/bootstrap.js`.

## Shared Namespace

Most production files start by creating or reusing:

```js
window.BroncoSort = window.BroncoSort || {};
```

Core modules attach to:

```js
window.BroncoSort.core
```

School configuration attaches to:

```js
window.BroncoSort.config
```

Adapters attach to:

```js
window.BroncoSort.adapters
```

This keeps the no-build setup simple, but it also means load order is part of the architecture.

## Root Files

### `src/bootstrap.js`

`bootstrap.js` is the production content-script entry point. It runs after all config, core, and adapter scripts have loaded.

Responsibilities:

- Prevent duplicate startup with `window.__BRONCOSORT_BOOTSTRAPPED__`.
- Create the page context through `core.pageContext.createPageContext()`.
- Wait for a matching adapter.
- Wait for the adapter's target document to be ready.
- Wake the backend health endpoint.
- Call the shared course processor.
- Start either a polling watcher or a mutation observer, depending on the selected adapter.
- Install the request-school message listener.
- Close professor popups when the page scrolls.

Important behavior:

- Unsupported schools exit quietly because `createPageContext()` returns `null`.
- Unsupported pages exit quietly because no adapter matches.
- Only one watcher is kept active for the selected adapter.
- `bootstrap.js` does not know CPP, Citrus, or platform-specific selectors directly. Those belong in adapters.

Where to change it:

- Change this file when the extension startup flow changes.
- Do not add school-specific selectors here.
- Do not fetch ratings directly here.

### `src/background.js`

This is the Manifest V3 background service worker.

Current responsibility:

- On extension update, open the BroncoSort website in a new tab.

It does not participate in course extraction, rating fetching, popup rendering, or adapter selection.

### `src/content.js`

This file is a legacy CPP course-search implementation retained on disk but not loaded by `manifest.json`.

It contains older versions of:

- CPP PeopleSoft professor extraction.
- Backend rating requests.
- Professor-name cleanup.
- Rating insertion.
- Professor popup markup.
- Polling.
- CSS injection.
- Request-school sanitization.

The active implementation now lives in:

- `src/bootstrap.js`
- `src/core/`
- `src/adapters/cppPeopleSoft.js`

Important note:

- Do not edit this file for current production course-search behavior unless you intentionally decide to remove or migrate legacy code.
- If behavior differs between this file and the adapter pipeline, the adapter pipeline is what Chrome currently uses.

### `src/scheduleBuilder.js`

This file is a legacy CPP schedule-builder implementation retained on disk but not loaded by `manifest.json`.

It contains older versions of:

- CPP Schedule Builder row extraction.
- Rating requests.
- Rating rendering.
- Professor popup rendering.
- Schedule-card sorting.
- MutationObserver setup.
- CSS injection.

The active implementation now lives in:

- `src/bootstrap.js`
- `src/core/`
- `src/adapters/cppScheduleBuilder.js`

Important note:

- Do not edit this file for current production schedule-builder behavior unless intentionally removing or migrating legacy code.

### `src/content.css`

This is an older stylesheet containing a small fixed banner style:

```css
#cpp-professor-sorter-banner
```

It is separate from the active shared content stylesheet in `src/styles/content.css`.

Current production rating/popup styles are loaded from:

```text
src/styles/content.css
```

## `src/config/`

The `config` folder contains registry-style configuration. Its purpose is to keep school names, API names, supported domains, adapter IDs, and feature flags out of unrelated logic.

### `src/config/schools.js`

This file defines the central school registry.

Current registry entries:

- `cpp`
- `citrus`

Each school entry includes:

- `id`: internal stable school ID.
- `displayName`: human-readable school name.
- `apiSchoolName`: school name sent to the backend ratings endpoint.
- `domains`: hostnames that should map to this school.
- `adapters`: ordered adapter IDs the school can use.
- `features`: supported high-level extension features.

Exported namespace:

```js
window.BroncoSort.config = {
  schools,
  findSchoolByHostname,
};
```

Important functions:

- `hostnameMatchesDomain(hostname, domain)`: returns true for an exact domain or subdomain match.
- `findSchoolByHostname(hostname)`: finds the school entry for the current hostname.

Special fixture behavior:

- `localhost` and `127.0.0.1` can map to Citrus when the page contains:

```html
<meta name="broncosort-test-fixture" content="citrus-registration">
```

This is what allows the Citrus testing portal to exercise the production Citrus adapter locally.

Where to change it:

- Add schools here when they can reuse an existing adapter.
- Add domains here instead of hardcoding them in core modules.
- Keep `apiSchoolName` compatible with backend school names.

Example:

```js
{
  id: "new-school",
  displayName: "New School",
  apiSchoolName: "New School",
  domains: ["registration.newschool.edu"],
  adapters: ["citrus-registration"],
  features: {
    courseSearch: true,
    scheduleBuilder: false,
    sorting: false,
  },
}
```

A config-only school addition is valid only when the new school's DOM truly matches an existing adapter.

## `src/core/`

The `core` folder contains shared platform-independent logic. Core files should not contain page-specific selectors like PeopleSoft groupbox IDs or Citrus table column selectors.

Core owns:

- Professor-name cleanup and normalization.
- Backend API calls.
- Rating rendering.
- Popup rendering and positioning.
- Shared styles injection.
- Page watching.
- Page context creation.
- Course processing.
- Request-school sanitization.

Core should not own:

- School-specific DOM selectors.
- Portal-specific iframe selection.
- Platform-specific row/card extraction.
- Platform-specific rating placement.
- Platform-specific reordering rules.

### `src/core/professorNames.js`

This file is the shared professor-name utility module.

Exported namespace:

```js
window.BroncoSort.core.professorNames
```

Functions:

- `cleanProfessorName(rawName)`
- `normalizeProfessorName(rawName)`
- `isRealProfessorName(rawName)`
- `getUniqueProfessorNames(courses)`

What it handles:

- Extra whitespace.
- Pronouns in parenthesized slash format, such as `(he/him)`.
- `Last, First` conversion.
- Repeated full names.
- Accent-insensitive normalization.
- Hyphen/punctuation normalization for matching.
- Invalid instructor values.

Invalid values include:

- Empty string.
- `-`
- `none`
- `to be announced`
- `tba`
- `staff`
- `instructor tba`
- `unknown`

How it is used:

- Adapters call `cleanProfessorName()` and `isRealProfessorName()` while extracting instructors.
- The course processor calls `getUniqueProfessorNames()` before requesting ratings.
- The rating renderer and course processor use `normalizeProfessorName()` to match frontend names to backend rating keys.

Where to change it:

- Add new invalid-name cases here.
- Improve normalization here.
- Do not duplicate name-cleaning logic in adapters.

### `src/core/ratingsApi.js`

This file is the shared frontend API client for professor ratings.

Exported namespace:

```js
window.BroncoSort.core.ratingsApi
```

Exports:

- `API_BASE`
- `wakeServer()`
- `fetchProfessorRatings({ school, professors })`

Current API base behavior:

```js
const USE_LOCAL_API = true;
const API_BASE = USE_LOCAL_API
  ? "http://localhost:3000"
  : "https://broncosort.onrender.com";
```

`fetchProfessorRatings()` sends:

```json
{
  "school": "Cal Poly Pomona",
  "professors": ["Jane Doe"]
}
```

It expects:

```json
{
  "ratingsByName": {}
}
```

What it handles:

- Empty professor lists.
- Missing school names.
- Duplicate professor names.
- Request de-duplication for identical in-flight requests.
- JSON parsing errors.
- Non-OK HTTP responses.
- Returning only `ratingsByName` to callers.

Where to change it:

- Change backend URL handling here.
- Add auth headers here if the backend later needs them.
- Keep response compatibility unless the backend contract is deliberately migrated.

### `src/core/professorPopup.js`

This file implements the shared professor details popup.

Exported namespace:

```js
window.BroncoSort.core.professorPopup
```

Functions:

- `escapeHTML(value)`
- `getInitials(name)`
- `getStars(rating)`
- `showProfessorPopup({ professor, doc, anchorEl })`
- `closePopup(doc)`

What the popup displays:

- Professor initials.
- Professor name.
- Department.
- RMP label.
- Department ranking card.
- Rating.
- Difficulty.
- Take-again percentage.
- Review count.
- Star display.
- RMP profile link when an ID exists.
- Live-data footer.

What it handles:

- HTML escaping.
- Missing professor data.
- Not-found states.
- No-review states.
- Popup creation.
- Popup positioning relative to a rating element.
- Preventing the popup from overflowing the viewport horizontally.
- Hover-based close behavior.

How it is used:

- `ratingRenderer.js` attaches hover handlers to every rendered rating element.
- Those handlers call `showProfessorPopup()`.
- `bootstrap.js` calls `closePopup()` on scroll.

Where to change it:

- Change popup contents here.
- Change popup positioning here.
- Do not create separate popup implementations in adapters.

### `src/core/ratingRenderer.js`

This file renders the small rating element next to or under a professor name.

Exported namespace:

```js
window.BroncoSort.core.ratingRenderer
```

Functions:

- `renderRating({ option, ratingInfo, adapter, doc, context })`
- `removeExistingRating(option)`

Internal helpers:

- `createRatingText(doc, ratingInfo, options)`
- `createRatingElement({ option, ratingInfo, doc, rendererOptions })`
- `reconnectInstructorElement(option)`

What it handles:

- Creating the rating DOM element.
- Showing `Not found`.
- Showing `No reviews`.
- Showing star, rating, and review count when available.
- Wrapping ratings in a RateMyProfessors profile link when an ID exists.
- Adding professor identity to `dataset.professor` and `dataset.professorKey`.
- Preventing duplicate rating elements for the same professor.
- Attaching popup hover behavior.
- Reconnecting an instructor element after DOM reordering when possible.

Adapter-controlled options:

```js
ratingRenderer: {
  ratingTag: "span",
  ratingClass: "broncosort-rating--inline",
  starSize: "14px",
}
```

How placement works:

- The renderer creates the element.
- If the adapter defines `insertRating()`, the adapter decides where it goes.
- Otherwise the renderer inserts it after `option.instrEl`.

Where to change it:

- Change rating text behavior here.
- Change duplicate prevention here.
- Do not add portal-specific checks here; use adapter options or adapter insertion methods.

### `src/core/styleLoader.js`

This file injects shared content styles into the active target document.

Exported namespace:

```js
window.BroncoSort.core.styleLoader
```

Function:

- `injectStyles(doc)`

What it handles:

- Loading `src/styles/content.css`.
- Using an existing `link[data-broncosort-stylesheet]` when present.
- Using `chrome.runtime.getURL("src/styles/content.css")` inside the extension.
- Falling back to `"src/styles/content.css"` for local fixture environments.
- Caching CSS text.
- Tracking injected documents with a `WeakSet`.
- Avoiding duplicate `<style id="broncosort-styles">` elements.
- Injecting styles into iframe documents or normal page documents.

Manifest dependency:

`src/styles/content.css` is listed in `web_accessible_resources`, which allows the content script to fetch it through `chrome.runtime.getURL()`.

Where to change it:

- Change style-loading mechanics here.
- Keep actual CSS in `src/styles/content.css` when possible.

### `src/core/observer.js`

This file provides shared page-watching utilities.

Exported namespace:

```js
window.BroncoSort.core.observer
```

Functions:

- `watchDocument(...)`
- `watchWithMutationObserver(...)`
- `watchWithPolling(...)`
- `waitForDocument(...)`

`watchWithMutationObserver()`:

- Observes `childList`, `subtree`, and `characterData` changes.
- Debounces processing.
- Uses an adapter-provided signature to avoid repeated processing when meaningful content has not changed.
- Prevents overlapping runs.
- Returns an object with `disconnect()` and `check()`.

`watchWithPolling()`:

- Polls for pages where mutation observation is not reliable enough.
- Uses a signature to avoid repeated backend calls.
- Prevents overlapping runs.
- Returns an object with `disconnect()` and `check()`.

`waitForDocument()`:

- Polls briefly until an adapter's target document exists and passes `adapter.isReady()`.
- Returns `null` on timeout.

How adapters influence watching:

- `adapter.watchStrategy = "polling"` selects polling.
- Otherwise the bootstrap uses the mutation observer.
- `adapter.pollIntervalMs` controls polling interval.
- `adapter.debounceMs` controls mutation debounce.
- `adapter.getChangeSignature()` determines whether a page result set changed.

Where to change it:

- Change debounce/polling mechanics here.
- Do not put school-specific selectors here.

### `src/core/pageContext.js`

This file creates page context and selects adapters.

Exported namespace:

```js
window.BroncoSort.core.pageContext
```

Functions:

- `createPageContext()`
- `getAdapterForPage(context)`

`createPageContext()` returns:

```js
{
  school,
  hostname,
  url,
  currentDocument,
  isTopFrame,
  pageType,
}
```

What it handles:

- Reads the current hostname.
- Finds the matching school through `config.findSchoolByHostname()`.
- Detects whether the current script is running in the top frame.
- Returns `null` for unsupported hosts.

`getAdapterForPage(context)`:

- Reads the school entry's ordered `adapters` array.
- Looks up each adapter in `window.BroncoSort.adapters`.
- Calls `adapter.matchesPage(context)`.
- Returns the first matching adapter.
- Catches adapter matching errors so one bad adapter does not break all pages.

Where to change it:

- Change adapter selection strategy here.
- Keep page-specific matching logic inside adapters.

### `src/core/courseProcessor.js`

This file is the shared course processing pipeline.

Exported namespace:

```js
window.BroncoSort.core.courseProcessor
```

Functions:

- `buildNormalizedRatingsMap(ratingsByName)`
- `getRatingForOption(option, normalizedRatings)`
- `processCourses({ school, adapter, context })`

Pipeline flow:

1. Ask the adapter for the target document.
2. Inject shared styles into that document.
3. Ask the adapter to collect standardized courses.
4. Extract unique valid professor names.
5. Fetch ratings once for the batch.
6. Build a normalized ratings map.
7. Sort each course's options by rating.
8. Render ratings for each option.
9. Reorder options if `adapter.canReorderOptions` and `adapter.reorderCourse()` allow it.
10. Call `adapter.reorderCourses()` if the adapter supports page-level course sorting.

Standard course shape:

```js
{
  courseBox,
  courseTitle,
  options: [
    {
      name,
      block,
      instrEl,
      department,
    },
  ],
}
```

Important behavior:

- Ratings are requested once per page update, not once per row.
- Ratings are matched by normalized names, not raw text only.
- Rendering is delegated to the shared renderer.
- DOM collection and placement are delegated to adapters.
- Reordering happens only when the adapter explicitly opts in.

Where to change it:

- Change shared processing order here.
- Add shared result filtering here if it applies to every adapter.
- Do not add platform selectors here.

### `src/core/schoolRequest.js`

This file supports the extension popup's "Request My School" workflow.

Exported namespace:

```js
window.BroncoSort.core.schoolRequest
```

Functions:

- `sanitizeHTML(doc)`
- `runSchoolRequest(school)`
- `installMessageListener()`

What `sanitizeHTML()` does:

- Clones the current page HTML.
- Removes scripts, embeds, unsafe iframe content, and noscript tags.
- Removes hidden inputs.
- Strips form action/method.
- Removes input values and selected/checked state.
- Redacts common personal/account fields.
- Removes comments.
- Removes inline event handlers.
- Removes or redacts token/session/auth-like attributes.
- Redacts emails, long numeric IDs, PeopleSoft session tokens, and other known sensitive strings.

What `runSchoolRequest()` sends:

- Selected school object from the popup.
- Current page URL.
- Collection timestamp.
- Sanitized parent page HTML.

Endpoint:

```text
POST {API_BASE}/api/collect/store
```

What `installMessageListener()` does:

- Listens for popup messages with `action: "RUN_COLLECT_SCRIPT"`.
- Runs the request-school collection.
- Sends success or failure back to the popup.

Where to change it:

- Change request-school data collection here.
- Add new redaction rules here.
- Keep this separate from professor-rating extraction.

## `src/adapters/`

The `adapters` folder contains school/platform-specific DOM logic. Adapters convert very different registration pages into one standardized course shape for `core.courseProcessor`.

Adapters may:

- Detect whether they match the current page.
- Locate the target document.
- Find course rows, cards, sections, or blocks.
- Extract professor names.
- Extract course titles.
- Extract departments.
- Decide where a rating element should be inserted.
- Decide whether and how options can be safely reordered.
- Build a change signature for page watching.

Adapters should not:

- Fetch ratings.
- Render popup HTML.
- Render stars.
- Duplicate professor-name cleanup.
- Duplicate backend error handling.
- Inject large CSS strings.
- Contain unrelated school configuration.

### `src/adapters/cppPeopleSoft.js`

Adapter ID:

```text
cpp-peoplesoft
```

Purpose:

- Handles Cal Poly Pomona PeopleSoft course-search results.

Page type:

```text
course-search
```

Key selectors:

- Course boxes: `[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]`
- Section option blocks: `[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX3$"]`
- Instructor elements: `[id^="MTG_INSTR"]`

Main functions:

- `getTargetDocument(context)`: returns the current document.
- `getCourseTitle(courseBox)`: extracts the course title from course-box text.
- `collectCourses(doc)`: returns standardized course objects.
- `getChangeSignature(doc)`: creates a stable signature from option block IDs and professor names.
- `matchesPage(context)`: matches CPP course-search pages and avoids schedule-builder pages.
- `insertRating({ option, ratingElement })`: cleans the instructor element text and inserts a block rating after it.
- `reorderCourse(course)`: appends sorted option blocks within their parent.
- `isReady(doc)`: requires at least one instructor element.

Rating renderer options:

```js
ratingRenderer: {
  ratingTag: "div",
  ratingClass: "broncosort-rating--block",
  starSize: "30px",
}
```

Watching:

- Uses polling with a 2000ms interval.

Sorting behavior:

- `canReorderOptions` is true.
- Options within each course are sorted by rating and reordered in the DOM.

Where to change it:

- Change PeopleSoft course-search selectors here.
- Change PeopleSoft-specific rating placement here.
- Keep shared fetching/rendering logic out of this file.

### `src/adapters/cppScheduleBuilder.js`

Adapter ID:

```text
cpp-schedule-builder
```

Purpose:

- Handles Cal Poly Pomona Schedule Builder pages.

Page type:

```text
schedule-builder
```

Key selectors:

- Schedule rows: `.cx-MuiExpansionPanelSummary-root`
- Row cells: `[role="cell"]`
- Reorder block: closest `.cx-MuiGrid-item`

Main functions:

- `cleanText(text)`: collapses whitespace for schedule-builder row parsing.
- `isProfessorName(text)`: checks whether a text line looks like a real professor name.
- `getRows(doc)`: returns schedule-builder result rows.
- `getInstructorFromRow(row)`: finds the professor-looking text line.
- `getInstructorElement(row, instructor)`: finds the cell containing the instructor.
- `collectCourses(doc)`: returns one course-like group containing all schedule options.
- `getChangeSignature(doc)`: builds a signature from row text after removing existing ratings.
- `matchesPage(context)`: matches CPP `select-sections` pages with schedule rows.
- `insertRating({ option, ratingElement })`: appends the rating inside the instructor cell.
- `reorderCourse(course)`: reorders schedule cards inside their parent.
- `isReady(doc)`: requires schedule rows.

Rating renderer options:

```js
ratingRenderer: {
  ratingTag: "div",
  ratingClass: "broncosort-rating--schedule",
  starSize: "17px",
}
```

Sorting behavior:

- `canReorderOptions` is true.
- Schedule cards are sorted by rating.

Important detail:

- This adapter treats the schedule-builder result list as one standardized course group because the page structure is card-based rather than grouped like PeopleSoft course boxes.

Where to change it:

- Change Schedule Builder row/cell parsing here.
- Change card reordering behavior here.
- Keep popup and API logic in core.

### `src/adapters/citrusRegistration.js`

Adapter ID:

```text
citrus-registration
```

Purpose:

- Handles Citrus College registration table results.

Page type:

```text
course-search
```

Key selectors:

- Result rows: `#table1 tbody tr`
- Course title: `td[data-property="courseTitle"]`
- Department: `td[data-property="subjectDescription"]`
- Instructor links: `td[data-property="instructor"] a.email`
- CRN: `td[data-property="courseReferenceNumber"]`
- Section: `td[data-property="sequenceNumber"]`
- Course number: `td[data-property="courseNumber"]`

Main functions:

- `collectCourses(doc)`: extracts one standardized course per table row.
- `getInstructorElements(doc)`: returns instructor email links.
- `getStableRowId(row, course)`: builds a stable row identifier for signatures.
- `getChangeSignature(doc)`: builds a signature from stable row IDs and professor names.
- `getCourseSortData(course, normalizedRatings)`: computes course-level average reviewed rating.
- `getCourseRatingScore(course, normalizedRatings)`: returns a numeric score for tests or helpers.
- `matchesPage(context)`: matches Citrus pages with registration table rows.
- `insertRating({ option, ratingElement })`: inserts inline ratings after instructor links.
- `reorderCourses({ courses, normalizedRatings })`: sorts whole table rows by reviewed rating.
- `isReady(doc)`: requires instructor links.

Rating renderer options:

```js
ratingRenderer: {
  ratingTag: "span",
  ratingClass: "broncosort-rating--inline",
  starSize: "14px",
}
```

Sorting behavior:

- `canReorderOptions` is false because each row is not a set of alternate section blocks in the same way CPP is.
- The adapter does define `reorderCourses()`, which sorts table rows by average reviewed rating while keeping unrated rows after rated rows and preserving original order as a tiebreaker.

Fixture support:

- The local Citrus testing portal can map to the Citrus school registry entry when served on localhost and marked with the fixture meta tag.

Where to change it:

- Change Banner/SSB table selectors here.
- Change Citrus row sorting here.
- Do not let Citrus use CPP selectors.

## `src/styles/`

The `styles` folder contains shared CSS for content-script UI that is injected into supported school pages.

### `src/styles/content.css`

This is the active shared content stylesheet.

It styles:

- Base `.broncosort-rating` elements.
- RMP rating links.
- Rating stars.
- CPP block ratings.
- CPP schedule-builder ratings.
- Citrus inline ratings.
- Shared professor popup.
- Popup header, avatar, department label, RMP label.
- Department ranking card.
- Rating/difficulty/take-again stat cards.
- Review row.
- Popup RMP profile button.
- Popup footer.

Key classes:

- `.broncosort-rating`
- `.broncosort-rating-star`
- `.broncosort-rating--block`
- `.broncosort-rating--schedule`
- `.broncosort-rating--inline`
- `.bs-prof-popup`
- `.bs-popup-header`
- `.bs-popup-avatar`
- `.bs-popup-name`
- `.bs-rank-card`
- `.bs-popup-stats`
- `.bs-popup-button`

How it is loaded:

- `core.styleLoader.injectStyles(doc)` fetches this file and injects it as a `<style>` tag into the adapter's target document.
- This is necessary because some registration pages may use iframe documents.

Where to change it:

- Change shared rating and popup styling here.
- Add new adapter-specific rating layout classes here.
- Keep class names BroncoSort-specific to reduce host-page collisions.

## `src/popup/`

The `popup` folder contains the browser action popup. This is the UI shown when the user clicks the BroncoSort extension icon.

It is not the professor popup that appears on school pages. Professor popups are implemented by `src/core/professorPopup.js`.

### `src/popup/popup.html`

This is the popup document.

It includes:

- BroncoSort title.
- Website link.
- "How to request a school" link.
- School search input.
- Dropdown container.
- "Request My School" button.
- Explanatory request text.
- Warning text.
- `popup.css`.
- `popup.js`.

Important IDs/classes:

- `#schoolSearch`
- `#schoolDropdown`
- `#requestSchoolBtn`
- `.school-search-wrap`

Where to change it:

- Change popup structure here.
- Keep behavior in `popup.js`.
- Keep styling in `popup.css`.

### `src/popup/popup.js`

This file implements popup behavior.

Main responsibilities:

- Read the school search input.
- Debounce school search requests.
- Fetch matching schools from:

```text
https://broncosort.onrender.com/api/schools/search?q=...
```

- Render the school dropdown.
- Track the selected school.
- Send `RUN_COLLECT_SCRIPT` to the active tab.
- Display success/error toast messages.

Message sent to the content script:

```js
{
  action: "RUN_COLLECT_SCRIPT",
  school: selectedSchool,
}
```

The receiver is installed by:

```text
src/core/schoolRequest.js
```

Important behavior:

- If no school is selected, it asks the user to pick from the dropdown.
- If the content script is not active on the current page, it shows an error.
- It handles common backend failure statuses such as `429` and `400`.
- Toast CSS is injected dynamically from this file.

Where to change it:

- Change popup behavior here.
- Change school-search backend URL here if that endpoint moves.
- Change request-school UX here.

### `src/popup/popup.css`

This file styles the extension toolbar popup.

It styles:

- Popup dimensions.
- Dark background.
- Title.
- Request button.
- Informational text.
- Warning text.
- School search input.
- Dropdown.
- Dropdown options.
- Popup links.

Important distinction:

- This CSS applies only to `popup.html`.
- It does not style ratings or professor popups inside registration pages.

## Adapter Contract

Every adapter should register itself like this:

```js
window.BroncoSort.adapters["adapter-id"] = {
  id: "adapter-id",
  pageType: "course-search",
  matchesPage(context) {},
  getTargetDocument(context) {},
  collectCourses(doc, context) {},
  getProfessorElements(doc, context) {},
  insertRating({ option, ratingElement, doc, context }) {},
  getChangeSignature(doc, context) {},
  isReady(doc) {},
};
```

Required in practice:

- `id`
- `matchesPage(context)`
- `getTargetDocument(context)`
- `collectCourses(doc, context)`
- `getChangeSignature(doc, context)`

Optional:

- `pageType`
- `ratingRenderer`
- `getProfessorElements(doc, context)`
- `insertRating(...)`
- `canReorderOptions`
- `reorderCourse(course, context)`
- `reorderCourses(...)`
- `isReady(doc)`
- `watchStrategy`
- `pollIntervalMs`
- `debounceMs`

## Standard Course Shape

Adapters must return courses in this shape:

```js
{
  courseBox,
  courseTitle,
  options: [
    {
      name,
      block,
      instrEl,
      department,
    },
  ],
}
```

Field meanings:

- `courseBox`: the top-level DOM element representing the course or row.
- `courseTitle`: display/debug title for the course.
- `options`: professor/section options found inside that course.
- `name`: cleaned professor name.
- `block`: DOM element to reorder if the adapter supports reordering.
- `instrEl`: DOM element containing the instructor name.
- `department`: optional department text used in popups and future ranking features.

## Current Production Flow

1. Chrome injects content scripts on matching domains.
2. `schools.js` registers supported schools.
3. Core modules register shared helpers.
4. Adapter files register page-specific adapters.
5. `bootstrap.js` starts.
6. `pageContext.createPageContext()` maps hostname to a school.
7. `pageContext.getAdapterForPage()` checks the school's adapter list.
8. The selected adapter waits until its target document is ready.
9. `ratingsApi.wakeServer()` calls the backend health endpoint.
10. The watcher runs `courseProcessor.processCourses()`.
11. The adapter extracts standardized courses.
12. The processor batches unique professor names.
13. `ratingsApi.fetchProfessorRatings()` calls the backend once.
14. Ratings are normalized and matched back to options.
15. `ratingRenderer.renderRating()` creates rating elements.
16. `professorPopup.showProfessorPopup()` is attached on hover.
17. The adapter reorders sections or rows only if it explicitly supports that.
18. The observer watches for meaningful changes and reruns only when the adapter signature changes.

## CPP Course Search Flow

CPP course search uses:

```text
src/adapters/cppPeopleSoft.js
```

Flow:

1. `schools.js` maps CPP hostnames to the `cpp` school entry.
2. The CPP school entry lists `cpp-peoplesoft` before or alongside other CPP adapters.
3. `cppPeopleSoft.matchesPage()` rejects `select-sections` URLs.
4. It looks for PeopleSoft course-search instructor/course elements.
5. It collects course boxes and section blocks.
6. It cleans instructor names through `professorNames.js`.
7. The shared processor fetches ratings for all unique professors.
8. Ratings are inserted as block elements after PeopleSoft instructor fields.
9. Section blocks are sorted by rating within each course.
10. Polling watches for PeopleSoft result changes.

## CPP Schedule Builder Flow

CPP Schedule Builder uses:

```text
src/adapters/cppScheduleBuilder.js
```

Flow:

1. `schools.js` maps CPP hostnames to the `cpp` school entry.
2. `cppScheduleBuilder.matchesPage()` requires `select-sections` in the URL.
3. It looks for Schedule Builder Material UI expansion rows.
4. It scans row cells for professor-looking text.
5. It returns a standardized course group containing schedule options.
6. The shared processor fetches ratings.
7. Ratings are appended inside the instructor cell.
8. Schedule cards are reordered by rating.
9. A mutation observer watches for row changes.

## Citrus Registration Flow

Citrus uses:

```text
src/adapters/citrusRegistration.js
```

Flow:

1. `schools.js` maps Citrus hostnames to the `citrus` school entry.
2. Localhost can map to Citrus only for the marked Citrus fixture.
3. `citrusRegistration.matchesPage()` looks for `#table1 tbody tr`.
4. It extracts course title, subject/department, and instructor links from table cells.
5. It cleans instructor names through `professorNames.js`.
6. The shared processor fetches ratings.
7. Ratings are inserted inline after instructor email links.
8. The adapter can sort whole rows by average reviewed rating.
9. A mutation observer watches table changes through the adapter signature.

## Where To Make Common Changes

Add a new supported school using an existing platform:

- Edit `src/config/schools.js`.
- Add the new school entry.
- Reuse an existing adapter ID only if the DOM structure matches.
- Ensure `manifest.json` matches and host permissions include the domain.

Add a new registration platform:

- Create a new file in `src/adapters/`.
- Register `window.BroncoSort.adapters["new-adapter-id"]`.
- Implement matching, extraction, insertion, signature, and readiness methods.
- Add the script to `manifest.json` before `src/bootstrap.js`.
- Add a school registry entry that references the adapter.
- Add tests or fixtures for extraction and signatures.

Change rating text:

- Edit `src/core/ratingRenderer.js`.

Change professor popup contents:

- Edit `src/core/professorPopup.js`.

Change professor popup styling:

- Edit `src/styles/content.css`.

Change backend rating URL or request behavior:

- Edit `src/core/ratingsApi.js`.

Change school request sanitization:

- Edit `src/core/schoolRequest.js`.

Change popup search UI:

- Edit files in `src/popup/`.

Change CPP course-search selectors:

- Edit `src/adapters/cppPeopleSoft.js`.

Change CPP schedule-builder selectors:

- Edit `src/adapters/cppScheduleBuilder.js`.

Change Citrus table selectors:

- Edit `src/adapters/citrusRegistration.js`.

## Current Legacy Files To Be Aware Of

Two old production implementations remain in `src/`:

- `src/content.js`
- `src/scheduleBuilder.js`

They are not loaded by the current `manifest.json`, but they still contain large older implementations. This can be confusing during debugging.

When checking current behavior, trust the manifest-loaded files:

- `src/bootstrap.js`
- `src/config/schools.js`
- `src/core/*`
- `src/adapters/*`
- `src/styles/content.css`

## Testing Notes

Useful things to verify after changes:

- Manifest script paths exist.
- Content scripts load in the expected order.
- Unsupported pages exit quietly.
- The right adapter is selected for the page.
- Professor names are cleaned once through `professorNames.js`.
- Duplicate ratings are not inserted.
- Rating requests are batched.
- Popups open on hover.
- Popups close on mouse leave and scroll.
- RMP links open when a professor ID exists.
- Mutation or polling watchers do not repeatedly call the backend for unchanged pages.
- Reordering only happens in adapters that explicitly support it.

For Citrus fixture testing:

1. Serve the repository root.
2. Open `testing/citrus-registration-portal/`.
3. Confirm the fixture meta tag maps localhost to Citrus.
4. Confirm the production adapter and shared core scripts run against the fixture.

## Design Principle

The key boundary is:

- Core knows how BroncoSort works.
- Adapters know how each school page is shaped.
- Config knows which schools and domains are supported.
- The manifest knows script order and browser permissions.

Keeping those boundaries intact is what makes adding another school or platform manageable.
