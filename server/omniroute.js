// Minimal client for OmniRoute's OpenAI-compatible /v1/chat/completions endpoint.
import { buildSystemPrompt } from "./safety.js";

export class OmniRouteError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "OmniRouteError";
    this.status = status;
    this.code = code;
  }
}

export function createOmniRouteClient(config, fetchImpl = globalThis.fetch) {
  const { baseUrl, apiKey, model, timeoutMs, maxTokens } = config;

  async function ask({ message, mode, lang }) {
    if (!apiKey) throw new OmniRouteError("OMNIROUTE_API_KEY is not set", { code: "not_configured" });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: mode === "story" ? 0.8 : 0.4,
          messages: [
            { role: "system", content: buildSystemPrompt({ mode, lang }) },
            { role: "user", content: message },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const code = err?.name === "AbortError" ? "timeout" : "unreachable";
      throw new OmniRouteError(`OmniRoute request failed: ${code}`, { code });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new OmniRouteError(`OmniRoute returned ${res.status}`, { status: res.status, code: "upstream_error" });
    }
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new OmniRouteError("OmniRoute returned an empty reply", { code: "empty_reply" });
    }
    return reply.trim();
  }

  return { ask };
}
