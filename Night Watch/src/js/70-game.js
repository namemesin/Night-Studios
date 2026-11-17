  /* ================= NIGHT WATCH: the game ================= */
  // The field is 400 units wide on every screen. Logic runs at a fixed 60 steps a second (twice per frame while
  // fast-forwarding). Waves are laid out by a seeded generator, so a Daily Watch is the same for everyone.
  const LW = 400, BAR_H = 70;
  let SC = 1, LH = 600, FX = 200, FY = 280, FIELD_B = 530;
  resizeHooks.push(() => { SC = W / LW; LH = H / SC; FIELD_B = LH - BAR_H; FX = LW / 2; FY = Math.round(FIELD_B * .5); });
  let G = null;
  const BUILD = [
    { k: 'lantern', n: 'Lantern', cost: 30, up: [40, 70], d: 'area' },
    { k: 'bramble', n: 'Bramble', cost: 20, d: 'slows' },
    { k: 'flare', n: 'Flare', cost: 15, d: 'blast' },
    { k: 'beacon', n: 'Beacon', cost: 60, up: [70, 110], d: 'beam' },
  ];
  // hp, speed, damage to the fire, embers, size, the first wave it shows up in
  const FOES = {
    shade: { hp: 30, spd: .55, dmg: 5, val: 5, r: 9, from: 1, n: 'Shade' },
    runner: { hp: 15, spd: 1.15, dmg: 4, val: 6, r: 7, from: 3, n: 'Runner' },
    brute: { hp: 120, spd: .34, dmg: 15, val: 16, r: 14, from: 5, n: 'Brute' },
    wisp: { hp: 28, spd: .8, dmg: 5, val: 7, r: 7, from: 7, n: 'Wisp' },
    eclipse: { hp: 900, spd: .24, dmg: 60, val: 90, r: 22, from: 10, n: 'Eclipse' },
  };
  const reachMul = () => 1 + .06 * up('reach'), heatMul = () => 1 + .08 * up('wick');
  const lanternR = t => (64 + t.lv * 9) * reachMul(), lanternDps = t => (12.5 + t.lv * 6.5) * heatMul();
  const beaconR = t => (150 + t.lv * 22) * reachMul(), beaconDps = t => (30 + t.lv * 17) * heatMul();
  const PMAX = 360, parts = Array.from({ length: PMAX }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, c: '#fff', s: 2 }));
  let pn = 0;
  function spark(x, y, vx, vy, life, c, s) { if (pn >= PMAX) return; const p = parts[pn++]; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.c = c; p.s = s; }
  function burst(x, y, n, colors, spd = 3, life = 30, size = 3) { if (reduceMotion || save.settings.fx === 'low') n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = Math.random() * spd; spark(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (.6 + Math.random() * .4), colors[i % colors.length], Math.random() * size + 1); } }

  function newGame(mode, demo) {
    rollDay();
    G = { mode, demo: !!demo, rand: mode === 'daily' ? seeded('nightwatch-' + dayKey) : Math.random, t: 0, score: 0, embers: 100 + 20 * up('embers'), fire: 100 + 20 * up('hearth'), fireMax: 100 + 20 * up('hearth'),
      wave: 0, night: 1, phase: 'break', timer: 240, queue: [], spawnT: 0, foes: [], towers: [], sel: 0, speed: 1, st: blankStats(), floats: [], toasts: [], shake: 0, flash: 0, banner: 0, bannerText: '', lastHit: '', leaks: {}, newAch: [], newMis: [], hover: null };
    pn = 0; return G;
  }
  const float = (x, y, text, c) => { if (!G.demo) { if (G.floats.length > 14) G.floats.shift(); G.floats.push({ x: clamp(x, 40, LW - 40), y, text, c, life: 50 }); } };
  const say = (text, c = '#ffb347', life = 160) => { if (!G.demo) G.toasts.push({ text, c, life }); };
  const snd = (...a) => { if (!G.demo) tone(...a); };

  // What a wave is made of. Later waves mix in tougher shades and send them faster.
  function buildWave(w) {
    const r = G.rand, q = [], n = Math.round(4 + w * 1.7);
    for (let i = 0; i < n; i++) {
      const x = r(); let k = 'shade';
      if (w >= FOES.wisp.from && x < .16) k = 'wisp'; else if (w >= FOES.brute.from && x < .16 + Math.min(.22, .08 + w * .006)) k = 'brute'; else if (w >= FOES.runner.from && x < .58) k = 'runner';
      q.push({ k, side: r() });
    }
    if (w % 10 === 0) q.splice(Math.floor(n / 2), 0, { k: 'eclipse', side: r() });
    return q;
  }
  function spawn(e) {
    // somewhere on the edge of the field
    const per = 2 * (LW + FIELD_B), d = e.side * per; let x, y;
    if (d < LW) { x = d; y = -18; } else if (d < LW + FIELD_B) { x = LW + 18; y = d - LW; } else if (d < 2 * LW + FIELD_B) { x = d - LW - FIELD_B; y = FIELD_B + 18; } else { x = -18; y = d - 2 * LW - FIELD_B; }
    const f = FOES[e.k], scale = (1 + (G.wave - 1) * .13) * Math.pow(1.06, Math.max(0, G.wave - 10));
    G.foes.push({ k: e.k, x, y, hp: f.hp * scale, max: f.hp * scale, spd: f.spd * (1 + Math.min(.5, G.wave * .008)), r: f.r, slow: 0, wob: G.rand() * 9, hit: 0 });
  }
  function startWave() {
    G.wave++; G.phase = 'wave'; G.queue = buildWave(G.wave); G.spawnT = 30;
    G.banner = 110; G.bannerText = G.wave % 10 === 0 ? `WAVE ${G.wave} · ECLIPSE` : `WAVE ${G.wave}`;
    snd(330, .2, 'triangle', .06); snd(440, .3, 'triangle', .06, 0, .15);
  }
  function callWave() {
    if (!G || gstate !== 'run' || G.phase !== 'break' || G.demo) return;
    const secs = Math.floor(G.timer / 60);
    if (G.wave > 0 && secs > 0) { G.embers += secs * 2; G.score += secs * 5 * G.night; G.st.calls++; float(FX, FY - 60, `EARLY · +${secs * 2} EMBERS`, '#ffd24a'); }
    startWave();
  }
  function kill(e) {
    const f = FOES[e.k], gain = Math.round(f.val * (1 + .12 * up('salvage')));
    G.embers += gain; G.score += f.val * 10 * G.night; G.st.kills++; if (e.k === 'eclipse') { G.st.bosses++; G.shake = 12; G.flash = .6; say('ECLIPSE BURNED', '#ffd24a'); }
    burst(e.x, e.y, e.k === 'eclipse' ? 40 : 8, ['#6b4bd6', '#ffb347', '#1a1030'], 3, 30, 3); float(e.x, e.y - 10, '+' + gain, '#ffb347');
    snd(500 + Math.random() * 300, .06, 'triangle', .03);
  }
  function tryPlace(x, y) {
    if (y > FIELD_B - 8 || y < 8 || x < 8 || x > LW - 8) return;
    // tapping a lantern or beacon upgrades it
    for (const t of G.towers) if ((t.k === 'lantern' || t.k === 'beacon') && Math.hypot(t.x - x, t.y - y) < 20) {
      const b = BUILD.find(q => q.k === t.k);
      if (t.lv >= 2) return float(t.x, t.y - 20, 'MAXED', '#9c8f84');
      if (G.embers < b.up[t.lv]) return deny(t.x, t.y, b.up[t.lv]);
      G.embers -= b.up[t.lv]; t.lv++; t.show = 60; burst(t.x, t.y, 14, ['#ffd24a', '#fff2b0'], 3, 30, 3); snd(660, .1, 'triangle', .05); snd(990, .18, 'triangle', .05, 0, .08); return;
    }
    const b = BUILD[G.sel];
    if (Math.hypot(x - FX, y - FY) < 34) return float(x, y - 14, 'TOO CLOSE TO THE FIRE', '#9c8f84');
    if (G.towers.some(t => Math.hypot(t.x - x, t.y - y) < 26)) return float(x, y - 14, 'NO ROOM', '#9c8f84');
    if (G.embers < b.cost) return deny(x, y, b.cost);
    G.embers -= b.cost; G.towers.push({ k: b.k, x, y, lv: 0, show: 70, tgt: null }); G.st.built++;
    burst(x, y, 10, ['#ffb347', '#fff2b0'], 2.5, 26, 2); snd(520, .08, 'triangle', .05);
  }
  function deny(x, y, cost) { float(x, y - 14, `NEED ${cost} EMBERS`, '#ff6b6b'); snd(160, .12, 'square', .04, -40); }

  function step() {
    const S = G.st;
    G.t++;
    G.shake *= .9; if (G.shake < .2) G.shake = 0; G.flash = Math.max(0, G.flash - .04); if (G.banner > 0) G.banner--;
    for (let i = pn - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vx *= .95; p.vy *= .95; if (--p.life <= 0) { parts[i] = parts[--pn]; parts[pn] = p; } }
    for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.y -= .7; if (--f.life <= 0) G.floats.splice(i, 1); }
    if (G.toasts.length && --G.toasts[0].life <= 0) G.toasts.shift();
    if (gstate === 'ending') { if (--G.over <= 0) finish(); return; }

    // waves
    if (G.phase === 'break') { if (--G.timer <= 0) startWave(); }
    else {
      if (G.queue.length && --G.spawnT <= 0) { spawn(G.queue.shift()); G.spawnT = Math.max(16, 66 - G.wave * 2.6) * (.7 + G.rand() * .6); }
      if (!G.queue.length && !G.foes.length) {
        S.waves = G.wave; const bonus = 18 + G.wave * 3; G.embers += bonus; G.score += 50 * G.wave; G.phase = 'break'; G.timer = 420;
        float(FX, FY - 50, `WAVE CLEAR · +${bonus} EMBERS`, '#5cf2b0'); if (!G.demo) chime([523, 659, 784]);
        if (G.wave % 10 === 0) { S.nights = G.night; G.score += 1000 * G.night; G.fire = Math.min(G.fireMax, G.fire + 30); G.night++; G.banner = 200; G.bannerText = 'SUNRISE'; G.dawn = 200; say(`NIGHT ${G.night} BEGINS · THE FIRE RECOVERS`, '#ffd24a', 200); }
      }
    }
    if (G.dawn > 0) G.dawn--;

    // light: towers pick targets and burn
    for (const t of G.towers) { if (t.show > 0) t.show--; t.dim = false; t.tgt = null; }
    const ecl = G.foes.filter(e => e.k === 'eclipse');
    for (const t of G.towers) if (t.k === 'lantern' || t.k === 'beacon') t.dim = ecl.some(e => Math.hypot(e.x - t.x, e.y - t.y) < 95);
    for (const t of G.towers) if (t.k === 'beacon') { let best = null, bd = 1e9; const R2 = beaconR(t) ** 2; for (const e of G.foes) { const d = (e.x - t.x) ** 2 + (e.y - t.y) ** 2; if (d > R2) continue; const fd = (e.x - FX) ** 2 + (e.y - FY) ** 2; if (fd < bd) { bd = fd; best = e; } } t.tgt = best; if (best) { best.hp -= beaconDps(t) / 60 * (t.dim ? .5 : 1); best.hit = 4; } }
    for (let i = G.foes.length - 1; i >= 0; i--) {
      const e = G.foes[i], f = FOES[e.k];
      let slow = 1;
      for (let j = G.towers.length - 1; j >= 0; j--) {
        const t = G.towers[j], d = Math.hypot(e.x - t.x, e.y - t.y);
        if (t.k === 'lantern') { if (d < lanternR(t)) { e.hp -= lanternDps(t) / 60 * (t.dim ? .5 : 1); e.hit = 3; } }
        else if (t.k === 'bramble') { if (d < 44) { if (e.k === 'brute' || e.k === 'eclipse') { if (d < e.r + 8) { G.towers.splice(j, 1); burst(t.x, t.y, 10, ['#3f6b3a', '#1c2a18'], 2, 24, 3); } } else if (e.k !== 'wisp') slow = .45; } }
        else if (t.k === 'flare' && d < 24 + e.r) {
          G.towers.splice(j, 1); G.shake = Math.max(G.shake, 6); G.flash = Math.max(G.flash, .35);
          burst(t.x, t.y, 30, ['#ffffff', '#ffd24a', '#ff7a3d'], 6, 34, 4); if (!G.demo) { noise(.25, .14, 900, 'bandpass'); tone(200, .3, 'sawtooth', .05, 300); }
          for (const o of G.foes) if (Math.hypot(o.x - t.x, o.y - t.y) < 66 * reachMul()) { o.hp -= (70 + G.wave * 5) * heatMul(); o.hit = 6; }
        }
      }
      const fd = Math.hypot(FX - e.x, FY - e.y);
      if (fd < 76) { e.hp -= 6 / 60; }
      if (e.hit > 0) e.hit--;
      if (e.hp <= 0) { kill(e); G.foes.splice(i, 1); continue; }
      const ang = Math.atan2(FY - e.y, FX - e.x) + (e.k === 'wisp' ? Math.sin(G.t / 14 + e.wob) * .9 : Math.sin(G.t / 40 + e.wob) * .12);
      e.x += Math.cos(ang) * e.spd * slow; e.y += Math.sin(ang) * e.spd * slow;
      if (fd < 16 + e.r * .4) {
        G.foes.splice(i, 1); if (G.demo) continue;
        G.fire -= f.dmg; G.lastHit = e.k; G.leaks[e.k] = (G.leaks[e.k] || 0) + 1; G.shake = Math.max(G.shake, 7); G.flash = Math.max(G.flash, .3);
        burst(FX, FY, 16, ['#1a1030', '#6b4bd6', '#ffb347'], 4, 30, 3); float(FX, FY - 34, `-${f.dmg}`, '#ff6b6b'); buzz(30); noise(.2, .12); tone(120, .3, 'sawtooth', .06, -60);
        if (G.fire <= 0) { G.fire = 0; gstate = 'ending'; G.over = 100; musicStop(); pauseBtn.hidden = true; chime([440, 330, 220], 'triangle', .06, .18); return; }
      }
    }
    if (!reduceMotion && G.t % 3 === 0) spark(FX + (Math.random() - .5) * 12, FY - 4, (Math.random() - .5) * .5, -.6 - Math.random(), 30, Math.random() < .5 ? '#ffb347' : '#ff7a3d', 2.5);
    if (G.demo) { demoBuild(); return; }
    S.score = Math.floor(G.score); if (G.mode === 'daily') S.daily = S.score;
    music.intensity = Math.min(5, G.phase === 'wave' ? 1 + Math.floor(G.wave / 4) : 0); music.tense = G.fire < G.fireMax * .3;
    if (G.t % 30 === 0) { const a = checkAch(S), ms = missionTick(S, false); for (const x of a) { G.newAch.push(x); G.toasts.push({ ach: x, life: 110 }); chime([523, 659, 784], 'triangle', .05); } for (const x of ms) { G.newMis.push(x); say(`JOB DONE · +${x.pay} COINS`, '#5cf2b0'); } if (a.length || ms.length) saveLocal(); }
    if (!D.tut) { const H0 = [[60, 'PICK FROM THE BAR, THEN TAP THE GROUND TO BUILD'], [400, 'LANTERNS BURN EVERYTHING INSIDE THEIR CIRCLE'], [1200, 'TAP A LANTERN TO UPGRADE IT'], [2200, 'CALL THE NEXT WAVE EARLY FOR BONUS EMBERS']]; G.hint = G.hint || 0; if (G.hint < H0.length && G.t >= H0[G.hint][0]) { say(H0[G.hint][1], '#ffe0a8', 240); if (++G.hint === H0.length) D.tut = true; } }
  }
  // Behind the menus: a watch that builds itself and never loses.
  function demoBuild() { if (G.t % 90 === 0 && G.towers.length < 9) { const a = G.towers.length * 2.4, d = 60 + (G.towers.length % 3) * 34; G.towers.push({ k: G.towers.length % 4 === 3 ? 'beacon' : 'lantern', x: clamp(FX + Math.cos(a) * d, 20, LW - 20), y: clamp(FY + Math.sin(a) * d, 20, FIELD_B - 20), lv: 1, show: 0 }); } if (G.wave > 6) { G.wave = 1; } }

  let acc = 0, lastFrame = 0, frameNo = 0;
  function startRun(mode) {
    if (GAME.modes.some(m => m.id === mode)) D.mode = mode; else mode = D.mode;
    initAudio(); newGame(mode); armRun(mode); gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; $('top').hidden = true; resize();
    say(mode === 'daily' ? `DAILY WATCH · ${dayLabel.toUpperCase()}` : 'THE FIRST SHADES ARE COMING · BUILD NOW', '#ffb347', 200);
    chime([392, 523]); music.intensity = 0; music.tense = false; musicStart(); acc = 0; lastFrame = performance.now();
  }
  function pauseRun() { if (gstate !== 'run') return; gstate = 'paused'; musicStop(); pauseBtn.hidden = true; show('pause'); }
  function resumeRun() { if (gstate !== 'paused') return; initAudio(); gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; musicStart(); acc = 0; lastFrame = performance.now(); }
  const logData = end => ({ end, m: G.wave, z: G.night - 1, x: 500, wave: G.wave, fire: Math.round(G.fire), embers: G.embers, kills: G.st.kills, built: G.st.built, leaks: G.leaks, towers: G.towers.reduce((o, t) => (o[t.k] = (o[t.k] || 0) + 1, o), {}), calls: G.st.calls });
  function restartRun() { if (gstate !== 'run' && gstate !== 'paused') return; if (G.wave > 1) logRun(Object.assign({ mode: G.mode, s: Math.floor(G.score), t: Math.round(G.t / 60), n: D.life.runs }, logData('restart'))); musicStop(true); startRun(G.mode); }
  function leaveRun() { if ((gstate === 'run' || gstate === 'paused') && G.wave > 1) logRun(Object.assign({ mode: G.mode, s: Math.floor(G.score), t: Math.round(G.t / 60), n: D.life.runs }, logData('quit'))); musicStop(); gstate = 'idle'; $('top').hidden = false; pauseBtn.hidden = true; resize(); newGame('free', true); }
  function finish() {
    const S = G.st, cleared = G.phase === 'wave' ? G.wave - 1 : G.wave; S.waves = Math.max(S.waves, cleared);
    endRun({ mode: G.mode, score: G.score, stats: S, secs: G.t / 60, coins: G.score / 150 + cleared * 2, xp: G.score / 40 + cleared * 6, title: 'The fire went out', ach: G.newAch, mis: G.newMis,
      line: `Held for <b>${cleared} wave${cleared === 1 ? '' : 's'}</b>${G.night > 1 ? ` across ${G.night} nights` : ''}${G.mode === 'daily' ? ' on the Daily Watch' : ''}. The last one through was a <b>${FOES[G.lastHit] ? FOES[G.lastHit].n : 'shade'}</b>.`,
      rows: [['Waves cleared', cleared], ['Shades burned', S.kills], ['Things built', S.built], ['Waves called early', S.calls], ['Eclipses burned', S.bosses]], note: cleared + ' waves', meta: { waves: cleared, night: G.night },
      log: Object.assign(logData(G.lastHit || 'fire'), { m: cleared }) });
  }

  /* ---------- input ---------- */
  const toField = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / SC, y: (e.clientY - r.top) / SC }; };
  const callBox = () => ({ x: LW / 2 - 78, y: 58, w: 156, h: 30 }), speedBox = () => ({ x: 10, y: 52, w: 44, h: 26 });
  const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') usedTouch = true;
    initAudio(); if (gstate !== 'run' || !G) return;
    const p = toField(e);
    if (p.y > FIELD_B) { const i = Math.floor(p.x / (LW / BUILD.length)); if (BUILD[i]) { G.sel = i; sfx.click(); } return; }
    if (G.phase === 'break' && inBox(p, callBox())) return callWave();
    if (inBox(p, speedBox())) { G.speed = G.speed === 1 ? 2 : 1; sfx.click(); return; }
    tryPlace(p.x, p.y);
  });
  cv.addEventListener('pointermove', e => { if (G && gstate === 'run' && e.pointerType === 'mouse') G.hover = toField(e); });
  cv.addEventListener('pointerleave', () => { if (G) G.hover = null; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('keydown', e => {
    if (capturing || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) || e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code || e.key || '';
    if (gstate === 'run') {
      if (KEY_ACTIONS.some(([a]) => bound(a, c))) e.preventDefault();
      BUILD.forEach((b, i) => { if (bound(b.k, c)) G.sel = i; });
      if (bound('call', c) && !e.repeat) callWave(); if (bound('speed', c) && !e.repeat) G.speed = G.speed === 1 ? 2 : 1; if (bound('pause', c)) pauseRun();
    } else if (gstate === 'paused' && view === 'pause' && bound('pause', c)) { e.preventDefault(); resumeRun(); }
  });

  /* ---------- drawing ---------- */
  const sprites = {};
  function glowSprite(key, rgb) { const k = Math.min(2, dpr * SC), c = document.createElement('canvas'); c.width = c.height = Math.ceil(128 * k); const x = c.getContext('2d'); x.scale(k, k); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},.3)`); g.addColorStop(.6, `rgba(${rgb},.1)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); sprites[key] = c; }
  const fireCols = now => { const f = cosItem('fire', D.eq.fire); return f.c === 'cycle' ? [`${Math.round(128 + 127 * Math.sin(now / 400))},${Math.round(128 + 127 * Math.sin(now / 400 + 2))},${Math.round(128 + 127 * Math.sin(now / 400 + 4))}`, '255,255,255'] : f.c; };
  function buildSprites() { for (const k in sprites) delete sprites[k]; for (const it of LAMPS) glowSprite('lamp-' + it.id, it.c); for (const it of FIRES) if (it.c !== 'cycle') glowSprite('fire-' + it.id, it.c[0]); glowSprite('fire-prism', '255,255,255'); glowSprite('beam', '160,220,255'); }
  resizeHooks.push(buildSprites);
  const glow = (key, x, y, r) => ctx.drawImage(sprites[key], x - r, y - r, r * 2, r * 2);
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function drawTower(c, t, lamp, now) {
    if (t.k === 'lantern') { c.fillStyle = '#3a2a1e'; c.fillRect(-1.5, -2, 3, 12); c.fillStyle = `rgb(${lamp.c})`; rr(c, -5, -11, 10, 11, 3); c.fill(); c.strokeStyle = '#3a2a1e'; c.lineWidth = 1.2; c.stroke(); c.fillStyle = '#fff8e0'; c.fillRect(-1.5, -8, 3, 5); c.fillStyle = '#3a2a1e'; c.fillRect(-6, -13, 12, 3); c.fillRect(-6, -1, 12, 2); for (let i = 0; i < t.lv; i++) { c.fillStyle = '#ffd24a'; c.fillRect(-5 + i * 6, 12, 4, 2); } }
    else if (t.k === 'beacon') { c.fillStyle = '#5a6475'; c.beginPath(); c.moveTo(-7, 10); c.lineTo(7, 10); c.lineTo(3, -8); c.lineTo(-3, -8); c.fill(); c.fillStyle = '#bfe6ff'; c.beginPath(); c.arc(0, -11, 5, 0, TAU); c.fill(); for (let i = 0; i < t.lv; i++) { c.fillStyle = '#ffd24a'; c.fillRect(-5 + i * 6, 12, 4, 2); } }
    else if (t.k === 'bramble') { c.strokeStyle = '#4f8a45'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.05; c.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); c.lineTo(Math.cos(a + .4) * 12, Math.sin(a + .4) * 12); } c.stroke(); }
    else { c.fillStyle = '#ff6b3d'; c.fillRect(-3, -8, 6, 14); c.fillStyle = '#ffd24a'; c.fillRect(-3, -8, 6, 3); c.fillStyle = Math.floor(now / 250) % 2 ? '#fff' : '#ff3d3d'; c.fillRect(-1, -11, 2, 3); }
  }
  const previews = {};
  function cosPreview(kind, it) {
    const key = kind + ':' + it.id; if (previews[key]) return previews[key];
    const c = document.createElement('canvas'); c.width = c.height = 144; const x = c.getContext('2d'); x.fillStyle = '#1c1410'; x.fillRect(0, 0, 144, 144);
    const rgb = kind === 'fire' ? (it.c === 'cycle' ? ['255,120,220', '120,220,255'] : it.c) : [it.c, it.c];
    const g = x.createRadialGradient(72, 80, 4, 72, 80, 64); g.addColorStop(0, `rgba(${rgb[0]},.7)`); g.addColorStop(1, `rgba(${rgb[0]},0)`); x.fillStyle = g; x.fillRect(0, 0, 144, 144);
    x.translate(72, 84); x.scale(3.2, 3.2);
    if (kind === 'fire') { x.fillStyle = '#3a2a1e'; x.fillRect(-9, 4, 18, 3); x.fillStyle = `rgb(${rgb[1]})`; x.beginPath(); x.moveTo(-7, 4); x.quadraticCurveTo(-8, -6, 0, -14); x.quadraticCurveTo(8, -6, 7, 4); x.fill(); x.fillStyle = `rgb(${rgb[0]})`; x.beginPath(); x.moveTo(-4, 4); x.quadraticCurveTo(-4, -3, 0, -8); x.quadraticCurveTo(4, -3, 4, 4); x.fill(); }
    else drawTower(x, { k: 'lantern', lv: 0 }, it, 0);
    return (previews[key] = c.toDataURL('image/png'));
  }
  const clearPreviews = () => { for (const k in previews) delete previews[k]; };

  function drawGame(now) {
    const k = dpr * SC, F = '"Bungee",Impact,sans-serif', M = '"DM Mono",monospace', playing = !G.demo, lamp = cosItem('lamp', D.eq.lamp), fid = cosItem('fire', D.eq.fire).id, fc = fireCols(now);
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.save();
    if (G.shake > 0 && save.settings.shake && !reduceMotion) ctx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);
    ctx.fillStyle = '#0c0907'; ctx.fillRect(-20, -20, LW + 40, LH + 40);
    ctx.fillStyle = 'rgba(255,255,255,.025)'; for (let i = 0; i < 60; i++) ctx.fillRect((i * 97) % LW, (i * 211) % FIELD_B, 2, 2);
    // pools of light
    ctx.globalCompositeOperation = 'lighter';
    const flick = reduceMotion ? 1 : 1 + Math.sin(now / 90) * .04 + Math.sin(now / 37) * .02, fr = (70 + 60 * G.fire / G.fireMax) * flick;
    glow('fire-' + fid, FX, FY, fr * 1.5);
    for (const t of G.towers) { if (t.k === 'lantern') { ctx.globalAlpha = t.dim ? .35 : 1; glow('lamp-' + lamp.id, t.x, t.y, lanternR(t) * 1.25); } else if (t.k === 'beacon' && t.tgt) { ctx.globalAlpha = 1; ctx.strokeStyle = `rgba(190,230,255,${t.dim ? .3 : .75})`; ctx.lineWidth = 2 + t.lv; ctx.beginPath(); ctx.moveTo(t.x, t.y - 11); ctx.lineTo(t.tgt.x, t.tgt.y); ctx.stroke(); glow('beam', t.tgt.x, t.tgt.y, 16); } }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (const t of G.towers) {
      if (t.k === 'bramble') { ctx.fillStyle = 'rgba(79,138,69,.12)'; ctx.beginPath(); ctx.arc(t.x, t.y, 44, 0, TAU); ctx.fill(); }
      if (t.show > 0 || (G.hover && Math.hypot(G.hover.x - t.x, G.hover.y - t.y) < 20)) { const r = t.k === 'lantern' ? lanternR(t) : t.k === 'beacon' ? beaconR(t) : t.k === 'bramble' ? 44 : 66; ctx.strokeStyle = 'rgba(255,224,168,.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      ctx.save(); ctx.translate(t.x, t.y); drawTower(ctx, t, lamp, now); ctx.restore();
      if (playing && (t.k === 'lantern' || t.k === 'beacon') && t.lv < 2) { const cost = BUILD.find(b => b.k === t.k).up[t.lv]; if (G.embers >= cost) { ctx.font = '7px ' + M; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd24a'; ctx.fillText('▲' + cost, t.x, t.y + 24); } }
    }
    // the fire
    ctx.fillStyle = '#3a2a1e'; ctx.fillRect(FX - 13, FY + 6, 26, 4); ctx.fillRect(FX - 9, FY + 2, 18, 4);
    const fh = (10 + 12 * G.fire / G.fireMax) * flick;
    ctx.fillStyle = `rgb(${fc[1]})`; ctx.beginPath(); ctx.moveTo(FX - 9, FY + 5); ctx.quadraticCurveTo(FX - 11, FY - fh * .6, FX + Math.sin(now / 130) * 2, FY - fh * 1.4); ctx.quadraticCurveTo(FX + 11, FY - fh * .6, FX + 9, FY + 5); ctx.fill();
    ctx.fillStyle = `rgb(${fc[0]})`; ctx.beginPath(); ctx.moveTo(FX - 5, FY + 5); ctx.quadraticCurveTo(FX - 6, FY - fh * .3, FX, FY - fh * .8); ctx.quadraticCurveTo(FX + 6, FY - fh * .3, FX + 5, FY + 5); ctx.fill();
    // shades
    for (const e of G.foes) {
      const wob = Math.sin(now / 160 + e.wob) * 1.5;
      if (e.k === 'eclipse') { ctx.fillStyle = 'rgba(10,6,20,.45)'; ctx.beginPath(); ctx.arc(e.x, e.y, 95, 0, TAU); ctx.fill(); }
      ctx.fillStyle = e.hit > 0 ? '#8a6bff' : e.k === 'wisp' ? '#3b6f8a' : e.k === 'brute' ? '#2a1838' : e.k === 'eclipse' ? '#05030a' : '#241436';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + wob * .3, e.r, e.r * (e.k === 'runner' ? 1.25 : 1.05), 0, 0, TAU); ctx.fill();
      if (e.k === 'eclipse') { ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = e.k === 'wisp' ? '#bff3ff' : '#ff5a5a'; const ex = e.r * .35; ctx.fillRect(e.x - ex - 1, e.y - 2, 2, 2); ctx.fillRect(e.x + ex - 1, e.y - 2, 2, 2);
      if (e.hp < e.max) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2, 2.5); ctx.fillStyle = '#ff6b6b'; ctx.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2 * Math.max(0, e.hp / e.max), 2.5); }
    }
    for (let i = 0; i < pn; i++) { const p = parts[i]; ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    ctx.globalAlpha = 1;
    // placement preview for a mouse
    if (playing && G.hover && G.hover.y < FIELD_B - 8 && gstate === 'run') { const b = BUILD[G.sel], r = b.k === 'lantern' ? 64 * reachMul() : b.k === 'beacon' ? 150 * reachMul() : b.k === 'bramble' ? 44 : 66; ctx.strokeStyle = G.embers >= b.cost ? 'rgba(255,224,168,.5)' : 'rgba(255,107,107,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(G.hover.x, G.hover.y, r, 0, TAU); ctx.stroke(); }
    // the dark closes in at the edges
    const vg = ctx.createRadialGradient(FX, FY, 120, FX, FY, Math.max(LW, FIELD_B) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = vg; ctx.fillRect(-20, -20, LW + 40, LH + 40);
    if (G.dawn > 0) { ctx.fillStyle = `rgba(255,190,120,${Math.sin(Math.PI * G.dawn / 200) * .35})`; ctx.fillRect(0, 0, LW, LH); }
    ctx.restore();
    if (!playing) return;
    ctx.textAlign = 'center'; for (const f of G.floats) { ctx.font = '10px ' + F; ctx.globalAlpha = Math.min(1, f.life / 16); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(f.text, f.x + 1, f.y + 1); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); } ctx.globalAlpha = 1;
    if (G.flash > 0) { ctx.fillStyle = `rgba(255,224,168,${G.flash * .3})`; ctx.fillRect(0, 0, LW, LH); }
    // HUD
    ctx.textAlign = 'left'; ctx.font = '20px ' + F; ctx.fillStyle = '#f1eeff'; ctx.fillText(fmt(G.score), 12, 28);
    ctx.font = '9px ' + M; ctx.fillStyle = '#d8c3ae'; ctx.fillText(`NIGHT ${G.night} · WAVE ${G.wave}${G.phase === 'wave' ? ` · ${G.foes.length + G.queue.length} LEFT` : ''}`, 12, 42);
    const sb = speedBox(); ctx.fillStyle = G.speed === 2 ? '#ffb347' : 'rgba(255,255,255,.1)'; rr(ctx, sb.x, sb.y, sb.w, sb.h, 8); ctx.fill(); ctx.font = '10px ' + F; ctx.textAlign = 'center'; ctx.fillStyle = G.speed === 2 ? '#3a1d00' : '#d8c3ae'; ctx.fillText(G.speed === 2 ? '▶▶ 2X' : '▶ 1X', sb.x + sb.w / 2, sb.y + 17);
    ctx.textAlign = 'right'; ctx.font = '18px ' + F; ctx.fillStyle = '#ffb347'; ctx.fillText(fmt(G.embers), LW - 62, 28); ctx.font = '8px ' + M; ctx.fillStyle = '#d8c3ae'; ctx.fillText('EMBERS', LW - 62, 40);
    const bw = 120, hp = G.fire / G.fireMax; ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, FX - bw / 2, FY + 18, bw, 7, 3); ctx.fill(); ctx.fillStyle = hp > .5 ? '#ffb347' : hp > .25 ? '#ff7a3d' : '#ff3d3d'; rr(ctx, FX - bw / 2, FY + 18, bw * hp, 7, 3); ctx.fill();
    ctx.font = '8px ' + M; ctx.textAlign = 'center'; ctx.fillStyle = '#d8c3ae'; ctx.fillText(`FIRE ${Math.ceil(G.fire)}`, FX, FY + 36);
    if (G.phase === 'break' && gstate === 'run') { const b = callBox(), secs = Math.ceil(G.timer / 60); ctx.fillStyle = '#ffb347'; rr(ctx, b.x, b.y, b.w, b.h, 15); ctx.fill(); ctx.font = '10px ' + F; ctx.fillStyle = '#3a1d00'; ctx.fillText(G.wave ? `CALL WAVE ${G.wave + 1} · +${Math.floor(G.timer / 60) * 2}` : `START · ${secs}`, LW / 2, b.y + 19); ctx.font = '8px ' + M; ctx.fillStyle = '#d8c3ae'; ctx.fillText(`next wave in ${secs} s`, LW / 2, b.y + 42); }
    if (G.banner > 0) { ctx.globalAlpha = Math.min(1, G.banner / 30); ctx.font = '26px ' + F; ctx.fillStyle = G.bannerText === 'SUNRISE' ? '#ffd24a' : '#ffb347'; ctx.fillText(G.bannerText, LW / 2, FIELD_B * .22); ctx.globalAlpha = 1; }
    if (gstate === 'ending') { ctx.fillStyle = `rgba(0,0,0,${(1 - G.over / 100) * .7})`; ctx.fillRect(0, 0, LW, LH); ctx.font = '24px ' + F; ctx.fillStyle = '#d8c3ae'; ctx.fillText('THE FIRE WENT OUT', LW / 2, FIELD_B * .3); }
    const tt = G.toasts[0];
    if (tt && tt.ach) { ctx.font = '9px ' + F; const label = '★ ' + tt.ach.n.toUpperCase(), w = ctx.measureText(label).width + 20; ctx.globalAlpha = Math.min(.92, tt.life / 20); ctx.fillStyle = 'rgba(12,9,7,.9)'; rr(ctx, LW - 10 - w, 48, w, 20, 10); ctx.fill(); ctx.strokeStyle = TIERS[tt.ach.tier].c; ctx.lineWidth = 1; ctx.stroke(); ctx.textAlign = 'right'; ctx.fillStyle = '#f1eeff'; ctx.fillText(label, LW - 20, 62); ctx.globalAlpha = 1; ctx.textAlign = 'center'; }
    else if (tt) { ctx.globalAlpha = Math.min(1, tt.life / 25); ctx.font = '9px ' + F; const w = Math.min(LW - 16, ctx.measureText(tt.text).width + 24), y = FIELD_B - 22; ctx.fillStyle = 'rgba(12,9,7,.88)'; rr(ctx, LW / 2 - w / 2, y - 15, w, 22, 11); ctx.fill(); ctx.strokeStyle = tt.c; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = tt.c; ctx.fillText(tt.text, LW / 2, y); ctx.globalAlpha = 1; }
    // build bar
    ctx.fillStyle = '#1c1410'; ctx.fillRect(0, FIELD_B, LW, BAR_H); const sw = LW / BUILD.length;
    BUILD.forEach((b, i) => {
      const x = i * sw, on = i === G.sel, can = G.embers >= b.cost;
      ctx.fillStyle = on ? '#3a2616' : '#241a14'; rr(ctx, x + 4, FIELD_B + 6, sw - 8, BAR_H - 12, 10); ctx.fill(); if (on) { ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.save(); ctx.translate(x + 22, FIELD_B + 34); ctx.globalAlpha = can ? 1 : .4; drawTower(ctx, { k: b.k, lv: 0 }, lamp, now); ctx.restore(); ctx.globalAlpha = 1;
      ctx.textAlign = 'left'; ctx.font = '9px ' + F; ctx.fillStyle = can ? '#f1eeff' : '#7a6a5e'; ctx.fillText(b.n.toUpperCase(), x + 38, FIELD_B + 26); ctx.font = '8px ' + M; ctx.fillStyle = can ? '#ffb347' : '#7a6a5e'; ctx.fillText(b.cost + ' · ' + b.d, x + 38, FIELD_B + 39);
      if (!usedTouch) { ctx.fillStyle = '#7a6a5e'; ctx.fillText('key ' + keyFor(b.k), x + 38, FIELD_B + 51); }
    });
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || !G) { lastFrame = now; return; }
    const dtMs = Math.min(100, now - lastFrame); lastFrame = now; frameNo++;
    if (gstate === 'run' || gstate === 'ending') { acc += dtMs * (G.speed || 1); let n = 0; while (acc >= 1000 / 60 && n++ < 8) { acc -= 1000 / 60; step(); if (gstate !== 'run' && gstate !== 'ending') break; } if (n >= 8) acc = 0; if (gstate === 'run' || gstate === 'ending') drawGame(now); }
    else if (gstate === 'idle') { if (frameNo % 2) return; step(); drawGame(now); }
  }

  /* ---------- boot ---------- */
  addEventListener('resize', () => { resize(); if (G && gstate !== 'run' && gstate !== 'ending') drawGame(performance.now()); });
  fixEquipped(); resize(); newGame('free', true); syncWallet();
  for (let i = 0; i < 900; i++) step();
  show('home'); lastFrame = performance.now(); requestAnimationFrame(frame); onlineBoot();
  if (DEV) window.NW = { get G() { return G; }, get save() { return save; }, get state() { return gstate; }, startRun, step, show, tryPlace, callWave, earn, persist, BUILD };
