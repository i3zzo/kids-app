// Synthetic OpenAI-compatible gateway for benchmarks. Deterministic timing:
// first token after FIRST_TOKEN_MS, then TOKENS more tokens every TOKEN_GAP_MS.
// It stands in for OmniRoute + a real model, so absolute AI timings are synthetic.
import http from "node:http";

const PORT = Number(process.env.FAKE_PORT || 20999);
const FIRST_TOKEN_MS = Number(process.env.FIRST_TOKEN_MS || 800);
const TOKEN_GAP_MS = Number(process.env.TOKEN_GAP_MS || 50);
const TOKENS = Number(process.env.TOKENS || 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const words = Array.from({ length: TOKENS }, (_, i) => `tok${i} `);

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      const body = JSON.parse(raw);
      await sleep(FIRST_TOKEN_MS);
      if (body.stream) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const w of words) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: w } }] })}\n\n`);
          await sleep(TOKEN_GAP_MS);
        }
        res.end("data: [DONE]\n\n");
      } else {
        await sleep(TOKEN_GAP_MS * TOKENS);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: words.join("").trim() } }] }));
      }
    });
  })
  .listen(PORT, () => console.log(`fake gateway on ${PORT}`));
