// Loads public/ into memory once at startup and serves it with:
// - content-hashed URLs (?v=<hash>) for JS/SVG, cached for a year as immutable,
// - index.html revalidated on every visit (no-cache + ETag), so a deploy is picked up at once,
// - critical CSS inlined into index.html (saves a render-blocking round trip), allowed by a CSP hash,
// - precomputed Brotli/gzip for text files.
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import zlib from "node:zlib";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".svg"]);
const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "no-cache";

const hash = (buf, len = 12) => createHash("sha256").update(buf).digest("hex").slice(0, len);

function makeEntry(name, body) {
  const ext = path.extname(name);
  const entry = { body, type: MIME[ext] || "application/octet-stream", etag: `W/"${hash(body, 16)}"`, version: hash(body) };
  if (COMPRESSIBLE.has(ext) && body.length > 256) {
    entry.br = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
    entry.gzip = zlib.gzipSync(body, { level: 9 });
  }
  return entry;
}

export async function loadStatic(publicDir) {
  const names = (await readdir(publicDir)).filter((n) => !n.startsWith("."));
  // Independent reads, so do them in parallel.
  const bodies = await Promise.all(names.map((n) => readFile(path.join(publicDir, n))));
  const files = new Map(names.map((n, i) => [n, makeEntry(n, bodies[i])]));

  let styleHash = null;
  const index = files.get("index.html");
  if (index) {
    let html = index.body.toString("utf8");
    const css = files.get("styles.css");
    if (css) {
      const cssText = css.body.toString("utf8");
      styleHash = createHash("sha256").update(cssText).digest("base64");
      html = html.replace(/<link rel="stylesheet" href="\/styles\.css">/, () => `<style>${cssText}</style>`);
    }
    // Point asset references at their content-hashed URLs.
    html = html.replace(/(src|href)="\/([\w.-]+\.(?:js|svg|css))"/g, (m, attr, name) =>
      files.has(name) ? `${attr}="/${name}?v=${files.get(name).version}"` : m,
    );
    files.set("index.html", makeEntry("index.html", Buffer.from(html)));
  }

  const csp = [
    "default-src 'self'",
    "img-src 'self' data:",
    `style-src 'self'${styleHash ? ` 'sha256-${styleHash}'` : ""}`,
    "script-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return { files, csp };
}

function pickEncoding(entry, acceptEncoding = "") {
  if (entry.br && /\bbr\b/.test(acceptEncoding)) return ["br", entry.br];
  if (entry.gzip && /\bgzip\b/.test(acceptEncoding)) return ["gzip", entry.gzip];
  return [null, entry.body];
}

// Returns { status, headers, body } for a GET/HEAD request, or null if not found.
export function staticResponse({ files }, req) {
  const url = new URL(req.url, "http://x");
  let name;
  try {
    name = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  } catch {
    return null;
  }
  // Only flat file names from the preloaded map: no path traversal possible.
  const entry = files.get(name);
  if (!entry || name.includes("/")) return null;

  const versioned = url.searchParams.get("v") === entry.version;
  const headers = {
    "Content-Type": entry.type,
    "Cache-Control": versioned && name !== "index.html" ? IMMUTABLE : REVALIDATE,
    ETag: entry.etag,
    Vary: "Accept-Encoding",
  };
  if (req.headers["if-none-match"] === entry.etag) return { status: 304, headers, body: null };

  const [encoding, body] = pickEncoding(entry, req.headers["accept-encoding"]);
  if (encoding) headers["Content-Encoding"] = encoding;
  headers["Content-Length"] = body.length;
  return { status: 200, headers, body: req.method === "HEAD" ? null : body };
}
