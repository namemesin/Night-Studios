  /* ================= KIT: progress (upgrades, cosmetics, trophies, daily jobs) ================= */
  // The game's 00-config.js supplies the tables: UPG, COS, COS_LABEL, RUN_STATS, LIFE_KEYS, FAMILIES, EXTRA_ACH and
  // MISSION_POOL. This file turns them into saved progress and the rules for earning things.
  const RARITY = { c: 'Common', r: 'Rare', e: 'Epic', l: 'Legendary', m: 'Mythic' };
  const TIERS = { b: { n: 'Bronze', c: '#d08a4e', r: 30 }, s: { n: 'Silver', c: '#c9d6e8', r: 80 }, g: { n: 'Gold', c: '#ffd24a', r: 200 }, p: { n: 'Platinum', c: '#7fe8ff', r: 500 }, m: { n: 'Mythic', c: '#ff5cf0', r: 1500 } };
  const blankStats = () => { const s = {}; for (const k of RUN_STATS) s[k] = 0; return s; };
  function cleanData(r) {
    r = r && typeof r === 'object' ? r : {};
    const o = { best: {}, mode: GAME.modes.some(m => m.id === r.mode) ? r.mode : GAME.modes[0].id, tut: !!r.tut, up: {}, done: strList(r.done), bs: {}, life: { runs: 0, secs: 0, dailyDays: 0, missions: 0, sweeps: 0 }, own: {}, eq: {}, top: [], dlast: typeof r.dlast === 'string' ? r.dlast.slice(0, 10) : '', missions: null };
    for (const m of GAME.modes) o.best[m.id] = int(r.best && r.best[m.id]);
    for (const u of UPG) o.up[u.id] = Math.min(u.cost.length, int(r.up && r.up[u.id]));
    for (const k of RUN_STATS) o.bs[k] = int(r.bs && r.bs[k]);
    for (const k of Object.keys(o.life).concat(LIFE_KEYS)) o.life[k] = int(r.life && r.life[k]);
    for (const kind in COS) { o.own[kind] = strList(r.own && r.own[kind]).filter(id => COS[kind].some(x => x.id === id)); const w = r.eq && r.eq[kind]; o.eq[kind] = COS[kind].some(x => x.id === w) ? w : COS[kind][0].id; }
    if (Array.isArray(r.top)) o.top = r.top.filter(t => t && typeof t === 'object').map(t => ({ s: int(t.s), n: String(t.n || '').slice(0, 40), m: String(t.m || '').slice(0, 8) })).slice(0, 8);
    const M = r.missions; if (M && typeof M.day === 'string' && Array.isArray(M.prog) && Array.isArray(M.done)) o.missions = { day: M.day.slice(0, 10), prog: [0, 1, 2].map(i => int(M.prog[i])), done: [0, 1, 2].map(i => !!M.done[i]), bonus: !!M.bonus };
    return o;
  }
  let D = save.d = cleanData(save.d);
  const up = id => D.up[id] || 0;
  const cosItem = (kind, id) => COS[kind].find(x => x.id === id) || COS[kind][0];
  // Unlock rules on a cosmetic: cost (coins), lvl (player level), ach (trophy id), or free.
  function cosOwned(kind, it) { return (!it.cost && !it.lvl && !it.ach) || D.own[kind].includes(it.id) || (it.lvl ? level() >= it.lvl : false) || (it.ach ? D.done.includes(it.ach) : false); }
  const cosHow = it => it.cost ? `${fmt(it.cost)} coins` : it.lvl ? `Reach level ${it.lvl}` : it.ach ? (ACH_BY.get(it.ach) || { t: 'Trophy' }).t : 'Free';
  const cosCount = kind => COS[kind].filter(it => cosOwned(kind, it)).length;
  function fixEquipped() { for (const kind in COS) if (!cosOwned(kind, cosItem(kind, D.eq[kind]))) D.eq[kind] = COS[kind][0].id; }

  // Trophy ladders: [category, id prefix, stat, 'run' (best single run) or 'life' (career total), text, tiers [target, tier, name]]
  const ACH = [];
  for (const [cat, fam, k, scope, t, tiers] of FAMILIES) for (const [g, tier, n] of tiers) ACH.push({ id: `${fam}-${g}`, cat, n, tier, k, g, scope, t: t.replace('{n}', fmt(g)).replace('{s}', g === 1 ? '' : 's') });
  ACH.push(...EXTRA_ACH,
    { id: 'lv-10', cat: 'Career', n: 'Regular', tier: 's', t: 'Reach level 10', f: () => level() >= 10 },
    { id: 'lv-25', cat: 'Career', n: 'Veteran', tier: 'g', t: 'Reach level 25', f: () => level() >= 25 },
    { id: 'gear-max', cat: 'Collection', n: 'Fully Tuned', tier: 's', t: 'Max out any upgrade', f: () => UPG.some(u => up(u.id) >= u.cost.length) },
    { id: 'gear-all', cat: 'Collection', n: 'Nothing Left to Buy', tier: 'p', t: 'Max out every upgrade', f: () => UPG.every(u => up(u.id) >= u.cost.length) });
  const ACH_CATS = [...new Set(ACH.map(a => a.cat))], ACH_BY = new Map(ACH.map(a => [a.id, a]));
  D.done = D.done.filter(id => ACH_BY.has(id));
  const achCount = () => D.done.length;
  const achVal = (a, s) => a.scope === 'life' ? D.life[a.k] : Math.max(s ? s[a.k] || 0 : 0, D.bs[a.k] || 0);
  const achProg = a => a.f || a.flag ? -1 : Math.min(1, achVal(a) / a.g);
  // Returns the trophies that just unlocked. Their coins are paid here.
  function checkAch(s) {
    const got = []; let again = true;
    while (again) { again = false; for (const a of ACH) { if (D.done.includes(a.id)) continue; let ok = false; try { ok = a.f ? !!a.f() : achVal(a, s) >= a.g; } catch (e) {} if (ok) { D.done.push(a.id); earn(TIERS[a.tier].r); got.push(a); again = true; } } }
    return got;
  }

  // Daily jobs: three a day (easy, medium, hard), the same for everyone. Pool rows: [scope, stat, text, easy, medium, hard]
  const MISSION_PAY = [60, 120, 220], MISSION_BONUS = 200, MISSION_TIER = ['Easy', 'Medium', 'Hard'];
  let missionsDay = '', missionsList = [];
  function curMissions() {
    rollDay();
    if (missionsDay !== dayKey) {
      const r = seeded(GAME.id + '-jobs-' + dayKey), pool = MISSION_POOL.slice(), used = new Set(); missionsList = [];
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

  // Every kit game ends a run the same way: bests, career totals, jobs, trophies, coins, XP, the leaderboard and the
  // run report. The game passes what happened; this fills in `lastRun` for the results screen and shows it.
  //   o: { mode, score, stats, secs, coins, xp, title, line, rows: [[label, value]], note, meta, log: {end, ...} }
  let lastRun = null, gstate = 'idle'; // gstate: 'idle' (menus), 'run', 'paused', 'over', plus any in-between states a game adds
  function endRun(o) {
    const S = o.stats, s = Math.floor(o.score), mode = o.mode, L = D.life, spec = GAME.modes.find(m => m.id === mode) || GAME.modes[0], newAch = (o.ach || []).slice(), newMis = (o.mis || []).slice();
    const isBest = s > int(D.best[mode]); D.best[mode] = Math.max(int(D.best[mode]), s);
    for (const k of RUN_STATS) if (S[k] > D.bs[k]) D.bs[k] = Math.floor(S[k]);
    L.runs++; L.secs += Math.round(o.secs); for (const k of LIFE_KEYS) if (k in S) L[k] += Math.floor(S[k]);
    if (spec.daily && D.dlast !== dayKey) { D.dlast = dayKey; L.dailyDays++; }
    newMis.push(...missionTick(S, true)); newAch.push(...checkAch(S));
    const xpGain = Math.round(o.xp * Studio.eventMult('xp')), paid = earn(Math.round(o.coins * (1 + .1 * up('lucky')) * Studio.eventMult('coins'))), lv = addXP(xpGain);
    newAch.push(...checkAch(S));
    D.top.push({ s, n: o.note || '', m: mode }); D.top.sort((a, b) => b.s - a.s); D.top = D.top.slice(0, 8);
    lastRun = { s, isBest, title: isBest ? 'New best!' : o.title, line: o.line, rows: o.rows || [], mode, coins: paid, xp: xpGain, lv, ach: newAch, mis: newMis, secs: Math.round(o.secs * 10) / 10, meta: o.meta || {}, post: '' };
    fixEquipped(); persist();
    submitScore(lastRun);
    if (o.log) logRun(Object.assign({ mode, s, t: lastRun.secs, n: L.runs, lv: level(), up: UPG.reduce((n, u) => n + up(u.id), 0) }, o.log));
    gstate = 'over'; $('top').hidden = false; pauseBtn.hidden = true; resize();
    if (lv.levels) sfx.level(); else if (isBest) sfx.win();
    show('over');
  }
