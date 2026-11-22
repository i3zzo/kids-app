const { chromium } = require('playwright');
// Captures the six store screens from the web build at iPhone 6.9" size (1320x2868).
// Usage (see store/README.md):
//   SARA=<child id> YOUSEF=<child id> STATE=<signed-in storageState.json> OUT=<dir>/ \
//     node scripts/store/capture-screens.js <ar|en> yahal.locale
// Needs: local Supabase with scripts/store/demo-family.sql loaded, and the web build
// (npx expo export -p web) served as a single-page app on http://localhost:8081.
const S=process.env.OUT;
const [lang, key] = process.argv.slice(2);
const SARA=process.env.SARA, YOUSEF=process.env.YOUSEF;
const routes={home:'/home',calendar:'/calendar',vaccines:'/vaccines/'+SARA,supplies:'/supplies',explore:'/explore',tips:'/tips/'+SARA};
(async()=>{
  const b=await chromium.launch();
  const c=await b.newContext({storageState:process.env.STATE,viewport:{width:440,height:956},deviceScaleFactor:3});
  await c.addInitScript(([k,l])=>{ localStorage.setItem(k,l); },[key,lang]);
  const p=await c.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
  for (const [n,r] of Object.entries(routes)) {
    await p.goto('http://localhost:8081'+r); await p.waitForTimeout(3000);
    if (n==='supplies') { await p.getByText(lang==='ar'?'سارة':'Sara',{exact:true}).first().click(); await p.waitForTimeout(1500); }
    await p.screenshot({path:`${S}${lang}-${n}.png`});
  }
  await b.close();
})();
