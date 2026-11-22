// Builds store/privacy/index.html from docs/launch/privacy-policy.md.
// Run from the repo root: npx -y -p marked@18 node scripts/store/build-privacy-page.mjs
// (or with marked installed). The page has no scripts, trackers or external files,
// so it can be hosted anywhere (GitHub Pages, Netlify, your own server).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { marked } from 'marked';

const md = readFileSync('docs/launch/privacy-policy.md', 'utf8');
// Drop the internal draft notes (the italic lines and the top title) from the public page.
const [, en, ar] = md.split(/^## (?:English|العربية)\s*$/m);
const clean = (s) => s.replace(/^---\s*$/gm, '').trim();
const section = (body, lang) =>
  marked.parse(clean(body))
    // anchor for the stores' "delete your account" link: section 8
    .replace(/<h3>(8\. Your rights|٨\. حقوقك)<\/h3>/, (_m, t) => `<h3 id="${lang === 'en' ? 'delete' : 'delete-ar'}">${t}</h3>`);
const updated = (md.match(/^Last updated: (.*)$/m) || [])[1] || '';

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>سياسة الخصوصية · Privacy policy · Yahal ياهل</title>
<meta name="description" content="Yahal privacy policy, in Arabic and English.">
<style>
  :root { --teal:#0E7C86; --ink:#1F2A37; --paper:#FBF5EC; --line:#E8DCCB; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:17px/1.65 system-ui,-apple-system,"Segoe UI","Noto Sans Arabic",Tahoma,sans-serif; }
  header { background:var(--teal); color:#fff; padding:28px 20px; }
  header .wrap, main { max-width:760px; margin:0 auto; }
  header h1 { margin:0 0 6px; font-size:26px; }
  header p { margin:0; opacity:.9; }
  nav { margin-top:14px; display:flex; gap:10px; flex-wrap:wrap; }
  nav a { color:#fff; border:1px solid rgba(255,255,255,.6); border-radius:999px; padding:6px 14px; text-decoration:none; font-size:15px; }
  main { padding:8px 20px 60px; }
  section { margin-top:28px; }
  h2 { font-size:24px; border-bottom:2px solid var(--line); padding-bottom:6px; }
  h3 { font-size:19px; margin-top:28px; color:var(--teal); scroll-margin-top:16px; }
  table { border-collapse:collapse; width:100%; font-size:15px; display:block; overflow-x:auto; }
  th, td { border:1px solid var(--line); padding:8px 10px; vertical-align:top; text-align:start; }
  th { background:#F3E9DA; }
  a { color:var(--teal); }
  .draft p { margin:4px 0; }
  .draft { background:#FFF3CD; border:1px solid #F0D58C; padding:10px 14px; border-radius:8px; font-size:15px; }
</style>
</head>
<body>
<header><div class="wrap">
  <h1>ياهل · Yahal</h1>
  <p>سياسة الخصوصية · Privacy policy</p>
  <p>آخر تحديث · Last updated: ${updated}</p>
  <nav><a href="#ar">العربية</a><a href="#en" lang="en">English</a><a href="#delete-ar">حذف الحساب</a><a href="#delete" lang="en">Delete your account</a></nav>
</div></header>
<main>
  ${/\[[^\]]+\]/.test(md) ? '<div class="draft"><p dir="rtl">مسودة: لم يراجعها محامٍ بعد، والنص بين [أقواس] لم يُكمل. لا تنشر هذه النسخة.</p><p dir="ltr" lang="en">DRAFT: not yet reviewed by a lawyer, and text in [brackets] is still to be filled in. Do not publish this version.</p></div>' : ''}
  <section id="ar" lang="ar" dir="rtl"><h2>العربية</h2>${section(ar, 'ar')}</section>
  <section id="en" lang="en" dir="ltr"><h2>English</h2>${section(en, 'en')}</section>
</main>
</body>
</html>
`;
mkdirSync('store/privacy', { recursive: true });
writeFileSync('store/privacy/index.html', html);
console.log('wrote store/privacy/index.html');
