// Core gameplay: level loading, physics, Perseus, enemies, pickups, effects, rendering and HUD.
import { drawSprite, sprites, getBackground, images, makeCanvas, layers, fx, tilesets } from './assets.js';
import { sfx } from './audio.js';
import { input } from './input.js';
import { WORLDS, RELICS, RELIC_ORDER } from './levels.js';
import { createBoss } from './bosses.js';

export const T = 16, VW = 480, VH = 270;

// ---- Tuning (pixels and seconds) ----
const RUN = 115, ACCEL_G = 1700, ACCEL_A = 1150;
const GRAV_UP = 900, GRAV_DOWN = 1350, MAX_FALL = 380;
const JUMP_V = 345, DJUMP_V = 300, POGO_V = 320, POGO_V_HELD = 395;
const COYOTE = 0.1, JUMP_BUFFER = 0.13, GLIDE_FALL = 48;
const ATTACK_TIME = 0.28;
export const MAX_HP = 6;
// Still poses used on menu screens (Perseus idle frame; Andromeda's idle sheet is a turnaround).
export const IDLE_FRAME = 1, ANDROMEDA_FRAME = 1;

const DEBUG_BOXES = typeof location !== 'undefined' && new URLSearchParams(location.search).has('boxes');

const TILE = { EMPTY: 0, SOLID: 1, ONEWAY: 2, SPIKE: 3, BREAK: 4, CRUMBLE: 5, SPECTRAL: 6, LIQUID: 7 };

export const THEMES = {
  grove:  { bg: 'bg_greek_hills', filter: 'none', top: '#5aa83a', topHi: '#93d65c', body: '#946339', dark: '#68411f', light: '#b5824f', mid: 'trees', sky: '#9fd3ef' },
  marble: { layers: 'gen/bg_marble', bg: 'bg_acropolis_temple', filter: 'none', top: '#d9b24a', topHi: '#f6dc84', body: '#e4ded2', dark: '#b3aa9a', light: '#fbf8f0', brick: true, mid: 'none', sky: '#f2c98a' },
  garden: { bg: 'bg_hesperides_garden', filter: 'none', crop: [0.126, 0.748], top: '#3b9a47', topHi: '#78d866', body: '#b3a37c', dark: '#857652', light: '#d4c7a0', flowers: true, mid: 'apples', sky: '#a6e0d8' },
  peak:   { arenaLayers: 'bg_summit', bg: 'bg_olympus_peaks', filter: 'none', top: '#eef4ff', topHi: '#ffffff', body: '#7a8291', dark: '#525866', light: '#a0a8b6', mid: 'peaks', sky: '#c9dcf2' },
  styx:   { bg: 'bg_river_styx', filter: 'none', top: '#6a2a3c', topHi: '#a24456', body: '#2a2030', dark: '#17111c', light: '#3e3046', ember: '#ff7a2a', liquid: ['#0d2b26', '#2fd7a0'], mid: 'stalactites', cave: true, sky: '#120a18' },
  gorgon: { bg: 'bg_stygian_cavern', filter: 'brightness(0.95)', top: '#3c5a42', topHi: '#78b86e', body: '#353d37', dark: '#202622', light: '#4b574e', ember: '#52ff8a', liquid: ['#0f2a1c', '#4bd17a'], mid: 'stalactites', cave: true, sky: '#0a120e' },
  coast:  { bg: 'bg_joppa_coast', filter: 'brightness(0.95)', top: '#3c5058', topHi: '#7c9a98', body: '#2c3138', dark: '#1a1d22', light: '#444b55', liquid: ['#0f3456', '#9fd8ff'], mid: 'none', rain: true, sky: '#1b2638' },
};

// ---- Shared state ----
export const run = {
  world: 1, relics: new Set(), drachmas: 0, lives: 3, nectar: 0, helm: 100, charges: 3, time: 0,
};
export let L = null;      // current level
export const P = {};      // the player
const cam = { x: 0, y: 0, shake: 0, look: 0 };
let enemies = [], projectiles = [], particles = [], pickups = [], props = [], plats = [], texts = [];
let boss = null;
let fxList = [];
let hitstop = 0;
let events = [];          // messages for main.js (death, gate, relic, victory)
let flash = 0, lightning = 0, lightningTimer = 6, rain = [];
let signText = null, signAlpha = 0;
let bannerText = null, bannerT = 0;

export function has(r) { return run.relics.has(r); }
export function pollEvents() { const e = events; events = []; return e; }
export function getBoss() { return boss; }

export function resetRun(world) {
  run.world = world;
  run.relics = new Set(RELIC_ORDER.slice(0, world - 1));
  run.lives = 3;
  run.nectar = 0;
  run.helm = 100;
  run.charges = 3;
}

// ---------------------------------------------------------------------------
// Level loading
// ---------------------------------------------------------------------------
export function loadLevel(worldNum, isArena) {
  const W = WORLDS[worldNum - 1];
  const map = isArena ? W.arena : W.stage;
  const h = map.length, w = map[0].length;
  const theme = THEMES[W.theme];
  L = {
    world: W, theme, isArena, w, h, pxW: w * T, pxH: h * T,
    tiles: new Uint8Array(w * h), crumble: new Map(), spawn: { x: 32, y: 100 }, checkpoint: null,
    altars: [], signs: [], gates: [], decor: [], movers: [], hazards: [], andromeda: null, t: 0,
    tileset: tilesets[worldNum] || null,   // generated tile art (tools/build-art.js); null = drawn tiles
  };
  enemies = []; projectiles = []; particles = []; pickups = []; props = []; plats = []; texts = []; fxList = [];
  boss = null;
  let signIdx = 0;
  const signCells = [];
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const c = map[ty][tx];
      const x = tx * T, y = ty * T, feet = y + T, cx = x + T / 2;
      let tile = 0;
      switch (c) {
        case '#': tile = TILE.SOLID; break;
        case '=': tile = TILE.ONEWAY; break;
        case '^': tile = TILE.SPIKE; break;
        case 'B': tile = TILE.BREAK; break;
        case 'X': tile = TILE.CRUMBLE; break;
        case '|': tile = TILE.SPECTRAL; break;
        case '~': tile = TILE.LIQUID; break;
        case 'P': L.spawn = { x: cx - 6, y: feet - 32 }; break;
        case 'o': pickups.push({ kind: 'coin', x: cx, y: y + 8, vx: 0, vy: 0, phys: false, t: Math.random() * 6 }); break;
        case 'a': props.push({ kind: 'amphora', x: cx - 6, y: feet - 14, w: 12, h: 14, loot: 'random' }); break;
        case 'n': props.push({ kind: 'amphora', x: cx - 6, y: feet - 14, w: 12, h: 14, loot: 'nectar', tint: '#e05a8a' }); break;
        case 'd': props.push({ kind: 'amphora', x: cx - 6, y: feet - 14, w: 12, h: 14, loot: 'draught', tint: '#4bd17a' }); break;
        case 'C': props.push({ kind: 'chest', x: cx - 8, y: feet - 12, w: 16, h: 12, loot: 'chest' }); break;
        case 'A': L.altars.push({ x: cx - 8, y: feet - 22, w: 16, h: 22, lit: false }); break;
        case '?': signCells.push({ x: cx - 7, y: feet - 14, w: 14, h: 14 }); break;
        case 'G': L.gates.push({ x: cx - 12, y: feet - 40, w: 24, h: 40 }); break;
        case 'M': case 'V': L.movers.push({ ox: cx - 24, oy: y, x: cx - 24, y, w: 48, h: 8, axis: c === 'M' ? 'x' : 'y', amp: 48, ph: Math.random() * 6, dx: 0, dy: 0 }); break;
        case 'k': case 'K': case 'h': case 'H': case 's': case 'e': case 'E': case 'v': enemies.push(makeEnemy(c, cx, feet)); break;
        case 'Z': L.bossSpawn = { x: cx, y: feet }; break;
        case 'Y': L.andromeda = { x: cx, y: feet, free: false, t: 0 }; break;
        case 'y': case 'i': case 'S': case 'f': L.decor.push({ kind: c, x: cx, y: feet }); break;
      }
      L.tiles[ty * w + tx] = tile;
    }
  }
  signCells.sort((a, b) => a.x - b.x);
  for (const s of signCells) L.signs.push(Object.assign(s, { text: W.signs[signIdx++] || '' }));
  L.prerender = prerenderTiles();
  resetPlayer(L.spawn.x, L.spawn.y);
  if (isArena && L.bossSpawn) {
    boss = createBoss(W.boss, L.bossSpawn.x, L.bossSpawn.y, api);
  }
  snapCamera();
  return L;
}

function resetPlayer(x, y) {
  Object.assign(P, {
    x, y, w: 12, h: 32, vx: 0, vy: 0, face: 1, onGround: false, hp: MAX_HP,
    coyote: 0, jumpBuf: 0, jumpCut: true, airJumps: 0, dropT: 0,
    attackT: 0, attackCD: 0, attackUp: false, hitSet: new Set(), pogo: false,
    inv: 1.0, hurtT: 0, shielding: false, invisible: false, helmDelay: 0, gazeT: 0, gazeCD: 0,
    dead: false, deadT: 0, petrified: 0, anim: 0, safe: { x, y }, ride: null, gliding: false,
    altarCD: 0, landT: 0, drinkT: 0, djT: 0, bounceT: 0,
  });
  run.helm = 100;
}

export function respawnAtCheckpoint() {
  const keepAltars = L.altars.map((a) => a.lit);
  if (L.isArena) {
    loadLevel(L.world.num, true);
  } else {
    // Rebuild enemies and props but keep lit altars.
    const lit = L.checkpoint;
    loadLevel(L.world.num, false);
    L.altars.forEach((a, i) => { a.lit = keepAltars[i]; });
    L.checkpoint = lit;
    if (lit) { P.x = lit.x; P.y = lit.y; P.safe = { x: lit.x, y: lit.y }; }
  }
  run.charges = 3;
  run.helm = 100;
  snapCamera();
}

// ---------------------------------------------------------------------------
// Tiles and collision
// ---------------------------------------------------------------------------
function tileAt(tx, ty) {
  if (tx < 0 || tx >= L.w) return TILE.SOLID;
  if (ty < 0 || ty >= L.h) return TILE.EMPTY;
  return L.tiles[ty * L.w + tx];
}
function setTile(tx, ty, v) { if (tx >= 0 && tx < L.w && ty >= 0 && ty < L.h) L.tiles[ty * L.w + tx] = v; }

function crumbleState(tx, ty) { return L.crumble.get(ty * L.w + tx); }

function solidTile(t, tx, ty, isPlayer) {
  if (t === TILE.SOLID || t === TILE.BREAK || t === TILE.SPIKE) return true;
  if (t === TILE.CRUMBLE) { const s = crumbleState(tx, ty); return !(s && s.gone); }
  if (t === TILE.SPECTRAL) return !(isPlayer && P.invisible);
  return false;
}

export function solidAt(px, py) {
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  return solidTile(tileAt(tx, ty), tx, ty, false);
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Moves a body with tile collision. Used by the player, walking enemies and grounded bosses.
export function moveBody(b, dt, isPlayer) {
  b.hitWall = 0;
  // Horizontal
  b.x += b.vx * dt;
  const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w) / T);
    for (let ty = y0; ty <= y1; ty++) if (solidTile(tileAt(tx, ty), tx, ty, isPlayer)) { b.x = tx * T - b.w; b.vx = 0; b.hitWall = 1; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / T);
    for (let ty = y0; ty <= y1; ty++) if (solidTile(tileAt(tx, ty), tx, ty, isPlayer)) { b.x = (tx + 1) * T; b.vx = 0; b.hitWall = -1; break; }
  }
  for (const s of plats) {
    if (!s.solid || !overlap(b, s)) continue;
    if (b.x + b.w / 2 < s.x + s.w / 2) { b.x = s.x - b.w; b.hitWall = 1; } else { b.x = s.x + s.w; b.hitWall = -1; }
    b.vx = 0;
  }
  // Vertical
  const prevBottom = b.y + b.h;
  b.y += b.vy * dt;
  const wasGround = b.onGround;
  b.onGround = false;
  b.groundTile = 0;
  b.ride = null;
  const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T);
  if (b.vy >= 0) {
    const ty = Math.floor((b.y + b.h) / T);
    for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      const oneway = t === TILE.ONEWAY && prevBottom <= ty * T + 1 && !(b.dropT > 0);
      if (solidTile(t, tx, ty, isPlayer) || oneway) {
        b.y = ty * T - b.h; b.vy = 0; b.onGround = true;
        if (b.groundTile !== TILE.SOLID) b.groundTile = t;
        if (t === TILE.CRUMBLE && isPlayer) triggerCrumble(tx, ty);
      }
    }
    for (const s of plats) {
      if (b.x + b.w <= s.x || b.x >= s.x + s.w) continue;
      if (prevBottom <= s.y + 2 + Math.max(0, s.dy || 0) && b.y + b.h >= s.y && !(b.dropT > 0 && !s.solid)) {
        b.y = s.y - b.h; b.vy = 0; b.onGround = true; b.ride = s; b.groundTile = s.solid ? TILE.SOLID : TILE.ONEWAY;
      }
    }
  } else {
    const ty = Math.floor(b.y / T);
    for (let tx = x0; tx <= x1; tx++) {
      if (solidTile(tileAt(tx, ty), tx, ty, isPlayer)) {
        // Corner correction: nudge past ledges clipped by a few pixels.
        if (isPlayer) {
          const leftEdge = (tx + 1) * T - b.x, rightEdge = b.x + b.w - tx * T;
          if (leftEdge > 0 && leftEdge <= 5 && !solidTile(tileAt(tx + 1, ty), tx + 1, ty, true)) { b.x += leftEdge; continue; }
          if (rightEdge > 0 && rightEdge <= 5 && !solidTile(tileAt(tx - 1, ty), tx - 1, ty, true)) { b.x -= rightEdge; continue; }
        }
        b.y = (ty + 1) * T; b.vy = 0; break;
      }
    }
    for (const s of plats) {
      if (s.solid && overlap(b, s)) { b.y = s.y + s.h; b.vy = 0; }
    }
  }
  b.justLanded = b.onGround && !wasGround;
}

function triggerCrumble(tx, ty) {
  const k = ty * L.w + tx;
  if (!L.crumble.has(k)) {
    // Trigger the whole connected run so slabs fall together.
    let a = tx, z = tx;
    while (tileAt(a - 1, ty) === TILE.CRUMBLE) a--;
    while (tileAt(z + 1, ty) === TILE.CRUMBLE) z++;
    for (let x = a; x <= z; x++) if (!L.crumble.has(ty * L.w + x)) L.crumble.set(ty * L.w + x, { t: 0.55, gone: false, tx: x, ty });
  }
}

function updateCrumble(dt) {
  for (const [k, s] of L.crumble) {
    s.t -= dt;
    if (!s.gone && s.t <= 0) {
      s.gone = true; s.t = 3.2;
      sfx('crumble');
      for (let i = 0; i < 5; i++) particle(s.tx * T + Math.random() * 16, s.ty * T + 6, (Math.random() - 0.5) * 60, 40 + Math.random() * 60, L.theme.light, 0.8, 3, 600);
    } else if (s.gone && s.t <= 0) {
      const r = { x: s.tx * T, y: s.ty * T, w: T, h: T };
      if (!overlap(r, P)) L.crumble.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
export function particle(x, y, vx, vy, color, life, size = 2, grav = 0, kind) {
  if (particles.length > 500) particles.shift();
  particles.push({ x, y, vx, vy, color, life, max: life, size, grav, kind });
}
export function burst(x, y, color, n = 10, speed = 120, size = 2, grav = 300) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    particle(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, color, 0.4 + Math.random() * 0.4, size, grav);
  }
}
// Sprite-sheet effects from assets/fx. Default sizes keep them in scale with 38px characters.
const FX_SCALE = { spark: 0.5, parry: 0.5, shatter: 0.6, splash: 0.65, lightning: 1.3, heal: 0.55, vanish: 0.55, boom: 0.6 };
export function spawnFx(name, x, y, opt = {}) {
  const f = fx[name];
  if (!f) return;
  const total = f.frames.reduce((a, fr) => a + fr.ms, 0) / 1000;
  fxList.push({ name, x, y, t: 0, total, scale: opt.scale || FX_SCALE[name] || 1, flip: !!opt.flip, bg: !!opt.bg });
}
function updateFx(dt) {
  for (const e of fxList) e.t += dt;
  fxList = fxList.filter((e) => e.t < e.total);
}
function drawFx(ctx, bg) {
  for (const e of fxList) {
    if (e.bg !== bg) continue;
    const f = fx[e.name];
    let ms = e.t * 1000, i = 0;
    while (i < f.frames.length - 1 && ms >= f.frames[i].ms) { ms -= f.frames[i].ms; i++; }
    const fr = f.frames[i], sc = e.scale;
    ctx.save();
    ctx.translate(Math.round(e.x), Math.round(e.y));
    if (e.flip) ctx.scale(-1, 1);
    ctx.drawImage(f.img, fr.x, fr.y, f.w, f.h, Math.round(-f.pivot[0] * sc), Math.round(-f.pivot[1] * sc), Math.round(f.w * sc), Math.round(f.h * sc));
    ctx.restore();
  }
}

export function shake(a) { cam.shake = Math.max(cam.shake, a); }
export function floatText(x, y, str, color = '#ffe08a') { texts.push({ x, y, str, color, t: 0.9 }); }
export function banner(str, t = 2.2) { bannerText = str; bannerT = t; }
export function screenFlash(a = 0.6) { flash = Math.max(flash, a); }

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
export function hurtPlayer(dmg, fromX, opts = {}) {
  if (P.dead || (P.inv > 0 && !opts.ignoreInv)) return false;
  P.hp -= dmg;
  P.inv = 1.3;
  P.hurtT = 0.28;
  P.attackT = 0;
  const away = fromX === undefined ? -P.face : (P.x + P.w / 2 < fromX ? -1 : 1);
  P.vx = away * 150;
  P.vy = opts.bounce || -200;
  P.invisible = false;
  sfx('hurt');
  shake(4);
  hitstop = 0.07;
  burst(P.x + P.w / 2, P.y + 12, '#ff5a5a', 8, 90);
  if (P.hp <= 0) killPlayer();
  return true;
}

function killPlayer() {
  if (P.dead) return;
  P.hp = 0;
  P.dead = true;
  P.deadT = 0;
  P.vx = 0;
  P.vy = -150;
  sfx('die');
}

function fallInPit() {
  sfx('pit');
  P.hp -= 1;
  if (P.hp <= 0) { killPlayer(); P.y = L.pxH + 100; return; }
  P.x = P.safe.x; P.y = P.safe.y; P.vx = 0; P.vy = 0; P.inv = 1.5;
  burst(P.x + 6, P.y + 16, '#ffffff', 10, 80);
}

function attackBox() {
  const harpe = has('harpe');
  if (P.attackUp) return { x: P.x + P.w / 2 - 15, y: P.y - (harpe ? 26 : 18), w: 30, h: harpe ? 30 : 22 };
  const reach = harpe ? 32 : 20;
  return { x: P.face > 0 ? P.x + P.w - 2 : P.x - reach + 2, y: P.y + 6, w: reach, h: 16 };
}

function pogoBox(dt) {
  return { x: P.x - 2, y: P.y + P.h - 2, w: P.w + 4, h: 12 + Math.max(0, P.vy * dt) };
}

function updatePlayer(dt) {
  const p = P;
  p.anim += dt;
  if (p.dead) {
    p.deadT += dt;
    p.vy += GRAV_DOWN * 0.5 * dt;
    p.y += Math.min(p.vy, 120) * dt * (p.deadT < 0.4 ? 1 : 0);
    if (p.deadT > 1.6 && !p.deathSent) { p.deathSent = true; events.push({ type: 'death' }); }
    return;
  }
  p.drinkT -= dt; p.djT -= dt; p.bounceT -= dt; p.landT -= dt;
  p.inv -= dt; p.hurtT -= dt; p.attackCD -= dt; p.dropT -= dt; p.gazeT -= dt; p.gazeCD -= dt; p.altarCD -= dt;
  p.jumpBuf -= dt;

  if (p.ride) { p.x += p.ride.dx; p.y += p.ride.dy; }

  if (p.petrified > 0) {
    p.petrified -= dt;
    p.vx = 0;
    p.vy = Math.min(p.vy + GRAV_DOWN * dt, MAX_FALL);
    moveBody(p, dt, true);
    if (p.petrified <= 0) burst(p.x + 6, p.y + 16, '#9a9a8a', 14, 100, 2);
    return;
  }

  const I = input;
  let dir = (I.held.right ? 1 : 0) - (I.held.left ? 1 : 0);
  if (p.hurtT > 0) dir = 0;

  // Shield
  p.shielding = has('shield') && I.held.shield && p.hurtT <= 0 && p.attackT <= 0;
  if (dir !== 0 && !p.shielding && p.attackT <= 0) p.face = dir;

  // Horizontal movement: instant, no slippery inertia
  const max = RUN * (p.shielding && p.onGround ? 0.35 : 1);
  const target = dir * max;
  if (p.hurtT > 0) {
    p.vx *= 0.92;
  } else {
    const acc = p.onGround ? ACCEL_G : ACCEL_A;
    if (p.vx < target) p.vx = Math.min(target, p.vx + acc * dt);
    else if (p.vx > target) p.vx = Math.max(target, p.vx - acc * dt);
  }

  // Jumping
  if (I.pressed.jump) p.jumpBuf = JUMP_BUFFER;
  if (p.onGround) { p.coyote = COYOTE; p.airJumps = has('sandals') ? 1 : 0; }
  else p.coyote -= dt;

  if (p.jumpBuf > 0 && p.hurtT <= 0) {
    if (I.held.down && p.onGround && p.groundTile === TILE.ONEWAY) {
      p.dropT = 0.22; p.jumpBuf = 0; p.onGround = false; p.y += 2;
    } else if (p.coyote > 0) {
      p.vy = -JUMP_V; p.coyote = 0; p.jumpBuf = 0; p.jumpCut = false; p.onGround = false;
      sfx('jump');
      for (let i = 0; i < 4; i++) particle(p.x + 6, p.y + p.h, (Math.random() - 0.5) * 60, -Math.random() * 30, '#e8dcc0', 0.3, 2);
    } else if (p.airJumps > 0) {
      p.vy = -DJUMP_V; p.airJumps--; p.jumpBuf = 0; p.jumpCut = false; p.djT = 0.35;
      sfx('djump');
      for (let i = 0; i < 8; i++) particle(p.x + 6 + (Math.random() - 0.5) * 14, p.y + p.h, (Math.random() - 0.5) * 80, 30 + Math.random() * 40, '#ffffff', 0.5, 2, -40, 'feather');
    }
  }
  if (p.vy < 0 && !I.held.jump && !p.jumpCut) { p.vy *= 0.45; p.jumpCut = true; }

  // Gravity, apex hang and glide
  let g = p.vy < 0 ? GRAV_UP : GRAV_DOWN;
  if (Math.abs(p.vy) < 45 && I.held.jump) g *= 0.55;
  p.vy = Math.min(p.vy + g * dt, MAX_FALL);
  p.gliding = false;
  if (has('sandals') && !p.onGround && p.vy > GLIDE_FALL && I.held.jump && p.hurtT <= 0 && !I.held.down) {
    p.vy = GLIDE_FALL; p.gliding = true;
    if (Math.random() < 0.2) particle(p.x + 6, p.y + p.h, -p.vx * 0.2, 20, '#ffffff', 0.4, 1, 0, 'feather');
  }

  // Attack
  p.attackT -= dt;
  if (I.pressed.attack && p.attackCD <= 0 && p.hurtT <= 0) {
    p.attackT = ATTACK_TIME; p.attackCD = 0.3; p.attackUp = I.held.up; p.hitSet = new Set();
    sfx('slash');
    if (p.invisible) setInvisible(false);
  }

  // Down-thrust pogo
  p.pogo = has('harpe') && !p.onGround && I.held.down && p.attackT <= 0 && p.hurtT <= 0;
  if (p.pogo && p.vy > -60) {
    const box = pogoBox(dt);
    if (pogoCheck(box)) {
      p.vy = I.held.jump ? -POGO_V_HELD : -POGO_V;
      p.jumpCut = true;
      p.bounceT = 0.25;
      if (has('sandals')) p.airJumps = 1;
      sfx('pogo');
      hitstop = Math.max(hitstop, 0.04);
    }
  }

  // Relic powers
  if (I.pressed.helm && has('helm')) setInvisible(!p.invisible);
  if (p.invisible) {
    run.helm -= 22 * dt;
    if (run.helm <= 0) { run.helm = 0; setInvisible(false); }
    p.helmDelay = 1;
  } else {
    p.helmDelay -= dt;
    if (p.helmDelay <= 0) run.helm = Math.min(100, run.helm + 12 * dt);
  }
  if (I.pressed.gaze && has('head')) {
    if (run.charges > 0 && p.gazeCD <= 0) useGaze();
    else if (run.charges <= 0) { floatText(p.x + 6, p.y - 8, 'NO POWER', '#8aa'); sfx('clank'); }
  }
  if (I.pressed.nectar && has('kibisis')) {
    if (run.nectar > 0 && p.hp < MAX_HP) {
      run.nectar--; p.hp = Math.min(MAX_HP, p.hp + 3); p.drinkT = 0.6;
      sfx('heal'); floatText(p.x + 6, p.y - 6, '+3', '#ff8ab0'); spawnFx('heal', p.x + 6, p.y + p.h);
      burst(p.x + 6, p.y + 10, '#ff9ac0', 12, 70, 2, -60);
    }
  }

  moveBody(p, dt, true);

  if (p.justLanded) {
    p.landT = 0.1; p.djT = 0;
    for (let i = 0; i < 3; i++) particle(p.x + 6, p.y + p.h, (Math.random() - 0.5) * 50, -Math.random() * 20, '#d8ccb0', 0.25, 2);
  }

  // Spikes: harmless when pogoing, otherwise they hurt and toss you up.
  if (p.onGround && p.groundTile !== TILE.SOLID) {
    const ty = Math.floor((p.y + p.h) / T);
    const a = tileAt(Math.floor((p.x + 2) / T), ty), b = tileAt(Math.floor((p.x + p.w - 2) / T), ty);
    if (a === TILE.SPIKE || b === TILE.SPIKE) {
      if (p.pogo) { p.vy = -POGO_V; sfx('pogo'); }
      else { hurtPlayer(1, undefined, { bounce: -320 }); p.vy = -320; }
    }
  }

  // Remember safe ground for pit recovery
  if (p.onGround && !p.ride && p.groundTile === TILE.SOLID) {
    const ty = Math.floor((p.y + p.h) / T);
    const l = tileAt(Math.floor((p.x - 6) / T), ty), r = tileAt(Math.floor((p.x + p.w + 6) / T), ty);
    if (l === TILE.SOLID && r === TILE.SOLID) p.safe = { x: p.x, y: p.y };
  }

  // Water and pits
  const feetT = tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h - 4) / T));
  if (feetT === TILE.LIQUID) { sfx('splash'); spawnFx('splash', p.x + p.w / 2, Math.floor((p.y + p.h - 4) / T) * T + 4); burst(p.x + 6, p.y + p.h, L.theme.liquid ? L.theme.liquid[1] : '#8cf', 14, 120); fallInPit(); }
  if (p.y > L.pxH + 16) fallInPit();

  // Attack hits
  if (p.attackT > 0.05 && p.attackT < ATTACK_TIME - 0.05) attackHits(attackBox());
}

function setInvisible(on) {
  if (on && run.helm < 10) { sfx('clank'); return; }
  if (on === P.invisible) return;
  P.invisible = on;
  sfx('invis');
  spawnFx('vanish', P.x + P.w / 2, P.y + P.h);
  burst(P.x + 6, P.y + 16, '#b48aff', 12, 80, 2, 0);
}

function useGaze() {
  run.charges--;
  P.gazeT = 0.45;
  P.gazeCD = 0.6;
  sfx('gaze');
  screenFlash(0.25);
  const box = { x: P.face > 0 ? P.x + P.w : P.x - 180, y: P.y - 56, w: 180, h: P.h + 84 };
  P.gazeBox = box;
  for (const e of enemies) {
    if (!e.alive || e.dying || e.stone > 0 || e.type === 'eye') continue;
    if (overlap(box, e)) petrify(e);
  }
  if (boss && boss.onGaze) {
    for (const hb of boss.hurtboxes()) if (overlap(box, hb)) { boss.onGaze(); break; }
  }
}

function petrify(e) {
  e.stone = 12;
  e.vx = 0; e.vy = 0;
  sfx('petrify');
  burst(e.x + e.w / 2, e.y + e.h / 2, '#4bd17a', 12, 90, 2, 0);
}

// Returns true if the down-thrust hit something to bounce on.
function pogoCheck(box) {
  let hit = false;
  for (const e of enemies) {
    if (!e.alive || e.dying || e.type === 'eye') continue;
    if (e.stone > 0) continue; // stone is just ground
    if (overlap(box, e)) { damageEnemy(e, 2, 0, true); hit = true; }
  }
  for (const pr of props) if (!pr.broken && overlap(box, pr)) { breakProp(pr); hit = true; }
  // Tiles under the spear
  const ty = Math.floor((box.y + box.h) / T);
  for (let tx = Math.floor(box.x / T); tx <= Math.floor((box.x + box.w - 1) / T); tx++) {
    for (let yy = Math.floor(box.y / T); yy <= ty; yy++) {
      const t = tileAt(tx, yy);
      if (t === TILE.SPIKE) hit = true;
      if (t === TILE.BREAK) { breakTile(tx, yy); hit = true; }
    }
  }
  if (boss && !boss.dead) {
    for (const hb of boss.hurtboxes()) {
      if (overlap(box, hb)) {
        if (hb.armor) { sfx('clank'); burst(box.x + 6, box.y + 8, '#ffd27a', 6, 80); }
        else bossDamage(2 * (hb.mult || 1), 'pogo');
        hit = true;
        break;
      }
    }
  }
  return hit;
}

function attackHits(box) {
  const dmg = has('harpe') ? 2 : 1;
  for (const e of enemies) {
    if (!e.alive || e.dying || e.type === 'eye' || e.stone > 0 || P.hitSet.has(e)) continue;
    if (overlap(box, e)) { P.hitSet.add(e); damageEnemy(e, dmg, P.face); }
  }
  for (const pr of props) if (!pr.broken && overlap(box, pr)) breakProp(pr);
  for (let tx = Math.floor(box.x / T); tx <= Math.floor((box.x + box.w - 1) / T); tx++) {
    for (let ty = Math.floor(box.y / T); ty <= Math.floor((box.y + box.h - 1) / T); ty++) {
      if (tileAt(tx, ty) === TILE.BREAK) breakTile(tx, ty);
    }
  }
  // Enemy missiles can be swatted
  for (const pr of projectiles) {
    if (!pr.friendly && pr.reflectable && !P.hitSet.has(pr) && circleRect(pr, box)) {
      P.hitSet.add(pr); pr.dead = true; burst(pr.x, pr.y, '#fff', 5, 60); sfx('block');
    }
  }
  if (boss && !boss.dead && !P.hitSet.has('boss')) {
    for (const hb of boss.hurtboxes()) {
      if (overlap(box, hb)) {
        P.hitSet.add('boss');
        if (hb.armor) { sfx('clank'); burst(box.x + box.w / 2, box.y + 8, '#ffd27a', 6, 80); P.vx = -P.face * 80; }
        else bossDamage(dmg * (hb.mult || 1), 'slash');
        break;
      }
    }
  }
}

export function bossDamage(dmg, kind) {
  if (!boss || boss.dead || boss.inv > 0) return;
  boss.hp -= dmg;
  boss.flash = 0.12;
  boss.inv = 0.12;
  hitstop = Math.max(hitstop, 0.06);
  sfx('hit');
  shake(2);
  const c = boss.center ? boss.center() : { x: boss.x, y: boss.y };
  burst(c.x, c.y, '#fff2b0', 6, 100);
  spawnFx('spark', c.x + (Math.random() - 0.5) * 16, c.y + (Math.random() - 0.5) * 16, { scale: 0.7 });
  if (boss.onHurt) boss.onHurt(dmg, kind);
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.dead = true;
    boss.deathT = 0;
    sfx('bossdie');
    shake(8);
    for (let i = 0; i < 4; i++) spawnFx('boom', c.x + (Math.random() - 0.5) * 50, c.y + 20 + (Math.random() - 0.5) * 30, { scale: 0.9 });
    screenFlash(0.8);
    projectiles = projectiles.filter((p) => p.friendly);
    for (const e of enemies) if (e.alive && e.type !== 'eye') { e.alive = false; burst(e.x + e.w / 2, e.y + e.h / 2, '#ccc', 8); }
  }
}

function breakTile(tx, ty) {
  setTile(tx, ty, TILE.EMPTY);
  spawnFx('shatter', tx * T + 8, ty * T + 16, { scale: 0.45 });
  sfx('break');
  burst(tx * T + 8, ty * T + 8, L.theme.light, 10, 120, 3, 500);
  burst(tx * T + 8, ty * T + 8, L.theme.dark, 6, 100, 2, 500);
  if (Math.random() < 0.5) dropPickup('coin', tx * T + 8, ty * T + 8);
}

function breakProp(pr) {
  pr.broken = true;
  pr.brokeAt = L.t;
  const cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2;
  if (pr.kind === 'chest') {
    sfx('gem');
    for (let i = 0; i < 6; i++) dropPickup('coin', cx, cy);
    dropPickup('gem', cx, cy);
    burst(cx, cy, '#ffd34a', 10, 90);
    pr.open = true;
    pr.broken = false; pr.opened = true; pr.w = 0; // stays visible, no longer interactive
    return;
  }
  sfx('break');
  burst(cx, cy, '#c8643a', 12, 110, 2, 500);
  burst(cx, cy, '#e8a060', 6, 90, 3, 500);
  if (pr.loot === 'nectar') dropPickup('nectar', cx, cy);
  else if (pr.loot === 'draught') dropPickup('draught', cx, cy);
  else {
    const r = Math.random();
    if (r < 0.12) dropPickup('nectar', cx, cy);
    else if (r < 0.2 && (has('helm') || has('head'))) dropPickup('draught', cx, cy);
    else { const n = 2 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) dropPickup('coin', cx, cy); }
  }
}

export function dropPickup(kind, x, y) {
  pickups.push({ kind, x, y, vx: (Math.random() - 0.5) * 120, vy: -150 - Math.random() * 80, phys: true, t: 0, life: 12 });
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
function makeEnemy(c, cx, feet) {
  const base = { alive: true, dying: 0, flash: 0, stone: 0, vx: 0, vy: 0, t: Math.random() * 2, cd: 1 + Math.random(), face: -1, anim: Math.random() * 3, state: 'idle', onGround: false, spawnChar: c, sx: cx, sy: feet };
  switch (c) {
    case 'k': return Object.assign(base, { type: 'skeleton', x: cx - 7, y: feet - 32, w: 14, h: 32, hp: 2, state: 'walk', spear: false });
    case 'K': return Object.assign(base, { type: 'skeleton', x: cx - 7, y: feet - 32, w: 14, h: 32, hp: 2, state: 'walk', spear: true });
    case 'h': case 'H': return Object.assign(base, { type: 'harpy', x: cx - 10, y: feet - 26, w: 20, h: 18, hp: 2, hx: cx - 10, hy: feet - 26, state: 'hover', thrower: c === 'H' });
    case 's': return Object.assign(base, { type: 'shade', x: cx - 8, y: feet - 30, w: 16, h: 28, hp: 3, hx: cx - 8, hy: feet - 30 });
    case 'e': case 'E': return Object.assign(base, { type: 'eye', x: cx - 7, y: feet - 16, w: 14, h: 14, hp: 999, face: c === 'e' ? -1 : 1, alert: 0 });
    case 'v': return Object.assign(base, { type: 'serpent', x: cx - 11, y: feet - 14, w: 22, h: 14, hp: 2, state: 'slither' });
  }
  return null;
}

export function spawnEnemy(c, cx, feet) {
  const e = makeEnemy(c, cx, feet);
  e.summoned = true;
  enemies.push(e);
  burst(cx, feet - 12, '#b48aff', 10, 80);
  return e;
}
export function countEnemies(type) { return enemies.filter((e) => e.alive && e.type === type).length; }

function damageEnemy(e, dmg, dir, pogo) {
  e.hp -= dmg;
  e.flash = 0.12;
  spawnFx('spark', e.x + e.w / 2, e.y + e.h / 2, { flip: dir < 0 });
  sfx('hit');
  hitstop = Math.max(hitstop, 0.05);
  if (dir) e.vx = dir * 90;
  if (e.hp <= 0) {
    e.dying = 0.5;
    e.vx = 0;
    sfx('kill');
    spawnFx('boom', e.x + e.w / 2, e.y + e.h, { scale: 0.45 });
    burst(e.x + e.w / 2, e.y + e.h / 2, e.type === 'shade' ? '#9a7aff' : e.type === 'harpy' ? '#7a5ad0' : e.type === 'serpent' ? '#3fae4a' : '#e8e0c8', 12, 120);
    dropPickup('coin', e.x + e.w / 2, e.y + e.h / 2);
    if (Math.random() < 0.4) dropPickup('coin', e.x + e.w / 2, e.y + e.h / 2);
    run.drachmas += 10;
  } else if (pogo) {
    burst(e.x + e.w / 2, e.y, '#fff', 4, 60);
  }
}

function playerVisible() { return !P.invisible && !P.dead; }

function updateEnemy(e, dt) {
  e.anim += dt;
  e.flash -= dt;
  if (e.dying > 0) {
    e.dying -= dt;
    if (e.dying <= 0) e.alive = false;
    return;
  }
  if (e.stone > 0) {
    e.stone -= dt;
    if (e.stone <= 0) {
      sfx('crumble');
      spawnFx('shatter', e.x + e.w / 2, e.y + e.h);
      burst(e.x + e.w / 2, e.y + e.h / 2, '#8a8a7a', 14, 110, 3, 500);
      e.alive = false;
      // Petrified foes return later so stepping stones never run out.
      e.respawn = 5;
    }
    return;
  }
  const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
  const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
  const dx = pcx - ecx, dy = pcy - ecy;
  e.t += dt;
  e.cd -= dt;

  if (e.type === 'skeleton') {
    e.vy = Math.min(e.vy + GRAV_DOWN * dt, MAX_FALL);
    const sees = playerVisible() && Math.abs(dy) < 40;
    if (e.state === 'walk') {
      e.vx = e.face * 30;
      // Turn at ledges and walls
      const aheadX = e.face > 0 ? e.x + e.w + 2 : e.x - 2;
      const below = tileAt(Math.floor(aheadX / T), Math.floor((e.y + e.h + 4) / T));
      if (e.onGround && !(below === TILE.SOLID || below === TILE.ONEWAY || below === TILE.BREAK || below === TILE.CRUMBLE)) e.face *= -1;
      if (e.hitWall) e.face *= -1;
      if (sees && e.cd <= 0) {
        if (e.spear && Math.abs(dx) < 220 && Math.abs(dx) > 40) { e.state = 'windup'; e.t = 0; e.face = Math.sign(dx) || 1; }
        else if (!e.spear && Math.abs(dx) < 64) { e.state = 'windup'; e.t = 0; e.face = Math.sign(dx) || 1; }
      }
    } else if (e.state === 'windup') {
      e.vx = 0;
      if (e.t > 0.45) { e.state = 'attack'; e.t = 0; sfx('shoot'); if (e.spear) spawnProj({ x: ecx + e.face * 10, y: e.y + 10, vx: e.face * 170, vy: -20, grav: 60, r: 4, kind: 'spear', owner: e }); }
    } else if (e.state === 'attack') {
      e.vx = e.spear ? 0 : e.face * 40;
      if (!e.spear) {
        const hb = { x: e.face > 0 ? e.x + e.w : e.x - 26, y: e.y + 8, w: 26, h: 12 };
        if (overlap(hb, P) && playerVisible()) contactHit(hb, e);
      }
      if (e.t > 0.35) { e.state = 'walk'; e.t = 0; e.cd = e.spear ? 1.8 : 1.1; }
    }
    if (e.flash > 0.05) e.vx *= 0.5;
    moveBody(e, dt, false);
    if (e.y > L.pxH + 32) e.alive = false;
  } else if (e.type === 'serpent') {
    // Slithers along its ledge; rears up to spit venom from range, bites up close.
    e.vy = Math.min(e.vy + GRAV_DOWN * dt, MAX_FALL);
    const sees = playerVisible() && Math.abs(dy) < 70;
    if (e.state === 'slither') {
      e.vx = e.face * 22;
      const aheadX = e.face > 0 ? e.x + e.w + 2 : e.x - 2;
      const below = tileAt(Math.floor(aheadX / T), Math.floor((e.y + e.h + 4) / T));
      if (e.onGround && !(below === TILE.SOLID || below === TILE.ONEWAY || below === TILE.BREAK || below === TILE.CRUMBLE)) e.face *= -1;
      if (e.hitWall) e.face *= -1;
      if (sees && e.cd <= 0) {
        if (Math.abs(dx) < 46) { e.state = 'biteWind'; e.t = 0; e.face = Math.sign(dx) || 1; }
        else if (Math.abs(dx) < 190) { e.state = 'rear'; e.t = 0; e.face = Math.sign(dx) || 1; }
      }
    } else if (e.state === 'rear') {
      e.vx = 0;
      if (e.t > 0.55 && !e.spat) {
        e.spat = true; sfx('shoot');
        const tt = 0.8, mx = ecx + e.face * 10, my = e.y - 16;
        spawnProj({ x: mx, y: my, vx: (pcx - mx) / tt, vy: (pcy - my) / tt - 0.5 * 420 * tt, grav: 420, r: 4, kind: 'venom', owner: e });
      }
      if (e.t > 0.95) { e.state = 'slither'; e.t = 0; e.spat = false; e.cd = 1.8; }
    } else if (e.state === 'biteWind') {
      e.vx = 0;
      if (e.t > 0.4) { e.state = 'bite'; e.t = 0; sfx('shoot'); }
    } else if (e.state === 'bite') {
      e.vx = e.face * 70;
      const hb = { x: e.face > 0 ? e.x + e.w : e.x - 16, y: e.y - 8, w: 16, h: 16 };
      if (overlap(hb, P) && playerVisible()) contactHit(hb, e);
      if (e.t > 0.3) { e.state = 'slither'; e.t = 0; e.cd = 1.3; }
    }
    if (e.flash > 0.05) e.vx *= 0.5;
    moveBody(e, dt, false);
    if (e.y > L.pxH + 32) e.alive = false;
  } else if (e.type === 'harpy') {
    if (e.state === 'hover') {
      e.x += (e.hx + Math.sin(e.t * 1.3) * 34 - e.x) * Math.min(1, dt * 2);
      e.y += (e.hy + Math.sin(e.t * 2.6) * 8 - e.y) * Math.min(1, dt * 2);
      e.face = dx > 0 ? 1 : -1;
      if (playerVisible() && e.cd <= 0 && Math.abs(dx) < 140 && dy > -10 && dy < 150) {
        if (e.thrower && Math.random() < 0.55) {
          e.cd = 2.2; sfx('shoot');
          const a = Math.atan2(dy, dx);
          for (const s of [-0.2, 0, 0.2]) spawnProj({ x: ecx, y: ecy, vx: Math.cos(a + s) * 130, vy: Math.sin(a + s) * 130, r: 3, kind: 'feather', owner: e });
        } else {
          e.state = 'dive'; e.t = 0;
          const a = Math.atan2(dy, dx);
          e.vx = Math.cos(a) * 175; e.vy = Math.sin(a) * 175;
        }
      }
    } else if (e.state === 'dive') {
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.t > 0.8 || solidAt(ecx, e.y + e.h + 2)) { e.state = 'return'; e.t = 0; }
    } else if (e.state === 'return') {
      e.x += (e.hx - e.x) * Math.min(1, dt * 2.2);
      e.y += (e.hy - e.y) * Math.min(1, dt * 2.2);
      if (Math.abs(e.y - e.hy) < 4) { e.state = 'hover'; e.cd = 1.5 + Math.random(); }
    }
    if (overlap(e, P) && playerVisible()) contactHit(e, e);
  } else if (e.type === 'shade') {
    const chase = playerVisible() && Math.abs(dx) < 170 && Math.abs(dy) < 120;
    const tx = chase ? e.hx + Math.max(-60, Math.min(60, dx * 0.4)) : e.hx + Math.sin(e.t * 0.7) * 24;
    e.x += (tx - e.x) * Math.min(1, dt * 1.2);
    e.y += (e.hy + Math.sin(e.t * 2) * 6 - e.y) * Math.min(1, dt * 2);
    e.face = dx > 0 ? 1 : -1;
    if (chase && e.cd <= 0) {
      e.cd = 2.4; e.shootT = 0.5; sfx('shoot');
      const a = Math.atan2(dy, dx);
      spawnProj({ x: ecx + e.face * 8, y: ecy - 4, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 4, kind: 'bolt', owner: e });
    }
    e.shootT = (e.shootT || 0) - dt;
    if (overlap(e, P) && playerVisible()) contactHit(e, e);
  } else if (e.type === 'eye') {
    const band = { x: e.face > 0 ? e.x : e.x - 240, y: e.y - 20, w: 240 + e.w, h: 50 };
    const sees = playerVisible() && overlap(band, P) && clearLine(ecx, ecy, pcx, ecy);
    e.alert = sees ? Math.min(1, e.alert + dt * 3) : Math.max(0, e.alert - dt * 2);
    if (sees && e.cd <= 0 && e.alert >= 1) {
      e.cd = 0.75; sfx('shoot');
      spawnProj({ x: ecx + e.face * 8, y: ecy, vx: e.face * 230, vy: 0, r: 3, kind: 'arrow', owner: e });
    }
  }
}

function clearLine(x0, y, x1) {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (let x = a; x < b; x += 8) if (solidAt(x, y)) return false;
  return true;
}

function contactHit(src, e) {
  // Shield blocks frontal contact
  if (P.shielding) {
    const fromRight = (src.x + src.w / 2) > (P.x + P.w / 2);
    if ((fromRight && P.face > 0) || (!fromRight && P.face < 0)) {
      if (P.inv <= 0) {
        sfx('block');
        spawnFx('parry', P.x + P.w / 2 + P.face * 10, P.y + 14, { flip: P.face < 0 });
        P.vx = -P.face * 120;
        P.inv = 0.25;
        if (e && e.type === 'skeleton') e.vx = P.face * 120;
        if (e && e.type === 'harpy' && e.state === 'dive') { e.state = 'return'; e.t = 0; }
      }
      return;
    }
  }
  hurtPlayer(1, src.x + src.w / 2);
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------
export function spawnProj(o) {
  const p = Object.assign({ friendly: false, reflectable: true, dmg: 1, life: 4, grav: 0, r: 3, boss: false }, o);
  projectiles.push(p);
  return p;
}

function circleRect(c, r) {
  const x = Math.max(r.x, Math.min(c.x, r.x + r.w)), y = Math.max(r.y, Math.min(c.y, r.y + r.h));
  return (c.x - x) ** 2 + (c.y - y) ** 2 < c.r * c.r;
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.life -= dt;
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) p.dead = true;
    if (!p.ghost && solidAt(p.x, p.y)) { p.dead = true; burst(p.x, p.y, '#ddd', 4, 60); continue; }
    if (p.kind === 'fire' && Math.random() < 0.5) particle(p.x, p.y, -p.vx * 0.1, -p.vy * 0.1, Math.random() < 0.5 ? '#ffb347' : '#ff5a2a', 0.25, 2);
    if (!p.friendly) {
      const pr = { x: P.x, y: P.y, w: P.w, h: P.h };
      if (P.dead || !circleRect(p, { x: pr.x - 4, y: pr.y, w: pr.w + 8, h: pr.h })) continue;
      if (P.shielding && p.reflectable) {
        const fromRight = p.vx < 0 || (Math.abs(p.vx) < 20 && p.x > P.x + P.w / 2);
        if ((fromRight && P.face > 0) || (!fromRight && P.face < 0)) { reflect(p); continue; }
      }
      if (!circleRect(p, pr)) continue;
      if (P.invisible && !p.boss) continue;
      if (hurtPlayer(p.dmg, p.x)) p.dead = true;
    } else {
      for (const e of enemies) {
        if (e.alive && !e.dying && e.type !== 'eye' && !e.stone && e !== p.owner && circleRect(p, e)) {
          damageEnemy(e, 2, Math.sign(p.vx)); p.dead = true; break;
        }
      }
      if (!p.dead && boss && !boss.dead && boss.onReflect) {
        for (const hb of boss.hurtboxes()) {
          if (circleRect(p, hb)) { p.dead = true; boss.onReflect(p); break; }
        }
      }
    }
  }
  projectiles = projectiles.filter((p) => !p.dead);
}

function reflect(p) {
  sfx('reflect');
  spawnFx('parry', P.x + P.w / 2 + P.face * 10, P.y + 14, { flip: P.face < 0 });
  burst(p.x, p.y, '#bfe9ff', 8, 90, 2, 0);
  const speed = Math.hypot(p.vx, p.vy) * 1.35 + 40;
  let tx = p.x - Math.sign(p.vx || 1) * 100, ty = p.y;
  if (p.owner) {
    const o = p.owner;
    const c = o.center ? o.center() : { x: o.x + (o.w || 0) / 2, y: o.y + (o.h || 0) / 2 };
    tx = c.x; ty = c.y;
  }
  const a = Math.atan2(ty - p.y, tx - p.x);
  p.vx = Math.cos(a) * speed;
  p.vy = Math.sin(a) * speed;
  p.grav = 0;
  p.friendly = true;
  p.life = 2;
  p.dmg = 2;
  P.vx = -P.face * 40;
}

// ---------------------------------------------------------------------------
// Pickups, props, altars, signs, gates
// ---------------------------------------------------------------------------
function updatePickups(dt) {
  for (const k of pickups) {
    k.t += dt;
    if (k.phys) {
      k.vy += 600 * dt;
      k.x += k.vx * dt;
      if (solidAt(k.x, k.y)) { k.x -= k.vx * dt; k.vx = -k.vx * 0.5; }
      k.y += k.vy * dt;
      if (k.vy > 0 && (solidAt(k.x, k.y + 4) || onewayAt(k.x, k.y + 4))) { k.y = Math.floor((k.y + 4) / T) * T - 4; k.vy = -k.vy * 0.35; k.vx *= 0.7; if (Math.abs(k.vy) < 30) k.vy = 0; }
      k.life -= dt;
      if (k.life <= 0 || k.y > L.pxH + 20) k.gone = true;
    }
    const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
    if (k.phys && k.t > 0.3) {
      const d = Math.hypot(pcx - k.x, pcy - k.y);
      if (d < 36) { k.x += (pcx - k.x) * dt * 6; k.y += (pcy - k.y) * dt * 6; }
    }
    if (!P.dead && Math.abs(pcx - k.x) < 11 && Math.abs(pcy - k.y) < 20 && (!k.phys || k.t > 0.2)) {
      collect(k);
      k.gone = true;
    }
  }
  pickups = pickups.filter((k) => !k.gone);
}

function onewayAt(x, y) { return tileAt(Math.floor(x / T), Math.floor(y / T)) === TILE.ONEWAY; }

function collect(k) {
  switch (k.kind) {
    case 'coin': run.drachmas += 5; sfx('coin'); particle(k.x, k.y, 0, -30, '#ffe08a', 0.3, 2); break;
    case 'gem': run.drachmas += 50; sfx('gem'); floatText(k.x, k.y - 6, '+50'); break;
    case 'nectar':
      sfx('heal');
      if (has('kibisis') && (run.nectar < 3 || P.hp >= MAX_HP)) {
        if (run.nectar < 3) { run.nectar++; floatText(k.x, k.y - 6, 'NECTAR', '#ff9ac0'); }
        else { P.hp = Math.min(MAX_HP, P.hp + 3); floatText(k.x, k.y - 6, '+3', '#ff9ac0'); }
      } else { P.hp = Math.min(MAX_HP, P.hp + 3); floatText(k.x, k.y - 6, '+3', '#ff9ac0'); }
      break;
    case 'draught':
      sfx('heal');
      if (has('head') || has('helm')) {
        run.charges = Math.min(3, run.charges + 1); run.helm = 100;
        floatText(k.x, k.y - 6, 'POWER', '#7dffb0');
      } else { run.drachmas += 50; floatText(k.x, k.y - 6, '+50'); }
      break;
  }
}

function updateWorldObjects(dt) {
  // Moving slabs
  for (const m of L.movers) {
    m.ph += dt * 1.1;
    const nx = m.axis === 'x' ? m.ox + Math.sin(m.ph) * m.amp : m.ox;
    const ny = m.axis === 'y' ? m.oy + Math.sin(m.ph) * m.amp : m.oy;
    m.dx = nx - m.x; m.dy = ny - m.y;
    m.x = nx; m.y = ny;
  }
  // Dynamic platforms: movers + stone foes
  plats = L.movers.map((m) => ({ x: m.x, y: m.y, w: m.w, h: m.h, dx: m.dx, dy: m.dy, solid: false, ref: m }));
  for (const e of enemies) if (e.alive && e.stone > 0) plats.push({ x: e.x - 1, y: e.y, w: e.w + 2, h: e.h, dx: 0, dy: 0, solid: true, ref: e });
  // Keep the player riding the object they stood on last frame.
  if (P.ride) P.ride = plats.find((s) => s.ref === P.ride.ref) || null;

  // Altars
  for (const a of L.altars) {
    if (overlap(a, P) && !P.dead) {
      if (!a.lit) {
        a.lit = true;
        L.checkpoint = { x: a.x + 2, y: a.y + a.h - P.h };
        sfx('altar');
        banner('ALTAR KINDLED');
        burst(a.x + 8, a.y, '#7fd0ff', 20, 120, 2, -80);
        burst(a.x + 8, a.y, '#ffd34a', 14, 100, 2, -80);
      }
      if (P.altarCD <= 0 && (P.hp < MAX_HP || run.charges < 3)) {
        P.hp = MAX_HP; run.charges = 3; run.helm = 100; P.altarCD = 2;
        sfx('heal'); floatText(a.x + 8, a.y - 6, 'RESTORED', '#9fe4ff'); spawnFx('heal', P.x + 6, P.y + P.h);
      }
    }
  }
  // Signs
  signText = null;
  for (const s of L.signs) if (Math.abs(s.x + 7 - (P.x + 6)) < 30 && Math.abs(s.y - P.y) < 40) signText = s.text;
  signAlpha += ((signText ? 1 : 0) - signAlpha) * Math.min(1, 8 * dt);
  if (signText) L.lastSign = signText;
  // Gate
  for (const g of L.gates) {
    if (!P.dead && overlap(g, P) && !L.gateUsed) { L.gateUsed = true; sfx('gate'); events.push({ type: 'gate' }); }
  }
  // Relic altar after a boss
  if (L.relicOrb && !L.relicOrb.taken) {
    const o = L.relicOrb;
    o.t += dt;
    o.y = Math.min(o.ty, o.y + 40 * dt);
    if (Math.hypot(P.x + 6 - o.x, P.y + 16 - o.y) < 18 && !P.dead) {
      o.taken = true;
      sfx('relic');
      screenFlash(0.6);
      events.push({ type: 'relic', relic: o.relic });
    }
  }
  // Respawning petrified foes
  for (const e of enemies) {
    if (!e.alive && e.respawn !== undefined && !e.summoned) {
      e.respawn -= dt;
      if (e.respawn <= 0) {
        const n = makeEnemy(e.spawnChar, e.sx, e.sy);
        Object.assign(e, n);
        e.respawn = undefined;
        burst(e.x + e.w / 2, e.y + e.h / 2, '#b48aff', 8, 60);
      }
    }
  }
  enemies = enemies.filter((e) => e.alive || e.respawn !== undefined);
}

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------
export function update(dt) {
  if (!L) return;
  run.time += dt;
  L.t += dt;
  if (hitstop > 0) { hitstop -= dt; updateParticles(dt * 0.3); return; }
  updateWorldObjects(dt);
  updatePlayer(dt);
  updateCrumble(dt);
  for (const e of enemies) if (e.alive) updateEnemy(e, dt);
  if (boss) {
    boss.update(dt);
    if (boss.inv > 0) boss.inv -= dt;
    if (boss.flash > 0) boss.flash -= dt;
    if (!boss.dead && !P.dead && P.petrified <= 0) {
      for (const hb of boss.hitboxes()) {
        if (overlap(hb, P)) { contactHit(hb, null); break; }
      }
    }
    if (boss.dead && boss.finished && !L.bossCleared) {
      L.bossCleared = true;
      if (L.world.relic) {
        L.relicOrb = { relic: L.world.relic, x: VW / 2, y: 40, ty: 150, t: 0, taken: false };
      } else {
        events.push({ type: 'victory' });
      }
    }
  }
  if (L.andromeda) L.andromeda.t += dt;
  updateProjectiles(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateFx(dt);
  updateCamera(dt);
  if (bannerT > 0) bannerT -= dt;
  flash = Math.max(0, flash - dt * 2);
  if (L.theme.rain) updateWeather(dt);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.life -= dt;
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'feather') p.vx *= 0.96;
  }
  particles = particles.filter((p) => p.life > 0);
  for (const t of texts) { t.t -= dt; t.y -= 20 * dt; }
  texts = texts.filter((t) => t.t > 0);
}

function updateWeather(dt) {
  lightningTimer -= dt;
  lightning = Math.max(0, lightning - dt * 2.5);
  if (lightningTimer <= 0) {
    lightning = 1; lightningTimer = 5 + Math.random() * 8; sfx('thunder');
    spawnFx('lightning', cam.x + 40 + Math.random() * (VW - 80), 190 + Math.random() * 20, { bg: true, flip: Math.random() < 0.5 });
  }
  while (rain.length < 90) rain.push({ x: Math.random() * (VW + 100), y: Math.random() * VH, s: 300 + Math.random() * 120 });
  for (const r of rain) { r.y += r.s * dt; r.x -= r.s * 0.35 * dt; if (r.y > VH) { r.y = -10; r.x = Math.random() * (VW + 100); } }
}

function snapCamera() {
  cam.x = Math.max(0, Math.min(L.pxW - VW, P.x - VW / 2));
  cam.y = Math.max(0, Math.min(L.pxH - VH, P.y - VH / 2));
  cam.look = 0;
}

function updateCamera(dt) {
  cam.look += (P.face * 36 - cam.look) * Math.min(1, dt * 2);
  const tx = Math.max(0, Math.min(L.pxW - VW, P.x + P.w / 2 - VW / 2 + cam.look));
  const ty = Math.max(0, Math.min(L.pxH - VH, P.y - VH / 2));
  cam.x += (tx - cam.x) * Math.min(1, dt * 7);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  cam.shake = Math.max(0, cam.shake - dt * 18);
}

// API handed to bosses
export const api = {
  get P() { return P; }, get L() { return L; }, run, has, moveBody, spawnProj, hurtPlayer, burst, particle, shake, sfx,
  spawnEnemy, countEnemies, floatText, banner, screenFlash, solidAt, dropPickup, overlap, T, VW, VH,
  addHazard: (h) => L.hazards.push(h),
  bossDamage: (d, k) => bossDamage(d, k),
  spawnFx,
  setHitstop: (t) => { hitstop = Math.max(hitstop, t); },
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Generated tile art: pick a variant of a role ('top', 'fill', 'slab'...) and draw it.
function tileIndex(role, v) {
  const list = L.tileset && L.tileset.roles[role];
  return list && list.length ? list[Math.floor(v * list.length) % list.length] : -1;
}
function drawTileArt(c, role, v, x, y, h = T) {
  const i = tileIndex(role, v);
  if (i >= 0) c.drawImage(L.tileset.img, i * T, 0, T, h, x, y, T, h);
  return i >= 0;
}
function hasRole(role) { return tileIndex(role, 0) >= 0; }

function drawSolidArt(c, tx, ty) {
  const x = tx * T, y = ty * T;
  const openL = !isGround(tx - 1, ty), openR = !isGround(tx + 1, ty);
  const v = hash(tx * 3, ty * 7);
  const fill = openL && !openR && hasRole('fillL') ? 'fillL' : openR && !openL && hasRole('fillR') ? 'fillR' : 'fill';
  if (ty > 0 && !isGround(tx, ty - 1)) {
    // Surface piece; when there is ground beneath, lay fill first so cut-out ends never show sky.
    if (ty + 1 >= L.h || isGround(tx, ty + 1)) drawTileArt(c, fill, v, x, y);
    const top = openL && !openR && hasRole('topL') ? 'topL' : openR && !openL && hasRole('topR') ? 'topR' : 'top';
    drawTileArt(c, top, v, x, y);
  } else drawTileArt(c, fill, v, x, y);
  if (ty + 1 < L.h && !isGround(tx, ty + 1)) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, y + T - 2, T, 2); }
}

function slabRole(tx, ty, kind) {
  const l = tileAt(tx - 1, ty) !== kind, r = tileAt(tx + 1, ty) !== kind;
  if (l && !r && hasRole('slabL')) return 'slabL';
  if (r && !l && hasRole('slabR')) return 'slabR';
  return 'slab';
}

// Small rocks, tufts and flowers scattered on open ground (no collision).
function drawSurfaceDecor(c) {
  const ts = L.tileset;
  if (!ts || !ts.decor.length) return;
  for (let ty = 1; ty < L.h; ty++) for (let tx = 1; tx < L.w - 1; tx++) {
    if (tileAt(tx, ty) !== TILE.SOLID || tileAt(tx, ty - 1) !== TILE.EMPTY || hash(tx * 13, ty * 5) > 0.16) continue;
    if (!isGround(tx - 1, ty) || !isGround(tx + 1, ty)) continue;
    const [dx, dy, dw, dh] = ts.decor[Math.floor(hash(tx, ty * 11) * ts.decor.length) % ts.decor.length];
    const ox = Math.round((hash(tx * 7, ty) - 0.5) * 6);
    c.drawImage(ts.img, dx, dy, dw, dh, tx * T + 8 - Math.floor(dw / 2) + ox, ty * T - dh + 2, dw, dh);
  }
}

function prerenderTiles() {
  const c = makeCanvas(L.pxW, L.pxH);
  const x = c.getContext('2d');
  const th = L.theme;
  // Decor first so it sits behind the ground
  for (const d of L.decor) drawDecor(x, d);
  if (L.tileset) {
    for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) {
      const t = L.tiles[ty * L.w + tx];
      if (t === TILE.SOLID) drawSolidArt(x, tx, ty);
      else if (t === TILE.SPIKE) drawTileArt(x, 'spike', hash(tx, ty * 3), tx * T, ty * T);
      else if (t === TILE.ONEWAY) {
        drawTileArt(x, slabRole(tx, ty, TILE.ONEWAY), hash(tx * 5, ty), tx * T, ty * T, 8);
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(tx * T, ty * T + 8, T, 2);
      }
    }
    drawSurfaceDecor(x);
    return c;
  }
  for (let ty = 0; ty < L.h; ty++) {
    for (let tx = 0; tx < L.w; tx++) {
      const t = L.tiles[ty * L.w + tx];
      if (t === TILE.SOLID) drawSolid(x, tx, ty, th);
      else if (t === TILE.SPIKE) drawSpike(x, tx, ty, th);
    }
  }
  // One-way slabs as runs
  const marble = images.env_marble_platform;
  for (let ty = 0; ty < L.h; ty++) {
    let tx = 0;
    while (tx < L.w) {
      if (L.tiles[ty * L.w + tx] === TILE.ONEWAY) {
        let e = tx;
        while (e < L.w && L.tiles[ty * L.w + e] === TILE.ONEWAY) e++;
        const px = tx * T, py = ty * T, w = (e - tx) * T;
        if (marble) {
          x.save();
          x.beginPath(); x.rect(px, py, w, 9); x.clip();
          for (let k = 0; k < w; k += 29) x.drawImage(marble, px + k, py, 29, 9);
          x.restore();
        } else { x.fillStyle = '#eee'; x.fillRect(px, py, w, 8); }
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px, py + 9, w, 2);
        tx = e;
      } else tx++;
    }
  }
  return c;
}

function isGround(tx, ty) {
  const t = tileAt(tx, ty);
  return t === TILE.SOLID || t === TILE.SPIKE;
}

function drawSolid(c, tx, ty, th) {
  const x = tx * T, y = ty * T;
  c.fillStyle = th.body; c.fillRect(x, y, T, T);
  if (th.brick) {
    c.fillStyle = th.dark;
    const off = (ty % 2) * 8;
    c.fillRect(x, y + 7, T, 1);
    c.fillRect(x + ((off + 4) % 16), y, 1, 7);
    c.fillRect(x + ((off + 12) % 16), y + 8, 1, 8);
    c.fillStyle = th.light;
    c.fillRect(x, y, T, 1); c.fillRect(x, y + 8, T, 1);
  } else {
    for (let i = 0; i < 5; i++) {
      const r = hash(tx * 7 + i, ty * 13 + i);
      const px = x + Math.floor(hash(tx + i * 3, ty) * 14), py = y + Math.floor(hash(tx, ty + i * 5) * 14);
      c.fillStyle = r < 0.5 ? th.dark : th.light;
      c.fillRect(px, py, r < 0.8 ? 2 : 3, 2);
    }
    if (th.ember && hash(tx, ty * 3) < 0.12) { c.fillStyle = th.ember; c.fillRect(x + 4, y + 9, 5, 1); c.fillRect(x + 8, y + 10, 3, 1); }
  }
  if (!isGround(tx - 1, ty)) { c.fillStyle = th.dark; c.fillRect(x, y, 1, T); }
  if (!isGround(tx + 1, ty)) { c.fillStyle = th.dark; c.fillRect(x + T - 1, y, 1, T); }
  if (!isGround(tx, ty + 1) && ty + 1 < L.h) { c.fillStyle = th.dark; c.fillRect(x, y + T - 2, T, 2); }
  if (!isGround(tx, ty - 1) && ty > 0 || (ty === 0 ? false : false)) {
    c.fillStyle = th.top; c.fillRect(x, y, T, 5);
    c.fillStyle = th.topHi; c.fillRect(x, y, T, 1);
    if (th.brick) { c.fillStyle = th.dark; for (let i = 2; i < T; i += 4) c.fillRect(x + i, y + 2, 2, 1); }
    else {
      c.fillStyle = th.top;
      for (let i = 0; i < T; i += 3) if (hash(tx * 5 + i, ty) < 0.6) c.fillRect(x + i, y + 5, 2, 1 + Math.floor(hash(i, tx) * 3));
    }
    if (th.flowers && hash(tx, ty * 7) < 0.3) { c.fillStyle = hash(tx, ty) < 0.5 ? '#ffe36a' : '#ff8ab0'; c.fillRect(x + 6, y - 2, 2, 2); }
    if (th.ember && hash(tx * 3, ty) < 0.25) { c.fillStyle = th.ember; c.fillRect(x + 3 + Math.floor(hash(tx, 1) * 9), y - 1, 2, 1); }
  }
}

function drawSpike(c, tx, ty, th) {
  const x = tx * T, y = ty * T;
  c.fillStyle = th.dark; c.fillRect(x, y + 12, T, 4);
  for (let i = 0; i < 4; i++) {
    const sx = x + i * 4;
    c.fillStyle = '#b07a2c';
    c.beginPath(); c.moveTo(sx, y + 12); c.lineTo(sx + 2, y + 3); c.lineTo(sx + 4, y + 12); c.fill();
    c.fillStyle = '#f2c86a'; c.fillRect(sx + 2, y + 4, 1, 6);
  }
}

function drawDecor(c, d) {
  const { x, y } = d;
  if (d.kind === 'y') {
    const apple = L.theme.mid === 'apples';
    c.fillStyle = '#5a3b22'; c.fillRect(x - 2, y - 22, 4, 22); c.fillRect(x - 5, y - 16, 3, 2); c.fillRect(x + 2, y - 19, 4, 2);
    const leaf = L.theme.flowers ? '#2f7a3a' : '#6f8a3c', hi = L.theme.flowers ? '#4cab4a' : '#9ab55a';
    for (const [ox, oy, r] of [[-8, -26, 8], [6, -28, 9], [-1, -36, 9], [10, -20, 6], [-11, -18, 6]]) {
      c.fillStyle = leaf; c.beginPath(); c.arc(x + ox, y + oy, r, 0, 7); c.fill();
      c.fillStyle = hi; c.fillRect(x + ox - 3, y + oy - r + 2, 4, 2);
    }
    if (apple) { c.fillStyle = '#ffd34a'; for (const [ox, oy] of [[-6, -24], [5, -31], [9, -20], [-2, -38]]) c.fillRect(x + ox, y + oy, 3, 3); }
  } else if (d.kind === 'i') {
    c.fillStyle = '#d8d2c4'; c.fillRect(x - 6, y - 52, 12, 52);
    c.fillStyle = '#b8b0a0'; for (let i = -4; i <= 4; i += 3) c.fillRect(x + i, y - 50, 1, 48);
    c.fillStyle = '#ece8de'; c.fillRect(x - 9, y - 56, 18, 5); c.fillRect(x - 8, y - 4, 16, 4);
    c.fillStyle = '#a89c86'; c.fillRect(x - 9, y - 52, 18, 1);
  } else if (d.kind === 'S') {
    drawSprite(c, 'p_idle', 0, x, y, hash(x, y) < 0.5, { variant: 'stone' });
  } else if (d.kind === 'f') {
    c.fillStyle = '#5a4a3a'; c.fillRect(x - 1, y - 20, 3, 20);
  }
}

function skyColour(img) {
  if (img._sky) return img._sky;
  const c = makeCanvas(1, 1), x = c.getContext('2d');
  x.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return (img._sky = `rgb(${d[0]},${d[1]},${d[2]})`);
}

// Layered parallax art, bottom-aligned at native pixel size and tiled sideways.
function drawLayers(ctx, set) {
  ctx.fillStyle = skyColour(set[0].img);
  ctx.fillRect(0, 0, VW, VH);
  for (const { img, speed } of set) {
    const w = img.width, y = VH - img.height;
    let x = -Math.floor((cam.x * speed) % w);
    if (x > 0) x -= w;
    for (; x < VW; x += w) ctx.drawImage(img, x, y);
  }
}

function drawBackground(ctx) {
  const th = L.theme;
  const set = layers[(L.isArena && th.arenaLayers) || th.layers];
  if (set) { drawLayers(ctx, set); return; }
  ctx.fillStyle = th.sky; ctx.fillRect(0, 0, VW, VH);
  const bg = getBackground(th.bg, th.filter, th.crop);
  if (bg) {
    const w = bg.width;
    const off = -((cam.x * 0.12) % w);
    ctx.drawImage(bg, Math.floor(off), 0);
    if (off + w < VW) ctx.drawImage(bg, Math.floor(off + w), 0);
  }
  // Mid parallax silhouettes
  const mx = cam.x * 0.35;
  ctx.save();
  if (th.mid === 'columns') {
    ctx.fillStyle = 'rgba(120,80,50,0.35)';
    for (let i = -1; i < 8; i++) {
      const bx = Math.floor(i * 90 - (mx % 90));
      ctx.fillRect(bx, 120, 10, 110); ctx.fillRect(bx - 3, 116, 16, 5);
      if (i % 3 === 0) { ctx.beginPath(); ctx.moveTo(bx - 10, 116); ctx.lineTo(bx + 50, 92); ctx.lineTo(bx + 110, 116); ctx.fill(); }
    }
  } else if (th.mid === 'stalactites') {
    ctx.fillStyle = th.mid && th.ember === '#52ff8a' ? 'rgba(10,20,14,0.6)' : 'rgba(20,8,16,0.6)';
    for (let i = -1; i < 14; i++) {
      const bx = Math.floor(i * 40 - (mx % 40));
      const h = 20 + hash(i + Math.floor(mx / 40), 3) * 40;
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 10, h); ctx.lineTo(bx + 20, 0); ctx.fill();
    }
  } else if (th.mid === 'peaks') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = -1; i < 6; i++) {
      const bx = Math.floor(i * 140 - ((cam.x * 0.25) % 140));
      ctx.beginPath(); ctx.ellipse(bx + 40, 60 + (i % 2) * 20, 50, 10, 0, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

function drawDynamicTiles(ctx, x0, x1) {
  const th = L.theme;
  for (let ty = 0; ty < L.h; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      const x = tx * T, y = ty * T;
      if (t === TILE.BREAK && L.tileset && hasRole('break')) {
        drawTileArt(ctx, 'break', hash(tx, ty), x, y);
      } else if (t === TILE.CRUMBLE && L.tileset && hasRole('crumble')) {
        const s = crumbleState(tx, ty);
        if (s && s.gone) continue;
        drawTileArt(ctx, 'crumble', 0, x + (s ? Math.round((Math.random() - 0.5) * 2) : 0), y, 8);
      } else if (t === TILE.BREAK) {
        ctx.fillStyle = th.light; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = th.dark; ctx.fillRect(x, y + T - 2, T, 2); ctx.fillRect(x + T - 2, y, 2, T);
        ctx.fillStyle = th.body;
        ctx.fillRect(x + 3, y + 4, 5, 1); ctx.fillRect(x + 7, y + 5, 1, 4); ctx.fillRect(x + 8, y + 9, 4, 1); ctx.fillRect(x + 4, y + 11, 1, 3);
      } else if (t === TILE.CRUMBLE) {
        const s = crumbleState(tx, ty);
        if (s && s.gone) continue;
        const sh = s ? (Math.random() - 0.5) * 2 : 0;
        ctx.fillStyle = th.dark; ctx.fillRect(x + sh, y, T, 10);
        ctx.fillStyle = th.light; ctx.fillRect(x + sh, y, T, 3);
        ctx.fillStyle = th.body; ctx.fillRect(x + 1 + sh, y + 3, T - 2, 5);
        ctx.fillStyle = th.dark; ctx.fillRect(x + 5 + sh, y + 3, 1, 5); ctx.fillRect(x + 11 + sh, y + 4, 1, 4);
      } else if (t === TILE.SPECTRAL) {
        const a = P.invisible ? 0.2 : 0.55 + Math.sin(L.t * 4 + ty) * 0.15;
        ctx.fillStyle = `rgba(150,110,255,${a})`; ctx.fillRect(x + 2, y, T - 4, T);
        ctx.fillStyle = `rgba(230,210,255,${a})`;
        ctx.fillRect(x + 4 + Math.floor(Math.sin(L.t * 3 + ty * 2) * 3 + 3), y, 1, T);
      }
    }
  }
}

function drawLiquid(ctx, x0, x1) {
  const th = L.theme;
  const [deep, foam] = th.liquid || ['#123', '#8cf'];
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = 0; ty < L.h; ty++) {
      if (tileAt(tx, ty) !== TILE.LIQUID) continue;
      const x = tx * T, y = ty * T;
      const top = tileAt(tx, ty - 1) !== TILE.LIQUID;
      ctx.fillStyle = deep; ctx.globalAlpha = 0.88;
      ctx.fillRect(x, y + (top ? 3 : 0), T, T - (top ? 3 : 0));
      ctx.globalAlpha = 1;
      if (top) {
        ctx.fillStyle = foam;
        for (let i = 0; i < T; i += 2) {
          const wy = Math.round(Math.sin((x + i) * 0.15 + L.t * 3) * 1.5);
          ctx.fillRect(x + i, y + 3 + wy, 2, 1);
        }
        ctx.globalAlpha = 0.4; ctx.fillRect(x, y + 6 + Math.round(Math.sin(x * 0.1 + L.t * 2) * 2), T, 1); ctx.globalAlpha = 1;
      }
    }
  }
}

// Picks Perseus's animation (assets/images/perseus2, built by tools/build-perseus.js).
function playerPose(p) {
  const harpe = has('harpe');
  // Harpe-carrying versions of the movement poses, when built.
  const hk = (k) => (harpe && sprites[k + '_harpe'] ? k + '_harpe' : k);
  const prog = (t, total) => Math.max(0, Math.min(0.999, 1 - t / total));
  if (p.dead) return [hk('p_death'), Math.min(3, p.deadT * 4)];
  if (p.hurtT > 0) return [hk('p_hurt'), p.hurtT > 0.14 ? 0 : 1];
  if (p.attackT > 0) {
    const k = prog(p.attackT, ATTACK_TIME);
    if (harpe) return [p.attackUp ? 'p_harpe_up' : 'p_harpe', k * 4];
    if (p.attackUp) return ['p_slash_up', k * 4];
    return p.onGround ? ['p_attack', k * 4] : ['p_slash_air', k * 3];
  }
  if (p.gazeT > 0) return ['p_gaze', prog(p.gazeT, 0.45) * 4];
  if (p.drinkT > 0) return ['p_nectar', prog(p.drinkT, 0.6) * 4];
  if (p.shielding) return ['p_shield', Math.abs(p.vx) > 10 ? p.anim * 8 : 0];
  if (!p.onGround) {
    if (p.pogo) return p.bounceT > 0 ? ['p_pogo_bounce', p.bounceT > 0.12 ? 1 : 0] : ['p_pogo', p.anim * 6];
    if (p.gliding) return ['p_glide', p.anim * 8];
    if (p.djT > 0) return has('sandals') ? ['p_wing_jump', prog(p.djT, 0.35) * 3] : [hk('p_flip'), prog(p.djT, 0.35) * 4];
    return [hk('p_jump'), p.vy < -150 ? 2 : p.vy < 60 ? 3 : 4];
  }
  if (p.landT > 0) return [hk('p_jump'), 5];
  if (Math.abs(p.vx) > 10) return [hk('p_run'), p.anim * 14];
  return [hk('p_idle'), p.anim * 5];
}

function drawPlayer(ctx) {
  const p = P;
  if (p.inv > 0 && !p.dead && Math.floor(p.inv * 20) % 2 === 0 && p.petrified <= 0) return;
  const fx = p.x + p.w / 2, fy = p.y + p.h + 1;
  const [key, frame] = playerPose(p);
  const opt = {};
  if (p.petrified > 0) opt.variant = 'stone';
  if (p.invisible) opt.alpha = 0.3 + Math.sin(L.t * 12) * 0.08;
  drawSprite(ctx, key, frame, fx, fy, p.face < 0, opt);
  // Gorgon gaze beam
  if (p.gazeT > 0 && p.gazeBox) {
    const b = p.gazeBox, a = p.gazeT / 0.45;
    const g = ctx.createLinearGradient(p.face > 0 ? b.x : b.x + b.w, 0, p.face > 0 ? b.x + b.w : b.x, 0);
    g.addColorStop(0, `rgba(90,255,140,${0.7 * a})`); g.addColorStop(1, 'rgba(90,255,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    const ox = p.face > 0 ? b.x : b.x + b.w, ex = p.face > 0 ? b.x + b.w : b.x;
    ctx.moveTo(ox, p.y + 6); ctx.lineTo(ex, b.y); ctx.lineTo(ex, b.y + b.h); ctx.lineTo(ox, p.y + 14); ctx.fill();
  }
}

function drawEnemy(ctx, e) {
  const fx = e.x + e.w / 2;
  const opt = {};
  if (e.stone > 0) { opt.variant = 'stone'; if (e.stone < 2 && Math.floor(e.stone * 10) % 2) opt.alpha = 0.6; }
  else if (e.flash > 0) opt.variant = 'white';
  if (e.dying > 0) opt.alpha = Math.min(1, e.dying * 2);
  const coast = L.theme.rain;
  if (e.type === 'skeleton') {
    const pre = e.spear ? 'sk2_' : 'sk_';
    let key = pre + 'walk', f = e.anim * 14;
    if (e.state === 'windup') { key = pre + 'idle'; f = e.anim * 8; }
    if (e.state === 'attack') { key = pre + 'attack'; f = 4 + (e.t / 0.35) * 10; }
    if (e.dying > 0) { key = 'sk_death'; f = (0.5 - e.dying) * 30; }
    if (e.stone > 0) f = 0;
    if (e.state === 'windup' && e.stone <= 0 && Math.floor(e.t * 16) % 2) opt.variant = 'white';
    drawSprite(ctx, key, f, fx, e.y + e.h + 2, e.face < 0, opt);
  } else if (e.type === 'harpy' && coast && sprites.si_fly) {
    // Sirens replace the harpies on the coast of Joppa.
    const key = e.state === 'dive' ? 'si_dive' : 'si_fly';
    drawSprite(ctx, key, e.stone > 0 ? 0 : e.anim * (e.state === 'dive' ? 6 : 10), fx, e.y + e.h + 12, e.face < 0, opt);
  } else if (e.type === 'serpent') {
    let key = 'sn_slither', f = e.anim * 8;
    if (e.state === 'rear') { key = 'sn_spit'; f = Math.min(3, (e.t / 0.95) * 4); }
    else if (e.state === 'biteWind') { key = 'sn_spit'; f = 1; }
    else if (e.state === 'bite') { key = 'sn_bite'; f = 1 + Math.min(2, (e.t / 0.3) * 3); }
    if (e.dying > 0) { key = 'sn_die'; f = e.dying > 0.3 ? 0 : 1; }
    if (e.stone > 0) { key = 'sn_slither'; f = 0; }
    if (e.state === 'biteWind' && e.stone <= 0 && Math.floor(e.t * 16) % 2) opt.variant = 'white';
    drawSprite(ctx, key, f, fx, e.y + e.h + 2, e.face < 0, opt);
  } else if (e.type === 'harpy') {
    const pre = coast ? 'hp2_' : 'hp_';
    const key = e.state === 'dive' ? pre + 'dive' : pre + 'fly';
    drawSprite(ctx, key, e.stone > 0 ? 0 : e.anim * 16, fx, e.y + e.h + 10, e.face < 0, opt);
  } else if (e.type === 'shade') {
    const key = e.shootT > 0 ? 'sh_attack' : 'sh_walk';
    if (e.stone <= 0 && opt.alpha === undefined) opt.alpha = 0.85;
    drawSprite(ctx, key, e.stone > 0 ? 0 : e.anim * 12, fx, e.y + e.h + 6, e.face < 0, opt);
  } else if (e.type === 'eye') {
    const x = e.x, y = e.y;
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 1, y - 4, e.w + 2, e.h + 8);
    ctx.fillStyle = '#4a4a56'; ctx.fillRect(x, y - 3, e.w, 2);
    ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.ellipse(x + 7, y + 7, 6, 4, 0, 0, 7); ctx.fill();
    const red = e.alert;
    ctx.fillStyle = `rgb(${120 + red * 135},${200 - red * 160},${120 - red * 80})`;
    ctx.fillRect(x + 6 + e.face * 2, y + 5, 3, 4);
    if (e.alert > 0) {
      ctx.fillStyle = `rgba(255,80,60,${0.12 * e.alert})`;
      const bx = e.face > 0 ? x + e.w : x - 240;
      ctx.fillRect(bx, y - 18, 240, 48);
    } else {
      ctx.fillStyle = 'rgba(140,255,170,0.06)';
      ctx.fillRect(e.face > 0 ? x + e.w : x - 240, y - 18, 240, 48);
    }
  }
}

function drawProjectile(ctx, p) {
  const x = Math.round(p.x), y = Math.round(p.y);
  const a = Math.atan2(p.vy, p.vx);
  ctx.save();
  ctx.translate(x, y);
  if (p.friendly) { ctx.fillStyle = 'rgba(190,240,255,0.5)'; ctx.beginPath(); ctx.arc(0, 0, p.r + 3, 0, 7); ctx.fill(); }
  switch (p.kind) {
    case 'spear': case 'arrow':
      ctx.rotate(a);
      ctx.fillStyle = p.kind === 'arrow' ? '#cfc8ff' : '#8a6a3a'; ctx.fillRect(-10, -1, 16, 2);
      ctx.fillStyle = '#e8eef4'; ctx.fillRect(6, -2, 4, 4);
      break;
    case 'feather':
      ctx.rotate(a);
      ctx.fillStyle = '#6a4ac0'; ctx.fillRect(-5, -1, 10, 3); ctx.fillStyle = '#c0a8ff'; ctx.fillRect(-4, 0, 8, 1);
      break;
    case 'bolt':
      ctx.fillStyle = '#7a4aff'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#e0d0ff'; ctx.fillRect(-1, -1, 2, 2);
      break;
    case 'fire':
      ctx.fillStyle = '#ff5a1a'; ctx.beginPath(); ctx.arc(0, 0, p.r + 1, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd04a'; ctx.beginPath(); ctx.arc(0, 0, p.r - 1, 0, 7); ctx.fill();
      break;
    case 'venom':
      if (sprites.sn_glob) { drawSprite(ctx, 'sn_glob', 0, 0, 4, p.vx < 0, {}); break; }
      ctx.fillStyle = '#5aff6a'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a6a2a'; ctx.fillRect(-1, -1, 2, 2);
      break;
    case 'water':
      ctx.fillStyle = '#4ab0ff'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#d8f2ff'; ctx.fillRect(-2, -2, 2, 2);
      break;
    case 'bronze':
      ctx.rotate(a);
      ctx.fillStyle = '#d99a3a'; ctx.fillRect(-5, -2, 10, 4); ctx.fillStyle = '#ffe0a0'; ctx.fillRect(-4, -1, 7, 1);
      break;
    case 'wave':
      ctx.fillStyle = 'rgba(70,150,230,0.85)'; ctx.fillRect(-16, -p.r, 32, p.r * 2);
      ctx.fillStyle = '#e6f6ff';
      for (let i = -16; i < 16; i += 4) ctx.fillRect(i, -p.r - 2 + Math.round(Math.sin(i * 0.5 + L.t * 10) * 2), 3, 3);
      break;
    case 'shock':
      ctx.fillStyle = '#e8d8b0';
      for (let i = 0; i < 4; i++) ctx.fillRect(-8 + i * 4, -p.r + (i % 2) * 3, 3, p.r * 2 - (i % 2) * 3);
      break;
    default:
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawPickup(ctx, k) {
  const x = Math.round(k.x), y = Math.round(k.y + (k.phys ? 0 : Math.sin(k.t * 3) * 1.5));
  if (k.phys && k.life < 2 && Math.floor(k.life * 10) % 2) return;
  const art = { coin: 'pr_coin', gem: 'pr_gem', nectar: 'hud_nectar', draught: 'hud_draught' }[k.kind];
  if (art && sprites[art]) {
    drawSprite(ctx, art, k.kind === 'coin' ? k.t * 10 : 0, x, y + (k.kind === 'coin' || k.kind === 'gem' ? 5 : 6), false, {});
    return;
  }
  if (k.kind === 'coin') {
    const w = Math.abs(Math.cos(k.t * 4)) * 3 + 1;
    ctx.fillStyle = '#a8701a'; ctx.fillRect(x - w - 1, y - 4, w * 2 + 2, 8);
    ctx.fillStyle = '#ffd34a'; ctx.fillRect(x - w, y - 3, w * 2, 6);
    ctx.fillStyle = '#fff4b0'; ctx.fillRect(x - w + 1, y - 3, 1, 3);
  } else if (k.kind === 'gem') {
    ctx.fillStyle = '#2a8aff'; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.fill();
    ctx.fillStyle = '#c0e8ff'; ctx.fillRect(x - 1, y - 3, 2, 2);
  } else {
    const c = k.kind === 'nectar' ? '#ff6aa0' : '#4bff8a';
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x - 3, y - 6, 6, 2);
    ctx.fillStyle = c; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.fillRect(x - 2, y + 4, 4, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 3, 2, 3);
  }
}

function drawProp(ctx, pr) {
  const x = Math.round(pr.x), y = Math.round(pr.y);
  if (pr.kind === 'amphora' && sprites.pr_amph_t) {
    const key = pr.loot === 'nectar' ? 'pr_amph_p' : pr.loot === 'draught' ? 'pr_amph_g' : 'pr_amph_t';
    const f = !pr.broken ? 0 : L.t - pr.brokeAt < 0.1 ? 2 : 3;   // shards stay on the ground
    drawSprite(ctx, key, f, x + 6, y + pr.h + 1, false, {});
    return;
  }
  if (pr.kind === 'chest' && sprites.pr_chest) { drawSprite(ctx, 'pr_chest', pr.opened ? 1 : 0, x + 8, y + 13, false, {}); return; }
  if (pr.broken) return;
  if (pr.kind === 'amphora') {
    const body = pr.tint || '#c8643a';
    ctx.fillStyle = '#5a2a14'; ctx.fillRect(x + 1, y + 2, 10, 11); ctx.fillRect(x + 3, y, 6, 3);
    ctx.fillStyle = body; ctx.fillRect(x + 2, y + 3, 8, 9); ctx.fillRect(x + 4, y + 1, 4, 2);
    ctx.fillStyle = '#1a1210'; ctx.fillRect(x + 2, y + 6, 8, 2);
    ctx.fillStyle = '#f0b080'; ctx.fillRect(x + 3, y + 4, 1, 2);
    ctx.fillStyle = '#5a2a14'; ctx.fillRect(x, y + 3, 1, 4); ctx.fillRect(x + 11, y + 3, 1, 4);
  } else if (pr.kind === 'chest') {
    if (pr.opened) {
      ctx.fillStyle = '#6a3a14'; ctx.fillRect(x, y + 4, 16, 8); ctx.fillStyle = '#3a1a08'; ctx.fillRect(x + 1, y + 2, 14, 3);
    } else {
      ctx.fillStyle = '#6a3a14'; ctx.fillRect(x, y, 16, 12);
      ctx.fillStyle = '#9a5a24'; ctx.fillRect(x + 1, y + 1, 14, 4); ctx.fillRect(x + 1, y + 6, 14, 5);
      ctx.fillStyle = '#ffd34a'; ctx.fillRect(x, y + 5, 16, 1); ctx.fillRect(x + 7, y + 4, 2, 4);
    }
  }
}

function drawAltar(ctx, a) {
  const x = Math.round(a.x), y = Math.round(a.y);
  if (sprites.pr_brazier) {
    // Unlit brazier; once lit the flame grows blue to gold, then flickers.
    let f = 0;
    if (a.lit) {
      if (a.litAt === undefined) a.litAt = L.t;
      const k = (L.t - a.litAt) * 8;
      f = k < 4 ? 1 + Math.floor(k) : 4 + (Math.floor(L.t * 7) % 2);
      ctx.fillStyle = 'rgba(255,220,130,0.12)'; ctx.beginPath(); ctx.arc(x + 8, y + 2, 20, 0, 7); ctx.fill();
    }
    drawSprite(ctx, 'pr_brazier', f, x + 8, y + 23, false, {});
    return;
  }
  ctx.fillStyle = '#ece6d8'; ctx.fillRect(x + 2, y + 8, 12, 14);
  ctx.fillStyle = '#c9bfa8'; ctx.fillRect(x + 2, y + 8, 2, 14); ctx.fillRect(x, y + 20, 16, 2);
  ctx.fillStyle = '#d4a63a'; ctx.fillRect(x, y + 6, 16, 3); ctx.fillRect(x + 4, y + 13, 8, 1);
  if (a.lit) {
    for (let i = 0; i < 3; i++) {
      const fl = Math.sin(L.t * 12 + i * 2) * 2;
      ctx.fillStyle = i === 1 ? '#7fd0ff' : '#ffd34a';
      ctx.fillRect(x + 4 + i * 3, y - 4 + fl - (i === 1 ? 3 : 0), 3, 9 - fl);
    }
    ctx.fillStyle = 'rgba(255,230,140,0.15)'; ctx.beginPath(); ctx.arc(x + 8, y, 18, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = '#5a5048'; ctx.fillRect(x + 4, y + 3, 8, 3);
  }
}

function drawSign(ctx, s) {
  const x = Math.round(s.x), y = Math.round(s.y);
  if (sprites.pr_stele) { drawSprite(ctx, 'pr_stele', 0, x + 7, y + 15, false, {}); return; }
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x + 6, y + 6, 2, 8);
  ctx.fillStyle = '#d8c8a0'; ctx.fillRect(x, y, 14, 8);
  ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x + 2, y + 2, 10, 1); ctx.fillRect(x + 2, y + 4, 7, 1);
}

function drawGate(ctx, g) {
  const x = Math.round(g.x), y = Math.round(g.y);
  if (sprites.pr_gate) {
    // The temple doors swing open as Perseus approaches.
    const near = Math.abs(P.x + P.w / 2 - (x + 12)) < 72 && Math.abs(P.y - y) < 60;
    drawSprite(ctx, 'pr_gate', near ? 1 : 0, x + 12, y + 41, false, {});
    return;
  }
  ctx.fillStyle = '#1a1410'; ctx.fillRect(x + 4, y + 6, 16, 34);
  const glow = 0.4 + Math.sin(L.t * 3) * 0.2;
  ctx.fillStyle = `rgba(255,200,90,${glow})`; ctx.fillRect(x + 5, y + 8, 14, 32);
  ctx.fillStyle = '#ece6d8'; ctx.fillRect(x, y + 6, 4, 34); ctx.fillRect(x + 20, y + 6, 4, 34);
  ctx.fillStyle = '#d4a63a'; ctx.fillRect(x - 2, y + 2, 28, 4);
  ctx.fillStyle = '#ece6d8'; ctx.beginPath(); ctx.moveTo(x - 2, y + 2); ctx.lineTo(x + 12, y - 6); ctx.lineTo(x + 26, y + 2); ctx.fill();
}

function drawAndromeda(ctx, a) {
  if (sprites.an_chain) {
    // Chained to the cliff; when Cetus falls the shackles shatter and she steps forward.
    if (!a.free) { drawSprite(ctx, 'an_chain', a.t * 5, a.x, a.y + 1, true, {}); return; }
    if (a.freeAt === undefined) a.freeAt = a.t;
    drawSprite(ctx, 'an_free', Math.min(3, (a.t - a.freeAt) * 3), a.x, a.y + 1, true, {});
    return;
  }
  const chainY = a.y - 22;
  if (!a.free) {
    ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a.x - 8, chainY); ctx.lineTo(a.x - 16, chainY - 10); ctx.moveTo(a.x + 8, chainY); ctx.lineTo(a.x + 18, chainY - 12); ctx.stroke();
    ctx.fillStyle = '#5a5a60'; ctx.fillRect(a.x - 18, chainY - 14, 4, 4); ctx.fillRect(a.x + 16, chainY - 16, 4, 4);
  }
  drawSprite(ctx, 'an_idle', ANDROMEDA_FRAME, a.x, a.y + 1, true, {});
}

export function draw(ctx) {
  if (!L) return;
  const sx = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const sy = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  drawBackground(ctx);
  ctx.save();
  ctx.translate(-Math.round(cam.x + sx), -Math.round(cam.y + sy));
  const x0 = Math.max(0, Math.floor(cam.x / T) - 1), x1 = Math.min(L.w - 1, Math.floor((cam.x + VW) / T) + 1);

  drawFx(ctx, true);
  if (boss && boss.behindTiles) boss.draw(ctx);
  ctx.drawImage(L.prerender, Math.floor(cam.x), 0, VW + 2, L.pxH, Math.floor(cam.x), 0, VW + 2, L.pxH);
  drawDynamicTiles(ctx, x0, x1);
  for (const m of L.movers) {
    if (L.tileset && hasRole('slab')) {
      for (let i = 0; i < m.w; i += T) drawTileArt(ctx, i === 0 && hasRole('slabL') ? 'slabL' : i + T >= m.w && hasRole('slabR') ? 'slabR' : 'slab', 0, Math.round(m.x) + i, Math.round(m.y), 8);
      continue;
    }
    ctx.fillStyle = '#d4a63a'; ctx.fillRect(Math.round(m.x), Math.round(m.y), m.w, 8);
    ctx.fillStyle = '#f6dc84'; ctx.fillRect(Math.round(m.x), Math.round(m.y), m.w, 2);
    ctx.fillStyle = '#8a6a2a'; for (let i = 4; i < m.w; i += 8) ctx.fillRect(Math.round(m.x) + i, Math.round(m.y) + 4, 4, 2);
  }
  for (const a of L.altars) drawAltar(ctx, a);
  for (const s of L.signs) drawSign(ctx, s);
  for (const g of L.gates) drawGate(ctx, g);
  if (L.andromeda) drawAndromeda(ctx, L.andromeda);
  for (const pr of props) drawProp(ctx, pr);
  for (const k of pickups) drawPickup(ctx, k);
  for (const e of enemies) if (e.alive) drawEnemy(ctx, e);
  if (boss && !boss.behindTiles) boss.draw(ctx);
  if (DEBUG_BOXES && boss) {
    // ?boxes in the URL: outline where the boss can be hurt (green) and where it hurts (red).
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#3f3'; for (const b of boss.hurtboxes()) ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
    ctx.strokeStyle = '#f33'; for (const b of boss.hitboxes()) ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
  }
  if (L.relicOrb && !L.relicOrb.taken) {
    const o = L.relicOrb, r = RELICS[o.relic];
    ctx.fillStyle = `rgba(255,230,140,${0.25 + Math.sin(o.t * 4) * 0.1})`;
    ctx.beginPath(); ctx.arc(o.x, o.y, 16, 0, 7); ctx.fill();
    drawSprite(ctx, r.small, 0, o.x, o.y + 9 + Math.sin(o.t * 3) * 2, false, {});
    if (Math.random() < 0.3) particle(o.x + (Math.random() - 0.5) * 20, o.y + 10, 0, -30, '#ffe08a', 0.6, 1);
  }
  drawPlayer(ctx);
  for (const p of projectiles) drawProjectile(ctx, p);
  if (boss && boss.drawFront) boss.drawFront(ctx);
  drawLiquid(ctx, x0, x1);
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  drawFx(ctx, false);
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  for (const t of texts) {
    ctx.fillStyle = '#000'; ctx.fillText(t.str, Math.round(t.x) + 1, Math.round(t.y) + 1);
    ctx.fillStyle = t.color; ctx.fillText(t.str, Math.round(t.x), Math.round(t.y));
  }
  ctx.restore();

  // Atmosphere
  if (L.theme.cave) {
    const px = P.x + 6 - cam.x, py = P.y + 16 - cam.y;
    const g = ctx.createRadialGradient(px, py, 40, px, py, 260);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  if (L.theme.rain) {
    ctx.strokeStyle = 'rgba(180,210,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
    for (const r of rain) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 3, r.y + 8); }
    ctx.stroke();
    if (lightning > 0) { ctx.fillStyle = `rgba(220,230,255,${lightning * 0.35})`; ctx.fillRect(0, 0, VW, VH); }
  }
  if (boss && boss.drawOverlay) boss.drawOverlay(ctx);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`; ctx.fillRect(0, 0, VW, VH); }
  drawHUD(ctx);
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
export function text(ctx, str, x, y, color = '#fff', align = 'left', size = 8) {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000';
  ctx.fillText(str, Math.round(x) + 1, Math.round(y) + 1);
  ctx.fillStyle = color;
  ctx.fillText(str, Math.round(x), Math.round(y));
}

export function wrapText(ctx, str, maxW, size = 8) {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function heart(ctx, x, y, fill) {
  ctx.fillStyle = '#2a0a0a';
  ctx.fillRect(x, y + 1, 9, 5); ctx.fillRect(x + 1, y, 3, 8); ctx.fillRect(x + 5, y, 3, 8); ctx.fillRect(x + 2, y + 6, 5, 2); ctx.fillRect(x + 3, y + 8, 3, 1);
  ctx.fillStyle = fill ? '#ff4a5a' : '#5a2a30';
  ctx.fillRect(x + 1, y + 1, 3, 5); ctx.fillRect(x + 5, y + 1, 3, 5); ctx.fillRect(x + 2, y + 5, 5, 2); ctx.fillRect(x + 3, y + 7, 3, 1); ctx.fillRect(x + 4, y + 2, 1, 4);
  if (fill) { ctx.fillStyle = '#ffb0b8'; ctx.fillRect(x + 2, y + 2, 1, 1); }
}

// Relic -> HUD icon (generated); relics without one use their small sprite.
const HUD_ICON = { harpe: 'hud_harpe', shield: 'hud_shield', sandals: 'hud_sandal', helm: 'hud_helm', head: 'hud_eye' };

function drawHUDArt(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, VW, 22);
  // Three hearts, two hit points each
  for (let i = 0; i < MAX_HP / 2; i++) {
    const hp = P.hp - i * 2;
    drawSprite(ctx, 'hud_heart', hp >= 2 ? 0 : hp === 1 ? 1 : 2, 10 + i * 13, 16, false, {});
  }
  drawSprite(ctx, 'hud_coin', 0, 50, 16, false, {});
  text(ctx, String(run.drachmas).padStart(5, '0'), 57, 7, '#ffe08a');
  drawSprite(ctx, 'hud_face', 0, 110, 19, false, {});
  text(ctx, 'x' + run.lives, 119, 7, '#ffffff');
  let ix = 148;
  if (has('kibisis')) {
    for (let i = 0; i < 3; i++) drawSprite(ctx, 'hud_nectar', 0, ix + 4 + i * 9, 18, false, { alpha: i < run.nectar ? 1 : 0.25 });
    ix += 30;
  }
  if (has('helm')) {
    ctx.fillStyle = '#1a1424'; ctx.fillRect(ix, 8, 34, 7);
    ctx.fillStyle = P.invisible ? '#d0b0ff' : '#8a6aff'; ctx.fillRect(ix + 1, 9, Math.round(32 * run.helm / 100), 5);
    ix += 40;
  }
  if (has('head')) for (let i = 0; i < 3; i++) drawSprite(ctx, 'hud_eye', 0, ix + 6 + i * 13, 17, false, { alpha: i < run.charges ? 1 : 0.25 });
  // Relic slots on the right
  let rx = VW - 12;
  const owned = RELIC_ORDER.filter((r) => has(r));
  for (let i = owned.length - 1; i >= 0; i--) {
    const r = owned[i];
    drawSprite(ctx, 'hud_slot', 0, rx, 20, false, { alpha: 0.85 });
    if (HUD_ICON[r] && sprites[HUD_ICON[r]]) drawSprite(ctx, HUD_ICON[r], 0, rx, 17, false, {});
    else drawSprite(ctx, RELICS[r].small, 0, rx, 17, false, {});
    rx -= 20;
  }
  if (!has('harpe')) drawSprite(ctx, 'i_sword', 0, rx - 4, 14, false, {});
}

function drawHUD(ctx) {
  if (sprites.hud_heart) drawHUDArt(ctx);
  else drawHUDDrawn(ctx);
  drawHUDCommon(ctx);
}

function drawHUDDrawn(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, VW, 22);
  for (let i = 0; i < MAX_HP; i++) heart(ctx, 6 + i * 11, 6, i < P.hp);
  // Drachmas
  ctx.fillStyle = '#ffd34a'; ctx.fillRect(80, 7, 7, 7); ctx.fillStyle = '#a8701a'; ctx.fillRect(82, 9, 3, 3);
  text(ctx, String(run.drachmas).padStart(5, '0'), 90, 7, '#ffe08a');
  text(ctx, 'x' + run.lives, 140, 7, '#ffffff');
  ctx.fillStyle = '#c87a4a'; ctx.fillRect(132, 7, 6, 7); ctx.fillStyle = '#1a1010'; ctx.fillRect(132, 6, 6, 3);
  // Relics
  let rx = VW - 8;
  const owned = RELIC_ORDER.filter((r) => has(r));
  for (let i = owned.length - 1; i >= 0; i--) {
    const r = owned[i];
    ctx.fillStyle = 'rgba(255,220,140,0.15)'; ctx.fillRect(rx - 16, 3, 16, 16);
    drawSprite(ctx, RELICS[r].small, 0, rx - 8, 18, false, {});
    rx -= 18;
  }
  if (!has('harpe')) { drawSprite(ctx, 'i_sword', 0, rx - 12, 14, false, {}); rx -= 26; }
  // Relic resources
  let ix = 168;
  if (has('kibisis')) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < run.nectar ? '#ff6aa0' : '#3a2a30';
      ctx.fillRect(ix + i * 7, 9, 5, 7); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(ix + i * 7 + 1, 7, 3, 2);
    }
    ix += 26;
  }
  if (has('helm')) {
    ctx.fillStyle = '#1a1424'; ctx.fillRect(ix, 8, 34, 7);
    ctx.fillStyle = P.invisible ? '#d0b0ff' : '#8a6aff'; ctx.fillRect(ix + 1, 9, Math.round(32 * run.helm / 100), 5);
    ix += 40;
  }
  if (has('head')) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < run.charges ? '#4bff8a' : '#1e3a28';
      ctx.beginPath(); ctx.ellipse(ix + 4 + i * 11, 11, 4, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#0a1a10'; ctx.fillRect(ix + 3 + i * 11, 10, 2, 2);
    }
  }
}

function drawHUDCommon(ctx) {
  // Boss bar
  if (boss && !boss.dead && boss.started) {
    const w = 260, x = (VW - w) / 2, y = VH - 18;
    text(ctx, boss.name.toUpperCase(), VW / 2, y - 11, '#ffd34a', 'center');
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 8);
    ctx.fillStyle = '#4a1010'; ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = '#e83a3a'; ctx.fillRect(x, y, Math.round(w * boss.hp / boss.maxHp), 6);
    ctx.fillStyle = '#ff9a8a'; ctx.fillRect(x, y, Math.round(w * boss.hp / boss.maxHp), 1);
  }
  // Sign text
  if (signAlpha > 0.02 && (signText || L.lastSign)) {
    const lines = wrapText(ctx, signText || L.lastSign, 360);
    const h = lines.length * 12 + 10, y = 30;
    ctx.globalAlpha = signAlpha;
    ctx.fillStyle = 'rgba(20,14,8,0.85)'; ctx.fillRect(52, y, 376, h);
    ctx.strokeStyle = '#d4a63a'; ctx.strokeRect(52.5, y + 0.5, 375, h - 1);
    lines.forEach((l, i) => text(ctx, l, VW / 2, y + 6 + i * 12, '#f6e8c0', 'center'));
    ctx.globalAlpha = 1;
  }
  if (bannerT > 0 && bannerText) {
    ctx.globalAlpha = Math.min(1, bannerT * 2);
    text(ctx, bannerText, VW / 2, 60, '#ffe08a', 'center', 12);
    ctx.globalAlpha = 1;
  }
}

export function getPlayer() { return P; }
export function getEnemies() { return enemies; }
