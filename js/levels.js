// World definitions and hand-built stage maps.
//
// Each stage is a list of 30-column "screens", 17 rows tall (row 13 is normal ground level).
// Only rows that contain something are written; rows below 13 copy the ground from the row above.
//
// Legend
//   #  solid ground          =  one-way marble slab (jump up through, DOWN+JUMP to drop)
//   ^  bronze spikes (pogo)  B  cracked block (breakable)      X  crumbling platform
//   |  spectral wall (pass only while invisible with the Helm of Hades)
//   ~  deadly water / Styx    o  drachma coin
//   a  amphora (random loot)  n  nectar jar   d  draught jar (refills relic power)   C  chest
//   A  Olympian altar (checkpoint)   ?  hint sign    P  player start   G  gate to the boss
//   M  moving slab (left/right)      V  moving slab (up/down)
//   k  Spartan skeleton   K  skeleton spear-thrower   h  harpy   H  feather-throwing harpy
//   s  Stygian shade      e / E  sentinel eye looking left / right   v  venomous serpent
//   Z  boss spawn         Y  Andromeda (chained)
//   Decor (no collision): y tree, i column, S petrified statue, f torch

export const SW = 30;
export const ROWS = 17;
const G = '##############################';

function below(row) {
  let s = '';
  for (const c of row) s += (c === '#' || c === '^' || c === 'B' || c === '|') ? (c === '|' ? '.' : '#') : (c === '~' ? '~' : '.');
  return s;
}

function screen(def) {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    let s = def[r];
    if (s === undefined) s = r > 13 ? below(rows[r - 1]) : '';
    if (s.length > SW) throw new Error('Screen row ' + r + ' is longer than ' + SW + ': "' + s + '"');
    rows.push(s.padEnd(SW, '.'));
  }
  return rows;
}

// Fill a column range across several rows with a character.
function fillRows(def, r0, r1, str) {
  for (let r = r0; r <= r1; r++) def[r] = str;
  return def;
}

function stage(...screens) {
  const built = screens.map(screen);
  const rows = [];
  for (let r = 0; r < ROWS; r++) rows.push(built.map((s) => s[r]).join(''));
  return rows;
}

function arena(def) {
  const rows = screen(def);
  // Side walls keep the fight on one screen.
  return rows.map((row, r) => (r <= 12 ? '#' + row.slice(1, SW - 1) + '#' : row));
}

const CAVE = { 0: G, 1: G };

export const WORLDS = [
  {
    num: 1,
    name: 'Nemean Olive Groves',
    subtitle: 'Trial of the Golden Beast',
    theme: 'grove',
    boss: 'lion',
    bossName: 'The Nemean Lion',
    relic: 'harpe',
    intro: 'Sunlit hills above Nemea. A golden beast with an impervious hide stalks the groves.',
    signs: [
      'ARROWS or A/D to run. Z or SPACE to jump - hold it to jump higher.',
      'X or J strikes with your bronze xiphos. Smash amphorae for drachmas!',
      'Olympian altars restore your vitality and mark where you return if you fall.',
      'Ride the moving slab across the chasm.',
      'The Golden Beast lies beyond the gate. When it charges, leap aside - it reels after striking stone!',
    ],
    stage: stage(
      { 8: '...................ooo', 9: '..........o', 10: '.........o.o......=====',
        12: '..P..?.y.......a......?.y...k.', 13: G },
      { 9: '.........oo', 10: '........o..o', 11: '......................###',
        12: '....a....y............###..k', 13: '########....##################' },
      { 4: '.....................C', 5: '...................=====', 7: '..............ooo',
        8: '.............=====', 10: '.......=====..........h', 12: '..A..?..y...............a', 13: G },
      { 9: '.............ooo', 11: '..........................k',
        12: '..?....M..........a.....######', 13: '####...........######...######' },
      { 8: '...............ooo', 9: '..............=====', 10: '.........###..........###',
        11: '.........###..........###', 12: '######...###......k...###..y', 13: G },
      { 10: '..........ooooo', 12: '..y..k.....?.......a.....G...', 13: G },
    ),
    arena: arena({ 9: '.....====............====', 12: '..P.....................Z', 13: G }),
  },
  {
    num: 2,
    name: 'Marble Acropolis',
    subtitle: 'Trial of the Bronze Sentinel',
    theme: 'marble',
    boss: 'automaton',
    bossName: 'Talos, the Bronze Sentinel',
    relic: 'shield',
    intro: 'Temples of white marble crown the city. Something of bronze still guards the inner sanctum.',
    signs: [
      'THE HARPE: hold DOWN in mid-air to thrust downward. Bounce off spikes, foes and amphorae!',
      'Cracked blocks shatter under the Harpe. Some hide treasure.',
      'Hold UP while striking to slash overhead - perfect for swooping harpies.',
      'Crumbling marble gives way soon after you land. Keep moving!',
      'The Sentinel\'s bronze body is impervious. Strike its glowing head - from above!',
    ],
    stage: stage(
      { 9: '..........o...o...o', 12: '..P..?.a', 13: '#########^^^^^^^^^############' },
      { 6: '...........ooo', 7: '..........=====', 10: '...====..........======',
        11: '....i...............i', 12: '....i...k..?.BB.....i....k', 13: G },
      { 7: '..............ooo', 8: '.......h............h', 10: '..............===',
        12: '..A..?', 13: '######^^^^^^^^^^^^^^^^^^######' },
      { 3: '...................ooo', 4: '..................XXXXX', 7: '.............XXX',
        9: '........V', 12: '..?..a', 13: '######..........###########...' },
      { 8: '..........ooo', 10: '.........=====.....=====', 11: '....i.....................i',
        12: '...a.i.....k.........k.....i', 13: G },
      { 9: '...BB', 10: '...BB.....ooo', 11: '...BB', 12: '...BB..k..a.?..i...G.i', 13: G },
    ),
    arena: arena({ 9: '..=====..............=====', 12: '..P..................Z', 13: G }),
  },
  {
    num: 3,
    name: 'Garden of the Hesperides',
    subtitle: 'Trial of the Coiled Dragon',
    theme: 'garden',
    boss: 'dragon',
    bossName: 'Ladon, the Coiled Dragon',
    relic: 'kibisis',
    intro: 'At the edge of the world grows a tree of golden apples, and around its roots sleeps a serpent.',
    signs: [
      'THE SHIELD OF ATHENA: hold C or L to raise it. Missiles that strike it fly back at their owner!',
      'Harpies of the garden rain feathers. Shield up, or strike them overhead.',
      'Brambles below! Hop the slabs, or bounce across with the Harpe.',
      'Ladon spits fire. Turn its own flames back with the Aegis!',
    ],
    stage: stage(
      { 10: '...............ooo', 12: '..P..?.......y......K....v', 13: G },
      { 7: '.............ooo', 8: '............=====', 10: '.....=====...........=====',
        12: '...K.....y...........a...K', 13: '##########....################' },
      { 6: '.........H..........H', 10: '.............o.o.o', 12: '..A..?.........a...y...v', 13: G },
      { 8: '............ooo', 9: '.....K...............K', 10: '....=====...===...=====', 12: '.?',
        13: '###^^^^^^^^^^^^^^^^^^^^^^^^###' },
      { 4: '..............H', 6: '..................ooo', 7: '..................====',
        9: '............====', 10: '.............oo', 11: '......====', 12: '...a',
        13: '#####.....................####' },
      { 12: '....K..y...a.....?.....G...y', 13: G },
    ),
    arena: arena({ 8: '....===..............===', 12: '..P...........Z', 13: G }),
  },
  {
    num: 4,
    name: 'Peaks of Cyllene',
    subtitle: 'Trial of the Storm Harpy',
    theme: 'peak',
    boss: 'harpyqueen',
    bossName: 'Celaeno, Queen of Harpies',
    relic: 'sandals',
    intro: 'The mountain of Hermes rises above the clouds. Its crags crumble, and harpies nest on the summit.',
    signs: [
      'THE KIBISIS carries nectar. Press Q or U to drink and restore vitality.',
      'Crumbling crags ahead. Do not linger!',
      'Celaeno nests on the summit. Strike her when she lands after a dive.',
    ],
    stage: stage(
      { 10: '...........ooo', 11: '..........=====', 12: '..P..?..n..........h', 13: G },
      { 8: '.............ooo', 9: '.............XXX', 10: '.......XXX.........XXX',
        12: '...a.?', 13: '######...................#####' },
      { 7: '...........h.........h', 12: '..A.........k..........n......', 13: G },
      { 3: '........h', 4: '................ooo', 5: '...............######', 6: '...............######',
        7: '..........###########', 8: '..........###########', 9: '..........###########',
        10: '.....################', 11: '.....################', 12: '.....################...k', 13: G },
      { 6: '.........h.......h', 9: '.............XXX', 10: '.......XXX.........XXX', 11: '..........o.......o',
        12: '..n', 13: '#####....................#####' },
      { 12: '.....k....?......n.....G', 13: G },
    ),
    arena: arena({ 3: '..............Z', 6: '..........====....====', 9: '...====..............====',
      12: '..P', 13: G }),
  },
  {
    num: 5,
    name: 'Stygian Threshold',
    subtitle: 'Trial of the Three-Headed Hound',
    theme: 'styx',
    boss: 'cerberus',
    bossName: 'Cerberus',
    relic: 'helm',
    intro: 'Beneath the earth flows the Styx. Shades drift above its black water, and the hound of Hades waits.',
    signs: [
      'THE WINGED SANDALS: press JUMP again in mid-air to double jump. Hold JUMP while falling to glide.',
      'Stygian shades hurl spectral bolts. Your shield turns them back.',
      'Cerberus guards the gate of the dead. Three heads, three flames.',
    ],
    stage: stage(
      Object.assign({}, CAVE, { 8: '.......................#######', 9: '..........o..o..o......#######',
        10: '.......................#######', 11: '.......................#######',
        12: '..P..?.................#######', 13: '############~~~~~~~~##########' }),
      Object.assign({}, CAVE, { 6: '..............s', 8: '#######', 9: '#######..o...o...o...o',
        10: '#######', 11: '#######.......===', 12: '#######', 13: '#######~~~~~~~~~~~~~~~~~######' }),
      Object.assign({}, CAVE, { 8: '..........====......====', 12: '..A..?.......s..........a', 13: G }),
      Object.assign({}, CAVE, { 3: '..........s', 4: '.................ooo', 5: '.................===',
        6: '.....................s', 8: '............===', 9: '......................===',
        11: '.......===', 12: '...n', 13: '#####~~~~~~~~~~~~~~~~~~~~#####' }),
      Object.assign({}, CAVE, { 5: '...............s', 8: '.........o..........o', 10: '.........M..........M',
        13: '###~~~~~~~~~~~~~~~~~~~~~~~~###' }),
      Object.assign({}, CAVE, { 9: '.....s', 12: '..........?...a.......G', 13: G }),
    ),
    arena: arena(Object.assign({}, CAVE, { 9: '...====..............====', 12: '..P.................Z', 13: G })),
  },
  {
    num: 6,
    name: 'Isle of Sarpedon',
    subtitle: 'The Gorgon\'s Cavern',
    theme: 'gorgon',
    boss: 'medusa',
    bossName: 'Medusa',
    relic: 'head',
    intro: 'A cavern filled with statues that were once heroes. Somewhere in the dark, Medusa is listening.',
    signs: [
      'THE HELM OF HADES: press V or I to vanish. Sentinels cannot see you while the helm lasts.',
      'Spectral barriers bar the living. Vanish to walk through them.',
      'Medusa\'s gaze turns flesh to stone. Raise the mirror-shield toward her - or vanish!',
    ],
    stage: stage(
      Object.assign({}, CAVE, { 9: '...............ooo', 10: '..............=====',
        11: '.............................e', 12: '..P..?...S..............S', 13: G }),
      Object.assign(fillRows(Object.assign({}, CAVE), 2, 12, '..........|.........|'), {
        6: '..........|...ooo...|', 11: '..........|.........|........e', 12: '..?.......|.........|....s', 13: G }),
      Object.assign({}, CAVE, { 10: '.............===', 12: '..A..d.......s........S.v', 13: '##########~~~~~~~~~~##########' }),
      Object.assign(fillRows(Object.assign({}, CAVE), 2, 12, '..............|'), {
        7: '......ooo.....|', 8: '.....=====....|....=====', 11: '..............|..............e',
        12: '..S...........|...........S..', 13: G }),
      Object.assign({}, CAVE, { 6: '..........ooo', 9: '........=====......=====', 12: '...k....S..v..s.....k...S', 13: G }),
      Object.assign({}, CAVE, { 12: '.....?......n.....G', 13: G }),
    ),
    arena: arena(Object.assign({}, CAVE, { 9: '...====..............====', 12: '..P..S..............Z....S', 13: G })),
  },
  {
    num: 7,
    name: 'Coast of Joppa',
    subtitle: 'Wrath of Cetus',
    theme: 'coast',
    boss: 'cetus',
    bossName: 'Cetus, Leviathan of the Deep',
    relic: null,
    intro: 'A storm batters the coast of Joppa. Princess Andromeda is chained to the sea cliff as an offering to Cetus.',
    signs: [
      'THE HEAD OF MEDUSA: press B or O to unleash its gaze. Foes turn to stone - and stone makes a fine stepping block.',
      'Petrify the harpies above the waves and leap across them.',
      'Andromeda is chained upon the cliff. Cetus rises. Its gaze-stunned head is vulnerable!',
    ],
    stage: stage(
      { 10: '..............ooo', 12: '..P..?.....k......k.....d', 13: G },
      // A sea rock mid-crossing: a strong double jump + glide makes it, petrified harpies make it easy.
      { 9: '............h.......h', 11: '..................##', 12: '.....?............##', 13: '########~~~~~~~~~~##~~~~~~~~~~' },
      { 9: '....h', 10: '........................h', 12: '..........A....d........##', 13: '~~~~~~~~##########~~~~~~##~~~~' },
      { 6: '..................s', 10: '...##', 11: '...##', 12: '...##......k',
        13: '~~~##~~~~~~####~~~~~~~~~######' },
      { 6: '........................k', 7: '..................############', 8: '..................############',
        9: '............K.....############', 10: '........######################',
        11: '........######################', 12: '...K....######################', 13: G },
      fillRows({ 5: '.......ooo', 6: '.....?......d.......G', 13: G }, 7, 12, G),
    ),
    arena: arena({ 3: '...........................Y', 4: '..........................####',
      5: '..........................####', 6: '..........................####', 7: '..........................####',
      8: '..........................####', 9: '..........................####', 10: '..................##......####',
      11: '............##....##......####', 12: '.P..........##....##...Z..####',
      13: '########~~~~##~~~~##~~~~~~####' }),
  },
];

export const RELICS = {
  harpe: { name: 'The Harpe', icon: 'I_harpe', small: 'i_harpe',
    text: ['A hooked adamantine blade-spear, gift of Hephaestus.', 'Longer reach. Hold DOWN in mid-air to thrust downward', 'and bounce off foes, spikes and amphorae.', 'Hold UP while striking to slash overhead.'] },
  shield: { name: 'Shield of Athena', icon: 'I_shield', small: 'i_shield',
    text: ['The polished Aegis, bright as a mirror.', 'Hold C / L / SHIFT to raise it and block from the front.', 'Missiles striking it are hurled back at their owner.'] },
  kibisis: { name: 'The Kibisis', icon: 'I_kibisis', small: 'i_kibisis',
    text: ['A sacred satchel woven by the Hesperides.', 'Nectar from jars is now stored (up to 3).', 'Press Q / U to drink and restore 3 vitality.'] },
  sandals: { name: 'Winged Sandals of Hermes', icon: 'I_sandals', small: 'i_sandals',
    text: ['The talaria of the messenger god.', 'Press JUMP in mid-air to double jump.', 'Hold JUMP while falling to glide on feathered heels.'] },
  helm: { name: 'Helm of Hades', icon: 'I_helm', small: 'i_helm',
    text: ['The cap of invisibility, lent by the lord of the dead.', 'Press V / I to vanish while the helm\'s power lasts.', 'Foes and sentinels cannot see you; spectral walls let you pass.'] },
  head: { name: 'Head of Medusa', icon: 'I_head', small: 'i_head',
    text: ['Sealed within the Kibisis, its gaze still burns.', 'Press B / O to unleash it: foes turn to solid stone', 'that you can stand on. Limited uses; altars and draughts restore it.'] },
};

export const RELIC_ORDER = ['harpe', 'shield', 'kibisis', 'sandals', 'helm', 'head'];
