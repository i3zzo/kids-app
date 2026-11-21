// "Personalise with AI": rewrites our reviewed tips for one child, streamed.
//
// Runs on the server (Supabase Edge Function). The OmniRoute key is a server
// secret (env), never in the app. The parent's own login is passed through to
// the database, so Row Level Security decides which child they may ask about.
//
// Request:  POST { child_id, section, lang }   (Authorization: Bearer <parent token>)
// Response: text/plain, streamed as the AI writes.
import { ageInMonths, buildMessages, parseSSE, SECTIONS, type Section, type Tip } from '../_shared/tipsPrompt.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const OMNIROUTE_BASE_URL = (Deno.env.get('OMNIROUTE_BASE_URL') ?? '').replace(/\/+$/, '');
const OMNIROUTE_API_KEY = Deno.env.get('OMNIROUTE_API_KEY') ?? '';
const OMNIROUTE_MODEL = Deno.env.get('OMNIROUTE_MODEL') ?? 'auto';
const TIMEOUT_MS = Number(Deno.env.get('OMNIROUTE_TIMEOUT_MS') ?? 30000);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** Call the database as the parent (their token), so RLS applies. */
async function db(path: string, auth: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ANON_KEY, Authorization: auth, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`db ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json(401, { error: 'not_signed_in' });

  let body: { child_id?: string; section?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_body' });
  }
  const { child_id, section, lang } = body;
  if (typeof child_id !== 'string' || !/^[0-9a-f-]{36}$/.test(child_id)) return json(400, { error: 'invalid_child' });
  if (!SECTIONS.includes(section as Section)) return json(400, { error: 'invalid_section' });
  if (lang !== 'ar' && lang !== 'en') return json(400, { error: 'invalid_lang' });
  if (!OMNIROUTE_BASE_URL || !OMNIROUTE_API_KEY) return json(503, { error: 'ai_not_configured' });

  try {
    // RLS: returns nothing if this child isn't in the parent's family.
    const children = (await db(`children?id=eq.${child_id}&select=birth_date,gender`, auth)) as { birth_date: string; gender: 'girl' | 'boy' }[];
    if (!children.length) return json(404, { error: 'child_not_found' });
    const { birth_date, gender } = children[0];
    const ageMonths = ageInMonths(birth_date, new Date());

    const allowed = await db('rpc/claim_ai_request', auth, { method: 'POST', body: '{}' });
    if (allowed !== true) return json(429, { error: 'daily_limit' });

    const tips = (await db(
      `tips?select=title_ar,title_en,body_ar,body_en&section=eq.${section}&min_age_months=lte.${ageMonths}&max_age_months=gte.${ageMonths}&or=(only_gender.is.null,only_gender.eq.${gender})&order=sort_order&limit=6`,
      auth,
    )) as Tip[];
    if (!tips.length) return json(404, { error: 'no_tips' });

    // Idle timeout: resets whenever the AI sends data.
    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const touch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    };
    req.signal.addEventListener('abort', () => controller.abort());

    const upstream = await fetch(`${OMNIROUTE_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${OMNIROUTE_API_KEY}` },
      body: JSON.stringify({
        model: OMNIROUTE_MODEL,
        stream: true,
        temperature: 0.3,
        max_tokens: 350,
        messages: buildMessages({ ageMonths, gender, section: section as Section, lang, tips }),
      }),
    });
    if (!upstream.ok || !upstream.body) {
      clearTimeout(timer);
      return json(502, { error: 'ai_unavailable' });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new ReadableStream({
      async start(out) {
        let buffer = '';
        try {
          for await (const chunk of upstream.body!) {
            touch();
            const [pieces, rest, done] = parseSSE(buffer + decoder.decode(chunk, { stream: true }));
            buffer = rest;
            for (const p of pieces) out.enqueue(encoder.encode(p));
            if (done) break;
          }
        } catch {
          // timeout or client closed: end what we have
        } finally {
          clearTimeout(timer);
          out.close();
        }
      },
    });
    // Nothing about the child or the answer is logged.
    return new Response(stream, {
      headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return json(502, { error: 'failed' });
  }
});
