// Cuts sprite frames out of a sheet laid out on a regular grid (transparent background).
// Each connected piece of the image is assigned to the grid cell that holds most of its pixels,
// so spears and slash arcs that poke into a neighbouring cell still stay with their owner.
const { readPNG, blank } = require('./png');

// Pixels left over from a magenta background (strong red + blue, little green).
function isMagentaSpill(r, g, b) { return r - g > 70 && b - g > 70 && Math.abs(r - b) < 90; }

function loadSheet(file, opts = {}) {
  const img = readPNG(file);
  const { width: W, height: H, data } = img;
  for (let i = 0; i < W * H; i++) {
    if (data[i * 4 + 3] < (opts.alphaMin || 60)) data[i * 4 + 3] = 0;
    else if (opts.despill && isMagentaSpill(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) data[i * 4 + 3] = 0;
    else {
      data[i * 4 + 3] = 255;
      if (opts.despill) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        // Edge pixels blended with magenta: remove the excess blue/red so they read as brown again.
        if (b > g + 12 && r > g + 30) { data[i * 4 + 2] = Math.round(g * 0.8); data[i * 4] = Math.round(Math.min(r, g * 1.6 + 20)); }
      }
    }
  }
  return img;
}

function sliceGrid(img, cols = 8, rows = 5) {
  const { width: W, height: H, data } = img;
  const cw = W / cols, ch = H / rows;
  const cellOf = (x, y) => Math.min(rows - 1, (y / ch) | 0) * cols + Math.min(cols - 1, (x / cw) | 0);
  const label = new Int32Array(W * H).fill(-1);
  const owner = new Int32Array(W * H).fill(-1); // final cell per pixel
  const stack = [];
  const small = [];   // detached bits (blade tips, arcs) resolved after the big pieces
  const big = [];
  let next = 0;
  for (let i = 0; i < W * H; i++) {
    if (!data[i * 4 + 3] || label[i] >= 0) continue;
    const pixels = [];
    label[i] = next; stack.push(i);
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    while (stack.length) {
      const p = stack.pop(); pixels.push(p);
      const x = p % W, y = (p / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (data[q * 4 + 3] && label[q] < 0) { label[q] = next; stack.push(q); }
      }
    }
    next++;
    // Ruled baseline lines are noise.
    if (y1 - y0 <= 4 && x1 - x0 > 30) continue;
    // A piece spanning more than ~1.6 cells is two frames touching: split it per pixel.
    if (x1 - x0 > cw * 1.6 || y1 - y0 > ch * 1.6) {
      const tmp = new Map();
      for (const p of pixels) tmp.set(p, cellOf(p % W, (p / W) | 0));
      const seen = new Set();
      for (const p0 of pixels) {
        if (seen.has(p0)) continue;
        const c = tmp.get(p0), part = [p0];
        seen.add(p0);
        let px0 = W, px1 = 0, py0 = H, py1 = 0;
        for (let k = 0; k < part.length; k++) {
          const p = part[k], x = p % W, y = (p / W) | 0;
          if (x < px0) px0 = x; if (x > px1) px1 = x; if (y < py0) py0 = y; if (y > py1) py1 = y;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const q = (y + dy) * W + x + dx;
            if (tmp.get(q) === c && !seen.has(q)) { seen.add(q); part.push(q); }
          }
        }
        if (part.length < 250) small.push({ pixels: part, x0: px0, x1: px1, y0: py0, y1: py1 });
        else { for (const p of part) owner[p] = c; big.push({ x0: px0, x1: px1, y0: py0, y1: py1, cell: c }); }
      }
      continue;
    }
    if (pixels.length < 250) { small.push({ pixels, x0, x1, y0, y1 }); continue; }
    const votes = new Map();
    for (const p of pixels) { const c = cellOf(p % W, (p / W) | 0); votes.set(c, (votes.get(c) || 0) + 1); }
    let best = -1, bestN = -1;
    for (const [c, n] of votes) if (n > bestN) { best = c; bestN = n; }
    for (const p of pixels) owner[p] = best;
    big.push({ x0, x1, y0, y1, cell: best });
  }
  small.sort((a, b) => b.pixels.length - a.pixels.length);
  for (const s of small) {
    if (s.y1 - s.y0 <= 3 && s.x1 - s.x0 >= 6) continue;   // leftover scrap of a ruled line
    const mine = new Set(s.pixels);
    let found = -1;
    for (let r = 1; r <= 12 && found < 0; r++) {
      for (const p of s.pixels) {
        const x = p % W, y = (p / W) | 0;
        for (let dy = -r; dy <= r && found < 0; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (!mine.has(q) && owner[q] >= 0) { found = owner[q]; break; }
        }
        if (found >= 0) break;
      }
    }
    if (found >= 0) for (const p of s.pixels) owner[p] = found;
  }
  // Build frames
  const cells = [];
  for (let c = 0; c < cols * rows; c++) cells.push({ x0: W, y0: H, x1: -1, y1: -1, n: 0 });
  for (let p = 0; p < W * H; p++) {
    const c = owner[p];
    if (c < 0) continue;
    const s = cells[c], x = p % W, y = (p / W) | 0;
    s.n++; if (x < s.x0) s.x0 = x; if (x > s.x1) s.x1 = x; if (y < s.y0) s.y0 = y; if (y > s.y1) s.y1 = y;
  }
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const s = cells[r * cols + c];
      row.push(s.n >= 300 ? { cell: r * cols + c, x: s.x0, y: s.y0, w: s.x1 - s.x0 + 1, h: s.y1 - s.y0 + 1, n: s.n } : null);
    }
    grid.push(row);
  }
  return { grid, owner, img };
}

// Copy one frame's own pixels into a new image.
function extract(sheet, f) {
  const { img, owner } = sheet;
  const out = blank(f.w, f.h);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const p = (f.y + y) * img.width + f.x + x;
    if (owner[p] !== f.cell) continue;
    img.data.copy(out.data, (y * f.w + x) * 4, p * 4, p * 4 + 4);
  }
  return out;
}

module.exports = { loadSheet, sliceGrid, extract };

// CLI: node tools/frames.js sheet.png [--despill]  -> prints the grid of detected frames
if (require.main === module) {
  const img = loadSheet(process.argv[2], { despill: process.argv.includes('--despill') });
  const { grid } = sliceGrid(img);
  grid.forEach((r, i) => console.log('row ' + i + ': ' + r.map((f, j) => (f ? `${j}[${f.w}x${f.h}]` : `${j}[ - ]`)).join(' ')));
}
