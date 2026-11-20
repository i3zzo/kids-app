// Kid-safety helpers applied before anything is sent to the AI gateway.

export const MAX_INPUT_CHARS = 500;

export const MODES = ["story", "question"];
export const LANGUAGES = ["ar", "en"];

// Remove personal details a child might type, so they never leave our server.
// Kuwaiti phone numbers are 8 digits (often with +965 / 00965 in front).
const PATTERNS = [
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, label: "[email]" },
  { re: /(?:\+|00)?965[\s-]?\d{4}[\s-]?\d{4}/g, label: "[phone]" },
  { re: /\b\d{4}[\s-]?\d{4}\b/g, label: "[phone]" },
  // Kuwaiti Civil ID numbers are 12 digits.
  { re: /\b\d{12}\b/g, label: "[id]" },
];

export function redactPersonalInfo(text) {
  let out = text;
  for (const { re, label } of PATTERNS) out = out.replace(re, label);
  return out;
}

// Validate and clean a request body. Returns { ok, value } or { ok: false, error }.
export function validateAskRequest(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const { message, mode = "question", lang = "en" } = body;
  if (typeof message !== "string") return { ok: false, error: "message_required" };
  // Strip control characters (keep normal whitespace).
  const cleaned = message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!cleaned) return { ok: false, error: "message_required" };
  if (cleaned.length > MAX_INPUT_CHARS) return { ok: false, error: "message_too_long" };
  if (!MODES.includes(mode)) return { ok: false, error: "invalid_mode" };
  if (!LANGUAGES.includes(lang)) return { ok: false, error: "invalid_lang" };
  return { ok: true, value: { message: redactPersonalInfo(cleaned), mode, lang } };
}

export function buildSystemPrompt({ mode, lang }) {
  const language = lang === "ar" ? "simple Modern Standard Arabic that a child can read" : "simple English";
  const task =
    mode === "story"
      ? "Write a short, gentle story (under 200 words) based on the child's idea, with a kind lesson at the end."
      : "Answer the child's question clearly and briefly (under 120 words), like a patient teacher.";
  return [
    "You are Buddy, a friendly helper inside a kids app used by children aged 6 to 12 in Kuwait.",
    `Always reply in ${language}.`,
    task,
    "Rules you must always follow:",
    "- Keep everything age-appropriate, kind and positive. No violence, scary content, romance, or anything unsafe.",
    "- Be respectful of Kuwaiti culture, Islamic values and local traditions.",
    "- Never ask for or repeat personal information (names of schools, addresses, phone numbers, photos).",
    "- Never suggest meeting anyone, visiting websites, or downloading anything.",
    "- If the child seems sad, hurt or in danger, kindly tell them to talk to a parent, teacher or trusted adult.",
    "- If a request is not suitable for children, gently refuse and suggest a fun, safe topic instead.",
  ].join("\n");
}
