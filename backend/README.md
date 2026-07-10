# BroncoSort Backend

This directory contains the Express backend used by the BroncoSort Chrome extension. It looks up professor ratings, searches for schools, creates professor-review summaries, collects school compatibility data, and starts Stripe Checkout sessions.

## API documentation

Open [docs/index.html](docs/index.html) in a browser for the styled HTML guide,
or read [docs/API.md](docs/API.md) directly on GitHub. Both guides cover:

- every available endpoint;
- required request fields;
- example requests and responses;
- error responses and status codes;
- rate limits, CORS behavior, caching, and environment setup;
- JavaScript and `curl` examples.

## Run locally

Requirements:

- Node.js with built-in `fetch` support (Node.js 18 or newer);
- an Upstash Redis database;
- API credentials for the integrations used by the server.

```bash
npm install
```

Copy `.env.example` to `.env`, replace every placeholder required by the endpoints you use, and start the server:

```bash
npm start
```

The default local address is `http://localhost:3000`. During development, `npm run dev` restarts the server when files change.

> The server imports the Gemini and Stripe integrations at startup. As currently implemented, `GEMINI_API_KEY` and `STRIPE_SECRET_KEY` must be present even if you only plan to call another endpoint.

## Main files

```text
backend/
├── config/       # Supported schools and service clients
├── controllers/  # Request validation and endpoint behavior
├── docs/          # API documentation
├── routes/        # Express route definitions
├── .env.example  # Environment variable template
├── package.json
└── server.js      # Middleware, route mounting, and server startup
```

Do not commit `.env` or service credentials. The repository-level `.gitignore` excludes local environment files and `node_modules/`.
