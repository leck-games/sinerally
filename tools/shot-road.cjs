// Road screenshot at a fixed highway + trail spot (same centre-lines before/after the widening).
// usage: node tools/shot-road.cjs <suffix>   -> shots/upd_road_<suffix>.png and upd_trail_<suffix>.png (server on :18931)
let puppeteer; try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('/workspace/scratch/ptest/node_modules/puppeteer-core'); }
const SH = require('path').join(__dirname, '..', 'shots') + '/', sfx = process.argv[2] || 'now'; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); await p.setViewport({ width: 844, height: 390, hasTouch: false });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:18931/?gfx=Med&wx=clear&tod=0.4&dyn=0', { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' }); await sleep(4000);
  for (const [type, name] of [['HWY', 'road'], ['TRAIL', 'trail']]) {
    const at = await p.evaluate(type => { const W = __st.W, es = W.pathsNear(0, 0, 4000).filter(e => e.type === W[type] && !e.loop).sort((a, b) => (a.id + '').localeCompare(b.id + ''));
      for (const e of es) for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) { const P = W.pathPoint(e, t); if (P.bridge || P.y < 3) continue; const x = P.x, z = P.z, yaw = Math.atan2(P.tx, P.tz); __st.teleport(x, z, yaw); return { id: e.id, t, x, z }; } return null; }, type);
    await sleep(3500); await p.screenshot({ path: SH + `upd_${name}_${sfx}.png` }); console.log(name, sfx, JSON.stringify(at));
  }
  if (errs.length) console.log('errors', errs);
  await b.close();
})();
