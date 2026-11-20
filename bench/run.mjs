// Page-load and AI-reply benchmark using Chromium via Playwright + Chrome DevTools Protocol.
// Throttling matches Chrome DevTools presets: "Slow 4G" network and 4x CPU slowdown.
//
// Usage: node bench/run.mjs http://localhost:3000 [runs]
// Requires Playwright with Chromium installed locally (not a project dependency).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require(require.resolve("playwright", { paths: [process.execPath + "/../../lib/node_modules"] })));
}

const BASE = process.argv[2] || "http://localhost:3000";
const RUNS = Number(process.argv[3] || 5);

// DevTools "Slow 4G" preset values (SDK NetworkManager): 1.6 Mbps * 0.9 down, 750 kbps * 0.9 up, 150 ms * 3.75 RTT.
const SLOW_4G = {
  offline: false,
  latency: 562.5,
  downloadThroughput: (1.6 * 1000 * 1000) / 8 * 0.9,
  uploadThroughput: (750 * 1000) / 8 * 0.9,
};
const CPU_RATE = 4;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function throttled(context) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });
  let bytes = 0;
  cdp.on("Network.loadingFinished", (e) => (bytes += e.encodedDataLength));
  return { page, getBytes: () => bytes, resetBytes: () => (bytes = 0) };
}

async function paintMetrics(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let lcp = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) lcp = e.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => {
          const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null;
          const nav = performance.getEntriesByType("navigation")[0];
          resolve({ fcp, lcp, load: nav.loadEventEnd });
        }, 300);
      }),
  );
}

async function measureLoad(browser) {
  const cold = [], warm = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const { page, getBytes, resetBytes } = await throttled(context);
    await page.goto(BASE, { waitUntil: "load" });
    cold.push({ ...(await paintMetrics(page)), bytes: getBytes() });
    resetBytes();
    await page.goto(BASE, { waitUntil: "load" }); // repeat visit, same cache
    warm.push({ ...(await paintMetrics(page)), bytes: getBytes() });
    await context.close();
  }
  const summarize = (rows) => Object.fromEntries(["fcp", "lcp", "load", "bytes"].map((k) => [k, Math.round(median(rows.map((r) => r[k])))]));
  return { cold: summarize(cold), warm: summarize(warm) };
}

async function measureAsk(browser) {
  const firstText = [], fullText = [], flashes = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const { page } = await throttled(context);
    await page.goto(BASE, { waitUntil: "load" });
    await page.fill("#message", "a camel who loves the sea");
    const t = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const answer = document.querySelector("#answer");
          const start = performance.now();
          let first = null;
          const states = new Set();
          const obs = new MutationObserver(() => {
            if (!answer.hidden && answer.classList.contains("skeleton")) states.add("skeleton");
            const txt = answer.textContent;
            if (first === null && txt.includes("tok0")) first = performance.now() - start;
            if (txt.includes("tok39")) {
              obs.disconnect();
              resolve({ first, full: performance.now() - start, states: [...states] });
            }
          });
          obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
          document.querySelector("#send").click();
        }),
    );
    firstText.push(t.first);
    fullText.push(t.full);
    flashes.push(t.states.join(","));
    await context.close();
  }
  return { firstAnswerTextMs: Math.round(median(firstText)), fullAnswerMs: Math.round(median(fullText)), statesSeen: flashes[0] };
}

const browser = await chromium.launch();
const result = {
  conditions: { network: "DevTools Slow 4G", ...SLOW_4G, cpuThrottlingRate: CPU_RATE, runs: RUNS, viewport: "390x844", browser: browser.version() },
  load: await measureLoad(browser),
  ask: await measureAsk(browser),
};
await browser.close();
console.log(JSON.stringify(result, null, 2));
