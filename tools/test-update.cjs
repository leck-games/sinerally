// Update e2e (harvester melt, rock melt, ARC/NRM handling toggle, UI hide modes, nitro bottom-left, auto-hide) — headless Chrome,
// iPhone 12 landscape 844x390 with touch. Serve repo: python3 -m http.server 18931 --bind 127.0.0.1; then node tools/test-update.cjs
let puppeteer; try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('/workspace/scratch/ptest/node_modules/puppeteer-core'); }
const SH = require('path').join(__dirname, '..', 'shots') + '/'; const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = {}; const ok = (k, v, info) => { res[k] = { pass: !!v, info }; console.log((v ? 'PASS ' : 'FAIL ') + k, info !== undefined ? JSON.stringify(info) : ''); };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); await p.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  const URL = 'http://127.0.0.1:18931/?gfx=Med';
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' }); await sleep(4000);
  const E = (f, ...a) => p.evaluate(f, ...a);
  const hook = () => E(() => { window.__ev = []; __st.bus.on('*', (d, t) => __ev.push([t, d])); });
  await hook();
  // ---- handling: ARCADE default, HUD toggle, persisted, ☰ row
  let h = await E(() => ({ mode: __st.handling, phys: __st.veh.mode, btn: document.getElementById('tHand').textContent }));
  ok('handling default ARCADE', h.mode === 'arcade' && h.phys === 'arcade' && h.btn === 'ARC', h);
  await p.tap('#tHand'); await sleep(300);
  h = await E(() => ({ mode: __st.handling, phys: __st.veh.mode, btn: document.getElementById('tHand').textContent, ls: localStorage.getItem('sinerally_handling') }));
  await p.reload({ waitUntil: 'load' }); await sleep(3500);
  const h2 = await E(() => ({ mode: __st.handling, phys: __st.veh.mode, btn: document.getElementById('tHand').textContent }));
  ok('handling toggle NRM + persisted', h.phys === 'normal' && h.btn === 'NRM' && h.ls === 'normal' && h2.phys === 'normal' && h2.btn === 'NRM', { afterTap: h, afterReload: h2 });
  await E(() => __st.openMenu(true)); await sleep(500);
  const row = await E(() => { const r = [...document.querySelectorAll('#mRows .mrow')].find(r => /HANDLING/.test(r.textContent)); if (!r) return null; [...r.querySelectorAll('button')].find(b => b.textContent === 'ARCADE').click(); return [...r.querySelectorAll('button')].map(b => b.textContent); });
  await E(() => __st.openMenu(false)); await sleep(200);
  h = await E(() => ({ mode: __st.handling, phys: __st.veh.mode, btn: document.getElementById('tHand').textContent }));
  ok('handling ☰ row', row && row.join() === 'ARCADE,NORMAL' && h.phys === 'arcade' && h.btn === 'ARC', { row, ...h });
  // vehicle switch keeps the mode
  h = await E(() => { __st.setVehicle('truck'); const m = __st.veh.mode; __st.setVehicle('buggy'); return m; }); ok('mode kept across vehicle switch', h === 'arcade', h);
  await hook();
  // ---- harvester: melts trees at 10 and 150 km/h, no speed loss, no damage, logs
  const aim = (vehicle, back) => E((vehicle, back) => { if (__st.vName !== vehicle) __st.setVehicle(vehicle); __st.setAttachments(vehicle === 'buggy' ? ['harvester'] : ['harvester', 'lograck']); __st.setWx('clear'); __st.tod = 0.4; const bp = __st.toBiome('forest');
    const tr = __st.world.queryTrees(bp.x, bp.z, 80).filter(t => t.hp >= 2).sort((a, b) => Math.hypot(a.x - bp.x, a.z - bp.z) - Math.hypot(b.x - bp.x, b.z - bp.z));
    for (const t of tr) { const sx = t.x - back, sz = t.z; const clear = __st.world.queryTrees(sx + back / 2, sz, back / 2 - 1).filter(o => o.id !== t.id).length === 0; if (clear) { __st.teleport(sx, sz, Math.PI / 2); __st.veh.cargo.logs = 0; return { id: t.id, hp: t.hp, x: t.x, z: t.z }; } }
    return null; }, vehicle, back);
  for (const kmh of [10, 150]) {
    const tgt = await aim(kmh > 50 ? 'buggy' : 'forester', kmh > 50 ? 12 : 6.5); /* 150 km/h: buggy + harvester (capped top speed 178) */ await sleep(700); const n = await E(() => __ev.length);
    const st0 = await E(k => { const v = __st.veh, s = k / 3.6; v.v.x = v.fwd.x * s; v.v.z = v.fwd.z * s; for (const w of v.wheels) w.omega = s / v.P.wheelR; v.gear = k > 50 ? 5 : 1; window.__dmg0 = v.damage; return { att: __st.rig.attach }; }, kmh);
    let hit = null; await p.keyboard.down('ArrowUp');
    for (let i = 0; i < 60 && !hit; i++) { await sleep(kmh > 50 ? 40 : 200); hit = await E((n, id) => { const i = __ev.slice(n).findIndex(e => e[0] === 'tree:destroyed' && e[1].id === id); if (i < 0) return null; return { kmh: Math.hypot(__st.veh.v.x, __st.veh.v.z) * 3.6 }; }, n, tgt.id); }
    const pre = await E((n, id) => { const e = __ev.slice(n).find(e => e[0] === 'tree:damage' && e[1].id === id); return e ? e[1].speed : null; }, n, tgt.id);
    await sleep(150); await p.keyboard.up('ArrowUp');
    const r = await E((n, id) => { const ev = __ev.slice(n); return { gone: !__st.T.getTree(id), logs: __st.veh.cargo.logs, dmg: +(__st.veh.damage - __dmg0).toFixed(2), crash: ev.filter(e => e[0] === 'crash').length, dmgEv: ev.filter(e => e[0] === 'tree:damage' && e[1].id === id).map(e => +e[1].hp.toFixed(2)), cause: (ev.find(e => e[0] === 'tree:destroyed' && e[1].id === id) || [0, {}])[1].cause }; }, n, tgt.id);
    ok(`harvester melts tree @${kmh} km/h`, hit && r.gone && r.dmgEv.length === 1 && r.dmgEv[0] >= tgt.hp - 0.01 && r.cause === 'harvest' && r.dmg === 0 && r.crash === 0 && r.logs >= 1 && (kmh < 50 || (pre > kmh * 0.9 && hit.kmh >= pre * 0.98)), { tgt, hitKmh: hit && +hit.kmh.toFixed(1), preKmh: pre && +pre.toFixed(1), ...r });
  }
  // ploughing through dense forest at speed (screenshot)
  { const at = await E(() => { __st.setVehicle('forester'); __st.setAttachments(['harvester', 'lograck']); const bp = __st.toBiome('forest'); let best = null; for (let k = 0; k < 64; k++) { const x = bp.x + (k % 8 - 4) * 25, z = bp.z + ((k / 8 | 0) - 4) * 25; if (__st.T.biomeAt(x, z) !== 'forest') continue; const n = __st.world.queryTrees(x + 40, z, 30).length; if (!best || n > best.n) best = { x, z, n }; } __st.teleport(best.x, best.z, Math.PI / 2); __st.veh.cargo.logs = 0; return best; });
    await sleep(800); const n = await E(() => __ev.length);
    await E(() => { const v = __st.veh, s = 110 / 3.6; v.v.x = v.fwd.x * s; v.v.z = v.fwd.z * s; for (const w of v.wheels) w.omega = s / v.P.wheelR; v.gear = 4; window.__dmg0 = v.damage; });
    await p.keyboard.down('ArrowUp'); await sleep(1800); await p.screenshot({ path: SH + 'upd_harvester_forest.png' }); await sleep(600); await p.keyboard.up('ArrowUp');
    const r = await E(n => { const ev = __ev.slice(n); return { melted: ev.filter(e => e[0] === 'tree:destroyed' && e[1].cause === 'harvest').length, logs: __st.veh.cargo.logs, dmg: +(__st.veh.damage - __dmg0).toFixed(2), crashes: ev.filter(e => e[0] === 'crash').length, kmh: +(Math.hypot(__st.veh.v.x, __st.veh.v.z) * 3.6).toFixed(0) }; }, n);
    ok('harvester ploughs forest', r.melted >= 2 && r.dmg === 0 && r.crashes === 0, { at, ...r }); }
  // ---- rocks: harvester melts (persisted), bare buggy still bounces
  const rockAim = back => E(back => { for (const b of ['alpine', 'canyon', 'hills', 'tundra', 'forest']) { const bp = __st.toBiome(b); if (!bp) continue; const R = __st.rocks.slice(), H = __st.T.heightAt; let pick = null;
      for (let i = 0; i < R.length && !pick; i += 4) { const x = R[i] - back, z = R[i + 1]; if (__st.world.queryTrees(x + back / 2, z, back / 2 + 2).length) continue; let clear = true;
        for (let j = 0; j < R.length; j += 4) if (j !== i && Math.hypot(R[j] - (x + back / 2), R[j + 1] - z) < back / 2 + R[j + 2] + 3) clear = false; if (!clear) continue;
        let flat = true; for (let k = 0; k <= 6; k++) { const xx = x + (back + 8) * k / 6; if (Math.abs(H(xx, z) - H(x, z)) > 2.5 || H(xx, z) < __st.W.WATER + 2) flat = false; } if (!flat) continue;
        pick = { key: R[i + 3], x: R[i], z: R[i + 1], r: R[i + 2], biome: b, from: [x, z] }; }
      if (!pick) continue; __st.teleport(pick.from[0], pick.from[1], Math.PI / 2); const R2 = __st.rocks; for (let k = 0; k < R2.length; k += 4) if (R2[k + 3] === pick.key) return { ...pick, at: [__st.x, __st.z] }; } return null; }, back);
  { await E(() => __st.setVehicle('forester')); const rk = await rockAim(14); await sleep(700); if (process.env.DBG) console.log('rk', JSON.stringify(rk), await E(() => [__st.x, __st.z])); const n = await E(() => __ev.length);
    await E(() => { const v = __st.veh, s = 60 / 3.6; v.v.x = v.fwd.x * s; v.v.z = v.fwd.z * s; for (const w of v.wheels) w.omega = s / v.P.wheelR; v.gear = 3; window.__dmg0 = v.damage; window.__x0 = v.p.x; });
    await p.keyboard.down('ArrowUp'); let m = null; for (let i = 0; i < 100 && !m; i++) { await sleep(80); if (process.env.DBG && i % 5 == 0) console.log(await E(() => [__st.x.toFixed(1), __st.z.toFixed(1), (Math.hypot(__st.veh.v.x, __st.veh.v.z) * 3.6).toFixed(0), __st.stats.fps && __st.stats.fps.toFixed(1), document.getElementById('map').style.display, __st.editor.open, __st.inp.gas, __st.vName].join(' '))); m = await E((n, k) => { const e = __ev.slice(n).find(e => e[0] === 'rock:melted' && e[1].key === k); return e ? { kmh: +(Math.hypot(__st.veh.v.x, __st.veh.v.z) * 3.6).toFixed(1) } : null; }, n, rk && rk.key); }
    await sleep(1500); await p.keyboard.up('ArrowUp');
    const r = await E((n, k) => ({ gone: __st.rockGone.has(k), stored: JSON.parse(localStorage.getItem('sinerally_rocks_gone') || '[]').includes(k), dmg: +(__st.veh.damage - __dmg0).toFixed(2), crash: __ev.slice(n).filter(e => e[0] === 'crash').length, passed: __st.veh.p.x > __x0 + 16 }), n, rk && rk.key);
    ok('harvester melts rock (no loss/damage, persisted)', rk && m && m.kmh > 50 && r.gone && r.stored && r.dmg === 0 && r.crash === 0 && r.passed, { rk, melt: m, ...r });
    await p.reload({ waitUntil: 'load' }); await sleep(3500); await hook();
    const pr = await E(k => ({ gone: __st.rockGone.has(k), inScan: (() => { const R = __st.rocks; for (let i = 0; i < R.length; i += 4) if (R[i + 3] === k) return true; return false; })() }), rk && rk.key);
    ok('melted rock stays gone after reload', pr.gone && !pr.inScan, pr);
    await E(() => { __st.setVehicle('buggy'); __st.setAttachments([]); }); const rb = await rockAim(10); await sleep(600); const n2 = await E(() => __ev.length);
    await E(() => { const v = __st.veh, s = 45 / 3.6; v.v.x = v.fwd.x * s; v.v.z = v.fwd.z * s; for (const w of v.wheels) w.omega = s / v.P.wheelR; v.gear = 2; });
    await sleep(1600); const rr = await E((n, k) => ({ gone: __st.rockGone.has(k), crash: __ev.slice(n).filter(e => e[0] === 'crash').length, x: __st.x, kmh: Math.hypot(__st.veh.v.x, __st.veh.v.z) * 3.6 }), n2, rb && rb.key);
    ok('bare buggy still bounces off rock', rb && !rr.gone && (rr.crash > 0 || rr.x < rb.x), { rb, ...rr }); }
  // ---- auto-hide: unload only with logs, temp bar only warm
  { await E(() => { __st.setVehicle('forester'); __st.veh.cargo.logs = 0; __st.veh.heat.temp = __st.veh.P.heat.ambient; }); await sleep(400);
    const a = await E(() => ({ unl: getComputedStyle(document.getElementById('bUnl')).display, temp: __st.TEL.tempShown }));
    await E(() => { __st.veh.cargo.logs = 2; __st.veh.heat.temp = __st.veh.P.heat.hot + 2; }); await sleep(400);
    const c = await E(() => ({ unl: getComputedStyle(document.getElementById('bUnl')).display, txt: document.getElementById('bUnl').textContent, temp: __st.TEL.tempShown }));
    await p.tap('#bUnl'); for (let i = 0; i < 20 && await E(() => getComputedStyle(document.getElementById('bUnl')).display) !== 'none'; i++) await sleep(150); const d = await E(() => ({ logs: __st.veh.cargo.logs, unl: getComputedStyle(document.getElementById('bUnl')).display }));
    await E(() => { __st.veh.heat.temp = 80; });
    ok('auto-hide unload + temp', a.unl === 'none' && !a.temp && c.unl !== 'none' && c.temp && d.logs === 0 && d.unl === 'none', { cold: a, warmLogs: c, afterTap: d }); }
  // ---- touch layout: nitro bottom-left inside safe area, no overlaps
  { const L = await E(() => { const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, show: getComputedStyle(document.getElementById(id)).display !== 'none' }; };
      return Object.fromEntries(['bBst', 'joy', 'bGas', 'bBrk', 'bDrf', 'gauge', 'topbtns', 'tUi', 'tHand', 'mini'].map(k => [k, r(k)])); });
    const ov = (a, b) => !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t); const ids = Object.keys(L); const bad = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (L[ids[i]].show && L[ids[j]].show && ov(L[ids[i]], L[ids[j]])) bad.push(ids[i] + '/' + ids[j]);
    ok('nitro bottom-left, no overlaps', L.bBst.show && L.bBst.l >= 10 && L.bBst.r < L.joy.l && L.bBst.b > 330 && L.bBst.r < 120 && bad.length === 0, { bst: L.bBst, joy: L.joy, overlaps: bad });
    // boost via touch + Shift
    const box = L.bBst; await p.touchscreen.touchStart((box.l + box.r) / 2, (box.t + box.b) / 2); await sleep(250); const tb = await E(() => __st.inp.boost); await p.touchscreen.touchEnd();
    await p.keyboard.down('ShiftLeft'); await sleep(200); const kb = await E(() => __st.inp.boost); await p.keyboard.up('ShiftLeft');
    ok('boost: touch + Shift', tb === 1 && kb === 1, { touch: tb, shift: kb }); }
  // ---- UI hide modes (+ drift shot first, full UI)
  { await E(() => { __st.setVehicle('buggy'); __st.setAttachments([]); __st.setWx('clear'); __st.tod = 0.42; const W = __st.W, es = W.pathsNear(0, 0, 4000).filter(e => e.type === W.HWY && !e.loop).sort((a, b) => (a.id + '').localeCompare(b.id + '')); const P = W.pathPoint(es[0], 0.5); __st.teleport(P.x, P.z, Math.atan2(P.tx, P.tz)); });
    await sleep(1000); const n = await E(() => __ev.length);
    await E(() => { const v = __st.veh, s = 95 / 3.6; v.v.x = v.fwd.x * s; v.v.z = v.fwd.z * s; for (const w of v.wheels) w.omega = s / v.P.wheelR; v.gear = 4; window.__nit0 = v.nitro = 0.3; });
    await p.keyboard.down('ArrowUp'); await p.keyboard.down('ArrowLeft'); await p.keyboard.down('Space'); await sleep(350); await p.keyboard.up('Space');
    let mx = 0; for (let i = 0; i < 10; i++) { await sleep(120); mx = Math.max(mx, await E(() => __st.veh.drift ? 1 : 0)); if (i === 5) await p.screenshot({ path: SH + 'upd_drift.png' }); }
    await p.keyboard.up('ArrowLeft'); await p.keyboard.up('ArrowUp');
    const d = await E(n => { const ev = __ev.slice(n), e = ev.find(e => e[0] === 'drift:end'); return { start: ev.some(e => e[0] === 'drift:start'), end: e && e[1], nitroGain: +(__st.veh.nitro - __nit0).toFixed(3), roll: __st.veh.up.y > 0.5 }; }, n);
    ok('arcade drift in game', d.start && mx && d.roll, d); }
  await E(() => { __st.veh.v.x = __st.veh.v.z = 0; }); await sleep(1200);
  const vis = () => E(() => Object.fromEntries(['hud', 'mini', 'topbtns', 'gauge', 'bGas', 'bBst', 'joy', 'tUi', 'tHand', 'cans', 'tSnd'].map(k => { const e = document.getElementById(k), c = getComputedStyle(e); let vis = c.display !== 'none' && c.opacity !== '0'; for (let q = e.parentElement; q && vis; q = q.parentElement) if (getComputedStyle(q).display === 'none') vis = false; return [k, vis ? +c.opacity : 0]; })));
  await p.screenshot({ path: SH + 'upd_ui_full.png' }); const vF = await vis();
  await p.tap('#tUi'); await sleep(2300); await p.screenshot({ path: SH + 'upd_ui_minimal.png' }); const vM = await vis();
  await p.tap('#tUi'); await sleep(2300); await p.screenshot({ path: SH + 'upd_ui_none.png' }); const vN = await vis(); const uiLS = await E(() => localStorage.getItem('sinerally_ui'));
  ok('UI FULL', vF.hud && vF.topbtns && vF.mini && vF.bGas && vF.bBst && vF.tUi && vF.tHand && vF.tSnd, vF);
  ok('UI MINIMAL', vM.hud && vM.mini && vM.gauge && vM.bGas && vM.bBst && vM.joy && vM.tUi && !vM.topbtns && !vM.tSnd && !vM.cans, vM);
  ok('UI NONE', !vN.hud && !vN.mini && !vN.gauge && !vN.topbtns && !vN.bGas && !vN.bBst && !vN.joy && vN.tUi > 0 && vN.tUi < 0.5 && uiLS === 'none', { ...vN, ls: uiLS });
  { const g = await E(() => { const b = document.getElementById('bGas').getBoundingClientRect(); return [(b.left + b.right) / 2, (b.top + b.bottom) / 2]; });
    await p.touchscreen.touchStart(g[0], g[1]); await sleep(250); const gas = await E(() => __st.inp.gas); await p.touchscreen.touchEnd(); ok('NONE: invisible gas zone still works', gas === 1, { gas }); }
  await p.reload({ waitUntil: 'load' }); await sleep(3000); const pr = await E(() => ({ ui: __st.ui, cls: document.body.className }));
  await p.tap('#tUi'); await sleep(200); const back = await E(() => __st.ui);
  ok('UI mode persisted + cycles back to FULL', pr.ui === 'none' && /ui-none/.test(pr.cls) && back === 'full', { ...pr, afterTap: back });
  ok('no console errors', errs.length === 0, errs.slice(0, 10));
  require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'sinerally-update-e2e.json'), JSON.stringify(res, null, 1));
  await b.close(); process.exit(Object.values(res).every(r => r.pass) ? 0 : 1);
})().catch(e => { console.error('E2E CRASH', e); process.exit(1); });
