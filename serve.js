// Tiny static file server for Perseus Ascendant. Run: node serve.js  then open http://localhost:8080
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, port = process.env.PORT || 8080;
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/webp', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    let type = types[path.extname(f)] || 'application/octet-stream';
    // Some .png files are really WebP; check the signature for true PNGs.
    if (path.extname(f) === '.png') {
      const head = Buffer.alloc(4);
      const fd = fs.openSync(f, 'r'); fs.readSync(fd, head, 0, 4, 0); fs.closeSync(fd);
      if (head[0] === 0x89) type = 'image/png';
    }
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
    // Range requests let the browser seek and loop audio.
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? parseInt(range[1], 10) : 0;
      const end = range[2] ? Math.min(parseInt(range[2], 10), st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, Object.assign(headers, { 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 }));
      fs.createReadStream(f, { start, end }).pipe(res);
    } else {
      res.writeHead(200, Object.assign(headers, { 'Content-Length': st.size }));
      fs.createReadStream(f).pipe(res);
    }
  });
}).listen(port, () => console.log('Perseus Ascendant running at http://localhost:' + port));
