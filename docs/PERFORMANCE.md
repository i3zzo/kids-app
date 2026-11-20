# Performance audit (2026-11-20)

Scope: the starter app (Node server, one-page web UI, Buddy AI helper behind OmniRoute).
Baseline is commit `91bb8d2`; "after" is this change. Behaviour, safety checks and accessibility are unchanged
except where noted under trade-offs.

## How it was measured

- Tool: `bench/run.mjs` drives Chromium 157 (headless, via Playwright) and sets throttling through the Chrome DevTools Protocol
  with the same values as the DevTools presets: **Slow 4G** (562.5 ms RTT, 180,000 B/s down, 84,375 B/s up) and **4x CPU slowdown**.
- Viewport 390x844. Same route (`/`) and same action (submit "a camel who loves the sea" in story mode) for both versions.
- 5 runs per version, median reported. The whole benchmark was run twice per version; raw output is in `bench/results/`.
- "Cold" = fresh browser profile. "Warm" = reload in the same profile (repeat visit).
- AI timings use `bench/fake-gateway.mjs`, a synthetic OpenAI-compatible gateway with fixed timing (first token after 800 ms,
  then 40 tokens 50 ms apart). It stands in for OmniRoute and a real model, so AI numbers show the *difference* between versions,
  not real-world model speed.
- Server and browser ran on the same Linux cloud container.

**Not done / missing:** no physical low-end phone was available, and the DevTools GUI itself was not used (CDP with identical
preset values instead). There is no production deployment yet, so there are no field (real-user) numbers.

## Results (median of 5; run 1 / run 2)

| Metric | Baseline | After |
| --- | --- | --- |
| Cold FCP | 1240 / 1244 ms | 700 / 712 ms |
| Cold LCP | 1308 / 1316 ms | 700 / 712 ms |
| Cold load event | 1242 / 1252 ms | 1189 / 1185 ms |
| Cold bytes transferred | 10,044 B | 5,159 B |
| Warm FCP | 1204 / 1212 ms | 628 / 624 ms |
| Warm LCP | 1240 / 1244 ms | 628 / 624 ms |
| Warm bytes transferred | 10,044 B | 517 B |
| AI: first reply text on screen | 2841 / 2835 ms | 830 / 837 ms |
| AI: full reply on screen | 2842 / 2835 ms | 2784 / 2788 ms |

Streaming improves how soon text appears; total generation time is essentially the same, as expected.
Note that the AI timings sit close to the synthetic gateway's own timing (800 ms + 40 x 50 ms) in both versions; Chrome's emulated
latency did not add a full round trip on top of the server's wait in this setup.

## Checklist, item by item

1. **Database indexing and query optimization: not applicable.** The app has no database or stored data yet.
2. **N+1 queries: not applicable.** No database access.
3. **Selective data fetching: not applicable to a database.** The only data call is to OmniRoute, and the app already reads only
   `choices[0].message.content` / `choices[0].delta.content`.
4. **Pagination: not applicable.** There are no lists or large result sets.
5. **Image formats: not applicable.** The only image is a 0.5 KB vector logo (SVG). Converting a vector to WebP/AVIF would make it
   bigger and blurry. The logo is now inlined in the HTML, which removes one request.
6. **Lazy loading: nothing to lazy-load.** There is no below-the-fold media. The logo (top of the page) is inline, so it is never delayed.
7. **CDN and caching: done (caching); CDN deferred.**
   - JS and SVG are served from content-hashed URLs (`/app.js?v=<hash>`) with `Cache-Control: public, max-age=31536000, immutable`.
   - `index.html` uses `Cache-Control: no-cache` + ETag (304 on repeat visits), so a new deploy is picked up immediately; it points at the new hashes, which is the invalidation mechanism.
   - API responses are `no-store`. Text assets are precompressed with Brotli and gzip.
   - Critical CSS is inlined into the HTML (allowed by a CSP hash, no `unsafe-inline`), which removes a render-blocking round trip.
   - Page text is now in the HTML (Arabic by default) instead of being filled in by JavaScript, so it paints without waiting for JS.
   - No CDN is configured because there is no hosting yet. These headers are CDN-ready: a CDN can cache hashed assets forever and must
     not cache `/api/*`.
8. **Parallel async work: done where it exists.** Static files are read in parallel at startup. Each child action makes one request,
   so there is nothing else to parallelize.
9. **Loading states: done.** The Send button shows a busy state immediately. A skeleton appears only if no reply text has arrived after
   1 second; fast replies never flash a placeholder. Verified: with a 300 ms first token no skeleton appeared; with 2.5 s it appeared at
   ~1002 ms. Respects `prefers-reduced-motion`.
10. **Optimistic UI: not applicable.** The only server action is asking Buddy, whose result can't be predicted. Switching language and
    mode is already instant and local.
11. **AI streaming: done.** The server requests `stream: true` from OmniRoute and forwards text to the browser as NDJSON as it arrives.
    Failures before the first piece still return a normal error; failures mid-stream keep the partial text and add an error message.
    If the child leaves, the upstream request is cancelled. The non-streaming API still works for other clients.
12. **Benchmarking: done** as described above, with the gaps listed.

## Trade-offs

- **Static files are held in memory** and read once at startup. Editing `public/` needs a restart (`npm run dev` now watches `public/` too).
- **Inlined CSS** is re-sent with every HTML load (2.9 KB raw, about 1 KB with Brotli) instead of being cached separately, in exchange for one fewer
  round trip on first paint.
- **Arabic text is in the HTML.** A returning child who chose English sees Arabic for a moment before the script switches it
  (not measured). Arabic-first users, the main audience, see no switch.
- **Streaming through proxies:** some reverse proxies buffer responses. The server sends `X-Accel-Buffering: no`; any other proxy in
  front of the app must not buffer `/api/ask`.
- For screen readers, the reply area stays `aria-busy` while streaming, so the reply is read once it is complete rather than word by word.
