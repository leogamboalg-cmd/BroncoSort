# BroncoSort Backend API

This guide documents the HTTP API implemented by `server.js`, the files in `routes/`, and the files in `controllers/`. The examples assume the backend is running locally.

## Quick start

Base URL:

```text
http://localhost:3000
```

For a deployed server, replace that address with the deployment URL. A quick health check is:

```bash
curl http://localhost:3000/api/health
```

Most requests and responses use JSON. For a request with a body, include this header:

```http
Content-Type: application/json
```

## Endpoint summary

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Confirm that the backend responds |
| `GET` | `/ip` | Inspect the request IP information seen by Express |
| `GET` | `/api/health` | Check service health and server time |
| `POST` | `/api/professor/ratings` | Get Rate My Professors data for multiple professors |
| `GET` | `/api/schools/search` | Search College Scorecard schools |
| `POST` | `/api/summary/getProfessorSummary` | Generate or retrieve an AI review summary |
| `POST` | `/api/collect/collectData` | Store sanitized registration-page DOM structure |
| `POST` | `/api/collectData/collectData` | Store detailed DOM compatibility data |
| `POST` | `/api/checkout/create-checkout-session` | Create a one-time Stripe Checkout session |

The two collection endpoints have similar names but different payloads and purposes. They are documented separately below.

## Common behavior

### Authentication

The current API does not require an API key, bearer token, cookie, or user account from callers. Access is instead constrained by CORS for browser-based calls and by rate limiting on most API groups.

CORS is not an authentication mechanism. Tools such as `curl`, Postman, and server-to-server clients normally send no browser `Origin` header and are accepted by the current CORS configuration.

### CORS

Browser requests are accepted from:

- `localhost` and its subdomains;
- the Chrome extension IDs configured in `server.js`;
- configured CSU, UC, and nearby community-college domains and their subdomains.

A browser request from another origin is rejected. If a browser reports a CORS failure while `curl` succeeds, check the page's exact `Origin` against the allowlists in `server.js`.

### Rate limiting

These route groups allow 60 requests per client IP per one-minute window:

- `/api/professor/*`
- `/api/collectData/*`
- `/api/schools/*`
- `/api/collect/*`
- `/api/summary/*`

When that limit is exceeded, the response is HTTP `429`:

```json
{
  "error": "Too many requests, please try again shortly."
}
```

The checkout route and the three utility routes do not use this shared limiter. The school-request endpoint has an additional per-IP, per-school limit described in its section.

### Request size

JSON bodies are limited to 10 MB. Keep DOM samples sanitized and small; do not send entire pages when a structural skeleton is enough.

### General server errors

Unhandled middleware errors return HTTP `500`:

```json
{
  "error": "Something went wrong internally."
}
```

Individual endpoints can return a more specific `500` response, as listed below.

## Professor ratings

### `POST /api/professor/ratings`

Looks up one school and multiple professor names through Rate My Professors. Professor names are cleaned, deduplicated, and matched exactly after normalization. Accents, punctuation, capitalization, and hyphens do not affect the normalized comparison.

Results are cached in Redis for 24 hours. The response does not indicate whether a particular result came from cache.

#### Request body

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `school` | string | Yes | School name to search for |
| `professors` | string[] | Yes | One or more professor names |

Example:

```json
{
  "school": "California State Polytechnic University-Pomona",
  "professors": [
    "Jane Doe",
    "John Smith",
    "TBA"
  ]
}
```

`TBA` and `To Be Announced` are removed from names. Blank results are discarded. Duplicate names are only looked up once.

#### JavaScript example

```js
const response = await fetch("http://localhost:3000/api/professor/ratings", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    school: "California State Polytechnic University-Pomona",
    professors: ["Jane Doe", "John Smith"],
  }),
});

const data = await response.json();

if (!response.ok) {
  throw new Error(data.error ?? `Request failed: ${response.status}`);
}

console.log(data.ratingsByName);
```

#### `curl` example

```bash
curl -X POST http://localhost:3000/api/professor/ratings \
  -H "Content-Type: application/json" \
  -d '{"school":"California State Polytechnic University-Pomona","professors":["Jane Doe","John Smith"]}'
```

#### Successful response: professor found

HTTP `200`:

```json
{
  "schoolFound": "California State Polytechnic University-Pomona",
  "ratingsByName": {
    "Jane Doe": {
      "found": true,
      "profName": "Jane Doe",
      "rating": 4.2,
      "numRatings": 38,
      "ranking": 125,
      "id": "1234567",
      "difficulty": 2.8,
      "percentTakeAgain": 84,
      "department": "Computer Science"
    }
  }
}
```

Field meanings:

| Field | Meaning |
| --- | --- |
| `schoolFound` | Rate My Professors school selected by the server |
| `found` | Whether an exact normalized professor-name match was found |
| `profName` | Name returned by Rate My Professors |
| `rating` | Overall rating; defaults to `0` when unavailable |
| `numRatings` | Number of ratings; defaults to `0` |
| `ranking` | BroncoSort ranking from Redis, or `null` when unavailable |
| `id` | Rate My Professors professor ID, or `null` |
| `difficulty` | Reported difficulty, or `null` |
| `percentTakeAgain` | Reported percentage who would take the professor again, or `null` |
| `department` | Department name, or `null` |

#### Successful response: professor not found

The request itself still succeeds with HTTP `200`; the individual professor has `found: false`:

```json
{
  "schoolFound": "California State Polytechnic University-Pomona",
  "ratingsByName": {
    "Unknown Professor": {
      "found": false,
      "profName": null,
      "rating": 0,
      "numRatings": 0,
      "ranking": null,
      "id": null,
      "difficulty": null,
      "percentTakeAgain": null,
      "department": null
    }
  }
}
```

If one professor lookup throws an error, that professor's object also contains `"error": "Lookup failed"`; other names can still succeed.

#### Errors

| Status | Response | Cause |
| --- | --- | --- |
| `400` | `{"error":"Missing school or professors array"}` | Missing school, non-array `professors`, or an empty array |
| `404` | `{"error":"School not found"}` | No matching Rate My Professors school |
| `429` | Shared rate-limit error | More than 60 requests/minute from one IP |
| `500` | `{"error":"Server error fetching data"}` | Redis, Rate My Professors, or another request-level failure |

## School search

### `GET /api/schools/search?q={query}`

Searches the U.S. Department of Education College Scorecard by school name. At most 10 results are returned.

#### Query parameter

| Parameter | Type | Required | Meaning |
| --- | --- | --- | --- |
| `q` | string | Effectively yes | School-name text. Fewer than two non-space characters returns an empty array. |

#### Examples

```bash
curl "http://localhost:3000/api/schools/search?q=polytechnic%20pomona"
```

```js
const query = new URLSearchParams({ q: "polytechnic pomona" });
const response = await fetch(
  `http://localhost:3000/api/schools/search?${query}`,
);
const schools = await response.json();
```

Always use `URLSearchParams` or equivalent URL encoding instead of manually joining user input into a URL.

#### Successful response

HTTP `200`:

```json
[
  {
    "id": 110529,
    "name": "California State Polytechnic University-Pomona",
    "city": "Pomona",
    "state": "CA",
    "website": "www.cpp.edu"
  }
]
```

No matches, a missing `q`, or a trimmed query shorter than two characters returns HTTP `200` with `[]`.

#### Errors

| Status | Response | Cause |
| --- | --- | --- |
| `429` | Shared rate-limit error | More than 60 requests/minute from one IP |
| `500` | `{"error":"School search failed"}` | College Scorecard or server failure |

## Professor review summary

### `POST /api/summary/getProfessorSummary`

Finds an exact professor at a school, reads up to 30 written Rate My Professors reviews (with an 80,000-character ceiling), and asks Gemini for a compact structured summary.

Generated summaries are cached in Redis for 14 days. Cached calls avoid fetching reviews and generating a new summary.

Because this output is AI-generated from public reviews, clients should present it as a summary rather than a verified fact.

#### Request body

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `school` | string | Yes | School name |
| `professorName` | string | Yes | Full professor name |

```json
{
  "school": "California State Polytechnic University-Pomona",
  "professorName": "Jane Doe"
}
```

#### JavaScript example

```js
const response = await fetch(
  "http://localhost:3000/api/summary/getProfessorSummary",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      school: "California State Polytechnic University-Pomona",
      professorName: "Jane Doe",
    }),
  },
);

const result = await response.json();

if (!response.ok) {
  throw new Error(result.error ?? "Could not load summary");
}

console.log(result.response.tldrSummary);
```

#### Successful response

HTTP `200`:

```json
{
  "response": {
    "verdict": "Take Office Hours",
    "sentimentScore": 78,
    "tldrSummary": "Clear lectures and moderate projects, but strict grading makes careful preparation and regular attendance important.",
    "topPros": [
      "Clear lecture explanations",
      "Helpful office hours",
      "Useful project feedback"
    ],
    "topCons": [
      "Strict grading details",
      "Frequent weekly quizzes",
      "Fast lecture pace"
    ],
    "examStyle": "Quizzes and projects"
  },
  "cached": false
}
```

`cached` is `true` when Redis supplied an existing summary and `false` when Gemini generated it during this request.

The response object has these fields:

| Field | Type | Intended format |
| --- | --- | --- |
| `verdict` | string | Three-word recommendation or warning |
| `sentimentScore` | integer | Overall review sentiment from 0 to 100 |
| `tldrSummary` | string | One compact summary sentence |
| `topPros` | string[] | Three short positive takeaways |
| `topCons` | string[] | Three short negative takeaways |
| `examStyle` | string | Short description of assessment patterns |

#### Errors

| Status | Response | Cause |
| --- | --- | --- |
| `400` | `{"error":"Missing school or professorName"}` | Either required field is absent or empty |
| `404` | `{"error":"School not found"}` | School search produced no match |
| `404` | `{"error":"Professor not found"}` | No exact normalized professor match |
| `404` | `{"error":"No written reviews found"}` | Professor exists but has no usable written comments |
| `429` | Shared rate-limit error | More than 60 requests/minute from one IP |
| `500` | `{"error":"Server error fetching data"}` | Redis, Rate My Professors, Gemini, parsing, or server failure |

## School support request

### `POST /api/collect/store`

Stores a request to support a school in Redis for 14 days. Each accepted request receives a random request ID. This endpoint is for school-request submissions; it is not the detailed DOM collector.

#### Request body

Only `school` and `pages` are checked for presence. The controller reads the following additional fields when creating its summary:

| Field | Type | Required by server | Meaning |
| --- | --- | --- | --- |
| `school` | object | Yes | Selected school |
| `school.id` | string or number | Needed for reliable storage/rate limiting | College Scorecard school ID |
| `school.name` | string | Needed for a useful request | School name |
| `school.website` | string | No | School website |
| `pages` | any truthy value | Yes | Registration-page information collected by the client |
| `pageUrl` | string | No | Page where the request was submitted |

The server currently stores extra JSON fields as supplied. Do not include secrets, student records, login information, or unnecessary page content.

Example:

```json
{
  "school": {
    "id": 110529,
    "name": "Example University",
    "website": "www.example.edu"
  },
  "pageUrl": "https://registration.example.edu/search",
  "pages": [
    {
      "name": "Class Search",
      "url": "https://registration.example.edu/search"
    }
  ]
}
```

#### JavaScript example

```js
const response = await fetch("http://localhost:3000/api/collect/store", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    school: {
      id: 123456,
      name: "Example University",
      website: "www.example.edu",
    },
    pageUrl: location.href,
    pages: [{ name: "Class Search", url: location.href }],
  }),
});

const result = await response.json();
```

#### Successful response

HTTP `200`:

```json
{
  "success": true,
  "requestId": "0d10a980-4eb1-4636-9940-a45026e50413"
}
```

#### Additional per-school limit

One IP address can submit at most three requests for the same `school.id` within 10 minutes. A fourth attempt returns HTTP `429`:

```json
{
  "error": "Too many requests for this school. Try again later."
}
```

This endpoint also uses the shared 60-requests/minute limiter.

#### Errors

| Status | Response | Cause |
| --- | --- | --- |
| `400` | `{"error":"Invalid payload."}` | Missing/falsy `school` or `pages` |
| `400` | `{"error":"This school is already supported."}` | Trimmed school name exactly matches a built-in school |
| `429` | Per-school or shared rate-limit error | Submission limit exceeded |
| `500` | `{"error":"Failed to store school request."}` | Redis or server failure |

## DOM compatibility collection

### `POST /api/collectData/collectData`

Stores a sanitized structural sample of a school's registration page in Redis for seven days. The value is keyed by lowercased hostname, so a later submission for the same hostname replaces the earlier sample.

This endpoint is intended for DOM structure, selectors, and counts. Remove student names, IDs, course choices, tokens, form values, and other private data before sending HTML.

#### Request body

| Field | Type | Required | Default when omitted |
| --- | --- | --- | --- |
| `hostname` | string | Yes | None |
| `skeletons.table` | string | Yes | None |
| `pathname` | string | No | `""` |
| `capturedAt` | string | No | Current server time in ISO format |
| `detection` | object | No | `{}` |
| `selectorHints` | object | No | `{}` |
| `counts` | object | No | `{}` |
| `skeletons.movableBlock` | string | No | `""` |
| `skeletons.groupContainerPreview` | string | No | `""` |
| `siblingSignatures` | array | No | `[]` |

Example payload:

```json
{
  "hostname": "registration.example.edu",
  "pathname": "/class-search",
  "capturedAt": "2026-06-22T18:30:00.000Z",
  "detection": {
    "strategy": "table-headers"
  },
  "selectorHints": {
    "table": "#class-results",
    "instructor": ".instructor-name"
  },
  "counts": {
    "rowCount": 20,
    "siblingCount": 3
  },
  "skeletons": {
    "table": "<table id=\"class-results\"><tr><th>Instructor</th></tr><tr><td>[cell]</td></tr></table>",
    "movableBlock": "<div class=\"section-card\">[content removed]</div>",
    "groupContainerPreview": "<div id=\"results\">[content removed]</div>"
  },
  "siblingSignatures": [
    {
      "tag": "div",
      "className": "section-card"
    }
  ]
}
```

The nested objects are stored without deeper schema validation. Their exact keys may evolve with the extension's collector. The server only requires a truthy `hostname` and `skeletons.table`.

#### Successful response

HTTP `200`:

```json
{
  "message": "Structure received successfully",
  "school": "registration.example.edu",
  "saved": {
    "hasTable": true,
    "hasMovableBlock": true,
    "hasGroupContainerPreview": true,
    "siblingCount": 3
  }
}
```

#### Errors

| Status | Response | Cause |
| --- | --- | --- |
| `400` | `{"error":"Missing hostname or table skeleton data"}` | Missing/falsy `hostname` or `skeletons.table` |
| `429` | Shared rate-limit error | More than 60 requests/minute from one IP |
| `500` | `{"error":"Server error saving structure"}` | Redis or server failure |

## Stripe checkout

### `POST /api/checkout/create-checkout-session`

Creates a Stripe Checkout Session for one unit of the price configured by `STRIPE_PRICE_ID`. The payment mode is a one-time payment.

The request does not currently use fields from its body, so `{}` is sufficient.

#### JavaScript example

```js
const response = await fetch(
  "http://localhost:3000/api/checkout/create-checkout-session",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  },
);

const result = await response.json();

if (!response.ok) {
  throw new Error(result.error ?? "Could not start checkout");
}

// Use this only in direct response to a user's checkout action.
window.location.assign(result.url);
```

#### Successful response

HTTP `200`:

```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_example"
}
```

After payment, Stripe redirects to:

```text
{FRONTEND_URL}/index.html?payment=success&session_id={CHECKOUT_SESSION_ID}
```

If the user cancels, Stripe redirects to:

```text
{FRONTEND_URL}/index.html?payment=cancel
```

The client should use the returned URL, not construct a Stripe Checkout URL itself. A success redirect alone should not be treated as secure proof of payment; server-side fulfillment should verify the Stripe session or a Stripe webhook when fulfillment is implemented.

#### Errors

| Status | Response | Cause |
| --- | --- | --- |
| `500` | `{"error":"Missing STRIPE_PRICE_ID"}` | Server price ID is not configured |
| `500` | `{"error":"Failed to create checkout session"}` | Stripe or server failure |

This route does not currently use the shared API rate limiter.

## Utility endpoints

### `GET /`

Returns HTTP `200` as plain text:

```text
Hello from BroncoSort Backend!
```

This proves Express is responding but does not verify Redis or third-party integrations.

### `GET /api/health`

Returns HTTP `200`:

```json
{
  "status": "active",
  "serverTime": "2026-06-22T18:30:00.000Z"
}
```

`serverTime` is serialized from a JavaScript `Date` as an ISO timestamp. Like `/`, this is a process-level health check and does not test dependencies.

### `GET /ip`

Diagnostic endpoint showing the client/proxy address Express sees:

```json
{
  "ip": "203.0.113.10",
  "ips": ["203.0.113.10"],
  "header": "203.0.113.10"
}
```

| Field | Meaning |
| --- | --- |
| `ip` | Express's selected client IP |
| `ips` | Parsed proxy chain when present |
| `header` | Raw `X-Forwarded-For` header; omitted from JSON when undefined |

The app uses `trust proxy = 1`, meaning it trusts one reverse-proxy hop. This endpoint is intended for deployment diagnostics, especially when checking IP-based rate limiting.

## Environment variables

Create a local `.env` file based on `.env.example`.

| Variable | Used for |
| --- | --- |
| `PORT` | HTTP port; defaults to `3000` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST credential |
| `COLLEGE_SCORECARD_API_KEY` | School search through College Scorecard |
| `GEMINI_API_KEY` | Professor review summaries |
| `STRIPE_SECRET_KEY` | Stripe server client |
| `STRIPE_PRICE_ID` | Product/price placed in Checkout |
| `FRONTEND_URL` | Base URL for Stripe success and cancellation redirects |

Never put server credentials in extension code, browser JavaScript, screenshots, documentation examples, or commits. Only the backend should read these values.

## Complete frontend error-handling pattern

`fetch` does not throw merely because the server returns `400`, `404`, `429`, or `500`. Check `response.ok` yourself:

```js
async function requestJson(url, options = {}) {
  const response = await fetch(url, options);

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = body?.error ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body;
}

const ratings = await requestJson(
  "http://localhost:3000/api/professor/ratings",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      school: "California State Polytechnic University-Pomona",
      professors: ["Jane Doe"],
    }),
  },
);
```

For `429` responses, wait before retrying. Do not immediately retry in a loop. The standard rate limiter also sends rate-limit headers that a client can use to decide when another attempt is appropriate.

## Current API limitations

- There is no version prefix such as `/api/v1`; path or response changes require coordinated client updates.
- There is no OpenAPI schema generated by the server; this document is the contract derived from the current implementation.
- The API does not authenticate callers.
- The checkout route has no endpoint-specific rate limiter.
- The school-request and DOM collection objects only receive shallow validation.
- Health checks do not verify Redis, College Scorecard, Rate My Professors, Gemini, or Stripe.
- Old standalone test scripts in the backend directory may reference earlier routes or payloads. The routes listed in this document match the current `server.js` mounts and route modules.
