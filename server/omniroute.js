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

  function requestInit({ message, mode, lang }, stream, signal) {
    return {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: stream ? "text/event-stream" : "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: mode === "story" ? 0.8 : 0.4,
        stream,
        messages: [
          { role: "system", content: buildSystemPrompt({ mode, lang }) },
          { role: "user", content: message },
        ],
      }),
      signal,
    };
  }

  async function post(input, stream, signal) {
    if (!apiKey) throw new OmniRouteError("OMNIROUTE_API_KEY is not set", { code: "not_configured" });
    let res;
    try {
      res = await fetchImpl(`${baseUrl}/chat/completions`, requestInit(input, stream, signal));
    } catch (err) {
      const code = err?.name === "AbortError" || err?.name === "TimeoutError" ? "timeout" : "unreachable";
      throw new OmniRouteError(`OmniRoute request failed: ${code}`, { code });
    }
    if (!res.ok) {
      throw new OmniRouteError(`OmniRoute returned ${res.status}`, { status: res.status, code: "upstream_error" });
    }
    return res;
  }

  // Whole reply at once.
  async function ask(input) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await post(input, false, controller.signal);
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (typeof reply !== "string" || !reply.trim()) {
        throw new OmniRouteError("OmniRoute returned an empty reply", { code: "empty_reply" });
      }
      return reply.trim();
    } finally {
      clearTimeout(timer);
    }
  }

  // Streams the reply as text pieces (async iterator). The timeout is an idle timeout:
  // it resets every time the gateway sends data, so long stories aren't cut off.
  // Pass `signal` to cancel (e.g. when the child closes the page).
  async function* askStream(input, { signal } = {}) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    let timer = setTimeout(onAbort, timeoutMs);
    const touch = () => {
      clearTimeout(timer);
      timer = setTimeout(onAbort, timeoutMs);
    };

    let yielded = false;
    try {
      const res = await post(input, true, controller.signal);
      touch();

      // A gateway may ignore stream:true and answer with plain JSON.
      if (!(res.headers.get("content-type") || "").includes("text/event-stream")) {
        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (typeof reply === "string" && reply.trim()) {
          yielded = true;
          yield reply.trim();
        }
      } else {
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;
        try {
          for await (const chunk of res.body) {
            touch();
            buffer += decoder.decode(chunk, { stream: true });
            let nl;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") {
                done = true;
                break;
              }
              let event;
              try {
                event = JSON.parse(payload);
              } catch {
                continue;
              }
              const piece = event?.choices?.[0]?.delta?.content;
              if (typeof piece === "string" && piece) {
                yield yielded ? piece : piece.trimStart();
                yielded = true;
              }
            }
            if (done) break;
          }
        } catch (err) {
          if (err instanceof OmniRouteError) throw err;
          const code = controller.signal.aborted ? "timeout" : "stream_error";
          throw new OmniRouteError(`OmniRoute stream failed: ${code}`, { code });
        }
      }
      if (!yielded) throw new OmniRouteError("OmniRoute returned an empty reply", { code: "empty_reply" });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      controller.abort(); // close the upstream connection if the caller stopped early
    }
  }

  return { ask, askStream };
}
