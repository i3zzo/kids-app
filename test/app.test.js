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
  askStream: async function* (input) {
    lastAsk = input;
    if (input.message === "fail") throw Object.assign(new Error("x"), { code: "upstream_error" });
    yield "Once ";
    yield "upon ";
    if (input.message === "break") throw Object.assign(new Error("x"), { code: "stream_error" });
    yield "a time.";
  },
};

before(async () => {
  server = await createApp({ ai, rateLimit: { windowMs: 60_000, max: 1000 } });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const ask = (body) =>
  fetch(`${base}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const readLines = async (res) => (await res.text()).trim().split("\n").map((l) => JSON.parse(l));

test("serves the home page with Arabic text, inlined CSS and a matching CSP hash", async () => {
  const res = await fetch(base + "/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /<h1 data-i18n="title">صديقي بادي<\/h1>/);
  assert.match(html, /<style>[\s\S]*--accent[\s\S]*<\/style>/);
  assert.doesNotMatch(html, /href="\/styles\.css"/);
  assert.match(res.headers.get("content-security-policy"), /style-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
  assert.equal(res.headers.get("cache-control"), "no-cache");
});

test("hashed assets are cached as immutable, unversioned ones revalidate", async () => {
  const html = await (await fetch(base + "/")).text();
  const jsUrl = html.match(/src="(\/app\.js\?v=[0-9a-f]+)"/)[1];
  const versioned = await fetch(base + jsUrl);
  assert.equal(versioned.status, 200);
  assert.equal(versioned.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal((await fetch(base + "/app.js?v=stale")).headers.get("cache-control"), "no-cache");
  assert.equal((await fetch(base + "/app.js")).headers.get("cache-control"), "no-cache");
});

test("compresses text assets and answers 304 for a matching ETag", async () => {
  const res = await fetch(base + "/app.js", { headers: { "Accept-Encoding": "br" } });
  assert.equal(res.headers.get("content-encoding"), "br");
  assert.equal(res.headers.get("vary"), "Accept-Encoding");
  const etag = res.headers.get("etag");
  const again = await fetch(base + "/app.js", { headers: { "If-None-Match": etag } });
  assert.equal(again.status, 304);
});

test("blocks path traversal and unknown files", async () => {
  assert.equal((await fetch(base + "/..%2fpackage.json")).status, 404);
  assert.equal((await fetch(base + "/nope.js")).status, 404);
  assert.equal((await fetch(base + "/%E0%A4%A")).status, 404);
});

test("answers via the AI client with redacted input (non-streaming)", async () => {
  const res = await ask({ message: "my email is a@b.com", mode: "question", lang: "en" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { reply: "Hello friend!" });
  assert.equal(lastAsk.message, "my email is [email]");
});

test("streams the reply as NDJSON when asked", async () => {
  const res = await ask({ message: "a camel 99887766", stream: true });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/x-ndjson/);
  assert.deepEqual(await readLines(res), [{ delta: "Once " }, { delta: "upon " }, { delta: "a time." }, { done: true }]);
  assert.equal(lastAsk.message, "a camel [phone]");
});

test("stream failures: before the first piece -> 502, mid-stream -> error line", async () => {
  const early = await ask({ message: "fail", stream: true });
  assert.equal(early.status, 502);
  assert.deepEqual(await early.json(), { error: "buddy_unavailable" });

  const mid = await ask({ message: "break", stream: true });
  assert.equal(mid.status, 200);
  assert.deepEqual(await readLines(mid), [{ delta: "Once " }, { delta: "upon " }, { error: "buddy_unavailable" }]);
});

test("returns friendly errors", async () => {
  assert.equal((await ask({ message: "" })).status, 400);
  const res = await ask({ message: "fail" });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: "buddy_unavailable" });
});

test("rate limits after the configured number of requests", async () => {
  const s = await createApp({ ai, rateLimit: { windowMs: 60_000, max: 2 } });
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${s.address().port}/api/ask`;
  const post = () => fetch(url, { method: "POST", body: JSON.stringify({ message: "hi" }) });
  const statuses = [];
  for (let i = 0; i < 3; i++) statuses.push((await post()).status);
  s.close();
  assert.deepEqual(statuses, [200, 200, 429]);
});
