  /* ================= NIGHT RALLY: the game ================= */
  // A track is a closed loop of NS points drawn from a seeded generator, so the Daily Stage is the same road for
  // everyone, and every track is scaled to the same length so times can be compared. Logic runs at a fixed 60 steps
  // a second. The view follows the car and turns with the way it is travelling, so "left" is always the car's left.
  const LW = 400, NS = 360, TRACK_LEN = 6600, HALF = 62, HOME_KEY = 'home-1';
  const GHZ = 12, GHOST_KEY = 'nightrally-ghost1'; // the ghost keeps one position every 12 steps (5 a second)
  const CH = [28, 70, 125]; // steps of drifting that fill the ring to blue, orange and pink
  const CHC = ['#8a93ad', '#6fd3ff', '#ffb347', '#ff5cf0'];
  // How the car handles. vmax: top speed in units a step. k: drag. grass: how many times more drag off the road.
  // turn / turnD: steering rate normally and in a drift. grip / gripD: how hard the tyres pull the car straight.
  // keep: how much of the speed a slide would scrub off is given back while drifting.
  const P = { vmax: 6.6, k: .019, grass: 2.6, turn: .024, turnD: .064, grip: .3, gripD: .085, keep: .85, brake: 3, boost: 1.6, maxTurn: .3, gap: 30, n0: 15, nv: 5, lo: .45, hi: 1.2, jit: .6 };
  let SC = 1, LH = 600;
  resizeHooks.push(() => { SC = W / LW; LH = H / SC; });
  let G = null;
  const keysDown = { left: false, right: false, drift: false, brake: false };
  const ptrs = new Map(); let tSteer = 0, tDrift = false;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const PMAX = 220, parts = Array.from({ length: PMAX }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, c: '#fff', s: 2 }));
  let pn = 0;
  function puff(x, y, vx, vy, c, life = 26, size = 4) { if (pn >= PMAX || ((reduceMotion || save.settings.fx === 'low') && Math.random() < .6)) return; const p = parts[pn++]; p.x = x; p.y = y; p.vx = vx + (Math.random() - .5) * .8; p.vy = vy + (Math.random() - .5) * .8; p.life = p.max = life * (.6 + Math.random() * .4); p.c = c; p.s = size * (.6 + Math.random() * .6); }

  /* ---------- building a track ---------- */
  const PALS = [
    { g: '#12241a', d1: '#0c1a12', d2: '#1e3a26', dust: ['#3a5a36', '#2a4028'] }, // meadow
    { g: '#231c14', d1: '#17120c', d2: '#3a2a18', dust: ['#6a5236', '#4a3a26'] }, // autumn
    { g: '#1a222c', d1: '#121820', d2: '#2c3a4a', dust: ['#c9d6e8', '#8a93ad'] }, // frost
    { g: '#241a22', d1: '#181018', d2: '#3a2638', dust: ['#7a5a70', '#4a3446'] }, // heather
  ];
  function shapeTrack(cp, rand, pal) {
    const n = cp.length, fine = [];
    for (let i = 0; i < n; i++) { // a smooth closed curve through the corner points
      const a = cp[(i + n - 1) % n], b = cp[i], c = cp[(i + 1) % n], d = cp[(i + 2) % n];
      for (let j = 0; j < 24; j++) { const t = j / 24, t2 = t * t, t3 = t2 * t, f = q => .5 * (2 * b[q] + (c[q] - a[q]) * t + (2 * a[q] - 5 * b[q] + 4 * c[q] - d[q]) * t2 + (3 * b[q] - a[q] - 3 * c[q] + d[q]) * t3); fine.push([f(0), f(1)]); }
    }
    const m = fine.length, cum = [0];
    for (let i = 0; i < m; i++) { const p = fine[i], q = fine[(i + 1) % m]; cum.push(cum[i] + Math.hypot(q[0] - p[0], q[1] - p[1])); }
    const total = cum[m], sc = TRACK_LEN / total; let x = new Float32Array(NS), y = new Float32Array(NS);
    for (let s = 0, i = 0; s < NS; s++) { const d = s / NS * total; while (cum[i + 1] < d) i++; const u = (d - cum[i]) / (cum[i + 1] - cum[i] || 1), p = fine[i], q = fine[(i + 1) % m]; x[s] = (p[0] + (q[0] - p[0]) * u) * sc; y[s] = (p[1] + (q[1] - p[1]) * u) * sc; }
    // no corner tighter than the car can drift round, and no two stretches of road close enough to touch
    const th = []; for (let i = 0; i < NS; i++) th.push(Math.atan2(y[(i + 1) % NS] - y[(i + NS - 1) % NS], x[(i + 1) % NS] - x[(i + NS - 1) % NS]));
    const turn = th.map((t, i) => Math.abs(wrap(th[(i + 1) % NS] - t)));
    if (turn.some(t => t > P.maxTurn)) return null;
    for (let i = 0; i < NS; i++) for (let j = i + 15; j < NS; j++) if (NS - (j - i) > 14 && Math.hypot(x[i] - x[j], y[i] - y[j]) < HALF * 2 + P.gap) return null;
    // start on the straightest stretch
    let s0 = 0, best = 1e9; for (let i = 0; i < NS; i++) { let v = 0; for (let j = -5; j < 16; j++) v += turn[(i + j + NS) % NS]; if (v < best) { best = v; s0 = i; } }
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9; for (let i = 0; i < NS; i++) { minX = Math.min(minX, x[i]); minY = Math.min(minY, y[i]); maxX = Math.max(maxX, x[i]); maxY = Math.max(maxY, y[i]); }
    const T = { x: new Float32Array(NS), y: new Float32Array(NS), tx: new Float32Array(NS), ty: new Float32Array(NS), w: maxX - minX + 600, h: maxY - minY + 600, pal, dec: [], lamps: [], path: new Path2D(), mini: new Path2D(), ms: 1 };
    for (let i = 0; i < NS; i++) { const j = (i + s0) % NS; T.x[i] = x[j] - minX + 300; T.y[i] = y[j] - minY + 300; T.tx[i] = Math.cos(th[j]); T.ty[i] = Math.sin(th[j]); }
    T.ms = 56 / Math.max(T.w - 600, T.h - 600);
    for (let i = 0; i < NS; i++) { T.path[i ? 'lineTo' : 'moveTo'](T.x[i], T.y[i]); T.mini[i ? 'lineTo' : 'moveTo']((T.x[i] - 300) * T.ms, (T.y[i] - 300) * T.ms); }
    T.path.closePath(); T.mini.closePath();
    const far = (px, py) => { let d = 1e9; for (let i = 0; i < NS; i += 2) d = Math.min(d, Math.hypot(px - T.x[i], py - T.y[i])); return d; };
    for (let i = 0; i < 520 && T.dec.length < 300; i++) { const px = rand() * T.w, py = rand() * T.h, k = rand() < .5 ? 0 : rand() < .7 ? 1 : 2, s = .7 + rand() * .7; if (far(px, py) > HALF + 34 + (k ? 0 : 18)) T.dec.push({ x: px, y: py, k, s }); }
    for (let i = 10; i < NS; i += 24) { const side = ((i - 10) / 24) % 2 ? 1 : -1; T.lamps.push({ x: T.x[i] - T.ty[i] * (HALF + 24) * side, y: T.y[i] + T.tx[i] * (HALF + 24) * side }); }
    return T;
  }
  const tracks = {};
  function makeTrack(key) {
    if (tracks[key]) return tracks[key];
    const pal = key === HOME_KEY ? PALS[0] : PALS[Math.floor(seeded('nightrally-look-' + key)() * PALS.length)];
    let T = null;
    for (let tries = 0; tries < 300 && !T; tries++) {
      const r = seeded('nightrally-' + key + '-' + tries), n = P.n0 + Math.floor(r() * P.nv), cp = [];
      for (let i = 0; i < n; i++) { const a = (i + (r() - .5) * P.jit) / n * TAU, rad = P.lo + r() * (P.hi - P.lo); cp.push([Math.cos(a) * rad, Math.sin(a) * rad * 1.15]); }
      T = shapeTrack(cp, r, pal);
    }
    if (!T) { const cp = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rad = i % 2 ? .78 : 1; cp.push([Math.cos(a) * rad, Math.sin(a) * rad * 1.2]); } T = shapeTrack(cp, seeded('nightrally-spare'), pal); } // a plain wobbly oval always works
    const ks = Object.keys(tracks); if (ks.length > 3) delete tracks[ks.find(k => k !== HOME_KEY)];
    return (tracks[key] = T);
  }

  /* ---------- the ghost: your best run on a track, kept on this device ---------- */
  // Five letters a sample: where the car was (two letters each way, to the nearest unit) and which way it faced.
  // A one-minute run is about 1.3 KB. It lives in its own storage key so the saved game and the cloud copy stay small.
  const A64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const ghostAll = () => { try { const g = JSON.parse(localStorage.getItem(GHOST_KEY) || '{}'); return g && typeof g === 'object' ? g : {}; } catch (e) { return {}; } };
  function ghostUnpack(d) {
    if (typeof d !== 'string' || d.length < 100 || d.length > 4000 || d.length % 5 || !/^[A-Za-z0-9+/]+$/.test(d)) return null;
    const n = d.length / 5, pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = j => A64.indexOf(d[i * 5 + j]); pts[i * 3] = (v(0) * 64 + v(1)); pts[i * 3 + 1] = (v(2) * 64 + v(3)); pts[i * 3 + 2] = v(4) / 64 * TAU; }
    return { pts, n };
  }
  function ghostPack(rec) {
    let d = ''; const q = v => { v = clamp(Math.round(v), 0, 4095); return A64[v >> 6] + A64[v & 63]; };
    for (let i = 0; i < rec.length; i += 3) d += q(rec[i]) + q(rec[i + 1]) + A64[Math.round(((rec[i + 2] % TAU) + TAU) % TAU / TAU * 64) & 63];
    return d;
  }
  function ghostLoad(mode, key) {
    const g = ghostAll()[mode];
    if (!g || g.k !== key || !(g.t > 0) || !Array.isArray(g.laps) || g.laps.length !== LAPS) return null;
    const u = ghostUnpack(g.d); return u && { t: int(g.t), laps: g.laps.map(int), pts: u.pts, n: u.n };
  }
  function ghostSave(mode, key, t, laps, d) { const all = ghostAll(); all[mode] = { k: key, t, laps, d }; try { localStorage.setItem(GHOST_KEY, JSON.stringify(all)); } catch (e) {} }
  // The leader's replay: asked for when a rally starts, and raced as the gold car once it arrives. The server only
  // hands it out while it is the replay of the score on top of the board.
  let sentGhost = '';
  function fetchTop(run) {
    if (!accountsOn()) return;
    rpc('ng_top_ghost', { p_game: GAME.id, p_kind: run.mode, p_period: run.mode === 'daily' ? dayKey : '' }).then(res => {
      const u = res && !res.none && res.score > 2000 ? ghostUnpack(res.data) : null;
      if (u && G === run) run.top = { t: stepsFor(int(res.score)), pts: u.pts, n: u.n, name: String(res.name || 'Player').slice(0, 16), me: !!save.acct && res.id === save.acct.id };
    }).catch(() => {});
  }
  function ghostAt(g, t, out) {
    const f = Math.min(t / GHZ, g.n - 1), i = Math.min(Math.floor(f), g.n - 2 < 0 ? 0 : g.n - 2), u = g.n > 1 ? f - i : 0, p = g.pts, o = i * 3, o2 = g.n > 1 ? o + 3 : o;
    out.x = p[o] + (p[o2] - p[o]) * u; out.y = p[o + 1] + (p[o2 + 1] - p[o + 1]) * u; out.a = p[o + 2] + wrap(p[o2 + 2] - p[o + 2]) * u; return out;
  }
  // The leader's time and lap times come with the board. They give the lap-by-lap gap, and a pace marker that
  // stands in for the gold car when the replay itself can't be had.
  function findPace() {
    if (G.pace || !accountsOn()) return;
    const b = boards[boardKey(G.mode)], top = b && b.st === 'ready' && b.top[0];
    if (!top || !(top.score > 2000)) return;
    const t = stepsFor(int(top.score)), m = top.meta || {}, ok = Array.isArray(m.laps) && m.laps.length === LAPS && m.laps.every(v => v > 0), sum = ok ? m.laps.reduce((n, v) => n + v, 0) : 0, cum = []; let at = 0;
    for (let i = 0; i < LAPS; i++) { at += ok ? m.laps[i] / sum * t : t / LAPS; cum.push(at); }
    G.pace = { t, cum, name: String(top.name || 'Player').slice(0, 16) };
  }
  function paceAt(p, t, out) {
    let L = 0; while (L < LAPS - 1 && t > p.cum[L]) L++;
    const a = L ? p.cum[L - 1] : 0, f = clamp((t - a) / (p.cum[L] - a), 0, 1) * NS, T = G.T, i = Math.floor(f) % NS, j = (i + 1) % NS, u = f - Math.floor(f);
    out.x = T.x[i] + (T.x[j] - T.x[i]) * u; out.y = T.y[i] + (T.y[j] - T.y[i]) * u; return out;
  }

  /* ---------- the car ---------- */
  function carAt(T, i) { i = (i % NS + NS) % NS; return { x: T.x[i], y: T.y[i], a: Math.atan2(T.ty[i], T.tx[i]), vx: 0, vy: 0, steer: 0, dr: 0, ch: 0, dlen: 0, boost: 0, blv: 0, seg: i, prog: 0, lap: 0, on: true, lost: 0, slip: 0, sp: 0, sliding: false, ev: 0, wl: null }; }
  // One step of driving. sIn: steering from -1 (left) to 1. dIn: drift held. bIn: brake held.
  // Afterwards c.ev is 1 to 3 if a boost of that size just fired, or -1 if a drift ended with nothing.
  function drive(c, sIn, dIn, bIn) {
    const sp0 = Math.hypot(c.vx, c.vy);
    c.steer += (sIn - c.steer) * .3; c.ev = 0;
    if (dIn && !c.dr && sp0 > 2.4 && Math.abs(sIn) > .2) { c.dr = Math.sign(sIn); c.ch = 0; c.dlen = 0; }
    else if (c.dr && (!dIn || sp0 < 1.5)) {
      const lv = dIn ? 0 : c.ch >= CH[2] ? 3 : c.ch >= CH[1] ? 2 : c.ch >= CH[0] ? 1 : 0;
      if (lv) { c.boost = Math.round((22 + 22 * lv) * (1 + .12 * up('turbo'))); c.blv = lv; }
      c.ev = lv || -1; c.dr = 0; c.ch = 0;
    }
    const vmax = P.vmax * (1 + .015 * up('engine')), k = P.k * (c.on ? 1 : P.grass - (P.grass - 1) * .12 * up('mud')) * (bIn ? P.brake : 1), acc = bIn ? 0 : vmax * P.k * (c.boost > 0 ? P.boost : 1);
    if (c.boost > 0) c.boost--;
    c.a += c.steer * (c.dr ? P.turnD : P.turn) * (1 + .03 * up('tyres')) * Math.min(1, sp0 / 2.2);
    const fx = Math.cos(c.a), fy = Math.sin(c.a);
    c.vx = (c.vx + fx * acc) * (1 - k); c.vy = (c.vy + fy * acc) * (1 - k);
    const lat = c.vy * fx - c.vx * fy, fwd = c.vx * fx + c.vy * fy, before = Math.hypot(c.vx, c.vy), g = c.dr ? P.gripD : P.grip;
    c.vx += fy * lat * g; c.vy -= fx * lat * g;
    if (c.dr) { const after = Math.hypot(c.vx, c.vy); if (after > .01) { const m = (after + (before - after) * P.keep) / after; c.vx *= m; c.vy *= m; } }
    c.x += c.vx; c.y += c.vy;
    c.slip = Math.atan2(Math.abs(lat), Math.abs(fwd) + .01); c.sp = Math.hypot(c.vx, c.vy); c.sliding = !!c.dr && c.slip > .18 && c.sp > 2;
    if (c.dr) { if (c.on && c.sliding) { c.ch += 1 + .08 * up('spool'); c.dlen += c.sp; } else if (!c.on) c.ch = Math.max(0, c.ch - 4); }
    // tyre marks, smoke and dust
    const rx = c.x - fx * 13, ry = c.y - fy * 13, wl = [rx + fy * 8, ry - fx * 8, rx - fy * 8, ry + fx * 8];
    if (c.sliding && c.on && c.wl) { for (let j = 0; j < 4; j += 2) { G.skids[G.sk] = [c.wl[j], c.wl[j + 1], wl[j], wl[j + 1]]; G.sk = (G.sk + 1) % 360; } if (G.f % 3 === 0) puff(rx, ry, -c.vx * .1, -c.vy * .1, c.ch >= CH[0] ? CHC[c.ch >= CH[2] ? 3 : c.ch >= CH[1] ? 2 : 1] : '#c9d6e8', 24, 5); }
    else if (!c.on && c.sp > 1.4 && G.f % 3 === 0) puff(rx, ry, -c.vx * .2, -c.vy * .2, G.T.pal.dust[G.f % 2], 22, 4);
    if (c.boost > 0 && G.f % 2 === 0) puff(rx, ry, -fx * 2, -fy * 2, c.boost % 4 < 2 ? '#ffb347' : '#ff5a3d', 12, 4);
    c.wl = c.sliding ? wl : null;
  }
  // Where the car is along the road. Looks a little behind and well ahead of where it last was, so the laps count
  // only if the road is followed (a short cut across grass is slow, a long one doesn't count).
  function locate(c) {
    const T = G.T; let best = c.seg, bd = 1e12, bk = 0;
    for (let k = -4; k <= 30; k++) { const i = ((c.seg + k) % NS + NS) % NS, dx = c.x - T.x[i], dy = c.y - T.y[i], d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; bk = k; } }
    if (bd < (HALF + 50) * (HALF + 50)) { c.seg = best; c.prog += bk; c.lost = 0; c.on = Math.abs((c.y - T.y[best]) * T.tx[best] - (c.x - T.x[best]) * T.ty[best]) <= HALF + 3; }
    else { c.on = false; c.lost++; }
  }
  function respawn(c) { const T = G.T, i = c.seg; c.x = T.x[i]; c.y = T.y[i]; c.a = Math.atan2(T.ty[i], T.tx[i]); c.vx = c.vy = 0; c.dr = c.ch = c.boost = c.lost = 0; c.on = true; c.wl = null; }
  // A simple driver for the car behind the menus: aim at the road ahead, drift when a tight corner is coming.
  function auto(c) {
    const T = G.T, i = (c.seg + 4 + Math.floor(c.sp * 1.6)) % NS, d = wrap(Math.atan2(T.y[i] - c.y, T.x[i] - c.x) - c.a), j = (c.seg + 15) % NS;
    const bend = Math.abs(wrap(Math.atan2(T.ty[j], T.tx[j]) - Math.atan2(T.ty[c.seg], T.tx[c.seg])));
    return { s: clamp(d * 2.4, -1, 1), d: c.dr ? Math.abs(d) > .16 : c.sp > 3.6 && bend > .75 && Math.abs(d) > .14 };
  }

  function newGame(mode, demo) {
    rollDay();
    const key = mode === 'daily' ? 'daily-' + dayKey : HOME_KEY, T = makeTrack(key);
    G = { mode, demo: !!demo, key, T, t: 0, f: 0, cd: demo ? 0 : 190, c: carAt(T, demo ? Math.floor(Math.random() * NS) : NS - 2), st: blankStats(), toasts: [], newAch: [], newMis: [], laps: [], lapStart: 0, lapClean: true, rec: [],
      gh: demo ? null : ghostLoad(mode, key), pace: null, top: null, camA: 0, zoom: .6, shake: 0, flash: 0, hint: 0, fin: false, over: 0, wrong: 0, skids: [], sk: 0, auto: false, delta: null, gp: { x: 0, y: 0, a: 0 }, pp: { x: 0, y: 0, a: 0 } };
    if (!demo) G.c.prog = -2;
    G.camA = G.c.a; pn = 0; return G;
  }
  const say = (text, c = '#c6ff4a', life = 150) => { if (!G.demo) { G.toasts = G.toasts.filter(t => t.ach); G.toasts.push({ text, c, life }); } };
  const sectors = () => clamp(Math.floor(G.c.prog / (NS / 4)), 0, LAPS * 4);
  function step() {
    const c = G.c, S = G.st;
    G.f++; G.shake *= .88; if (G.shake < .2) G.shake = 0; G.flash = Math.max(0, G.flash - .04);
    for (let i = pn - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vx *= .93; p.vy *= .93; if (--p.life <= 0) { parts[i] = parts[--pn]; parts[pn] = p; } }
    if (G.toasts.length && --G.toasts[0].life <= 0) G.toasts.shift();
    const look = () => { G.camA += wrap((c.sp > 1 ? Math.atan2(c.vy, c.vx) : c.a) - G.camA) * .07; G.zoom += ((G.demo ? .46 : .64 - c.sp * .016) - G.zoom) * .05; };
    if (G.demo) { const i = auto(c); drive(c, i.s, i.d, false); locate(c); if (c.lost > 60) respawn(c); look(); return; }
    if (gstate === 'ending') { drive(c, 0, false, true); locate(c); look(); if (--G.over <= 0) finish(); return; }
    if (G.cd > 0) { // three, two, one
      if (G.cd === 180 || G.cd === 120 || G.cd === 60) tone(440, .12, 'square', .05);
      if (--G.cd === 0) { tone(880, .4, 'square', .06); buzz(30); }
      findPace(); look(); return;
    }
    if (G.t % GHZ === 0) G.rec.push(c.x, c.y, c.a);
    G.t++;
    let sIn = (keysDown.right ? 1 : 0) - (keysDown.left ? 1 : 0) || tSteer, dIn = keysDown.drift || tDrift, bIn = keysDown.brake;
    if (G.auto) { const i = auto(c); sIn = i.s; dIn = i.d; bIn = false; }
    const wasDr = c.dr, len = c.dlen;
    drive(c, sIn, dIn, bIn); locate(c);
    if (!wasDr && c.dr) { noise(.25, .07, 1400, 'bandpass'); }
    if (c.sliding && G.f % 7 === 0) noise(.09, .035, 1900, 'bandpass');
    if (c.dr) { for (let i = 0; i < 3; i++) if (c.ch >= CH[i] && c.ch - 1 - .08 * up('spool') < CH[i]) { tone(660 + i * 220, .07, 'triangle', .05); buzz(8); } }
    if (c.ev) { // a drift just ended
      const m = len / 10; S.drift += m; if (m > S.long) S.long = m;
      if (c.ev > 0) { S.boosts++; G.shake = 3 + c.ev * 2; tone(220, .35, 'sawtooth', .05, 500 + c.ev * 200); noise(.3, .08, 900, 'lowpass'); buzz(15 + c.ev * 10); }
    }
    if (!c.on) { G.lapClean = false; if (c.sp > 2 && G.f % 9 === 0) noise(.06, .03, 500, 'lowpass'); }
    if (c.lost > 150) { respawn(c); say('BACK ON THE ROAD', '#ffb347', 90); tone(300, .2, 'square', .04, -100); }
    G.wrong = c.vx * G.T.tx[c.seg] + c.vy * G.T.ty[c.seg] < -1.2 ? G.wrong + 1 : 0;
    if (G.wrong === 70) say('WRONG WAY', '#ff5a6e', 110);
    if (G.t % 60 === 0) findPace(); // the daily board may still be loading when the rally starts
    if (c.prog >= (c.lap + 1) * NS) { // across the line
      c.lap++; const lt = G.t - G.lapStart; G.lapStart = G.t; G.laps.push(G.t); S.laps = c.lap;
      if (G.lapClean) S.clean++; G.lapClean = true;
      S.lapx = Math.max(S.lapx, Math.max(0, 6000 - Math.round(lt / .6)));
      const d = G.gh ? G.t - G.gh.laps[c.lap - 1] : G.pace ? G.t - G.pace.cum[c.lap - 1] : null, who = G.gh ? 'GHOST' : 'BEST';
      G.delta = d == null ? null : { d, who, life: 240 };
      if (c.lap >= LAPS) { G.fin = true; gstate = 'ending'; G.over = 85; G.flash = .8; pauseBtn.hidden = true; engineOff(); musicStop(); chime([523, 659, 784, 1046, 1318], 'triangle', .06); buzz([30, 30, 60]); }
      else { say(`LAP ${c.lap} · ${tf(lt)}${d == null ? '' : ` · ${who} ${d <= 0 ? '−' : '+'}${tf(Math.abs(d))}`}`, d != null && d > 0 ? '#ffb347' : '#c6ff4a', 190); chime([659, 988]); music.intensity = Math.min(5, 2 + c.lap); }
      if (G.fin) return;
    }
    if (G.t >= TMAX) { gstate = 'ending'; G.over = 50; pauseBtn.hidden = true; engineOff(); musicStop(); chime([440, 330, 220], 'square', .05, .14); return; }
    if (G.t % 30 === 0) { const a = checkAch(S), ms = missionTick(S, false); for (const x of a) { G.newAch.push(x); G.toasts.push({ ach: x, life: 110 }); chime([523, 659, 784], 'triangle', .05); } for (const x of ms) { G.newMis.push(x); say(`JOB DONE · +${x.pay} COINS`, '#5cf2b0'); } if (a.length || ms.length) saveLocal(); }
    if (!D.tut) { const H0 = [[30, usedTouch ? 'THE CAR DRIVES ITSELF · HOLD ◀ ▶ TO STEER' : `THE CAR DRIVES ITSELF · STEER WITH ${keyFor('left')} ${keyFor('right')}`], [330, usedTouch ? 'HOLD DRIFT WHILE STEERING INTO A CORNER' : `HOLD ${keyFor('drift').toUpperCase()} WHILE STEERING INTO A CORNER`], [760, 'LET GO WHEN THE RING HAS COLOR FOR A BOOST']]; if (G.hint < H0.length && G.t >= H0[G.hint][0]) { say(H0[G.hint][1], '#e6f6c8', 240); if (++G.hint === H0.length) D.tut = true; } }
    look();
  }

  /* ---------- engine note ---------- */
  let eng = null;
  function engineOn() { if (!ac || eng || !save.settings.sfx) return; try { const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = 55; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0; o.connect(f).connect(g).connect(sfxBus); o.start(); eng = { o, g }; } catch (e) { eng = null; } }
  function engineOff() { if (!eng) return; const e = eng; eng = null; try { e.g.gain.setTargetAtTime(0, ac.currentTime, .05); e.o.stop(ac.currentTime + .3); } catch (_) {} }
  function engineTune() { if (!eng) return; try { const c = G.c, t = ac.currentTime; eng.o.frequency.setTargetAtTime(52 + c.sp * 20 + (c.boost > 0 ? 28 : 0) + (c.dr ? 10 : 0), t, .06); eng.g.gain.setTargetAtTime(G.cd > 0 ? .02 : .04, t, .1); } catch (e) {} }

  let acc = 0, lastFrame = 0, frameNo = 0;
  function startRun(mode) {
    if (GAME.modes.some(m => m.id === mode)) D.mode = mode; else mode = D.mode;
    initAudio(); engineOff(); newGame(mode); armRun(mode); gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; $('top').hidden = true; resize();
    ptrs.clear(); tSteer = 0; tDrift = false;
    if (accountsOn()) boardLoad(mode, true); fetchTop(G);
    if (mode === 'daily') say(`DAILY STAGE · ${dayLabel.toUpperCase()}`, '#ffd24a', 170);
    else if (G.gh) say(`YOUR GHOST · ${tf(G.gh.t)}`, '#bfe9ff', 170);
    music.intensity = 2; music.tense = false; musicStart(); engineOn(); acc = 0; lastFrame = performance.now();
  }
  function pauseRun() { if (gstate !== 'run') return; gstate = 'paused'; musicStop(); engineOff(); pauseBtn.hidden = true; for (const k in keysDown) keysDown[k] = false; ptrs.clear(); tSteer = 0; tDrift = false; show('pause'); }
  function resumeRun() { if (gstate !== 'paused') return; initAudio(); gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; musicStart(); engineOn(); acc = 0; lastFrame = performance.now(); }
  const logData = end => ({ end, m: sectors(), z: Math.min(LAPS, G.c.lap), x: Math.round(G.c.x / G.T.w * 1000), y: Math.round(G.c.y / G.T.h * 1000), seg: G.c.seg, drift: Math.round(G.st.drift), boosts: G.st.boosts, clean: G.st.clean, ghost: !!G.gh, pace: !!G.pace, top: !!G.top });
  const logMeta = () => ({ mode: G.mode, s: 0, t: Math.round(G.t / 60), n: D.life.runs });
  function restartRun() { if (gstate !== 'run' && gstate !== 'paused') return; if (G.t > 600) logRun(Object.assign(logMeta(), logData('restart'))); musicStop(true); startRun(G.mode); }
  function leaveRun() { if ((gstate === 'run' || gstate === 'paused') && G.t > 600) logRun(Object.assign(logMeta(), logData('quit'))); musicStop(); engineOff(); gstate = 'idle'; $('top').hidden = false; pauseBtn.hidden = true; resize(); newGame('free', true); }
  function finish() {
    sentGhost = '';
    const S = G.st, c = G.c, done = G.fin, score = done ? scoreFor(G.t) : c.lap * 400 + sectors() % 4 * 60, gh = G.gh, where = G.mode === 'daily' ? "today's Daily Stage" : 'the Moonlight Circuit';
    if (c.dr) { S.drift += c.dlen / 10; S.long = Math.max(S.long, c.dlen / 10); }
    S.score = score; if (G.mode === 'daily') S.daily = score;
    let line;
    if (done) {
      G.rec.push(c.x, c.y, c.a); sentGhost = ghostPack(G.rec);
      if (!gh || G.t < gh.t) ghostSave(G.mode, G.key, G.t, G.laps, sentGhost);
      if (gh && G.t < gh.t) S.wins = 1;
      line = `Three laps of ${where} in <b>${tf(G.t)}</b>.` + (!gh ? ' That run is now your ghost.' : G.t < gh.t ? ` You beat your ghost by <b>${tf(gh.t - G.t)}</b> s, so this run is the new one.` : ` Your ghost was ${tf(G.t - gh.t)} s quicker.`) + (G.pace ? ` ${G.mode === 'daily' ? "Today's best" : 'The record'} is ${tf(G.pace.t)} by ${esc(G.pace.name)}.` : '');
    } else line = `Time ran out on <b>lap ${Math.min(LAPS, c.lap + 1)}</b> of ${where}. A rally is called off after two minutes.`;
    const lapRows = G.laps.map((t, i) => ['Lap ' + (i + 1), tf(t - (i ? G.laps[i - 1] : 0))]);
    endRun({ mode: G.mode, score, stats: S, secs: G.t / 60, coins: done ? score / 170 + S.boosts * 1.5 + S.clean * 6 : c.lap * 8, xp: done ? score / 50 + 36 : 20 + c.lap * 20, title: done ? 'Finished' : 'Out of time', ach: G.newAch, mis: G.newMis, line,
      rows: [...lapRows, ['Drifted', Math.round(S.drift) + ' m'], ['Longest drift', Math.round(S.long) + ' m'], ['Boosts', S.boosts], ['Clean laps', S.clean]], note: done ? tf(G.t) : 'Did not finish',
      meta: done ? { t: Math.round(G.t / .6), laps: G.laps.map((t, i) => Math.round((t - (i ? G.laps[i - 1] : 0)) / .6)) } : {}, log: logData(done ? 'finish' : 'time') });
  }

  /* ---------- input ---------- */
  // Touch: the left half of the screen steers (its left side turns left, its right side turns right) and the right
  // half is the drift button. A thumb can slide between the two arrows without lifting.
  const zone = e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / SC; return x < LW / 4 ? 'L' : x < LW / 2 ? 'R' : 'D'; };
  function syncTouch() { let l = false, r = false; tDrift = false; for (const z of ptrs.values()) { if (z === 'L') l = true; else if (z === 'R') r = true; else tDrift = true; } tSteer = (r ? 1 : 0) - (l ? 1 : 0); }
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') usedTouch = true;
    initAudio(); if (gstate !== 'run') return;
    ptrs.set(e.pointerId, zone(e)); syncTouch();
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  });
  cv.addEventListener('pointermove', e => { const z = ptrs.get(e.pointerId); if (!z || z === 'D') return; const n = zone(e); if (n !== 'D' && n !== z) { ptrs.set(e.pointerId, n); syncTouch(); } });
  for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, e => { if (ptrs.delete(e.pointerId)) syncTouch(); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('keydown', e => {
    if (capturing || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) || e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code || e.key || '';
    for (const k in keysDown) if (bound(k, c)) { keysDown[k] = true; usedTouch = false; }
    if (gstate === 'run') { if (KEY_ACTIONS.some(([a]) => bound(a, c))) e.preventDefault(); if (bound('pause', c)) pauseRun(); }
    else if (gstate === 'paused' && view === 'pause' && bound('pause', c)) { e.preventDefault(); resumeRun(); }
    else if ((view === 'over' || view === 'home') && c === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); startRun(); }
  });
  addEventListener('keyup', e => { const c = e.code || e.key || ''; for (const k in keysDown) if (bound(k, c)) keysDown[k] = false; });
  addEventListener('blur', () => { for (const k in keysDown) keysDown[k] = false; ptrs.clear(); tSteer = 0; tDrift = false; });
  // erasing the device's progress takes the ghosts with it
  const wipeAll = ACTIONS.wipe; ACTIONS.wipe = () => { try { localStorage.removeItem(GHOST_KEY); } catch (e) {} wipeAll(); };

  /* ---------- drawing ---------- */
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  // A car seen from above, pointing right, centered on 0,0. `it` is a locker item: body, cabin and stripe colors.
  function drawCar(c, it, s) {
    c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, -19 * s, -8 * s, 40 * s, 20 * s, 6 * s); c.fill();
    c.fillStyle = '#0b0c10'; for (const [x, y] of [[-15, -12], [-15, 8], [9, -12], [9, 8]]) c.fillRect(x * s, y * s, 8 * s, 4 * s);
    c.fillStyle = it.c; rr(c, -20 * s, -10 * s, 40 * s, 20 * s, 6 * s); c.fill();
    if (it.stripe) { c.fillStyle = it.stripe; c.fillRect(-20 * s, -2.5 * s, 40 * s, 5 * s); }
    c.fillStyle = it.c2; rr(c, -10 * s, -8 * s, 18 * s, 16 * s, 4 * s); c.fill();
    c.fillStyle = 'rgba(170,225,255,.8)'; c.fillRect(4 * s, -7 * s, 3.5 * s, 14 * s); c.fillStyle = 'rgba(170,225,255,.4)'; c.fillRect(-9.5 * s, -6.5 * s, 2.5 * s, 13 * s);
    c.fillStyle = '#fff6c8'; c.fillRect(17.5 * s, -8.5 * s, 2.5 * s, 4 * s); c.fillRect(17.5 * s, 4.5 * s, 2.5 * s, 4 * s);
    c.fillStyle = '#ff3d55'; c.fillRect(-20 * s, -8.5 * s, 2 * s, 4 * s); c.fillRect(-20 * s, 4.5 * s, 2 * s, 4 * s);
  }
  const GHOST_CAR = { c: '#bfe9ff', c2: '#7fb6d8' }, GOLD_CAR = { c: '#ffd24a', c2: '#b38a12' };
  const previews = {};
  function cosPreview(kind, it) {
    if (previews[it.id]) return previews[it.id];
    const c = document.createElement('canvas'); c.width = c.height = 144; const x = c.getContext('2d');
    x.fillStyle = '#12241a'; x.fillRect(0, 0, 144, 144); x.translate(72, 72); x.rotate(-.5);
    x.fillStyle = '#e9e4d4'; x.fillRect(-120, -52, 240, 104); x.fillStyle = '#d8404f'; for (let i = -6; i < 6; i++) { x.fillRect(i * 40, -52, 20, 7); x.fillRect(i * 40, 45, 20, 7); }
    x.fillStyle = '#262a33'; x.fillRect(-120, -45, 240, 90); x.fillStyle = 'rgba(255,255,255,.16)'; for (let i = -4; i < 4; i++) x.fillRect(i * 46, -1.5, 18, 3);
    drawCar(x, it, 2.6); return (previews[it.id] = c.toDataURL('image/png'));
  }
  const clearPreviews = () => { for (const k in previews) delete previews[k]; };

  function drawGame(now) {
    const k = dpr * SC, F = '"Bungee",Impact,sans-serif', M = '"DM Mono",monospace', T = G.T, c = G.c, playing = !G.demo, low = save.settings.fx === 'low', pal = T.pal;
    const CX = LW / 2, CY = playing ? LH * .62 : LH * .5, Z = G.zoom, R = Math.hypot(LW, LH) / Z * .62;
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.fillStyle = pal.g; ctx.fillRect(0, 0, LW, LH);
    ctx.save();
    if (G.shake > 0 && save.settings.shake && !reduceMotion) ctx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);
    ctx.translate(CX, CY); ctx.scale(Z, Z); ctx.rotate(-G.camA - Math.PI / 2); ctx.translate(-c.x, -c.y);
    const near = (x, y) => Math.abs(x - c.x) < R && Math.abs(y - c.y) < R;
    for (const d of T.dec) { if (!near(d.x, d.y)) continue;
      if (d.k === 0) { ctx.fillStyle = pal.d1; ctx.beginPath(); ctx.arc(d.x + 5, d.y + 6, 26 * d.s, 0, TAU); ctx.fill(); ctx.fillStyle = pal.d2; ctx.beginPath(); ctx.arc(d.x, d.y, 24 * d.s, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.arc(d.x - 6 * d.s, d.y - 6 * d.s, 11 * d.s, 0, TAU); ctx.fill(); }
      else if (d.k === 1) { ctx.fillStyle = pal.d2; ctx.fillRect(d.x, d.y, 3, 9 * d.s); ctx.fillRect(d.x + 6, d.y + 3, 3, 7 * d.s); ctx.fillRect(d.x - 6, d.y + 4, 3, 6 * d.s); }
      else { ctx.fillStyle = pal.d1; ctx.beginPath(); ctx.arc(d.x, d.y, 9 * d.s, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a505c'; ctx.beginPath(); ctx.arc(d.x - 1, d.y - 2, 7 * d.s, 0, TAU); ctx.fill(); } }
    // the road: kerb, tarmac, center line
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#e9e4d4'; ctx.lineWidth = HALF * 2 + 14; ctx.stroke(T.path);
    if (!low) { ctx.setLineDash([22, 22]); ctx.strokeStyle = '#d8404f'; ctx.stroke(T.path); ctx.setLineDash([]); }
    ctx.strokeStyle = '#262a33'; ctx.lineWidth = HALF * 2; ctx.stroke(T.path);
    ctx.setLineDash([18, 30]); ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 3; ctx.stroke(T.path); ctx.setLineDash([]);
    if (near(T.x[0], T.y[0])) { ctx.save(); ctx.translate(T.x[0], T.y[0]); ctx.rotate(Math.atan2(T.ty[0], T.tx[0])); const q = HALF / 5; for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#f1eeff' : '#0b0c10'; ctx.fillRect(-q + j * q, -HALF + i * q, q, q); } ctx.restore(); }
    for (const l of T.lamps) { if (!near(l.x, l.y)) continue; ctx.fillStyle = 'rgba(255,214,140,.07)'; ctx.beginPath(); ctx.arc(l.x, l.y, 86, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(l.x, l.y, 44, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(l.x, l.y, 5, 0, TAU); ctx.fill(); }
    if (G.skids.length) { ctx.strokeStyle = 'rgba(6,6,8,.42)'; ctx.lineWidth = 4; ctx.beginPath(); for (const s of G.skids) { if (!near(s[0], s[1])) continue; ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.stroke(); }
    if (playing && G.cd <= 0) {
      if (G.top && G.t < G.top.t + 40) { const p = ghostAt(G.top, G.t, G.pp); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = .55; drawCar(ctx, GOLD_CAR, 1); ctx.restore(); }
      else if (!G.top && G.pace && G.t < G.pace.t + 30) { const p = paceAt(G.pace, G.t, G.pp), b = reduceMotion ? 0 : Math.sin(now / 160) * 2; ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, 15 + b, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,210,74,.3)'; ctx.beginPath(); ctx.arc(p.x, p.y, 15 + b, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, TAU); ctx.fill(); }
      if (G.gh && G.t < G.gh.t + 40) { const p = ghostAt(G.gh, G.t, G.gp); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = .42; drawCar(ctx, GHOST_CAR, 1); ctx.restore(); }
    }
    for (let i = 0; i < pn; i++) { const p = parts[i]; ctx.globalAlpha = p.life / p.max * .7; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1.6 - p.life / p.max), 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
    if (!low) { const g = ctx.createLinearGradient(16, 0, 250, 0); g.addColorStop(0, 'rgba(255,244,200,.26)'); g.addColorStop(1, 'rgba(255,244,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(16, -7); ctx.lineTo(250, -86); ctx.lineTo(250, 86); ctx.lineTo(16, 7); ctx.fill(); }
    drawCar(ctx, cosItem('car', D.eq.car), 1); ctx.restore();
    ctx.restore();
    if (!low) { const g = ctx.createRadialGradient(CX, CY - 50, 110, CX, CY - 50, Math.max(LW, LH) * .78); g.addColorStop(0, 'rgba(2,6,10,0)'); g.addColorStop(1, 'rgba(2,6,10,.62)'); ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH); }
    if (!playing) return;
    if (G.flash > 0) { ctx.fillStyle = `rgba(220,255,160,${G.flash * .25})`; ctx.fillRect(0, 0, LW, LH); }
    // the drift ring
    if (c.dr) { const lv = c.ch >= CH[2] ? 3 : c.ch >= CH[1] ? 2 : c.ch >= CH[0] ? 1 : 0, from = lv ? CH[lv - 1] : 0, f = lv === 3 ? 1 : (c.ch - from) / (CH[lv] - from); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(CX, CY, 27, 0, TAU); ctx.stroke(); if (lv) { ctx.strokeStyle = CHC[lv]; ctx.beginPath(); ctx.arc(CX, CY, 27, 0, TAU); ctx.stroke(); } if (lv < 3) { ctx.strokeStyle = CHC[lv + 1]; ctx.beginPath(); ctx.arc(CX, CY, 27, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke(); } }
    // HUD: the clock, the lap, the map
    ctx.textAlign = 'left'; ctx.font = '20px ' + F; ctx.fillStyle = '#f1eeff'; ctx.fillText(tf(G.t), 12, 28);
    ctx.font = '9px ' + M; ctx.fillStyle = '#b9c9b0'; ctx.fillText(`LAP ${Math.min(LAPS, c.lap + 1)}/${LAPS}${G.gh ? ' · GHOST ' + tf(G.gh.t) : ''}${G.pace ? ' · BEST ' + tf(G.pace.t) : ''}`, 12, 42);
    if (G.delta && G.delta.life > 0) { G.delta.life--; ctx.font = '11px ' + F; ctx.fillStyle = G.delta.d <= 0 ? '#c6ff4a' : '#ffb347'; ctx.fillText(`${G.delta.who} ${G.delta.d <= 0 ? '−' : '+'}${tf(Math.abs(G.delta.d))}`, 12, 58); }
    const mw = (T.w - 600) * T.ms, mh = (T.h - 600) * T.ms, mx = LW - 12 - mw, my = 12, dot = (x, y, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx + (x - 300) * T.ms, my + (y - 300) * T.ms, r, 0, TAU); ctx.fill(); };
    ctx.fillStyle = 'rgba(6,10,8,.5)'; rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8); ctx.fill();
    ctx.save(); ctx.translate(mx, my); ctx.strokeStyle = 'rgba(241,238,255,.7)'; ctx.lineWidth = 2.5; ctx.stroke(T.mini); ctx.restore();
    if (G.cd <= 0) { if (G.top ? G.t < G.top.t : G.pace && G.t < G.pace.t) { const p = G.top ? ghostAt(G.top, G.t, G.pp) : paceAt(G.pace, G.t, G.pp); dot(p.x, p.y, '#ffd24a', 2.6); } if (G.gh && G.t < G.gh.t) { const p = ghostAt(G.gh, G.t, G.gp); dot(p.x, p.y, '#7fd4ff', 2.6); } }
    dot(T.x[0], T.y[0], '#0b0c10', 2); dot(c.x, c.y, '#c6ff4a', 3.2);
    ctx.textAlign = 'center';
    if (c.lost > 25 && gstate === 'run') { ctx.font = '13px ' + F; ctx.fillStyle = '#ffb347'; ctx.fillText('OFF COURSE', CX, CY - 60); }
    if (G.cd > 0) { const n = Math.ceil(G.cd / 60), f = (G.cd % 60) / 60; if (n <= 3) { ctx.globalAlpha = Math.min(1, f * 2 + .2); ctx.font = `${Math.round(64 + f * 16)}px ${F}`; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(n, CX + 3, LH * .36 + 3); ctx.fillStyle = '#c6ff4a'; ctx.fillText(n, CX, LH * .36); ctx.globalAlpha = 1; } }
    else if (G.t < 50) { ctx.globalAlpha = 1 - G.t / 50; ctx.font = '64px ' + F; ctx.fillStyle = '#f1eeff'; ctx.fillText('GO', CX, LH * .36); ctx.globalAlpha = 1; }
    if (gstate === 'ending') { ctx.font = '30px ' + F; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(G.fin ? 'FINISH' : 'OUT OF TIME', CX + 2, LH * .36 + 2); ctx.fillStyle = G.fin ? '#c6ff4a' : '#ff5a6e'; ctx.fillText(G.fin ? 'FINISH' : 'OUT OF TIME', CX, LH * .36); if (G.fin) { ctx.font = '16px ' + F; ctx.fillStyle = '#f1eeff'; ctx.fillText(tf(G.t), CX, LH * .36 + 26); } }
    // touch buttons, or a reminder of the keys
    if (usedTouch) { const by = LH - 84, box = (x, w, on) => { ctx.fillStyle = on ? 'rgba(198,255,74,.5)' : 'rgba(241,238,255,.1)'; rr(ctx, x, by, w, 70, 14); ctx.fill(); ctx.strokeStyle = 'rgba(241,238,255,.25)'; ctx.lineWidth = 1; ctx.stroke(); }, tri = (x, d) => { ctx.fillStyle = 'rgba(241,238,255,.8)'; ctx.beginPath(); ctx.moveTo(x - 9 * d, by + 21); ctx.lineTo(x - 9 * d, by + 49); ctx.lineTo(x + 12 * d, by + 35); ctx.fill(); };
      box(10, 84, tSteer < 0); tri(52, -1); box(102, 84, tSteer > 0); tri(144, 1); box(LW - 138, 128, tDrift); ctx.font = '13px ' + F; ctx.fillStyle = 'rgba(241,238,255,.85)'; ctx.fillText('DRIFT', LW - 74, by + 40); }
    else if (G.t < 400) { ctx.font = '9px ' + M; ctx.fillStyle = '#b9c9b0'; ctx.fillText(`${keyFor('left')} ${keyFor('right')} STEER · HOLD ${keyFor('drift').toUpperCase()} TO DRIFT · ${keyFor('brake')} BRAKE`, CX, LH - 14); }
    // small notes, tucked under the clock and out of the road
    const tt = G.toasts[0];
    if (tt) { const label = tt.ach ? '★ ' + tt.ach.n.toUpperCase() : tt.text, col = tt.ach ? TIERS[tt.ach.tier].c : tt.c; ctx.font = '9px ' + F; ctx.textAlign = 'center'; const w = Math.min(LW - 16, ctx.measureText(label).width + 22), y = 86; ctx.globalAlpha = Math.min(.95, tt.life / 20); ctx.fillStyle = 'rgba(6,10,8,.88)'; rr(ctx, CX - w / 2, y - 14, w, 20, 10); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = tt.ach ? '#f1eeff' : col; ctx.fillText(label, CX, y, LW - 30); ctx.globalAlpha = 1; }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || !G) { lastFrame = now; return; }
    const dtMs = Math.min(100, now - lastFrame); lastFrame = now; frameNo++;
    if (gstate === 'run' || gstate === 'ending') { acc += dtMs; let n = 0; while (acc >= 1000 / 60 && n++ < 5) { acc -= 1000 / 60; step(); if (gstate !== 'run' && gstate !== 'ending') break; } if (n >= 5) acc = 0; if (gstate === 'run' || gstate === 'ending') { engineTune(); drawGame(now); } }
    else if (gstate === 'idle') { if (frameNo % 2) return; step(); step(); drawGame(now); }
  }

  /* ---------- boot ---------- */
  addEventListener('resize', () => { resize(); if (G && gstate !== 'run' && gstate !== 'ending') drawGame(performance.now()); });
  fixEquipped(); resize(); newGame('free', true); syncWallet();
  show('home'); lastFrame = performance.now(); requestAnimationFrame(frame); onlineBoot();
  if (DEV) window.NR = { get G() { return G; }, get save() { return save; }, get state() { return gstate; }, startRun, step, show, keysDown, makeTrack, shapeTrack, tracks, drive, locate, auto, P, boards, boardKey, ghostLoad, ghostPack, ghostUnpack, scoreFor, NS };
