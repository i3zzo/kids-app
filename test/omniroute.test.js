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
