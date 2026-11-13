// Builds Perseus's animation strips from the generated sprite sheets in PNGs/.
// Run:  node tools/build-perseus.js
// Output: assets/images/perseus2/<anim>.png (one horizontal strip per animation, square frames)
//         assets/images/perseus2/manifest.json (frame counts, frame size, draw size)
const fs = require('fs');
const path = require('path');
const { writePNG, blank } = require('./png');
const { loadSheet, sliceGrid, extract } = require('./frames');
const { loadKeyed } = require('./art-key');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'PNGs');
const OUT = path.join(ROOT, 'assets', 'images', 'perseus2');

// Source sheets (8 x 5 grids). `stand` is a standing frame used to even out scale between sheets.
const SHEETS = {
  move:   { file: 'Gemini_Generated_Image_80xkjm80xkjm80xk-removebg-preview.png', stand: [0, 0] },
  combat: { file: 'Gemini_Generated_Image_i7k5eii7k5eii7k5-removebg-preview.png', stand: [0, 0] },
  relic:  { file: 'Gemini_Generated_Image_gd1ltpgd1ltpgd1l__2_-removebg-preview.png', stand: [3, 0], despill: true },
  remix:  { file: 'Gemini_Generated_Image_gd1ltpgd1ltpgd1l-removebg-preview.png', stand: [0, 0], despill: true },
  // Harpe movement sheet: a JPEG with a magenta background and grid lines, converted to PNG in PNGs/gen2.
  harpe:  { file: 'gen2/Perseus-Harpe-Movement-Magenta.png', stand: [0, 0], key: true },
};

// Animation name -> list of [sheet, row, col, fix?]
// fix.eraseGrey: [x0, y0, x1, y1] in output-frame pixels; clears grey/silver stray pieces there.
const ANIMS = {
  idle:        [['move', 0, 0], ['move', 0, 1], ['move', 0, 2], ['move', 0, 3]],
  run:         [0, 1, 2, 3, 4, 5, 6].map((c) => ['move', 1, c]),
  jump:        [0, 1, 2, 3, 4, 5, 6].map((c) => ['move', 2, c]),
  flip:        [0, 1, 2, 3].map((c) => ['move', 3, c]),
  hurt:        [['remix', 4, 0], ['move', 4, 1]],
  death:       [['move', 4, 3], ['move', 4, 4], ['move', 4, 6], ['move', 4, 7]],
  slash:       [0, 1, 2, 3].map((c) => ['combat', 0, c]),
  slash_up:    [0, 1, 2, 3].map((c) => ['combat', 1, c]),
  slash_air:   [4, 5, 6].map((c) => ['combat', 1, c]),
  harpe:       [['combat', 2, 0], ['combat', 2, 1, { eraseGrey: [56, 86, 86, 102] }], ['combat', 2, 2], ['combat', 2, 3]],
  harpe_up:    [0, 1, 2, 3].map((c) => ['combat', 3, c]),
  pogo:        [['combat', 4, 0], ['combat', 4, 1]],
  pogo_bounce: [['combat', 4, 4], ['combat', 4, 6]],
  shield:      [0, 1, 2, 3].map((c) => ['relic', 1, c]),
  glide:       [0, 1, 2].map((c) => ['relic', 2, c]),
  wing_jump:   [4, 5, 6].map((c) => ['relic', 2, c]),
  nectar:      [0, 1, 2, 3].map((c) => ['relic', 3, c]),
  gaze:        [['relic', 4, 0], ['relic', 4, 1], ['relic', 4, 4], ['relic', 4, 6]],
  idle_harpe:  [0, 1, 2, 3].map((c) => ['harpe', 0, c]),
  run_harpe:   [0, 1, 2, 3, 4, 5, 6].map((c) => ['harpe', 1, c]),
  jump_harpe:  [0, 1, 2, 3, 4, 5, 6].map((c) => ['harpe', 2, c]),
  hurt_harpe:  [['harpe', 3, 0], ['harpe', 3, 1]],
  flip_harpe:  [2, 3, 4, 5].map((c) => ['harpe', 3, c]),
  death_harpe: [['harpe', 4, 1], ['harpe', 4, 4], ['harpe', 4, 6], ['harpe', 4, 7]],
};

const TARGET_STAND = 72;   // source standing height everything is normalised to
const GAME_HEIGHT = 37;    // on-screen standing height in game pixels

// Remove ruled guide lines: find rows holding a long thin dark line, then clear the
// dark pixels on those rows that have nothing beneath them (feet stand on the line, never under it).
function stripGuideLines(img) {
  const { width: W, height: H, data } = img;
  const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 0;
  // Guide lines are neutral grey; skin, bronze and leather are all warm.
  const dark = (x, y) => { const i = (y * W + x) * 4; const r = data[i], g = data[i + 1], bl = data[i + 2]; return Math.max(r, g, bl) - Math.min(r, g, bl) < 28 && r < 215; };
  const lineRows = new Set();
  for (let y = 0; y < H; y++) {
    let run = 0, best = 0;
    for (let x = 0; x < W; x++) {
      if (op(x, y) && dark(x, y) && !op(x, y - 2) && !op(x, y + 2)) { run++; if (run > best) best = run; } else run = 0;
    }
    if (best > 45) { lineRows.add(y); lineRows.add(y + 1); lineRows.add(y - 1); }
  }
  for (const y of lineRows) {
    if (y < 0 || y >= H) continue;
    let x = 0;
    while (x < W) {
      if (!(op(x, y) && dark(x, y))) { x++; continue; }
      let e = x;
      while (e < W && op(e, y) && dark(e, y)) e++;
      if (e - x >= 6) for (let k = x; k < e; k++) if (!op(k, y + 2) || !op(k, y - 2)) data[(y * W + k) * 4 + 3] = 0;
      x = e;
    }
  }
}

function scaleImage(src, s) {
  if (Math.abs(s - 1) < 0.01) return src;
  const w = Math.max(1, Math.round(src.width * s)), h = Math.max(1, Math.round(src.height * s));
  const out = blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(src.width - 1, Math.floor((x + 0.5) / s)), sy = Math.min(src.height - 1, Math.floor((y + 0.5) / s));
    src.data.copy(out.data, (y * w + x) * 4, (sy * src.width + sx) * 4, (sy * src.width + sx) * 4 + 4);
  }
  return out;
}

// Where the body is: feet = lowest non-white pixel row; x = median of the torso band (ignores weapons and slash arcs).
function anchors(img) {
  const { width: W, height: H, data } = img;
  const solid = (x, y) => { const i = (y * W + x) * 4; return data[i + 3] > 0 && !(data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200); };
  let top = H, bottom = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid(x, y)) { if (y < top) top = y; if (y > bottom) bottom = y; }
  const xs = [];
  const t0 = top + Math.round((bottom - top) * 0.2), t1 = top + Math.round((bottom - top) * 0.55);
  for (let y = t0; y <= t1; y++) for (let x = 0; x < W; x++) if (solid(x, y)) xs.push(x);
  xs.sort((a, b) => a - b);
  return { feet: bottom, cx: xs.length ? xs[xs.length >> 1] : W / 2 };
}

function main() {
  const sheets = {};
  for (const [k, s] of Object.entries(SHEETS)) {
    const img = s.key ? loadKeyed(path.join(SRC, s.file), { lines: true }) : loadSheet(path.join(SRC, s.file), { despill: s.despill });
    stripGuideLines(img);
    const sl = sliceGrid(img);
    const st = sl.grid[s.stand[0]][s.stand[1]];
    sl.scale = TARGET_STAND / st.h;
    sheets[k] = sl;
  }
  // Extract, normalise and anchor every frame
  const built = {};
  let half = 0, height = 0;
  for (const [name, list] of Object.entries(ANIMS)) {
    built[name] = list.map(([sk, r, c, fix]) => {
      const sl = sheets[sk];
      const f = sl.grid[r][c];
      if (!f) throw new Error(`${name}: no frame at ${sk} row ${r} col ${c}`);
      const img = scaleImage(extract(sl, f), sl.scale);
      const a = anchors(img);
      half = Math.max(half, a.cx, img.width - a.cx);
      height = Math.max(height, a.feet + 1);
      return { img, a, fix };
    });
  }
  const cell = Math.ceil(Math.max(half * 2, height)) + 2;
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = { cell, drawSize: Math.round(GAME_HEIGHT * cell / TARGET_STAND), anims: {} };
  for (const [name, frames] of Object.entries(built)) {
    const strip = blank(cell * frames.length, cell);
    frames.forEach(({ img, a, fix }, i) => {
      const ox = i * cell + Math.round(cell / 2 - a.cx), oy = cell - 1 - a.feet;
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
        const si = (y * img.width + x) * 4;
        if (!img.data[si + 3]) continue;
        const dx = ox + x, dy = oy + y;
        if (dx < i * cell || dx >= (i + 1) * cell || dy < 0 || dy >= cell) continue;
        if (fix && fix.eraseGrey) {
          const [ex0, ey0, ex1, ey1] = fix.eraseGrey, lx = dx - i * cell;
          const r = img.data[si], g = img.data[si + 1], bl = img.data[si + 2];
          if (lx >= ex0 && lx <= ex1 && dy >= ey0 && dy <= ey1 && Math.max(r, g, bl) - Math.min(r, g, bl) < 40) continue;
        }
        img.data.copy(strip.data, (dy * strip.width + dx) * 4, si, si + 4);
      }
    });
    writePNG(path.join(OUT, name + '.png'), strip);
    manifest.anims[name] = frames.length;
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('cell', cell, 'drawSize', manifest.drawSize, 'anims', Object.keys(manifest.anims).length);
}

main();
