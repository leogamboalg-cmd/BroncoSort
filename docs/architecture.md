# BroncoSort Extension Architecture

BroncoSort uses a no-build Manifest V3 content-script architecture. Scripts are loaded in the order listed in `manifest.json` and share one `window.BroncoSort` namespace.

## Runtime Flow

1. `src/bootstrap.js` creates a page context from the current hostname.
2. `src/config/schools.js` finds the school registry entry.
3. `src/core/pageContext.js` selects the first adapter that matches the page.
4. `src/core/observer.js` waits for the adapter's target document to be ready.
5. `src/core/styleLoader.js` injects `src/styles/content.css` into that document.
6. `src/core/courseProcessor.js` asks the adapter for standardized courses.
7. `src/core/ratingsApi.js` sends one batched request to `/api/professor/ratings`.
8. `src/core/ratingRenderer.js` renders ratings and attaches the shared popup.
9. The adapter optionally reorders sections when it is explicitly safe.
10. The shared observer reruns the processor only when the adapter's change signature changes.

## School Registry

School metadata lives in `src/config/schools.js`. A school entry includes display/API names, supported domains, adapter IDs, and feature flags.

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
    sorting: false
  }
}
```

A configuration-only school addition is valid only when the new school's DOM structure truly matches an existing adapter.

## Adapter Interface

Adapters live in `src/adapters/` and expose this shape:

```js
{
  id,
  matchesPage(context),
  getTargetDocument(context),
  collectCourses(doc, context),
  getProfessorElements(doc, context),
  insertRating({ option, ratingElement, doc, context }),
  canReorderOptions,
  reorderCourse(course, context),
  getChangeSignature(doc, context),
  isReady(doc)
}
```

Adapters own page detection, iframe access, selectors, rating placement, and safe reordering. They do not fetch ratings, normalize names, create popups, render stars, or inject large CSS blocks.

## Standard Course Shape

Every adapter returns:

```js
{
  courseBox,
  courseTitle,
  options: [
    {
      name,
      block,
      instrEl,
      department
    }
  ]
}
```

The processor sorts `options` by rating before rendering. Reordering happens only when `canReorderOptions` is true.

## Current Adapters

- `cpp-peoplesoft`: Cal Poly Pomona PeopleSoft course search inside the `TargetContent` iframe. It reorders section option blocks.
- `cpp-schedule-builder`: Cal Poly Pomona Schedule Builder on `select-sections` pages. It reorders schedule cards.
- `citrus-registration`: Citrus College Banner/SSB table results. It renders inline ratings and does not reorder rows.

## Shared Core

- `professorNames.js`: whitespace cleanup, pronoun removal, `Last, First` conversion, duplicate full-name removal, accent-insensitive normalization, invalid-name filtering.
- `ratingsApi.js`: API base URL, health wakeup, ratings POST request, JSON/error handling, and request de-duplication.
- `ratingRenderer.js`: duplicate prevention, rating text/link creation, dataset professor identity, and popup event wiring.
- `professorPopup.js`: HTML escaping, initials, stars, popup markup, positioning, and close behavior.
- `observer.js`: MutationObserver plus debounced change-signature checks.
- `schoolRequest.js`: popup-triggered request-school page collection and sanitization.

## Styles

Content styles live in `src/styles/content.css`. The style loader injects this CSS into the selected document, including iframe documents.

## Adding A New Platform Adapter

Create a new file in `src/adapters/`, register it on `window.BroncoSort.adapters`, and add the script to `manifest.json` before `src/bootstrap.js`. Keep the adapter focused on DOM parsing and placement. Reuse the shared processor, renderer, popup, API client, names utility, and watcher.

## Citrus Fixture

`testing/citrus-registration-portal/` remains a manual fixture. Its `index.html` includes `meta[name="broncosort-test-fixture"]` so localhost/file testing intentionally maps to the Citrus registry entry. The local shim mocks backend rating responses and provides the minimum Chrome API surface needed for the production scripts.

Run it from the repository root so relative production script paths resolve:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/testing/citrus-registration-portal/
```

Before marking a new school supported, validate real DOM selectors, rating placement, duplicate prevention, mutation refresh behavior, RMP links, popup behavior, and whether reordering is safe.
