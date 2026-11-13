// Removes the flat magenta background (and JPEG noise around it) from generated art,
// plus the thin dark grid lines some generators draw between frames.
const { readPNG } = require('./png');

// How "magenta" a colour is: red and blue both well above green.
const magentaness = (r, g, b) => Math.min(r, b) - g;
const isBg = (r, g, b) => magentaness(r, g, b) > 85 && Math.abs(r - b) < 80 && r > 90 && b > 90;

// strict: only near-pure magenta counts as background (for art that contains pinks and violets).
const isBgStrict = (r, g, b) => g < 45 && magentaness(r, g, b) > 120 && Math.abs(r - b) < 60;

function keyImage(img, opts = {}) {
  const { width: W, height: H, data } = img;
  const bg = new Uint8Array(W * H);
  const test = opts.strict ? isBgStrict : isBg;
  for (let i = 0; i < W * H; i++) if (test(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) bg[i] = 1;
  // Grid lines: long straight runs of dark, colourless pixels.
  if (opts.lines) {
    const dark = (i) => { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]; return !bg[i] && Math.max(r, g, b) < 95; };
    const kill = [];
    const minRun = opts.lineRun || 140;
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        if (!dark(y * W + x)) { x++; continue; }
        let e = x; while (e < W && dark(y * W + e)) e++;
        if (e - x >= minRun) for (let k = x; k < e; k++) kill.push(y * W + k);
        x = e;
      }
    }
    for (let x = 0; x < W; x++) {
      let y = 0;
      while (y < H) {
        if (!dark(y * W + x)) { y++; continue; }
        let e = y; while (e < H && dark(e * W + x)) e++;
        if (e - y >= minRun) for (let k = y; k < e; k++) kill.push(k * W + x);
        y = e;
      }
    }
    for (const i of kill) bg[i] = 1;
    // Anti-aliased fringe of the lines (dark pixels touching a removed line pixel).
    for (let pass = 0; pass < 2; pass++) {
      const more = [];
      for (const i of kill) for (const d of [1, -1, W, -W]) {
        const j = i + d;
        if (j < 0 || j >= W * H || bg[j]) continue;
        const r = data[j * 4], g = data[j * 4 + 1], b = data[j * 4 + 2];
        if (Math.max(r, g, b) < 120 || magentaness(r, g, b) > 40) more.push(j);
      }
      for (const j of more) bg[j] = 1;
      kill.push(...more);
    }
  }
  // Edge clean-up: pixels next to the background that still carry a magenta tint.
  for (let pass = 0; pass < 2; pass++) {
    const edge = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (bg[i]) continue;
      const near = (x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (y > 0 && bg[i - W]) || (y < H - 1 && bg[i + W]);
      if (!near) continue;
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const m = magentaness(r, g, b);
      if (opts.strict ? (m > 90 && g < 70) : (m > 55 && Math.abs(r - b) < 90)) edge.push(i);
      else if (m > 18) { data[i * 4] = Math.max(g, r - m); data[i * 4 + 2] = Math.max(g, b - m); }
    }
    for (const i of edge) bg[i] = 1;
  }
  for (let i = 0; i < W * H; i++) data[i * 4 + 3] = bg[i] ? 0 : 255;
  // Drop specks of JPEG noise.
  removeSpecks(img, opts.minSpeck || 14);
  return img;
}

function removeSpecks(img, min) {
  const { width: W, height: H, data } = img;
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !data[i * 4 + 3]) continue;
    const comp = [];
    seen[i] = 1; stack.push(i);
    while (stack.length) {
      const p = stack.pop(); comp.push(p);
      const x = p % W, y = (p / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (!seen[q] && data[q * 4 + 3]) { seen[q] = 1; stack.push(q); }
      }
    }
    if (comp.length < min) for (const p of comp) data[p * 4 + 3] = 0;
  }
}

// Groups opaque pixels into blobs (pieces closer than `gap` px join), returns bounding boxes.
function blobs(img, gap = 10, minArea = 400) {
  const { width: W, height: H, data } = img;
  const s = Math.max(1, Math.floor(gap / 2));
  const gw = Math.ceil(W / s), gh = Math.ceil(H / s);
  const occ = new Uint8Array(gw * gh);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3]) occ[((y / s) | 0) * gw + ((x / s) | 0)] = 1;
  const lab = new Int32Array(gw * gh).fill(-1);
  const out = [];
  for (let i = 0; i < gw * gh; i++) {
    if (!occ[i] || lab[i] >= 0) continue;
    const st = [i]; lab[i] = out.length;
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0, n = 0;
    while (st.length) {
      const p = st.pop(); n++;
      const x = p % gw, y = (p / gw) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const q = ny * gw + nx;
        if (occ[q] && lab[q] < 0) { lab[q] = out.length; st.push(q); }
      }
    }
    if (n * s * s >= minArea) out.push({ x: x0 * s, y: y0 * s, w: (x1 - x0 + 1) * s, h: (y1 - y0 + 1) * s });
  }
  return out;
}

function loadKeyed(file, opts) { return keyImage(readPNG(file), opts); }

module.exports = { keyImage, loadKeyed, blobs, removeSpecks };

// CLI: node tools/art-key.js sheet.png [--lines] [--gap N] -> keyed copy in scratch + blob list by row
if (require.main === module) {
  const { writePNG } = require('./png');
  const path = require('path');
  const f = process.argv[2];
  const lines = process.argv.includes('--lines');
  const gi = process.argv.indexOf('--gap');
  const gap = gi > 0 ? Number(process.argv[gi + 1]) : 10;
  const img = loadKeyed(f, { lines });
  const out = process.argv[process.argv.indexOf('--out') + 1];
  if (process.argv.includes('--out')) writePNG(out, img);
  const bl = blobs(img, gap).sort((a, b) => a.y - b.y);
  // Group into rows by vertical overlap
  const rows = [];
  for (const b of bl) {
    const r = rows.find((r) => b.y < r.y1 - 20 && b.y + b.h > r.y0 + 20);
    if (r) { r.items.push(b); r.y0 = Math.min(r.y0, b.y); r.y1 = Math.max(r.y1, b.y + b.h); } else rows.push({ y0: b.y, y1: b.y + b.h, items: [b] });
  }
  console.log(path.basename(f), img.width + 'x' + img.height);
  rows.forEach((r, i) => console.log(`row ${i} y${r.y0}-${r.y1}: ` + r.items.sort((a, b) => a.x - b.x).map((b) => `[${b.x},${b.y} ${b.w}x${b.h}]`).join(' ')));
}
