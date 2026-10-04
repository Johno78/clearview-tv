'use strict';
(() => {
/* ============================== helpers ============================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.prototype.slice.call(r.querySelectorAll(s));
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const k in (props || {})) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}
const LS = {
  get(k, d) { try { const v = localStorage.getItem('cv.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cv.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('cv.' + k); } catch (e) {} }
};
const pad = n => (n < 10 ? '0' : '') + n;
const hhmm = ts => { const d = new Date(ts * 1000); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const nowS = () => Math.floor(Date.now() / 1000);
const fmtDur = s => { s = Math.max(0, Math.floor(s || 0)); const hr = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (hr ? hr + ':' + pad(m) : m) + ':' + pad(ss); };
function b64(s) { if (!s) return ''; try { return decodeURIComponent(escape(atob(s))); } catch (e) { try { return atob(s); } catch (_) { return String(s); } } }
function hue(str) { let x = 0; str = String(str || ''); for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) % 360; return x; }
function initials(n) { const w = String(n || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase(); }
function art(url, name, cls) {
  const hh = hue(name);
  const d = h('div', { class: 'art ' + (cls || ''), style: '--h:' + hh + ';--h2:' + ((hh + 45) % 360) }, h('span', { class: 'ini' }, initials(name)));
  if (url && /^https?:/i.test(url)) {
    const im = new Image(); im.alt = ''; im.decoding = 'async';
    im.onload = () => { d.append(im); d.classList.add('has'); };
    im.src = url;
  }
  return d;
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ============================== state ============================== */
const S = {
  creds: LS.get('creds', null), demo: LS.get('demo', false), info: null,
  d: { liveCats: [], live: [], vodCats: [], vod: [], serCats: [], series: [] },
  favs: LS.get('favs', { live: [], vod: [], series: [] }),
  prog: LS.get('prog', {}), opts: Object.assign({ player: 'builtin' }, LS.get('opts', {})), stack: [], cur: null
};
const favKey = (t, id) => t + ':' + id;
const isFav = (t, id) => S.favs[t].indexOf(String(id)) >= 0;
function toggleFav(t, id) {
  id = String(id); const a = S.favs[t], i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1); else a.unshift(id);
  LS.set('favs', S.favs); return i < 0;
}

/* ============================== demo data ============================== */
const DEMO_HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const demo = (() => {
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const chCats = ['News', 'Entertainment', 'Sports', 'Movies', 'Kids', 'Documentaries', 'Music'];
  const chNames = {
    News: ['Beacon News', 'World Report 24', 'Harbour Today', 'Meridian Live', 'Daybreak Direct'],
    Entertainment: ['Prism One', 'Velvet TV', 'Lantern Channel', 'Echo Studios', 'Brightside', 'Comet Comedy'],
    Sports: ['Arena Live', 'Summit Sports', 'Goalpost HD', 'Motor Mile', 'Fairway'],
    Movies: ['Cinema Nova', 'Silver Reel', 'Midnight Features', 'Classic Frames', 'Action Wire'],
    Kids: ['Pebble Kids', 'Sprout Land', 'Rocket Jr', 'Tiny Tunes'],
    Documentaries: ['Terra Earth', 'Deep Time', 'Explorer HD', 'Craft & Make'],
    Music: ['Pulse Hits', 'Vinyl Radio TV', 'Acoustic Room', 'Bassline']
  };
  const progs = {
    News: ['Morning Briefing', 'Headlines', 'Weather Watch', 'Business Today', 'The Late Report'],
    Entertainment: ['Quiz Night', 'The Big Bake-Off', 'Comedy Hour', 'Saturday Showcase', 'Chat Room'],
    Sports: ['Match of the Week', 'Live Racing', 'Highlights Show', 'Golf Classic', 'Sports Desk'],
    Movies: ['Feature Presentation', 'Midweek Matinee', 'Late Night Thriller', 'Family Film', 'Western Night'],
    Kids: ['Cartoon Block', 'Story Time', 'Puzzle Pals', 'Bedtime Tales', 'Dino Days'],
    Documentaries: ['Wild Coasts', 'How It’s Built', 'Lost Cities', 'Ocean Giants', 'Space Files'],
    Music: ['Top 20 Countdown', 'Live Sessions', 'Unplugged', 'Retro Rewind', 'Chart Show']
  };
  const adj = ['Silent', 'Crimson', 'Last', 'Hidden', 'Northern', 'Broken', 'Golden', 'Midnight', 'Final', 'Wild', 'Paper', 'Iron'];
  const noun = ['Harbour', 'Horizon', 'Garden', 'Signal', 'Voyage', 'Kingdom', 'Letter', 'Summer', 'Frontier', 'Mirror', 'Orchard', 'Tide'];
  const genres = ['Action', 'Comedy', 'Drama', 'Thriller', 'Family', 'Sci-Fi'];
  const live = []; let n = 1;
  chCats.forEach((c, ci) => chNames[c].forEach(nm => live.push({ num: 0, name: nm, stream_id: 100 + live.length, stream_icon: '', category_id: String(ci + 1), cat: c, epg_channel_id: 'x' + live.length })));
  live.forEach((c, i) => c.num = i + 1);
  const vod = []; const r = rng(7);
  for (let i = 0; i < 60; i++) {
    const g = i % genres.length;
    vod.push({ num: i + 1, name: 'The ' + adj[Math.floor(r() * adj.length)] + ' ' + noun[Math.floor(r() * noun.length)] + (i > 23 ? ' ' + (2 + i % 3) : ''), stream_id: 1000 + i, stream_icon: '', rating: (5 + r() * 4).toFixed(1), added: String(1700000000 + (60 - i) * 86400), category_id: String(g + 1), container_extension: 'mp4' });
  }
  const series = [];
  for (let i = 0; i < 30; i++) { const g = i % genres.length; series.push({ num: i + 1, name: adj[Math.floor(r() * adj.length)] + ' ' + noun[Math.floor(r() * noun.length)] + ' Mysteries', series_id: 500 + i, cover: '', plot: 'A gripping run of episodes following a close-knit group as secrets unravel across the seasons.', genre: genres[g], rating: (6 + r() * 3).toFixed(1), category_id: String(g + 1), last_modified: String(1700000000 + (30 - i) * 86400) }); }
  const plot = 'An original demo synopsis. When an unexpected message arrives, an ordinary day turns into a race against time that forces everyone involved to question what they thought they knew.';
  function epg(id, limit) {
    const rr = rng(id * 97); const t0 = Math.floor(nowS() / 3600) * 3600 - 7200; const ch = live.find(x => x.stream_id == id) || live[0];
    const list = progs[ch.cat]; const out = []; let t = t0, k = Math.floor(rr() * 5);
    while (t < nowS() + 14400) { const dur = (rr() < .5 ? 30 : rr() < .6 ? 60 : 90) * 60; out.push({ title: btoa(list[k++ % list.length]), description: btoa('Demo programme description.'), start_timestamp: String(t), stop_timestamp: String(t + dur) }); t += dur; }
    return { epg_listings: out.filter(p => +p.stop_timestamp > nowS()).slice(0, limit || 4) };
  }
  return {
    live, vod, series,
    async call(a, p) {
      await sleep(60);
      switch (a) {
        case '': return { user_info: { auth: 1, status: 'Active', username: 'demo', exp_date: String(nowS() + 86400 * 90), max_connections: '1', active_cons: '0' }, server_info: { url: 'demo' } };
        case 'get_live_categories': return chCats.map((c, i) => ({ category_id: String(i + 1), category_name: c }));
        case 'get_live_streams': return live;
        case 'get_vod_categories': case 'get_series_categories': return genres.map((c, i) => ({ category_id: String(i + 1), category_name: c }));
        case 'get_vod_streams': return vod;
        case 'get_series': return series;
        case 'get_vod_info': { const v = vod.find(x => x.stream_id == p.vod_id) || vod[0]; return { info: { plot, genre: genres[(v.category_id | 0) - 1], releasedate: '2024', rating: v.rating, duration: '1h 48m', director: 'A. Demo', cast: 'Demo Cast' }, movie_data: { stream_id: v.stream_id, container_extension: 'mp4' } }; }
        case 'get_series_info': {
          const eps = {}; for (let s = 1; s <= 3; s++) { eps[s] = []; for (let e = 1; e <= 6; e++) eps[s].push({ id: String(9000 + s * 100 + e), episode_num: e, title: 'Episode ' + e, container_extension: 'mp4', info: { duration: '45m', plot: 'Demo episode ' + e + ' of season ' + s + '.' } }); }
          return { info: { plot: 'A gripping run of episodes following a close-knit group as secrets unravel.', genre: 'Drama', rating: '8.1' }, episodes: eps };
        }
        case 'get_short_epg': return epg(p.stream_id, +p.limit);
      }
      return [];
    }
  };
})();

/* ============================== xtream api ============================== */
const api = {
  base() { let s = (S.creds && S.creds.server || '').trim(); if (!s) return ''; if (!/^https?:\/\//i.test(s)) s = 'http://' + s; return s.replace(/\/+$/, ''); },
  cred() { return encodeURIComponent(S.creds.user) + '/' + encodeURIComponent(S.creds.pass); },
  async call(action, params) {
    if (S.demo) return demo.call(action || '', params || {});
    const q = new URLSearchParams({ username: S.creds.user, password: S.creds.pass });
    if (action) q.set('action', action);
    for (const k in (params || {})) q.set(k, params[k]);
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = setTimeout(() => ctl && ctl.abort(), action ? 90000 : 20000);
    try {
      const r = await fetch(this.base() + '/player_api.php?' + q.toString(), ctl ? { signal: ctl.signal } : {});
      if (!r.ok) throw new Error('Server replied ' + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  },
  live(id) { return S.demo ? DEMO_HLS : this.base() + '/live/' + this.cred() + '/' + id + '.m3u8'; },
  liveExt(id) {
    if (S.demo) return DEMO_HLS;
    const f = S.info && S.info.allowed_output_formats; const ts = !Array.isArray(f) || !f.length || f.indexOf('ts') >= 0;
    return this.base() + '/live/' + this.cred() + '/' + id + (ts ? '.ts' : '.m3u8');
  },
  movie(id, ext) { return S.demo ? DEMO_HLS : this.base() + '/movie/' + this.cred() + '/' + id + '.' + (ext || 'mp4'); },
  episode(id, ext) { return S.demo ? DEMO_HLS : this.base() + '/series/' + this.cred() + '/' + id + '.' + (ext || 'mp4'); }
};
const epgCache = new Map();
async function getEpg(id, limit) {
  limit = limit || 4; const k = id + ':' + limit; const c = epgCache.get(k);
  if (c && Date.now() - c.t < 300000) return c.v;
  let v = [];
  try {
    const r = await api.call('get_short_epg', { stream_id: id, limit });
    v = ((r && r.epg_listings) || []).map(p => ({ title: b64(p.title), desc: b64(p.description), start: +p.start_timestamp, stop: +p.stop_timestamp })).filter(p => p.stop > p.start);
  } catch (e) {}
  epgCache.set(k, { t: Date.now(), v }); return v;
}
const nowProg = list => list.find(p => p.start <= nowS() && p.stop > nowS()) || null;

async function loadLibrary(setMsg) {
  const jobs = [['liveCats', 'get_live_categories', 'channel groups'], ['live', 'get_live_streams', 'channels'], ['vodCats', 'get_vod_categories', 'movie genres'], ['vod', 'get_vod_streams', 'movies'], ['serCats', 'get_series_categories', 'series genres'], ['series', 'get_series', 'series']];
  let done = 0;
  await Promise.all(jobs.map(async ([k, a, label]) => {
    try { const r = await api.call(a); S.d[k] = Array.isArray(r) ? r : []; } catch (e) { S.d[k] = []; }
    setMsg('Loading your library… ' + (++done) + '/' + jobs.length);
  }));
  S.d.live.sort((a, b) => (+a.num || 0) - (+b.num || 0));
  S.d.vod.sort((a, b) => (+b.added || 0) - (+a.added || 0));
  S.d.series.sort((a, b) => (+b.last_modified || 0) - (+a.last_modified || 0));
}

/* ============================== navigation ============================== */
const TABS = [['home', 'Home'], ['live', 'Live TV'], ['guide', 'Guide'], ['movies', 'Movies'], ['series', 'Series'], ['favs', 'Favourites'], ['settings', 'Settings']];
const views = {};
function buildTabs() {
  const t = $('#tabs'); t.innerHTML = '';
  TABS.forEach(([id, label]) => t.append(h('div', { class: 'f tab', tabindex: 0, 'data-tab': id, onclick: () => go(id, {}, { reset: true }) }, label)));
}
function focusables() { return $$('.f').filter(e => e.offsetParent !== null || e.getClientRects().length); }
function focusIn(root, idx) {
  const list = $$('.f', root).filter(e => !e.classList.contains('tab'));
  const el = (idx != null && list[idx]) || $('[data-autofocus]', root) || list[0] || $('.tab.on');
  if (el) el.focus({ preventScroll: false });
}
function focusIndex() { const a = document.activeElement; if (!a) return null; const l = $$('.f', $('#view')); const i = l.indexOf(a); return i < 0 ? null : i; }
async function render(name, params, restore) {
  const v = $('#view'); v.innerHTML = ''; v.scrollTop = 0;
  S.cur = { name, params };
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name || (name === 'vod' && t.dataset.tab === 'movies') || (name === 'seriesInfo' && t.dataset.tab === 'series')));
  try { await views[name](v, params || {}); } catch (e) { v.append(h('div', { class: 'empty' }, 'Something went wrong loading this screen.', h('br'), String(e && e.message || e))); console.error(e); }
  focusIn(v, restore);
}
function go(name, params, opts) {
  opts = opts || {};
  if (opts.reset) S.stack = [];
  else if (S.cur && !opts.replace) S.stack.push({ name: S.cur.name, params: S.cur.params, idx: focusIndex() });
  return render(name, params);
}
function goBack() {
  if (P.open) { if (P.drawer) closeDrawer(); else closePlayer(); return; }
  const a = document.activeElement;
  if (a && a.tagName === 'INPUT') { a.blur(); return; }
  if (S.stack.length) { const p = S.stack.pop(); render(p.name, p.params, p.idx); return; }
  if (S.cur && S.cur.name !== 'home' && S.cur.name !== 'login') { render('home', {}); return; }
  const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (cap && cap.exitApp && S.cur && S.cur.name === 'home') cap.exitApp();
}

/* spatial (D-pad) navigation */
function scopeRoot() { if (P.open) return P.drawer ? $('#drawer') : null; return $('#app'); }
function move(dir) {
  const root = scopeRoot(); if (!root) return;
  const cands = $$('.f', root).filter(e => e.getClientRects().length);
  const cur = document.activeElement;
  if (!cur || !cur.classList.contains('f') || !root.contains(cur)) { if (cands[0]) cands[0].focus(); return; }
  const r = cur.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = Infinity;
  for (const c of cands) {
    if (c === cur) continue;
    const b = c.getBoundingClientRect(); const dx = b.left + b.width / 2 - cx, dy = b.top + b.height / 2 - cy;
    let prim, perp;
    if (dir === 'right') { if (b.left < r.right - r.width * .4 && dx < 4) continue; prim = Math.max(dx, 0); perp = Math.abs(dy); }
    else if (dir === 'left') { if (b.right > r.left + r.width * .4 && dx > -4) continue; prim = Math.max(-dx, 0); perp = Math.abs(dy); }
    else if (dir === 'down') { if (dy < 4 || b.top < r.bottom - r.height * .5) continue; prim = Math.max(dy, 0); perp = Math.abs(dx); }
    else { if (dy > -4 || b.bottom > r.top + r.height * .5) continue; prim = Math.max(-dy, 0); perp = Math.abs(dx); }
    const sc = prim + perp * 2.6;
    if (sc < bs) { bs = sc; best = c; }
  }
  if (best) best.focus();
}
document.addEventListener('focusin', e => {
  const t = e.target; if (t && t.classList && t.classList.contains('f') && t.scrollIntoView && !t.classList.contains('tab')) {
    try { t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
  }
});

/* keys */
const KEY = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Escape: 'back', Backspace: 'back', GoBack: 'back', BrowserBack: 'back', ContextMenu: 'menu', PageUp: 'chup', PageDown: 'chdn', ChannelUp: 'chup', ChannelDown: 'chdn', MediaPlayPause: 'pp', MediaPlay: 'play', MediaPause: 'pause', MediaFastForward: 'ff', MediaRewind: 'rw', MediaTrackNext: 'chdn', MediaTrackPrevious: 'chup' };
const KEYC = { 4: 'back', 82: 'menu', 166: 'chup', 167: 'chdn', 179: 'pp', 85: 'pp', 126: 'play', 127: 'pause', 228: 'ff', 227: 'rw', 90: 'ff', 89: 'rw' };
document.addEventListener('keydown', e => {
  const k = KEY[e.key] || (e.key === ' ' ? 'ok' : null) || KEYC[e.keyCode]; if (!k) return;
  const a = document.activeElement; const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
  if (typing) {
    if (k === 'left' || k === 'right') return;
    if (k === 'ok') { if (a.dataset.submit) { e.preventDefault(); a.blur(); const b = $('[data-primary]'); if (b) b.click(); } return; }
    if (e.key === 'Backspace') return;
  }
  if (P.open && !P.drawer) { e.preventDefault(); playerKey(k); return; }
  if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { e.preventDefault(); move(k); }
  else if (k === 'ok') { if (a && a.classList && a.classList.contains('f')) { e.preventDefault(); a.click(); } }
  else if (k === 'back') { e.preventDefault(); goBack(); }
  else if (k === 'menu') { e.preventDefault(); const t = a && a.closest && a.closest('[data-fav]'); if (t) { const [ty, id] = t.dataset.fav.split(':'); const on = toggleFav(ty, id); t.classList.toggle('is-fav', on); toast(on ? 'Added to favourites' : 'Removed from favourites'); } }
});
(function capBack() {
  const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (cap && cap.addListener) cap.addListener('backButton', () => goBack());
})();

function tickClock() { const d = new Date(); $('#clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()); }

/* ============================== tiles ============================== */
function chunked(box, items, mk, size) {
  size = size || 48; let n = 0;
  function more() { const fr = document.createDocumentFragment(); const end = Math.min(items.length, n + size); for (; n < end; n++) fr.append(mk(items[n], n)); box.append(fr); }
  more();
  box.addEventListener('focusin', e => {
    if (n >= items.length) return;
    let t = e.target; while (t && t.parentNode !== box) t = t.parentNode;
    const i = Array.prototype.indexOf.call(box.children, t);
    if (i >= box.children.length - 14) more();
  });
}
function posterTile(it, type, extra) {
  const id = type === 'vod' ? it.stream_id : it.series_id; const img = type === 'vod' ? it.stream_icon : it.cover;
  const key = type === 'vod' ? 'm' + id : null; const pr = key && S.prog[key];
  const t = h('div', { class: 'f tile poster' + (isFav(type, id) ? ' is-fav' : ''), tabindex: 0, 'data-fav': favKey(type, id),
    onclick: () => go(type === 'vod' ? 'vod' : 'seriesInfo', { id }) },
    art(img, it.name), h('div', { class: 't' }, it.name), h('span', { class: 'star' }, '★'),
    pr ? h('div', { class: 'prog' }, h('u', { style: 'width:' + Math.round(pr.t / pr.d * 100) + '%' })) : null);
  return t;
}
function chanTile(list, i) {
  const ch = list[i];
  return h('div', { class: 'f tile chan' + (isFav('live', ch.stream_id) ? ' is-fav' : ''), tabindex: 0, 'data-fav': favKey('live', ch.stream_id), onclick: () => playLive(list, i) },
    art(ch.stream_icon, ch.name, 'logo'), h('div', { class: 't' }, (ch.num || i + 1) + '  ' + ch.name), h('span', { class: 'star' }, '★'));
}
function resumeTile(rec) {
  return h('div', { class: 'f tile poster', tabindex: 0, onclick: () => resumeRec(rec) },
    art(rec.cover, rec.title), h('div', { class: 't' }, rec.sub || rec.title),
    h('div', { class: 'prog' }, h('u', { style: 'width:' + Math.round(rec.t / rec.d * 100) + '%' })));
}
function chanRow(ch, list, i) {
  const now = h('div', { class: 'now' }, '');
  const row = h('div', { class: 'f row-ch' + (isFav('live', ch.stream_id) ? ' is-fav' : ''), tabindex: 0, 'data-fav': favKey('live', ch.stream_id), onclick: () => playLive(list, i) },
    h('span', { class: 'num' }, ch.num || i + 1), art(ch.stream_icon, ch.name, 'logo'),
    h('div', { class: 'meta' }, h('div', { class: 'nm' }, ch.name), now), h('span', { class: 'star' }, '★'));
  row.addEventListener('focus', () => getEpg(ch.stream_id, 2).then(p => { const n = nowProg(p) || p[0]; if (n) now.textContent = hhmm(n.start) + '  ' + n.title; }), { once: true });
  return row;
}
function shelf(title, tiles) { return tiles.length ? h('section', { class: 'shelf' }, h('h2', null, title), h('div', { class: 'track' }, tiles)) : null; }

/* rail + list layout used by Live / Movies / Series */
function railView(v, o) {
  let sel = LS.get('sel.' + o.type, 'all'), q = '', timer;
  const all = o.items;
  const catId = i => String(i.category_id);
  const list = h('div', { class: o.grid ? 'pgrid' : 'clist' });
  const hdr = h('div', { class: 'hdr' });
  const main = h('div', { class: 'main' }, hdr, list);
  const rail = h('div', { class: 'rail' });
  const search = h('input', { class: 'f search', type: 'text', placeholder: 'Search ' + o.title.toLowerCase(), autocomplete: 'off', oninput: e => { q = e.target.value.trim().toLowerCase(); fill(); } });
  const cats = [{ id: 'fav', name: '★ Favourites' }, { id: 'all', name: 'All ' + o.title }].concat((o.cats || []).map(c => ({ id: String(c.category_id), name: c.category_name })));
  if (!cats.some(c => c.id === sel)) sel = 'all';
  const btns = {};
  function itemsFor() {
    let r = all;
    if (q) return r.filter(i => String(i.name || '').toLowerCase().indexOf(q) >= 0);
    if (sel === 'fav') r = all.filter(i => isFav(o.type, i[o.idKey]));
    else if (sel !== 'all') r = all.filter(i => catId(i) === sel);
    return r;
  }
  function fill() {
    const items = itemsFor(); list.innerHTML = '';
    const name = q ? 'Search results' : (cats.find(c => c.id === sel) || {}).name;
    hdr.innerHTML = ''; hdr.append(h('span', null, name), h('span', null, items.length + ' ' + (items.length === 1 ? 'item' : 'items')));
    if (!items.length) { list.append(h('div', { class: 'empty', style: 'grid-column:1/-1' }, q ? 'Nothing matches that search.' : sel === 'fav' ? 'No favourites yet.\nHighlight something and press the Menu button (☰).' : 'Nothing here.')); return; }
    chunked(list, items, o.mk(items), o.grid ? 60 : 40);
    if (!o.grid) $$('.row-ch', list).slice(0, 12).forEach(r => r.dispatchEvent(new Event('focus')));
  }
  function choose(id) { sel = id; LS.set('sel.' + o.type, id); Object.keys(btns).forEach(k => btns[k].classList.toggle('on', k === id)); search.value = ''; q = ''; fill(); }
  rail.append(h('h2', null, o.title), search);
  cats.forEach(c => {
    const b = h('div', { class: 'f cat' + (c.id === sel ? ' on' : ''), tabindex: 0, 'data-id': c.id,
      onfocus: () => { clearTimeout(timer); timer = setTimeout(() => { if (sel !== c.id) choose(c.id); }, 220); },
      onclick: () => { choose(c.id); const f = $('.f', list); if (f) f.focus(); } }, c.name);
    btns[c.id] = b; rail.append(b);
  });
  v.append(h('div', { class: 'layout' }, rail, main));
  fill();
  const first = btns[sel]; if (first) first.setAttribute('data-autofocus', '');
  if (o.hint) main.append(h('div', { class: 'hint' }, o.hint));
}

/* ============================== views ============================== */
views.login = async (v) => {
  $('#top').classList.add('hide');
  const c = S.creds || {};
  const server = h('input', { class: 'f input', type: 'text', value: c.server || '', placeholder: 'http://provider.example:8080', autocomplete: 'off', autocapitalize: 'off' });
  const user = h('input', { class: 'f input', type: 'text', value: c.user || '', autocomplete: 'off', autocapitalize: 'off' });
  const pass = h('input', { class: 'f input', type: 'password', value: c.pass || '', autocomplete: 'off', 'data-submit': '1' });
  const err = h('div', { class: 'err' });
  async function submit() {
    const s = server.value.trim(), u = user.value.trim(), p = pass.value;
    if (!s || !u || !p) { err.textContent = 'Enter the server address, username and password from your provider.'; return; }
    S.demo = false; S.creds = { server: s, user: u, pass: p }; err.textContent = '';
    boot('Signing in…');
    try {
      const r = await api.call('');
      const ok = r && r.user_info && (r.user_info.auth === 1 || r.user_info.auth === '1');
      if (!ok) throw new Error('Those details were not accepted.');
      if (r.user_info.status && r.user_info.status !== 'Active') throw new Error('This account is ' + r.user_info.status + '.');
      S.info = r.user_info; LS.set('creds', S.creds); LS.set('demo', false);
      await enter();
    } catch (e) {
      bootOff(); S.creds = null;
      err.textContent = (e instanceof TypeError || /Failed to fetch|NetworkError|abort/i.test(String(e.message))) ? 'Couldn’t reach that server. Check the address (including the port) and your connection.' : String(e.message || e);
    }
  }
  v.append(h('div', { class: 'card' },
    h('div', { class: 'brand', style: 'margin-bottom:1.6rem' }, h('i'), h('b', null, 'clearview')),
    h('h1', null, 'Sign in'),
    h('p', { class: 'sub' }, 'Enter the Xtream Codes details from your provider. Clearview is just a player — it doesn’t supply any channels or content.'),
    h('label', null, 'Server address'), server, h('label', null, 'Username'), user, h('label', null, 'Password'), pass, err,
    h('div', { class: 'acts' },
      h('div', { class: 'f btn pri', tabindex: 0, 'data-primary': '1', onclick: submit }, 'Sign in'),
      h('div', { class: 'f btn', tabindex: 0, onclick: async () => { S.demo = true; S.creds = { server: 'demo', user: 'demo', pass: 'demo' }; LS.set('demo', true); S.info = (await api.call('')).user_info; boot('Loading demo…'); await enter(); } }, 'Try the demo'))));
};

views.home = async (v) => {
  $('#top').classList.remove('hide');
  const prog = Object.values(S.prog).sort((a, b) => b.ts - a.ts);
  const favCh = S.d.live.filter(c => isFav('live', c.stream_id));
  const newest = S.d.vod.slice(0, 24), newSer = S.d.series.slice(0, 24);
  const feat = S.d.vod.filter(x => x.stream_icon)[0] || S.d.vod[0];
  let hero;
  if (prog[0]) {
    const r = prog[0];
    hero = h('div', { class: 'hero' }, h('div', { class: 'bg', style: r.cover ? 'background-image:url("' + r.cover + '")' : 'background:linear-gradient(135deg,hsl(' + hue(r.title) + ',55%,30%),#04050d)' }),
      h('div', { class: 'kick' }, 'Continue watching'), h('h1', null, r.title), h('div', { class: 'meta' }, (r.sub && r.sub !== r.title ? r.sub + ' · ' : '') + fmtDur(r.d - r.t) + ' left'),
      h('div', { class: 'acts' }, h('div', { class: 'f btn pri', tabindex: 0, 'data-autofocus': '1', onclick: () => resumeRec(r) }, '▶  Resume')));
  } else if (feat) {
    hero = h('div', { class: 'hero' }, h('div', { class: 'bg', style: feat.stream_icon ? 'background-image:url("' + feat.stream_icon + '")' : 'background:linear-gradient(135deg,hsl(' + hue(feat.name) + ',55%,30%) 0%,hsl(' + ((hue(feat.name) + 60) % 360) + ',55%,16%) 55%,#04050d 100%)' }),
      h('div', { class: 'kick' }, 'Featured'), h('h1', null, feat.name), h('div', { class: 'meta' }, 'Movie' + (feat.rating && +feat.rating ? ' · ★ ' + feat.rating : '')),
      h('div', { class: 'acts' }, h('div', { class: 'f btn pri', tabindex: 0, 'data-autofocus': '1', onclick: () => go('vod', { id: feat.stream_id }) }, 'More info')));
  } else {
    hero = h('div', { class: 'hero', style: 'height:20rem' }, h('h1', null, 'Welcome'), h('div', { class: 'meta' }, 'Your library looks empty. Check your subscription in Settings.'),
      h('div', { class: 'acts' }, h('div', { class: 'f btn pri', tabindex: 0, 'data-autofocus': '1', onclick: () => go('settings', {}, { reset: true }) }, 'Open settings')));
  }
  v.append(...[hero,
    shelf('Continue watching', prog.slice(1, 20).map(resumeTile)),
    shelf('Your channels', (l => l.map((c, i) => chanTile(l, i)))(favCh.slice(0, 30))),
    shelf('Live channels', (l => l.map((c, i) => chanTile(l, i)))(S.d.live.slice(0, 16))),
    shelf('Recently added movies', newest.map(m => posterTile(m, 'vod'))),
    shelf('Latest series', newSer.map(s => posterTile(s, 'series')))].filter(Boolean));
};

views.live = async (v) => {
  railView(v, { title: 'Live TV', type: 'live', cats: S.d.liveCats, items: S.d.live, idKey: 'stream_id',
    mk: items => (ch, i) => chanRow(ch, items, i), hint: 'Press Menu (☰) on a channel to add or remove it from your favourites.' });
};
views.movies = async (v) => {
  railView(v, { title: 'Movies', type: 'vod', cats: S.d.vodCats, items: S.d.vod, grid: true, idKey: 'stream_id', mk: () => (m) => posterTile(m, 'vod') });
};
views.series = async (v) => {
  railView(v, { title: 'Series', type: 'series', cats: S.d.serCats, items: S.d.series, grid: true, idKey: 'series_id', mk: () => (s) => posterTile(s, 'series') });
};

views.guide = async (v) => {
  const PPM = 0.4, WIN = 240; // rem per minute, minutes shown
  let sel = LS.get('sel.guide', 'all'); const t0 = Math.floor(nowS() / 1800) * 1800;
  const cats = [{ id: 'fav', name: '★ Favourites' }, { id: 'all', name: 'All channels' }].concat(S.d.liveCats.map(c => ({ id: String(c.category_id), name: c.category_name })));
  if (!cats.some(c => c.id === sel)) sel = 'all';
  const chips = h('div', { class: 'chips' }); const wrap = h('div', { class: 'gwrap' });
  const width = WIN * PPM;
  function build() {
    wrap.innerHTML = '';
    let items = sel === 'fav' ? S.d.live.filter(c => isFav('live', c.stream_id)) : sel === 'all' ? S.d.live : S.d.live.filter(c => String(c.category_id) === sel);
    const tl = h('div', { class: 'tl', style: 'width:' + width + 'rem' });
    for (let m = 0; m < WIN; m += 30) tl.append(h('span', { style: 'left:' + (m * PPM + .6) + 'rem' }, hhmm(t0 + m * 60)));
    wrap.append(h('div', { class: 'gtime' }, h('div', { class: 'corner' }), tl));
    if (!items.length) { wrap.append(h('div', { class: 'empty' }, 'No channels here.')); return; }
    const body = h('div'); wrap.append(body);
    chunked(body, items, (ch, i) => {
      const line = h('div', { class: 'gline', style: 'width:' + width + 'rem' });
      getEpg(ch.stream_id, 10).then(p => {
        let any = false;
        p.forEach(pr => {
          const s = Math.max(pr.start, t0), e = Math.min(pr.stop, t0 + WIN * 60); const w = (e - s) / 60 * PPM; if (w < 0.8) return; any = true;
          line.append(h('div', { class: 'f gp' + (pr.start <= nowS() && pr.stop > nowS() ? ' nowp' : ''), tabindex: 0, style: 'left:' + ((s - t0) / 60 * PPM + .1) + 'rem;width:' + (w - .2) + 'rem', title: pr.title, onclick: () => playLive(items, i) }, pr.title));
        });
        if (!any) line.append(h('div', { class: 'f gp none', tabindex: 0, style: 'left:.1rem;width:' + (width - .2) + 'rem', onclick: () => playLive(items, i) }, 'No guide information — press OK to watch'));
      });
      return h('div', { class: 'grow' }, h('div', { class: 'gch' }, art(ch.stream_icon, ch.name), h('span', null, (ch.num || i + 1) + ' ' + ch.name)), line);
    }, 12);
  }
  cats.forEach(c => chips.append(h('div', { class: 'f chip' + (c.id === sel ? ' on' : ''), tabindex: 0, 'data-id': c.id, 'data-autofocus': c.id === sel ? '1' : null,
    onclick: e => { sel = c.id; LS.set('sel.guide', sel); $$('.chip', chips).forEach(x => x.classList.toggle('on', x.dataset.id === sel)); build(); } }, c.name)));
  v.append(h('div', { class: 'guide' }, chips, wrap)); build();
};

views.vod = async (v, { id }) => {
  const it = S.d.vod.find(x => String(x.stream_id) === String(id)); if (!it) { v.append(h('div', { class: 'empty' }, 'Movie not found.')); return; }
  const plot = h('div', { class: 'plot' }, 'Loading details…'), meta = h('div', { class: 'meta' }, 'Movie' + (+it.rating ? ' · ★ ' + it.rating : ''));
  let ext = it.container_extension; const key = 'm' + id; const pr = S.prog[key];
  const rec = () => ({ key, type: 'movie', id, ext, title: it.name, sub: it.name, cover: it.stream_icon });
  const favBtn = h('div', { class: 'f btn', tabindex: 0, onclick: () => { const on = toggleFav('vod', id); favBtn.textContent = on ? '★  In favourites' : '☆  Add to favourites'; } }, isFav('vod', id) ? '★  In favourites' : '☆  Add to favourites');
  v.append(h('div', { class: 'detail' }, h('div', { class: 'bg', style: it.stream_icon ? 'background-image:url("' + it.stream_icon + '")' : '' }),
    h('div', { class: 'cover' }, art(it.stream_icon, it.name)),
    h('div', { class: 'body' }, h('h1', null, it.name), meta, plot,
      h('div', { class: 'acts' },
        h('div', { class: 'f btn pri', tabindex: 0, 'data-autofocus': '1', onclick: () => playVod({ ...rec(), url: api.movie(id, ext) }) }, pr ? '\u25b6  Resume from ' + fmtDur(pr.t) : '\u25b6  Play'),
        isNative() ? h('div', { class: 'f btn', tabindex: 0, onclick: () => playVod({ ...rec(), url: api.movie(id, ext) }, null, 0, 'vlc') }, 'Play in VLC') : null,
        pr ? h('div', { class: 'f btn', tabindex: 0, onclick: () => { delete S.prog[key]; LS.set('prog', S.prog); playVod({ ...rec(), url: api.movie(id, ext) }); } }, 'Start over') : null,
        favBtn))));
  try {
    const r = await api.call('get_vod_info', { vod_id: id }); const i = (r && r.info) || {};
    ext = (r && r.movie_data && r.movie_data.container_extension) || ext;
    plot.textContent = i.plot || i.description || 'No description available.';
    meta.textContent = ['Movie', i.genre, i.releasedate && String(i.releasedate).slice(0, 4), i.duration, +(i.rating || it.rating) ? '★ ' + (i.rating || it.rating) : null].filter(Boolean).join('  ·  ');
    const bd = Array.isArray(i.backdrop_path) ? i.backdrop_path[0] : i.backdrop_path; if (bd) $('.detail .bg', v).style.backgroundImage = 'url("' + bd + '")';
  } catch (e) { plot.textContent = 'No description available.'; }
};

views.seriesInfo = async (v, { id }) => {
  const it = S.d.series.find(x => String(x.series_id) === String(id)); if (!it) { v.append(h('div', { class: 'empty' }, 'Series not found.')); return; }
  const plot = h('div', { class: 'plot' }, it.plot || 'Loading details…'), meta = h('div', { class: 'meta' }, ['Series', it.genre, +it.rating ? '★ ' + it.rating : null].filter(Boolean).join('  ·  '));
  const chips = h('div', { class: 'chips', style: 'padding-left:0' }), eps = h('div', { class: 'eps' });
  const favBtn = h('div', { class: 'f btn', tabindex: 0, onclick: () => { const on = toggleFav('series', id); favBtn.textContent = on ? '★  In favourites' : '☆  Add to favourites'; } }, isFav('series', id) ? '★  In favourites' : '☆  Add to favourites');
  v.append(h('div', { class: 'detail' }, h('div', { class: 'bg', style: it.cover ? 'background-image:url("' + it.cover + '")' : '' }),
    h('div', { class: 'cover' }, art(it.cover, it.name)),
    h('div', { class: 'body' }, h('h1', null, it.name), meta, plot, h('div', { class: 'acts' }, favBtn), chips, eps)));
  let data;
  try { data = await api.call('get_series_info', { series_id: id }); } catch (e) { eps.append(h('div', { class: 'empty' }, 'Couldn’t load episodes.')); return; }
  const i = (data && data.info) || {}; if (i.plot) plot.textContent = i.plot;
  const seasons = data && data.episodes && !Array.isArray(data.episodes) ? data.episodes : {};
  const keys = Object.keys(seasons).sort((a, b) => a - b);
  if (!keys.length) { eps.append(h('div', { class: 'empty' }, 'No episodes available.')); return; }
  let cur = LS.get('season.' + id, keys[0]); if (keys.indexOf(String(cur)) < 0) cur = keys[0];
  function show(sn) {
    cur = sn; LS.set('season.' + id, sn); eps.innerHTML = '';
    $$('.chip', chips).forEach(c => c.classList.toggle('on', c.dataset.s === String(sn)));
    const list = (seasons[sn] || []).slice().sort((a, b) => (+a.episode_num || 0) - (+b.episode_num || 0));
    list.forEach((ep, ix) => {
      const key = 'e' + ep.id, pr = S.prog[key];
      eps.append(h('div', { class: 'f ep', tabindex: 0, onclick: () => {
        const queue = list.map(e2 => ({ key: 'e' + e2.id, type: 'ep', id: e2.id, ext: e2.container_extension, title: it.name, sub: 'S' + sn + ' E' + (e2.episode_num || '') + ' · ' + (e2.title || ''), cover: it.cover, seriesId: id, url: api.episode(e2.id, e2.container_extension) }));
        playVod(queue[ix], queue, ix);
      } }, h('span', { class: 'n' }, 'E' + (ep.episode_num || ix + 1)), h('span', { class: 'tt' }, ep.title || 'Episode ' + (ep.episode_num || ix + 1)), h('span', { class: 'd' }, (ep.info && ep.info.duration) || ''),
        pr ? h('div', { class: 'prog' }, h('u', { style: 'width:' + Math.round(pr.t / pr.d * 100) + '%' })) : null));
    });
  }
  keys.forEach(k => chips.append(h('div', { class: 'f chip' + (String(k) === String(cur) ? ' on' : ''), tabindex: 0, 'data-s': k, onclick: () => show(k) }, 'Season ' + k)));
  show(cur);
  const first = $('.chip.on', chips) || $('.chip', chips); if (first) first.setAttribute('data-autofocus', '1');
};

views.favs = async (v) => {
  const ch = S.d.live.filter(c => isFav('live', c.stream_id)), mv = S.d.vod.filter(c => isFav('vod', c.stream_id)), sr = S.d.series.filter(c => isFav('series', c.series_id));
  v.append(...[h('div', { style: 'height:1rem' }),
    shelf('Channels', ch.map((c, i) => chanTile(ch, i))), shelf('Movies', mv.map(m => posterTile(m, 'vod'))), shelf('Series', sr.map(s => posterTile(s, 'series')))].filter(Boolean));
  if (!ch.length && !mv.length && !sr.length) v.append(h('div', { class: 'empty' }, 'Nothing saved yet.', h('br'), 'Highlight a channel, movie or series and press the Menu button (☰), or use “Add to favourites” on its page.'));
};

function playerPicker() {
  const opts = [['builtin', 'Built-in'], ['vlc', 'VLC'], ['any', 'Choose app']];
  const box = h('div', { class: 'chips', style: 'padding-left:0' });
  opts.forEach(([id, label]) => box.append(h('div', { class: 'f chip' + (S.opts.player === id ? ' on' : ''), tabindex: 0, 'data-id': id, onclick: () => {
    S.opts.player = id; LS.set('opts', S.opts); $$('.chip', box).forEach(c => c.classList.toggle('on', c.dataset.id === id));
    toast(id === 'builtin' ? 'Using the built-in player' : id === 'vlc' ? 'Using VLC for live TV, movies and episodes' : 'You\u2019ll pick a player app each time');
  } }, label)));
  return h('div', null, h('label', { style: 'display:block;color:var(--dim);font-size:1.15rem;margin:1.4rem 0 .2rem' }, 'Player for live TV, movies and episodes'), box,
    h('div', { class: 'hint', style: 'padding-left:0' }, isNative() ? 'VLC must be installed on the Fire TV (free in the Fire TV app store).' : 'VLC and other apps work in the Fire TV app, not in a browser.'));
}
views.settings = async (v) => {
  const i = S.info || {}; const exp = +i.exp_date ? new Date(+i.exp_date * 1000).toLocaleDateString() : 'Unlimited / unknown';
  v.append(h('div', { class: 'card', style: 'margin-top:2rem' }, h('h1', null, 'Settings'),
    h('div', { class: 'kv' },
      h('span', null, 'Account'), h('span', null, S.demo ? 'Demo mode' : (S.creds && S.creds.user) || '—'),
      h('span', null, 'Status'), h('span', null, i.status || '—'), h('span', null, 'Expires'), h('span', null, exp),
      h('span', null, 'Connections'), h('span', null, (i.active_cons || 0) + ' of ' + (i.max_connections || '?') + ' in use'),
      h('span', null, 'Library'), h('span', null, S.d.live.length + ' channels · ' + S.d.vod.length + ' movies · ' + S.d.series.length + ' series')),
    playerPicker(),
    h('div', { class: 'acts' },
      h('div', { class: 'f btn pri', tabindex: 0, 'data-autofocus': '1', onclick: async () => { boot('Refreshing library…'); epgCache.clear(); await loadLibrary(bootMsg); bootOff(); go('home', {}, { reset: true }); } }, 'Refresh library'),
      h('div', { class: 'f btn', tabindex: 0, onclick: () => { S.prog = {}; LS.set('prog', S.prog); toast('Continue watching cleared'); } }, 'Clear continue watching'),
      h('div', { class: 'f btn', tabindex: 0, onclick: () => { LS.del('creds'); LS.del('demo'); S.creds = null; S.demo = false; S.stack = []; S.d = { liveCats: [], live: [], vodCats: [], vod: [], serCats: [], series: [] }; go('login', {}, { reset: true }); } }, 'Sign out'))));
};

/* ============================== player ============================== */
const P = { open: false, type: null, list: [], idx: 0, drawer: false, hls: null, item: null, queue: null, qi: 0, saveT: 0, ui: null, ret: null, retry: 0, resume: 0 };
const pv = () => $('#video');
function showUI(el, ms) { const n = $(el); n.classList.add('on'); clearTimeout(P.ui); P.ui = setTimeout(() => n.classList.remove('on'), ms || 4500); }
function hideUI() { $('#pInfo').classList.remove('on'); $('#pBar').classList.remove('on'); }
function busy(on) { $('#busy').classList.toggle('on', !!on); }
function fail(msg) { busy(false); const e = $('#pErr'); e.innerHTML = ''; e.append(h('div', null, 'This stream couldn’t be played.'), h('small', null, (msg ? msg + ' \u00b7 ' : '') + (isNative() ? 'OK = open in VLC  \u00b7  ' : '') + 'Back to return' + (P.type === 'live' ? '  \u00b7  \u25b2\u25bc other channel' : ''))); e.classList.add('on'); }
function destroyMedia() { const v = pv(); if (P.hls) { try { P.hls.destroy(); } catch (e) {} P.hls = null; } try { v.pause(); } catch (e) {} v.removeAttribute('src'); try { v.load(); } catch (e) {} }
function attach(url, startAt) {
  destroyMedia(); const v = pv(); $('#pErr').classList.remove('on'); busy(true); P.retry = 0; P.resume = startAt || 0;
  if (/\.m3u8(\?|$)/i.test(url) && window.Hls && Hls.isSupported()) {
    const hls = new Hls({ maxBufferLength: 30, enableWorker: true }); P.hls = hls;
    hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { if (d.type === Hls.ErrorTypes.NETWORK_ERROR && P.retry++ < 2) hls.startLoad(); else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && P.retry++ < 2) hls.recoverMediaError(); else fail(d.details); } });
    hls.loadSource(url); hls.attachMedia(v);
  } else v.src = url;
  const p = v.play(); if (p && p.catch) p.catch(() => {});
}
function openPlayer() { if (!P.open) { P.ret = document.activeElement; P.open = true; $('#player').classList.add('on'); } }
function closePlayer() {
  saveProgress(true); destroyMedia(); closeDrawer(); hideUI(); busy(false); $('#pErr').classList.remove('on');
  P.open = false; P.item = null; P.queue = null; $('#player').classList.remove('on');
  if (S.cur && (S.cur.name === 'home' || S.cur.name === 'seriesInfo' || S.cur.name === 'vod')) { const c = S.cur; render(c.name, c.params, null); }
  else if (P.ret && document.body.contains(P.ret)) P.ret.focus();
}
function tune() {
  const ch = P.list[P.idx]; if (!ch) return; P.item = null; openPlayer(); LS.set('lastlive', ch.stream_id);
  attach(api.live(ch.stream_id));
  const info = $('#pInfo'); info.innerHTML = '';
  const now = h('div', { class: 'pi-n' }, ''), nxt = h('div', { class: 'pi-x' }, ''), bar = h('u');
  info.append(h('div', { class: 'pi-row' }, art(ch.stream_icon, ch.name, 'logo'), h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'pi-t' }, (ch.num || P.idx + 1) + '   ' + ch.name), now, nxt)),
    h('div', { class: 'pbar' }, bar), h('div', { class: 'pi-h' }, '▲▼ change channel  ·  ◀ channel list  ·  ▶ favourite'));
  showUI('#pInfo'); $('#pBar').classList.remove('on');
  getEpg(ch.stream_id, 3).then(p => {
    if (P.list[P.idx] !== ch) return; const n = nowProg(p) || p[0]; if (!n) { now.textContent = 'No guide information'; return; }
    now.textContent = hhmm(n.start) + ' – ' + hhmm(n.stop) + '   ' + n.title; bar.style.width = Math.max(0, Math.min(100, (nowS() - n.start) / (n.stop - n.start) * 100)) + '%';
    const nx = p[p.indexOf(n) + 1]; if (nx) nxt.textContent = 'Next: ' + hhmm(nx.start) + '  ' + nx.title;
  });
}
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function extPkg() { if (!isNative() || !S.opts || S.opts.player === 'builtin') return null; return S.opts.player === 'vlc' ? 'org.videolan.vlc' : ''; }
let EP = null;
async function openExternal(url, title, posMs, pkg) {
  if (!isNative()) { toast('External players only work in the Fire TV app'); return false; }
  try {
    EP = EP || window.Capacitor.registerPlugin('ExternalPlayer');
    const r = await EP.open({ url, title: title || '', pkg: pkg || '', positionMs: posMs || 0 });
    if (r && r.launched === false) { toast(pkg === 'org.videolan.vlc' ? 'VLC isn\u2019t installed \u2014 get it from the Fire TV app store' : 'No player app found'); return false; }
    return true;
  } catch (e) { toast('Couldn\u2019t open the player'); return false; }
}
function playLive(list, idx) {
  const pkg = extPkg();
  if (pkg != null) { const c = list[idx]; if (c) openExternal(api.liveExt(c.stream_id), c.name, 0, pkg); return; } P.type = 'live'; P.list = list; P.idx = idx; P.queue = null; tune(); }
function playVod(rec, queue, qi, force) {
  const pkg = force === 'vlc' ? (isNative() ? 'org.videolan.vlc' : null) : extPkg();
  if (pkg != null) { const pr0 = S.prog[rec.key]; openExternal(rec.url, rec.sub || rec.title, pr0 && pr0.t > 10 ? Math.floor(pr0.t * 1000) : 0, pkg); return; }
  P.type = 'vod'; P.item = rec; P.queue = queue || null; P.qi = qi || 0; openPlayer();
  const pr = S.prog[rec.key]; attach(rec.url, pr && pr.t > 10 ? pr.t : 0);
  const bar = $('#pBar'); bar.innerHTML = '';
  bar.append(h('div', { class: 'pi-t' }, rec.title), rec.sub && rec.sub !== rec.title ? h('div', { class: 'pi-n' }, rec.sub) : null,
    h('div', { class: 'pbar' }, h('u', { id: 'pFill' })), h('div', { class: 'pb-times' }, h('span', { id: 'pCur' }, '0:00'), h('span', { id: 'pDur' }, '0:00')),
    h('div', { class: 'pi-h' }, '◀▶ skip 10s  ·  OK pause / play  ·  Back to exit'));
  showUI('#pBar'); $('#pInfo').classList.remove('on');
}
function resumeRec(r) { const url = r.type === 'ep' ? api.episode(r.id, r.ext) : api.movie(r.id, r.ext); playVod({ ...r, url }); }
function saveProgress(force) {
  if (P.type !== 'vod' || !P.item) return; const v = pv(); if (!v.duration || isNaN(v.duration)) return;
  const t = Date.now(); if (!force && t - P.saveT < 5000) return; P.saveT = t;
  const cur = v.currentTime, dur = v.duration, it = P.item;
  if (dur - cur < 60 || cur > dur - 30) delete S.prog[it.key];
  else if (cur > 15) { const { url, ...rec } = it; S.prog[it.key] = { ...rec, t: cur, d: dur, ts: t }; }
  const keys = Object.keys(S.prog); if (keys.length > 30) keys.sort((a, b) => S.prog[a].ts - S.prog[b].ts).slice(0, keys.length - 30).forEach(k => delete S.prog[k]);
  LS.set('prog', S.prog);
}
function seek(d) { const v = pv(); if (v.duration) v.currentTime = Math.max(0, Math.min(v.duration - 1, v.currentTime + d)); }
function playerKey(k) {
  const v = pv();
  if ($('#pErr').classList.contains('on')) {
    if (k === 'back') { closePlayer(); return; }
    if (k === 'ok' && isNative()) {
      const live = P.type === 'live', ch = P.list[P.idx], it = P.item;
      const url = live ? api.liveExt(ch.stream_id) : it && it.url, title = live ? ch.name : it && (it.sub || it.title);
      const pkg = extPkg() != null ? extPkg() : 'org.videolan.vlc';
      closePlayer(); if (url) openExternal(url, title, 0, pkg); return;
    }
  }
  if (P.type === 'live') {
    if (k === 'up' || k === 'chup') { P.idx = (P.idx - 1 + P.list.length) % P.list.length; tune(); }
    else if (k === 'down' || k === 'chdn') { P.idx = (P.idx + 1) % P.list.length; tune(); }
    else if (k === 'ok') showUI('#pInfo');
    else if (k === 'left') openDrawer();
    else if (k === 'right') { const ch = P.list[P.idx]; const on = toggleFav('live', ch.stream_id); toast(on ? 'Added to favourites' : 'Removed from favourites'); showUI('#pInfo'); }
    else if (k === 'back') closePlayer();
    else if (k === 'pp') { v.paused ? v.play() : v.pause(); }
  } else {
    if (k === 'left' || k === 'rw') { seek(-10); showUI('#pBar'); }
    else if (k === 'right' || k === 'ff') { seek(10); showUI('#pBar'); }
    else if (k === 'ok' || k === 'pp') { if (v.paused) { v.play(); showUI('#pBar'); } else { v.pause(); showUI('#pBar', 60000); } }
    else if (k === 'play') v.play(); else if (k === 'pause') v.pause();
    else if (k === 'up' || k === 'down') showUI('#pBar');
    else if (k === 'chdn' && P.queue && P.qi + 1 < P.queue.length) { saveProgress(true); playVod(P.queue[P.qi + 1], P.queue, P.qi + 1); }
    else if (k === 'chup' && P.queue && P.qi > 0) { saveProgress(true); playVod(P.queue[P.qi - 1], P.queue, P.qi - 1); }
    else if (k === 'back') closePlayer();
  }
}
function openDrawer() {
  const d = $('#drawer'); d.innerHTML = ''; hideUI();
  const start = Math.max(0, P.idx - 3), items = P.list.slice(start);
  const box = h('div'); d.append(h('h3', null, 'Channels'), box);
  chunked(box, items, (ch, i) => { const r = chanRow(ch, items, i); r.onclick = null; r.addEventListener('click', () => { P.idx = start + i; closeDrawer(); tune(); }); return r; }, 40);
  P.drawer = true; d.classList.add('on'); const cur = box.children[Math.min(3, P.idx)] || box.children[0]; if (cur) cur.focus();
}
function closeDrawer() { if (!P.drawer) return; P.drawer = false; $('#drawer').classList.remove('on'); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
function wireVideo() {
  const v = pv();
  v.addEventListener('playing', () => { busy(false); $('#pErr').classList.remove('on'); });
  v.addEventListener('waiting', () => busy(true));
  v.addEventListener('canplay', () => busy(false));
  v.addEventListener('loadedmetadata', () => { if (P.type === 'vod' && P.resume > 0 && v.duration > P.resume + 30) v.currentTime = P.resume; P.resume = 0; });
  v.addEventListener('error', () => { if (!P.hls) fail(v.error && v.error.message); });
  v.addEventListener('timeupdate', () => {
    if (P.type !== 'vod') return; const f = $('#pFill'); if (f && v.duration) { f.style.width = (v.currentTime / v.duration * 100) + '%'; $('#pCur').textContent = fmtDur(v.currentTime); $('#pDur').textContent = fmtDur(v.duration); }
    saveProgress(false);
  });
  v.addEventListener('ended', () => {
    if (P.type !== 'vod') return; const it = P.item; if (it) { delete S.prog[it.key]; LS.set('prog', S.prog); }
    if (P.queue && P.qi + 1 < P.queue.length) playVod(P.queue[P.qi + 1], P.queue, P.qi + 1); else closePlayer();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(true); });
}

/* ============================== boot ============================== */
function boot(msg) { $('#boot').classList.remove('hide'); bootMsg(msg); }
function bootMsg(m) { $('#bootMsg').textContent = m; }
function bootOff() { $('#boot').classList.add('hide'); }
async function enter() {
  await loadLibrary(bootMsg); bootOff(); buildTabs();
  $('#top').classList.remove('hide'); S.stack = [];
  await render('home', {});
}
async function start() {
  buildTabs(); wireVideo(); tickClock(); setInterval(tickClock, 20000);
  if (S.creds) {
    boot('Signing in…');
    try {
      const r = await api.call(''); const ok = r && r.user_info && (r.user_info.auth === 1 || r.user_info.auth === '1');
      if (!ok) throw new Error('auth');
      S.info = r.user_info; await enter(); return;
    } catch (e) { bootOff(); }
  }
  $('#top').classList.add('hide'); bootOff(); await render('login', {});
}
window.__cv = { S, go, render, views, api, demo, P, playLive, playVod, h, goBack, move };
start();
})();
