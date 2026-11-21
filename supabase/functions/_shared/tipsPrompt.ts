// Builds what we send to the AI for "personalise these tips". Pure code with
// no imports, so it is unit-tested with Node (tipsPrompt.test.ts) and used by
// the Deno server function (tips-ai/index.ts).
//
// Privacy: the AI gets only the child's age in months, gender, the section
// and our own reviewed tips. Never the name, birth date or anything a parent
// typed (there is no free-text box).

export type Section = 'sleep' | 'feeding' | 'activities' | 'learning' | 'health';
export const SECTIONS: Section[] = ['sleep', 'feeding', 'activities', 'learning', 'health'];
export type Tip = { title_en: string; body_en: string; title_ar: string; body_ar: string };

export function ageInMonths(birthDay: string, today: Date): number {
  const [y, m, d] = birthDay.split('-').map(Number);
  let months = (today.getUTCFullYear() - y) * 12 + (today.getUTCMonth() + 1 - m);
  if (today.getUTCDate() < d) months -= 1;
  return Math.max(0, months);
}

export function buildMessages(input: { ageMonths: number; gender: 'girl' | 'boy'; section: Section; lang: 'ar' | 'en'; tips: Tip[] }) {
  const language = input.lang === 'ar' ? 'Modern Standard Arabic that is easy to read' : 'plain, simple English';
  const system = [
    'You help parents in Kuwait care for their children aged 0 to 10.',
    `Always reply in ${language}.`,
    'Rewrite the reviewed tips below as 3 to 5 short, practical bullet points for this specific child.',
    'Rules you must always follow:',
    '- Use ONLY the information in the reviewed tips. Do not add medical facts, doses, products or brands.',
    '- Never diagnose. If something could be a health problem, say to see the child\'s doctor.',
    '- Be warm, short (under 120 words) and respectful of Kuwaiti culture and Islamic values.',
    '- Do not ask questions back and do not ask for personal information.',
  ].join('\n');
  const tipsText = input.tips
    .map((t, i) => `${i + 1}. ${input.lang === 'ar' ? `${t.title_ar}: ${t.body_ar}` : `${t.title_en}: ${t.body_en}`}`)
    .join('\n');
  const user = `Child: ${input.ageMonths} months old, ${input.gender}.\nTopic: ${input.section}.\nReviewed tips:\n${tipsText}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** Pull the text pieces out of one chunk of an OpenAI-style event stream. Returns [pieces, leftover]. */
export function parseSSE(buffer: string): [string[], string, boolean] {
  const pieces: string[] = [];
  let done = false;
  let nl: number;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') {
      done = true;
      break;
    }
    try {
      const piece = JSON.parse(payload)?.choices?.[0]?.delta?.content;
      if (typeof piece === 'string' && piece) pieces.push(piece);
    } catch {
      // ignore partial or non-JSON lines
    }
  }
  return [pieces, buffer, done];
}
