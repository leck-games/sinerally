// Terrain module e2e (adapted from sinerally-terrain/test/e2e.mjs) run against the MERGED game: real physics instead of stub car, real-time waits.
let puppeteer; try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('/workspace/scratch/ptest/node_modules/puppeteer-core'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = []; const ok = (n, pass, info = '') => { res.push({ n, pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + n + '  ' + (typeof info === 'string' ? info : JSON.stringify(info))); };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({ width: 844, height: 390 });
  await p.goto('http://127.0.0.1:18931/?dyn=0&q=low&wx=clear&tod=0.4', { waitUntil: 'load' }); await sleep(3000);
  const E = (f, a) => p.evaluate(f, a);
  await E(() => { const { T } = __st; __st.setWx('clear'); T.setWind(0.6, 7); T.extinguishAll(); __st.toBiome('grassland'); });
  await sleep(1500);
  const g = await E(() => { const { T } = __st; const x = __st.x + 25, z = __st.z; return { x, z, lit: T.ignite(x, z, { radius: 4 }) }; });
  await sleep(30000); // ~12 s sim under SwiftShader
  const g2 = await E(() => { const { T } = __st; const s = T.stats().fire; return { burn: s.burning + (s.burntCells || 0), nonFuel: T.burningCells().filter(c => T.fuelAt(c.x, c.z) <= 0).length }; });
  ok('grassland fire spreads', g.lit > 0 && g2.burn > g.lit * 3, `lit ${g.lit} -> ${g2.burn} cells`);
  ok('no burning cells on non-fuel', g2.nonFuel === 0, '' + g2.nonFuel);
  // forest
  await E(() => { __st.T.extinguishAll(); __st.toBiome('forest'); }); await sleep(1500);
  const f = await E(() => { const { T } = __st; const x = __st.x + 8, z = __st.z; return { x, z, lit: T.ignite(x, z, { radius: 6 }) }; }); await sleep(8000);
  const f2 = await E(f => __st.T.burningCells().filter(c => Math.hypot(c.x - f.x, c.z - f.z) < 60).length, f);
  ok('forest does not ignite/spread', f.lit === 0 && f2 === 0, `lit ${f.lit}, burning ${f2}`);
  // rain extinguishes: find wet-under-storm grass spot
  const r = await E(() => { const { T } = __st; __st.setWx('storm'); const g = T.findBiome('grassland', __st.x, __st.z); let fx = g.x, fz = g.z;
    for (let i = 0; i < 20000; i++) { const a = i * 2.39996, rr = 4 * Math.sqrt(i); fx = g.x + Math.cos(a) * rr; fz = g.z + Math.sin(a) * rr; if (T.fuelAt(fx, fz) > 0.6 && T.rainAt(fx, fz) > 0.6 && !T.fireAt(fx, fz).burnt) break; }
    __st.setWx('clear'); __st.teleport(fx - 25, fz); return { fx, fz }; });
  await sleep(2000);
  const lit = await E(r => __st.T.ignite(r.fx, r.fz, { radius: 4 }), r); await sleep(6000);
  const before = await E(() => __st.T.stats().fire.burning);
  const rainHere = await E(r => { __st.setWx('storm'); return +__st.T.rainAt(r.fx, r.fz).toFixed(2); }, r); await sleep(32000);
  const after = await E(() => __st.T.stats().fire.burning);
  ok('rain extinguishes fire', before > 0 && after === 0 && rainHere > 0.5, `lit ${lit}, ${before} burning -> ${after} after storm (rain ${rainHere})`);
  await E(() => { __st.setWx('clear'); __st.T.extinguishAll(); });
  // HP rule (vendored physics) + tree HP integer contract
  const rule = await E(() => [60, 150, 200, 250, 301, 350].map(v => +__st.PH.treeDamage(v, 1).toFixed(2)).concat([+__st.PH.treeDamage(150, 0).toFixed(2)]));
  ok('HP rule (physics treeDamage)', rule[5] >= 3 && rule[4] >= 3 && rule[2] < 3 && rule[6] < rule[1], 'head-on @60/150/200/250/301/350, side@150 = ' + rule.join(','));
  const hp = await E(() => { const { T } = __st; __st.toBiome('forest'); const t = T.queryTrees(__st.x, __st.z, 40).filter(t => t.hp === 3)[0]; T.setTreeHP(t.id, 2); const a = T.getTree(t.id).hp; T.setTreeHP(t.id, 1); const b2 = T.getTree(t.id).hp; T.removeTree(t.id); return [a, b2, !T.queryTrees(t.pos.x, t.pos.z, 1).some(q => q.id === t.id)]; });
  ok('tree HP 3->2->1->gone', hp[0] === 2 && hp[1] === 1 && hp[2], JSON.stringify(hp));
  // >300 km/h drive-through with real physics
  await sleep(1000);
  await E(() => { window.__rm = 0; __st.bus.on('tree:destroyed', () => window.__rm++); });
  const x0 = await E(() => [__st.x, __st.z]);
  await p.keyboard.down('ArrowUp');
  for (let i = 0; i < 12; i++) { await E(() => { const v = __st.veh, s = 340 / 3.6; v.v.x = v.fwd.x * s; v.v.z = v.fwd.z * s; for (const w of v.wheels) w.omega = s / v.P.wheelR; v.gear = 6; }); await sleep(150); }
  await p.keyboard.up('ArrowUp');
  const fast = await E(x0 => ({ rm: window.__rm, d: Math.hypot(__st.x - x0[0], __st.z - x0[1]) }), x0);
  ok('>300 km/h zooms through trees', fast.rm > 0, `${fast.rm} trees destroyed over ${fast.d.toFixed(0)} m`);
  ok('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'terrain-e2e.png') });
  console.log(res.filter(r => !r.pass).length ? 'SOME FAILED' : 'ALL PASS'); await b.close();
})();
