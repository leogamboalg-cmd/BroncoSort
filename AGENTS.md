# AGENTS.md

## Purpose

Build a Chrome extension that reads instructor names from the registration portal, matches them to Rate My Professors, and displays ratings and profile links. My original idea was to put highest rated professors at top of list and going down from there. I also wanna inject my own UI element that shows their rating and by clicking on it, it would take you straight to their rate my professor page. For now just working with Cal Poly Pomona professors but maybe later expanding to other schools as well.

---

## Current Focus

- Detect instructor names inside the registration page iframe
- Extract names reliably
- Normalize names for matching
- Add ratings next to each professor
- Eventually sort results by rating

---

## Rules

- Keep code simple
- Make minimal changes
- Log clearly
- Do not assume page content is loaded immediately
- Always check iframe access first
- Do not break the existing registration UI
- Always null-check DOM elements before using them
- Prefer logging over guessing

---

## Workflow

1. Confirm content script loads
2. Find iframe
3. Access iframe document
4. Query instructor elements
5. Extract raw names
6. Normalize names
7. Match ratings
8. Inject UI
9. Sort if needed

---

## DOM Strategy (CRITICAL)

Instructor data is inside an iframe.

Codex MUST follow this pattern:

```js
const iframe = document.querySelector("iframe");
if (!iframe) return;

const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
if (!innerDoc) return;

const instructors = innerDoc.querySelectorAll('[id^="MTG_INSTR"]');
```
