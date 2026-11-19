// Music uses the two tracks in assets/audio. Sound effects are synthesised
// chiptune-style with the Web Audio API so no extra files are needed.

const TRACKS = {
  stage: 'assets/audio/bgm_mythic_journey.mp3',
  boss: 'assets/audio/bgm_boss_clash.mp3',
  // CC0 tracks by Juhani Junkala (see CREDITS.md)
  title: 'assets/audio/music_title.mp3',
  level1: 'assets/audio/music_level1.mp3',
  level2: 'assets/audio/music_level2.mp3',
  level3: 'assets/audio/music_level3.mp3',
  ending: 'assets/audio/music_ending.mp3',
};

// Stage music per world (boss fights always use the boss track).
export const WORLD_TRACKS = [null, 'stage', 'level1', 'level2', 'level3', 'level1', 'level2', 'stage'];

// Sampled sound effects (CC0, Juhani Junkala). Anything not listed, or not yet loaded, is synthesised.
const SAMPLE_NAMES = ['coin', 'gem', 'hit', 'hurt', 'kill', 'break', 'stomp', 'bossdie', 'relic', 'altar', 'heal', 'select', 'confirm', 'jump', 'pause'];
const samples = {};
let samplesRequested = false;
function loadSamples() {
  if (samplesRequested || !ac) return;
  samplesRequested = true;
  for (const n of SAMPLE_NAMES) {
    fetch('assets/audio/sfx/' + n + '.wav')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => ac.decodeAudioData(b))
      .then((buf) => { samples[n] = buf; })
      .catch(() => { /* keep the synthesised version */ });
  }
}
function playSample(n) {
  const buf = samples[n];
  if (!buf || audioState.muted) return false;
  const s = ac.createBufferSource();
  s.buffer = buf;
  s.connect(master);
  s.start();
  return true;
}

let ac = null;
let master = null;
let current = null;
let currentName = null;
const music = {};
export const audioState = { muted: false, musicVol: 0.4, sfxVol: 0.55 };

try {
  const saved = localStorage.getItem('perseus_muted');
  if (saved === '1') audioState.muted = true;
} catch (e) { /* storage unavailable */ }

export function unlockAudio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = audioState.sfxVol;
      master.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume();
  loadSamples();
}

export function playMusic(name) {
  if (currentName === name) return;
  if (current) current.pause();
  currentName = name;
  current = null;
  if (!name) return;
  if (!music[name]) {
    const a = new Audio(TRACKS[name]);
    a.loop = true;
    music[name] = a;
  }
  current = music[name];
  current.volume = audioState.muted ? 0 : audioState.musicVol;
  current.currentTime = 0;
  const p = current.play();
  if (p && p.catch) p.catch(() => {});
}

// Silence everything while the tab is hidden; pick the track back up when it returns.
export function setHidden(hidden) {
  if (ac) { if (hidden) ac.suspend(); else ac.resume(); }
  if (!current) return;
  if (hidden) current.pause();
  else { const p = current.play(); if (p && p.catch) p.catch(() => {}); }
}

export function toggleMute() {
  audioState.muted = !audioState.muted;
  if (current) current.volume = audioState.muted ? 0 : audioState.musicVol;
  try { localStorage.setItem('perseus_muted', audioState.muted ? '1' : '0'); } catch (e) { /* ignore */ }
}

function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  if (!ac || audioState.muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, vol = 0.3, freq = 1200, delay = 0) {
  if (!ac || audioState.muted) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

const SFX = {
  jump: () => tone('square', 260, 520, 0.12, 0.18),
  djump: () => { tone('square', 400, 800, 0.1, 0.16); tone('triangle', 800, 1200, 0.12, 0.12, 0.04); },
  slash: () => noise(0.09, 0.25, 3000),
  hit: () => { tone('square', 180, 80, 0.1, 0.25); noise(0.06, 0.2, 2000); },
  clank: () => { tone('square', 900, 700, 0.08, 0.15); tone('triangle', 1400, 1300, 0.12, 0.1); },
  kill: () => { tone('square', 300, 60, 0.25, 0.22); noise(0.2, 0.2, 900); },
  coin: () => { tone('square', 988, 988, 0.06, 0.12); tone('square', 1318, 1318, 0.1, 0.12, 0.06); },
  gem: () => [0, 1, 2].forEach((i) => tone('square', 880 * (1 + i * 0.26), 880 * (1 + i * 0.26), 0.08, 0.12, i * 0.05)),
  pogo: () => tone('square', 330, 660, 0.09, 0.2),
  block: () => { tone('triangle', 1200, 900, 0.1, 0.22); noise(0.05, 0.15, 5000); },
  reflect: () => { tone('square', 700, 1400, 0.14, 0.2); },
  hurt: () => { tone('sawtooth', 400, 120, 0.25, 0.25); },
  pit: () => tone('triangle', 600, 100, 0.4, 0.25),
  break: () => { noise(0.18, 0.3, 1800); tone('square', 220, 110, 0.1, 0.12); },
  altar: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.25, 0.18, i * 0.08)),
  relic: () => [523, 659, 784, 1046, 1318].forEach((f, i) => { tone('square', f, f, 0.3, 0.12, i * 0.11); tone('triangle', f / 2, f / 2, 0.3, 0.15, i * 0.11); }),
  heal: () => [660, 880, 1100].forEach((f, i) => tone('triangle', f, f, 0.12, 0.18, i * 0.06)),
  invis: () => tone('sine', 900, 200, 0.4, 0.2),
  gaze: () => { tone('sawtooth', 120, 600, 0.35, 0.18); tone('square', 1200, 300, 0.4, 0.08); },
  petrify: () => { noise(0.3, 0.25, 700); tone('square', 200, 90, 0.25, 0.15); },
  roar: () => { noise(0.8, 0.35, 500); tone('sawtooth', 110, 55, 0.8, 0.2); },
  stomp: () => { noise(0.35, 0.4, 300); tone('sine', 90, 40, 0.35, 0.35); },
  shoot: () => tone('square', 600, 300, 0.08, 0.1),
  fire: () => noise(0.25, 0.22, 1400),
  splash: () => noise(0.5, 0.3, 900),
  bossdie: () => { noise(1.4, 0.4, 600); [196, 147, 110, 82].forEach((f, i) => tone('sawtooth', f, f * 0.7, 0.4, 0.18, i * 0.25)); },
  select: () => tone('square', 660, 660, 0.06, 0.15),
  confirm: () => { tone('square', 660, 660, 0.06, 0.15); tone('square', 990, 990, 0.1, 0.15, 0.06); },
  die: () => [440, 370, 311, 262, 220].forEach((f, i) => tone('square', f, f, 0.14, 0.18, i * 0.12)),
  thunder: () => noise(1.6, 0.35, 250),
  gate: () => [392, 523, 659].forEach((f, i) => tone('triangle', f, f, 0.2, 0.18, i * 0.07)),
  crumble: () => noise(0.25, 0.18, 600),
  stoned: () => { tone('square', 140, 70, 0.4, 0.2); noise(0.3, 0.2, 400); },
};

export function sfx(name) {
  if (!ac) return;
  if (playSample(name)) return;
  const f = SFX[name];
  if (f) { try { f(); } catch (e) { /* ignore */ } }
}
