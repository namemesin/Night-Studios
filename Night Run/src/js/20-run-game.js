  /* ================= NIGHT RUN: the game ================= */
  // The mountain is 400 units wide on every screen, and the course is laid out by distance, not by time or screen
  // size, so a daily course is the same on a phone and a desktop. Logic runs at a fixed 60 steps a second.
  const LW = 400, AHEAD = 950, PARK_TICKS = 75 * 60, COMBO_MAX = 50;
  let SC = 1, LH = 600, PY = 170;
  resizeHooks.push(() => { SC = W / LW; LH = H / SC; PY = Math.round(Math.min(LH * .28, 230)); });

  let G = null, gstate = 'idle', lastRun = null, pendingGhost = null; // pendingGhost: a friend's run to race next
  const keys = { l: false, r: false, grab: false };
  let touchDir = 0, stick = null, touchGrab = false, usedTouch = COARSE;

  // particles: one flat pool, swap-remove, no garbage while riding
  const PMAX = 520, parts = Array.from({ length: PMAX }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, c: '#fff', s: 2 }));
  let pn = 0;
  function spark(x, y, vx, vy, life, c, s) { if (pn >= PMAX) return; const p = parts[pn++]; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.c = c; p.s = s; }
  function burst(x, y, n, colors, spd = 4, life = 40, size = 3) {
    if (reduceMotion || save.settings.fx === 'low') n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = Math.random() * spd; spark(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (.6 + Math.random() * .4), colors[i % colors.length], Math.random() * size + 1); }
  }

  const baseSpeed = m => 3.6 + 7.2 * (1 - Math.exp(-m / 1500));
  const zoneAt = m => { let z = 0; for (let i = 1; i < ZONES.length; i++) if (m >= ZONES[i].at) z = i; return z; };
  const ghostKey = mode => 'nightgames-run-ghost-' + mode;
  function loadGhost(mode) { try { const g = JSON.parse(localStorage.getItem(ghostKey(mode)) || 'null'); if (g && Array.isArray(g.r) && g.r.length >= 8 && (mode !== 'daily' || g.day === dayKey)) return g; } catch (e) {} return null; }

  function newGame(mode, demo) {
    rollDay();
    const park = mode === 'park';
    G = { mode, demo: !!demo, park, rand: mode === 'daily' ? seeded('nightrun2-' + dayKey) : Math.random,
      t: 0, px: 0, m0: 0, score: 0, combo: 0, comboT: 0, x2T: 0, magT: 0, flareT: 0, inv: 0, lant: 0, chain: 0, zone: 0, st: blankStats(),
      x: LW / 2, vx: 0, lean: 0, air: 0, airMax: 1, spin: 0, grabT: 0, grabLate: 0, sw: false, shield: !demo && !park && up('shield') > 0, spare: false, revive: false,
      grind: null, grindPts: 0, onIce: 0, obs: [], rows: [], blocks: [], safeX: LW / 2, lastWy: 0, lastX: LW / 2, nextRow: 620, featCd: 3, lantCd: 4,
      rec: [], ghost: null, gName: '', gx: 0, gd: 0, gDone: false, gPassed: false, shake: 0, flash: 0, punch: 0, freeze: 0, crashT: 0, cause: '', banner: 0,
      floats: [], toasts: [], trail: [], used: [], newAch: [], newMis: [], hint: 0, parkT: PARK_TICKS, speed: 3.6, flk0: coins() };
    pn = 0;
    if (!demo && !park) { if (pendingGhost && pendingGhost.mode === mode) { G.ghost = pendingGhost; G.gName = pendingGhost.name; } else if (save.settings.ghost) G.ghost = loadGhost(mode); }
    if (mode === 'free' && !demo && !G.gName) applyBoosts();
    fillCourse();
    return G;
  }
  function applyBoosts() {
    for (const b of BOOSTS) if (R.kit[b.id]) { R.kit[b.id] = false; G.used.push(b.id); }
    if (!G.used.length) return;
    if (G.used.includes('head')) { G.px = HEAD_START * 10; G.m0 = HEAD_START; G.nextRow = G.px + 520; G.lastWy = G.px; G.ghost = null; G.zone = zoneAt(HEAD_START); }
    if (G.used.includes('lant')) G.lant = 3;
    if (G.used.includes('spare')) G.spare = true;
    if (G.used.includes('revive')) G.revive = true;
    say('BOOSTS: ' + G.used.map(id => BOOSTS.find(b => b.id === id).short.toUpperCase()).join(' · '), '#7fe8ff');
    saveLocal();
  }

  /* ---------- course ---------- */
  const SOLID = { tree: 1, rock: 1, skier: 1, snowman: 1 };
  function put(k, x, wy, extra) {
    const o = { k, x, wy, s: 10, hit: false, passed: false, wob: G.rand() * 6 };
    if (k === 'tree') o.s = 15 + G.rand() * 15; else if (k === 'rock') o.s = 14 + G.rand() * 13; else if (k === 'snowman') o.s = 20; else if (k === 'skier') o.s = 14;
    if (extra) Object.assign(o, extra);
    G.obs.push(o); return o;
  }
  // Is x clear of the safe lane and of rails, ramps and other features around wy?
  function clearAt(x, r, wy, lane, laneX) {
    if (lane && Math.abs(x - laneX) < lane + r) return false;
    for (const b of G.blocks) if (wy > b.y0 - 30 && wy < b.y1 + 30 && Math.abs(x - b.x) < b.w + r) return false;
    return true;
  }
  // Where the safe line is at a given point down the hill.
  function lineAt(y) {
    const a = G.rows; let i = 0; while (i < a.length - 2 && a[i + 2] < y) i += 2;
    if (a.length < 4 || y <= a[i]) return a.length ? a[i + 1] : LW / 2;
    return i + 2 < a.length ? lerp(a[i + 1], a[i + 3], clamp((y - a[i]) / Math.max(1, a[i + 2] - a[i]), 0, 1)) : a[i + 1];
  }
  const block = (x, w, y0, y1) => G.blocks.push({ x, w, y0, y1 });
  function flakeLine(x, wy, n, gap, wave) { for (let i = 0; i < n; i++) put('flake', clamp(x + (wave ? Math.sin(i * .8) * wave : 0), 14, LW - 14), wy + i * gap); }

  function spawnRow(wy) {
    const r = G.rand, m = wy / 10, z = zoneAt(m), diff = Math.min(1, m / 3600);
    const gap = lerp(175, 80, diff) * (.75 + r() * .5);
    // The safe lane wanders, but never faster than you can steer. Nothing solid is ever placed in it.
    G.safeX = clamp(G.safeX + (r() - .5) * 2 * Math.min(120, gap * .62), 46, LW - 46);
    const lane = lerp(44, 31, diff), pwy = G.lastWy, plx = G.lastX;
    G.rows.push(wy, G.safeX); G.lastWy = wy; G.lastX = G.safeX;
    if (G.park) return parkRow(wy, gap);

    if (--G.featCd <= 0) {
      const f = r();
      G.featCd = 2 + Math.floor(r() * 3);
      if (z >= 5 && f < .3) {
        // crevasse: jump it off the kicker, or ride around the end
        const w = 120 + r() * 80, viaRamp = r() < .6;
        if (viaRamp) { put('ramp', G.safeX, wy, { w: 56 }); flakeLine(G.safeX, wy + 60, 5, 44); put('crev', clamp(G.safeX, w / 2 + 8, LW - w / 2 - 8), wy + 240, { w, h: 20, jag: Array.from({ length: 9 }, () => (r() - .5) * 8) }); block(G.safeX, 40, wy - 40, wy + 300); G.rows.push(wy + 300, G.safeX); G.lastWy = wy + 300; G.nextRow = wy + 330; return; }
        const side = G.safeX < LW / 2 ? 1 : -1, cx = clamp(G.safeX + side * (w / 2 + lane + 14), w / 2 + 6, LW - w / 2 - 6);
        if (Math.abs(cx - G.safeX) > w / 2 + lane) put('crev', cx, wy, { w, h: 20, jag: Array.from({ length: 9 }, () => (r() - .5) * 8) });
      } else if (f < .26) { put('ramp', G.safeX, wy, { w: 56 }); flakeLine(G.safeX, wy + 70, 5, 40); block(G.safeX, 34, wy - 20, wy + 40); }
      else if (f < .5) {
        const len = 170 + r() * 190, x = clamp(G.safeX + (r() - .5) * 50, 26, LW - 26);
        put('rail', x, wy, { len }); flakeLine(x, wy + 14, Math.floor(len / 34), 34); block(x, 16, wy - 10, wy + len + 20);
      } else if (f < .72 && m > 150) {
        const n = 3 + Math.floor(r() * 3) + (z >= 3 ? 1 : 0), w = lerp(104, 78, diff), sw = lerp(54, 86, diff);
        let x = G.safeX;
        for (let i = 0; i < n; i++) { const gx = clamp(x + (i % 2 ? sw : -sw) * (r() < .5 || i ? 1 : -1) * .5, w / 2 + 14, LW - w / 2 - 14); put('gate', gx, wy + i * 150, { w }); block(gx, w / 2 - 8, wy + i * 150 - 26, wy + i * 150 + 26); G.rows.push(wy + i * 150, gx); x = gx; }
        G.safeX = G.lastX = x; G.lastWy = wy + (n - 1) * 150; G.nextRow = wy + n * 150; return;
      } else if (f < .86) flakeLine(G.safeX, wy, 8, 30, 34);
      else if (m > 500) { const ix = clamp(G.safeX + (r() - .5) * 120, 50, LW - 50); put('ice', ix, wy, { w: 86 + r() * 50, h: 46 }); }
    }
    // pickups
    if (--G.lantCd <= 0) { G.lantCd = 5 + Math.floor(r() * 4) - (z === 4 ? 2 : 0); put('lantern', clamp(G.safeX + (r() - .5) * 150, 18, LW - 18), wy + gap * .5); }
    const p = r();
    if (p < .025) put('shield', clamp(G.safeX + (r() - .5) * 200, 18, LW - 18), wy + gap * .4);
    else if (p < .045) put('magnet', clamp(G.safeX + (r() - .5) * 200, 18, LW - 18), wy + gap * .4);
    else if (p < .062) put('x2', clamp(G.safeX + (r() - .5) * 200, 18, LW - 18), wy + gap * .4);
    else if (p < .07 && m > 600) put('gem', clamp(G.safeX + (r() < .5 ? -1 : 1) * (lane + 40 + r() * 60), 18, LW - 18), wy + gap * .4);
    else if (p < .2) put('flake', clamp(G.safeX + (r() - .5) * 90, 14, LW - 14), wy + gap * .3);
    // obstacles: more of them the farther you get, never in the safe lane
    let n = 1 + (m > 350 && r() < .55 ? 1 : 0) + (m > 1400 && r() < .45 ? 1 : 0) + (m > 3400 && r() < .35 ? 1 : 0) + (m > 5000 && r() < .3 ? 1 : 0);
    if (m < 60) n = 0;
    const placed = [];
    for (let i = 0; i < n; i++) for (let tries = 0; tries < 6; tries++) {
      // obstacles sit on the stretch of slope just above this row, where the safe line's path is already known
      const x = 16 + r() * (LW - 32), y = Math.max(pwy + 20, wy - r() * gap * .7), lx = lerp(plx, G.safeX, clamp((y - pwy) / Math.max(1, wy - pwy), 0, 1));
      if (!clearAt(x, 21, y, lane, lx) || placed.some(q => Math.abs(q - x) < 34)) continue;
      const k = r();
      if (m > 450 && k < .09 + diff * .09) put('skier', x, y, { vx: (r() < .5 ? -1 : 1) * (.8 + r() + diff * .8) });
      else if (k < .34) put('rock', x, y); else if (k < .38) put('snowman', x, y); else put('tree', x, y);
      placed.push(x); break;
    }
    G.nextRow = wy + gap;
  }
  // Trick Park: nothing to hit. Kickers, rails, gates and flakes all the way down.
  function parkRow(wy, gap) {
    const r = G.rand, f = r(), x = G.safeX;
    if (f < .42) { put('ramp', x, wy, { w: 64 }); flakeLine(x, wy + 70, 4, 44); G.nextRow = wy + 330 + r() * 80; }
    else if (f < .72) { const len = 220 + r() * 200; put('rail', x, wy, { len }); flakeLine(x, wy + 14, Math.floor(len / 34), 34); G.nextRow = wy + len + 150; }
    else if (f < .9) { for (let i = 0; i < 3; i++) put('gate', clamp(x + (i % 2 ? 60 : -60), 70, LW - 70), wy + i * 150, { w: 100 }); G.nextRow = wy + 480; }
    else { flakeLine(x, wy, 8, 30, 40); put(r() < .5 ? 'x2' : 'lantern', x, wy + 270); G.nextRow = wy + 320; }
  }
  function fillCourse() {
    let guard = 0;
    while (G.nextRow < G.px + AHEAD && guard++ < 60) { const before = G.nextRow; spawnRow(G.nextRow); if (G.nextRow <= before) G.nextRow = before + 80; }
  }

  /* ---------- scoring and feedback ---------- */
  const mult = () => 1 + Math.min(G.combo, COMBO_MAX) * .1;
  function addScore(n) { const v = n * mult() * (G.x2T > 0 ? 2 : 1); G.score += v; return Math.round(v); }
  function float(x, y, text, c, big) { if (G.demo) return; if (G.floats.length > 14) G.floats.shift(); G.floats.push({ x: clamp(x, 60, LW - 60), y, text, c, life: big ? 75 : 52, big }); }
  function say(text, c = '#5cf2b0', life = 150) { if (!G.demo) G.toasts.push({ text, c, life }); }
  const snd = (...a) => { if (!G.demo) tone(...a); };
  function bump(n = 1) {
    if (G.demo) return;
    const before = G.combo; G.combo = Math.min(COMBO_MAX, G.combo + n); G.comboT = comboWin(up('combo'));
    if (G.combo > G.st.maxCombo) G.st.maxCombo = G.combo;
    if (G.combo >= 10 && Math.floor(G.combo / 10) > Math.floor(before / 10)) { float(G.x, PY - 60, `x${mult().toFixed(0)} MULTIPLIER`, '#ffd24a', true); G.punch = .8; snd(1320, .2, 'square', .03); }
  }
  function closeCall(x, y) {
    bump(); G.st.nearMiss++;
    const pts = addScore(15);
    float(x, y, `CLOSE +${pts}`, '#5cf2b0'); snd(820 + Math.min(G.combo, 24) * 36, .07, 'square', .022);
  }

  function fireFlare() {
    if (gstate !== 'run' || !G || G.demo || G.lant < 3 || G.flareT > 0) return;
    G.lant = 0; G.flareT = flareDur(up('flare')); G.flash = 1; G.shake = 8; G.punch = 1; G.st.flares++; flareBtn.hidden = true;
    burst(G.x, PY, 44, ['#ffb347', '#ffe0a8', '#ff7a3d'], 7, 45, 4);
    float(G.x, PY - 34, 'FLARE!', '#ffb347', true); buzz(25);
    tone(220, .5, 'sawtooth', .06, 600); tone(440, .4, 'square', .03, 400); noise(.4, .08, 900, 'bandpass');
  }
  function launch(dur) {
    G.air = G.airMax = dur * (1 + .1 * up('air')); G.spin = 0; G.grabT = 0; G.grabLate = 0;
    burst(G.x, PY + 6, 12, ['#e8eef7', '#b9c9de'], 3, 24, 2); snd(300, .32, 'triangle', .055, 520);
  }
  const GRABS = ['INDY', 'MUTE', 'MELON', 'STALEFISH'];
  function land() {
    const S = G.st, half = Math.PI, n = Math.round(Math.abs(G.spin) / half), err = Math.abs(Math.abs(G.spin) - n * half);
    const tol = landTol(up('soft')) + (G.park ? .15 : 0), airTicks = Math.round(G.airMax);
    burst(G.x, PY + 8, 16, ['#e8eef7', '#b9c9de'], 3.5, 26, 2);
    const dirTag = G.spin > 0 ? 'FS' : 'BS', grabbed = G.grabT >= 14, late = G.grabLate > 0;
    G.spin = 0; S.airs++; if (airTicks > S.maxAir) S.maxAir = airTicks;
    if (err > tol || late) {
      if (G.flareT > 0) { float(G.x, PY - 30, 'SAVED BY FLARE', '#ffb347'); return; }
      if (G.park) { G.combo = 0; G.inv = 50; G.shake = 6; float(G.x, PY - 30, late ? 'LATE GRAB' : 'BAIL', '#ff5577', true); snd(150, .25, 'sawtooth', .05, -60); buzz(30); return; }
      if (late && err <= tol) { G.combo = 0; float(G.x, PY - 30, 'LATE GRAB · NO POINTS', '#ff5577'); snd(180, .2, 'square', .04, -60); return; }
      if (G.shield) { useShield(); float(G.x, PY - 30, 'SKETCHY', '#8fd3ff'); return; }
      G.cause = 'landing'; return crash();
    }
    if (n === 0 && !grabbed) { const p = addScore(40); float(G.x, PY - 30, `AIR +${p}`, '#e8eef7'); return; }
    const perfect = err < .13 && n > 0;
    let base = 120 * n * (n + 1) / 2 + (grabbed ? 80 + G.grabT * 5 : 0);
    if (perfect) base *= 1.5;
    if (G.sw) base *= 1.2;
    const wasSwitch = G.sw; if (n % 2) G.sw = !G.sw;
    bump(Math.max(1, Math.ceil(n / 2)) + (grabbed ? 1 : 0));
    const pts = addScore(base);
    S.tricks++; if (n > S.maxSpin) S.maxSpin = n; if (grabbed) S.grabs++; if (perfect) S.perfects++; if (pts > S.bestTrick) S.bestTrick = pts;
    const name = [wasSwitch ? 'SWITCH' : '', n ? dirTag + ' ' + n * 180 : '', grabbed ? GRABS[(n + (dirTag === 'FS' ? 0 : 2)) % 4] : ''].filter(Boolean).join(' ');
    float(G.x, PY - 36, `${name} +${fmt(pts)}`, perfect ? '#ffd24a' : '#5cf2b0', true);
    if (perfect) float(G.x, PY - 58, 'PERFECT', '#ffd24a');
    G.shake = Math.max(G.shake, 3 + n); G.punch = Math.min(1.4, .4 + n * .22); buzz(15);
    const notes = [523, 659, 784, 1046, 1318, 1568];
    for (let i = 0; i < Math.min(notes.length, 2 + Math.ceil(n / 2)); i++) snd(notes[i], i ? .14 : .1, 'square', .035, 0, i * .07);
  }
  function endGrind() {
    const pts = Math.floor(G.grindPts), S = G.st;
    G.grind = null; S.rails++; if (pts > S.maxGrind) S.maxGrind = pts; bump();
    float(G.x, PY - 30, `GRIND +${fmt(pts)}`, '#e8eef7', true); G.punch = Math.max(G.punch, .4);
    launch(24 + G.speed * 2.6);
  }
  function useShield() {
    G.shield = false; G.inv = 70; G.st.saves++; G.shake = 10; G.flash = .5; buzz(30);
    burst(G.x, PY, 30, ['#8fd3ff', '#e8eef7'], 6, 40, 3); snd(900, .3, 'sine', .07, -600);
  }
  function pickup(o) {
    const S = G.st, k = o.k, sy = PY + o.wy - G.px;
    if (k === 'flake' || k === 'gem') {
      const v = k === 'gem' ? 10 : 1; S.flakes += v; addScore(k === 'gem' ? 60 : 5);
      burst(o.x, sy, k === 'gem' ? 16 : 4, k === 'gem' ? ['#b48cff', '#ffffff', '#7fe8ff'] : ['#dff3ff', '#8fd3ff'], 2.4, 18, 2);
      if (k === 'gem') { float(o.x, sy - 12, '+10 FLAKES', '#b48cff'); snd(1568, .1, 'triangle', .05); snd(2093, .2, 'triangle', .05, 0, .08); }
      else snd(1500 + (S.flakes % 7) * 105, .05, 'triangle', .028);
    } else if (k === 'lantern') {
      addScore(30); S.lanterns++; G.lant = Math.min(3, G.lant + 1);
      burst(o.x, sy, 16, ['#ffb347', '#ffe0a8'], 4, 30, 3);
      float(o.x, sy - 14, G.lant === 3 && G.flareT <= 0 ? 'FLARE READY' : 'LANTERN', '#ffb347'); snd(600 + G.lant * 200, .14, 'triangle', .055);
      if (G.lant === 3) snd(1320, .3, 'triangle', .045, 0, .1);
    } else if (k === 'shield') {
      if (G.shield) { G.spare = true; float(o.x, sy - 14, 'SPARE SHIELD', '#8fd3ff'); } else { G.shield = true; float(o.x, sy - 14, 'SHIELD', '#8fd3ff'); }
      burst(o.x, sy, 16, ['#8fd3ff', '#e8eef7'], 4, 30, 3); snd(520, .2, 'sine', .06, 400);
    } else if (k === 'magnet') {
      G.magT = magnetDur(up('magnet')); burst(o.x, sy, 16, ['#ff4466', '#e8eef7'], 4, 30, 3);
      float(o.x, sy - 14, 'MAGNET', '#ff6680'); snd(300, .25, 'square', .04, 300);
    } else if (k === 'x2') {
      G.x2T = 480; burst(o.x, sy, 16, ['#ffd24a', '#fff2b0'], 4, 30, 3);
      float(o.x, sy - 14, 'DOUBLE POINTS', '#ffd24a', true); snd(784, .1, 'triangle', .05); snd(1175, .2, 'triangle', .05, 0, .1);
    }
  }
  const CRASH_FX = {
    puff: (x, y) => burst(x, y, 60, ['#e8eef7', '#8fd3ff', '#ffb347'], 8, 60, 4),
    snow: (x, y) => { burst(x, y, 110, ['#ffffff', '#e8eef7', '#cfeeff'], 11, 75, 5); G.flash = 1; },
    confetti: (x, y) => burst(x, y, 90, ['#ff4466', '#ffd24a', '#5cf2b0', '#4aa3ff', '#b48cff', '#ff7a3d'], 9, 85, 4),
    shatter: (x, y) => { burst(x, y, 26, ['#8fd3ff', '#cfeeff', '#ffffff'], 12, 60, 8); burst(x, y, 40, ['#e8f4ff'], 5, 40, 2); },
    fireworks: (x, y) => { burst(x, y, 40, ['#ffb347', '#ffe0a8'], 7, 55, 3); G.pops = [[12, -40, -50, ['#ff4466', '#ffd2dc']], [24, 45, -70, ['#7fe8ff', '#e0f8ff']], [36, -10, -110, ['#ffd24a', '#fff2b0']]].map(([t, dx, dy, c]) => ({ t, x: x + dx, y: y + dy, c })); },
    ghost: (x, y) => { for (let i = 0; i < 40; i++) spark(x + (Math.random() - .5) * 20, y, (Math.random() - .5) * 1.5, -1 - Math.random() * 3, 80, i % 2 ? '#b48cff' : '#e8eef7', 3); },
    nova: (x, y) => { G.flash = 1; for (let i = 0; i < 90; i++) { const a = i / 90 * TAU; spark(x, y, Math.cos(a) * (4 + i % 3 * 3), Math.sin(a) * (4 + i % 3 * 3), 70, ['#ffffff', '#ffd24a', '#ff5cf0', '#7fe8ff'][i % 4], 3); } },
  };
  function crash() {
    if (G.demo) return;
    if (G.revive) {
      G.revive = false; G.air = 0; G.spin = 0; G.grind = null; G.inv = 150; G.flash = .7; G.shake = 10; G.punch = 1; G.cause = '';
      for (const o of G.obs) if (SOLID[o.k] && o.wy > G.px - 40 && o.wy < G.px + 320) o.hit = true;
      float(G.x, PY - 36, 'SECOND CHANCE', '#7fe8ff', true); chime([392, 784, 1175]); return;
    }
    gstate = 'crash'; G.crashT = 75; G.shake = 16; G.flash = Math.max(G.flash, .8); G.grind = null; buzz([40, 30, 60]);
    (CRASH_FX[R.eq.crash] || CRASH_FX.puff)(G.x, PY);
    noise(.5, .2); tone(160, .5, 'sawtooth', .08, -120);
    flareBtn.hidden = grabBtn.hidden = pauseBtn.hidden = true; musicStop();
  }

  /* ---------- one step of the world (1/60 s) ---------- */
  function step() {
    const S = G.st;
    G.t++;
    G.shake *= .9; if (G.shake < .2) G.shake = 0;
    G.flash = Math.max(0, G.flash - .04); G.punch = Math.max(0, G.punch - .05);
    const slow = gstate === 'crash' ? .5 : 1, scroll = gstate === 'run' ? G.speed * .5 : 0;
    for (let i = pn - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * slow; p.y += p.vy * slow - scroll; p.vx *= .96; p.vy *= .96; if ((p.life -= slow) <= 0) { parts[i] = parts[--pn]; parts[pn] = p; } }
    for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.y -= 1.1; if (--f.life <= 0) G.floats.splice(i, 1); }
    if (G.toasts.length && --G.toasts[0].life <= 0) G.toasts.shift();
    if (G.pops) { for (const p of G.pops) if (--p.t === 0) { burst(p.x, p.y, 34, p.c, 6, 55, 3); tone(500 + Math.random() * 500, .15, 'triangle', .04); } }
    if (gstate === 'crash') { if (--G.crashT <= 0) finishRun(); return; }

    const boosting = G.flareT > 0;
    if (G.flareT > 0) G.flareT--; if (G.inv > 0) G.inv--; if (G.magT > 0) G.magT--; if (G.x2T > 0) G.x2T--;
    if (!G.shield && G.spare && G.inv <= 0) { G.shield = true; G.spare = false; float(G.x, PY - 30, 'SPARE SHIELD ON', '#8fd3ff'); }
    const m = G.px / 10;
    G.speed = (G.park ? 7.2 : baseSpeed(m)) * (boosting ? 1.5 : 1);
    if (G.combo > 0 && --G.comboT <= 0) { if (G.combo >= 8) float(G.x, PY - 50, 'COMBO LOST', '#7b8ca6'); G.combo = 0; }

    // steering
    let dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0) || touchDir;
    if (G.demo) dir = clamp((lineAt(G.px + 30 + G.speed * 5) - G.x) / 30, -1, 1);
    const inAir = G.air > 0;
    if (G.grind) {
      G.x += (G.grind.x - G.x) * .4; G.vx = 0;
      const g = .7 * G.speed * (1 + .3 * up('grind')) * (1 + Math.min(2, G.grindPts / 600)); G.grindPts += addScore(g) || 0;
      if (Math.random() < .8) spark(G.x + (Math.random() - .5) * 8, PY + 8, (Math.random() - .5) * 3, -Math.random() * 2.5, 18, Math.random() < .5 ? '#ffd24a' : '#ffffff', 2);
      if (G.t % 9 === 0) snd(900 + Math.random() * 300, .04, 'sawtooth', .012);
      if (G.grind.wy + G.grind.len < G.px - 2) endGrind();
    } else if (inAir) {
      G.spin += dir * .2;
      if (!dir) { const k = Math.round(G.spin / Math.PI) * Math.PI; G.spin += (k - G.spin) * .07; } // let go and the board straightens to the nearest clean angle
      const grabbing = (keys.grab || touchGrab) && !G.demo;
      if (grabbing) { G.grabT++; if (G.air <= 8) G.grabLate = 1; } else if (G.air > 8) G.grabLate = 0;
      G.vx *= .99;
      if (--G.air <= 0) { G.air = 0; land(); if (gstate !== 'run') return; }
    } else {
      const slip = G.onIce > 0;
      G.vx += dir * (slip ? .34 : .95); G.vx *= slip ? .965 : .86;
    }
    if (G.onIce > 0) G.onIce--;
    G.x += G.vx;
    if (G.x < 10 || G.x > LW - 10) { G.x = clamp(G.x, 10, LW - 10); G.vx *= -.4; }
    G.lean += (G.vx * .07 - G.lean) * .3;
    const grounded = G.air <= 0 && !G.grind;

    // effects that follow the rider
    if (!reduceMotion) {
      if (grounded && Math.abs(G.vx) > 3 && Math.random() < .6) spark(G.x - Math.sign(G.vx) * 10, PY + 8, -G.vx * .3 + Math.random() - .5, Math.random() * 1.5, 22, '#e8eef7', 2);
      if (boosting && Math.random() < .8) spark(G.x + (Math.random() - .5) * 10, PY - 4, (Math.random() - .5) * 1.5, -Math.random() * 2, 26, Math.random() < .5 ? '#ffb347' : '#ff7a3d', 3);
      const tr = cosItem('trail', R.eq.trail), sk = cosItem('skin', R.eq.skin);
      if (grounded && save.settings.fx !== 'low') {
        if (tr.spark && Math.random() < .45) spark(G.x + (Math.random() - .5) * 10, PY + 8, (Math.random() - .5) * .6, Math.random() * .6, 30, tr.spark, 1.6);
        if (tr.fire && Math.random() < .6) spark(G.x + (Math.random() - .5) * 8, PY + 9, (Math.random() - .5) * .8, -.4 - Math.random(), 20, Math.random() < .5 ? '#ff4b2b' : '#ffb347', 2.5);
      }
      if (sk.aura === 'flames' && Math.random() < .7) spark(G.x + (Math.random() - .5) * 8, PY - 10, (Math.random() - .5) * .8, -1 - Math.random() * 1.5, 18, Math.random() < .5 ? '#ff4b2b' : '#ffb347', 2.5);
      if (sk.aura === 'stars' && Math.random() < .35) spark(G.x + (Math.random() - .5) * 26, PY - 6 + (Math.random() - .5) * 26, 0, -.3, 34, Math.random() < .5 ? '#b48cff' : '#ffffff', 1.4);
    }
    const T = G.trail; T.push(G.x, G.px, grounded ? 1 : 0); if (T.length > 240) T.splice(0, 3);

    // move down the hill in small enough slices that nothing can be skipped over
    const slices = Math.ceil(G.speed / 6), ds = G.speed / slices;
    for (let i = 0; i < slices; i++) { G.px += ds; collide(grounded); if (gstate !== 'run') return; }
    const meters = G.px / 10;
    addScore(G.speed * .1);
    S.meters = Math.floor(meters - G.m0); S.score = Math.floor(G.score);
    if (G.mode === 'daily') S.daily = S.score; if (G.park) S.park = S.score;

    for (const o of G.obs) if (o.k === 'skier' && !o.hit) { o.x += o.vx; if (o.x < 14 || o.x > LW - 14) o.vx *= -1; }
    fillCourse();
    if (G.t % 30 === 0) {
      const lim = G.px - PY - 400; let w = 0;
      for (const o of G.obs) if (!(o.hit && o.k !== 'ramp') && o.wy + (o.len || 0) > lim) G.obs[w++] = o;
      G.obs.length = w;
      while (G.blocks.length && G.blocks[0].y1 < G.px - 200) G.blocks.shift();
      while (G.rows.length > 2 && G.rows[0] < G.px - 200) G.rows.splice(0, 2);
    }

    if (G.park) { if (--G.parkT <= 0 && grounded) { G.cause = 'time'; gstate = 'crash'; G.crashT = 40; musicStop(); pauseBtn.hidden = flareBtn.hidden = grabBtn.hidden = true; chime([784, 988, 1318]); return; } }
    else {
      const z = zoneAt(meters);
      if (z !== G.zone) {
        G.zone = z; S.zone = z; G.banner = 150; snd(392, .15, 'triangle', .06); snd(587, .25, 'triangle', .06, 0, .12);
        if (z === 4) say('LIGHTS OUT · FOLLOW THE LANTERNS', '#ffb347', 190);
        if (z === 5) say('CREVASSES · JUMP THEM OR GO AROUND', '#cdb4ff', 190);
        if (z === 6) say('AURORA PEAK · NOBODY COMES BACK FROM HERE', '#5cf2b0', 200);
      }
    }
    if (G.banner > 0) G.banner--;
    if (!G.demo) {
      music.intensity = G.park ? 3 : Math.min(5, G.zone); music.tense = G.zone === 4;
      // ghost of your best run
      if (G.t % 4 === 0 && G.rec.length < 40000) G.rec.push(Math.round(G.x / LW * 1000), Math.round(G.px));
      const gh = G.ghost;
      if (gh) {
        const n = gh.r.length / 2, f = G.t / 4, i = Math.floor(f);
        if (i < n - 1) { const k = f - i; G.gx = lerp(gh.r[i * 2], gh.r[i * 2 + 2], k) / 1000 * LW; G.gd = lerp(gh.r[i * 2 + 1], gh.r[i * 2 + 3], k); }
        else { G.gDone = true; G.gx = gh.r[n * 2 - 2] / 1000 * LW; G.gd = gh.r[n * 2 - 1]; }
        if (G.gDone && !G.gPassed && G.px > G.gd) { G.gPassed = true; say(G.gName ? `YOU PASSED ${G.gName.toUpperCase()}'S GHOST` : 'YOU PASSED YOUR BEST RUN', '#b48cff'); chime([660, 880, 1320]); }
      }
      if (G.t % 20 === 0) liveChecks();
      const showFlare = G.lant >= 3 && G.flareT <= 0 && usedTouch; if (flareBtn.hidden === showFlare) flareBtn.hidden = !showFlare;
      const showGrab = G.air > 0 && usedTouch; if (grabBtn.hidden === showGrab) grabBtn.hidden = !showGrab;
      if (!R.tut) tutorial(meters);
    }
  }
  function tutorial(m) {
    const H0 = [[6, usedTouch ? 'SLIDE YOUR FINGER TO STEER' : `STEER WITH ${keyFor('left')} AND ${keyFor('right')}`], [70, 'SKIM PAST TREES TO BUILD A COMBO'], [170, 'IN THE AIR: STEER TO SPIN · LET GO TO LAND'], [300, '3 LANTERNS = A FLARE THAT SMASHES EVERYTHING'], [430, usedTouch ? 'HOLD GRAB IN THE AIR FOR BONUS POINTS' : `HOLD ${keyFor('grab')} IN THE AIR TO GRAB`]];
    if (G.hint < H0.length && m >= H0[G.hint][0]) { say(H0[G.hint][1], '#8fd3ff', 210); if (++G.hint === H0.length) R.tut = true; }
  }
  // Achievements and missions are checked three times a second, not every frame.
  function liveChecks() {
    const a = checkAch(G.st), ms = missionTick(G.st, false);
    for (const x of a) { G.newAch.push(x); G.toasts.push({ ach: x, life: 110, max: 110 }); chime(x.tier === 'b' ? [523, 659, 784] : [587, 740, 880, 1175], 'triangle', .055); if (x.tier === 'p' || x.tier === 'm') G.flash = Math.max(G.flash, .5); }
    for (const x of ms) { G.newMis.push(x); say(`MISSION DONE · +${x.pay} FLAKES`, '#5cf2b0', 170); chime([784, 1175, 1568]); }
    if (a.length || ms.length) saveLocal();
  }

  function collide(grounded) {
    const S = G.st, px = G.px, magR = G.flareT > 0 ? 170 : G.magT > 0 ? 150 : up('magnet') ? 22 + up('magnet') * 14 : 0;
    for (const o of G.obs) {
      if (o.hit) continue;
      const dy = o.wy - px;
      if (dy > 190) continue; if (dy < -420) continue;
      const k = o.k, dx = o.x - G.x;
      if (k === 'flake' || k === 'gem' || k === 'lantern' || k === 'shield' || k === 'magnet' || k === 'x2') {
        if (magR && (k === 'flake' || k === 'gem' || (k === 'lantern' && magR > 100))) { const d = Math.hypot(dx, dy); if (d < magR && d > 1) { const pull = Math.min(d, 2.4 + G.speed * .5); o.x -= dx / d * pull; o.wy -= dy / d * pull; } }
        if (dx * dx + dy * dy < 24 * 24) { o.hit = true; pickup(o); }
        continue;
      }
      if (dy < -60 && o.passed) continue;
      if (G.demo && (k === 'ramp' || k === 'rail')) continue;
      if (k === 'ramp') { if (grounded && G.air <= 0 && Math.abs(dx) < o.w / 2 && Math.abs(dy) < 10) { o.hit = true; launch(44 + G.speed * 5); grounded = false; } continue; }
      if (k === 'rail') {
        if (grounded && !G.grind && Math.abs(dx) < 13 && px > o.wy && px < o.wy + o.len - 10) { G.grind = o; G.grindPts = 0; G.vx = 0; grounded = false; snd(180, .25, 'sawtooth', .04, 80); float(G.x, PY - 24, 'GRIND', '#e8eef7'); }
        continue;
      }
      if (k === 'gate') {
        if (!o.passed && dy < 0) {
          o.passed = true;
          if (Math.abs(dx) < o.w / 2) { G.chain++; S.gates++; if (G.chain > S.gateMax) S.gateMax = G.chain; bump(); const p = addScore(40 + 10 * Math.min(G.chain, 12)); float(o.x, PY - 14, G.chain > 1 ? `GATE x${G.chain} +${p}` : `GATE +${p}`, '#4aa3ff'); snd(700 + Math.min(G.chain, 12) * 50, .1, 'triangle', .05); }
          else if (G.chain > 0) { G.chain = 0; float(o.x, PY - 14, 'MISSED GATE', '#7b8ca6'); }
        }
        continue;
      }
      if (k === 'ice') { if (grounded && Math.abs(dx) < o.w / 2 && Math.abs(dy) < o.h / 2) { if (!G.onIce) snd(1800, .12, 'sine', .02, -600); G.onIce = 6; } continue; }
      if (k === 'crev') {
        const ax = Math.abs(dx), over = ax < o.w / 2 - 6 && Math.abs(dy) < o.h / 2 + 2;
        if (over && grounded && G.inv <= 0) {
          if (G.flareT > 0) { if (!o.bridged) { o.bridged = true; float(G.x, PY - 30, 'FLARE BRIDGE', '#ffb347'); } }
          else if (G.shield) { useShield(); o.saved = true; float(G.x, PY - 30, 'CAUGHT THE EDGE', '#8fd3ff'); }
          else { G.cause = 'crev'; return crash(); }
        }
        if (!o.passed && dy < -o.h / 2) {
          o.passed = true;
          if (G.air > 0 && ax < o.w / 2 && !o.saved) { S.leaps++; bump(2); const p = addScore(150); float(o.x, PY - 12, `LEAP +${p}`, '#cdb4ff', true); snd(988, .1, 'triangle', .05); snd(1480, .2, 'triangle', .05, 0, .08); }
          else if (grounded && ax >= o.w / 2 - 6 && ax - o.w / 2 < 18) closeCall(G.x, PY - 12);
        }
        continue;
      }
      // solid: tree, rock, snowman, skier
      if (!grounded) { if (!o.passed && dy < 0) o.passed = true; continue; }
      const rad = o.s * .5 + 6, ddy = dy - (k === 'tree' ? o.s * .2 : 0), d2 = dx * dx + ddy * ddy;
      if (d2 < rad * rad && G.inv <= 0 && !G.demo) {
        if (G.flareT > 0 || G.shield) {
          o.hit = true; G.shake = Math.max(G.shake, 5); G.freeze = 3; G.punch = Math.max(G.punch, .5);
          if (G.flareT > 0) { S.smashes++; bump(); const p = addScore(k === 'snowman' ? 90 : 40); float(o.x, PY - 14, `SMASH +${p}`, '#ff7a3d'); } else useShield();
          burst(o.x, PY + dy, 22, k === 'tree' ? ['#2f6b55', '#e8eef7', '#3a2a1e'] : k === 'skier' ? ['#ff4466', '#e8eef7'] : k === 'snowman' ? ['#ffffff', '#ff7a3d', '#1a1f2b'] : ['#56657c', '#e8eef7'], 6, 35, 3);
          if (!G.demo) noise(.15, .1);
        } else { G.cause = k; return crash(); }
      } else if (!o.passed && dy < 0) { o.passed = true; if (Math.abs(dx) - rad < 17 && G.inv <= 0) closeCall(o.x, PY - 10); }
    }
  }

  /* ---------- starting, pausing and finishing ---------- */
  function startRun(mode) {
    if (mode === 'daily' || mode === 'free' || mode === 'park') R.mode = mode; else mode = R.mode;
    initAudio(); resize(); newGame(mode);
    gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; flareBtn.hidden = grabBtn.hidden = true; $('top').hidden = true; resize();
    G.banner = G.park ? 0 : 130;
    if (G.park) say('TRICK PARK · 75 SECONDS · NOTHING TO HIT', '#ffd24a', 170);
    else if (mode === 'daily' && !G.gName) say(`DAILY COURSE · ${dayLabel.toUpperCase()}`, '#b48cff', 140);
    if (G.gName) say(`RACING ${G.gName.toUpperCase()}'S GHOST · BEAT ${fmt(G.ghost.s)}`, '#7fe8ff', 180);
    chime([523, 784]); music.intensity = 0; music.tense = false; musicStart(); acc = 0; lastFrame = performance.now();
  }
  function pauseRun() {
    if (gstate !== 'run') return;
    gstate = 'paused'; musicStop(); pauseBtn.hidden = flareBtn.hidden = grabBtn.hidden = true; keys.l = keys.r = keys.grab = false; touchDir = 0; stick = null; touchGrab = false;
    show('run-pause');
  }
  function resumeRun() { if (gstate !== 'paused') return; initAudio(); gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; musicStart(); acc = 0; lastFrame = performance.now(); }
  // What a run reports when it ends: where, how and in what state. See the online file for where it goes.
  function runData(end) {
    const S = G.st;
    return { end, mode: G.mode, m: Math.floor(G.px / 10), s: Math.floor(G.score), z: G.zone, t: Math.round(G.t / 6) / 10, x: Math.round(G.x / LW * 1000), n: R.life.runs, sp: Math.round(G.speed * 10) / 10,
      air: G.air > 0, grind: !!G.grind, ice: G.onIce > 0, flare: G.flareT > 0, shield: !!G.shield, combo: S.maxCombo, live: G.combo, tricks: S.tricks, spin: S.maxSpin, rails: S.rails, gates: S.gates, near: S.nearMiss,
      smashes: S.smashes, saves: S.saves, flakes: S.flakes, lanterns: S.lanterns, boosts: G.used.join(',') || null, lv: level(), up: UPG.reduce((n, u) => n + up(u.id), 0), ach: achCount() };
  }
  function refundBoosts() { if (G && G.used.length && G.px / 10 - G.m0 < 100) { for (const id of G.used) R.kit[id] = true; G.used = []; saveLocal(); } }
  function restartRun() { if (gstate !== 'run' && gstate !== 'paused') return; if (G.px / 10 - G.m0 > 30) logRun(runData('restart')); refundBoosts(); musicStop(true); startRun(G.mode); }
  function leaveRun() {
    if (gstate === 'run' || gstate === 'paused') { if (G.px / 10 - G.m0 > 30) logRun(runData('quit')); refundBoosts(); }
    pendingGhost = null; musicStop(); gstate = 'idle'; $('top').hidden = false; pauseBtn.hidden = flareBtn.hidden = grabBtn.hidden = true; resize(); newGame('free', true);
  }
  function finishRun() {
    const S = G.st, s = Math.floor(G.score), mode = G.mode, L = R.life, m = S.meters;
    logRun(runData(G.cause || 'crash'));
    S.score = s; if (mode === 'daily') S.daily = s; if (G.park) S.park = s;
    const isBest = G.park ? s > R.bestPark : s > R.best;
    if (G.park) R.bestPark = Math.max(R.bestPark, s); else R.best = Math.max(R.best, s);
    for (const k of RUN_STATS) if (S[k] > R.bs[k]) R.bs[k] = Math.floor(S[k]);
    L.runs++; L.meters += m; L.score += s; L.flakes += S.flakes; L.tricks += S.tricks; L.rails += S.rails; L.gates += S.gates; L.nearMiss += S.nearMiss; L.smashes += S.smashes;
    L.airs += S.airs; L.lanterns += S.lanterns; L.flares += S.flares; L.leaps += S.leaps; L.secs += Math.round(G.t / 60); L.grabs += S.grabs; L.perfects += S.perfects; L.crashes++;
    if (S.zone >= 4) L.bc++; if (G.gPassed && !G.gName) L.ghosts++;
    if (mode === 'daily' && R.dlast !== dayKey) { R.dstreak = R.dlast === prevDay(dayKey) ? R.dstreak + 1 : 1; R.dlast = dayKey; L.dailyDays++; }
    for (const x of missionTick(S, true)) G.newMis.push(x);
    for (const x of checkAch(S)) G.newAch.push(x);
    const flakes = earn(Math.round((S.flakes + s / 400) * (1 + .1 * up('lucky')) * eventMult('flakes')));
    const xp = Math.round((m / 8 + s / 60) * eventMult('xp')), lv = addXP(xp);
    for (const x of checkAch(S)) G.newAch.push(x); // level and collection achievements can follow from the payout
    if (!G.park) { R.top.push({ s, d: Math.floor(G.px / 10), z: G.zone, m: mode }); R.top.sort((a, b) => b.s - a.s); R.top = R.top.slice(0, 8); }
    let newGhost = false;
    if (!G.park && !G.m0 && G.rec.length >= 16) {
      const old = loadGhost(mode);
      if (!old || s > old.s) { try { localStorage.setItem(ghostKey(mode), JSON.stringify({ s, day: dayKey, r: G.rec })); newGhost = true; } catch (e) {} if (typeof uploadGhost === 'function') uploadGhost(mode, s, G.rec); }
    }
    const title = G.park ? (isBest ? 'New park record!' : 'Session over') : isBest ? 'New best!' : ({ landing: 'Bailed the landing', skier: 'Took out a skier', crev: 'Into the crevasse', snowman: 'Hugged a snowman', rock: 'Found a rock', tree: 'Tree: 1, you: 0' })[G.cause] || 'Wipeout';
    lastRun = { s, isBest, title, mode, d: Math.floor(G.px / 10), z: G.zone, st: S, flakes, xp, lv, ach: G.newAch.slice(), mis: G.newMis.slice(), newGhost, secs: Math.round(G.t / 6) / 10, gained: coins() - G.flk0, post: '', vs: G.gName ? { name: G.gName, s: G.ghost.s, beat: s > G.ghost.s } : null };
    pendingGhost = null;
    fixEquipped(); persist();
    if (typeof submitScore === 'function') submitScore(lastRun);
    gstate = 'over'; $('top').hidden = false; resize();
    if (lv.levels) sfx.level(); else if (isBest) sfx.win();
    show('run-over');
  }
  // Double and triple events are set from the server (see the online file); offline they are always 1.
  function eventMult(kind) { return typeof serverEvent === 'function' ? serverEvent(kind) : 1; }

  /* ---------- input ---------- */
  const codeOf = e => e.code || (e.key === ' ' ? 'Space' : e.key || '');
  addEventListener('keydown', e => {
    const c = codeOf(e);
    if (capturing) {
      e.preventDefault();
      if (c && c !== 'Escape') { for (const [a] of KEY_ACTIONS) save.settings.keys[a] = save.settings.keys[a].map(k => k === c ? '' : k); save.settings.keys[capturing.a][capturing.i] = c; persist(); sfx.equip(); }
      capturing = null; render(); return;
    }
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (bound('left', c)) { keys.l = true; usedTouch = false; } if (bound('right', c)) { keys.r = true; usedTouch = false; } if (bound('grab', c)) keys.grab = true;
    if (gstate === 'run') {
      if (KEY_ACTIONS.some(([a]) => bound(a, c))) e.preventDefault();
      if (bound('flare', c)) fireFlare();
      if (bound('pause', c)) pauseRun(); else if (bound('restart', c) && !e.repeat) restartRun();
      return;
    }
    const onButton = e.target && /^(BUTTON|SUMMARY|A)$/.test(e.target.tagName || '');
    if (gstate === 'paused' && view === 'run-pause') { if (bound('pause', c)) { e.preventDefault(); resumeRun(); } else if (bound('restart', c)) { e.preventDefault(); restartRun(); } else if (c === 'Enter' && !onButton) resumeRun(); return; }
    if ((view === 'run-over' || view === 'run-home') && !onButton && (c === 'Enter' || (bound('restart', c) && !e.repeat))) { e.preventDefault(); if (nameReady()) startRun(); }
  });
  addEventListener('keyup', e => { const c = codeOf(e); if (bound('left', c)) keys.l = false; if (bound('right', c)) keys.r = false; if (bound('grab', c)) keys.grab = false; });
  addEventListener('blur', () => { keys.l = keys.r = keys.grab = false; touchDir = 0; stick = null; touchGrab = false; });
  // Touch steering. "Drag": put a finger down anywhere and slide; how far you slide is how hard you turn, and the
  // center follows your finger so you never have to cross back. "Sides": hold the left or right half of the screen.
  const STICK_R = 36;
  const localX = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width || W }; };
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') usedTouch = true;
    initAudio(); const p = localX(e);
    if (save.settings.steer === 'sides') { touchDir = p.x < p.w / 2 ? -1 : 1; stick = { id: e.pointerId, sides: true }; }
    else { stick = { id: e.pointerId, ox: p.x, x: p.x, y: p.y }; touchDir = 0; }
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
  flareBtn.addEventListener('pointerdown', e => { e.preventDefault(); fireFlare(); });
  grabBtn.addEventListener('pointerdown', e => { e.preventDefault(); touchGrab = true; });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) grabBtn.addEventListener(t, () => { touchGrab = false; });
  pauseBtn.addEventListener('click', pauseRun);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseRun(); saveLocal(); } });

  /* ---------- frame loop ---------- */
  let acc = 0, lastFrame = 0, frameNo = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || !G) { lastFrame = now; return; }
    const dtMs = Math.min(100, now - lastFrame); lastFrame = now; frameNo++;
    if (gstate === 'run' || gstate === 'crash') {
      acc += dtMs;
      let n = 0;
      while (acc >= 1000 / 60 && n++ < 5) { acc -= 1000 / 60; if (G.freeze > 0) G.freeze--; else step(); if (gstate !== 'run' && gstate !== 'crash') break; }
      if (n >= 5) acc = 0;
      if (gstate === 'run' || gstate === 'crash') drawRun(now);
    } else if (gstate === 'idle') {
      // behind the menus: a quiet demo run at half the frame rate
      if (frameNo % 2 || reduceMotion && frameNo > 2) return;
      step(); drawRun(now);
    }
  }
