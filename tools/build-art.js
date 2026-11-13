// Builds game-ready art from the generated sheets in PNGs/gen2 (converted from the JPEGs in JPGs/).
// Run:  node tools/build-art.js
// Output (assets/images/gen/):
//   <strip>.png + manifest.json   animation strips and single icons (frames side by side)
//   tiles_w<N>.png + tiles.json   16px ground tiles per world, plus small surface decorations
//   story_<N>.png, bg_marble/*.png, title_logo.png
const fs = require('fs');
const path = require('path');
const { readPNG, writePNG, blank } = require('./png');
const { keyImage } = require('./art-key');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'PNGs', 'gen2');
const OUT = path.join(ROOT, 'assets', 'images', 'gen');

// ---------------------------------------------------------------------------
// Sprite strips
//   mode 'cell': every frame rect is the same size; art keeps its place inside the rect
//                (use for sheets drawn "in the same position in every cell").
//   mode 'feet': each frame is cropped, then bottom-aligned and centred.
//   px: game pixels per source pixel (shared by a character's strips so they match),
//   or h: on-screen height of the tallest frame.
// Names starting with "_" only soak up stray pieces and are not written.
// ---------------------------------------------------------------------------
const cellRect = (sw, sh, cols, rows) => (r, c, W, H) => {
  const cw = sw / cols, ch = sh / rows;
  W = W || cw; H = H || ch;
  return [Math.round((c + 0.5) * cw - W / 2), Math.round(r * ch + ch - H), W, H];
};
const at = (cx, y0, W, H) => [Math.round(cx - W / 2), y0, W, H];

const cet = cellRect(2400, 1792, 4, 3), lad = cellRect(2400, 1792, 4, 4), and = cellRect(2400, 1792, 6, 4);
const prop = cellRect(2752, 1536, 8, 5);
const CEL = [520, 448], SER = [520, 448], SIR = [520, 448];

const SHEETS = {
  cetus_frames: { lines: true, inset: 8, strips: {
    cetus_idle: { mode: 'cell', px: 0.42, frames: [0, 1, 2, 3].map((c) => cet(0, c)) },
    cetus_bite: { mode: 'cell', px: 0.42, frames: [0, 1, 2, 3].map((c) => cet(1, c)) },
    cetus_stun: { mode: 'cell', px: 0.42, frames: [0, 1].map((c) => cet(2, c)) },
    cetus_roar: { mode: 'cell', px: 0.42, frames: [2, 3].map((c) => cet(2, c)) },
  } },
  boss_ladon_frames: { lines: true, inset: 8, strips: {
    ladon_idle:   { mode: 'cell', px: 0.27, frames: [0, 1, 2, 3].map((c) => lad(0, c)) },
    ladon_strike: { mode: 'cell', px: 0.27, frames: [0, 1, 2, 3].map((c) => lad(1, c)) },
    ladon_fire:   { mode: 'cell', px: 0.27, frames: [0, 1, 2, 3].map((c) => lad(2, c)) },
    ladon_stun:   { mode: 'cell', px: 0.27, frames: [0, 1].map((c) => lad(3, c)) },
    ladon_die:    { mode: 'cell', px: 0.27, frames: [2, 3].map((c) => lad(3, c)) },
  } },
  andromeda_rescue: { lines: true, inset: 8, strips: {
    an_chain: { mode: 'cell', px: 0.085, frames: [0, 1, 2, 3].map((c) => and(0, c)) },
    an_free:  { mode: 'cell', px: 0.085, frames: [0, 1, 2, 3].map((c) => and(1, c)) },
    an_run:   { mode: 'cell', px: 0.085, frames: [0, 1, 2, 3, 4, 5].map((c) => and(2, c)) },
    an_crown: { mode: 'cell', px: 0.085, frames: [0, 1, 2, 3, 4].map((c) => and(3, c)) },
  } },
  boss_celaeno: { lines: true, strips: {
    cel_fly:     { mode: 'cell', px: 0.15, frames: [0, 1, 2, 3, 4, 5].map((c) => at(200 + c * 400, 0, ...CEL)) },
    cel_throw:   { mode: 'cell', px: 0.15, frames: [198, 594, 1398, 1806].map((x) => at(x, 448, ...CEL)) },
    _cel_wing:   { mode: 'cell', frames: [at(996, 448, 300, 448)] },
    cel_screech: { mode: 'cell', px: 0.15, frames: [at(222, 896, ...CEL)] },
    cel_dive:    { mode: 'cell', px: 0.15, frames: [at(630, 896, ...CEL), at(1008, 896, ...CEL)] },
    _cel_odd:    { mode: 'cell', frames: [at(1494, 896, 300, 448)] },
    cel_land:    { mode: 'cell', px: 0.15, frames: [at(1824, 896, ...CEL), at(2100, 896, ...CEL)] },
    cel_die:     { mode: 'cell', px: 0.15, frames: [282, 906, 1506, 2094].map((x) => at(x, 1344, ...CEL)) },
  } },
  enemy_serpent: { lines: true, strips: {
    sn_slither: { mode: 'cell', px: 0.085, frames: [288, 786, 1260, 1746].map((x) => at(x, 0, ...SER)) },
    sn_spit:    { mode: 'cell', px: 0.085, frames: [258, 756, 1218, 1740].map((x) => at(x, 443, ...SER)) },
    sn_glob:    { mode: 'feet', px: 0.06, frames: [[2080, 560, 260, 200]] },
    sn_bite:    { mode: 'cell', px: 0.085, frames: [306, 912, 1512, 2112].map((x) => at(x, 891, ...SER)) },
    sn_die:     { mode: 'cell', px: 0.085, frames: [306, 900, 1500, 2124].map((x) => at(x, 1339, ...SER)) },
  } },
  enemy_siren: { lines: true, strips: {
    si_fly:  { mode: 'cell', px: 0.08, frames: [0, 1, 2, 3, 4, 5].map((c) => at(200 + c * 400, 0, ...SIR)) },
    si_sing: { mode: 'cell', px: 0.08, frames: [204, 600, 1002, 1410].map((x) => at(x, 448, ...SIR)) },
    si_dive: { mode: 'cell', px: 0.08, frames: [at(906, 896, ...SIR), at(1488, 896, ...SIR)] },
    _si_hov: { mode: 'cell', frames: [at(258, 896, 400, 448), at(2100, 896, 400, 448)] },
    si_die:  { mode: 'cell', px: 0.08, frames: [312, 930, 1512, 2100].map((x) => at(x, 1344, ...SIR)) },
  } },
  props: { lines: true, strips: {
    pr_amph_t:  { mode: 'feet', px: 0.055, frames: [0, 1, 2, 3].map((c) => prop(0, c)) },
    pr_amph_p:  { mode: 'feet', px: 0.055, frames: [4, 5, 6, 7].map((c) => prop(0, c)) },
    pr_amph_g:  { mode: 'feet', px: 0.055, frames: [0, 1, 2, 3].map((c) => prop(1, c)) },
    pr_chest:   { mode: 'feet', px: 0.06, frames: [4, 5].map((c) => prop(1, c)) },
    pr_gem:     { mode: 'feet', px: 0.05, frames: [prop(1, 7)] },
    pr_coin:    { mode: 'feet', px: 0.05, frames: [0, 1, 2, 3, 4, 5].map((c) => at((c + 0.5) * 344, 624, 344, 250)) },
    pr_urn:     { mode: 'feet', px: 0.055, frames: [prop(2, 6)] },
    pr_stele:   { mode: 'feet', px: 0.06, frames: [prop(2, 7)] },
    pr_brazier: { mode: 'feet', px: 0.085, frames: [0, 1, 2, 3, 4, 5].map((c) => prop(3, c)) },
    pr_gate:    { mode: 'feet', px: 0.15, frames: [at(252, 1236, 344, 300), at(856, 1236, 344, 300)] },
    pr_statue:  { mode: 'feet', px: 0.12, frames: [at(1268, 1236, 300, 300)] },
    pr_rubble:  { mode: 'feet', px: 0.08, frames: [at(1573, 1236, 330, 300)] },
  } },
  hud_icons: { lines: false, strict: true, strips: {
    hud_heart:  { mode: 'feet', h: 10, frames: [[30, 30, 240, 230], [330, 30, 240, 230], [630, 30, 240, 230]] },
    hud_coin:   { mode: 'feet', h: 10, frames: [[930, 26, 245, 245]] },
    hud_nectar: { mode: 'feet', h: 12, frames: [[1256, 14, 188, 270]] },
    hud_draught:{ mode: 'feet', h: 12, frames: [[1556, 14, 188, 270]] },
    hud_face:   { mode: 'feet', h: 16, frames: [[1838, 26, 224, 251]] },
    hud_slot:   { mode: 'feet', h: 18, frames: [[8, 308, 284, 287]] },
    hud_eye:    { mode: 'feet', h: 12, frames: [[917, 326, 272, 257]] },
    hud_helm:   { mode: 'feet', h: 13, frames: [[1232, 311, 239, 281]] },
    hud_sandal: { mode: 'feet', h: 12, frames: [[1520, 314, 260, 269]] },
    hud_harpe:  { mode: 'feet', h: 13, frames: [[1820, 329, 251, 251]] },
    hud_shield: { mode: 'feet', h: 13, frames: [[2132, 314, 236, 275]] },
  } },
  title_logo: { lines: false, strips: {
    title_logo: { mode: 'feet', h: 116, frames: [[0, 0, 2912, 1440]] },
  } },
};

// ---------------------------------------------------------------------------
// Tiles: source rects [x, y, w, h] for each role. Every tile is squeezed to 16x16
// (slabs to 16x8). Decorations keep their proportions at DECOR_SCALE.
// ---------------------------------------------------------------------------
const TILES = {
  1: { file: 'tiles_w1_grove', decorScale: 16 / 380,
    top: [[399, 87, 381, 285], [795, 87, 381, 285], [1191, 87, 381, 285]], topL: [[63, 87, 321, 285]], topR: [[1587, 87, 207, 285]],
    fill: [[399, 452, 381, 310], [795, 452, 381, 310], [1191, 452, 381, 310]], fillL: [[6, 452, 378, 310]], fillR: [[1587, 452, 411, 310]],
    slab: [[402, 912, 378, 96], [798, 906, 378, 120]], slabL: [[6, 924, 378, 84]], slabR: [[1194, 924, 378, 84]],
    crumble: [[1587, 888, 408, 138]], break: [[2409, 780, 333, 378]], spike: [[6, 1194, 369, 342], [396, 1194, 369, 342]],
    decor: [[1227, 1308, 234, 153], [1530, 1260, 234, 195], [1812, 1242, 225, 231]] },
  2: { file: 'tiles_w2_marble', decorScale: 16 / 430,
    top: [[459, 6, 447, 345], [927, 6, 438, 345], [1386, 6, 432, 345]], topL: [[12, 6, 426, 345]], topR: [[1839, 6, 345, 345]],
    fill: [[459, 378, 447, 378], [927, 378, 438, 378], [1386, 378, 432, 378]], fillL: [[12, 378, 426, 378]], fillR: [[1839, 378, 345, 378]],
    slab: [[459, 780, 447, 138], [930, 780, 435, 138]], slabL: [[12, 780, 423, 120]], slabR: [[1386, 780, 432, 120]],
    crumble: [[459, 963, 447, 201]], break: [[2409, 786, 333, 378]], spike: [[12, 1191, 333, 345], [366, 1191, 333, 345]],
    decor: [] },
  3: { file: 'tiles_w3_garden', decorScale: 16 / 340,
    top: [[348, 45, 336, 294], [693, 51, 333, 288], [1038, 51, 333, 288]], topL: [[51, 45, 288, 294]], topR: [[1725, 45, 282, 294]],
    fill: [[1380, 348, 336, 414]], fillL: [[6, 348, 333, 414]], fillR: [[1725, 348, 333, 414]],
    slab: [[351, 939, 330, 93], [1038, 945, 333, 87]], slabL: [[6, 945, 333, 87]], slabR: [[1038, 945, 333, 87]],
    crumble: [[1725, 945, 333, 156]], break: [[2415, 810, 333, 360]], spike: [[6, 1233, 333, 303], [348, 1263, 336, 273]],
    decor: [[1380, 1257, 336, 279]] },
  4: { file: 'tiles_w4_peaks', decorScale: 16 / 380,
    top: [[459, 45, 357, 321], [825, 45, 414, 321], [1248, 45, 399, 321]], topL: [[6, 45, 438, 321]], topR: [[1662, 45, 396, 321]],
    fill: [[459, 378, 357, 384], [825, 378, 414, 384], [1252, 378, 385, 384]], fillL: [[6, 378, 288, 384]],
    slab: [[6, 996, 333, 75], [1044, 996, 327, 75]],
    crumble: [[1380, 876, 330, 324]], break: [[2430, 876, 306, 312]], spike: [[12, 1224, 327, 312], [357, 1266, 324, 270]],
    decor: [[1044, 1365, 321, 150], [1422, 1353, 240, 165], [1743, 1290, 294, 228]] },
  5: { file: 'tiles_w5_styx', decorScale: 16 / 400,
    top: [[414, 87, 399, 285], [825, 85, 402, 287], [1239, 85, 402, 287]], topL: [[69, 85, 333, 287]],
    fill: [[414, 384, 399, 378], [1241, 384, 401, 370]], fillL: [[6, 384, 396, 378]],
    slab: [[1241, 925, 396, 81]], slabL: [[6, 922, 396, 82]],
    crumble: [[1655, 915, 399, 139]], break: [[2406, 774, 342, 372]], spike: [[6, 1164, 339, 372], [354, 1188, 333, 348]],
    decor: [[1131, 1233, 216, 240], [1392, 1308, 315, 159], [1767, 1284, 252, 174]] },
  6: { file: 'tiles_w6_gorgon', decorScale: 16 / 400,
    top: [[312, 63, 291, 300], [618, 63, 291, 300], [924, 63, 447, 300], [1383, 63, 447, 300]], topL: [[51, 63, 246, 300]], topR: [[1842, 63, 252, 291]],
    fill: [[312, 372, 597, 546], [924, 372, 444, 546], [1383, 372, 447, 546]], fillL: [[6, 372, 291, 549]], fillR: [[1842, 372, 294, 546]],
    slab: [[459, 1026, 450, 108], [924, 1026, 444, 108]], slabL: [[6, 1026, 441, 108]],
    crumble: [[1842, 1014, 294, 156]], break: [[2460, 933, 276, 294]], spike: [[12, 1245, 282, 285], [315, 1239, 288, 291], [636, 1245, 258, 285]],
    decor: [[1233, 1290, 285, 207], [1842, 1245, 294, 288]] },
  7: { file: 'tiles_w7_coast', decorScale: 16 / 400,
    top: [[561, 96, 402, 276], [975, 96, 396, 276], [1380, 96, 339, 276]], topL: [[93, 96, 459, 276]], topR: [[1731, 96, 333, 276]],
    fill: [[561, 384, 402, 378], [975, 384, 396, 378], [1380, 384, 342, 378]], fillL: [[207, 384, 345, 378]], fillR: [[1731, 384, 276, 378]],
    slab: [[468, 912, 438, 102], [930, 912, 435, 120]],
    crumble: [[1755, 906, 417, 201]], break: [[2409, 798, 339, 336]], spike: [[12, 1176, 408, 360], [435, 1209, 369, 327]],
    decor: [[1164, 1263, 285, 198], [2100, 1260, 285, 225]] },
};
const ROLE_SIZE = { slab: [16, 8], slabL: [16, 8], slabR: [16, 8], crumble: [16, 8] };

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------
// Area-average resample of a source rect to w x h (premultiplied alpha).
function resample(img, [sx, sy, sw, sh], w, h, mask) {
  const out = blank(w, h);
  const fx = sw / w, fy = sh / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    const x0 = sx + x * fx, x1 = x0 + fx, y0 = sy + y * fy, y1 = y0 + fy;
    for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
      n++;
      if (xx < 0 || yy < 0 || xx >= img.width || yy >= img.height) continue;
      const p = yy * img.width + xx;
      if (mask && !mask(p)) continue;
      const i = p * 4, al = img.data[i + 3] / 255;
      r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al;
    }
    const o = (y * w + x) * 4;
    if (a > 0) { out.data[o] = r / a; out.data[o + 1] = g / a; out.data[o + 2] = b / a; }
    out.data[o + 3] = Math.round(255 * a / n);
  }
  return out;
}

function hardAlpha(img, cut = 110) {
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] >= cut ? 255 : 0;
  return img;
}

function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const X = dx + x, Y = dy + y;
    if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
    const s = (y * src.width + x) * 4;
    if (!src.data[s + 3]) continue;
    src.data.copy(dst.data, (Y * dst.width + X) * 4, s, s + 4);
  }
}

// Connected pieces (8-way) -> owner rect index by largest overlap (ties: nearest centre).
function assignPieces(img, rects) {
  const { width: W, height: H, data } = img;
  const owner = new Int32Array(W * H).fill(-1);
  const seen = new Uint8Array(W * H);
  const st = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !data[i * 4 + 3]) continue;
    const comp = []; seen[i] = 1; st.push(i);
    let sx = 0, sy = 0;
    while (st.length) {
      const p = st.pop(); comp.push(p);
      const x = p % W, y = (p / W) | 0; sx += x; sy += y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (!seen[q] && data[q * 4 + 3]) { seen[q] = 1; st.push(q); }
      }
    }
    const cx = sx / comp.length, cy = sy / comp.length;
    let best = -1, bestScore = -Infinity;
    rects.forEach(([rx, ry, rw, rh], k) => {
      let inside = 0;
      for (const p of comp) { const x = p % W, y = (p / W) | 0; if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) inside++; }
      if (!inside) return;
      const score = inside - Math.hypot(cx - (rx + rw / 2), cy - (ry + rh / 2)) * 0.01;
      if (score > bestScore) { bestScore = score; best = k; }
    });
    if (best >= 0) for (const p of comp) owner[p] = best;
  }
  return owner;
}

function bboxOf(img, owner, k, [rx, ry, rw, rh]) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = Math.max(0, ry); y < Math.min(img.height, ry + rh); y++) for (let x = Math.max(0, rx); x < Math.min(img.width, rx + rw); x++) {
    if (owner[y * img.width + x] !== k) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

// ---------------------------------------------------------------------------
function buildStrips(manifest) {
  for (const [file, sheet] of Object.entries(SHEETS)) {
    const img = keyImage(readPNG(path.join(SRC, file + '.png')), { lines: sheet.lines, strict: sheet.strict });
    const all = [];
    for (const [name, s] of Object.entries(sheet.strips)) s.frames.forEach((r, i) => all.push({ name, i, r }));
    const owner = assignPieces(img, all.map((a) => a.r));
    for (const [name, s] of Object.entries(sheet.strips)) {
      if (name.startsWith('_')) continue;
      const idx = s.frames.map((_, i) => all.findIndex((a) => a.name === name && a.i === i));
      let frames;   // [{ rect (source), dx, dy (placement in cell, source px) }]
      let cw, ch;
      if (s.mode === 'cell') {
        cw = s.frames[0][2]; ch = s.frames[0][3];
        frames = idx.map((k) => ({ k, rect: all[k].r, dx: 0, dy: 0 }));
      } else {
        const boxes = idx.map((k) => bboxOf(img, owner, k, all[k].r));
        cw = Math.max(...boxes.map((b) => b[2])) + 4; ch = Math.max(...boxes.map((b) => b[3])) + 2;
        frames = idx.map((k, i) => { const b = boxes[i]; return { k, rect: b, dx: Math.round((cw - b[2]) / 2), dy: ch - b[3] }; });
      }
      const px = s.px || s.h / ch;
      const so = Math.min(1, px * 2);                    // stored at up to 2x game size (keeps loading fast)
      const ow = Math.max(1, Math.round(cw * so)), oh = Math.max(1, Math.round(ch * so));
      const strip = blank(ow * frames.length, oh);
      frames.forEach((f, i) => {
        // Render the frame into a source-sized cell first, then shrink.
        const cell = blank(cw, ch);
        const [rx, ry, rw, rh] = f.rect;
        const ins = s.mode === 'cell' ? sheet.inset || 0 : 0;   // skip leftover grid-line pixels at cell edges
        for (let y = ins; y < rh - ins; y++) for (let x = ins; x < rw - ins; x++) {
          const X = rx + x, Y = ry + y;
          if (X < 0 || Y < 0 || X >= img.width || Y >= img.height) continue;
          const p = Y * img.width + X;
          if (owner[p] !== f.k) continue;
          const cx = f.dx + x, cy = f.dy + y;
          if (cx >= cw || cy >= ch) continue;
          img.data.copy(cell.data, (cy * cw + cx) * 4, p * 4, p * 4 + 4);
        }
        blit(strip, so === 1 ? cell : hardAlpha(resample(cell, [0, 0, cw, ch], ow, oh)), i * ow, 0);
      });
      writePNG(path.join(OUT, name + '.png'), strip);
      manifest.strips[name] = { n: frames.length, h: Math.round(ch * px) };
    }
    console.log('strips from', file);
  }
}

function buildTiles() {
  const out = {};
  for (const [w, def] of Object.entries(TILES)) {
    const img = keyImage(readPNG(path.join(SRC, def.file + '.png')), {});
    const roles = Object.keys(def).filter((k) => !['file', 'decorScale', 'decor'].includes(k));
    const cells = [];
    const map = {};
    for (const role of roles) {
      map[role] = [];
      for (const r0 of def[role]) {
        const [tw, th] = ROLE_SIZE[role] || [16, 16];
        // Painted tiles carry their own border shading; crop to the inside so repeats tile without stripes.
        const ix = role === 'top' || role === 'fill' ? 0.1 : 0, iy = role.startsWith('fill') ? 0.12 : 0;
        const r = [r0[0] + r0[2] * ix, r0[1] + r0[3] * iy, r0[2] * (1 - 2 * ix), r0[3] * (1 - 2 * iy)].map(Math.round);
        const t = hardAlpha(resample(img, r, tw, th), 100);
        map[role].push(cells.length);
        cells.push(t);
      }
    }
    const decor = def.decor.map((r) => hardAlpha(resample(img, r, Math.max(1, Math.round(r[2] * def.decorScale)), Math.max(1, Math.round(r[3] * def.decorScale))), 110));
    const dh = Math.max(16, ...decor.map((d) => d.height));
    const atlas = blank(Math.max(cells.length * 16, decor.reduce((s, d) => s + d.width + 1, 0)), 16 + dh);
    cells.forEach((c, i) => blit(atlas, c, i * 16, 0));
    const drects = [];
    let x = 0;
    for (const d of decor) { blit(atlas, d, x, 16 + dh - d.height); drects.push([x, 16 + dh - d.height, d.width, d.height]); x += d.width + 1; }
    writePNG(path.join(OUT, `tiles_w${w}.png`), atlas);
    out[w] = { roles: map, decor: drects };
  }
  fs.writeFileSync(path.join(OUT, 'tiles.json'), JSON.stringify(out));
  console.log('tiles for', Object.keys(out).length, 'worlds');
}

function buildPictures() {
  // Story panels: plain downscale to the game's 480x270 screen.
  for (let i = 1; i <= 6; i++) {
    const img = readPNG(path.join(SRC, `story_${i}.png`));
    writePNG(path.join(OUT, `story_${i}.png`), resample(img, [0, 0, img.width, img.height], 480, 268));
  }
  // World 2 parallax layers (sky opaque; far and mid keyed). Scaled so the sky is 270 tall.
  fs.mkdirSync(path.join(OUT, 'bg_marble'), { recursive: true });
  const k = 270 / 1184;
  const sky = readPNG(path.join(SRC, 'bg_w2_sky.png'));
  writePNG(path.join(OUT, 'bg_marble', 'sky.png'), resample(sky, [0, 0, 3584, 1184], Math.round(3584 * k), 270));
  const far = keyImage(readPNG(path.join(SRC, 'bg_w2_far.png')), {});
  writePNG(path.join(OUT, 'bg_marble', 'far.png'), hardAlpha(resample(far, [0, 485, 3584, 699], Math.round(3584 * k), Math.round(699 * k)), 90));
  const mid = keyImage(readPNG(path.join(SRC, 'bg_w2_mid.png')), {});
  writePNG(path.join(OUT, 'bg_marble', 'mid.png'), hardAlpha(resample(mid, [0, 290, 3584, 894], Math.round(3584 * k), Math.round(894 * k)), 110));
  console.log('story panels and World 2 layers');
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = { strips: {} };
  const only = process.argv[2];
  if (!only || only === 'strips') buildStrips(manifest);
  if (!only || only === 'tiles') buildTiles();
  if (!only || only === 'pictures') buildPictures();
  if (!only || only === 'strips') fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
}

main();
