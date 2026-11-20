const STRINGS = {
  ar: {
    title: "صديقي بادي",
    intro: "مرحبًا! أنا بادي. اختر ماذا تريد اليوم:",
    modeStory: "اصنع قصة",
    modeQuestion: "اسأل سؤالًا",
    placeholderStory: "عن ماذا تريد القصة؟ مثلاً: جمل صغير يحب البحر",
    placeholderQuestion: "اكتب سؤالك هنا. مثلاً: لماذا السماء زرقاء؟",
    send: "أرسل",
    thinking: "بادي يفكر...",
    switchLang: "English",
    safetyNote: "لا تكتب اسمك الكامل أو رقم هاتفك أو عنوانك. إذا شعرت بالحزن أو الخوف، تحدث مع أحد والديك أو معلمك.",
    errors: {
      slow_down: "مهلًا! انتظر دقيقة ثم حاول مرة أخرى.",
      message_too_long: "رسالتك طويلة جدًا. حاول أن تكتبها أقصر.",
      buddy_unavailable: "بادي مشغول الآن. حاول مرة أخرى بعد قليل.",
      default: "حدث خطأ. حاول مرة أخرى.",
    },
  },
  en: {
    title: "Buddy",
    intro: "Hi! I'm Buddy. What would you like to do today?",
    modeStory: "Make a story",
    modeQuestion: "Ask a question",
    placeholderStory: "What should the story be about? e.g. a little camel who loves the sea",
    placeholderQuestion: "Type your question here. e.g. Why is the sky blue?",
    send: "Send",
    thinking: "Buddy is thinking...",
    switchLang: "العربية",
    safetyNote: "Don't type your full name, phone number or address. If you feel sad or scared, talk to a parent or teacher.",
    errors: {
      slow_down: "Whoa! Wait a minute and try again.",
      message_too_long: "Your message is too long. Try making it shorter.",
      buddy_unavailable: "Buddy is busy right now. Please try again soon.",
      default: "Something went wrong. Please try again.",
    },
  },
};

const state = {
  lang: localStorage.getItem("lang") === "en" ? "en" : "ar",
  mode: "story",
};

const $ = (sel) => document.querySelector(sel);
const message = $("#message");
const answer = $("#answer");
const sendBtn = $("#send");

function t(key) {
  return STRINGS[state.lang][key];
}

function render() {
  const html = document.documentElement;
  html.lang = state.lang;
  html.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  $("#lang-toggle").textContent = t("switchLang");
  message.placeholder = state.mode === "story" ? t("placeholderStory") : t("placeholderQuestion");
  document.querySelectorAll(".mode").forEach((btn) => {
    const active = btn.dataset.mode === state.mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
}

function showAnswer(text, isError = false) {
  answer.hidden = false;
  answer.classList.toggle("error", isError);
  answer.textContent = text; // textContent, never innerHTML: AI output is untrusted.
}

$("#lang-toggle").addEventListener("click", () => {
  state.lang = state.lang === "ar" ? "en" : "ar";
  localStorage.setItem("lang", state.lang);
  render();
});

document.querySelectorAll(".mode").forEach((btn) =>
  btn.addEventListener("click", () => {
    state.mode = btn.dataset.mode;
    render();
  }),
);

message.addEventListener("input", () => {
  $("#count").textContent = `${message.value.length}/500`;
});

$("#ask-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = message.value.trim();
  if (!text) return;
  sendBtn.disabled = true;
  showAnswer(t("thinking"));
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, mode: state.mode, lang: state.lang }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.reply) showAnswer(data.reply);
    else showAnswer(t("errors")[data.error] || t("errors").default, true);
  } catch {
    showAnswer(t("errors").buddy_unavailable, true);
  } finally {
    sendBtn.disabled = false;
  }
});

render();
