import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";

let server, base, lastAsk;
const ai = {
  ask: async (input) => {
    lastAsk = input;
    if (input.message === "fail") throw Object.assign(new Error("x"), { code: "upstream_error" });
    return "Hello friend!";
  },
};

before(async () => {
  server = createApp({ ai, rateLimit: { windowMs: 60_000, max: 5 } });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const ask = (body) =>
  fetch(`${base}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("serves the home page with security headers", async () => {
  const res = await fetch(base + "/");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<html lang="ar" dir="rtl">/);
  assert.match(res.headers.get("content-security-policy"), /default-src 'self'/);
});

test("blocks path traversal", async () => {
  const res = await fetch(base + "/..%2fpackage.json");
  assert.equal(res.status, 404);
});

test("answers via the AI client with redacted input", async () => {
  const res = await ask({ message: "my email is a@b.com", mode: "question", lang: "en" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { reply: "Hello friend!" });
  assert.equal(lastAsk.message, "my email is [email]");
});

test("returns friendly errors", async () => {
  assert.equal((await ask({ message: "" })).status, 400);
  const res = await ask({ message: "fail" });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: "buddy_unavailable" });
});

test("rate limits after the configured number of requests", async () => {
  // 4 requests already used above in this window; limit is 5.
  let last;
  for (let i = 0; i < 3; i++) last = await ask({ message: "hi" });
  assert.equal(last.status, 429);
});
