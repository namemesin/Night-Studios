  /* ================= the game ================= */
  // The road is 400 units wide on every screen and traffic is laid out by distance, so a daily route is the same
  // everywhere. Logic runs at a fixed 60 steps a second. You drive up the screen; the night clock is your life.
  const LW = 400, LANES = 5, LANE_W = 60, RX = 50, RW = LANES * LANE_W, PXM = 9, AHEAD = 980, COMBO_MAX = 40, CP_GAP = 800;
  const laneX = i => RX + LANE_W / 2 + i * LANE_W;
  let SC = 1, LH = 600, CY = 440;
  resizeHooks.push(() => { SC = W / LW; LH = H / SC; CY = Math.round(LH * .74); });

  let G = null, gstate = 'idle', lastRun = null;
  const keys = { l: false, r: false };
  let touchDir = 0, stick = null, usedTouch = COARSE;

  const PMAX = 420, parts = Array.from({ length: PMAX }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, c: '#fff', s: 2 }));
  let pn = 0;
  function spark(x, y, vx, vy, life, c, s) { if (pn >= PMAX) return; const p = parts[pn++]; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.c = c; p.s = s; }
  function burst(x, y, n, colors, spd = 4, life = 40, size = 3) {
    if (reduceMotion || save.settings.fx === 'low') n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = Math.random() * spd; spark(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (.6 + Math.random() * .4), colors[i % colors.length], Math.random() * size + 1); }
  }
  const baseSpeed = m => 8.5 + 5.5 * (1 - Math.exp(-m / 5000));
  const kmhOf = v => Math.round(v * 17);
  const zoneAt = m => { let z = 0; for (let i = 1; i < ZONES.length; i++) if (m >= ZONES[i].at) z = i; return z; };
  const TRAFFIC_COLORS = ['#c9d6e8', '#8a93ad', '#5b6bd6', '#d65b6b', '#5bd6a0', '#d6b65b', '#7d5bd6', '#3a3f58'];

  function newGame(mode, demo) {
    rollDay();
    const rush = mode === 'rush';
    G = { mode, demo: !!demo, rush, rand: mode === 'daily' ? seeded('nightdrive-' + dayKey) : Math.random,
      t: 0, px: 0, speed: 6, x: laneX(2), vx: 0, ang: 0, clock: (rush ? 90 : 40) * 60, score: 0, combo: 0, comboT: 0, nitro: 1, burn: 0, inv: 0, spin: 0, shield: false, magT: 0,
      zone: 0, st: blankStats(), cars: [], picks: [], cpAt: CP_GAP, cpN: 0, nextWave: 500, cleanFrom: 0, drafting: false, draftTicks: 0, crashLog: [],
      floats: [], toasts: [], shake: 0, flash: 0, punch: 0, freeze: 0, over: 0, cause: '', banner: 0, hint: 0, newAch: [], newMis: [], flk0: coins() };
    pn = 0;
    return G;
  }

  /* ---------- traffic ---------- */
  function spawnWave() {
    const r = G.rand, m = G.px / PXM, z = zoneAt(m), diff = Math.min(1, m / 9000), base = G.px + AHEAD;
    const onc = z >= 4 && !G.rush ? 2 : 0, fwd = []; // in the hills the two left lanes carry oncoming traffic
    for (let i = onc; i < LANES; i++) fwd.push(i);
    let n = 1 + (r() < .45 + diff * .35 ? 1 : 0) + (m > 2000 && r() < .25 + diff * .35 ? 1 : 0) + (G.rush ? 1 : 0);
    n = Math.min(n, fwd.length - 1); // one lane in every wave is always left open
    for (let i = 0; i < n; i++) {
      const lane = fwd.splice(Math.floor(r() * fwd.length), 1)[0], k = r();
      const c = { lane, x: laneX(lane), wy: base + r() * 240, v: 3.2 + r() * 2.4 + diff, len: 38, w: 22, kind: 'car', col: TRAFFIC_COLORS[Math.floor(r() * TRAFFIC_COLORS.length)], passed: false, hit: false, lc: 0, lcT: 0, to: lane };
      if (k < .12) { c.kind = 'truck'; c.len = 86; c.w = 26; c.v -= 1; } else if (k < .3) { c.kind = 'van'; c.len = 48; c.w = 24; }
      if (z >= 2 && c.kind !== 'truck' && r() < .16 + diff * .16) c.lc = 1; // will change lanes when you get close
      G.cars.push(c);
    }
    if (onc && r() < .55 + diff * .3) { const lane = Math.floor(r() * onc); G.cars.push({ lane, x: laneX(lane), wy: base + 200 + r() * 300, v: -(3.5 + r() * 1.5), len: 38, w: 22, kind: 'car', col: TRAFFIC_COLORS[Math.floor(r() * TRAFFIC_COLORS.length)], passed: false, hit: false, lc: 0, lcT: 0, to: lane, onc: true }); }
    // pickups sit in the gap behind each wave
    const py = base - 170, p = r(), pl = Math.floor(r() * LANES);
    if (r() < .55) for (let i = 0; i < 5; i++) G.picks.push({ k: 'coin', x: laneX(pl), wy: py + i * 44, hit: false });
    const ol = (pl + 1 + Math.floor(r() * (LANES - 1))) % LANES;
    const pk = p < .09 && !G.rush ? 'clock' : p < .19 ? 'nitro' : p < .25 ? 'shield' : p < .31 ? 'magnet' : '';
    if (pk) G.picks.push({ k: pk, x: laneX(ol), tx: laneX(ol), wy: py + 60, hit: false });
    G.nextWave = G.px + (G.rush ? 250 : lerp(430, 250, diff)) * (.8 + r() * .4);
  }
  // Traffic keeps moving but pickups stand still, so a car can end up parked on one. While a power-up is still well
  // up the road, it looks ahead to where every car will be when you reach it and slides to the nearest lane that
  // will be clear. Close up it stays put, so it never jumps out from under you.
  function placePicks() {
    const sp = Math.max(G.speed, 6), onc = G.zone >= 4 && !G.rush ? 2 : 0;
    for (const o of G.picks) {
      if (o.k === 'coin' || o.hit) continue;
      const dy = o.wy - G.px;
      if (dy > 340 && dy < 1100) {
        const t = dy / sp, clear = l => !G.cars.some(c => !c.hit && (Math.abs(c.x - laneX(l)) < 30 || (c.lc && c.to === l)) && Math.abs(c.wy + c.v * t - o.wy) < c.len / 2 + 46);
        const cur = Math.round((o.tx - RX - LANE_W / 2) / LANE_W);
        if (!clear(cur)) for (let d = 1; d < LANES; d++) { const l = [cur - d, cur + d].find(l => l >= 0 && l < LANES && (l >= onc || cur < onc) && clear(l)); if (l != null) { o.tx = laneX(l); break; } }
      }
      if (o.x !== o.tx) o.x += clamp(o.tx - o.x, -6, 6);
    }
  }
  function moveTraffic() {
    const cars = G.cars, onc = G.zone >= 4 && !G.rush ? 2 : 0;
    for (const c of cars) {
      c.wy += c.v;
      if (c.lc === 1 && c.wy - G.px < 430 && c.wy - G.px > 210) {
        const opts = [c.lane - 1, c.lane + 1].filter(l => l >= onc && l < LANES && !cars.some(o => o !== c && (o.lane === l || o.to === l) && Math.abs(o.wy - c.wy) < 110));
        if (opts.length) { c.to = opts[Math.floor(G.rand() * opts.length)]; c.lc = 2; c.lcT = 42; c.moved = true; } else c.lc = 0;
      } else if (c.lc === 2) { if (--c.lcT <= 0) c.lc = 3; }
      else if (c.lc === 3) { const tx = laneX(c.to), d = tx - c.x; if (Math.abs(d) < 1.4) { c.x = tx; c.lane = c.to; c.lc = 0; } else c.x += Math.sign(d) * 1.4; }
    }
    if (G.t % 5 === 0) for (const a of cars) { // nobody rear-ends anybody
      if (a.v <= 0) continue;
      for (const b of cars) if (b !== a && b.v > 0 && b.wy > a.wy && b.wy - a.wy < (a.len + b.len) / 2 + 34 && Math.abs(b.x - a.x) < 24 && b.v < a.v) a.v = b.v;
    }
  }

  /* ---------- scoring and feedback ---------- */
  const mult = () => 1 + Math.min(G.combo, COMBO_MAX) * .1;
  function addScore(n) { const v = n * mult() * (G.burn > 0 ? 2 : 1); G.score += v; return Math.round(v); }
  function float(x, y, text, c, big) { if (G.demo) return; if (G.floats.length > 12) G.floats.shift(); G.floats.push({ x: clamp(x, 70, LW - 70), y, text, c, life: big ? 75 : 50, big }); }
  function say(text, c = '#3df5ff', life = 150) { if (!G.demo) G.toasts.push({ text, c, life }); }
  const snd = (...a) => { if (!G.demo) tone(...a); };
  function bump(n = 1) {
    if (G.demo) return;
    const before = G.combo; G.combo = Math.min(COMBO_MAX, G.combo + n); G.comboT = comboWin(up('combo'));
    if (G.combo > G.st.maxCombo) G.st.maxCombo = G.combo;
    if (Math.floor(G.combo / 10) > Math.floor(before / 10)) { float(G.x, CY - 70, `x${mult().toFixed(0)} MULTIPLIER`, '#ffd24a', true); G.punch = .8; snd(1320, .2, 'square', .03); }
  }
  function addNitro(v) { const before = Math.floor(G.nitro); G.nitro = Math.min(3, G.nitro + v); if (Math.floor(G.nitro) > before && !G.demo) { snd(660, .1, 'triangle', .05); snd(990, .18, 'triangle', .05, 0, .08); } }
  function fireNitro() {
    if (gstate !== 'run' || !G || G.demo || G.nitro < 1 || G.burn > 0 || G.spin > 0) return;
    G.nitro -= 1; G.burn = nitroBurn(up('nitro')); G.st.nitros++; G.flash = .6; G.shake = 6; G.punch = 1; buzz(25);
    float(G.x, CY - 44, 'NITRO · DOUBLE POINTS', '#3df5ff', true);
    tone(160, .6, 'sawtooth', .07, 500); noise(.5, .1, 1200, 'bandpass');
  }
  function crashInto(c) {
    const S = G.st;
    c.hit = true; burst(c.x, CY - (c.wy - G.px), 30, [c.col, '#ffd24a', '#ff7a3d', '#f1eeff'], 7, 45, 4);
    if (G.shield) { G.shield = false; G.inv = 70; G.shake = 8; G.flash = .4; float(G.x, CY - 40, 'BUMPER SAVED YOU', '#8fd3ff', true); snd(900, .3, 'sine', .07, -600); buzz(30); return; }
    const cost = crashCost(up('armor'));
    if (G.crashLog.length < 40) G.crashLog.push([Math.floor(G.px / PXM), G.zone, c.onc ? 'oncoming' : c.moved ? 'lanechange' : c.kind]);
    S.crashes++; G.spin = 42; G.inv = 120; G.speed *= .38; G.burn = 0; G.clock -= cost; G.combo = 0; G.cleanFrom = G.px / PXM; G.shake = 16; G.flash = .9; G.vx += (G.x < c.x ? -1 : 1) * 5;
    float(G.x, CY - 44, `CRASH  -${(cost / 60).toFixed(1)} s`, '#ff4d6d', true); buzz([40, 30, 60]);
    noise(.45, .22); tone(140, .45, 'sawtooth', .08, -100);
  }
  function pickup(o) {
    const S = G.st, k = o.k, sy = CY - (o.wy - G.px);
    if (k === 'coin') { S.coins++; addScore(5); spark(o.x, sy, 0, -1.5, 16, '#ffe14a', 3); snd(1400 + (S.coins % 6) * 120, .05, 'triangle', .028); }
    else if (k === 'clock') { G.clock += 180; burst(o.x, sy, 16, ['#5cf2b0', '#f1eeff'], 4, 30, 3); float(o.x, sy - 14, '+3.0 s', '#5cf2b0', true); snd(784, .1, 'triangle', .05); snd(1175, .2, 'triangle', .05, 0, .1); }
    else if (k === 'nitro') { addNitro(1); burst(o.x, sy, 16, ['#3df5ff', '#f1eeff'], 4, 30, 3); float(o.x, sy - 14, 'NITRO', '#3df5ff'); }
    else if (k === 'shield') { G.shield = true; burst(o.x, sy, 16, ['#8fd3ff', '#f1eeff'], 4, 30, 3); float(o.x, sy - 14, 'BUMPER', '#8fd3ff'); snd(520, .2, 'sine', .06, 400); }
    else if (k === 'magnet') { G.magT = 540; burst(o.x, sy, 16, ['#ff3dcb', '#f1eeff'], 4, 30, 3); float(o.x, sy - 14, 'MAGNET', '#ff3dcb'); snd(300, .25, 'square', .04, 300); }
  }

  function collide() {
    const S = G.st, px = G.px;
    G.drafting = false;
    for (const c of G.cars) {
      if (c.hit) continue;
      const dy = c.wy - px, dx = c.x - G.x, hy = 19 + c.len / 2, hx = 11 + c.w / 2;
      if (dy > 170 || dy < -hy - 30) { if (dy < -hy && !c.passed) c.passed = true; continue; }
      if (Math.abs(dx) < hx - 3 && Math.abs(dy) < hy - 3) { if (G.inv <= 0 && !G.demo) { crashInto(c); if (G.clock <= 0) return; } continue; }
      if (!c.passed && dy < -hy + 6) {
        c.passed = true;
        if (G.spin > 0 || G.inv > 0 || G.demo) continue;
        const gap = Math.abs(dx) - hx;
        if (gap < 20) {
          S.nearMiss++; if (c.onc) S.oncoming++; bump(c.onc ? 2 : 1); addNitro(c.onc ? .2 : .12);
          const p = addScore(c.onc ? 60 : 20); float(c.x, CY - 30, c.onc ? `HEAD-ON +${p}` : `CLOSE +${p}`, c.onc ? '#ff3dcb' : '#3df5ff', !!c.onc);
          snd(820 + Math.min(G.combo, 24) * 36, .07, 'square', .024); if (c.onc) snd(1640, .12, 'square', .02, 0, .05);
        } else addScore(4);
      } else if (!c.onc && Math.abs(dx) < 15 && dy > hy + 2 && dy < 150 && G.spin <= 0) G.drafting = true;
    }
    const magR = G.magT > 0 ? 150 : up('magnet') ? 30 + up('magnet') * 18 : 0;
    for (const o of G.picks) {
      if (o.hit) continue;
      const dy = o.wy - px, dx = o.x - G.x;
      if (dy > 200 || dy < -60) continue;
      if (magR && o.k === 'coin') { const d = Math.hypot(dx, dy); if (d < magR && d > 1) { const pull = Math.min(d, 3 + G.speed * .5); o.x -= dx / d * pull; o.wy -= dy / d * pull; } }
      if (Math.abs(dx) < 24 && Math.abs(dy) < 30) { o.hit = true; if (!G.demo) pickup(o); }
    }
  }

  /* ---------- one step of the world (1/60 s) ---------- */
  function step() {
    const S = G.st;
    G.t++;
    G.shake *= .9; if (G.shake < .2) G.shake = 0;
    G.flash = Math.max(0, G.flash - .04); G.punch = Math.max(0, G.punch - .05);
    for (let i = pn - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy + G.speed * .5; p.vx *= .95; p.vy *= .95; if (--p.life <= 0) { parts[i] = parts[--pn]; parts[pn] = p; } }
    for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.y -= 1; if (--f.life <= 0) G.floats.splice(i, 1); }
    if (G.toasts.length && --G.toasts[0].life <= 0) G.toasts.shift();
    if (gstate === 'ending') { G.speed *= .975; G.px += G.speed; moveTraffic(); if (--G.over <= 0) finishRun(); return; }

    if (G.inv > 0) G.inv--; if (G.magT > 0) G.magT--;
    const m0 = G.px / PXM, burning = G.burn > 0;
    if (burning) G.burn--;
    const target = (G.rush ? 11.5 : baseSpeed(m0)) * (burning ? 1.4 : 1);
    G.speed += (target - G.speed) * (G.speed < target ? (burning ? .06 : .02) : .05);
    if (G.combo > 0 && --G.comboT <= 0) { if (G.combo >= 8) float(G.x, CY - 60, 'COMBO LOST', '#7b7799'); G.combo = 0; }

    // steering
    let dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0) || touchDir;
    if (G.demo) dir = autopilot();
    if (G.spin > 0) { G.spin--; dir = 0; }
    G.vx += dir * 1.05 * (1 + .08 * up('grip')); G.vx *= .84; G.x += G.vx;
    const xmin = RX + 13, xmax = RX + RW - 13;
    if (G.x < xmin || G.x > xmax) { // scraping the barrier: sparks and drag, but no crash
      G.x = clamp(G.x, xmin, xmax); G.vx *= -.3; G.speed *= .985;
      if (!G.demo) { spark(G.x + (G.x <= xmin ? -11 : 11), CY + (Math.random() - .5) * 30, (Math.random() - .5) * 2, 2 + Math.random() * 3, 16, Math.random() < .5 ? '#ffd24a' : '#ffffff', 2); if (G.t % 8 === 0) snd(700 + Math.random() * 500, .05, 'sawtooth', .015); }
    }
    G.ang += (G.vx * .05 + (G.spin > 0 ? Math.sin(G.spin * .45) * 1.6 : 0) - G.ang) * .35;

    if (!reduceMotion) {
      if (burning) { for (const o of [-6, 6]) spark(G.x + o, CY + 20, (Math.random() - .5) * .8, 1 + Math.random() * 2, 16, Math.random() < .5 ? '#3df5ff' : '#f1eeff', 3); }
      else if (Math.abs(G.vx) > 3.4 && Math.random() < .5) spark(G.x - Math.sign(G.vx) * 8, CY + 16, 0, 1, 20, 'rgba(241,238,255,.5)', 2);
    }

    // move up the road in small enough slices that nothing can be skipped over
    const slices = Math.ceil(G.speed / 7), ds = G.speed / slices;
    for (let i = 0; i < slices; i++) { G.px += ds; collide(); }
    moveTraffic(); placePicks();
    const m = G.px / PXM;
    addScore(G.speed / PXM);
    S.meters = Math.floor(m); S.score = Math.floor(G.score); S.kmh = Math.max(S.kmh, kmhOf(G.speed)); S.clean = Math.max(S.clean, Math.floor(m - G.cleanFrom));
    if (G.mode === 'daily') S.daily = S.score; if (G.rush) S.rush = S.score;
    if (G.drafting) { addNitro(.0042 * (1 + .25 * up('draft'))); if (++G.draftTicks % 30 === 0) { S.draft = Math.floor(G.draftTicks / 60); bump(); const p = addScore(15); float(G.x, CY - 34, `DRAFT +${p}`, '#b48cff'); snd(520, .08, 'sine', .04, 200); } }

    if (G.px >= G.nextWave) spawnWave();
    if (G.t % 30 === 0) {
      let w = 0; for (const c of G.cars) if (!c.hit && c.wy > G.px - 320) G.cars[w++] = c; G.cars.length = w;
      w = 0; for (const o of G.picks) if (!o.hit && o.wy > G.px - 120) G.picks[w++] = o; G.picks.length = w;
    }
    if (G.demo) return;

    if (!G.rush) {
      if (m >= G.cpAt) {
        G.cpN++; S.cps = G.cpN; G.cpAt += CP_GAP;
        const secs = Math.max(6.5, 12.5 - G.cpN * .5) + up('clock') * .5;
        G.clock += secs * 60; bump(); const p = addScore(150 + G.cpN * 25); G.punch = .8; G.flash = Math.max(G.flash, .25);
        float(LW / 2, CY - 110, `CHECKPOINT ${G.cpN}  +${secs.toFixed(1)} s`, '#5cf2b0', true); float(LW / 2, CY - 88, `+${fmt(p)}`, '#5cf2b0'); chime([523, 784, 1046]);
      }
      const z = zoneAt(m);
      if (z !== G.zone) { G.zone = z; S.zone = z; G.banner = 150; snd(392, .15, 'triangle', .06); snd(587, .25, 'triangle', .06, 0, .12); if (z === 3) say('HEADLIGHTS ONLY · WATCH THE TAIL LIGHTS', '#ff7a3d', 190); if (z === 4) say('ONCOMING TRAFFIC ON THE LEFT · SKIM IT FOR TRIPLE', '#5cf2b0', 200); }
    }
    if (G.banner > 0) G.banner--;
    music.intensity = G.rush ? 4 : Math.min(5, G.zone + (burning ? 1 : 0)); music.tense = G.clock < 600;
    if (--G.clock <= 0) { G.clock = 0; G.cause = G.rush ? 'time' : 'dawn'; gstate = 'ending'; G.over = 90; musicStop(); pauseBtn.hidden = nitroBtn.hidden = true; chime(G.rush ? [784, 988, 1318] : [659, 523, 392], 'triangle', .06, .16); return; }
    if (G.clock < 600 && G.clock % 60 === 0) snd(G.clock < 300 ? 1175 : 880, .07, 'square', .035);
    if (G.t % 20 === 0) liveChecks();
    const showN = G.nitro >= 1 && G.burn <= 0 && usedTouch; if (nitroBtn.hidden === showN) nitroBtn.hidden = !showN;
    if (!D.tut) tutorial(m);
  }
  // Used by the backdrop behind the menus: pick the lane with the most room and steer for it.
  function autopilot() {
    let best = 2, bestD = -1;
    for (let l = 0; l < LANES; l++) { let d = 600; for (const c of G.cars) if (!c.hit && Math.abs(c.x - laneX(l)) < 36 && c.wy > G.px - 40 && c.wy - G.px < d) d = c.wy - G.px; d -= Math.abs(laneX(l) - G.x) * .6; if (d > bestD) { bestD = d; best = l; } }
    return clamp((laneX(best) - G.x) / 26, -1, 1);
  }
  function tutorial(m) {
    const H0 = [[30, usedTouch ? 'SLIDE YOUR FINGER TO STEER' : `STEER WITH ${keyFor('left')} AND ${keyFor('right')}`], [220, 'THE CLOCK IS YOUR NIGHT · CHECKPOINTS ADD TIME'], [450, 'PASS CARS CLOSE TO BUILD A COMBO'], [700, 'TUCK IN BEHIND A CAR TO FILL NITRO'], [1000, usedTouch ? 'TAP NITRO FOR SPEED AND DOUBLE POINTS' : `${keyFor('nitro')} FIRES NITRO: SPEED AND DOUBLE POINTS`]];
    if (G.hint < H0.length && m >= H0[G.hint][0]) { say(H0[G.hint][1], '#ffe14a', 210); if (++G.hint === H0.length) D.tut = true; }
  }
  function liveChecks() {
    const a = checkAch(G.st), ms = missionTick(G.st, false);
    for (const x of a) { G.newAch.push(x); G.toasts.push({ ach: x, life: 200, max: 200 }); chime(x.tier === 'b' ? [523, 659, 784] : [587, 740, 880, 1175], 'triangle', .055); }
    for (const x of ms) { G.newMis.push(x); say(`JOB DONE · +${x.pay} COINS`, '#5cf2b0', 170); chime([784, 1175, 1568]); }
    if (a.length || ms.length) saveLocal();
  }

  /* ---------- starting, pausing and finishing ---------- */
  let acc = 0, lastFrame = 0, frameNo = 0;
  function startRun(mode) {
    if (['free', 'daily', 'rush'].includes(mode)) D.mode = mode; else mode = D.mode;
    initAudio(); newGame(mode); armRun(mode);
    gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; nitroBtn.hidden = true; $('top').hidden = true; resize();
    G.banner = G.rush ? 0 : 130;
    if (G.rush) say('RUSH HOUR · 90 SECONDS · EVERY CAR IS A CHANCE', '#ffd24a', 170); else if (mode === 'daily') say(`DAILY ROUTE · ${dayLabel.toUpperCase()}`, '#ff3dcb', 140);
    chime([523, 784]); music.intensity = 0; music.tense = false; musicStart(); acc = 0; lastFrame = performance.now();
  }
  // What a drive reports when it ends: where, how, and every crash on the way. See the online file for where it goes.
  function runData(end) {
    const S = G.st;
    return { end, mode: G.mode, m: Math.floor(G.px / PXM), s: Math.floor(G.score), z: G.zone, t: Math.round(G.t / 6) / 10, x: Math.round(G.x / LW * 1000), n: D.life.runs, left: Math.round(G.clock / 6) / 10,
      combo: S.maxCombo, near: S.nearMiss, onc: S.oncoming, nitros: S.nitros, draft: Math.floor(G.draftTicks / 60), cps: S.cps, kmh: S.kmh, crashes: S.crashes, cr: G.crashLog, coins: S.coins, lv: level(), up: UPG.reduce((n, u) => n + up(u.id), 0), ach: achCount() };
  }
  function pauseRun() { if (gstate !== 'run') return; gstate = 'paused'; musicStop(); pauseBtn.hidden = nitroBtn.hidden = true; keys.l = keys.r = false; touchDir = 0; stick = null; show('pause'); }
  function resumeRun() { if (gstate !== 'paused') return; initAudio(); gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; musicStart(); acc = 0; lastFrame = performance.now(); }
  function restartRun() { if (gstate !== 'run' && gstate !== 'paused') return; if (G.px / PXM > 100) logRun(runData('restart')); musicStop(true); startRun(G.mode); }
  function leaveRun() { if ((gstate === 'run' || gstate === 'paused') && G.px / PXM > 100) logRun(runData('quit')); musicStop(); gstate = 'idle'; $('top').hidden = false; pauseBtn.hidden = nitroBtn.hidden = true; resize(); newGame('free', true); for (let i = 0; i < 200; i++) step(); }
  function finishRun() {
    const S = G.st, s = Math.floor(G.score), mode = G.mode, L = D.life, m = S.meters;
    logRun(runData(G.cause || 'dawn'));
    S.score = s; if (mode === 'daily') S.daily = s; if (G.rush) S.rush = s; S.draft = Math.floor(G.draftTicks / 60);
    const isBest = G.rush ? s > D.bestRush : s > D.best;
    if (G.rush) D.bestRush = Math.max(D.bestRush, s); else D.best = Math.max(D.best, s);
    for (const k of RUN_STATS) if (S[k] > D.bs[k]) D.bs[k] = Math.floor(S[k]);
    L.runs++; L.meters += m; L.score += s; L.coins += S.coins; L.nearMiss += S.nearMiss; L.oncoming += S.oncoming; L.draft += S.draft; L.nitros += S.nitros; L.cps += S.cps; L.crashes += S.crashes; L.secs += Math.round(G.t / 60);
    if (mode === 'daily' && D.dlast !== dayKey) { D.dlast = dayKey; L.dailyDays++; }
    for (const x of missionTick(S, true)) G.newMis.push(x);
    for (const x of checkAch(S)) G.newAch.push(x);
    const pay = earn(Math.round((S.coins + s / 300) * (1 + .1 * up('lucky')) * Studio.eventMult('coins'))), xp = Math.round((m / 12 + s / 80) * Studio.eventMult('xp')), lv = addXP(xp);
    for (const x of checkAch(S)) G.newAch.push(x);
    if (!G.rush) { D.top.push({ s, d: m, z: G.zone, m: mode }); D.top.sort((a, b) => b.s - a.s); D.top = D.top.slice(0, 8); }
    const title = isBest ? (G.rush ? 'New Rush Hour record!' : 'New best!') : G.rush ? 'Rush Hour over' : 'Dawn caught you';
    lastRun = { s, isBest, title, mode, d: m, z: G.zone, st: S, coins: pay, xp, lv, ach: G.newAch.slice(), mis: G.newMis.slice(), secs: Math.round(G.t / 6) / 10, post: '' };
    fixEquipped(); persist();
    if (typeof submitScore === 'function') submitScore(lastRun);
    gstate = 'over'; $('top').hidden = false; resize();
    if (lv.levels) sfx.level(); else if (isBest) sfx.win();
    show('over');
  }

  /* ---------- input ---------- */
  const codeOf = e => e.code || (e.key === ' ' ? 'Space' : e.key || '');
  addEventListener('keydown', e => {
    const c = codeOf(e);
    if (capturing) { e.preventDefault(); if (c && c !== 'Escape') { for (const [a] of KEY_ACTIONS) save.settings.keys[a] = save.settings.keys[a].map(k => k === c ? '' : k); save.settings.keys[capturing.a][capturing.i] = c; persist(); sfx.equip(); } capturing = null; render(); return; }
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (bound('left', c)) { keys.l = true; usedTouch = false; } if (bound('right', c)) { keys.r = true; usedTouch = false; }
    if (gstate === 'run') {
      if (KEY_ACTIONS.some(([a]) => bound(a, c))) e.preventDefault();
      if (bound('nitro', c)) fireNitro();
      if (bound('pause', c)) pauseRun(); else if (bound('restart', c) && !e.repeat) restartRun();
      return;
    }
    const onButton = e.target && /^(BUTTON|SUMMARY|A)$/.test(e.target.tagName || '');
    if (gstate === 'paused' && view === 'pause') { if (bound('pause', c)) { e.preventDefault(); resumeRun(); } else if (bound('restart', c)) { e.preventDefault(); restartRun(); } else if (c === 'Enter' && !onButton) resumeRun(); return; }
    if ((view === 'over' || view === 'home') && !onButton && (c === 'Enter' || (bound('restart', c) && !e.repeat))) { e.preventDefault(); startRun(); }
  });
  addEventListener('keyup', e => { const c = codeOf(e); if (bound('left', c)) keys.l = false; if (bound('right', c)) keys.r = false; });
  addEventListener('blur', () => { keys.l = keys.r = false; touchDir = 0; stick = null; });
  const STICK_R = 36;
  const localX = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width || W }; };
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') usedTouch = true;
    initAudio(); const p = localX(e);
    if (save.settings.steer === 'sides') { touchDir = p.x < p.w / 2 ? -1 : 1; stick = { id: e.pointerId, sides: true }; } else { stick = { id: e.pointerId, ox: p.x, x: p.x, y: p.y }; touchDir = 0; }
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  });
  cv.addEventListener('pointermove', e => {
    if (!stick || e.pointerId !== stick.id) return;
    const p = localX(e);
    if (stick.sides) { touchDir = p.x < p.w / 2 ? -1 : 1; return; }
    let dx = p.x - stick.ox;
    if (dx > STICK_R) { stick.ox = p.x - STICK_R; dx = STICK_R; } else if (dx < -STICK_R) { stick.ox = p.x + STICK_R; dx = -STICK_R; }
    stick.x = p.x; touchDir = Math.abs(dx) < 4 ? 0 : clamp((dx - Math.sign(dx) * 4) / (STICK_R - 4), -1, 1);
  });
  for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, e => { if (stick && e.pointerId === stick.id) { stick = null; touchDir = 0; } });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  nitroBtn.addEventListener('pointerdown', e => { e.preventDefault(); fireNitro(); });
  pauseBtn.addEventListener('click', pauseRun);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseRun(); saveLocal(); } });

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || !G) { lastFrame = now; return; }
    const dtMs = Math.min(100, now - lastFrame); lastFrame = now; frameNo++;
    if (gstate === 'run' || gstate === 'ending') {
      acc += dtMs; let n = 0;
      while (acc >= 1000 / 60 && n++ < 5) { acc -= 1000 / 60; if (G.freeze > 0) G.freeze--; else step(); if (gstate !== 'run' && gstate !== 'ending') break; }
      if (n >= 5) acc = 0;
      if (gstate === 'run' || gstate === 'ending') drawGame(now);
    } else if (gstate === 'idle') { if (frameNo % 2 || (reduceMotion && frameNo > 2)) return; step(); drawGame(now); }
  }
