# BroncoSort

BroncoSort is a Chrome extension for the Cal Poly Pomona registration portal that finds instructor names inside the PeopleSoft results iframe, looks up those professors on Rate My Professors, injects rating links into the page, and reorders sections so higher-rated instructors appear first within each course.

## What It Does

- Detects the registration results iframe before doing any DOM work
- Extracts instructor names from course result blocks
- Cleans duplicated or messy names before lookup
- Sends unique professor names to a small backend service
- Matches professors against Rate My Professors for `Cal Poly Pomona`
- Injects a rating UI element directly under each instructor name
- Links the rating to the professor's Rate My Professors page when a match is found
- Sorts instructor options within a course by rating, highest to lowest

## Current Scope

BroncoSort is currently focused on Cal Poly Pomona only.

The extension is designed around the registration portal structure where instructor data lives inside an iframe. The content script repeatedly checks for page updates because the registration UI does not load everything immediately and can change after filters, searches, or navigation events.

## How It Works

### Extension side

The Chrome extension:

- runs on `https://*.cpp.edu/*`
- waits for the registration page to finish loading
- finds the target iframe
- reads instructor elements with selectors like `[id^="MTG_INSTR"]`
- builds a unique professor list
- calls the backend API for ratings
- injects UI next to the existing registration content
- reorders instructor blocks inside each course result only

### Backend side

The backend is a small Express app that:

- accepts a school name and professor list
- searches Rate My Professors for the school once
- searches professors within that school
- tries to find an exact normalized name match first
- falls back to the first result if an exact match is not found
- returns rating, rating count, and Rate My Professors professor ID

## Project Structure

```text
BroncoSort/
|- manifest.json
|- content.js
|- content.css
|- privacy-policy.md
|- backend/
|  |- server.js
|  |- routes/professorRoutes.js
|  |- controllers/professorController.js
|  |- package.json
```

## Local Development

### 1. Start the backend

From the `backend` folder:

```bash
npm install
npm start
```

By default the backend runs on `http://localhost:3000`.

### 2. Point the extension at local backend

In `content.js`, switch:

```js
const USE_LOCAL = false;
```

to:

```js
const USE_LOCAL = true;
```

This makes the extension call the local API instead of the deployed Render backend.

### 3. Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the project root folder

### 4. Test on the registration portal

Open the Cal Poly Pomona registration page and inspect the console for BroncoSort logs.

Expected flow:

1. Content script loads
2. Iframe is found
3. Instructor names are detected
4. Ratings are fetched
5. Rating links are injected
6. Instructor options are reordered within each course

## API

### `POST /api/professor/ratings`

Request body:

```json
{
  "school": "Cal Poly Pomona",
  "professors": ["Jane Doe", "John Smith"]
}
```

Response shape:

```json
{
  "schoolFound": "Cal Poly Pomona",
  "ratingsByName": {
    "Jane Doe": {
      "found": true,
      "profName": "Jane Doe",
      "rating": 4.5,
      "numRatings": 42,
      "id": 1234567
    }
  }
}
```

## Matching Notes

- Names are normalized before comparison
- Duplicate professor names are removed before lookup
- Placeholder values like `TBA`, `Staff`, and `Instructor TBA` are ignored
- If no professor match is found, the UI shows `No rating`
- Rating order currently treats missing ratings as `0`

## Privacy

BroncoSort does not collect or store personal user data.

The extension only reads course and instructor information already visible on the registration page. Professor names may be sent to the backend so the app can retrieve public Rate My Professors data. See [privacy-policy.md](privacy-policy.md) for the current privacy text.

## Limitations

- Built specifically for the current Cal Poly Pomona registration DOM
- Depends on iframe access and current PeopleSoft selectors
- Rate My Professors matching is name-based, so edge cases can still happen
- The backend currently processes professor searches sequentially
- Styling is intentionally minimal to avoid interfering with the registration UI

## Roadmap

- Improve matching accuracy for professors with similar names
- Expand support beyond Cal Poly Pomona
- Refine injected UI styling
- Reduce repeated lookups with caching
- Improve sort behavior for sections with missing or ambiguous matches

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript
- Express
- `ratemyprofessors-client`
- Render for deployed backend hosting

## Notes

BroncoSort is not affiliated with or endorsed by Cal Poly Pomona or Rate My Professors.
