// Boot, main loop and screens (title, story, world cards, pause, relic reveal, game over, ending).
import { loadAssets, drawSprite, getBackground, sprites, images } from './assets.js';
import { unlockAudio, playMusic, sfx, toggleMute, audioState, WORLD_TRACKS } from './audio.js';
import { input, updateInput, setupTouch, consumeAll } from './input.js';
import { WORLDS, RELICS, RELIC_ORDER } from './levels.js';
import * as G from './game.js';

const { VW, VH, text, wrapText, run } = G;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let state = 'loading';
let progress = 0;
let menuIdx = 0;
let stateT = 0;
let fade = 1, fadeDir = -1, fadeCb = null;
let relicShown = null;
let save = loadSave();
const params = new URLSearchParams(location.search);

function loadSave() {
  try { return JSON.parse(localStorage.getItem('perseus_save') || 'null'); } catch (e) { return null; }
}
function writeSave() {
  save = { world: run.world, drachmas: run.drachmas };
  try { localStorage.setItem('perseus_save', JSON.stringify(save)); } catch (e) { /* storage unavailable */ }
}

function resize() {
  const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
  const scale = s >= 1 ? (s >= 2 ? Math.floor(s) : s) : s;
  canvas.style.width = Math.floor(VW * scale) + 'px';
  canvas.style.height = Math.floor(VH * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

function setState(s) { state = s; stateT = 0; menuIdx = 0; consumeAll(); }
function fadeTo(cb) { if (fadeCb) return; fadeDir = 1; fadeCb = cb; }

// ---------------------------------------------------------------------------
// Flow helpers
// ---------------------------------------------------------------------------
function startWorld(n, arena = false) {
  run.world = n;
  G.loadLevel(n, arena);
  playMusic(arena ? 'boss' : WORLD_TRACKS[n]);
  setState('play');
  if (arena) G.banner(WORLDS[n - 1].bossName.toUpperCase(), 2.5);
}

function newGame() {
  G.resetRun(1);
  run.drachmas = 0;
  run.time = 0;
  setState('story');
}

function continueGame() {
  G.resetRun(save.world);
  run.drachmas = save.drachmas || 0;
  setState('worldcard');
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update(dt) {
  updateInput();
  stateT += dt;
  if (input.pressed.mute) toggleMute();
  if (input.anyPressed) unlockAudio();

  if (fadeDir !== 0) {
    fade += fadeDir * dt * 3.2;
    if (fadeDir > 0 && fade >= 1) { fade = 1; const cb = fadeCb; fadeCb = null; fadeDir = -1; if (cb) cb(); }
    else if (fadeDir < 0 && fade <= 0) { fade = 0; fadeDir = 0; }
  }

  switch (state) {
    case 'title': {
      if (input.anyPressed) playMusic('title');
      const items = titleItems();
      if (input.pressed.up) { menuIdx = (menuIdx + items.length - 1) % items.length; sfx('select'); }
      if (input.pressed.down) { menuIdx = (menuIdx + 1) % items.length; sfx('select'); }
      if (input.pressed.confirm && stateT > 0.2) {
        unlockAudio(); sfx('confirm');
        const it = items[menuIdx];
        if (it === 'NEW GAME') fadeTo(newGame);
        else if (it === 'CONTINUE') fadeTo(continueGame);
        else if (it === 'CONTROLS') setState('controls');
      }
      break;
    }
    case 'controls':
      if ((input.pressed.confirm || input.pressed.back) && stateT > 0.2) { sfx('select'); setState('title'); }
      break;
    case 'story':
      if (input.pressed.confirm && stateT > 0.4) { sfx('confirm'); fadeTo(() => setState('worldcard')); }
      break;
    case 'worldcard':
      if ((input.pressed.confirm && stateT > 0.5) || stateT > 5) { sfx('confirm'); fadeTo(() => startWorld(run.world)); }
      break;
    case 'play':
      if (input.pressed.pause) { sfx('pause'); setState('pause'); break; }
      G.update(dt);
      for (const e of G.pollEvents()) handleEvent(e);
      break;
    case 'pause': {
      const items = pauseItems();
      if (input.pressed.up) { menuIdx = (menuIdx + items.length - 1) % items.length; sfx('select'); }
      if (input.pressed.down) { menuIdx = (menuIdx + 1) % items.length; sfx('select'); }
      if (input.pressed.back || (input.pressed.pause && !input.pressed.confirm)) { setState('play'); break; }
      if (input.pressed.confirm) {
        sfx('confirm');
        const it = items[menuIdx];
        if (it === 'RESUME') setState('play');
        else if (it.startsWith('MUSIC')) toggleMute();
        else if (it === 'RETURN TO ALTAR') fadeTo(() => { G.respawnAtCheckpoint(); setState('play'); });
        else if (it === 'QUIT TO TITLE') fadeTo(() => { playMusic(null); setState('title'); });
      }
      break;
    }
    case 'relic':
      G.update(dt * 0.0);
      if (input.pressed.confirm && stateT > 0.8) {
        sfx('confirm');
        fadeTo(() => {
          run.world++;
          writeSave();
          setState('worldcard');
        });
      }
      break;
    case 'gameover': {
      if (input.pressed.up || input.pressed.down) { menuIdx = 1 - menuIdx; sfx('select'); }
      if (input.pressed.confirm && stateT > 1) {
        sfx('confirm');
        if (menuIdx === 0) fadeTo(() => { const d = run.drachmas; G.resetRun(run.world); run.drachmas = Math.floor(d / 2); startWorld(run.world); });
        else fadeTo(() => { playMusic(null); setState('title'); });
      }
      break;
    }
    case 'victoryWait':
      G.update(dt);
      if (stateT > 2.5) fadeTo(() => { playMusic('ending'); setState('ending'); });
      break;
    case 'ending':
      if (input.pressed.confirm && stateT > 16) {
        sfx('confirm');
        try { localStorage.removeItem('perseus_save'); } catch (e) { /* ignore */ }
        save = null;
        fadeTo(() => { playMusic(null); setState('title'); });
      }
      break;
  }
}

function handleEvent(e) {
  if (e.type === 'death') {
    run.lives--;
    if (run.lives <= 0) { fadeTo(() => { playMusic(null); setState('gameover'); }); }
    else fadeTo(() => { G.respawnAtCheckpoint(); });
  } else if (e.type === 'gate') {
    fadeTo(() => startWorld(run.world, true));
  } else if (e.type === 'relic') {
    run.relics.add(e.relic);
    relicShown = e.relic;
    if (e.relic === 'head') G.run.charges = 3;
    setState('relic');
  } else if (e.type === 'victory') {
    setState('victoryWait');
  }
}

function titleItems() { return save && save.world > 1 ? ['CONTINUE', 'NEW GAME', 'CONTROLS'] : ['NEW GAME', 'CONTROLS']; }
function pauseItems() { return ['RESUME', 'RETURN TO ALTAR', 'MUSIC: ' + (audioState.muted ? 'OFF' : 'ON'), 'QUIT TO TITLE']; }

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(14,10,6,0.9)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#d4a63a'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = '#6a4a1a'; ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
}

function meander(y) {
  // Greek key border
  ctx.fillStyle = '#d4a63a';
  for (let x = 0; x < VW; x += 12) {
    ctx.fillRect(x, y, 10, 2); ctx.fillRect(x + 8, y, 2, 8); ctx.fillRect(x + 3, y + 6, 7, 2); ctx.fillRect(x + 3, y + 3, 2, 4); ctx.fillRect(x + 3, y + 3, 4, 2);
  }
}

// Full-screen story illustration (generated panels story_1..6), dimmed by 'shade'.
function drawPanel(n, shade = 0, alpha = 1) {
  const img = images['story_' + n];
  if (!img) return false;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, 0, 1);
  if (shade) { ctx.fillStyle = `rgba(5,4,10,${shade})`; ctx.fillRect(0, 0, VW, VH); }
  ctx.globalAlpha = 1;
  return true;
}
// World cards that have their own illustration.
const CARD_PANEL = { 2: 2, 6: 3, 7: 4 };

function drawMenu(items, x, y) {
  items.forEach((it, i) => {
    const sel = i === menuIdx;
    text(ctx, (sel ? '> ' : '  ') + it, x, y + i * 16, sel ? '#ffe08a' : '#b8a888', 'center');
  });
}

function drawTitle() {
  const bg = getBackground('bg_greek_hills', 'none');
  if (bg) ctx.drawImage(bg, -((stateT * 8) % (bg.width / 2)), 0);
  ctx.fillStyle = 'rgba(10,6,20,0.35)'; ctx.fillRect(0, 0, VW, VH);
  meander(10); meander(VH - 18);
  const bob = Math.sin(stateT * 2) * 2;
  let menuY = 136;
  if (sprites.title_logo) {
    drawSprite(ctx, 'title_logo', 0, VW / 2, 132 + bob, false, {});
    menuY = 142;
  } else {
    text(ctx, 'PERSEUS', VW / 2, 42 + bob, '#ffd34a', 'center', 24);
    text(ctx, 'ASCENDANT', VW / 2, 72 + bob, '#ffe9b0', 'center', 16);
    text(ctx, 'A MYTHIC PLATFORMER IN SEVEN TRIALS', VW / 2, 98, '#e8dcc0', 'center', 8);
  }
  drawSprite(ctx, sprites.p_run_harpe ? 'p_run_harpe' : 'p_run', stateT * 14, 96, 236, false, {});
  drawSprite(ctx, 'lion_walk', stateT * 10, 400, 240, true, { scale: 0.6 });
  drawMenu(titleItems(), VW / 2, menuY);
  if (Math.floor(stateT * 2) % 2) text(ctx, 'ENTER / Z TO SELECT', VW / 2, 204, '#c8b890', 'center');
  text(ctx, 'M: MUTE', 8, VH - 32, '#8a7a60');
}

function drawControls() {
  ctx.fillStyle = '#0c0a12'; ctx.fillRect(0, 0, VW, VH);
  meander(8);
  text(ctx, 'CONTROLS', VW / 2, 24, '#ffd34a', 'center', 12);
  const rows = [
    ['MOVE', 'ARROWS / A D'],
    ['JUMP', 'Z / SPACE / K  (hold = higher)'],
    ['DROP THROUGH', 'DOWN + JUMP on a marble slab'],
    ['STRIKE', 'X / J   (UP + strike = overhead)'],
    ['DOWN-THRUST', 'hold DOWN in mid-air  [Harpe]'],
    ['SHIELD', 'hold C / L / SHIFT  [Aegis]'],
    ['NECTAR', 'Q / U  [Kibisis]'],
    ['GLIDE', 'hold JUMP while falling  [Sandals]'],
    ['VANISH', 'V / I  [Helm of Hades]'],
    ['GORGON GAZE', 'B / O  [Head of Medusa]'],
    ['PAUSE / MUTE', 'ESC or P / M'],
    ['GAMEPAD', 'A jump  X strike  RB shield'],
    ['', 'LB helm  Y gaze  SELECT nectar'],
  ];
  rows.forEach(([a, b], i) => { text(ctx, a, 24, 46 + i * 15, '#ffe08a'); text(ctx, b, 160, 46 + i * 15, '#e8dcc0'); });
  if (Math.floor(stateT * 2) % 2) text(ctx, 'PRESS ENTER', VW / 2, VH - 20, '#c8b890', 'center');
}

const STORY = [
  'Seriphos, in the age of heroes.',
  'A young hero named Perseus sets out with nothing but a bronze xiphos',
  'and a promise: to prove worthy of the gods.',
  'Six trials lie ahead. Six guardians hold six divine relics.',
  'At the end of the road waits the Gorgon Medusa -',
  'and beyond her, on the storm-swept coast of Joppa, the leviathan Cetus.',
];

function drawStory() {
  ctx.fillStyle = '#07060c'; ctx.fillRect(0, 0, VW, VH);
  const panel = drawPanel(1, 0.62, Math.min(1, stateT));
  meander(14);
  let y = 50;
  STORY.forEach((line, i) => {
    const a = Math.max(0, Math.min(1, stateT * 1.2 - i * 0.7));
    ctx.globalAlpha = a;
    for (const l of wrapText(ctx, line, 420)) { text(ctx, l, VW / 2, y, i === 0 ? '#ffd34a' : '#e8dcc0', 'center'); y += 13; }
    y += 9;
  });
  ctx.globalAlpha = 1;
  if (!panel) drawSprite(ctx, 'p_idle', G.IDLE_FRAME, VW / 2, VH - 26, false, {});
  if (stateT > 3 && Math.floor(stateT * 2) % 2) text(ctx, 'PRESS ENTER', VW / 2, VH - 16, '#c8b890', 'center');
}

function drawWorldCard() {
  const W = WORLDS[run.world - 1];
  const th = G.THEMES[W.theme];
  if (!drawPanel(CARD_PANEL[run.world], 0.62)) {
    const bg = getBackground(th.bg, th.filter, th.crop);
    if (bg) ctx.drawImage(bg, 0, 0);
    ctx.fillStyle = 'rgba(5,4,10,0.65)'; ctx.fillRect(0, 0, VW, VH);
  }
  meander(40); meander(VH - 48);
  text(ctx, 'WORLD ' + W.num + ' OF 7', VW / 2, 66, '#c8b890', 'center');
  text(ctx, W.name.toUpperCase(), VW / 2, 86, '#ffd34a', 'center', 14);
  text(ctx, W.subtitle, VW / 2, 110, '#ffe9b0', 'center');
  wrapText(ctx, W.intro, 380).forEach((l, i) => text(ctx, l, VW / 2, 140 + i * 13, '#e8dcc0', 'center'));
  // Relics carried
  const owned = RELIC_ORDER.filter((r) => run.relics.has(r));
  owned.forEach((r, i) => drawSprite(ctx, RELICS[r].small, 0, VW / 2 - (owned.length - 1) * 11 + i * 22, 202, false, {}));
  text(ctx, 'LIVES x' + run.lives + '    DRACHMAS ' + run.drachmas, VW / 2, VH - 36, '#c8b890', 'center');
}

function drawPause() {
  G.draw(ctx);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, VW, VH);
  panel(140, 70, 200, 120);
  text(ctx, 'PAUSED', VW / 2, 82, '#ffd34a', 'center', 12);
  drawMenu(pauseItems(), VW / 2, 108);
  text(ctx, WORLDS[run.world - 1].name, VW / 2, 200, '#c8b890', 'center');
}

function drawRelic() {
  G.draw(ctx);
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.7, stateT)})`; ctx.fillRect(0, 0, VW, VH);
  const r = RELICS[relicShown];
  panel(60, 40, 360, 190);
  ctx.fillStyle = `rgba(255,220,120,${0.15 + Math.sin(stateT * 3) * 0.05})`;
  ctx.beginPath(); ctx.arc(VW / 2, 98, 34, 0, 7); ctx.fill();
  drawSprite(ctx, r.icon, 0, VW / 2, 98 + 26 + Math.sin(stateT * 2) * 2, false, {});
  text(ctx, 'RELIC OBTAINED', VW / 2, 50, '#c8b890', 'center');
  text(ctx, r.name.toUpperCase(), VW / 2, 140, '#ffd34a', 'center', 10);
  r.text.forEach((l, i) => text(ctx, l, VW / 2, 160 + i * 13, i === 0 ? '#e8dcc0' : '#ffffff', 'center'));
  if (stateT > 0.8 && Math.floor(stateT * 2) % 2) text(ctx, 'PRESS ENTER', VW / 2, 214, '#c8b890', 'center');
}

function drawGameOver() {
  ctx.fillStyle = '#0a0406'; ctx.fillRect(0, 0, VW, VH);
  text(ctx, 'THE FATES ARE CRUEL', VW / 2, 70, '#ff6a5a', 'center', 12);
  drawSprite(ctx, 'p_death', 15, VW / 2, 150, false, { variant: 'stone' });
  drawMenu(['TRY AGAIN (WORLD ' + run.world + ')', 'TITLE SCREEN'], VW / 2, 176);
  text(ctx, 'Relics kept. Half your drachmas are lost.', VW / 2, 222, '#8a7a60', 'center');
}

const ENDING = [
  [1.0, 'The leviathan is stone. The sea grows calm.'],
  [4.0, 'Andromeda is free.'],
  [7.0, 'Perseus returns the divine relics to the gods of Olympus.'],
  [10.5, 'In Mycenae, Perseus and Andromeda are crowned,'],
  [12.5, 'to rule side by side.'],
];

function drawEnding() {
  const bg = getBackground('bg_joppa_coast', 'brightness(1.6) saturate(0.7) sepia(0.45) hue-rotate(-10deg)');
  if (bg) ctx.drawImage(bg, -((stateT * 4) % (bg.width / 2)), 0);
  ctx.fillStyle = 'rgba(255,200,120,0.12)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, VW, 112);
  ctx.fillStyle = '#3a3028'; ctx.fillRect(0, 222, VW, 48);
  ctx.fillStyle = '#5a4a38'; ctx.fillRect(0, 222, VW, 3);
  const panels = !!images.story_5;
  drawSprite(ctx, sprites.p_idle_harpe ? 'p_idle_harpe' : 'p_idle', sprites.p_idle_harpe ? stateT * 5 : G.IDLE_FRAME, VW / 2 - 18, 223, false, {});
  // Andromeda runs in from the right to stand beside Perseus.
  const arrive = panels ? 7 : 4;
  const walkT = Math.max(0, arrive - stateT);
  if (sprites.an_run) {
    if (walkT > 0) drawSprite(ctx, 'an_run', stateT * 12, VW / 2 + 18 + walkT * 60, 223, true, {});
    else drawSprite(ctx, 'an_crown', stateT * 4, VW / 2 + 18, 223, true, {});
  } else if (walkT > 0) drawSprite(ctx, 'an_walk', stateT * 12, VW / 2 + 18 + walkT * 60, 223, true, {});
  else drawSprite(ctx, 'an_idle', G.ANDROMEDA_FRAME, VW / 2 + 18, 223, true, {});
  // Crowns once crowned
  if (stateT > 10.5 && !panels) {
    ctx.fillStyle = '#ffd34a';
    for (const cx of [VW / 2 - 18, VW / 2 + 18]) { ctx.fillRect(cx - 4, 184, 8, 2); ctx.fillRect(cx - 4, 181, 2, 3); ctx.fillRect(cx - 1, 180, 2, 4); ctx.fillRect(cx + 2, 181, 2, 3); }
  }
  // Relics rising to Olympus
  RELIC_ORDER.forEach((r, i) => {
    const t = stateT - 7 - i * 0.35;
    if (t < 0) return;
    const y = 200 - t * 45, x = VW / 2 - 75 + i * 30;
    if (y < -20) return;
    ctx.fillStyle = 'rgba(255,230,140,0.3)'; ctx.beginPath(); ctx.arc(x, y - 8, 10, 0, 7); ctx.fill();
    drawSprite(ctx, RELICS[r].small, 0, x, y, false, {});
  });
  if (panels) {
    // Opening and closing illustrations, cross-faded over the scene.
    if (stateT < 4.5) drawPanel(5, 0, Math.min(1, 4.5 - stateT));
    if (stateT > 10.5) drawPanel(6, 0, Math.min(1, (stateT - 10.5) * 0.8));
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, VW, 96);
  }
  let y = 16;
  for (const [t, line] of ENDING) {
    if (stateT < t) break;
    ctx.globalAlpha = Math.min(1, (stateT - t) * 1.5);
    text(ctx, line, VW / 2, y, '#ffe9b0', 'center');
    ctx.globalAlpha = 1;
    y += 16;
  }
  if (stateT > 15) {
    ctx.globalAlpha = Math.min(1, stateT - 15);
    if (panels) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 108, VW, 54); }
    text(ctx, 'THE END', VW / 2, 120, '#ffd34a', 'center', 16);
    const mins = Math.floor(run.time / 60), secs = Math.floor(run.time % 60);
    text(ctx, 'DRACHMAS ' + run.drachmas + '   TIME ' + mins + ':' + String(secs).padStart(2, '0'), VW / 2, 146, '#ffffff', 'center');
    ctx.globalAlpha = 1;
    if (stateT > 16 && Math.floor(stateT * 2) % 2) text(ctx, 'PRESS ENTER', VW / 2, VH - 16, '#c8b890', 'center');
  }
}

function drawLoading() {
  ctx.fillStyle = '#07060c'; ctx.fillRect(0, 0, VW, VH);
  text(ctx, 'PERSEUS ASCENDANT', VW / 2, 110, '#ffd34a', 'center', 12);
  ctx.fillStyle = '#2a2010'; ctx.fillRect(140, 140, 200, 8);
  ctx.fillStyle = '#d4a63a'; ctx.fillRect(140, 140, Math.round(200 * progress), 8);
  text(ctx, 'Summoning the gods...', VW / 2, 158, '#8a7a60', 'center');
}

function draw() {
  ctx.imageSmoothingEnabled = false;
  switch (state) {
    case 'loading': drawLoading(); break;
    case 'title': drawTitle(); break;
    case 'controls': drawControls(); break;
    case 'story': drawStory(); break;
    case 'worldcard': drawWorldCard(); break;
    case 'play': case 'victoryWait': G.draw(ctx); break;
    case 'pause': drawPause(); break;
    case 'relic': drawRelic(); break;
    case 'gameover': drawGameOver(); break;
    case 'ending': drawEnding(); break;
  }
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, VW, VH); }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const STEP = 1 / 60;
let acc = 0, last = performance.now();
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  draw();
  requestAnimationFrame(frame);
}

async function boot() {
  setupTouch();
  requestAnimationFrame(frame);
  try { await document.fonts.load('8px "Press Start 2P"'); } catch (e) { /* fallback font */ }
  const t0 = performance.now();
  await loadAssets((p) => { progress = p; });
  window.loadMs = Math.round(performance.now() - t0);
  // Debug / testing shortcut: ?world=3 or ?world=3&boss=1
  const w = parseInt(params.get('world'), 10);
  if (w >= 1 && w <= 7) {
    G.resetRun(w);
    startWorld(w, params.get('boss') === '1');
    fade = 0; fadeDir = 0;
    return;
  }
  setState('title');
}
boot();

// Exposed for debugging in the browser console.
window.perseus = { G, run, input, get state() { return state; }, step(n = 1) { for (let i = 0; i < n; i++) update(STEP); draw(); } };
