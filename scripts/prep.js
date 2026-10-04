// Copies hls.js into www/ so the app works fully offline inside the APK.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'node_modules', 'hls.js', 'dist', 'hls.min.js');
const dst = path.join(__dirname, '..', 'www', 'hls.min.js');
fs.copyFileSync(src, dst);
console.log('hls.min.js ->', dst, fs.statSync(dst).size, 'bytes');
