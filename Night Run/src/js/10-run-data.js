  /* ================= NIGHT RUN: content and progress ================= */
  const ZONES = [
    { at: 0,    name: 'Bunny Slope',   color: '#3ddc84', shape: 'circle' },
    { at: 300,  name: 'Blue Ridge',    color: '#4aa3ff', shape: 'square' },
    { at: 750,  name: 'Black Diamond', color: '#e8eef7', shape: 'diamond' },
    { at: 1400, name: 'Double Black',  color: '#ff5577', shape: 'double' },
    { at: 2300, name: 'Backcountry',   color: '#ffb347', shape: 'warn' },
    { at: 3400, name: 'The Summit',    color: '#cdb4ff', shape: 'peak' },
    { at: 5000, name: 'Aurora Peak',   color: '#5cf2b0', shape: 'star' },
  ];
  const RARITY = { c: 'Common', r: 'Rare', e: 'Epic', l: 'Legendary', m: 'Mythic' };

  // Unlock rules: cost (flakes), lvl (player level), ach (achievement id), or free.
  const SKINS = [
    { id: 'rookie', n: 'Rookie', r: 'c', jacket: '#ffb347', stripe: '#ff7a3d', helmet: '#e8eef7', goggle: '#121c34' },
    { id: 'midnight', n: 'Midnight', r: 'c', jacket: '#2b3a67', stripe: '#8fd3ff', helmet: '#e8eef7', goggle: '#8fd3ff', rim: 1, cost: 200 },
    { id: 'glacier', n: 'Glacier', r: 'c', jacket: '#8fd3ff', stripe: '#ffffff', helmet: '#ffffff', goggle: '#2b3a67', cost: 300 },
    { id: 'pine', n: 'Pine Ranger', r: 'c', jacket: '#2f6b55', stripe: '#ffd24a', helmet: '#e8eef7', goggle: '#121c34', hat: 'beanie', hatC: '#ff7a3d', cost: 300 },
    { id: 'sunset', n: 'Alpenglow', r: 'c', jacket: '#ff6b8b', stripe: '#ffb347', helmet: '#fff2b0', goggle: '#5a2a4a', cost: 450 },
    { id: 'tux', n: 'Black Tie', r: 'r', jacket: '#1a1f2b', stripe: '#ffffff', helmet: '#1a1f2b', goggle: '#e8eef7', rim: 1, extra: 'bowtie', cost: 700 },
    { id: 'bee', n: 'Bumblebee', r: 'r', jacket: '#ffd24a', stripe: '#1a1f2b', helmet: '#1a1f2b', goggle: '#ffd24a', pattern: 'stripes', cost: 800 },
    { id: 'candy', n: 'Candy Cane', r: 'r', jacket: '#ff4466', stripe: '#ffffff', helmet: '#ffffff', goggle: '#ff4466', pattern: 'stripes', hat: 'beanie', hatC: '#ff4466', cost: 800 },
    { id: 'cozy', n: 'Cocoa Break', r: 'r', jacket: '#8a5a3c', stripe: '#f4e3c8', helmet: '#f4e3c8', goggle: '#3a2a1e', extra: 'scarf', scarf: '#ff5577', cost: 900 },
    { id: 'patrol', n: 'Ski Patrol', r: 'r', jacket: '#e23b3b', stripe: '#ffffff', helmet: '#ffffff', goggle: '#121c34', pattern: 'cross', cost: 1000 },
    { id: 'neon', n: 'Neon Pulse', r: 'e', jacket: '#ff2bd6', stripe: '#2bf5ff', helmet: '#2bf5ff', goggle: '#1a1f2b', glow: '255,43,214', cost: 1800 },
    { id: 'frostbite', n: 'Frostbite', r: 'e', jacket: '#bfeaff', stripe: '#5aa9e6', helmet: '#e8f8ff', goggle: '#1b3a5c', glow: '143,211,255', cost: 2000 },
    { id: 'astro', n: 'Astronaut', r: 'e', jacket: '#f4f8ff', stripe: '#ff7a3d', helmet: '#f4f8ff', goggle: '#ffb347', rim: 1, hat: 'visor', cost: 2400 },
    { id: 'yeti', n: 'Yeti', r: 'e', jacket: '#f4f8ff', stripe: '#cfe3f5', helmet: '#f4f8ff', goggle: '#4aa3ff', pattern: 'fur', lvl: 10 },
    { id: 'snowman', n: 'Mr. Frost', r: 'e', jacket: '#f4f8ff', stripe: '#1a1f2b', helmet: '#f4f8ff', goggle: '#121c34', pattern: 'buttons', hat: 'tophat', nose: 1, ach: 'login-7' },
    { id: 'medalist', n: 'Gold Medalist', r: 'e', jacket: '#ffd24a', stripe: '#ff7a3d', helmet: '#fff2b0', goggle: '#121c34', extra: 'medal', ach: 'score-25000' },
    { id: 'wildfire', n: 'Wildfire', r: 'l', jacket: '#ff4b2b', stripe: '#ffb347', helmet: '#1a1f2b', goggle: '#ffb347', aura: 'flames', ach: 'combo-25' },
    { id: 'phantom', n: 'Phantom', r: 'l', jacket: '#141826', stripe: '#ff4466', helmet: '#141826', goggle: '#ff4466', rim: 1, extra: 'cape', eyes: 1, ach: 'zone-4x-25' },
    { id: 'lantern', n: 'Lamplighter', r: 'l', jacket: '#ffb347', stripe: '#ffe0a8', helmet: '#e8eef7', goggle: '#121c34', extra: 'lantern', ach: 'lantL-500' },
    { id: 'spectre', n: 'Spectre', r: 'l', jacket: '#b48cff', stripe: '#e8eef7', helmet: '#e8eef7', goggle: '#3a2a6a', alpha: .6, glow: '180,140,255', ach: 'ghost-10' },
    { id: 'royal', n: 'Night Royalty', r: 'l', jacket: '#7a3fd6', stripe: '#ffd24a', helmet: '#e8eef7', goggle: '#121c34', hat: 'crown', lvl: 30 },
    { id: 'aurora', n: 'Aurora Borealis', r: 'm', jacket: 'aurora', stripe: '#ffffff', helmet: '#e8eef7', goggle: '#121c34', glow: '92,242,176', ach: 'zone-6' },
    { id: 'void', n: 'Voidwalker', r: 'm', jacket: '#07080f', stripe: '#b48cff', helmet: '#07080f', goggle: '#b48cff', rim: 1, eyes: 1, aura: 'stars', lvl: 50 },
    { id: 'champion', n: 'Champion', r: 'm', jacket: '#ffd24a', stripe: '#ffffff', helmet: '#ffffff', goggle: '#121c34', hat: 'crown', halo: 1, ach: 'ach-100' },
  ];
  const BOARDS = [
    { id: 'mint', n: 'Fresh Mint', r: 'c', c: '#5cf2b0' },
    { id: 'ember', n: 'Ember', r: 'c', c: '#ff7a3d', cost: 150 },
    { id: 'glacier', n: 'Blue Ice', r: 'c', c: '#8fd3ff', cost: 150 },
    { id: 'violet', n: 'Grape Soda', r: 'c', c: '#b48cff', cost: 250 },
    { id: 'bubble', n: 'Bubblegum', r: 'c', c: '#ff8fc7', cost: 250 },
    { id: 'gold', n: 'Gold Rush', r: 'r', c: '#ffd24a', cost: 600 },
    { id: 'crimson', n: 'Redline', r: 'r', c: '#ff4466', cost: 600 },
    { id: 'carbon', n: 'Carbon', r: 'r', c: '#2a3246', edge: '#8fd3ff', cost: 800 },
    { id: 'sunrise', n: 'First Light', r: 'e', c: ['#ff5577', '#ffd24a'], cost: 1400 },
    { id: 'ocean', n: 'Deep Sea', r: 'e', c: ['#4aa3ff', '#5cf2b0'], cost: 1400 },
    { id: 'galaxy', n: 'Galaxy', r: 'e', c: ['#3a2a6a', '#ff5cf0'], edge: '#ffffff', lvl: 15 },
    { id: 'aurora', n: 'Northern Lights', r: 'l', c: 'cycle', ach: 'zone-5' },
    { id: 'plasma', n: 'Plasma', r: 'l', c: 'plasma', ach: 'spin-6' },
    { id: 'chrome', n: 'Liquid Chrome', r: 'm', c: 'chrome', lvl: 45 },
  ];
  const TRAILS = [
    { id: 'powder', n: 'Powder', r: 'c', c: '#9fc0e4', a: .32 },
    { id: 'frost', n: 'Frostline', r: 'c', c: '#cfeeff', a: .6, cost: 300 },
    { id: 'mint', n: 'Mint Streak', r: 'c', c: '#5cf2b0', a: .6, cost: 400 },
    { id: 'gold', n: 'Gold Dust', r: 'r', c: '#ffd24a', a: .6, spark: '#fff2b0', cost: 900 },
    { id: 'neon', n: 'Neon Wire', r: 'r', c: '#ff2bd6', a: .8, w: 4, cost: 1100 },
    { id: 'ember', n: 'Ember Wake', r: 'e', c: '#ff7a3d', a: .65, fire: 1, cost: 1700 },
    { id: 'stardust', n: 'Stardust', r: 'e', c: '#ffffff', a: .5, spark: '#ffffff', w: 2, cost: 2000 },
    { id: 'twin', n: 'Twin Rails', r: 'e', c: '#8fd3ff', a: .7, twin: 1, lvl: 12 },
    { id: 'rainbow', n: 'Prism', r: 'l', c: 'rainbow', a: .7, w: 3.5, cost: 4000 },
    { id: 'aurora', n: 'Aurora Ribbon', r: 'l', c: 'aurora', a: .75, w: 5, ach: 'meters-5000' },
    { id: 'comet', n: 'Comet Tail', r: 'm', c: '#ffe7a8', a: .85, w: 4, spark: '#ffb347', fire: 1, ach: 'score-100000' },
  ];
  const CRASHES = [
    { id: 'puff', n: 'Powder Puff', r: 'c', sw: ['#e8eef7', '#8fd3ff', '#ffb347'] },
    { id: 'snow', n: 'Snow Bomb', r: 'c', sw: ['#ffffff', '#cfeeff', '#e8eef7'], cost: 400 },
    { id: 'confetti', n: 'Confetti', r: 'r', sw: ['#ff4466', '#ffd24a', '#5cf2b0', '#4aa3ff', '#b48cff'], cost: 900 },
    { id: 'shatter', n: 'Ice Shatter', r: 'r', sw: ['#8fd3ff', '#cfeeff', '#ffffff'], cost: 1200 },
    { id: 'fireworks', n: 'Fireworks', r: 'e', sw: ['#ffb347', '#ff4466', '#ffd24a', '#7fe8ff'], cost: 2200 },
    { id: 'ghost', n: 'Give Up the Ghost', r: 'e', sw: ['#b48cff', '#e8eef7'], lvl: 18 },
    { id: 'nova', n: 'Supernova', r: 'l', sw: ['#ffffff', '#ffd24a', '#ff5cf0', '#7fe8ff'], ach: 'smashL-500' },
  ];
  const COS = { skin: SKINS, board: BOARDS, trail: TRAILS, crash: CRASHES };
  const COS_LABEL = { skin: 'Riders', board: 'Boards', trail: 'Trails', crash: 'Wipeouts' };
  const cosItem = (kind, id) => COS[kind].find(x => x.id === id) || COS[kind][0];

  const UPG = [
    { id: 'flare', n: 'Long Burn', cost: [150, 400, 900, 1800], d: l => `Flares last ${(flareDur(l) / 60).toFixed(1)} s` },
    { id: 'magnet', n: 'Flake Magnet', cost: [120, 350, 800, 1600], d: l => l ? `Flakes drift to you from ${22 + l * 14} px, and magnets last ${(magnetDur(l) / 60).toFixed(0)} s` : 'Flakes nearby drift to you, and magnet pickups last longer' },
    { id: 'combo', n: 'Steady Nerves', cost: [200, 500, 1000, 2000], d: l => `Combos hold for ${(comboWin(l) / 60).toFixed(1)} s` },
    { id: 'soft', n: 'Soft Landing', cost: [250, 600, 1300], d: l => `Ride away from landings up to ${Math.round(landTol(l) * 180 / Math.PI)}° off` },
    { id: 'air', n: 'Big Air', cost: [250, 600, 1300], d: l => l ? `+${l * 10}% hang time off ramps and rails` : 'More hang time off ramps and rails' },
    { id: 'grind', n: 'Rail Wax', cost: [250, 600, 1300], d: l => l ? `Grinds score ${100 + l * 30}%` : 'Grinds score more' },
    { id: 'lucky', n: 'Lucky Flakes', cost: [300, 700, 1400, 2400, 4000], d: l => l ? `+${l * 10}% flakes from every run` : 'More flakes from every run' },
    { id: 'shield', n: 'Starter Shield', cost: [900], d: l => l ? 'Every run starts with a shield' : 'Start every run with a shield' },
  ];
  const flareDur = l => 210 + 45 * l, magnetDur = l => 300 + 120 * l, comboWin = l => 150 + 30 * l, landTol = l => .5 + .09 * l;

  const HEAD_START = 750;
  const BOOSTS = [
    { id: 'head', n: 'Head Start', short: 'Head start', cost: 250, d: `Drop in at ${ZONES[2].name} (${HEAD_START} m).` },
    { id: 'lant', n: 'Lit Lanterns', short: 'Flare ready', cost: 120, d: 'Start with a Flare ready to fire.' },
    { id: 'spare', n: 'Spare Shield', short: 'Extra shield', cost: 180, d: 'A second shield that kicks in when the first one breaks.' },
    { id: 'revive', n: 'Second Chance', short: '2nd chance', cost: 400, d: 'Ride on after your first wipeout.' },
  ];

  /* ---------- progress ---------- */
  const RUN_STATS = ['score', 'meters', 'maxCombo', 'nearMiss', 'tricks', 'maxSpin', 'grabs', 'airs', 'maxAir', 'rails', 'maxGrind', 'gates', 'gateMax', 'flakes', 'lanterns', 'flares', 'smashes', 'saves', 'leaps', 'zone', 'perfects', 'bestTrick', 'park', 'daily'];
  const LIFE_KEYS = ['runs', 'meters', 'score', 'flakes', 'tricks', 'rails', 'gates', 'nearMiss', 'smashes', 'airs', 'lanterns', 'flares', 'leaps', 'secs', 'grabs', 'perfects', 'dailyDays', 'missions', 'sweeps', 'ghosts', 'bc', 'crashes'];
  const blankStats = () => { const s = {}; for (const k of RUN_STATS) s[k] = 0; return s; };
  function cleanRunSave(r) {
    r = r && typeof r === 'object' ? r : {};
    const o = { best: int(r.best), bestPark: int(r.bestPark), mode: ['free', 'daily', 'park'].includes(r.mode) ? r.mode : 'free', tut: !!r.tut, up: {}, done: strList(r.done), bs: {}, life: {}, own: {}, eq: {}, kit: {}, top: [],
      dlast: typeof r.dlast === 'string' ? r.dlast.slice(0, 10) : '', dstreak: int(r.dstreak), missions: null };
    for (const u of UPG) o.up[u.id] = Math.min(u.cost.length, int(r.up && r.up[u.id]));
    for (const k of RUN_STATS) o.bs[k] = int(r.bs && r.bs[k]);
    for (const k of LIFE_KEYS) o.life[k] = int(r.life && r.life[k]);
    for (const kind in COS) {
      o.own[kind] = strList(r.own && r.own[kind]).filter(id => COS[kind].some(x => x.id === id));
      const want = r.eq && r.eq[kind]; o.eq[kind] = COS[kind].some(x => x.id === want) ? want : COS[kind][0].id;
    }
    for (const b of BOOSTS) o.kit[b.id] = !!(r.kit && r.kit[b.id]);
    if (Array.isArray(r.top)) o.top = r.top.filter(t => t && typeof t === 'object').map(t => ({ s: int(t.s), d: int(t.d), z: clamp(int(t.z), 0, ZONES.length - 1), m: String(t.m || 'free').slice(0, 8) })).slice(0, 8);
    const M = r.missions; if (M && typeof M.day === 'string' && Array.isArray(M.prog) && Array.isArray(M.done)) o.missions = { day: M.day.slice(0, 10), prog: [0, 1, 2].map(i => int(M.prog[i])), done: [0, 1, 2].map(i => !!M.done[i]), bonus: !!M.bonus };
    return o;
  }
  let R = save.games.run = cleanRunSave(save.games.run);
  const up = id => R.up[id] || 0;
  function cosOwned(kind, it) {
    if (!it.cost && !it.lvl && !it.ach) return true;
    if (R.own[kind].includes(it.id)) return true;
    if (it.lvl) return level() >= it.lvl;
    if (it.ach) return R.done.includes(it.ach);
    return false;
  }
  const cosHow = it => it.cost ? `${fmt(it.cost)} flakes` : it.lvl ? `Reach level ${it.lvl}` : it.ach ? (achById(it.ach) || { t: 'Achievement' }).t : 'Free';
  const cosCount = kind => COS[kind].filter(it => cosOwned(kind, it)).length;
  // Never leave something equipped that isn't owned (a reset, or a rule that changed).
  function fixEquipped() { for (const kind in COS) if (!cosOwned(kind, cosItem(kind, R.eq[kind]))) R.eq[kind] = COS[kind][0].id; }

  /* ---------- achievements ---------- */
  const TIERS = { b: { n: 'Bronze', c: '#d08a4e', r: 30 }, s: { n: 'Silver', c: '#c9d6e8', r: 80 }, g: { n: 'Gold', c: '#ffd24a', r: 200 }, p: { n: 'Platinum', c: '#7fe8ff', r: 500 }, m: { n: 'Mythic', c: '#ff5cf0', r: 1500 } };
  // [category, id prefix, stat, 'run' | 'life', text, tiers [target, tier, name]]
  const FAMILIES = [
    ['Distance', 'meters', 'meters', 'run', 'Ride {n} m in one run', [[300, 'b', 'First Tracks'], [750, 'b', 'Finding an Edge'], [1500, 's', 'Cruise Control'], [2500, 's', 'Long Haul'], [3500, 'g', 'Thin Air'], [5000, 'g', 'Above the Clouds'], [7500, 'p', 'Endless Night'], [10000, 'p', 'Ten Thousand Turns'], [15000, 'm', 'Off the Map']]],
    ['Distance', 'metersL', 'meters', 'life', 'Ride {n} m in total', [[5000, 'b', 'Warming Up'], [25000, 's', 'Road Trip'], [100000, 'g', 'Cross Country'], [300000, 'p', 'Continental'], [1000000, 'm', 'A Million Meters']]],
    ['Score', 'score', 'score', 'run', 'Score {n} in one run', [[1000, 'b', 'Four Digits'], [3000, 'b', 'Warmed Up'], [7500, 's', 'On a Roll'], [15000, 's', 'Point Machine'], [25000, 'g', 'Mountain Legend'], [40000, 'g', 'Highlight Reel'], [60000, 'p', 'Untouchable'], [100000, 'p', 'Six Digits'], [200000, 'm', 'Night Myth']]],
    ['Score', 'scoreL', 'score', 'life', 'Score {n} in total', [[50000, 'b', 'Point Collector'], [250000, 's', 'Quarter Million'], [1000000, 'g', 'Millionaire'], [5000000, 'p', 'High Roller'], [20000000, 'm', 'Twenty Million Club']]],
    ['Combos', 'combo', 'maxCombo', 'run', 'Reach a x{n} combo', [[5, 'b', 'Close Shave'], [10, 's', 'Thread the Needle'], [15, 's', 'Living Dangerously'], [25, 'g', 'Daredevil'], [35, 'p', 'Ghost Through Trees'], [50, 'm', 'Perfect Fifty']]],
    ['Combos', 'miss', 'nearMiss', 'run', 'Pull off {n} near misses in one run', [[10, 'b', 'Brush Past'], [30, 's', 'Tree Hugger'], [75, 'g', 'Thrill Seeker'], [150, 'p', 'Adrenaline Junkie'], [300, 'm', 'Phantom Rider']]],
    ['Combos', 'missL', 'nearMiss', 'life', 'Pull off {n} near misses in total', [[100, 'b', 'Close Encounters'], [1000, 's', 'Risk Taker'], [5000, 'g', 'Fearless'], [20000, 'p', 'Ice in the Veins']]],
    ['Tricks', 'spin', 'maxSpin', 'run', 'Land a {deg}', [[1, 'b', 'Half Cab'], [2, 'b', 'Full Circle'], [3, 's', 'Five-Forty'], [4, 's', 'Double Spin'], [6, 'g', 'Ten-Eighty'], [8, 'p', 'Fourteen-Forty'], [10, 'm', 'Eighteen Hundred']]],
    ['Tricks', 'tricks', 'tricks', 'run', 'Land {n} tricks in one run', [[3, 'b', 'Trickster'], [6, 's', 'Show Off'], [10, 'g', 'Style Points'], [16, 'p', 'Air Show'], [25, 'm', 'Gravity Optional']]],
    ['Tricks', 'tricksL', 'tricks', 'life', 'Land {n} tricks in total', [[25, 'b', 'Spinner'], [150, 's', 'Twister'], [500, 'g', 'Cyclone'], [2000, 'p', 'Hurricane']]],
    ['Tricks', 'best', 'bestTrick', 'run', 'Score {n} from a single trick', [[500, 'b', 'Nice One'], [1500, 's', 'Stomped It'], [4000, 'g', 'Crowd Goes Wild'], [10000, 'p', 'Did You See That'], [25000, 'm', 'Physics Called']]],
    ['Tricks', 'grabs', 'grabs', 'life', 'Land {n} grabs in total', [[5, 'b', 'Got a Grip'], [50, 's', 'Sticky Gloves'], [250, 'g', 'Grab Bag']]],
    ['Tricks', 'perfect', 'perfects', 'life', 'Stick {n} perfect landings in total', [[5, 'b', 'Dead Straight'], [50, 's', 'Butter Smooth'], [250, 'g', 'Machine Precision'], [1000, 'p', 'Never Off Axis']]],
    ['Tricks', 'hang', 'maxAir', 'run', 'Stay airborne for {sec} s on one jump', [[90, 'b', 'Hang Time'], [120, 's', 'Big Air'], [150, 'g', 'Low Orbit']]],
    ['Tricks', 'leap', 'leaps', 'run', 'Jump {n} crevasse{s} in one run', [[1, 's', 'Leap of Faith'], [5, 'g', 'Gap Jumper'], [12, 'm', 'Bridge Not Needed']]],
    ['Rails & gates', 'rails', 'rails', 'run', 'Grind {n} rail{s} in one run', [[1, 'b', 'Rail Rat'], [4, 's', 'Grind Time'], [8, 'g', 'Steel Rider'], [14, 'p', 'Grind Lord']]],
    ['Rails & gates', 'grind', 'maxGrind', 'run', 'Score {n} from a single grind', [[150, 'b', 'Metal Contact'], [500, 's', 'Sparks Fly'], [1500, 'g', 'Endless Rail'], [5000, 'p', 'Welded On']]],
    ['Rails & gates', 'railsL', 'rails', 'life', 'Grind {n} rails in total', [[20, 'b', 'Rail Regular'], [150, 's', 'Grinder'], [600, 'g', 'Railroad']]],
    ['Rails & gates', 'gates', 'gateMax', 'run', 'Clear {n} slalom gates in a row', [[3, 'b', 'Slalom Rookie'], [6, 's', 'Weaver'], [10, 'g', 'Slalom Royalty'], [16, 'p', 'Olympic Line'], [24, 'm', 'Perfect Slalom']]],
    ['Rails & gates', 'gatesL', 'gates', 'life', 'Clear {n} slalom gates in total', [[50, 'b', 'Flag Bearer'], [400, 's', 'Course Setter'], [2000, 'g', 'Thousand Flags']]],
    ['Collecting', 'flakes', 'flakes', 'run', 'Grab {n} flakes in one run', [[25, 'b', 'Flurry'], [60, 's', 'Snow Globe'], [120, 'g', 'Blizzard Bank'], [220, 'p', 'Whiteout'], [400, 'm', 'Ice Age']]],
    ['Collecting', 'flakesL', 'flakes', 'life', 'Grab {n} flakes in total', [[250, 'b', 'Pocket Change'], [2000, 's', 'Snow Saver'], [10000, 'g', 'Frozen Assets'], [40000, 'p', 'Flake Tycoon']]],
    ['Collecting', 'lant', 'lanterns', 'run', 'Grab {n} lanterns in one run', [[4, 'b', 'Spark'], [10, 's', 'Torchbearer'], [20, 'g', 'Lighthouse'], [35, 'p', 'Sunrise at Midnight']]],
    ['Collecting', 'lantL', 'lanterns', 'life', 'Grab {n} lanterns in total', [[30, 'b', 'Night Light'], [150, 's', 'Glow Up'], [500, 'g', 'Lamplighter'], [1500, 'p', 'Keeper of the Flame']]],
    ['Flares', 'flares', 'flares', 'run', 'Fire {n} Flare{s} in one run', [[1, 'b', 'Flare Up'], [3, 's', 'Light Show'], [6, 'g', 'Firestorm']]],
    ['Flares', 'smash', 'smashes', 'run', 'Smash {n} things in one run', [[4, 'b', 'Fender Bender'], [12, 's', 'Wrecking Ball'], [25, 'g', 'Bulldozer'], [50, 'p', 'Unstoppable Force']]],
    ['Flares', 'smashL', 'smashes', 'life', 'Smash {n} things in total', [[50, 'b', 'Breaker'], [500, 'g', 'Wrecker'], [2500, 'p', 'Force of Nature']]],
    ['Flares', 'saves', 'saves', 'run', 'Get saved by {n} shield{s} in one run', [[1, 'b', 'Bubble Wrap'], [3, 's', 'Nine Lives'], [6, 'g', 'Indestructible']]],
    ['Daily', 'daily', 'daily', 'run', 'Score {n} on the daily course', [[3000, 'b', 'Daily Contender'], [10000, 's', 'Daily Threat'], [25000, 'g', 'Daily Dominator'], [60000, 'p', 'Daily Legend']]],
    ['Daily', 'ddays', 'dailyDays', 'life', 'Ride the daily course on {n} day{s}', [[1, 'b', 'Daily Grind'], [7, 's', 'Week of Snow'], [30, 'g', 'Monthly Regular'], [100, 'p', 'Hundred Days']]],
    ['Daily', 'mis', 'missions', 'life', 'Complete {n} mission{s}', [[1, 'b', 'On Assignment'], [15, 's', 'Field Agent'], [60, 'g', 'Special Ops'], [200, 'p', 'Mission Control']]],
    ['Daily', 'sweep', 'sweeps', 'life', 'Finish all three missions on {n} day{s}', [[1, 's', 'Clean Sweep'], [10, 'g', 'Ten Sweeps'], [40, 'p', 'Mission Master']]],
    ['Trick Park', 'park', 'park', 'run', 'Score {n} in Trick Park', [[5000, 'b', 'Park Rat'], [15000, 's', 'Local Hero'], [40000, 'g', 'Sponsored'], [90000, 'p', 'Pro Model'], [200000, 'm', 'Park Legend']]],
    ['Career', 'runs', 'runs', 'life', 'Finish {n} run{s}', [[1, 'b', 'Dropping In'], [25, 'b', 'Local'], [100, 's', 'Season Pass'], [400, 'g', 'Lifer'], [1500, 'p', 'Mountain Resident']]],
    ['Career', 'time', 'secs', 'life', 'Ride for {time} in total', [[1800, 'b', 'Half Hour Hero'], [10800, 's', 'Three Hour Tour'], [36000, 'g', 'Ten Hour Legend'], [180000, 'p', 'Fifty Hours Deep']]],
    ['Career', 'ghost', 'ghosts', 'life', 'Outride your own ghost {n} time{s}', [[1, 'b', 'Beat Yourself'], [10, 's', 'Ghostbuster'], [40, 'g', 'Always Better']]],
    ['Career', 'zone-4x', 'bc', 'life', 'Reach the Backcountry in {n} runs', [[5, 's', 'Explorer'], [25, 'g', 'Backcountry Regular'], [100, 'p', 'Into the Unknown']]],
  ];
  const ACH = [];
  for (const [cat, fam, k, scope, t, tiers] of FAMILIES) for (const [g, tier, n] of tiers) {
    const time = g >= 3600 ? `${g / 3600} hour${g === 3600 ? '' : 's'}` : `${g / 60} minutes`;
    ACH.push({ id: `${fam}-${g}`, cat, n, tier, k, g, scope, t: t.replace('{n}', fmt(g)).replace('{deg}', g * 180).replace('{sec}', (g / 60).toFixed(1)).replace('{time}', time).replace('{s}', g === 1 ? '' : 's') });
  }
  ZONES.forEach((z, i) => { if (i) ACH.push({ id: 'zone-' + i, cat: 'Distance', n: ['', 'Blue Skies', 'Into the Black', 'Double Trouble', 'Lights Out', 'Top of the World', 'Edge of the Sky'][i], tier: 'bbsgpm'[i - 1], k: 'zone', g: i, scope: 'run', t: 'Reach ' + z.name, flag: 1 }); });
  ACH.push(
    { id: 'login-7', cat: 'Career', n: 'Regular', tier: 's', t: 'Check in 7 days in a row', f: () => save.login.streak >= 7 },
    { id: 'login-30', cat: 'Career', n: 'Night Shift', tier: 'p', t: 'Check in on 30 days', f: () => save.login.total >= 30 },
    { id: 'lv-10', cat: 'Career', n: 'Rising Star', tier: 's', t: 'Reach level 10', f: () => level() >= 10 },
    { id: 'lv-25', cat: 'Career', n: 'Seasoned', tier: 'g', t: 'Reach level 25', f: () => level() >= 25 },
    { id: 'lv-50', cat: 'Career', n: 'Fixture of the Mountain', tier: 'p', t: 'Reach level 50', f: () => level() >= 50 },
    { id: 'gear-max', cat: 'Collection', n: 'Fully Loaded', tier: 's', t: 'Max out any upgrade', f: () => UPG.some(u => up(u.id) >= u.cost.length) },
    { id: 'gear-all', cat: 'Collection', n: 'Maxed Out', tier: 'p', t: 'Max out every upgrade', f: () => UPG.every(u => up(u.id) >= u.cost.length) },
    { id: 'skins-5', cat: 'Collection', n: 'Wardrobe', tier: 'b', t: 'Own 5 riders', f: () => cosCount('skin') >= 5 },
    { id: 'skins-12', cat: 'Collection', n: 'Walk-in Closet', tier: 'g', t: 'Own 12 riders', f: () => cosCount('skin') >= 12 },
    { id: 'boards-6', cat: 'Collection', n: 'Quiver', tier: 's', t: 'Own 6 boards', f: () => cosCount('board') >= 6 },
    { id: 'style-all', cat: 'Collection', n: 'Style Icon', tier: 'p', t: 'Own every trail and wipeout', f: () => cosCount('trail') >= TRAILS.length && cosCount('crash') >= CRASHES.length },
    { id: 'ach-25', cat: 'Collection', n: 'Overachiever', tier: 's', t: 'Unlock 25 achievements', f: () => achCount() >= 25 },
    { id: 'ach-60', cat: 'Collection', n: 'Trophy Case', tier: 'g', t: 'Unlock 60 achievements', f: () => achCount() >= 60 },
    { id: 'ach-100', cat: 'Collection', n: 'Hall of Fame', tier: 'p', t: 'Unlock 100 achievements', f: () => achCount() >= 100 },
  );
  const ACH_CATS = [...new Set(ACH.map(a => a.cat))];
  const ACH_BY = new Map(ACH.map(a => [a.id, a]));
  const achById = id => ACH_BY.get(id);
  R.done = R.done.filter(id => ACH_BY.has(id));
  const achCount = () => R.done.length;
  const achVal = (a, s) => a.scope === 'life' ? R.life[a.k] : Math.max(s ? s[a.k] || 0 : 0, R.bs[a.k] || 0);
  const achProg = a => a.f || a.flag ? -1 : Math.min(1, achVal(a) / a.g);
  // Returns the achievements that just unlocked. Their flakes are paid here.
  function checkAch(s) {
    const got = []; let again = true;
    while (again) {
      again = false;
      for (const a of ACH) {
        if (R.done.includes(a.id)) continue;
        let ok = false; try { ok = a.f ? !!a.f() : achVal(a, s) >= a.g; } catch (e) {}
        if (ok) { R.done.push(a.id); earn(TIERS[a.tier].r); got.push(a); again = true; }
      }
    }
    return got;
  }

  /* ---------- daily missions: three a day, the same for everyone ---------- */
  const MISSION_POOL = [
    ['run', 'meters', 'Ride {n} m in one run', 800, 1800, 3200], ['run', 'score', 'Score {n} in one run', 2500, 9000, 22000],
    ['run', 'maxCombo', 'Reach a x{n} combo', 5, 10, 18], ['run', 'tricks', 'Land {n} tricks in one run', 2, 5, 9],
    ['run', 'gateMax', 'Clear {n} gates in a row', 3, 6, 10], ['run', 'rails', 'Grind {n} rails in one run', 1, 3, 6],
    ['run', 'flakes', 'Grab {n} flakes in one run', 25, 60, 110], ['run', 'lanterns', 'Grab {n} lanterns in one run', 3, 7, 12],
    ['run', 'nearMiss', 'Pull off {n} near misses in one run', 10, 25, 50], ['run', 'smashes', 'Smash {n} things in one run', 2, 6, 12],
    ['run', 'park', 'Score {n} in Trick Park', 4000, 12000, 30000], ['run', 'bestTrick', 'Score {n} from one trick', 400, 1200, 3000],
    ['day', 'runs', 'Finish {n} runs today', 3, 6, 10], ['day', 'meters', 'Ride {n} m today', 3000, 8000, 15000],
    ['day', 'flakes', 'Grab {n} flakes today', 80, 180, 350], ['day', 'airs', 'Land {n} jumps today', 6, 15, 30],
    ['day', 'gates', 'Clear {n} gates today', 12, 30, 60], ['day', 'perfects', 'Stick {n} perfect landings today', 2, 5, 10],
  ];
  const MISSION_PAY = [60, 120, 220], MISSION_BONUS = 200, MISSION_TIER = ['Easy', 'Medium', 'Hard'];
  let missionsDay = '', missionsList = [];
  function curMissions() {
    rollDay();
    if (missionsDay !== dayKey) {
      const r = seeded('missions-' + dayKey), pool = MISSION_POOL.slice(), used = new Set(); missionsList = [];
      for (let tier = 0; tier < 3; tier++) {
        const ok = pool.filter(m => !used.has(m[1])), m = ok[Math.floor(r() * ok.length)];
        pool.splice(pool.indexOf(m), 1); used.add(m[1]);
        missionsList.push({ scope: m[0], k: m[1], g: m[3 + tier], t: m[2].replace('{n}', fmt(m[3 + tier])), tier, pay: MISSION_PAY[tier] });
      }
      missionsDay = dayKey;
    }
    if (!R.missions || R.missions.day !== dayKey) R.missions = { day: dayKey, prog: [0, 0, 0], done: [false, false, false], bonus: false };
    return missionsList;
  }
  const missionVal = (m, i, s, ending) => { const base = R.missions.prog[i], v = s ? s[m.k] || 0 : 0; return m.scope === 'run' ? Math.max(base, v) : m.k === 'runs' ? base + (ending ? 1 : 0) : base + v; };
  // Called a few times a second during a run and once when it ends (that's when day totals are banked).
  function missionTick(s, ending) {
    const ms = curMissions(), M = R.missions, got = [];
    ms.forEach((m, i) => {
      const v = Math.floor(missionVal(m, i, s, ending));
      if (ending) M.prog[i] = v;
      if (!M.done[i] && v >= m.g) { M.done[i] = true; earn(m.pay); R.life.missions++; got.push({ t: m.t, pay: m.pay }); }
    });
    if (!M.bonus && M.done.every(Boolean)) { M.bonus = true; earn(MISSION_BONUS); R.life.sweeps++; got.push({ t: 'All three missions', pay: MISSION_BONUS }); }
    return got;
  }
