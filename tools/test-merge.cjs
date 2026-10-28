// Merge e2e (headless Chrome 844x390). Serve repo: python3 -m http.server 18931 --bind 127.0.0.1; then node tools/test-merge.cjs
let puppeteer; try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('/workspace/scratch/ptest/node_modules/puppeteer-core'); }
const SH = require('path').join(__dirname, '..', 'shots') + '/'; const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = {}; const ok = (k, v, info) => { res[k] = { pass: !!v, info }; console.log((v ? 'PASS ' : 'FAIL ') + k, info !== undefined ? JSON.stringify(info) : ''); };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); await p.setViewport({ width: 844, height: 390, hasTouch: false });
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto('http://127.0.0.1:18931/?gfx=Med', { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' }); await sleep(4000);
  const E = (f, ...a) => p.evaluate(f, ...a);
  await E(() => { window.__ev = []; __st.bus.on('*', (d, t) => __ev.push(t)); });
  // driving
  const x0 = await E(() => [__st.x, __st.z]); await p.keyboard.down('ArrowUp'); await sleep(4000); await p.keyboard.up('ArrowUp');
  const x1 = await E(() => [__st.x, __st.z, Math.round(__st.TEL.speed * 3.6), __st.veh.gear]); ok('driving', Math.hypot(x1[0] - x0[0], x1[1] - x0[1]) > 3, { moved: +Math.hypot(x1[0] - x0[0], x1[1] - x0[1]).toFixed(1), kmh: x1[2], gear: x1[3] });
  // selector
  await p.click('#tSnd'); await sleep(300);
  await p.click('#tMenu'); await sleep(800);
  const sel = await E(() => ({ btns: [...document.querySelectorAll('#mVeh .vlist button')].map(b => b.textContent.trim()), canvas: !!document.querySelector('#mVeh canvas') }));
  ok('selector', sel.btns.length >= 5 && sel.canvas, sel); await p.screenshot({ path: SH + 'merge_selector.png' });
  // pick forester through the selector UI
  await E(() => { const b = [...document.querySelectorAll('#mVeh .vlist button')].find(b => /timber|forest/i.test(b.textContent)); b.click(); }); await sleep(900);
  await E(() => document.getElementById('mAtt').scrollIntoView()); await sleep(300);
  const att = await E(() => ({ v: __st.vName, attach: __st.rig.attach, rows: [...document.querySelectorAll('#mAtt .arow')].map(r => r.textContent.slice(0, 40)), persisted: localStorage.getItem('srp_vehicle') }));
  ok('attachments+persist', att.v === 'forester' && att.attach.includes('harvester') && att.persisted && att.persisted.includes('forester'), att); await p.screenshot({ path: SH + 'merge_attachments.png' });
  await p.click('#mnClose'); await sleep(300);
  // harvester: forest, aim at nearest tree, drive in slowly
  const aim = async (vehicle, back) => E((vehicle, back) => { if (__st.vName !== vehicle) __st.setVehicle(vehicle); __st.setWx('clear'); __st.tod = 0.4; const bp = __st.toBiome('forest');
    const tr = __st.world.queryTrees(bp.x, bp.z, 60).filter(t => t.hp >= 3).sort((a, b) => Math.hypot(a.x - bp.x, a.z - bp.z) - Math.hypot(b.x - bp.x, b.z - bp.z));
    for (const t of tr) { const sx = t.x - back, sz = t.z; const clear = __st.world.queryTrees(sx + back / 2, sz, back / 2 - 1).filter(o => o.id !== t.id).length === 0; if (clear) { __st.teleport(sx, sz, Math.PI / 2); return { id: t.id, x: t.x, z: t.z, fwd: __st.veh.fwd }; } }
    return null; }, vehicle, back);
  let tgt = await aim('forester', 6.5); await sleep(800);
  const evN = await E(() => __ev.length);
  for (let i = 0; i < 40; i++) { const kmh = await E(() => Math.hypot(__st.veh.v.x, __st.veh.v.z) * 3.6); if (kmh < 8) await p.keyboard.down('ArrowUp'); else await p.keyboard.up('ArrowUp');
    await sleep(500); if (await E(n => __ev.slice(n).includes('tree:destroyed'), evN)) break; }
  await p.keyboard.up('ArrowUp'); await sleep(800);
  const hv = await E((id, n) => ({ ev: [...new Set(__ev.slice(n))], logs: __st.veh.cargo.logs, tree: __st.T.getTree(id) ? __st.T.getTree(id).hp : 'removed', hpMap: __st.hpMap.get(id) }), tgt.id, evN);
  ok('harvester', hv.ev.some(e => /harvest|tree:/.test(e)), { tgt, ...hv });
  // tree with HP: buggy into a tree at speed
  tgt = await aim('buggy', 14); await sleep(800); const n2 = await E(() => __ev.length);
  await E(() => { const v = __st.veh, s = 120 / 3.6; v.v.x = v.fwd.x * s; v.v.z = v.fwd.z * s; for (const w of v.wheels) w.omega = s / v.P.wheelR; v.gear = 4; });
  await p.keyboard.down('ArrowUp'); for (let i = 0; i < 20; i++) { await sleep(150); if (await E(n => __ev.slice(n).includes('tree:damage'), n2)) break; } await p.keyboard.up('ArrowUp'); await sleep(200);
  await p.keyboard.down('ArrowDown'); await sleep(1800); await p.keyboard.up('ArrowDown'); await sleep(1200);
  await p.screenshot({ path: SH + 'merge_treehp.png' });
  const th = await E((id, n) => ({ ev: [...new Set(__ev.slice(n))], hp: __st.hpMap.get(id), damaged: [...__st.hpMap.values()].map(v => +v.toFixed(2)), terr: __st.T.getTree(id) ? __st.T.getTree(id).hp : 'removed', labels: [...document.querySelectorAll('#labels .hp')].filter(d => d.style.display !== 'none').map(d => d.lastChild.textContent) }), tgt.id, n2);
  ok('tree HP', th.ev.includes('tree:damage') && th.labels.some(l => !l.startsWith('3.0')), { tgt, ...th, labels: th.labels.slice(0, 3) });
  // overheat ignites grass: savanna/grassland, force heat high and rev
  await E(() => { __st.setVehicle('buggy'); const bp = __st.toBiome('savanna') || __st.toBiome('grassland'); __st.T.extinguishAll(); __st.veh.heat.temp = 112; });
  await sleep(500); const n3 = await E(() => __ev.length);
  await p.keyboard.down('ArrowUp'); let fire = null;
  for (let i = 0; i < 20; i++) { await sleep(500); await E(() => { __st.veh.heat.temp = Math.max(__st.veh.heat.temp, 119); }); fire = await E(() => __st.T.stats().fire); if (fire.burning > 3) break; }
  await p.keyboard.up('ArrowUp'); await p.keyboard.down('ArrowDown'); await sleep(900); await p.keyboard.up('ArrowDown');
  await E(() => { const v = __st.veh; }); await sleep(1500);
  await p.screenshot({ path: SH + 'merge_grassfire.png' });
  const gf = await E(n => ({ ev: [...new Set(__ev.slice(n))], fire: __st.T.stats().fire, temp: +__st.veh.heat.temp.toFixed(0), biome: __st.T.biomeAt(__st.x, __st.z) }), n3);
  ok('overheat ignites grass', gf.ev.includes('engine:hot') && gf.fire.burning > 0, gf);
  await E(() => { __st.T.extinguishAll(); __st.veh.heat.temp = 80; });
  // forest rain
  await E(() => { __st.setWx('rain'); const bp = __st.toBiome('forest'); let best = null; for (let k = 0; k < 80; k++) { const x = bp.x + (k % 9 - 4) * 20, z = bp.z + ((k / 9 | 0) - 4) * 20; if (__st.T.biomeAt(x, z) !== 'forest' || __st.T.rainAt(x, z) < 0.5) continue; const n = __st.world.queryTrees(x, z, 9).length; if (n && (!best || n < best.n) && __st.world.queryTrees(x, z, 4).length === 0) best = { x, z, n }; } if (best) __st.teleport(best.x, best.z, 0.6); __st.setWx('rain'); __st.tod = 0.42; }); await sleep(6000);
  const fr = await E(() => ({ wx: __st.T.stats().weather, wet: __st.TEL.surface, grip: __st.world.surfaceAt ? null : null, biome: __st.T.biomeAt(__st.x, __st.z), surf: __st.world.surfaceAt(__st.x, __st.z).wet }));
  await p.screenshot({ path: SH + 'merge_forestrain.png' });
  ok('forest rain', fr.wx.mode === 'on' && fr.wx.localRain > 0.3 && fr.biome === 'forest', fr);
  await E(() => __st.setWx('clear'));
  // sound editor (back at the start, on the track)
  await E(x => __st.teleport(x[0], x[1], 0), x0); await sleep(1500);
  await p.click('#tMenu'); await sleep(600);
  const hasEd = await E(() => !!document.getElementById('sndEdit')); 
  if (hasEd) { await p.click('#sndEdit'); await sleep(600); }
  const c0 = await E(() => __st.editor.open && JSON.parse(JSON.stringify(__st.audio.instance.getConfig())));
  await E(() => { const s = document.querySelector('#sndEd input[type=range][data-k]:not([data-k^="c."])'); window.__k = s.dataset.k; s.value = +s.max; s.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(1500);
  const c1 = await E(() => ({ k: window.__k, v: __st.audio.instance.getConfig()[window.__k], menuClosed: document.getElementById('menu').style.display === 'none', stored: !!localStorage.getItem('sinerally_sndcfg1') }));
  await E(() => __st.editor.openSection('exh')); await sleep(600); await p.screenshot({ path: SH + 'merge_soundeditor.png' });
  ok('sound editor changes config', hasEd && c0 && c1.v !== c0[c1.k] && c1.stored, { k: c1.k, before: c0 && c0[c1.k], after: c1.v, stored: c1.stored, menuClosed: c1.menuClosed });
  // 6-rotor rotary via the editor UI (layout select, then count select)
  await E(() => { const s = document.querySelector('#sndEd select[data-k=layout]'); s.value = 'rotary'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(400);
  await E(() => { const s = document.querySelector('#sndEd [data-k=cylinders]'); s.value = '6'; s.dispatchEvent(new Event('change', { bubbles: true })); s.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(400);
  const maxR = await E(() => { const s = document.querySelector('#sndEd [data-k=cylinders]'); return s.tagName === 'SELECT' ? Math.max(...[...s.options].map(o => +o.value)) : +s.max; });
  await E(() => { __st.editor.openSection('layout'); __st.audio.setTest && __st.audio.setTest({ rev: true }); }); await sleep(1500);
  const r6 = await E(() => { const c = __st.audio.instance.getConfig(); const vs = __st.audio.instance.getVisualState ? __st.audio.instance.getVisualState() : null; return { layout: c.layout, cylinders: c.cylinders, fire: (c.cyl || []).map(k => k.fire ?? k.angle), lights: document.querySelectorAll('#sndEd .se-lights canvas').length, vs: vs && Object.keys(vs) }; });
  await p.screenshot({ path: SH + 'merge_rotary6.png' });
  ok('rotary 6 rotors', r6.layout === 'rotary' && r6.cylinders === 6 && maxR === 16, { ...r6, maxRotors: maxR });
  // persistence per vehicle + close resumes driving
  await E(() => __st.editor.close()); await sleep(300);
  ok('no console errors', errs.length === 0, errs.slice(0, 10));
  require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'sinerally-e2e.json'), JSON.stringify(res, null, 1));
  await b.close();
})().catch(e => { console.error('E2E CRASH', e); process.exit(1); });
