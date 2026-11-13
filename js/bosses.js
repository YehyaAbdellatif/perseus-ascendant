// The seven guardians. Each boss exposes update/draw plus hurtboxes (where it can be hit)
// and hitboxes (where it hurts Perseus). Boxes flagged `armor` clank instead of taking damage.
import { drawSprite, sprites } from './assets.js';

const GROUND = 208;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function base(name, hp) {
  return {
    name, hp, maxHp: hp, flash: 0, inv: 0, dead: false, finished: false, deathT: 0, started: false,
    state: 'intro', t: 0, anim: 0, face: -1, vx: 0, vy: 0,
    go(s) { this.state = s; this.t = 0; },
    hard() { return this.hp <= this.maxHp / 2; },
  };
}

function flashOpt(b, extra = {}) {
  if (b.flash > 0) extra.variant = 'white';
  return extra;
}

export function createBoss(kind, x, y, A) {
  const make = { lion, automaton, dragon, harpyqueen, cerberus, medusa, cetus }[kind];
  return make(x, y, A);
}

// ---------------------------------------------------------------------------
// World 1: the Nemean Lion. Charges into walls and is stunned; stunned hits do double damage.
// ---------------------------------------------------------------------------
function lion(x, y, A) {
  const b = base('The Nemean Lion', 14);
  Object.assign(b, { x: x - 32, y: y - 44, w: 64, h: 44, onGround: false, pounces: 0 });
  b.center = () => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  b.update = (dt) => {
    b.t += dt; b.anim += dt;
    b.vy = Math.min(b.vy + 1200 * dt, 500);
    if (b.dead) {
      b.deathT += dt; b.vx = 0;
      if (Math.random() < 0.3) A.burst(b.x + Math.random() * b.w, b.y + Math.random() * b.h, '#ffd34a', 3, 60);
      if (b.deathT > 2.2) b.finished = true;
      A.moveBody(b, dt, false);
      return;
    }
    const P = A.P, dx = P.x + 6 - (b.x + b.w / 2), sp = b.hard() ? 1.3 : 1;
    switch (b.state) {
      case 'intro':
        b.face = Math.sign(dx) || -1;
        if (b.t > 1.2) { b.started = true; A.sfx('roar'); A.shake(6); b.go('stalk'); }
        break;
      case 'stalk':
        b.face = Math.sign(dx) || b.face;
        b.vx = b.face * 55 * sp;
        if (b.t > 1.4 / sp) {
          if (Math.abs(dx) < 75) b.go('swipeWind');
          else b.go(Math.random() < 0.5 ? 'pounceWind' : 'chargeWind');
        }
        break;
      case 'pounceWind':
        b.vx = 0;
        if (b.t > 0.5 / sp) { b.vy = -390; b.vx = clamp(dx / 0.8, -250, 250); b.face = Math.sign(dx) || b.face; b.go('pounce'); A.sfx('jump'); }
        break;
      case 'pounce':
        if (b.onGround && b.t > 0.15) {
          A.shake(4); A.sfx('stomp'); b.vx = 0;
          b.pounces++;
          if (b.hard() && b.pounces < 2) b.go('pounceWind'); else { b.pounces = 0; b.go('recover'); }
        }
        break;
      case 'chargeWind':
        b.vx = 0;
        b.face = Math.sign(dx) || b.face;
        if (Math.random() < 0.4) A.particle(b.x + b.w / 2 - b.face * 30, GROUND - 2, -b.face * 60, -30, '#d8c8a0', 0.4, 2);
        if (b.t > 0.75 / sp) { b.go('charge'); A.sfx('roar'); }
        break;
      case 'charge':
        b.vx = b.face * 260 * sp;
        if (b.hitWall) {
          A.shake(9); A.sfx('stomp');
          A.burst(b.face > 0 ? b.x + b.w : b.x, b.y + 20, '#d8c8a0', 16, 140);
          b.vx = 0; b.go('stunned');
        }
        break;
      case 'stunned':
        b.vx = 0;
        if (b.t > 2.1) b.go('stalk');
        break;
      case 'swipeWind':
        b.vx = 0;
        if (b.t > 0.4 / sp) { b.go('swipe'); A.sfx('slash'); }
        break;
      case 'swipe':
        b.vx = b.face * 90;
        if (b.t > 0.25) b.go('recover');
        break;
      case 'recover':
        b.vx = 0;
        if (b.t > 0.6 / sp) b.go('stalk');
        break;
    }
    A.moveBody(b, dt, false);
  };
  b.hurtboxes = () => (b.dead ? [] : [{ x: b.x, y: b.y, w: b.w, h: b.h, mult: b.state === 'stunned' ? 2 : 1 }]);
  b.hitboxes = () => {
    if (b.dead || b.state === 'intro' || b.state === 'stunned') return [];
    const r = [{ x: b.x + 8, y: b.y + 8, w: b.w - 16, h: b.h - 8 }];
    if (b.state === 'swipe') r.push({ x: b.face > 0 ? b.x + b.w : b.x - 30, y: b.y + 6, w: 30, h: 30 });
    return r;
  };
  b.draw = (ctx) => {
    let key = 'lion_walk', f = b.anim * 12;
    if (b.state === 'charge') { key = 'lion_run'; f = b.anim * 22; }
    else if (b.state === 'pounce') { key = 'lion_jump'; f = 4 + clamp(b.t * 14, 0, 10); }
    else if (['intro', 'stunned', 'pounceWind', 'chargeWind', 'recover', 'swipeWind'].includes(b.state) || b.dead) { key = 'lion_idle'; f = b.anim * 8; }
    else if (b.state === 'swipe') { key = 'lion_jump'; f = 3; }
    const opt = flashOpt(b);
    if (b.dead) opt.alpha = Math.max(0, 1 - b.deathT / 2.2);
    if ((b.state === 'pounceWind' || b.state === 'chargeWind' || b.state === 'swipeWind') && Math.floor(b.t * 14) % 2) opt.variant = 'white';
    drawSprite(ctx, key, f, b.x + b.w / 2, b.y + b.h + 2, b.face < 0, opt);
    if (b.state === 'stunned') {
      for (let i = 0; i < 3; i++) {
        const a = b.t * 5 + i * 2.1;
        ctx.fillStyle = '#fff36a';
        ctx.fillRect(Math.round(b.x + b.w / 2 + b.face * 22 + Math.cos(a) * 12), Math.round(b.y - 6 + Math.sin(a) * 4), 3, 3);
      }
    }
  };
  return b;
}

// ---------------------------------------------------------------------------
// World 2: Talos, the Bronze Sentinel. Only its glowing head can be hurt.
// ---------------------------------------------------------------------------
function automaton(x, y, A) {
  const b = base('Talos, the Bronze Sentinel', 16);
  Object.assign(b, { x: x - 20, y: y - 84, w: 40, h: 84, onGround: false });
  // Weak point: the helmet at the top of the sprite.
  const head = () => ({ x: b.x + 8 + b.face * 5, y: b.y - 20, w: 24, h: 22 });
  b.center = () => { const h = head(); return { x: h.x + 12, y: h.y + 10 }; };
  b.update = (dt) => {
    b.t += dt; b.anim += dt;
    b.vy = Math.min(b.vy + 1200 * dt, 500);
    if (b.dead) {
      b.deathT += dt; b.vx = 0;
      if (Math.random() < 0.5) { A.burst(b.x + Math.random() * b.w, b.y + Math.random() * b.h, pick(['#ffd27a', '#ff8a3a', '#fff']), 4, 90); }
      if (Math.random() < 0.05) A.sfx('clank');
      if (b.deathT > 2.4) b.finished = true;
      return;
    }
    const P = A.P, dx = P.x + 6 - (b.x + b.w / 2), hard = b.hard();
    switch (b.state) {
      case 'intro':
        if (b.t > 1.5) { b.started = true; A.sfx('stomp'); A.shake(5); b.go('walk'); }
        break;
      case 'walk':
        b.face = Math.sign(dx) || b.face;
        b.vx = b.face * (hard ? 40 : 28);
        if (b.t > (hard ? 1.4 : 2)) {
          if (Math.abs(dx) < 60) b.go('smashWind');
          else b.go(Math.random() < 0.5 ? 'stompWind' : 'boltWind');
        }
        break;
      case 'stompWind':
        b.vx = 0;
        if (b.t > 0.7) {
          A.sfx('stomp'); A.shake(7);
          for (const d of [-1, 1]) A.spawnProj({ x: b.x + b.w / 2 + d * 22, y: GROUND - 7, vx: d * 170, vy: 0, r: 7, kind: 'shock', reflectable: false, boss: true, ghost: true, life: 3 });
          b.go('recover');
        }
        break;
      case 'boltWind':
        b.vx = 0;
        if (b.t > 0.6) {
          A.sfx('shoot');
          const cx = b.x + b.w / 2, cy = b.y + 26;
          const a = Math.atan2(P.y + 16 - cy, P.x + 6 - cx);
          const n = hard ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const s = (i - (n - 1) / 2) * 0.22;
            A.spawnProj({ x: cx, y: cy, vx: Math.cos(a + s) * 150, vy: Math.sin(a + s) * 150, r: 3, kind: 'bronze', boss: true, owner: b });
          }
          b.go('recover');
        }
        break;
      case 'smashWind':
        b.vx = 0;
        if (b.t > 0.45) { b.go('smash'); A.sfx('stomp'); A.shake(4); }
        break;
      case 'smash':
        if (b.t > 0.3) b.go('recover');
        break;
      case 'recover':
        b.vx = 0;
        if (b.t > (hard ? 0.5 : 0.8)) b.go('walk');
        break;
    }
    A.moveBody(b, dt, false);
  };
  b.hurtboxes = () => (b.dead ? [] : [Object.assign(head(), { mult: 1 }), { x: b.x, y: b.y, w: b.w, h: b.h, armor: true }]);
  b.hitboxes = () => {
    if (b.dead || b.state === 'intro') return [];
    const r = [{ x: b.x + 4, y: b.y + 10, w: b.w - 8, h: b.h - 10 }];
    if (b.state === 'smash') r.push({ x: b.face > 0 ? b.x + b.w : b.x - 34, y: GROUND - 30, w: 34, h: 30 });
    return r;
  };
  b.draw = (ctx) => {
    let key = 'ta_walk', f = b.anim * 10;
    if (b.dead) { key = 'ta_death'; f = Math.min(15, b.deathT * 8); }
    else if (b.state === 'stompWind' || b.state === 'smashWind') { key = 'ta_attack'; f = Math.min(7, (b.t / (b.state === 'stompWind' ? 0.7 : 0.45)) * 7); }
    else if (b.state === 'stomp' || b.state === 'smash') { key = 'ta_attack'; f = 8 + Math.min(3, b.t * 12); }
    else if (b.state !== 'walk') { key = 'ta_idle'; f = b.anim * 5; }
    const opt = flashOpt(b);
    if (b.dead) opt.alpha = Math.max(0, 1 - Math.max(0, b.deathT - 1.8) / 0.6);
    drawSprite(ctx, key, f, b.x + b.w / 2, b.y + b.h + 2, b.face < 0, opt);
    if (b.dead) return;
    // Glow on the vulnerable helmet, and the chest core charging before bolts
    const h = head();
    const awake = !(b.state === 'intro' && b.t < 0.8);
    ctx.fillStyle = `rgba(127,255,224,${awake ? 0.18 + Math.sin(b.anim * 4) * 0.08 : 0.05})`;
    ctx.beginPath(); ctx.arc(h.x + 12, h.y + 12, 16, 0, 7); ctx.fill();
    if (b.state === 'boltWind') {
      const g = 0.5 + Math.sin(b.t * 30) * 0.4;
      ctx.fillStyle = `rgba(255,190,70,${g})`;
      ctx.beginPath(); ctx.arc(b.x + b.w / 2 + b.face * 4, b.y + 26, 4 + g * 3, 0, 7); ctx.fill();
    }
  };
  return b;
}

// ---------------------------------------------------------------------------
// World 3: Ladon, the coiled dragon. Burrows between holes; reflected fire stuns it.
// ---------------------------------------------------------------------------
function dragon(x, y, A) {
  const b = base('Ladon, the Coiled Dragon', 22);
  const holes = [96, 240, 384];
  Object.assign(b, { hole: 240, rise: 0, lx: 0, ly: 0, actions: 0, hx: 240, hy: GROUND });
  const anim = !!sprites.ladon_idle;                          // generated frames (tools/build-art.js)
  const LH = anim ? 121 : 120, LW = Math.round(120 * 836 / 693);  // drawn size of boss_ladon
  const HEAD_DX = 0.30 * LW, HEAD_DY = -0.70 * LH;             // heads, relative to the feet (facing right)
  // Where the heads are in each animation (relative to the feet, facing right).
  const HEADS = { idle: [36, -86], strike: [40, -80], lunge: [57, -66], fire: [32, -96], stun: [40, -56], die: [40, -24] };
  const frameOf = () => {
    if (b.dead) return ['ladon_die', b.deathT > 0.7 ? 1 : 0, HEADS.die];
    switch (b.state) {
      case 'spitWind': return ['ladon_fire', Math.min(3, (b.t / 0.55) * 4), HEADS.fire];
      case 'lungeWind': return ['ladon_strike', Math.min(1, (b.t / 0.5) * 2), HEADS.strike];
      case 'lunge': case 'lunged': return ['ladon_strike', 2, HEADS.lunge];
      case 'retract': return ['ladon_strike', 3, HEADS.strike];
      case 'stunned': return ['ladon_stun', b.anim * 4, HEADS.stun];
      default: return ['ladon_idle', b.anim * 6, HEADS.idle];
    }
  };
  const headBox = () => ({ x: b.hx - 20, y: b.hy - 17, w: 40, h: 34 });
  const pose = () => {
    const bx = b.hole + b.face * b.lx * 0.5;
    const by = GROUND + (1 - b.rise) * LH;
    const tilt = anim ? 0 : b.face * ((b.ly / 72) * 0.8 + Math.sin(b.anim * 2) * 0.04);
    return { bx, by, tilt };
  };
  b.center = () => ({ x: b.hx, y: b.hy });
  b.update = (dt) => {
    b.t += dt; b.anim += dt;
    const P = A.P, hard = b.hard();
    if (b.dead) {
      b.deathT += dt;
      b.rise = Math.max(0, b.rise - dt * 0.5);
      if (Math.random() < 0.4) A.burst(b.hx, b.hy, pick(['#3fae4a', '#ffd34a']), 3, 70);
      if (b.deathT > 2.4) b.finished = true;
    } else {
      b.face = Math.sign(P.x + 6 - b.hole) || 1;
      switch (b.state) {
        case 'intro':
          b.rise = Math.min(1, b.t / 1.2);
          if (b.t > 1.6) { b.started = true; A.sfx('roar'); A.shake(5); b.go('idle'); }
          break;
        case 'under':
          b.rise = 0;
          if (b.t > 0.7) {
            const choices = holes.filter((h) => h !== b.hole);
            b.hole = Math.random() < 0.6 ? choices.reduce((a, c) => (Math.abs(c - P.x) > Math.abs(a - P.x) ? c : a)) : pick(choices);
            b.go('emerge'); A.sfx('stomp'); A.shake(3);
          }
          break;
        case 'emerge':
          b.rise = Math.min(1, b.t / 0.5);
          if (Math.random() < 0.5) A.particle(b.hole + rand(-10, 10), GROUND, rand(-60, 60), -rand(60, 140), '#8a7a52', 0.5, 2, 400);
          if (b.rise >= 1) b.go('idle');
          break;
        case 'idle':
          b.lx = lerp(b.lx, 0, dt * 5); b.ly = lerp(b.ly, 0, dt * 5);
          if (b.t > (hard ? 0.45 : 0.7)) {
            b.actions++;
            if (b.actions > 2) { b.actions = 0; b.go('sink'); }
            else b.go(Math.random() < 0.55 ? 'spitWind' : 'lungeWind');
          }
          break;
        case 'spitWind':
          if (b.t > 0.55) {
            A.sfx('fire');
            const a = Math.atan2(P.y + 14 - b.hy, P.x + 6 - b.hx);
            const n = hard ? 5 : 3;
            for (let i = 0; i < n; i++) {
              const s = (i - (n - 1) / 2) * 0.22;
              A.spawnProj({ x: b.hx, y: b.hy, vx: Math.cos(a + s) * 140, vy: Math.sin(a + s) * 140, r: 4, kind: 'fire', boss: true, owner: b });
            }
            b.go('idle');
          }
          break;
        case 'lungeWind':
          b.lx = lerp(b.lx, -18, dt * 8);
          if (b.t > 0.5) { b.go('lunge'); A.sfx('roar'); b.target = clamp(Math.abs(P.x + 6 - b.hole) - 6, 40, 150); }
          break;
        case 'lunge':
          b.lx = lerp(b.lx, b.target, Math.min(1, dt * 14));
          b.ly = lerp(b.ly, 72, Math.min(1, dt * 14));
          if (b.t > 0.25) b.go('lunged');
          break;
        case 'lunged':
          if (b.t > 1.1) b.go('retract');
          break;
        case 'retract':
          b.lx = lerp(b.lx, 0, dt * 6); b.ly = lerp(b.ly, 0, dt * 6);
          if (b.t > 0.45) b.go('idle');
          break;
        case 'stunned':
          b.ly = lerp(b.ly, 60, dt * 4);
          if (b.t > 1.6) b.go('retract');
          break;
        case 'sink':
          b.rise = Math.max(0, 1 - b.t / 0.5);
          b.lx = lerp(b.lx, 0, dt * 6); b.ly = lerp(b.ly, 0, dt * 6);
          if (b.rise <= 0) b.go('under');
          break;
      }
    }
    const { bx, by, tilt } = pose();
    const head = anim ? frameOf()[2] : [HEAD_DX, HEAD_DY];
    const dx = head[0] * b.face, dy = head[1] + Math.sin(b.anim * 3) * 2;
    b.hx = bx + dx * Math.cos(tilt) - dy * Math.sin(tilt);
    b.hy = by + dx * Math.sin(tilt) + dy * Math.cos(tilt);
  };
  b.hurtboxes = () => (b.dead || b.rise < 0.3 ? [] : [Object.assign(headBox(), { mult: b.state === 'lunged' || b.state === 'stunned' ? 1.5 : 1 })]);
  b.hitboxes = () => {
    if (b.dead || b.rise < 0.3 || b.state === 'intro' || b.state === 'stunned') return [];
    const { bx, by } = pose();
    return [headBox(), { x: bx - b.face * 12 - 24, y: Math.max(by - 64, GROUND - 64), w: 48, h: Math.min(64, GROUND - (by - 64)) }];
  };
  b.onReflect = () => {
    A.bossDamage(3, 'reflect');
    if (!b.dead) { b.go('stunned'); A.sfx('roar'); }
  };
  b.draw = (ctx) => {
    for (const h of holes) {
      ctx.fillStyle = '#1a120a'; ctx.beginPath(); ctx.ellipse(h, GROUND + 1, 16, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6a5a3a'; ctx.fillRect(h - 18, GROUND - 1, 4, 2); ctx.fillRect(h + 14, GROUND - 1, 4, 2);
    }
    if (b.rise <= 0.01) return;
    const { bx, by, tilt } = pose();
    const opt = flashOpt(b, { rot: tilt });
    if (b.dead) opt.alpha = Math.max(0, 1 - b.deathT / 2.4);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, 9999, GROUND + 2); ctx.clip();   // emerges from the burrow
    if (anim) { const [key, f] = frameOf(); delete opt.rot; drawSprite(ctx, key, f, bx, by, b.face < 0, opt); }
    else drawSprite(ctx, 'ladon', 0, bx, by, b.face < 0, opt);
    ctx.restore();
    const hx = b.hx, hy = b.hy;
    if (b.state === 'spitWind') { ctx.fillStyle = `rgba(255,160,40,${0.4 + Math.sin(b.t * 40) * 0.3})`; ctx.beginPath(); ctx.arc(hx + b.face * 14, hy + 4, 9, 0, 7); ctx.fill(); }
    if (b.state === 'stunned') { ctx.fillStyle = '#fff36a'; for (let i = 0; i < 3; i++) { const a = b.t * 6 + i * 2.1; ctx.fillRect(hx + Math.cos(a) * 18, hy - 20 + Math.sin(a) * 4, 2, 2); } }
  };
  return b;
}

// ---------------------------------------------------------------------------
// World 4: Celaeno, queen of harpies. Vulnerable while landed after a swoop.
// ---------------------------------------------------------------------------
function harpyqueen(x, y, A) {
  const b = base('Celaeno, Queen of Harpies', 22);
  Object.assign(b, { x, y: -60, side: 1 });
  b.center = () => ({ x: b.x, y: b.y });
  const box = () => ({ x: b.x - 18, y: b.y - 18, w: 36, h: 34 });
  b.update = (dt) => {
    b.t += dt; b.anim += dt;
    const P = A.P, hard = b.hard();
    if (b.dead) {
      b.deathT += dt;
      b.y += 80 * dt;
      if (Math.random() < 0.5) A.particle(b.x + rand(-20, 20), b.y + rand(-20, 20), rand(-40, 40), rand(-20, 40), '#d04a5a', 0.8, 2, 40, 'feather');
      if (b.deathT > 2.2) b.finished = true;
      return;
    }
    b.face = Math.sign(P.x + 6 - b.x) || 1;
    switch (b.state) {
      case 'intro':
        b.y = lerp(-60, 70, Math.min(1, b.t / 1.5));
        if (b.t > 1.8) { b.started = true; A.sfx('roar'); b.go('hover'); }
        break;
      case 'hover': {
        const tx = b.side > 0 ? 360 : 120;
        b.x = lerp(b.x, tx, dt * 1.5);
        b.y = lerp(b.y, 66 + Math.sin(b.anim * 2.5) * 10, dt * 3);
        if (b.t > (hard ? 1.2 : 1.7)) {
          b.side *= -1;
          const r = Math.random();
          if (r < 0.25 && A.countEnemies('harpy') < 2) b.go('summon');
          else if (r < 0.62) b.go('feathers');
          else b.go('swoopWind');
        }
        break;
      }
      case 'feathers': {
        const volley = () => {
          A.sfx('shoot');
          const a = Math.atan2(P.y + 16 - b.y, P.x + 6 - b.x);
          for (let i = -2; i <= 2; i++) A.spawnProj({ x: b.x, y: b.y + 6, vx: Math.cos(a + i * 0.2) * 150, vy: Math.sin(a + i * 0.2) * 150, r: 3, kind: 'feather', boss: true, owner: b });
        };
        if (b.t > 0.5 && !b.v1) { b.v1 = true; volley(); }
        if (hard && b.t > 1.0 && !b.v2) { b.v2 = true; volley(); }
        if (b.t > 1.4) { b.v1 = b.v2 = false; b.go('hover'); }
        break;
      }
      case 'swoopWind':
        b.y = lerp(b.y, 40, dt * 4);
        if (b.t > 0.6) { b.sx = b.x; b.sy = b.y; b.tx = clamp(P.x + 6, 50, 430); b.go('swoop'); A.sfx('roar'); }
        break;
      case 'swoop': {
        const t = Math.min(1, b.t / 0.65);
        const cx = (b.sx + b.tx) / 2, cy = 240;
        b.x = (1 - t) ** 2 * b.sx + 2 * (1 - t) * t * cx + t * t * b.tx;
        b.y = (1 - t) ** 2 * b.sy + 2 * (1 - t) * t * cy + t * t * (GROUND - 22);
        if (t >= 1) { b.go('landed'); A.shake(4); A.sfx('stomp'); A.burst(b.x, GROUND, '#d8c8a0', 10, 100); }
        break;
      }
      case 'landed':
        if (b.t > (hard ? 1.1 : 1.5)) b.go('rise');
        break;
      case 'rise':
        b.y = lerp(b.y, 66, dt * 3);
        if (b.t > 0.7) b.go('hover');
        break;
      case 'summon':
        if (b.t > 0.4 && !b.summoned) {
          b.summoned = true; A.sfx('roar');
          A.spawnEnemy('h', 70, 80); A.spawnEnemy('h', 410, 80);
        }
        if (b.t > 0.9) { b.summoned = false; b.go('hover'); }
        break;
    }
  };
  b.hurtboxes = () => (b.dead ? [] : [Object.assign(box(), { mult: b.state === 'landed' ? 1.5 : 1 })]);
  b.hitboxes = () => (b.dead || b.state === 'intro' || b.state === 'landed' ? [] : [{ x: b.x - 12, y: b.y - 12, w: 24, h: 24 }]);
  b.onReflect = () => A.bossDamage(2, 'reflect');
  b.draw = (ctx) => {
    const opt = flashOpt(b);
    if (b.state === 'swoopWind' && Math.floor(b.t * 14) % 2) opt.variant = 'white';
    if (sprites.cel_fly) {
      // Generated Celaeno frames (tools/build-art.js)
      let key = 'cel_fly', f = b.anim * 10, feet = b.y + 30;
      if (b.dead) { key = 'cel_die'; f = Math.min(3, b.deathT * 2.5); opt.alpha = Math.max(0, 1.4 - b.deathT / 1.6); }
      else if (b.state === 'feathers') { key = 'cel_throw'; f = Math.min(3, (b.t / 0.6) * 4); }
      else if (b.state === 'swoopWind' || b.state === 'summon') { key = 'cel_screech'; f = 0; }
      else if (b.state === 'swoop') { key = 'cel_dive'; f = b.t < 0.3 ? 0 : 1; }
      else if (b.state === 'landed') { key = 'cel_land'; f = b.anim * 2; feet = b.y + 23; }
      drawSprite(ctx, key, f, b.x, feet, b.face < 0, opt);
    } else {
      let key = 'queen_fly', f = b.anim * 14;
      if (b.state === 'swoop') key = 'queen_dive';
      if (b.state === 'landed') { key = 'queen_idle'; f = b.anim * 10; }
      if (b.dead) opt.alpha = Math.max(0, 1 - b.deathT / 2.2);
      drawSprite(ctx, key, f, b.x, b.y + 42, b.face < 0, opt);
    }
    if (b.state === 'landed') { ctx.fillStyle = '#fff36a'; for (let i = 0; i < 3; i++) { const a = b.t * 6 + i * 2.1; ctx.fillRect(b.x + Math.cos(a) * 14, b.y - 30 + Math.sin(a) * 3, 2, 2); } }
  };
  return b;
}

// ---------------------------------------------------------------------------
// World 5: Cerberus. Three fire-breathing heads, leaps with shockwaves, charges into walls.
// ---------------------------------------------------------------------------
function cerberus(x, y, A) {
  const b = base('Cerberus, Hound of Hades', 32);
  Object.assign(b, { x: x - 40, y: y - 72, w: 80, h: 72, onGround: false });
  b.center = () => ({ x: b.x + b.w / 2 + b.face * 30, y: b.y + 32 });
  // The three heads are stacked at the front of the sprite.
  const mouths = () => [
    { x: b.x + b.w / 2 + b.face * 42, y: b.y + 44 },
    { x: b.x + b.w / 2 + b.face * 38, y: b.y + 34 },
    { x: b.x + b.w / 2 + b.face * 32, y: b.y + 24 },
  ];
  b.update = (dt) => {
    b.t += dt; b.anim += dt;
    b.vy = Math.min(b.vy + 1250 * dt, 520);
    if (b.dead) {
      b.deathT += dt; b.vx = 0;
      if (Math.random() < 0.4) A.burst(b.x + Math.random() * b.w, b.y + Math.random() * b.h, pick(['#ff6a2a', '#3a1010']), 3, 70);
      if (b.deathT > 2.4) b.finished = true;
      A.moveBody(b, dt, false);
      return;
    }
    const P = A.P, dx = P.x + 6 - (b.x + b.w / 2), hard = b.hard(), sp = hard ? 1.25 : 1;
    switch (b.state) {
      case 'intro':
        b.face = Math.sign(dx) || -1;
        if (b.t > 1.3) { b.started = true; A.sfx('roar'); A.shake(7); b.go('stalk'); }
        break;
      case 'stalk':
        b.face = Math.sign(dx) || b.face;
        b.vx = b.face * 50 * sp;
        if (b.t > 1.3 / sp) b.go(pick(['breathWind', 'breathWind', 'leapWind', 'chargeWind']));
        break;
      case 'breathWind':
        b.vx = 0; b.face = Math.sign(dx) || b.face;
        if (b.t > 0.6 / sp) b.go('breath');
        break;
      case 'breath': {
        const shoot = () => {
          A.sfx('fire');
          for (const [i, m] of mouths().entries()) {
            const a = Math.atan2(P.y + 16 - m.y, P.x + 6 - m.x) + (i - 1) * 0.28;
            A.spawnProj({ x: m.x, y: m.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, r: 4, kind: 'fire', boss: true, owner: b });
          }
        };
        if (!b.s1) { b.s1 = true; shoot(); }
        if (hard && b.t > 0.45 && !b.s2) { b.s2 = true; shoot(); }
        if (b.t > 0.8) { b.s1 = b.s2 = false; b.go('recover'); }
        break;
      }
      case 'leapWind':
        b.vx = 0;
        if (b.t > 0.45 / sp) { b.vy = -440; b.vx = clamp(dx / 0.85, -260, 260); b.face = Math.sign(dx) || b.face; b.go('leap'); A.sfx('jump'); }
        break;
      case 'leap':
        if (b.onGround && b.t > 0.15) {
          b.vx = 0; A.shake(8); A.sfx('stomp');
          for (const d of [-1, 1]) A.spawnProj({ x: b.x + b.w / 2 + d * 30, y: GROUND - 7, vx: d * 180, vy: 0, r: 7, kind: 'shock', reflectable: false, boss: true, ghost: true, life: 3 });
          b.go('recover');
        }
        break;
      case 'chargeWind':
        b.vx = 0; b.face = Math.sign(dx) || b.face;
        if (b.t > 0.7 / sp) { b.go('charge'); A.sfx('roar'); }
        break;
      case 'charge':
        b.vx = b.face * 270 * sp;
        if (b.hitWall) { A.shake(9); A.sfx('stomp'); b.vx = 0; b.go('stunned'); }
        break;
      case 'stunned':
        b.vx = 0;
        if (b.t > 1.7) b.go('stalk');
        break;
      case 'recover':
        b.vx = 0;
        if (b.t > 0.6 / sp) b.go('stalk');
        break;
    }
    A.moveBody(b, dt, false);
  };
  b.hurtboxes = () => (b.dead ? [] : [{ x: b.x, y: b.y - 14, w: b.w, h: b.h + 14, mult: b.state === 'stunned' ? 2 : 1 }]);
  b.hitboxes = () => (b.dead || b.state === 'intro' || b.state === 'stunned' ? [] : [{ x: b.x + 10, y: b.y + 10, w: b.w - 20, h: b.h - 10 }]);
  b.onReflect = () => A.bossDamage(2, 'reflect');
  b.draw = (ctx) => {
    let key = 'cer_walk', f = b.anim * 12;
    if (b.state === 'charge') { key = 'cer_run'; f = b.anim * 22; }
    else if (b.state === 'leap') { key = 'cer_jump'; f = 4 + clamp(b.t * 14, 0, 10); }
    else if (b.state !== 'stalk') { key = 'cer_idle'; f = b.anim * 8; }
    const fx = b.x + b.w / 2, fy = b.y + b.h + 3, flip = b.face < 0;
    const opt = flashOpt(b);
    if (b.dead) opt.alpha = Math.max(0, 1 - b.deathT / 2.4);
    drawSprite(ctx, key, f, fx, fy, flip, opt);
    if (b.state === 'breathWind') {
      const glow = 0.5 + Math.sin(b.t * 30) * 0.5;
      for (const m of mouths()) { ctx.fillStyle = `rgba(255,170,40,${glow * 0.6})`; ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, 7); ctx.fill(); }
    }
    if (b.state === 'stunned') { ctx.fillStyle = '#fff36a'; for (let i = 0; i < 3; i++) { const a = b.t * 5 + i * 2.1; ctx.fillRect(fx + b.face * 24 + Math.cos(a) * 14, b.y - 26 + Math.sin(a) * 4, 3, 3); } }
  };
  return b;
}

// ---------------------------------------------------------------------------
// World 6: Medusa. Her gaze petrifies unless you are invisible or turn it back with the shield.
// ---------------------------------------------------------------------------
function medusa(x, y, A) {
  const b = base('Medusa, the Gorgon', 28);
  Object.assign(b, { x: x - 17, y: y - 72, w: 34, h: 72, onGround: false, lastGaze: false, warned: false, tint: 0 });
  b.center = () => ({ x: b.x + b.w / 2, y: b.y + 16 });
  b.update = (dt) => {
    b.t += dt; b.anim += dt;
    b.vy = Math.min(b.vy + 1200 * dt, 500);
    b.tint = Math.max(0, b.tint - dt * 2);
    if (b.dead) {
      b.deathT += dt; b.vx = 0;
      if (b.deathT > 2.6) b.finished = true;
      A.moveBody(b, dt, false);
      return;
    }
    const P = A.P, dx = P.x + 6 - (b.x + b.w / 2), hard = b.hard();
    switch (b.state) {
      case 'intro':
        b.face = Math.sign(dx) || -1;
        if (b.t > 1.4) { b.started = true; A.sfx('roar'); b.go('slither'); }
        break;
      case 'slither': {
        b.face = Math.sign(dx) || b.face;
        const d = Math.abs(dx);
        b.vx = d < 110 ? -b.face * 55 : d > 170 ? b.face * 55 : 0;
        if (b.hitWall) b.vx = 0;
        if (b.t > (hard ? 1.1 : 1.5)) {
          if (d < 70) b.go('biteWind');
          else if (!b.lastGaze && Math.random() < 0.45) { b.lastGaze = true; b.go('gazeWind'); }
          else { b.lastGaze = false; b.go('arrowWind'); }
        }
        break;
      }
      case 'arrowWind':
        b.vx = 0; b.face = Math.sign(dx) || b.face;
        if (b.t > 0.5) {
          A.sfx('shoot');
          const cx = b.x + b.w / 2 + b.face * 14, cy = b.y + 20;
          const a = Math.atan2(P.y + 16 - cy, P.x + 6 - cx);
          const n = hard ? 5 : 3;
          for (let i = 0; i < n; i++) A.spawnProj({ x: cx, y: cy, vx: Math.cos(a + (i - (n - 1) / 2) * 0.16) * 175, vy: Math.sin(a + (i - (n - 1) / 2) * 0.16) * 175, r: 3, kind: 'venom', boss: true, owner: b });
          b.go('recover');
        }
        break;
      case 'gazeWind':
        b.vx = 0; b.face = Math.sign(dx) || b.face;
        b.tint = Math.min(1, b.t / (hard ? 1.0 : 1.3));
        if (!b.warned) { b.warned = true; A.banner('AVERT YOUR EYES!', 1.4); }
        if (b.t > (hard ? 1.0 : 1.3)) {
          b.go('gaze');
          A.sfx('gaze'); A.screenFlash(0.5);
          const facingMe = Math.sign(b.x + b.w / 2 - (P.x + 6)) === P.face;
          if (P.invisible) A.floatText(P.x + 6, P.y - 8, 'UNSEEN', '#c8b0ff');
          else if (P.shielding && facingMe) {
            A.sfx('reflect'); A.floatText(P.x + 6, P.y - 8, 'REFLECTED!', '#bfe9ff');
            b.go('stoned'); A.shake(5);
          } else {
            P.petrified = 1.5; A.sfx('stoned');
            A.hurtPlayer(1, b.x + b.w / 2, { ignoreInv: true });
            P.vx = 0;
          }
        }
        break;
      case 'gaze':
        b.tint = 1 - b.t / 0.4;
        if (b.t > 0.4) b.go('recover');
        break;
      case 'stoned':
        b.vx = 0;
        if (b.t > 2.8) { b.go('recover'); A.burst(b.x + b.w / 2, b.y + 20, '#9a9a8a', 12, 90); }
        break;
      case 'biteWind':
        b.vx = 0;
        if (b.t > 0.35) { b.go('bite'); A.sfx('slash'); }
        break;
      case 'bite':
        b.vx = b.face * 120;
        if (b.t > 0.3) b.go('recover');
        break;
      case 'recover':
        b.vx = 0;
        if (b.t > (hard ? 0.4 : 0.6)) b.go('slither');
        break;
    }
    A.moveBody(b, dt, false);
  };
  b.hurtboxes = () => (b.dead ? [] : [{ x: b.x, y: b.y, w: b.w, h: b.h, mult: b.state === 'stoned' ? 2 : 1 }]);
  b.hitboxes = () => {
    if (b.dead || b.state === 'intro' || b.state === 'stoned') return [];
    const r = [{ x: b.x + 6, y: b.y + 20, w: b.w - 12, h: b.h - 20 }];
    if (b.state === 'bite') r.push({ x: b.face > 0 ? b.x + b.w : b.x - 34, y: b.y + 10, w: 34, h: 30 });
    return r;
  };
  b.onReflect = () => A.bossDamage(2, 'reflect');
  b.draw = (ctx) => {
    let key = 'me_run', f = b.anim * 12;
    if (b.state === 'arrowWind' || b.state === 'bite' || b.state === 'biteWind') { key = 'me_attack'; f = 3 + b.t * 20; }
    else if (b.state === 'gazeWind' || b.state === 'gaze' || b.state === 'intro' || b.state === 'recover' || b.state === 'stoned' || (b.state === 'slither' && Math.abs(b.vx) < 1)) { key = 'me_idle'; f = b.anim * 5; }
    if (b.flash > 0 && b.state !== 'stoned') { key = 'me_hurt'; f = 4; }
    if (b.dead) { key = 'me_death'; f = Math.min(15, b.deathT * 8); }
    const opt = {};
    if (b.state === 'stoned') opt.variant = 'stone';
    else if (b.flash > 0) opt.variant = 'white';
    drawSprite(ctx, key, f, b.x + b.w / 2, b.y + b.h + 2, b.face < 0, opt);
    if ((b.state === 'gazeWind' || b.state === 'gaze') && !b.dead) {
      const ex = b.x + b.w / 2 + b.face * 8, ey = b.y + 8;
      ctx.fillStyle = `rgba(90,255,140,${0.5 + b.tint * 0.5})`;
      ctx.fillRect(Math.round(ex - 3), Math.round(ey), 2, 2); ctx.fillRect(Math.round(ex + 1), Math.round(ey), 2, 2);
      ctx.fillStyle = `rgba(90,255,140,${b.tint * 0.3})`; ctx.beginPath(); ctx.arc(ex, ey, 6 + b.tint * 10, 0, 7); ctx.fill();
    }
  };
  b.drawOverlay = (ctx) => {
    if (b.tint > 0) {
      ctx.fillStyle = `rgba(60,255,120,${b.tint * (b.state === 'gaze' ? 0.45 : 0.18)})`;
      ctx.fillRect(0, 0, A.VW, A.VH);
    }
  };
  return b;
}

// ---------------------------------------------------------------------------
// World 7: Cetus. Rises from the sea; the Gorgon's gaze stuns it and lowers its head.
// ---------------------------------------------------------------------------
function cetus(x, y, A) {
  const b = base('Cetus, Leviathan of the Deep', 40);
  Object.assign(b, { bx: 372, by: 440, ox: 0, oy: 0, behindTiles: true, geysers: [], dropT: 10, lastSummon: 0, flashT: 0 });
  const REST = 300;
  const anim = !!sprites.cetus_idle;   // generated frames (tools/build-art.js)
  const headBox = () => {
    if (anim) { const left = b.bx + b.ox - 126, top = b.by + b.oy - 251; return { x: left + 18, y: top + 36, w: 82, h: 66 }; }
    const left = b.bx + b.ox - 136, top = b.by + b.oy - 230; return { x: left + 6, y: top + 14, w: 74, h: 62 };
  };
  const frameOf = () => {
    if (b.dead) return ['cetus_stun', 1];
    switch (b.state) {
      case 'intro': return ['cetus_roar', b.anim * 3];
      case 'stunned': return ['cetus_stun', b.t < 0.35 ? 0 : 1];
      case 'wave': case 'spit': case 'summon': return ['cetus_roar', b.t < 0.5 ? 0 : 1];
      case 'bite': return ['cetus_bite', b.t < 0.6 ? 0 : b.t < 1.0 ? 1 : b.t < 2.0 ? 2 : 3];
      default: return ['cetus_idle', b.anim * 4];
    }
  };
  b.center = () => { const h = headBox(); return { x: h.x + h.w / 2, y: h.y + h.h / 2 }; };
  const moveTo = (ox, oy, k, dt) => { b.ox = lerp(b.ox, ox, Math.min(1, dt * k)); b.oy = lerp(b.oy, oy, Math.min(1, dt * k)); };
  b.update = (dt) => {
    b.t += dt; b.anim += dt;
    const P = A.P, hard = b.hard(), sp = hard ? 1.3 : 1;
    // Geysers
    for (const g of b.geysers) {
      g.t += dt;
      if (g.t < 0 && Math.random() < 0.6) A.particle(g.x + rand(-8, 8), GROUND, 0, -rand(20, 60), '#bfe6ff', 0.4, 2);
      if (g.t >= 0 && !g.fired) { g.fired = true; A.sfx('splash'); A.spawnFx('splash', g.x, GROUND + 4); }
      if (g.t >= 0 && g.t < 0.55 && !P.dead && A.overlap({ x: g.x - 10, y: 24, w: 20, h: GROUND - 24 }, P)) A.hurtPlayer(1, g.x);
    }
    b.geysers = b.geysers.filter((g) => g.t < 0.6);
    if (b.dead) {
      b.deathT += dt;
      b.by += 45 * dt;
      if (Math.random() < 0.5) A.particle(b.bx + rand(-120, 120), GROUND, rand(-40, 40), -rand(60, 160), '#bfe6ff', 0.6, 2, 300);
      if (b.deathT > 1 && A.L.andromeda && !A.L.andromeda.free) {
        A.L.andromeda.free = true;
        A.burst(A.L.andromeda.x, A.L.andromeda.y - 22, '#cfcfd8', 16, 120);
        A.sfx('break');
      }
      if (b.deathT > 3.2) b.finished = true;
      return;
    }
    // Keep the Gorgon's power within reach: draughts wash ashore when you run dry.
    b.dropT -= dt;
    if (b.dropT <= 0 && A.run.charges < 2) { b.dropT = 12; A.dropPickup('draught', 40 + Math.random() * 60, 150); }
    switch (b.state) {
      case 'intro':
        b.by = lerp(440, REST, Math.min(1, b.t / 2.5));
        if (b.t < 0.05) { A.sfx('roar'); }
        A.shake(2);
        if (b.t > 2.8) { b.started = true; A.sfx('roar'); A.shake(8); b.go('idle'); }
        break;
      case 'idle':
        moveTo(0, Math.sin(b.anim * 1.5) * 6, 3, dt);
        if (b.t > 1.5 / sp) {
          const opts = ['spout', 'wave', 'spit', 'bite', 'bite'];
          if (A.countEnemies('harpy') < 2 && b.anim - b.lastSummon > 12) opts.push('summon', 'summon');
          b.go(pick(opts));
        }
        break;
      case 'spout':
        if (!b.queued) {
          b.queued = true;
          const n = hard ? 4 : 3;
          for (let i = 0; i < n; i++) b.geysers.push({ x: 0, t: -0.85 - i * 0.55, target: true, i });
        }
        for (const g of b.geysers) if (g.target && g.t > -0.85 && g.t < -0.8) { g.x = clamp(P.x + 6, 20, 440); g.target = false; }
        if (b.t > (hard ? 3.0 : 2.5)) { b.queued = false; b.go('idle'); }
        break;
      case 'wave':
        moveTo(10, -14, 4, dt);
        if (b.t > 0.6 && !b.waved) {
          b.waved = true; A.sfx('splash'); A.shake(4);
          A.spawnProj({ x: 420, y: GROUND - 13, vx: -150 * sp, vy: 0, r: 13, kind: 'wave', reflectable: false, boss: true, ghost: true, life: 3.6 });
        }
        if (b.t > 1.4) { b.waved = false; b.go('idle'); }
        break;
      case 'spit':
        moveTo(14, -10, 4, dt);
        if (b.t > 0.6 && !b.spat) {
          b.spat = true; A.sfx('shoot');
          const h = headBox(), mx = h.x + 6, my = h.y + 40;
          for (let i = 0; i < 3; i++) {
            const tt = 0.9 + i * 0.15;
            A.spawnProj({ x: mx, y: my, vx: (P.x + 6 - mx) / tt + rand(-20, 20), vy: (P.y + 10 - my) / tt - 150 * tt, grav: 300, r: 5, kind: 'water', boss: true, owner: b });
          }
        }
        if (b.t > 1.2) { b.spat = false; b.go('idle'); }
        break;
      case 'bite':
        if (b.t < 0.6) moveTo(24, -14, 5, dt);
        else if (b.t < 0.85) { if (b.t - dt < 0.6) A.sfx('roar'); moveTo(-150, 56, 14, dt); }
        else if (b.t < 2.0) moveTo(-150, 56 + Math.sin(b.t * 8) * 2, 10, dt);
        else { moveTo(0, 0, 3, dt); if (b.t > 2.6) b.go('idle'); }
        break;
      case 'summon':
        if (b.t > 0.5 && !b.sum) {
          b.sum = true; b.lastSummon = b.anim; A.sfx('roar');
          A.spawnEnemy('h', 190, 70); A.spawnEnemy('h', 300, 56);
        }
        if (b.t > 1.0) { b.sum = false; b.go('idle'); }
        break;
      case 'stunned':
        moveTo(-40, 46, 4, dt);
        if (b.t > 3.6) { b.go('idle'); A.burst(b.center().x, b.center().y, '#9a9a8a', 14, 100); }
        break;
    }
  };
  b.onGaze = () => {
    if (b.dead || b.state === 'intro') return;
    b.go('stunned'); b.geysers = []; A.sfx('stoned'); A.shake(5);
    A.floatText(b.center().x, b.center().y - 30, 'PETRIFIED!', '#7dffb0');
  };
  b.onReflect = () => { A.bossDamage(3, 'reflect'); };
  b.hurtboxes = () => (b.dead || b.state === 'intro' ? [] : [Object.assign(headBox(), { mult: b.state === 'stunned' ? 2 : 1 })]);
  b.hitboxes = () => {
    if (b.dead || b.state !== 'bite' || b.t < 0.6 || b.t > 2.1) return [];
    const h = headBox();
    return [{ x: h.x + 6, y: h.y + 8, w: h.w - 12, h: h.h - 12 }];
  };
  b.draw = (ctx) => {
    const opt = {};
    if (anim) {
      // The stun frames are already stone; flash white when struck.
      if (b.flash > 0) opt.variant = 'white';
      const [key, f] = frameOf();
      drawSprite(ctx, key, f, b.bx + b.ox, b.by + b.oy, true, opt);
    } else {
      if (b.state === 'stunned' || b.dead) opt.variant = 'stone';
      else if (b.flash > 0) opt.variant = 'white';
      const tilt = b.state === 'bite' && b.t > 0.6 && b.t < 2 ? -0.12 : 0;
      drawSprite(ctx, 'cetus', 0, b.bx + b.ox, b.by + b.oy, true, Object.assign(opt, { rot: tilt }));
    }
    if (b.state === 'stunned') {
      const c = b.center();
      ctx.fillStyle = '#7dffb0';
      for (let i = 0; i < 3; i++) { const a = b.t * 4 + i * 2.1; ctx.fillRect(c.x + Math.cos(a) * 30, c.y - 30 + Math.sin(a) * 6, 3, 3); }
    }
  };
  b.drawFront = (ctx) => {
    for (const g of b.geysers) {
      if (g.t < 0) {
        ctx.fillStyle = `rgba(200,235,255,${0.3 + Math.sin(g.t * 30) * 0.2})`;
        ctx.fillRect(Math.round(g.x - 10), GROUND - 4, 20, 4);
      } else {
        const hgt = Math.min(1, g.t / 0.12) * (GROUND - 24);
        ctx.fillStyle = 'rgba(120,190,255,0.75)'; ctx.fillRect(Math.round(g.x - 9), GROUND - hgt, 18, hgt);
        ctx.fillStyle = 'rgba(230,248,255,0.9)'; ctx.fillRect(Math.round(g.x - 4), GROUND - hgt, 5, hgt);
        ctx.fillRect(Math.round(g.x - 12), GROUND - hgt - 4, 24, 6);
      }
    }
  };
  return b;
}
