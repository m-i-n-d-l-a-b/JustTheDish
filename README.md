## Just The Dish

Extract clean, structured recipes from cooking websites. Paste a URL and get a concise ingredient list and step-by-step instructions, optionally download as a simple text-based PDF.

### Features
- **URL to Recipe**: Extracts title, ingredients, steps, servings, prep and cook time.
- **Robust validation**: Zod schemas for inputs and AI responses; clear error mapping.
- **Resilient AI calls**: Timeout, retries with jittered backoff, rate-limit handling.
- **Basic rate limiting**: 10 requests/hour per IP (memory; swap for Redis in prod).
- **Download**: Generate a downloadable PDF.

### Tech Stack
- Next.js App Router (API routes in `app/api/*`)
- TypeScript, React 19
- Tailwind CSS, shadcn/ui components
- Google Gemini via `@google/generative-ai`; Groq via `groq-sdk`
- Zod for validation

---

## Quick Start

1) Install dependencies
```bash
npm install
```

2) Configure environment
Create `.env.local` in the project root. See `ENV_SETUP.md` for details. Minimum:
```bash
GOOGLE_API_KEY=your_google_api_key_here
# optional overrides
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_REQUEST_TIMEOUT=30000
GEMINI_MAX_RETRIES=2
GEMINI_RETRY_DELAY=1000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```
# Groq (optional)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=groq/compound-mini
EXTRACTION_PROVIDER=groq

3) Run the app
```bash
npm run dev
```
Visit `http://localhost:3000`.

---

## Usage
1. Enter a public recipe URL (http/https, not localhost).
2. Submit to extract.
3. Review ingredients and steps; optionally download.

Common errors are surfaced clearly (invalid URL, paywall, not a recipe, parsing failed, AI unavailable, quota, rate-limit).

---

## API

### POST `/api/extract-recipe`
Request
```json
{ "url": "https://example.com/recipe" }
```

Success
```json
{
  "recipe": {
    "title": "...",
    "ingredients": ["..."],
    "steps": ["..."],
    "servings": "...",
    "prepTime": "...",
    "cookTime": "..."
  }
}
```

Errors use `{ error: { type, message } }` with appropriate HTTP codes.

Notes
- In-memory rate limiting: 10 req/hour/IP.
- Validates URL and AI response with Zod.
- Maps domain errors to HTTP status consistently.

### POST `/api/generate-pdf`
Accepts `{ recipe }` and returns a downloadable PDF. The server generates a PDF using `pdfkit` and streams it back with `application/pdf`.

### GET `/api/debug-env`
Returns limited environment diagnostics (no secrets).

---

## Architecture
- `app/page.tsx`: Client UI workflow and network calls.
- `components/*`: Form, recipe display, loading and error components.
- `app/api/extract-recipe/route.ts`: HTTP handler, rate limiting, input validation, error mapping.
- `lib/recipe-extraction.ts`: Service orchestrating prompt building, Gemini call, parsing, sanitizing, logging.
- `lib/gemini-client.ts`: Gemini client with timeout/retry/backoff and typed error categories.
- `lib/prompts.ts`: System/extraction/validation prompts with examples.
- `lib/schemas.ts`: Zod schemas and types for inputs, recipes, responses, logs.
- `lib/env.ts`: Validated env loader.

---

## Security & Privacy
- Never logs API keys. `debug-env` only reports presence of keys, not values.
- Basic protections against localhost/internal URLs.
- Avoid sending or storing PII; URLs may appear in logs during development—hash/redact for production.

---

## Production Notes
- Replace in-memory rate limiting with Redis or durable store.
- Replace mock PDF with a real PDF generator.
- Add observability sinks (metrics/traces) and persistent logs.
- Harden CORS/CSRF as needed for your deployment.
- Configure proper error pages and user messaging.

---

## Scripts
```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # run production server
npm run lint     # lint
```

---

## License
MIT (or your choice). Update as appropriate.
