import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAskRequest } from "./safety.js";
import { createRateLimiter } from "./rateLimit.js";
import { loadStatic, staticResponse } from "./static.js";

export const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const MAX_BODY_BYTES = 8 * 1024;

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("too_large"), { code: "too_large" }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// `ai` provides ask(input) -> string and, optionally, askStream(input, { signal }) -> async iterable of text.
export async function createApp({ ai, rateLimit, publicDir = PUBLIC_DIR }) {
  const allow = createRateLimiter(rateLimit);
  const assets = await loadStatic(publicDir);
  const securityHeaders = { ...BASE_HEADERS, "Content-Security-Policy": assets.csp };

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { ...securityHeaders, ...headers });
    res.end(body);
  };
  const sendJson = (res, status, obj) =>
    send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });

  async function streamReply(req, res, input) {
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) controller.abort(); // child left: stop the upstream generation
    });
    const iterator = ai.askStream(input, { signal: controller.signal })[Symbol.asyncIterator]();

    // Wait for the first piece before sending headers, so early failures still get a normal error status.
    let first;
    try {
      first = await iterator.next();
    } catch (err) {
      console.error(`[ask] AI request failed: ${err.code || err.message}`);
      return sendJson(res, 502, { error: "buddy_unavailable" });
    }

    res.writeHead(200, {
      ...securityHeaders,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no", // tell nginx-style proxies not to buffer the stream
    });
    try {
      for (let step = first; !step.done; step = await iterator.next()) {
        res.write(JSON.stringify({ delta: step.value }) + "\n");
      }
      res.end(JSON.stringify({ done: true }) + "\n");
    } catch (err) {
      if (!controller.signal.aborted) console.error(`[ask] AI stream failed: ${err.code || err.message}`);
      res.end(JSON.stringify({ error: "buddy_unavailable" }) + "\n");
    }
  }

  return http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, "http://x");

      if (pathname === "/healthz") return sendJson(res, 200, { ok: true });

      if (pathname === "/api/ask") {
        if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
        if (!allow(req.socket.remoteAddress || "unknown")) return sendJson(res, 429, { error: "slow_down" });

        let body;
        try {
          body = JSON.parse(await readBody(req));
        } catch (err) {
          return sendJson(res, err.code === "too_large" ? 413 : 400, { error: err.code === "too_large" ? "message_too_long" : "invalid_body" });
        }

        const check = validateAskRequest(body);
        if (!check.ok) return sendJson(res, 400, { error: check.error });

        if (body.stream === true && typeof ai.askStream === "function") return await streamReply(req, res, check.value);

        try {
          const reply = await ai.ask(check.value);
          return sendJson(res, 200, { reply });
        } catch (err) {
          // Log the failure reason only, never the child's message.
          console.error(`[ask] AI request failed: ${err.code || err.message}`);
          return sendJson(res, 502, { error: "buddy_unavailable" });
        }
      }

      if (req.method === "GET" || req.method === "HEAD") {
        const out = staticResponse(assets, req);
        if (!out) return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
        return send(res, out.status, out.body ?? undefined, out.headers);
      }
      return send(res, 405, "Method not allowed");
    } catch (err) {
      console.error(`[server] ${err.message}`);
      if (!res.headersSent) sendJson(res, 500, { error: "server_error" });
      else res.end();
    }
  });
}
