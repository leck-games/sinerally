// Headless Chrome test of the engine sound plugin host. usage: node tools/test-sound.cjs [baseUrl]
// Serve the repo first: python3 -m http.server 18931 --bind 127.0.0.1
const path = require('path');
let puppeteer; try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require('/workspace/scratch/ptest/node_modules/puppeteer-core'); }
const base = process.argv[2] || 'http://127.0.0.1:18931/';
const shots = path.join(__dirname, '..', 'shots'), root = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = false; const check = (ok, what, extra = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + what + (extra ? '  ' + extra : '')); if (!ok) fail = true; };
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const open = async (vp, url) => {
    const p = await browser.newPage();
    p.on('console', m => { if (m.type() === 'error' && !/does-not-exist/.test((m.location() || {}).url || '')) errors.push(`[console.error] ${m.text()} ${(m.location() || {}).url || ''}`); if (/\[audio\]/.test(m.text())) console.log('   page:', m.text()); });
    p.on('pageerror', e => errors.push('[pageerror] ' + e.message));
    await p.setViewport(vp); await p.goto(url, { waitUntil: 'load' }); await sleep(2500); return p;
  };
  const S = p => p.evaluate(() => { const a = window.__st.audio; return { active: a.active, id: a.plugin && a.plugin.id, preset: a.instance && a.instance.preset,
    updates: a.stats.updates, events: a.stats.events, fallbacks: a.stats.fallbacks, updMs: +a.stats.updMs.toFixed(3), err: a.error, ctx: a.ctx && a.ctx.state,
    mode: a.instance && a.instance.engine && a.instance.engine.mode, msgs: a.instance && a.instance.engine && a.instance.engine.stats.msgs }; });
  const until = async (p, fn, ms = 8000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(150); } return false; };

  let p = await open({ width: 1366, height: 820 }, base + '?auto=1&q=low');
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' }); await sleep(2500);
  check((await S(p)).active === null, 'no audio before a user gesture');
  await p.mouse.click(683, 500); // trusted gesture -> host unlocks AudioContext, loads default plugin
  await until(p, () => window.__st.audio.active === 'enginesim'); await sleep(2500);
  let s = await S(p); check(s.active === 'enginesim' && s.ctx === 'running' && s.updates > 5 && s.msgs > 10, 'default Engine Sim plugin loads, update() called, worklet running', JSON.stringify(s));
  check(s.preset === 'boxer4', 'buggy defaults to its vehicle sound preset (boxer4)', s.preset);
  await p.click('#tMenu'); await sleep(400);
  await p.screenshot({ path: path.join(shots, 'sound_menu.png') });
  await p.select('#sndPreset', 'flatV8'); await sleep(500);
  await p.evaluate(() => { const s = document.getElementById('sndPreset'); s.size = Math.min(11, s.options.length); s.style.height = 'auto'; }); // expand list for the screenshot
  await p.screenshot({ path: path.join(shots, 'sound_preset_picker.png') });
  s = await S(p); check(s.preset === 'flatV8', 'preset picker switches preset in game', s.preset);
  await p.evaluate(() => window.__st.setVehicle('quad')); await sleep(800);
  s = await S(p); check(s.preset === 'dirtbike', 'switching to quad selects its preset (dirtbike)', s.preset);
  await p.evaluate(() => window.__st.setVehicle('buggy')); await sleep(800);
  s = await S(p); check(s.preset === 'flatV8', 'buggy remembers the user-chosen preset', s.preset);
  // volume + mute
  await p.evaluate(() => { const v = document.getElementById('sndVol'); v.value = 0.4; v.dispatchEvent(new Event('input')); });
  await p.click('#tSnd'); await sleep(200);
  check(await p.evaluate(() => window.__st.audio.muted && JSON.parse(localStorage.sinerally_snd1).volume === 0.4), 'mute + volume persisted');
  await p.click('#tSnd');
  // custom by URL
  await p.evaluate(() => window.__st.audio.buildMenu(document.getElementById('mSnd')));
  await p.click('#sndUrl', { clickCount: 3 }); await p.type('#sndUrl', base + 'plugins/example-simple-engine.js');
  await p.evaluate(() => [...document.querySelectorAll('#mSnd button')].find(b => b.textContent === 'LOAD URL').click());
  await until(p, () => window.__st.audio.active === 'custom-url'); await sleep(1200);
  s = await S(p); check(s.active === 'custom-url' && s.id === 'example-simple' && s.updates > 0, 'example plugin loads by URL', JSON.stringify(s));
  await p.screenshot({ path: path.join(shots, 'sound_custom_url.png') });
  // custom by local file
  const fi = await p.$('#sndFile'); await fi.uploadFile(path.join(root, 'plugins/example-simple-engine.js'));
  await until(p, () => window.__st.audio.active === 'custom-file'); await sleep(1200);
  s = await S(p); check(s.active === 'custom-file' && s.id === 'example-simple', 'example plugin loads from a local .js file (Blob URL)', JSON.stringify(s));
  await p.screenshot({ path: path.join(shots, 'sound_custom_file.png') });
  // broken plugins -> fallback
  for (const [kind, f] of [['url', 'bad-apiversion.js'], ['file', 'syntax-error.js'], ['url', 'throws-in-update.js'], ['url', 'does-not-exist.js']]) {
    const fb0 = (await S(p)).fallbacks;
    if (kind === 'url') await p.evaluate(u => window.__st.audio.loadUrl(u), base + 'tools/fixtures/' + f);
    else { const fi2 = await p.$('#sndFile'); await fi2.uploadFile(path.join(root, 'tools/fixtures', f)); }
    await until(p, (fb) => window.__st.audio.stats.fallbacks > fb && window.__st.audio.active === 'enginesim', 8000, fb0); await sleep(600);
    s = await S(p); check(s.active === 'enginesim' && s.fallbacks > fb0, `broken plugin (${f}) -> falls back to Engine Sim`, s.err);
  }
  await p.evaluate(() => window.__st.audio.buildMenu(document.getElementById('mSnd')));
  await p.screenshot({ path: path.join(shots, 'sound_fallback.png') });
  const fpsOk = await p.evaluate(() => window.__fps > 0); check(fpsOk, 'game loop still running after failures', String(await p.evaluate(() => window.__fps)));
  // persistence across reload
  await p.evaluate(() => window.__st.audio.activate('example-simple'));
  await p.reload({ waitUntil: 'load' }); await sleep(2000); await p.mouse.click(683, 500);
  await until(p, () => window.__st.audio.active === 'example-simple');
  s = await S(p); check(s.active === 'example-simple', 'plugin choice persisted across reload', s.active);
  // map open pauses (ducks) audio
  await p.evaluate(() => window.__st.openMap(true)); await sleep(500);
  check(await p.evaluate(() => window.__st.audio.telemetry.paused === true), 'world map -> telemetry.paused, master ducked');
  await p.evaluate(() => window.__st.openMap(false)); await p.close();
  // iPhone 12 landscape (emulated viewport only, Chrome engine – NOT real iOS Safari)
  p = await open({ width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: true }, base);
  await p.touchscreen.tap(422, 250); await until(p, () => !!window.__st.audio.active); await sleep(800);
  await p.evaluate(() => document.getElementById('tMenu').click()); await sleep(400);
  await p.evaluate(() => document.getElementById('mSnd').scrollIntoView());
  await p.screenshot({ path: path.join(shots, 'sound_menu_iphone12.png') });
  s = await S(p); check(!!s.active && s.updates > 0, 'emulated iPhone 12 viewport: tap unlocks + plugin runs', JSON.stringify(s));
  console.log('console errors:', errors.length ? errors : 'none');
  if (errors.length) fail = true;
  await browser.close(); console.log(fail ? 'RESULT: FAIL' : 'RESULT: PASS'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
