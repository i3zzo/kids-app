// Central config, read once from environment variables.
// Secrets (like the OmniRoute API key) live only on the server, never in the browser.

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    omniroute: {
      // Inside docker-compose the gateway is reachable by its service name.
      baseUrl: (env.OMNIROUTE_BASE_URL || "http://localhost:20128/v1").replace(/\/+$/, ""),
      apiKey: env.OMNIROUTE_API_KEY || "",
      // Pin this to a specific model from a provider you trust (see README).
      // "auto" lets OmniRoute pick any eligible provider you have connected.
      model: env.OMNIROUTE_MODEL || "auto",
      timeoutMs: Number(env.OMNIROUTE_TIMEOUT_MS || 30000),
      maxTokens: Number(env.OMNIROUTE_MAX_TOKENS || 400),
    },
    rateLimit: {
      windowMs: Number(env.RATE_LIMIT_WINDOW_MS || 60_000),
      max: Number(env.RATE_LIMIT_MAX || 10),
    },
  };
}
