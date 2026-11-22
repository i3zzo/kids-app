// Composes the captioned store screenshots and the Play feature graphic.
// Usage: node scripts/store/compose-screenshots.js <raw captures dir> store/screenshots <font dir> apps/mobile/assets/icon.png
// Fonts: IBM Plex Sans Arabic and Inter (both SIL Open Font License), from
// `npm pack @fontsource/ibm-plex-sans-arabic @fontsource/inter` (files/ folders).
// Captions live in `caps` below and match docs/launch/store-listing.md.
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const [rawDir, outDir, fontDir] = process.argv.slice(2);
const caps = {
  home:     {ar:['يوم العائلة في شاشة واحدة','المواعيد والتطعيمات والنصائح لكل طفل'], en:["Your family's day at a glance",'Events, vaccinations and tips for each child']},
  calendar: {ar:['تقويم واحد لك ولشريكك','تمارين ودروس ومواعيد مع تذكير قبلها'], en:['One calendar for both parents','Training, classes and appointments, with reminders']},
  vaccines: {ar:['التطعيمات في وقتها','حسب جدول وزارة الصحة، مع تذكير قبل كل جرعة'], en:['Every vaccination, on time','Kuwait MOH schedule, with a reminder before each dose']},
  supplies: {ar:['لا تتفاجأ بنفاد الحفاضات','تابع المستلزمات وتنبيه عندما تقارب على النفاد'], en:['Never run out of diapers','Track supplies and get an alert when they run low']},
  explore:  {ar:['المعاملات الحكومية خطوة بخطوة','شهادة الميلاد والبطاقة المدنية والجواز، ودليل الأماكن'], en:['Paperwork, step by step','Birth certificate, civil ID, passport, and a directory of places']},
  tips:     {ar:['نصائح تناسب عمر طفلك','النوم والتغذية والأنشطة والتعلّم'], en:["Tips for your child's age",'Sleep, feeding, activities and learning']},
};
const order=['home','calendar','vaccines','supplies','explore','tips'];
const sizes = { 'ios-6.9': [1320,2868], 'android-phone': [1080,1920] };
const font = f => 'data:font/woff2;base64,'+fs.readFileSync(path.join(fontDir,f)).toString('base64');
const css = `
@font-face{font-family:Plex;src:url(${font('ibm-plex-sans-arabic-arabic-700-normal.woff2')});font-weight:700}
@font-face{font-family:Plex;src:url(${font('ibm-plex-sans-arabic-arabic-400-normal.woff2')});font-weight:400}
@font-face{font-family:Inter;src:url(${font('inter-latin-700-normal.woff2')});font-weight:700}
@font-face{font-family:Inter;src:url(${font('inter-latin-500-normal.woff2')});font-weight:400}
*{margin:0;box-sizing:border-box}
body{background:linear-gradient(180deg,#0E7C86 0%,#0A5F67 100%);overflow:hidden;font-family:Inter,Plex,sans-serif;color:#fff;text-align:center}
.cap{position:absolute;left:7%;right:7%}
h1{font-weight:700;line-height:1.15}
p{font-weight:400;opacity:.9;line-height:1.35}
.phone{position:absolute;left:50%;transform:translateX(-50%);border-radius:var(--r);overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35);border:var(--b) solid #10232b}
.phone img{display:block;width:100%}
.pearl{position:absolute;border-radius:50%;background:#fff}
`;
(async()=>{
  const b=await chromium.launch();
  for (const [name,[W,H]] of Object.entries(sizes)) for (const lang of ['ar','en']) {
    const p=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
    for (const [i,k] of order.entries()) {
      const img='data:image/png;base64,'+fs.readFileSync(path.join(rawDir,`${lang}-${k}.png`)).toString('base64');
      const u=W/1320; const pw=Math.round(W*0.80); const top=Math.round(H*(name==='ios-6.9'?0.215:0.235));
      const [t,s]=caps[k][lang];
      await p.setContent(`<html dir="${lang==='ar'?'rtl':'ltr'}"><style>${css}</style><body style="width:${W}px;height:${H}px;--r:${Math.round(70*u)}px;--b:${Math.round(14*u)}px">
        <div class="pearl" style="width:${90*u}px;height:${90*u}px;top:${70*u}px;${lang==='ar'?'left':'right'}:${70*u}px;opacity:.12"></div>
        <div class="cap" style="top:${Math.round(H*0.055)}px"><h1 style="font-size:${Math.round(98*u)}px">${t}</h1><p style="font-size:${Math.round(52*u)}px;margin-top:${Math.round(28*u)}px">${s}</p></div>
        <div class="phone" style="top:${top}px;width:${pw}px"><img src="${img}"></div></body></html>`);
      await p.evaluate(()=>document.fonts.ready);
      fs.mkdirSync(path.join(outDir,name,lang),{recursive:true});
      await p.screenshot({path:path.join(outDir,name,lang,`${i+1}-${k}.png`)});
    }
    await p.close();
  }
  // Google Play feature graphic 1024x500
  const icon='data:image/png;base64,'+fs.readFileSync(process.argv[5]).toString('base64');
  for (const lang of ['ar','en']) {
    const p=await b.newPage({viewport:{width:1024,height:500}});
    const [t,s]= lang==='ar'?['ياهل','كل ما يخص أطفالك في مكان واحد']:['Yahal','Your children, all in one place'];
    await p.setContent(`<html dir="${lang==='ar'?'rtl':'ltr'}"><style>${css} .row{display:flex;align-items:center;gap:56px;height:500px;padding:0 90px} .row img{width:260px;border-radius:58px;box-shadow:0 20px 50px rgba(0,0,0,.3)} .row div{text-align:start}</style><body style="width:1024px;height:500px"><div class="row"><img src="${icon}"><div><h1 style="font-size:96px">${t}</h1><p style="font-size:40px;margin-top:14px">${s}</p></div></div></body></html>`);
    await p.evaluate(()=>document.fonts.ready);
    fs.mkdirSync(path.join(outDir,'android-feature-graphic'),{recursive:true});
    await p.screenshot({path:path.join(outDir,'android-feature-graphic',`feature-graphic-${lang}.png`)});
    await p.close();
  }
  await b.close();
})();
