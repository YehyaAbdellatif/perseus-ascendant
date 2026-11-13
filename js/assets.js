// Loads the art in assets/images and turns the big 512px animation strips into
// small pixel-art frames that match the game's 480x270 resolution.

const DIR = 'assets/images/';

// key: [file, frames, draw height in px, optional colour transform]
const SPRITE_SPECS = {
  p_idle:   ['perseus_hero_idle', 4, 38],
  p_run:    ['perseus_hero_run', 16, 38],
  p_attack: ['perseus_hero_attack', 16, 38],
  p_jump:   ['perseus_hero_jump', 16, 38],
  p_death:  ['perseus_hero_death', 16, 38],

  sk_idle:   ['skeleton_warrior_idle', 4, 40],
  sk_walk:   ['skeleton_warrior_walk', 16, 40],
  sk_attack: ['skeleton_warrior_attack', 16, 40],
  sk_death:  ['skeleton_warrior_death', 16, 40],
  // Bronze-armoured spear thrower variant
  sk2_idle:   ['skeleton_warrior_idle', 4, 40, 'bronze'],
  sk2_walk:   ['skeleton_warrior_walk', 16, 40, 'bronze'],
  sk2_attack: ['skeleton_warrior_attack', 16, 40, 'bronze'],

  hp_fly:  ['olympian_harpy_bird_fly', 16, 36],
  hp_dive: ['olympian_harpy_bird_dive', 16, 36],
  hp2_fly:  ['olympian_harpy_bird_fly', 16, 36, 'teal'],
  hp2_dive: ['olympian_harpy_bird_dive', 16, 36, 'teal'],
  queen_fly:  ['olympian_harpy_bird_fly', 16, 84, 'crimson'],
  queen_dive: ['olympian_harpy_bird_dive', 16, 84, 'crimson'],
  queen_idle: ['olympian_harpy_avian_idle', 16, 84, 'crimson'],

  sh_idle:   ['enemy_stygian_shade_idle', 4, 42],
  sh_walk:   ['enemy_stygian_shade_walk', 16, 42],
  sh_attack: ['enemy_stygian_shade_attack', 16, 42],

  lion_idle: ['nemean_guardian_quad_idle', 16, 92],
  lion_walk: ['nemean_guardian_quad_walk', 16, 92],
  lion_run:  ['nemean_guardian_quad_running', 16, 92],
  lion_jump: ['nemean_guardian_quad_jump', 16, 92],
  cer_idle: ['boss_cerberus_quad_idle', 16, 104],
  cer_walk: ['boss_cerberus_quad_walk', 16, 104],
  cer_run:  ['boss_cerberus_quad_running', 16, 104],
  cer_jump: ['boss_cerberus_quad_jump', 16, 104],

  ta_idle:   ['boss_talos_idle', 4, 106],
  ta_walk:   ['boss_talos_walk', 16, 106],
  ta_attack: ['boss_talos_attack', 16, 106],
  ta_death:  ['boss_talos_death', 16, 106],

  ladon: ['boss_ladon', 1, 120],
  an_walk: ['princess_andromeda_walk', 16, 40],

  me_idle:   ['medusa_boss_idle', 4, 104],
  me_run:    ['medusa_boss_run', 16, 104],
  me_attack: ['medusa_boss_attack', 16, 104],
  me_hurt:   ['medusa_boss_hurt', 16, 104],
  me_death:  ['medusa_boss_death', 16, 104],

  an_idle: ['princess_andromeda_idle', 4, 40],
  an_hurt: ['princess_andromeda_hurt', 16, 40],

  cetus: ['cetus_leviathan', 1, 230],

  i_harpe:   ['weapon_harpe', 1, 22],
  i_sword:   ['weapon_short_sword', 1, 6],
  i_shield:  ['relic_shield_athena', 1, 18],
  i_kibisis: ['relic_kibisis', 1, 16],
  i_sandals: ['relic_winged_sandals', 1, 12],
  i_helm:    ['relic_helm_hades', 1, 16],
  i_head:    ['relic_medusa_head', 1, 16],
  // Larger versions for relic reveal cards
  I_harpe:   ['weapon_harpe', 1, 64],
  I_shield:  ['relic_shield_athena', 1, 56],
  I_kibisis: ['relic_kibisis', 1, 48],
  I_sandals: ['relic_winged_sandals', 1, 36],
  I_helm:    ['relic_helm_hades', 1, 48],
  I_head:    ['relic_medusa_head', 1, 48],
};

const BG_FILES = ['bg_greek_hills', 'bg_stygian_cavern', 'bg_joppa_coast', 'env_marble_platform',
  'bg_acropolis_temple', 'bg_hesperides_garden', 'bg_olympus_peaks', 'bg_river_styx'];

export const images = {};
export const sprites = {};
export const layers = {};   // parallax layer sets: name -> [{img, speed}]
export const fx = {};       // effect name -> {img, w, h, pivot, frames}
export const tilesets = {}; // world number -> {img, roles: {role: [tile index]}, decor: [[x, y, w, h]]}

// CC0 parallax layers (ansimuz, "Mountain Dusk"); speed is the parallax factor.
const LAYER_SETS = {
  bg_peaks: [['sky', 0], ['far-mountains', 0.06], ['middle-mountains', 0.12], ['myst', 0.2], ['far-trees', 0.3], ['near-trees', 0.45]],
  bg_summit: [['sky', 0], ['far-clouds', 0.04], ['far-mountains', 0.08], ['mountains', 0.14], ['near-clouds', 0.22], ['trees', 0.35]],
  // Generated World 2 layers (tools/build-art.js)
  'gen/bg_marble': [['sky', 0.03], ['far', 0.1], ['mid', 0.3]],
};
// CC0 effects (Pixel VFX Studio, "PVFX Foundry").
const FX_NAMES = ['spark', 'parry', 'shatter', 'splash', 'lightning', 'heal', 'vanish', 'boom'];

function loadPath(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadExtras() {
  const jobs = [];
  for (const set in LAYER_SETS) {
    jobs.push(Promise.all(LAYER_SETS[set].map(([n, speed]) => loadPath(DIR + set + '/' + n + '.png').then((img) => ({ img, speed }))))
      .then((list) => { if (list.every((l) => l.img)) layers[set] = list; }));
  }
  // Generated art (tools/build-art.js): tiles per world and story panels.
  jobs.push(fetch(DIR + 'gen/tiles.json').then((r) => r.json()).catch(() => null).then((meta) => {
    if (!meta) return null;
    return Promise.all(Object.entries(meta).map(([w, m]) => loadPath(DIR + 'gen/tiles_w' + w + '.png').then((img) => { if (img) tilesets[w] = Object.assign({ img }, m); })));
  }));
  for (let i = 1; i <= 6; i++) jobs.push(loadPath(DIR + 'gen/story_' + i + '.png').then((img) => { if (img) images['story_' + i] = img; }));
  for (const n of FX_NAMES) {
    jobs.push(Promise.all([loadPath('assets/fx/' + n + '.png'), fetch('assets/fx/' + n + '.json').then((r) => r.json()).catch(() => null)])
      .then(([img, meta]) => { if (img && meta) fx[n] = Object.assign({ img }, meta); }));
  }
  await Promise.all(jobs);
}
const bgCache = {};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Decoded up front (in parallel, off the main thread) so the first draw doesn't stall on a big strip.
// Pre-shrunk copies (2x game size) of the big 512px strips, in assets/images/small; see README.
let smallFiles = new Set();
async function loadImage(name) {
  const img = new Image();
  img.src = DIR + (smallFiles.has(name) ? 'small/' : '') + name + '.png';
  try { await img.decode(); return img; } catch (e) { return img.complete && img.naturalWidth ? img : null; }
}

// Halve repeatedly for a clean downscale, then snap alpha so edges look like pixel art.
function downscale(img, tw, th) {
  let src = img, w = img.width, h = img.height;
  while (w / 2 >= tw * 1.5 && h / 2 >= th * 1.5) {
    const c = makeCanvas(w / 2, h / 2);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, c.width, c.height);
    src = c; w = c.width; h = c.height;
  }
  const out = makeCanvas(tw, th);
  // CPU-backed: the pixel pass reads this canvas back, which stalls badly on a GPU canvas.
  const ox = out.getContext('2d', { willReadFrequently: true });
  ox.imageSmoothingEnabled = true;
  ox.imageSmoothingQuality = 'high';
  ox.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

const TRANSFORMS = {
  bronze: (r, g, b) => { const l = (r + g + b) / 3; return [l * 1.25 + 30, l * 0.95 + 10, l * 0.55]; },
  teal: (r, g, b) => [r * 0.35, g * 0.9 + 30, b * 0.9 + 40],
  crimson: (r, g, b) => [b * 1.1 + 40, g * 0.5 + 10, r * 0.6],
  hellhound: (r, g, b) => { const l = (r + g + b) / 3; return [l * 0.75 + 25, l * 0.25, l * 0.3]; },
  white: () => [255, 255, 255],
  stone: (r, g, b) => { const l = (r * 0.3 + g * 0.59 + b * 0.11); return [l * 0.75 + 45, l * 0.78 + 48, l * 0.7 + 42]; },
  dark: (r, g, b) => [r * 0.2, g * 0.2, b * 0.25],
};

function pixelPass(canvas, transform) {
  const ctx = canvas.getContext('2d');
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = id.data;
  const fn = transform ? TRANSFORMS[transform] : null;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 100) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    if (fn) {
      const [r, g, b] = fn(d[i], d[i + 1], d[i + 2]);
      d[i] = Math.min(255, r); d[i + 1] = Math.min(255, g); d[i + 2] = Math.min(255, b);
    }
  }
  ctx.putImageData(id, 0, 0);
  return canvas;
}

function variantOf(spr, kind) {
  if (!spr.variants[kind]) {
    const c = makeCanvas(spr.canvas.width, spr.canvas.height);
    c.getContext('2d').drawImage(spr.canvas, 0, 0);
    spr.variants[kind] = pixelPass(c, kind);
  }
  return spr.variants[kind];
}

// Perseus's animations come from tools/build-perseus.js; the manifest gives frame counts and size.
// Animation name -> sprite key (a few keep their original names).
const PERSEUS_KEYS = { idle: 'p_idle', run: 'p_run', jump: 'p_jump', death: 'p_death', slash: 'p_attack' };
async function addPerseusSpecs() {
  try {
    const man = await fetch(DIR + 'perseus2/manifest.json').then((r) => (r.ok ? r.json() : null));
    if (!man) return;
    for (const [anim, n] of Object.entries(man.anims)) {
      SPRITE_SPECS[PERSEUS_KEYS[anim] || 'p_' + anim] = ['perseus2/' + anim, n, man.drawSize];
    }
  } catch (e) { /* keep the original Perseus sprites */ }
}

// Strips cut from the generated sheets (tools/build-art.js); the manifest gives frame counts and height.
async function addGeneratedSpecs() {
  try {
    const man = await fetch(DIR + 'gen/manifest.json').then((r) => (r.ok ? r.json() : null));
    if (!man) return;
    for (const [name, m] of Object.entries(man.strips)) SPRITE_SPECS[name] = ['gen/' + name, m.n, m.h];
  } catch (e) { /* generated art is optional */ }
}

export async function loadAssets(onProgress) {
  await Promise.all([addPerseusSpecs(), addGeneratedSpecs(),
    fetch(DIR + 'small/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => { if (m) smallFiles = new Set(m.files); }).catch(() => {})]);
  const files = new Set(BG_FILES);
  for (const k in SPRITE_SPECS) files.add(SPRITE_SPECS[k][0]);
  const list = [...files];
  const extras = loadExtras();
  let done = 0;
  await Promise.all(list.map(async (f) => {
    images[f] = await loadImage(f);
    done++;
    onProgress && onProgress(done / (list.length * 2));
  }));
  await extras;
  // Shrink every strip to game size. createImageBitmap resizes off the main thread, all in parallel;
  // the halving downscale is the fallback for browsers without resize support.
  const keys = Object.keys(SPRITE_SPECS).filter((k) => images[SPRITE_SPECS[k][0]]);
  let shrunk = 0;
  await Promise.all(keys.map(async (key) => {
    const [file, n, size, transform] = SPRITE_SPECS[key];
    const img = images[file];
    const fw = img.width / n, fh = img.height;
    const h = size, w = Math.round(size * fw / fh);
    let small = null;
    try { small = await createImageBitmap(img, { resizeWidth: w * n, resizeHeight: h, resizeQuality: 'high' }); } catch (e) { /* fallback below */ }
    const canvas = makeCanvas(w * n, h);
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(small || downscale(img, w * n, h), 0, 0);
    sprites[key] = { canvas: pixelPass(canvas, transform), n, w, h, variants: {} };
    onProgress && onProgress(0.5 + 0.5 * ++shrunk / keys.length);
  }));
}

// Draw a sprite frame with its feet at (x, y). flip mirrors it (all art faces right).
export function drawSprite(ctx, key, frame, x, y, flip, opt) {
  const s = sprites[key];
  if (!s) return;
  const f = ((Math.floor(frame) % s.n) + s.n) % s.n;
  const src = opt && opt.variant ? variantOf(s, opt.variant) : s.canvas;
  const scale = (opt && opt.scale) || 1;
  const w = s.w * scale, h = s.h * scale;
  ctx.save();
  if (opt && opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (opt && opt.rot) ctx.rotate(opt.rot);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(src, f * s.w, 0, s.w, s.h, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h));
  ctx.restore();
}

export function spriteFrames(key) { return sprites[key] ? sprites[key].n : 1; }

// Background painting, tinted per world and mirrored so it tiles without seams.
// crop: optional [left, width] as fractions of the image, to trim baked-in borders.
export function getBackground(file, filter, crop) {
  const key = file + '|' + filter + '|' + crop;
  if (bgCache[key]) return bgCache[key];
  const src = images[file];
  const h = 270;
  if (!src) return null;
  let img = src;
  if (crop) {
    img = makeCanvas(src.width * crop[1], src.height);
    img.getContext('2d').drawImage(src, -Math.round(src.width * crop[0]), 0);
  }
  const w = Math.round(img.width * h / img.height);
  const c = makeCanvas(w * 2, h);
  const x = c.getContext('2d');
  if (filter && filter !== 'none') x.filter = filter;
  x.drawImage(img, 0, 0, w, h);
  x.save();
  x.translate(w * 2, 0);
  x.scale(-1, 1);
  x.drawImage(img, 0, 0, w, h);
  x.restore();
  x.filter = 'none';
  bgCache[key] = c;
  return c;
}

export { makeCanvas };
