import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { createOmniRouteClient } from "./omniroute.js";

const config = loadConfig();
const ai = createOmniRouteClient(config.omniroute);
const server = createApp({ ai, rateLimit: config.rateLimit });

if (!config.omniroute.apiKey) {
  console.warn("[kids-app] OMNIROUTE_API_KEY is not set. The AI helper will be unavailable until you add it (see README).");
}

server.listen(config.port, () => {
  console.log(`[kids-app] running on http://localhost:${config.port} (AI via ${config.omniroute.baseUrl}, model ${config.omniroute.model})`);
});

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
