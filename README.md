# Kids App (Kuwait)

A bilingual (Arabic / English) kids app with **Buddy**, an AI helper that can make up short stories or answer questions.
Buddy's answers come from a self-hosted [OmniRoute](https://github.com/cheaper-inference/OmniRoute) gateway, which routes
requests to the AI provider(s) you choose through one OpenAI-compatible API.

```
Browser ──► Kids app (Node, port 3000) ──► OmniRoute (port 20128, private) ──► AI provider(s) you connect
```

## Quick start (Docker)

```bash
cp .env.example .env
cp omniroute.env.example omniroute.env
# Fill in JWT_SECRET, API_KEY_SECRET, STORAGE_ENCRYPTION_KEY and INITIAL_PASSWORD in omniroute.env
# (generate each secret with: openssl rand -hex 32)

docker compose up -d omniroute
```

1. Open the OmniRoute dashboard at http://localhost:20128 and log in with `INITIAL_PASSWORD`.
2. **Providers**: connect the provider(s) you want Buddy to use with your own API key.
3. **Endpoints / API Keys**: create an API key and put it in `.env` as `OMNIROUTE_API_KEY`.
4. Set `OMNIROUTE_MODEL` in `.env` to the exact model you want (recommended over `auto`).
5. Start everything: `docker compose up -d --build`, then open http://localhost:3000.

## Choosing providers for a kids app

OmniRoute can route to hundreds of providers, including free tiers. For an app used by children:

- Connect only one or two reputable providers whose terms allow your use and who don't train on API data.
- Pin `OMNIROUTE_MODEL` to a specific model instead of `auto`, so you always know where children's messages go.
- Don't connect providers that OmniRoute marks `tos: avoid`, or "web cookie" / subscription-account providers.
- Keep the dashboard private. Compose binds it to `127.0.0.1` only; put any public access behind HTTPS and a login.

## Built-in safety

- The OmniRoute API key stays on the server. The browser only talks to `/api/ask`.
- A child-safe system prompt (ages 6 to 12, respectful of Kuwaiti culture) is added to every request.
- Emails, Kuwaiti phone numbers and Civil ID numbers are redacted before anything is sent to the AI.
- Messages are limited to 500 characters, requests are rate limited per device, and replies are capped in length.
- Children's messages are never logged. AI replies are shown as plain text (never HTML).

## Local development (without Docker)

Requires Node.js 20+. No npm dependencies.

```bash
docker compose up -d omniroute   # or run OmniRoute any other way
cp .env.example .env              # fill in OMNIROUTE_API_KEY
node --env-file=.env server/index.js
npm test
```

`npm run dev` restarts the server when files in `server/` or `public/` change.

## Performance

Replies stream word by word, static assets are cached and compressed, and the page paints without waiting for JavaScript.
See [docs/PERFORMANCE.md](docs/PERFORMANCE.md) for the audit and measurements. To benchmark (needs Playwright + Chromium installed locally):

```bash
node bench/fake-gateway.mjs &                       # synthetic gateway, fixed timing
OMNIROUTE_BASE_URL=http://localhost:20999/v1 OMNIROUTE_API_KEY=x RATE_LIMIT_MAX=1000 npm start &
node bench/run.mjs http://localhost:3000 5
```

## Project layout

| Path | What it is |
| --- | --- |
| `server/app.js` | HTTP server: `/api/ask` (JSON or streamed NDJSON), `/healthz` |
| `server/static.js` | In-memory static files: hashed URLs, cache headers, compression, inlined CSS |
| `server/omniroute.js` | Client for OmniRoute's `/v1/chat/completions` |
| `server/safety.js` | Input checks, personal-info redaction, child-safe system prompt |
| `public/` | The Arabic/English web UI |
| `docker-compose.yml` | Runs the app and OmniRoute together |
