  /* ================= content and progress ================= */
  const ZONES = [
    { at: 0,    name: 'Downtown',      color: '#3df5ff', kind: 'city' },
    { at: 1200, name: 'Neon Strip',    color: '#ff3dcb', kind: 'neon' },
    { at: 2800, name: 'Harbor Bridge', color: '#ffd24a', kind: 'bridge' },
    { at: 4600, name: 'The Tunnel',    color: '#ff7a3d', kind: 'tunnel' },
    { at: 6500, name: 'Hill Pass',     color: '#5cf2b0', kind: 'hills' },
    { at: 9000, name: 'Skyline',       color: '#b48cff', kind: 'sky' },
  ];
  const RARITY = { c: 'Common', r: 'Rare', e: 'Epic', l: 'Legendary', m: 'Mythic' };
  // Unlock rules: cost (coins), lvl (driver level), ach (trophy id), or free.
  const CARS = [
    { id: 'stock', n: 'Stock Coupe', r: 'c', c: '#e8eef7', c2: '#9aa6bd' },
    { id: 'cherry', n: 'Cherry Bomb', r: 'c', c: '#ff4d6d', c2: '#8a1c3c', cost: 200 },
    { id: 'cobalt', n: 'Cobalt', r: 'c', c: '#3d7bff', c2: '#16307a', cost: 200 },
    { id: 'lime', n: 'Lime Light', r: 'c', c: '#9dff3d', c2: '#3a6b12', cost: 350 },
    { id: 'taxi', n: 'Night Cab', r: 'r', c: '#ffd24a', c2: '#1a1a22', stripe: 'check', cost: 700 },
    { id: 'tuxedo', n: 'Black Tie', r: 'r', c: '#16161f', c2: '#f1eeff', stripe: 'twin', cost: 800 },
    { id: 'sunset', n: 'Sunset Strip', r: 'r', c: ['#ff7a3d', '#ff3dcb'], c2: '#3a0f2e', cost: 1000 },
    { id: 'patrol', n: 'Interceptor', r: 'r', c: '#f1eeff', c2: '#16161f', stripe: 'bar', lights: 1, cost: 1200 },
    { id: 'miami', n: 'Vice', r: 'e', c: ['#3df5ff', '#ff3dcb'], c2: '#0b0a1a', stripe: 'twin', cost: 2000 },
    { id: 'gold', n: 'Gold Standard', r: 'e', c: ['#fff2b0', '#d99a1a'], c2: '#5a3a00', cost: 2600 },
    { id: 'ghost', n: 'Ghost Rider', r: 'e', c: '#cfc8ff', c2: '#6a5fc2', alpha: .62, lvl: 10 },
    { id: 'racer', n: 'Number 7', r: 'e', c: '#f1eeff', c2: '#ff4d6d', stripe: 'num', ach: 'cp-12' },
    { id: 'toxic', n: 'Toxic', r: 'l', c: ['#9dff3d', '#12331a'], c2: '#0b0a1a', glowBody: '157,255,61', ach: 'combo-30' },
    { id: 'chrome', n: 'Liquid Chrome', r: 'l', c: 'chrome', c2: '#5d6880', lvl: 25 },
    { id: 'prism', n: 'Prism', r: 'l', c: 'cycle', c2: '#0b0a1a', ach: 'zone-5' },
    { id: 'dawn', n: 'Dawnbreaker', r: 'm', c: ['#ffd24a', '#ff4d6d'], c2: '#2b0522', stripe: 'twin', glowBody: '255,210,74', ach: 'meters-15000' },
  ];
  const GLOWS = [
    { id: 'none', n: 'Stock Lights', r: 'c', c: '' },
    { id: 'cyan', n: 'Cyan', r: 'c', c: '61,245,255', cost: 250 },
    { id: 'pink', n: 'Hot Pink', r: 'c', c: '255,61,203', cost: 250 },
    { id: 'lime', n: 'Acid', r: 'r', c: '157,255,61', cost: 600 },
    { id: 'amber', n: 'Amber', r: 'r', c: '255,179,71', cost: 600 },
    { id: 'violet', n: 'Ultraviolet', r: 'e', c: '160,110,255', cost: 1400 },
    { id: 'white', n: 'Arctic', r: 'e', c: '235,245,255', lvl: 8 },
    { id: 'red', n: 'Redline', r: 'l', c: '255,60,80', ach: 'kmh-330' },
    { id: 'rainbow', n: 'Spectrum', r: 'm', c: 'cycle', ach: 'score-150000' },
  ];
  const COS = { car: CARS, glow: GLOWS }, COS_LABEL = { car: 'Cars', glow: 'Underglow' };
  const cosItem = (kind, id) => COS[kind].find(x => x.id === id) || COS[kind][0];

  const UPG = [
    { id: 'nitro', n: 'Bigger Tank', cost: [150, 400, 900, 1800], d: l => `Each nitro charge burns for ${(nitroBurn(l) / 60).toFixed(1)} s` },
    { id: 'draft', n: 'Slipstream', cost: [150, 400, 900, 1800], d: l => `Drafting fills nitro ${100 + l * 25}% as fast` },
    { id: 'clock', n: 'Night Owl', cost: [200, 500, 1100, 2200], d: l => `Checkpoints add ${l ? '+' + (l * .5).toFixed(1) + ' s extra' : 'more time'}` },
    { id: 'armor', n: 'Crash Bars', cost: [200, 500, 1100], d: l => `A crash costs ${(crashCost(l) / 60).toFixed(1)} s of night` },
    { id: 'combo', n: 'Cool Head', cost: [200, 500, 1000, 2000], d: l => `Combos hold for ${(comboWin(l) / 60).toFixed(1)} s` },
    { id: 'grip', n: 'Sticky Tyres', cost: [250, 600, 1300], d: l => l ? `Steering is ${l * 8}% sharper` : 'Sharper steering' },
    { id: 'magnet', n: 'Coin Magnet', cost: [150, 400, 900], d: l => l ? `Coins jump to you from ${30 + l * 18} px` : 'Coins nearby jump to you' },
    { id: 'lucky', n: 'Lucky Streak', cost: [300, 700, 1400, 2400, 4000], d: l => l ? `+${l * 10}% coins from every drive` : 'More coins from every drive' },
  ];
  const nitroBurn = l => 130 + 25 * l, crashCost = l => 240 - 40 * l, comboWin = l => 170 + 30 * l;

  const RUN_STATS = ['score', 'meters', 'maxCombo', 'nearMiss', 'oncoming', 'draft', 'nitros', 'coins', 'cps', 'kmh', 'clean', 'zone', 'daily', 'rush'];
  const LIFE_KEYS = ['runs', 'meters', 'score', 'coins', 'nearMiss', 'oncoming', 'draft', 'nitros', 'cps', 'crashes', 'secs', 'dailyDays', 'missions', 'sweeps'];
  const blankStats = () => { const s = {}; for (const k of RUN_STATS) s[k] = 0; s.crashes = 0; return s; };
  function cleanData(r) {
    r = r && typeof r === 'object' ? r : {};
    const o = { best: int(r.best), bestRush: int(r.bestRush), mode: ['free', 'daily', 'rush'].includes(r.mode) ? r.mode : 'free', tut: !!r.tut, up: {}, done: strList(r.done), bs: {}, life: {}, own: {}, eq: {}, top: [], dlast: typeof r.dlast === 'string' ? r.dlast.slice(0, 10) : '', missions: null };
    for (const u of UPG) o.up[u.id] = Math.min(u.cost.length, int(r.up && r.up[u.id]));
    for (const k of RUN_STATS) o.bs[k] = int(r.bs && r.bs[k]);
    for (const k of LIFE_KEYS) o.life[k] = int(r.life && r.life[k]);
    for (const kind in COS) { o.own[kind] = strList(r.own && r.own[kind]).filter(id => COS[kind].some(x => x.id === id)); const w = r.eq && r.eq[kind]; o.eq[kind] = COS[kind].some(x => x.id === w) ? w : COS[kind][0].id; }
    if (Array.isArray(r.top)) o.top = r.top.filter(t => t && typeof t === 'object').map(t => ({ s: int(t.s), d: int(t.d), z: clamp(int(t.z), 0, ZONES.length - 1), m: String(t.m || 'free').slice(0, 8) })).slice(0, 8);
    const M = r.missions; if (M && typeof M.day === 'string' && Array.isArray(M.prog) && Array.isArray(M.done)) o.missions = { day: M.day.slice(0, 10), prog: [0, 1, 2].map(i => int(M.prog[i])), done: [0, 1, 2].map(i => !!M.done[i]), bonus: !!M.bonus };
    return o;
  }
  let D = save.d = cleanData(save.d);
  const up = id => D.up[id] || 0;
  function cosOwned(kind, it) { return (!it.cost && !it.lvl && !it.ach) || D.own[kind].includes(it.id) || (it.lvl ? level() >= it.lvl : false) || (it.ach ? D.done.includes(it.ach) : false); }
  const cosHow = it => it.cost ? `${fmt(it.cost)} coins` : it.lvl ? `Reach level ${it.lvl}` : it.ach ? (ACH_BY.get(it.ach) || { t: 'Trophy' }).t : 'Free';
  const cosCount = kind => COS[kind].filter(it => cosOwned(kind, it)).length;
  function fixEquipped() { for (const kind in COS) if (!cosOwned(kind, cosItem(kind, D.eq[kind]))) D.eq[kind] = COS[kind][0].id; }

  /* ---------- trophies ---------- */
  const TIERS = { b: { n: 'Bronze', c: '#d08a4e', r: 30 }, s: { n: 'Silver', c: '#c9d6e8', r: 80 }, g: { n: 'Gold', c: '#ffd24a', r: 200 }, p: { n: 'Platinum', c: '#7fe8ff', r: 500 }, m: { n: 'Mythic', c: '#ff5cf0', r: 1500 } };
  const FAMILIES = [
    ['Distance', 'meters', 'meters', 'run', 'Drive {n} m in one night', [[1000, 'b', 'Out of the Garage'], [2500, 'b', 'Crosstown'], [4500, 's', 'Over the Water'], [6500, 's', 'Light at the End'], [9000, 'g', 'Above the City'], [12000, 'p', 'All-Nighter'], [15000, 'm', 'Dawn Can Wait']]],
    ['Distance', 'metersL', 'meters', 'life', 'Drive {n} m in total', [[10000, 'b', 'Breaking It In'], [50000, 's', 'High Mileage'], [200000, 'g', 'Road Warrior'], [1000000, 'p', 'Million Meter Club']]],
    ['Score', 'score', 'score', 'run', 'Score {n} in one night', [[2000, 'b', 'On the Board'], [8000, 'b', 'Warming the Tyres'], [20000, 's', 'Street Legal'], [40000, 's', 'Local Legend'], [75000, 'g', 'Night Shift Hero'], [150000, 'p', 'Untouchable'], [300000, 'm', 'Myth of the Motorway']]],
    ['Score', 'scoreL', 'score', 'life', 'Score {n} in total', [[100000, 'b', 'Point Collector'], [1000000, 's', 'Millionaire'], [10000000, 'g', 'High Roller']]],
    ['Risk', 'combo', 'maxCombo', 'run', 'Reach a x{n} combo', [[5, 'b', 'Paint Swapper'], [10, 's', 'Needle Threader'], [20, 'g', 'No Fear'], [30, 'p', 'Ice Cold'], [40, 'm', 'Perfect Forty']]],
    ['Risk', 'miss', 'nearMiss', 'run', 'Pull off {n} near misses in one night', [[10, 'b', 'Close Enough'], [30, 's', 'Mirror Clipper'], [75, 'g', 'Adrenaline Tax'], [150, 'p', 'Phantom Lane']]],
    ['Risk', 'missL', 'nearMiss', 'life', 'Pull off {n} near misses in total', [[100, 'b', 'Regular Offender'], [1000, 's', 'Habitual'], [10000, 'g', 'Career Criminal']]],
    ['Risk', 'onc', 'oncoming', 'run', 'Skim {n} oncoming car{s} in one night', [[1, 'b', 'Wrong Way'], [8, 's', 'Chicken Champion'], [25, 'g', 'Head-On Hero'], [60, 'p', 'Against the Grain']]],
    ['Risk', 'clean', 'clean', 'run', 'Drive {n} m without a crash', [[1500, 'b', 'Clean Sheet'], [4000, 's', 'Not a Scratch'], [8000, 'g', 'Showroom Finish'], [12000, 'm', 'Untouched']]],
    ['Speed', 'kmh', 'kmh', 'run', 'Hit {n} km/h', [[220, 'b', 'Pinned'], [270, 's', 'Warp Factor'], [300, 'g', 'Three Hundred'], [330, 'p', 'Sound Barrier']]],
    ['Speed', 'nitro', 'nitros', 'run', 'Fire {n} nitro charge{s} in one night', [[1, 'b', 'Light It Up'], [5, 's', 'Afterburner'], [12, 'g', 'Rocket Fuel'], [25, 'p', 'Always Burning']]],
    ['Speed', 'draft', 'draft', 'run', 'Draft for {n} seconds in one night', [[5, 'b', 'Tailgater'], [20, 's', 'Slipstreamer'], [50, 'g', 'Shadow']]],
    ['Speed', 'cp', 'cps', 'run', 'Clear {n} checkpoint{s} in one night', [[1, 'b', 'On Schedule'], [4, 's', 'Making Time'], [8, 'g', 'Ahead of the Sun'], [12, 'p', 'Number 7'], [18, 'm', 'Time Lord']]],
    ['Collecting', 'coins', 'coins', 'run', 'Grab {n} coins in one night', [[30, 'b', 'Loose Change'], [80, 's', 'Toll Collector'], [160, 'g', 'Armored Truck'], [300, 'p', 'Street Fortune']]],
    ['Collecting', 'coinsL', 'coins', 'life', 'Grab {n} coins in total', [[300, 'b', 'Pocket Money'], [3000, 's', 'Piggy Bank'], [15000, 'g', 'The Vault']]],
    ['Rush Hour', 'rush', 'rush', 'run', 'Score {n} in Rush Hour', [[3000, 'b', 'Commuter'], [8000, 's', 'Lane Splitter'], [18000, 'g', 'Gridlock Ghost'], [35000, 'p', 'Rush Hour Royalty']]],
    ['Daily', 'daily', 'daily', 'run', 'Score {n} on the daily route', [[5000, 'b', 'Daily Driver'], [20000, 's', 'Route Runner'], [60000, 'g', 'Route Master']]],
    ['Daily', 'ddays', 'dailyDays', 'life', 'Drive the daily route on {n} day{s}', [[1, 'b', 'Clocked In'], [7, 's', 'Week of Nights'], [30, 'g', 'Monthly Pass']]],
    ['Daily', 'mis', 'missions', 'life', 'Complete {n} job{s}', [[1, 'b', 'First Job'], [15, 's', 'Reliable'], [60, 'g', 'In Demand']]],
    ['Career', 'runs', 'runs', 'life', 'Finish {n} drive{s}', [[1, 'b', 'First Night'], [25, 'b', 'Regular'], [100, 's', 'Night Owl'], [400, 'g', 'Nocturnal']]],
    ['Career', 'crash', 'crashes', 'life', 'Crash {n} times', [[10, 'b', 'Fender Bender'], [100, 's', 'Insurance Nightmare']]],
  ];
  const ACH = [];
  for (const [cat, fam, k, scope, t, tiers] of FAMILIES) for (const [g, tier, n] of tiers) ACH.push({ id: `${fam}-${g}`, cat, n, tier, k, g, scope, t: t.replace('{n}', fmt(g)).replace('{s}', g === 1 ? '' : 's') });
  ZONES.forEach((z, i) => { if (i) ACH.push({ id: 'zone-' + i, cat: 'Distance', n: ['', 'Bright Lights', 'Over the Bay', 'Going Under', 'Into the Hills', 'Top of the World'][i], tier: 'bbsgp'[i - 1], k: 'zone', g: i, scope: 'run', t: 'Reach ' + z.name, flag: 1 }); });
  ACH.push(
    { id: 'lv-10', cat: 'Career', n: 'Licensed', tier: 's', t: 'Reach driver level 10', f: () => level() >= 10 },
    { id: 'lv-25', cat: 'Career', n: 'Professional', tier: 'g', t: 'Reach driver level 25', f: () => level() >= 25 },
    { id: 'gear-max', cat: 'Garage', n: 'Tuned', tier: 's', t: 'Max out any upgrade', f: () => UPG.some(u => up(u.id) >= u.cost.length) },
    { id: 'gear-all', cat: 'Garage', n: 'Fully Built', tier: 'p', t: 'Max out every upgrade', f: () => UPG.every(u => up(u.id) >= u.cost.length) },
    { id: 'cars-5', cat: 'Garage', n: 'Collector', tier: 's', t: 'Own 5 cars', f: () => cosCount('car') >= 5 },
    { id: 'cars-10', cat: 'Garage', n: 'Showroom', tier: 'g', t: 'Own 10 cars', f: () => cosCount('car') >= 10 },
  );
  const ACH_CATS = [...new Set(ACH.map(a => a.cat))], ACH_BY = new Map(ACH.map(a => [a.id, a]));
  D.done = D.done.filter(id => ACH_BY.has(id));
  const achCount = () => D.done.length;
  const achVal = (a, s) => a.scope === 'life' ? D.life[a.k] : Math.max(s ? s[a.k] || 0 : 0, D.bs[a.k] || 0);
  const achProg = a => a.f || a.flag ? -1 : Math.min(1, achVal(a) / a.g);
  function checkAch(s) {
    const got = []; let again = true;
    while (again) { again = false; for (const a of ACH) { if (D.done.includes(a.id)) continue; let ok = false; try { ok = a.f ? !!a.f() : achVal(a, s) >= a.g; } catch (e) {} if (ok) { D.done.push(a.id); earn(TIERS[a.tier].r); got.push(a); again = true; } } }
    return got;
  }

  /* ---------- daily jobs: three a day, the same for everyone ---------- */
  const MISSION_POOL = [
    ['run', 'meters', 'Drive {n} m in one night', 1500, 3500, 6500], ['run', 'score', 'Score {n} in one night', 5000, 20000, 50000],
    ['run', 'maxCombo', 'Reach a x{n} combo', 5, 10, 18], ['run', 'nearMiss', 'Pull off {n} near misses in one night', 10, 25, 50],
    ['run', 'cps', 'Clear {n} checkpoints in one night', 2, 4, 7], ['run', 'nitros', 'Fire {n} nitro charges in one night', 2, 5, 9],
    ['run', 'coins', 'Grab {n} coins in one night', 25, 60, 110], ['run', 'kmh', 'Hit {n} km/h', 220, 260, 300],
    ['run', 'clean', 'Drive {n} m without a crash', 1000, 2500, 5000], ['run', 'rush', 'Score {n} in Rush Hour', 2500, 7000, 15000],
    ['day', 'runs', 'Finish {n} drives today', 3, 6, 10], ['day', 'meters', 'Drive {n} m today', 6000, 15000, 30000],
    ['day', 'coins', 'Grab {n} coins today', 80, 180, 350], ['day', 'draft', 'Draft for {n} seconds today', 10, 30, 60],
  ];
  const MISSION_PAY = [60, 120, 220], MISSION_BONUS = 200, MISSION_TIER = ['Easy', 'Medium', 'Hard'];
  let missionsDay = '', missionsList = [];
  function curMissions() {
    rollDay();
    if (missionsDay !== dayKey) {
      const r = seeded('drive-jobs-' + dayKey), pool = MISSION_POOL.slice(), used = new Set(); missionsList = [];
      for (let tier = 0; tier < 3; tier++) { const ok = pool.filter(m => !used.has(m[1])), m = ok[Math.floor(r() * ok.length)]; pool.splice(pool.indexOf(m), 1); used.add(m[1]); missionsList.push({ scope: m[0], k: m[1], g: m[3 + tier], t: m[2].replace('{n}', fmt(m[3 + tier])), tier, pay: MISSION_PAY[tier] }); }
      missionsDay = dayKey;
    }
    if (!D.missions || D.missions.day !== dayKey) D.missions = { day: dayKey, prog: [0, 0, 0], done: [false, false, false], bonus: false };
    return missionsList;
  }
  const missionVal = (m, i, s, ending) => { const base = D.missions.prog[i], v = s ? s[m.k] || 0 : 0; return m.scope === 'run' ? Math.max(base, v) : m.k === 'runs' ? base + (ending ? 1 : 0) : base + v; };
  function missionTick(s, ending) {
    const ms = curMissions(), M = D.missions, got = [];
    ms.forEach((m, i) => { const v = Math.floor(missionVal(m, i, s, ending)); if (ending) M.prog[i] = v; if (!M.done[i] && v >= m.g) { M.done[i] = true; earn(m.pay); D.life.missions++; got.push({ t: m.t, pay: m.pay }); } });
    if (!M.bonus && M.done.every(Boolean)) { M.bonus = true; earn(MISSION_BONUS); D.life.sweeps++; got.push({ t: 'All three jobs', pay: MISSION_BONUS }); }
    return got;
  }
