# BroncoSort

BroncoSort is a Manifest V3 Chrome extension that adds Rate My Professors context to supported university registration/search pages. It helps students compare course sections by showing professor rating information directly in the registration flow.

## Features

- Detects supported registration/search pages.
- Finds instructor names from course result sections.
- Requests public Rate My Professors rating data through the BroncoSort backend.
- Adds rating information and Rate My Professors links near instructor names.
- Sorts supported course result sections by professor rating when the page structure allows it.
- Includes a popup with project links and a school request workflow.

## Supported School Status

BroncoSort is actively developed for Cal Poly Pomona registration pages and includes configuration for additional California university and community college domains. Support depends on each school's registration page structure, so newly listed schools may require validation before all features work reliably.

## Project Structure

```text
BroncoSort/
|- README.md
|- AGENTS.md
|- .gitignore
|- manifest.json
|- src/
|  |- background.js
|  |- content.js
|  |- content.css
|  |- scheduleBuilder.js
|  `- popup/
|     |- popup.html
|     |- popup.css
|     `- popup.js
|- assets/
|  `- images/
|- backend/
|- docs/
|  |- index.html
|  |- schools.html
|  |- request-school.html
|  |- privacy.html
|  |- faq.html
|  |- assets/
|  `- images/
|- tools/
|- dist/
`- privacy-policy.md
```

The `docs/` folder powers the BroncoSort website/GitHub Pages presentation. The Chrome extension itself is loaded from `manifest.json` and `src/`.

## Local Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the repository root folder, not the `src/` folder.
6. Open a supported registration/search page and use the extension normally.

## Backend

The extension calls a backend service to retrieve professor rating data. The backend source is included in `backend/`.

For local backend development:

```bash
cd backend
npm install
npm start
```

Do not commit `.env` files or local secrets. Use `backend/.env.example` as the public example file.

## Chrome Web Store

Chrome Web Store listing: _Coming soon_

## Screenshots

Screenshots and demo images can be added here as the extension UI stabilizes.

## Permissions and Privacy

BroncoSort requests Chrome extension permissions needed to run on supported registration/search pages and store extension state. It does not collect or store personal user data in the extension source.

The extension reads course and instructor information already visible on the page. Professor names may be sent to the BroncoSort backend so the extension can retrieve public Rate My Professors information.

See [privacy-policy.md](privacy-policy.md) for the current privacy policy text.

## Project Status

BroncoSort is in active development. The current focus is improving school compatibility, request-school handling, and the reliability of professor matching without changing the user's registration data.

## Notes

BroncoSort is not affiliated with or endorsed by Cal Poly Pomona, the California State University system, the University of California system, any supported school, or Rate My Professors.
