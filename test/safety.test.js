import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAskRequest, redactPersonalInfo, buildSystemPrompt, MAX_INPUT_CHARS } from "../server/safety.js";

test("accepts a normal request and defaults mode/lang", () => {
  const r = validateAskRequest({ message: "  Why is the sky blue?  " });
  assert.deepEqual(r, { ok: true, value: { message: "Why is the sky blue?", mode: "question", lang: "en" } });
});

test("rejects empty, too long, and bad mode/lang", () => {
  assert.equal(validateAskRequest({ message: "   " }).error, "message_required");
  assert.equal(validateAskRequest({}).error, "message_required");
  assert.equal(validateAskRequest(null).error, "invalid_body");
  assert.equal(validateAskRequest({ message: "a".repeat(MAX_INPUT_CHARS + 1) }).error, "message_too_long");
  assert.equal(validateAskRequest({ message: "hi", mode: "hack" }).error, "invalid_mode");
  assert.equal(validateAskRequest({ message: "hi", lang: "fr" }).error, "invalid_lang");
});

test("redacts emails, Kuwaiti phone numbers and civil IDs", () => {
  assert.equal(redactPersonalInfo("mail me at kid@example.com"), "mail me at [email]");
  assert.equal(redactPersonalInfo("call +965 5555 1234"), "call [phone]");
  assert.equal(redactPersonalInfo("call 99887766"), "call [phone]");
  assert.equal(redactPersonalInfo("my id 290010112345"), "my id [id]");
  assert.equal(redactPersonalInfo("I have 3 cats"), "I have 3 cats");
});

test("validated message is redacted before it reaches the AI", () => {
  const r = validateAskRequest({ message: "story about me, my number is 66554433", mode: "story", lang: "ar" });
  assert.equal(r.value.message, "story about me, my number is [phone]");
});

test("system prompt follows language and mode", () => {
  assert.match(buildSystemPrompt({ mode: "story", lang: "ar" }), /Arabic/);
  assert.match(buildSystemPrompt({ mode: "story", lang: "ar" }), /story/);
  assert.match(buildSystemPrompt({ mode: "question", lang: "en" }), /simple English/);
  assert.match(buildSystemPrompt({ mode: "question", lang: "en" }), /Kuwait/);
});
