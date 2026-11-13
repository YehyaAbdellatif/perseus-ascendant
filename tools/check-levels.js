// Stage completability checker. Open http://localhost:8080/tools/check-levels.html
// It drives the real game physics with scripted inputs and searches outward from the start,
// trying walks, jumps, double jumps, glides, pogo bounces, drop-throughs and the Helm.
// A stage passes if some chain of moves reaches the boss gate without taking any damage.
// Enemies are removed, so this checks the level geometry only.
import { loadAssets } from '../js/assets.js';
import * as G from '../js/game.js';
import { input } from '../js/input.js';
import { WORLDS, RELIC_ORDER } from '../js/levels.js';

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'shield', 'helm', 'gaze', 'nectar', 'pause', 'confirm', 'back', 'mute'];
const DT = 1 / 60;

function setInput(h) {
  for (const a of ACTIONS) {
    const v = !!h[a];
    input.pressed[a] = v && !input.held[a];
    input.released[a] = !v && input.held[a];
    input.held[a] = v;
  }
}

function snapshot() {
  const P = G.P, L = G.L;
  return {
    p: Object.assign({}, P, { safe: { ...P.safe } }),
    movers: L.movers.map((m) => ({ ph: m.ph, x: m.x, y: m.y, dx: m.dx, dy: m.dy })),
    crumble: [...L.crumble].map(([k, v]) => [k, { ...v }]),
    helm: G.run.helm,
  };
}

function restore(s) {
  const P = G.P, L = G.L;
  Object.assign(P, s.p, { safe: { ...s.p.safe }, hitSet: new Set(), hp: 6, inv: 0, hurtT: 0, invisible: false });
  L.movers.forEach((m, i) => Object.assign(m, s.movers[i]));
  L.crumble = new Map(s.crumble.map(([k, v]) => [k, { ...v }]));
  L.gateUsed = false;
  G.run.helm = s.helm;
  for (const a of ACTIONS) { input.held[a] = false; input.pressed[a] = false; }
  G.getEnemies().length = 0;
  G.pollEvents();
}

function buildMoves(relics, hasMovers, hasSpectral) {
  const moves = [];
  const waits = hasMovers ? [0, 40] : [0];
  for (const wait of waits) for (const dir of [1, -1]) {
    for (const walk of [12, 30]) moves.push({ kind: 'walk', dir, walk, wait });
    for (const runup of [0, 12]) for (const hold of [3, 8, 30]) for (const air of [dir, 0]) {
      moves.push({ kind: 'jump', dir, runup, hold, air, wait });
    }
    if (relics.has('sandals')) {
      for (const runup of [0, 12]) for (const glide of [false, true]) for (const dj of [16, 26]) {
        moves.push({ kind: 'jump', dir, runup, hold: 12, air: dir, dj, glide, wait });
      }
    }
    if (relics.has('harpe')) for (const runup of [0, 12]) moves.push({ kind: 'jump', dir, runup, hold: 30, air: dir, pogo: true, wait });
    if (hasSpectral && relics.has('helm')) moves.push({ kind: 'walk', dir, walk: 50, helm: true, wait });
  }
  moves.push({ kind: 'drop' });
  return moves;
}

// Runs one move from the current state. Returns 'gate', a landing, or null if it failed.
function runMove(m) {
  const P = G.P, L = G.L;
  const fail = () => P.hp < 6 || P.dead || P.y > L.pxH;
  for (let i = 0; i < (m.wait || 0); i++) { setInput({}); G.update(DT); if (fail()) return null; }
  if (m.helm) { P.invisible = true; G.run.helm = 100; }
  const dirKey = m.dir > 0 ? 'right' : 'left';
  for (let t = 0; t < 420; t++) {
    const h = {};
    if (m.kind === 'walk') {
      if (t < m.walk) h[dirKey] = true;
    } else if (m.kind === 'drop') {
      h.down = t < 8; h.jump = t < 2;
    } else {
      const jt = t - m.runup;
      if (jt < 0) h[dirKey] = true;
      else {
        if (m.air) h[m.air > 0 ? 'right' : 'left'] = true;
        if (jt < m.hold) h.jump = true;
        if (m.dj && jt >= m.dj && (m.glide || jt < m.dj + 10)) h.jump = true;
        if (m.pogo && jt > 4) h.down = true;
      }
    }
    setInput(h);
    G.update(DT);
    for (const e of G.pollEvents()) if (e.type === 'gate') return 'gate';
    if (fail()) return null;
    const settled = m.kind === 'walk' ? t >= m.walk : t > (m.runup || 0) + 3;
    if (settled && P.onGround && Math.abs(P.vy) < 1) return 'land';
  }
  return null;
}

const keyOf = () => `${Math.round(G.P.x / 6)},${Math.round(G.P.y / 8)},${G.P.ride ? 'r' : ''}`;

async function checkWorld(n, log) {
  G.resetRun(n);
  G.run.relics = new Set(RELIC_ORDER.slice(0, n - 1));
  G.loadLevel(n, false);
  G.getEnemies().length = 0;
  const L = G.L;
  const hasSpectral = L.tiles.some((t) => t === 6);
  const moves = buildMoves(G.run.relics, L.movers.length > 0, hasSpectral);
  for (let i = 0; i < 30; i++) { setInput({}); G.update(DT); }
  const start = snapshot();
  const seen = new Set([keyOf()]);
  const frontier = [{ s: start, x: G.P.x, path: [] }];
  let best = { x: G.P.x, y: G.P.y, path: [] };
  let explored = 0;
  const t0 = performance.now();
  while (frontier.length) {
    // Explore the right-most state first: the gate is always at the far right.
    frontier.sort((a, b) => b.x - a.x);
    const node = frontier.shift();
    explored++;
    for (const m of moves) {
      restore(node.s);
      const r = runMove(m);
      if (r === 'gate') {
        return { ok: true, explored, ms: Math.round(performance.now() - t0), steps: node.path.length + 1 };
      }
      if (!r) continue;
      const k = keyOf();
      if (seen.has(k)) continue;
      seen.add(k);
      const path = node.path.concat([m]);
      frontier.push({ s: snapshot(), x: G.P.x, path });
      if (G.P.x > best.x) best = { x: G.P.x, y: G.P.y, path };
    }
    if (explored % 50 === 0) { log(`  world ${n}: explored ${explored}, furthest column ${Math.floor(best.x / 16)}`); await new Promise((r) => setTimeout(r, 0)); }
    if (explored > 4000) break;
  }
  return { ok: false, explored, ms: Math.round(performance.now() - t0), furthestCol: Math.floor(best.x / 16), furthestRow: Math.floor((best.y + 31) / 16), width: L.w };
}

export async function runChecks(worlds = [1, 2, 3, 4, 5, 6, 7], log = console.log) {
  await loadAssets();
  const results = {};
  for (const n of worlds) {
    log(`World ${n}: ${WORLDS[n - 1].name}...`);
    const r = await checkWorld(n, log);
    results[n] = r;
    log(r.ok
      ? `World ${n}: PASS (reached the gate; ${r.explored} positions explored, ${r.ms} ms)`
      : `World ${n}: FAIL - stuck at column ${r.furthestCol}, row ${r.furthestRow} of ${r.width} (${r.explored} positions explored)`);
  }
  return results;
}
