import { test } from "node:test";
import assert from "node:assert/strict";
import { createOmniRouteClient } from "../server/omniroute.js";

const cfg = { baseUrl: "http://gw:20128/v1", apiKey: "sk-test", model: "auto", timeoutMs: 1000, maxTokens: 400 };

test("sends an OpenAI-style request to OmniRoute with the key and system prompt", async () => {
  let call;
  const fakeFetch = async (url, init) => {
    call = { url, init };
    return { ok: true, json: async () => ({ choices: [{ message: { content: " Once upon a time... " } }] }) };
  };
  const reply = await createOmniRouteClient(cfg, fakeFetch).ask({ message: "a camel", mode: "story", lang: "en" });
  assert.equal(reply, "Once upon a time...");
  assert.equal(call.url, "http://gw:20128/v1/chat/completions");
  assert.equal(call.init.headers.Authorization, "Bearer sk-test");
  const body = JSON.parse(call.init.body);
  assert.equal(body.model, "auto");
  assert.equal(body.max_tokens, 400);
  assert.equal(body.messages[0].role, "system");
  assert.deepEqual(body.messages[1], { role: "user", content: "a camel" });
});

test("fails clearly without an API key", async () => {
  await assert.rejects(createOmniRouteClient({ ...cfg, apiKey: "" }).ask({ message: "hi", mode: "question", lang: "en" }), { code: "not_configured" });
});

test("maps upstream errors and empty replies", async () => {
  const bad = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(createOmniRouteClient(cfg, bad).ask({ message: "hi", mode: "question", lang: "en" }), { code: "upstream_error", status: 503 });
  const empty = async () => ({ ok: true, json: async () => ({ choices: [] }) });
  await assert.rejects(createOmniRouteClient(cfg, empty).ask({ message: "hi", mode: "question", lang: "en" }), { code: "empty_reply" });
  const down = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(createOmniRouteClient(cfg, down).ask({ message: "hi", mode: "question", lang: "en" }), { code: "unreachable" });
});

const sse = (events, { split = false } = {}) => {
  const text = events.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("");
  const enc = new TextEncoder().encode(text);
  // Optionally split mid-line to make sure partial chunks are buffered correctly.
  const chunks = split ? [enc.slice(0, 7), enc.slice(7, 30), enc.slice(30)] : [enc];
  return {
    ok: true,
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: (async function* () { yield* chunks; })(),
  };
};
const collect = async (it) => { const out = []; for await (const x of it) out.push(x); return out; };
const delta = (content) => ({ choices: [{ delta: { content } }] });

test("askStream asks for stream:true and yields text pieces", async () => {
  let sent;
  const fakeFetch = async (url, init) => {
    sent = JSON.parse(init.body);
    return sse([delta("  Once"), delta(" upon"), { choices: [{ delta: {} }] }, delta(" a time"), "[DONE]"], { split: true });
  };
  const pieces = await collect(createOmniRouteClient(cfg, fakeFetch).askStream({ message: "hi", mode: "story", lang: "en" }));
  assert.equal(sent.stream, true);
  assert.deepEqual(pieces, ["Once", " upon", " a time"]);
});

test("askStream falls back to a plain JSON reply", async () => {
  const fakeFetch = async () => ({ ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ choices: [{ message: { content: "Hi!" } }] }) });
  assert.deepEqual(await collect(createOmniRouteClient(cfg, fakeFetch).askStream({ message: "hi", mode: "question", lang: "en" })), ["Hi!"]);
});

test("askStream reports empty streams and upstream errors", async () => {
  const empty = async () => sse(["[DONE]"]);
  await assert.rejects(collect(createOmniRouteClient(cfg, empty).askStream({ message: "hi", mode: "question", lang: "en" })), { code: "empty_reply" });
  const bad = async () => ({ ok: false, status: 429 });
  await assert.rejects(collect(createOmniRouteClient(cfg, bad).askStream({ message: "hi", mode: "question", lang: "en" })), { code: "upstream_error" });
});

test("askStream times out when the gateway goes quiet", async () => {
  const stalled = async (url, init) => ({
    ok: true,
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: (async function* () {
      yield new TextEncoder().encode(`data: ${JSON.stringify(delta("Hi"))}\n\n`);
      await new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    })(),
  });
  const client = createOmniRouteClient({ ...cfg, timeoutMs: 50 }, stalled);
  await assert.rejects(collect(client.askStream({ message: "hi", mode: "question", lang: "en" })), { code: "timeout" });
});
