// Clearview desktop helper: serves the app on http://localhost:8080 and relays requests to your
// Xtream server (browsers block these directly: plain http + no CORS). Needs Node 18+. No installs.
const http = require('http'), fs = require('fs'), path = require('path'), { Readable } = require('stream');
const PORT = +process.env.PORT || 8080;
const WWW = [path.join(__dirname, 'www'), path.join(__dirname, '..', 'www')].find(d => fs.existsSync(path.join(d, 'index.html')));
if (!WWW) { console.error('Could not find the www folder.'); process.exit(1); }
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const via = u => '/p/' + encodeURIComponent(u);

function rewritePlaylist(text, base) {
  return text.split(/\r?\n/).map(line => {
    if (!line.trim()) return line;
    try {
      if (line[0] === '#') return line.replace(/URI="([^"]+)"/g, (_, u) => 'URI="' + via(new URL(u, base).href) + '"');
      return via(new URL(line.trim(), base).href);
    } catch (e) { return line; }
  }).join('\n');
}

async function relay(req, res, target) {
  let u; try { u = new URL(target); } catch (e) { res.writeHead(400, CORS); return res.end('bad url'); }
  if (!/^https?:$/.test(u.protocol)) { res.writeHead(400, CORS); return res.end('bad protocol'); }
  const ctl = new AbortController(); res.on('close', () => ctl.abort());
  const headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Clearview/0.1' };
  if (req.headers.range) headers.range = req.headers.range;
  try {
    const r = await fetch(u, { headers, redirect: 'follow', signal: ctl.signal });
    const ct = r.headers.get('content-type') || '';
    const finalUrl = r.url || u.href;
    const isList = /mpegurl/i.test(ct) || /\.m3u8?$/i.test(new URL(finalUrl).pathname);
    const out = { ...CORS, 'content-type': ct || 'application/octet-stream' };
    if (isList) {
      const body = rewritePlaylist(await r.text(), finalUrl);
      out['content-type'] = 'application/vnd.apple.mpegurl'; out['cache-control'] = 'no-store';
      res.writeHead(r.status, out); return res.end(body);
    }
    for (const h of ['content-length', 'content-range', 'accept-ranges']) { const v = r.headers.get(h); if (v) out[h] = v; }
    res.writeHead(r.status, out);
    if (!r.body) return res.end();
    Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
  } catch (e) {
    if (!res.headersSent) { res.writeHead(502, CORS); res.end('Could not reach the server: ' + (e.cause && e.cause.code || e.message)); } else res.destroy();
  }
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.url.startsWith('/p/')) return relay(req, res, decodeURIComponent(req.url.slice(3)));
  let f = decodeURIComponent(req.url.split('?')[0]); if (f === '/') f = '/index.html';
  const file = path.join(WWW, path.normalize(f).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(WWW) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  let data = fs.readFileSync(file);
  if (f === '/index.html') data = Buffer.from(data.toString().replace('<script src="hls.min.js">', '<script>window.CV_PROXY=true</script>\n<script src="hls.min.js">'));
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(data);
}).listen(PORT, '127.0.0.1', () => {
  console.log('\n  Clearview is running:  http://localhost:' + PORT + '\n  Leave this window open while you watch. Press Ctrl+C to stop.\n');
}).on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'Port ' + PORT + ' is busy. Close the other Clearview window or set PORT=8081.' : e.message); process.exit(1); });
