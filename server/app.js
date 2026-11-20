import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAskRequest } from "./safety.js";
import { createRateLimiter } from "./rateLimit.js";

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const MAX_BODY_BYTES = 8 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
}

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

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, "Not found");
  try {
    const data = await readFile(filePath);
    send(res, 200, data, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
  } catch {
    send(res, 404, "Not found");
  }
}

// `ai` is anything with an async ask({ message, mode, lang }) -> string.
export function createApp({ ai, rateLimit }) {
  const allow = createRateLimiter(rateLimit);

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

        try {
          const reply = await ai.ask(check.value);
          return sendJson(res, 200, { reply });
        } catch (err) {
          // Log the failure reason only, never the child's message.
          console.error(`[ask] AI request failed: ${err.code || err.message}`);
          return sendJson(res, 502, { error: "buddy_unavailable" });
        }
      }

      if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
      return send(res, 405, "Method not allowed");
    } catch (err) {
      console.error(`[server] ${err.message}`);
      if (!res.headersSent) sendJson(res, 500, { error: "server_error" });
    }
  });
}
