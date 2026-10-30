// Builds the browser / phone (PWA) copy of the app into docs/app so GitHub Pages serves it at /app/
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), www = path.join(root, 'www'), out = path.join(root, 'docs', 'app');
const hls = path.join(root, 'node_modules', 'hls.js', 'dist', 'hls.min.js');
if (fs.existsSync(hls)) fs.copyFileSync(hls, path.join(www, 'hls.min.js'));
fs.rmSync(out, { recursive: true, force: true });
(function copy(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a)) {
    const s = path.join(a, f), d = path.join(b, f);
    fs.statSync(s).isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  }
})(www, out);
console.log('web app ->', out);
