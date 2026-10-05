// Headless smoke test: runs the app in jsdom in demo mode and visits every screen.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const www = path.join(__dirname, '..', 'www');
const html = fs.readFileSync(path.join(www, 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
const errors = [];
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.addEventListener('error', e => errors.push('window error: ' + e.message));
w.HTMLMediaElement.prototype.play = () => Promise.resolve();
w.HTMLMediaElement.prototype.pause = () => {};
w.HTMLMediaElement.prototype.load = () => {};
w.Image = class { set src(v) { setTimeout(() => this.onerror && this.onerror(), 0); } };
w.localStorage.setItem('cv.creds', JSON.stringify({ server: 'demo', user: 'demo', pass: 'demo' }));
w.localStorage.setItem('cv.demo', 'true');
w.eval(fs.readFileSync(path.join(www, 'app.js'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = (s) => w.document.querySelectorAll(s).length;
const check = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!cond) errors.push('check failed: ' + name); };
(async () => {
  await sleep(800);
  const cv = w.__cv;
  check('boots into home', cv.S.cur && cv.S.cur.name === 'home');
  check('library loaded', cv.S.d.live.length > 20 && cv.S.d.vod.length === 60 && cv.S.d.series.length === 30, cv.S.d.live.length + ' ch / ' + cv.S.d.vod.length + ' mv / ' + cv.S.d.series.length + ' sr');
  check('unique stream ids', new Set(cv.S.d.live.map(c => c.stream_id)).size === cv.S.d.live.length);
  check('home hub: 8 tiles + featured + top picks', q('.hubgrid .hub') === 9 && q('.hub.feat') === 1 && q('.shelf') >= 2, q('.hubgrid .hub') + ' hub tiles / ' + q('.shelf') + ' shelves');
  check('header shows search on home', w.document.getElementById('top').classList.contains('home'));
  await cv.go('search', { q: 'harbour' }, { reset: true }); await sleep(200);
  check('search finds movies', q('.shelf') >= 1 && q('.poster') > 0 && !w.document.getElementById('top').classList.contains('home'), q('.poster') + ' posters');
  await cv.go('search', { q: 'zzzzqq' }, { reset: true }); await sleep(100);
  check('search empty state', q('.empty') === 1);
  await cv.go('home', {}, { reset: true }); await sleep(200);
  for (const [name, sel] of [['live', '.row-ch'], ['movies', '.poster'], ['series', '.poster'], ['guide', '.grow'], ['favs', '.empty, .shelf'], ['settings', '.card']]) {
    await cv.go(name, {}, { reset: true }); await sleep(200);
    check('view: ' + name, q(sel) > 0, q(sel) + ' items');
  }
  // movie detail + play
  await cv.go('vod', { id: cv.S.d.vod[0].stream_id }, { reset: true }); await sleep(300);
  check('movie detail', q('.detail h1') === 1 && /synopsis/i.test(w.document.querySelector('.plot').textContent));
  w.document.querySelector('.btn.pri').click(); await sleep(100);
  check('movie player opens', cv.P.open && cv.P.type === 'vod');
  cv.goBack(); await sleep(200);
  check('player closes on back', !cv.P.open);
  // series detail
  await cv.go('seriesInfo', { id: cv.S.d.series[0].series_id }, { reset: true }); await sleep(300);
  check('series episodes', q('.ep') === 6 && q('.chips .chip') === 3, q('.ep') + ' eps / ' + q('.chips .chip') + ' seasons');
  w.document.querySelector('.ep').click(); await sleep(100);
  check('episode queue', cv.P.open && cv.P.queue && cv.P.queue.length === 6);
  cv.goBack(); await sleep(150);
  // live player
  await cv.go('live', {}, { reset: true }); await sleep(200);
  w.document.querySelector('.row-ch').click(); await sleep(300);
  check('live player opens', cv.P.open && cv.P.type === 'live');
  const k = key => w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
  const before = cv.P.idx; k('ArrowDown'); await sleep(100);
  check('channel down', cv.P.idx === before + 1);
  k('ArrowLeft'); await sleep(100);
  check('drawer opens', cv.P.drawer && q('#drawer .row-ch') > 0);
  k('Escape'); await sleep(100);
  check('drawer closes', !cv.P.drawer && cv.P.open);
  k('ArrowRight'); await sleep(100);
  check('favourite toggled', cv.S.favs.live.length === 1);
  k('Escape'); await sleep(200);
  check('live player closes', !cv.P.open);
  // favourites reflect
  await cv.go('favs', {}, { reset: true }); await sleep(100);
  check('favourites shown', q('.chan') === 1);

  // external player (VLC) path, with a mocked native bridge
  const calls = [];
  w.Capacitor = { isNativePlatform: () => true, registerPlugin: () => ({ open: async o => { calls.push(o); return { launched: true }; } }) };
  cv.S.opts.player = 'vlc';
  await cv.go('live', {}, { reset: true }); await sleep(150);
  w.document.querySelector('.row-ch').click(); await sleep(150);
  check('VLC mode: live goes external, not built-in', calls.length === 1 && !cv.P.open && calls[0].pkg === 'org.videolan.vlc' && /^https?:/.test(calls[0].url), calls[0] && calls[0].pkg);
  await cv.go('vod', { id: cv.S.d.vod[0].stream_id }, { reset: true }); await sleep(250);
  check('movie page has Play in VLC', /Play in VLC/.test(w.document.querySelector('.detail').textContent));
  cv.S.opts.player = 'builtin';
  const btn = [...w.document.querySelectorAll('.btn')].find(b => /Play in VLC/.test(b.textContent)); btn.click(); await sleep(100);
  check('Play in VLC button forces VLC', calls.length === 2 && !cv.P.open);
  await cv.go('settings', {}, { reset: true }); await sleep(100);
  check('settings has theme + player pickers', q('.chip.swatch') === 6 && q('.chip') === 9, q('.chip.swatch') + ' themes / ' + q('.chip') + ' chips');
  w.document.querySelector('.chip[data-id="vlc"]').click();
  check('picker saves choice', cv.S.opts.player === 'vlc' && JSON.parse(w.localStorage.getItem('cv.opts')).player === 'vlc');
  w.document.querySelector('.chip.swatch[data-id="sunset"]').click();
  check('theme applies + persists', w.document.documentElement.getAttribute('data-theme') === 'sunset' && JSON.parse(w.localStorage.getItem('cv.opts')).theme === 'sunset');
  // sign out path renders login
  await cv.go('login', {}, { reset: true }); await sleep(100);
  check('login form', q('.input') === 3);
  console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nALL GOOD');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
