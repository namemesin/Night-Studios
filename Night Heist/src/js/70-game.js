  /* ================= NIGHT HEIST: the game ================= */
  // A floor is a 10 x 13 grid of tiles, generated from a seeded generator (so the Daily Job is the same building for
  // everyone) and checked to make sure the vault and the exit can be reached. Logic runs at a fixed 60 steps a second.
  const LW = 400, COLS = 10, ROWS = 13, PAR = 40;
  let SC = 1, LH = 600, T = 40, OX = 0, OY = 56;
  resizeHooks.push(() => { SC = W / LW; LH = H / SC; T = Math.max(22, Math.min(40, Math.floor((LH - 70) / ROWS))); OX = Math.round((LW - COLS * T) / 2); OY = Math.max(54, Math.round((LH - ROWS * T) / 2 + 8)); });
  let G = null;
  const keysDown = { up: false, down: false, left: false, right: false };
  let stick = null, moveX = 0, moveY = 0;
  const PMAX = 240, parts = Array.from({ length: PMAX }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, c: '#fff', s: 2 }));
  let pn = 0;
  function burst(x, y, n, colors, spd = 2.5, life = 28, size = 3) { if (reduceMotion || save.settings.fx === 'low') n = Math.ceil(n / 3); for (let i = 0; i < n && pn < PMAX; i++) { const a = Math.random() * TAU, v = Math.random() * spd, p = parts[pn++]; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.life = p.max = life * (.6 + Math.random() * .4); p.c = colors[i % colors.length]; p.s = Math.random() * size + 1; } }

  /* ---------- building a floor (all positions are in tiles; 0.5 is the middle of a tile) ---------- */
  const wallAt = (L, c, r) => c < 0 || r < 0 || c >= COLS || r >= ROWS || L.w[r * COLS + c] === 1;
  function flood(L, sc, sr) { // steps from a tile to every tile it can reach
    const d = new Int16Array(COLS * ROWS).fill(-1), q = [sc + sr * COLS]; d[q[0]] = 0;
    for (let i = 0; i < q.length; i++) { const p = q[i], c = p % COLS, r = (p - c) / COLS; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = c + dc + (r + dr) * COLS; if (!wallAt(L, c + dc, r + dr) && d[n] < 0) { d[n] = d[p] + 1; q.push(n); } } }
    return d;
  }
  function pathTo(L, from, to) { // tile centers from one tile to another
    const d = flood(L, to % COLS, Math.floor(to / COLS)); if (d[from] < 0) return null;
    const out = []; let p = from;
    while (p !== to) { const c = p % COLS, r = (p - c) / COLS; let best = p; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = c + dc + (r + dr) * COLS; if (!wallAt(L, c + dc, r + dr) && d[n] >= 0 && d[n] < d[best]) best = n; } if (best === p) return null; p = best; out.push([p % COLS + .5, Math.floor(p / COLS) + .5]); }
    return out;
  }
  function makeFloor(n, rand) {
    for (let tries = 0; tries < 40; tries++) {
      const L = { w: new Uint8Array(COLS * ROWS), loot: [], guards: [], lights: [], start: [COLS / 2, ROWS - 1.5], exit: [4 + Math.floor(rand() * 2), 1] };
      for (let c = 0; c < COLS; c++) { L.w[c] = L.w[(ROWS - 1) * COLS + c] = 1; } for (let r = 0; r < ROWS; r++) { L.w[r * COLS] = L.w[r * COLS + COLS - 1] = 1; }
      const sc = Math.floor(L.start[0]), sr = Math.floor(L.start[1]);
      for (let i = 0, k = 9 + Math.min(7, n); i < k; i++) { // wall runs, kept away from the start and the exit
        const horiz = rand() < .5, len = 2 + Math.floor(rand() * 3), c0 = 1 + Math.floor(rand() * (COLS - 2)), r0 = 2 + Math.floor(rand() * (ROWS - 5));
        for (let j = 0; j < len; j++) { const c = c0 + (horiz ? j : 0), r = r0 + (horiz ? 0 : j); if (c < 1 || c > COLS - 2 || r < 2 || r > ROWS - 3) continue; if (Math.abs(c - sc) < 2 && r > ROWS - 4) continue; if (Math.abs(c - L.exit[0]) < 2 && r < 3) continue; L.w[r * COLS + c] = 1; }
      }
      const d = flood(L, sc, sr), open = [];
      for (let p = 0; p < COLS * ROWS; p++) if (d[p] > 0) open.push(p);
      if (d[L.exit[0] + L.exit[1] * COLS] < 0 || open.length < 60) continue;
      const pick = (minD, avoid) => { for (let t = 0; t < 60; t++) { const p = open[Math.floor(rand() * open.length)]; if (d[p] >= minD && !avoid.includes(p)) return p; } return -1; };
      const used = [L.exit[0] + L.exit[1] * COLS];
      const vault = pick(9, used); if (vault < 0) continue; used.push(vault); L.loot.push({ k: 'vault', x: vault % COLS + .5, y: Math.floor(vault / COLS) + .5 });
      for (let i = 0, k = Math.min(7, 3 + Math.floor(n / 2)); i < k; i++) { const p = pick(3, used); if (p >= 0) { used.push(p); L.loot.push({ k: rand() < .3 ? 'gem' : 'coin', x: p % COLS + .5, y: Math.floor(p / COLS) + .5 }); } }
      if (rand() < .3) { const p = pick(5, used); if (p >= 0) { used.push(p); L.loot.push({ k: 'smoke', x: p % COLS + .5, y: Math.floor(p / COLS) + .5 }); } }
      let ok = true;
      for (let i = 0, k = Math.min(5, 1 + Math.floor(n * .6)), att = 0; i < k && ok && att < 40; i++, att++) { // guards walk a loop between two or three far-apart spots
        const a = pick(6, []), pts = [a]; if (a < 0) { ok = false; break; }
        const da = flood(L, a % COLS, Math.floor(a / COLS));
        for (let j = 0; j < 2; j++) { let b = -1; for (let t = 0; t < 40 && b < 0; t++) { const p = open[Math.floor(rand() * open.length)]; if (da[p] >= 4 && d[p] >= 5 && !pts.includes(p)) b = p; } if (b >= 0) pts.push(b); }
        if (pts.length < 2) { ok = false; break; }
        let route = []; for (let j = 0; j < pts.length; j++) { const seg = pathTo(L, pts[j], pts[(j + 1) % pts.length]); if (!seg) { ok = false; break; } route = route.concat(seg); }
        if (ok && route.some(p => Math.hypot(p[0] - L.start[0], p[1] - L.start[1]) < 2.8)) { i--; continue; } // nobody patrols right past where you come in
        if (ok && route.length > 3) L.guards.push({ x: a % COLS + .5, y: Math.floor(a / COLS) + .5, route, i: 0, ang: rand() * TAU, wait: 0, sees: false, spd: .021 + Math.min(.014, n * .0012) });
      }
      if (!ok || !L.guards.length) continue;
      for (let i = 0, k = Math.min(3, Math.floor((n - 1) / 2)); i < k; i++) { // searchlights sweep a straight open stretch
        for (let t = 0; t < 30; t++) { const r = 2 + Math.floor(rand() * (ROWS - 5)), c0 = 1 + Math.floor(rand() * 4); let c1 = c0; while (c1 < COLS - 2 && !wallAt(L, c1 + 1, r)) c1++; if (!wallAt(L, c0, r) && c1 - c0 >= 3 && d[c0 + r * COLS] >= 4) { L.lights.push({ x0: c0 + .5, x1: c1 + .5, y: r + .5, t: rand() * TAU, spd: .012 + rand() * .008, x: c0 + .5 }); break; } }
      }
      return L;
    }
    // could not make a good floor: an empty room with one guard is always possible
    const L = { w: new Uint8Array(COLS * ROWS), loot: [{ k: 'vault', x: 5.5, y: 4.5 }], guards: [], lights: [], start: [COLS / 2, ROWS - 1.5], exit: [4, 1] };
    for (let c = 0; c < COLS; c++) { L.w[c] = L.w[(ROWS - 1) * COLS + c] = 1; } for (let r = 0; r < ROWS; r++) { L.w[r * COLS] = L.w[r * COLS + COLS - 1] = 1; }
    L.guards.push({ x: 2.5, y: 6.5, route: [[7.5, 6.5], [2.5, 6.5]], i: 0, ang: 0, wait: 0, sees: false, spd: .022 }); return L;
  }
  // Can a point be seen from another, with walls in the way?
  function clear(L, x0, y0, x1, y1) { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / .2); for (let i = 1; i < n; i++) { const t = i / n; if (wallAt(L, Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false; } return true; }
  const VR = 3.3, VA = .56; // how far and how wide a guard sees

  function newGame(mode, demo) {
    rollDay();
    G = { mode, demo: !!demo, rand: mode === 'daily' ? seeded('nightheist-' + dayKey) : Math.random, t: 0, score: 0, floor: 0, smoke: 1 + up('smoke'), smokeT: 0, alarm: 0, st: blankStats(), floats: [], toasts: [], flash: 0, shake: 0, by: '', seenThis: false, newAch: [], newMis: [], hint: 0 };
    pn = 0; nextFloor(); return G;
  }
  function nextFloor() {
    G.floor++; G.L = makeFloor(G.floor, G.rand); G.x = G.L.start[0]; G.y = G.L.start[1]; G.alarm = 0; G.seenThis = false; G.ft = 0; G.open = false; G.banner = 110; G.grace = 120; // two seconds to look around before anyone can spot you
  }
  const float = (x, y, text, c) => { if (!G.demo) { if (G.floats.length > 10) G.floats.shift(); G.floats.push({ x, y, text, c, life: 55 }); } };
  const say = (text, c = '#5cf2b0', life = 170) => { if (!G.demo) G.toasts.push({ text, c, life }); };
  const lootMul = () => (1 + .1 * up('fence')) * (1 + .15 * (G.floor - 1));
  function useSmoke() {
    if (gstate !== 'run' || !G || G.demo || G.smoke < 1 || G.smokeT > 0) return;
    G.smoke--; G.smokeT = 150; G.st.smokes++; burst(OX + G.x * T, OY + G.y * T, 30, ['#c9d6e8', '#8a93ad', '#ffffff'], 3, 40, 5); noise(.4, .12, 500, 'lowpass'); tone(300, .3, 'sine', .05, -150); buzz(20);
  }
  function step() {
    const L = G.L, S = G.st;
    G.t++; G.ft++;
    G.shake *= .9; if (G.shake < .2) G.shake = 0; G.flash = Math.max(0, G.flash - .04); if (G.banner > 0) G.banner--;
    for (let i = pn - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vx *= .94; p.vy *= .94; if (--p.life <= 0) { parts[i] = parts[--pn]; parts[pn] = p; } }
    for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.y -= .6; if (--f.life <= 0) G.floats.splice(i, 1); }
    if (G.toasts.length && --G.toasts[0].life <= 0) G.toasts.shift();
    if (gstate === 'ending') { if (--G.over <= 0) finish(); return; }
    if (G.smokeT > 0) G.smokeT--; if (G.grace > 0) G.grace--;

    // you
    if (!G.demo) {
      let dx = (keysDown.right ? 1 : 0) - (keysDown.left ? 1 : 0) || moveX, dy = (keysDown.down ? 1 : 0) - (keysDown.up ? 1 : 0) || moveY;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      const sp = .05 * (1 + .05 * up('shoes')), R = .26;
      const nx = G.x + dx * sp, ny = G.y + dy * sp, hit = (x, y) => wallAt(L, Math.floor(x - R), Math.floor(y - R)) || wallAt(L, Math.floor(x + R), Math.floor(y - R)) || wallAt(L, Math.floor(x - R), Math.floor(y + R)) || wallAt(L, Math.floor(x + R), Math.floor(y + R));
      if (!hit(nx, G.y)) G.x = nx; if (!hit(G.x, ny)) G.y = ny;
      if (m > .1) G.face = Math.atan2(dy, dx);
    }
    // guards
    let seen = '';
    const hidden = G.smokeT > 0 || G.grace > 0 || G.demo;
    for (const g of L.guards) {
      const d = Math.hypot(G.x - g.x, G.y - g.y), a = Math.atan2(G.y - g.y, G.x - g.x);
      let da = a - g.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
      g.sees = !hidden && d < VR && Math.abs(da) < VA && clear(L, g.x, g.y, G.x, G.y);
      if (g.sees) { seen = 'guard'; G.alarm += (2.3 * (1.5 - d / VR)) * (1 - .08 * up('cloak')); g.ang += da * .08; }
      else if (g.wait > 0) { g.wait--; g.ang += Math.sin(g.wait / 9) * .03; }
      else { const p = g.route[g.i], gx = p[0] - g.x, gy = p[1] - g.y, gd = Math.hypot(gx, gy); if (gd < g.spd) { g.x = p[0]; g.y = p[1]; g.i = (g.i + 1) % g.route.length; if (G.rand === Math.random ? Math.random() < .12 : (g.i % 7 === 0)) g.wait = 50; } else { g.x += gx / gd * g.spd; g.y += gy / gd * g.spd; let t = Math.atan2(gy, gx) - g.ang; t = Math.atan2(Math.sin(t), Math.cos(t)); g.ang += t * .14; } }
      if (!hidden && d < .55) { G.alarm = 100; seen = 'guard'; }
    }
    for (const s of L.lights) { s.t += s.spd; s.x = s.x0 + (s.x1 - s.x0) * (.5 - .5 * Math.cos(s.t)); if (!hidden && Math.hypot(G.x - s.x, G.y - s.y) < .95) { seen = 'light'; G.alarm += 2 * (1 - .08 * up('cloak')); } }
    if (G.demo) return;
    if (seen) { G.by = seen; if (!G.seenThis) { G.seenThis = true; tone(880, .12, 'square', .05); tone(1175, .18, 'square', .05, 0, .1); } if (G.t % 12 === 0) tone(660, .05, 'square', .03); }
    else G.alarm = Math.max(0, G.alarm - .55 * (1 + .2 * up('nerves')));
    music.intensity = Math.min(5, 1 + Math.floor(G.floor / 3) + (G.alarm > 40 ? 2 : 0)); music.tense = G.alarm > 20;
    if (G.alarm >= 100) { G.alarm = 100; gstate = 'ending'; G.over = 80; G.flash = 1; G.shake = 14; musicStop(); pauseBtn.hidden = true; buzz([40, 30, 80]); noise(.5, .2); chime([880, 660, 440], 'square', .05, .14); return; }
    // loot and the exit
    for (const o of L.loot) if (!o.got && Math.hypot(G.x - o.x, G.y - o.y) < .55) {
      o.got = true; const px = OX + o.x * T, py = OY + o.y * T;
      if (o.k === 'smoke') { G.smoke++; float(px, py - 12, '+1 SMOKE', '#c9d6e8'); chime([440, 660]); continue; }
      const v = Math.round((o.k === 'vault' ? 400 : o.k === 'gem' ? 150 : 50) * lootMul()); G.score += v; S.loot++;
      burst(px, py, o.k === 'vault' ? 26 : 10, o.k === 'coin' ? ['#ffd24a', '#fff2b0'] : ['#7fe8ff', '#ffffff', '#b48cff'], 3, 30, 3); float(px, py - 12, '+' + v, '#ffd24a');
      if (o.k === 'vault') { G.open = true; say('EXIT UNLOCKED · GET OUT', '#5cf2b0'); chime([523, 784, 1046, 1318]); } else tone(1200 + S.loot % 5 * 120, .06, 'triangle', .04);
    }
    if (G.open && Math.abs(G.x - (L.exit[0] + .5)) < .5 && G.y < L.exit[1] + .9) {
      const secs = G.ft / 60, fast = secs < PAR, ghost = !G.seenThis, bonus = Math.round((300 + (fast ? (PAR - secs) * 8 : 0) + (ghost ? 250 : 0)) * (1 + .15 * (G.floor - 1)));
      G.score += bonus; S.floors = G.floor; if (fast) S.fast++; if (ghost) S.ghosts++;
      say(`FLOOR ${G.floor} CLEAN · +${fmt(bonus)}${ghost ? ' · GHOST' : ''}${fast ? ' · FAST' : ''}`, '#ffd24a', 190); chime([659, 784, 988, 1318]); G.flash = .5;
      nextFloor();
    }
    S.score = Math.floor(G.score); if (G.mode === 'daily') S.daily = S.score;
    if (G.t % 30 === 0) { const a = checkAch(S), ms = missionTick(S, false); for (const x of a) { G.newAch.push(x); G.toasts.push({ ach: x, life: 110 }); chime([523, 659, 784], 'triangle', .05); } for (const x of ms) { G.newMis.push(x); say(`JOB DONE · +${x.pay} COINS`, '#5cf2b0'); } if (a.length || ms.length) saveLocal(); }
    if (!D.tut) { const H0 = [[40, 'GRAB THE BIG GEM TO UNLOCK THE EXIT AT THE TOP'], [420, 'STAY OUT OF THE YELLOW CONES'], [900, usedTouch ? 'TAP SMOKE TO VANISH FOR A MOMENT' : `${keyFor('smoke')} THROWS A SMOKE BOMB`]]; if (G.hint < H0.length && G.t >= H0[G.hint][0]) { say(H0[G.hint][1], '#bff3e0', 230); if (++G.hint === H0.length) D.tut = true; } }
  }

  let acc = 0, lastFrame = 0, frameNo = 0;
  function startRun(mode) {
    if (GAME.modes.some(m => m.id === mode)) D.mode = mode; else mode = D.mode;
    initAudio(); newGame(mode); gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; $('top').hidden = true; resize();
    if (mode === 'daily') say(`DAILY JOB · ${dayLabel.toUpperCase()}`, '#4aa3ff', 160);
    chime([392, 523]); music.intensity = 1; music.tense = false; musicStart(); acc = 0; lastFrame = performance.now();
  }
  function pauseRun() { if (gstate !== 'run') return; gstate = 'paused'; musicStop(); pauseBtn.hidden = true; for (const k in keysDown) keysDown[k] = false; stick = null; moveX = moveY = 0; show('pause'); }
  function resumeRun() { if (gstate !== 'paused') return; initAudio(); gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; musicStart(); acc = 0; lastFrame = performance.now(); }
  const logData = end => ({ end, m: G.floor - 1, z: Math.min(20, G.floor - 1), x: Math.round(G.x / COLS * 1000), y: Math.round(G.y / ROWS * 1000), floor: G.floor, ft: Math.round(G.ft / 60), guards: G.L.guards.length, lights: G.L.lights.length, hadVault: G.open, smokeLeft: G.smoke, loot: G.st.loot, ghosts: G.st.ghosts });
  const logMeta = () => ({ mode: G.mode, s: Math.floor(G.score), t: Math.round(G.t / 60), n: D.life.runs });
  function restartRun() { if (gstate !== 'run' && gstate !== 'paused') return; if (G.t > 600) logRun(Object.assign(logMeta(), logData('restart'))); musicStop(true); startRun(G.mode); }
  function leaveRun() { if ((gstate === 'run' || gstate === 'paused') && G.t > 600) logRun(Object.assign(logMeta(), logData('quit'))); musicStop(); gstate = 'idle'; $('top').hidden = false; pauseBtn.hidden = true; resize(); newGame('free', true); }
  function finish() {
    const S = G.st, done = G.floor - 1;
    endRun({ mode: G.mode, score: G.score, stats: S, secs: G.t / 60, coins: G.score / 120 + done * 4, xp: G.score / 30 + done * 10, title: 'Busted', ach: G.newAch, mis: G.newMis,
      line: `Caught on <b>floor ${G.floor}</b> by a ${G.by === 'light' ? 'searchlight' : 'guard'} after cleaning out ${done} floor${done === 1 ? '' : 's'}${G.mode === 'daily' ? ' of the Daily Job' : ''}.`,
      rows: [['Floors cleaned out', done], ['Loot taken', S.loot], ['Floors unseen', S.ghosts], ['Floors under the clock', S.fast], ['Smoke bombs used', S.smokes]], note: done + ' floors', meta: { floors: done },
      log: logData(G.by || 'guard') });
  }

  /* ---------- input ---------- */
  const smokeBox = () => ({ x: LW - 92, y: LH - 78, w: 80, h: 62 });
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') usedTouch = true;
    initAudio(); if (gstate !== 'run') return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / SC, y = (e.clientY - r.top) / SC, b = smokeBox();
    if (usedTouch && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return useSmoke();
    stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; moveX = moveY = 0;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  });
  cv.addEventListener('pointermove', e => {
    if (!stick || e.pointerId !== stick.id) return;
    stick.x = e.clientX; stick.y = e.clientY; let dx = stick.x - stick.ox, dy = stick.y - stick.oy; const d = Math.hypot(dx, dy), MAXR = 36;
    if (d > MAXR) { stick.ox = stick.x - dx / d * MAXR; stick.oy = stick.y - dy / d * MAXR; dx = dx / d * MAXR; dy = dy / d * MAXR; }
    if (d < 6) { moveX = moveY = 0; } else { moveX = dx / MAXR; moveY = dy / MAXR; }
  });
  for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, e => { if (stick && e.pointerId === stick.id) { stick = null; moveX = moveY = 0; } });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('keydown', e => {
    if (capturing || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) || e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code || e.key || '';
    for (const k in keysDown) if (bound(k, c)) { keysDown[k] = true; usedTouch = false; }
    if (gstate === 'run') { if (KEY_ACTIONS.some(([a]) => bound(a, c))) e.preventDefault(); if (bound('smoke', c) && !e.repeat) useSmoke(); if (bound('pause', c)) pauseRun(); }
    else if (gstate === 'paused' && view === 'pause' && bound('pause', c)) { e.preventDefault(); resumeRun(); }
    else if ((view === 'over' || view === 'home') && c === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); startRun(); }
  });
  addEventListener('keyup', e => { const c = e.code || e.key || ''; for (const k in keysDown) if (bound(k, c)) keysDown[k] = false; });
  addEventListener('blur', () => { for (const k in keysDown) keysDown[k] = false; stick = null; moveX = moveY = 0; });

  /* ---------- drawing ---------- */
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function drawThief(c, it, s) { if (it.alpha) c.globalAlpha *= it.alpha; c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(1, 3 * s, 9 * s, 5 * s, 0, 0, TAU); c.fill(); c.fillStyle = it.c2; c.beginPath(); c.arc(0, 0, 9 * s, 0, TAU); c.fill(); c.fillStyle = it.c; c.beginPath(); c.arc(0, -1 * s, 7 * s, 0, TAU); c.fill(); if (it.stripe) { c.fillStyle = it.c2; c.fillRect(-7 * s, -2.5 * s, 14 * s, 3 * s); } c.fillStyle = '#fff'; c.fillRect(-4 * s, -2.5 * s, 2.4 * s, 2 * s); c.fillRect(1.6 * s, -2.5 * s, 2.4 * s, 2 * s); }
  const previews = {};
  function cosPreview(kind, it) { if (previews[it.id]) return previews[it.id]; const c = document.createElement('canvas'); c.width = c.height = 144; const x = c.getContext('2d'); x.fillStyle = '#111b22'; x.fillRect(0, 0, 144, 144); x.fillStyle = '#16242d'; for (let i = 0; i < 16; i++) if ((i + (i >> 2)) % 2) x.fillRect((i % 4) * 36, (i >> 2) * 36, 36, 36); x.translate(72, 76); drawThief(x, it, 4.2); return (previews[it.id] = c.toDataURL('image/png')); }
  const clearPreviews = () => { for (const k in previews) delete previews[k]; };

  function drawGame(now) {
    const k = dpr * SC, F = '"Bungee",Impact,sans-serif', M = '"DM Mono",monospace', L = G.L, playing = !G.demo, px = c => OX + c * T, py = r => OY + r * T;
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.save();
    if (G.shake > 0 && save.settings.shake && !reduceMotion) ctx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);
    ctx.fillStyle = '#070b0e'; ctx.fillRect(-20, -20, LW + 40, LH + 40);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (L.w[r * COLS + c]) { ctx.fillStyle = '#22343f'; ctx.fillRect(px(c), py(r), T, T); ctx.fillStyle = '#2f4a58'; ctx.fillRect(px(c), py(r), T, T * .28); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px(c), py(r) + T - 2, T, 2); }
      else { ctx.fillStyle = (c + r) % 2 ? '#101a20' : '#0d161b'; ctx.fillRect(px(c), py(r), T, T); }
    }
    // the exit
    const ex = px(L.exit[0]), ey = py(0); ctx.fillStyle = G.open ? '#1f6b4c' : '#5a2430'; ctx.fillRect(ex + 3, ey + 4, T - 6, T - 4); ctx.fillStyle = G.open ? '#5cf2b0' : '#ff5a6e'; ctx.fillRect(ex + 3, ey + T - 5, T - 6, 3);
    ctx.font = `${Math.round(T * .2)}px ${F}`; ctx.textAlign = 'center'; ctx.fillText(G.open ? 'EXIT' : 'LOCKED', ex + T / 2, ey + T * .58);
    // searchlights and what the guards can see
    for (const s of L.lights) { const g = ctx.createRadialGradient(px(s.x), py(s.y), 0, px(s.x), py(s.y), T * .95); g.addColorStop(0, 'rgba(255,240,170,.45)'); g.addColorStop(1, 'rgba(255,240,170,.05)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px(s.x), py(s.y), T * .95, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,240,170,.5)'; ctx.lineWidth = 1; ctx.stroke(); }
    for (const g of L.guards) {
      ctx.fillStyle = g.sees ? 'rgba(255,90,110,.34)' : 'rgba(255,225,120,.2)'; ctx.beginPath(); ctx.moveTo(px(g.x), py(g.y));
      for (let i = 0; i <= 12; i++) { const a = g.ang - VA + i / 12 * VA * 2; let d = 0; while (d < VR && !wallAt(L, Math.floor(g.x + Math.cos(a) * (d + .15)), Math.floor(g.y + Math.sin(a) * (d + .15)))) d += .15; ctx.lineTo(px(g.x + Math.cos(a) * d), py(g.y + Math.sin(a) * d)); }
      ctx.fill();
    }
    for (const o of L.loot) { if (o.got) continue; const x = px(o.x), y = py(o.y), b = reduceMotion ? 0 : Math.sin(now / 250 + o.x) * 1.5;
      if (o.k === 'coin') { ctx.fillStyle = '#b38a12'; ctx.beginPath(); ctx.arc(x, y + 1 + b, T * .16, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x, y + b, T * .16, 0, TAU); ctx.fill(); }
      else if (o.k === 'smoke') { ctx.fillStyle = '#8a93ad'; ctx.beginPath(); ctx.arc(x, y + b, T * .17, 0, TAU); ctx.fill(); ctx.fillStyle = '#c9d6e8'; ctx.fillRect(x - 1.5, y - T * .28 + b, 3, T * .12); }
      else { const s = o.k === 'vault' ? T * .3 : T * .19; if (o.k === 'vault') { const g = ctx.createRadialGradient(x, y, 0, x, y, T * .8); g.addColorStop(0, 'rgba(127,232,255,.4)'); g.addColorStop(1, 'rgba(127,232,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - T, y - T, T * 2, T * 2); } ctx.fillStyle = o.k === 'vault' ? '#7fe8ff' : '#b48cff'; ctx.beginPath(); ctx.moveTo(x, y - s + b); ctx.lineTo(x + s * .8, y + b); ctx.lineTo(x, y + s + b); ctx.lineTo(x - s * .8, y + b); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(x, y - s + b); ctx.lineTo(x + s * .35, y + b); ctx.lineTo(x - s * .35, y + b); ctx.fill(); } }
    const s = T / 40;
    for (const g of L.guards) { const x = px(g.x), y = py(g.y); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 3 * s, 10 * s, 5 * s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#27405c'; ctx.beginPath(); ctx.arc(x, y, 10 * s, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a78a8'; ctx.beginPath(); ctx.arc(x, y - 1 * s, 7.5 * s, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(x + Math.cos(g.ang) * 6 * s, y + Math.sin(g.ang) * 6 * s, 2.6 * s, 0, TAU); ctx.fill(); if (g.sees) { ctx.font = `${Math.round(16 * s)}px ${F}`; ctx.fillStyle = '#ff5a6e'; ctx.fillText('!', x, y - 14 * s); } }
    for (let i = 0; i < pn; i++) { const p = parts[i]; ctx.globalAlpha = p.life / p.max * (p.s > 4 ? .5 : 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); }
    ctx.globalAlpha = 1;
    if (playing && gstate !== 'ending') { ctx.save(); ctx.translate(px(G.x), py(G.y)); if (G.smokeT > 0 || (G.grace > 0 && Math.floor(now / 110) % 2)) ctx.globalAlpha = .35; drawThief(ctx, cosItem('thief', D.eq.thief), s); ctx.restore(); if (G.smokeT > 0) { ctx.strokeStyle = 'rgba(201,214,232,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(G.x), py(G.y), 14 * s, -Math.PI / 2, -Math.PI / 2 + TAU * G.smokeT / 150); ctx.stroke(); } }
    ctx.restore();
    if (!playing) return;
    ctx.textAlign = 'center'; for (const f of G.floats) { ctx.font = '10px ' + F; ctx.globalAlpha = Math.min(1, f.life / 16); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(f.text, f.x + 1, f.y + 1); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); } ctx.globalAlpha = 1;
    if (G.alarm > 0) { ctx.fillStyle = `rgba(255,60,80,${G.alarm / 100 * .18})`; ctx.fillRect(0, 0, LW, LH); }
    if (G.flash > 0) { ctx.fillStyle = gstate === 'ending' ? `rgba(255,60,80,${G.flash * .45})` : `rgba(160,255,220,${G.flash * .25})`; ctx.fillRect(0, 0, LW, LH); }
    // HUD
    ctx.textAlign = 'left'; ctx.font = '20px ' + F; ctx.fillStyle = '#f1eeff'; ctx.fillText(fmt(G.score), 12, 28);
    const left = L.loot.filter(o => !o.got && o.k !== 'smoke').length, secs = G.ft / 60;
    ctx.font = '9px ' + M; ctx.fillStyle = '#a9c4cf'; ctx.fillText(`FLOOR ${G.floor} · ${left} LOOT LEFT · ${secs < PAR ? Math.ceil(PAR - secs) + ' S FOR FAST' : 'NO SPEED BONUS'}`, 12, 42);
    const aw = 136, ax = 190; ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, ax, 14, aw, 9, 4); ctx.fill(); if (G.alarm > 0) { ctx.fillStyle = G.alarm > 60 ? '#ff3d55' : '#ffb347'; rr(ctx, ax, 14, aw * G.alarm / 100, 9, 4); ctx.fill(); }
    ctx.textAlign = 'right'; ctx.font = '8px ' + M; ctx.fillStyle = G.alarm > 0 ? '#ff5a6e' : '#a9c4cf'; ctx.fillText(G.alarm > 0 ? 'SEEN' : G.seenThis ? 'ALARM' : 'UNSEEN', ax - 5, 22);
    const b = smokeBox();
    if (usedTouch) { ctx.fillStyle = G.smoke > 0 && G.smokeT <= 0 ? 'rgba(201,214,232,.9)' : 'rgba(255,255,255,.12)'; rr(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill(); ctx.textAlign = 'center'; ctx.font = '11px ' + F; ctx.fillStyle = G.smoke > 0 ? '#0a1014' : '#5a6a74'; ctx.fillText('SMOKE', b.x + b.w / 2, b.y + 28); ctx.font = '10px ' + M; ctx.fillText('x' + G.smoke, b.x + b.w / 2, b.y + 46); }
    else { ctx.textAlign = 'right'; ctx.font = '9px ' + M; ctx.fillStyle = G.smoke > 0 ? '#c9d6e8' : '#5a6a74'; ctx.fillText(`${keyFor('smoke').toUpperCase()}: SMOKE x${G.smoke}`, LW - 12, LH - 12); }
    ctx.textAlign = 'center';
    if (G.banner > 0) { ctx.globalAlpha = Math.min(1, G.banner / 30); ctx.font = '26px ' + F; ctx.fillStyle = '#5cf2b0'; ctx.fillText('FLOOR ' + G.floor, LW / 2, OY + ROWS * T * .42); ctx.globalAlpha = 1; }
    if (gstate === 'ending') { ctx.font = '30px ' + F; ctx.fillStyle = '#ff5a6e'; ctx.fillText('BUSTED', LW / 2, OY + ROWS * T * .42); }
    if (stick && gstate === 'run') { const ox = (stick.ox - cv.getBoundingClientRect().left) / SC, oy = (stick.oy - cv.getBoundingClientRect().top) / SC; ctx.globalAlpha = .2; ctx.strokeStyle = '#f1eeff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox, oy, 36 / SC, 0, TAU); ctx.stroke(); ctx.globalAlpha = .5; ctx.fillStyle = '#f1eeff'; ctx.beginPath(); ctx.arc(ox + moveX * 36 / SC, oy + moveY * 36 / SC, 9, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    const tt = G.toasts[0];
    if (tt && tt.ach) { ctx.font = '9px ' + F; const label = '★ ' + tt.ach.n.toUpperCase(), w = ctx.measureText(label).width + 20; ctx.globalAlpha = Math.min(.92, tt.life / 20); ctx.fillStyle = 'rgba(7,11,14,.9)'; rr(ctx, 12, LH - 30, w, 20, 10); ctx.fill(); ctx.strokeStyle = TIERS[tt.ach.tier].c; ctx.lineWidth = 1; ctx.stroke(); ctx.textAlign = 'left'; ctx.fillStyle = '#f1eeff'; ctx.fillText(label, 22, LH - 16); ctx.globalAlpha = 1; }
    else if (tt) { ctx.globalAlpha = Math.min(1, tt.life / 25); ctx.font = '9px ' + F; ctx.textAlign = 'center'; const w = Math.min(LW - 16, ctx.measureText(tt.text).width + 24), y = Math.min(LH - 14, OY + ROWS * T + 22); ctx.fillStyle = 'rgba(7,11,14,.9)'; rr(ctx, LW / 2 - w / 2, y - 15, w, 22, 11); ctx.fill(); ctx.strokeStyle = tt.c; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = tt.c; ctx.fillText(tt.text, LW / 2, y); ctx.globalAlpha = 1; }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || !G) { lastFrame = now; return; }
    const dtMs = Math.min(100, now - lastFrame); lastFrame = now; frameNo++;
    if (gstate === 'run' || gstate === 'ending') { acc += dtMs; let n = 0; while (acc >= 1000 / 60 && n++ < 5) { acc -= 1000 / 60; step(); if (gstate !== 'run' && gstate !== 'ending') break; } if (n >= 5) acc = 0; if (gstate === 'run' || gstate === 'ending') drawGame(now); }
    else if (gstate === 'idle') { if (frameNo % 2) return; step(); drawGame(now); }
  }

  /* ---------- boot ---------- */
  addEventListener('resize', () => { resize(); if (G && gstate !== 'run' && gstate !== 'ending') drawGame(performance.now()); });
  fixEquipped(); resize(); newGame('free', true); G.floor = 4; G.L = makeFloor(4, Math.random); syncWallet();
  show('home'); lastFrame = performance.now(); requestAnimationFrame(frame); onlineBoot();
  if (DEV) window.NH = { get G() { return G; }, get save() { return save; }, get state() { return gstate; }, startRun, step, show, useSmoke, keysDown, makeFloor, flood, pathTo, COLS, ROWS, nextFloor };
