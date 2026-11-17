  /* ================= NIGHT MARKET: the game ================= */
  // Every stall's price is worked out every second and a half from a seeded generator and never depends on what the player
  // does, so the Daily Market has the same prices and rumors for everyone. Logic runs at a fixed 60 steps a second.
  const LW = 400, NIGHT = 60 * 60, TICK = 90, DAWN = 170, HIST = 36, TOPY = 100, FOOT = 74;
  let SC = 1, LH = 600, ROWH = 52;
  resizeHooks.push(() => { SC = W / LW; LH = H / SC; ROWH = clamp(Math.floor((LH - TOPY - FOOT) / GOODS.length), 30, 60); });
  let G = null, hold = null;
  const keysDown = {};

  /* ---------- the stall ---------- */
  const cap = () => 10 + 2 * up('cart');
  const fee = () => .06 - .01 * up('tongue');
  const lead = () => (3 + up('ears')) * 60;
  const rentFor = n => Math.max(5, Math.round(RENT0 * Math.pow(RENTG, n - 1) * (1 - .05 * up('landlord')) / 5) * 5);
  const held = () => G.px.reduce((n, g) => n + g.q, 0);
  const sellPrice = g => Math.max(1, Math.floor(g.p * (1 - fee())));
  const worth = () => G.silver + G.px.reduce((n, g) => n + g.q * sellPrice(g), 0);
  const isOpen = i => GOODS[i].from <= G.night;
  const eventOn = i => G.evs.find(e => e.i === i && G.nt >= e.at && G.nt < e.at + e.len);

  /* ---------- prices ---------- */
  function rollMood(g) { g.moodT = 5 + Math.floor(G.rand() * 8); g.mood = Math.exp((G.rand() + G.rand() - 1) * .5); }
  function tickPrices() {
    G.px.forEach((g, i) => {
      const it = GOODS[i], e = eventOn(i);
      if (--g.moodT <= 0) rollMood(g);
      g.f += (it.p * (e ? e.m : g.mood) - g.f) * (e ? .4 : .12) + g.f * .03 * (G.rand() + G.rand() - 1);
      g.f = clamp(g.f, it.p * .3, it.p * 3.2); g.p = Math.max(1, Math.round(g.f));
      g.hist.push(g.p); if (g.hist.length > HIST) g.hist.shift();
    });
  }
  // Two or three rumors a night, each about a different stall: a boom or a crash that lasts ten seconds.
  function planNight() {
    const open = GOODS.map((_, i) => i).filter(isOpen), n = Math.min(open.length, G.night > 3 ? 3 : 2), from = 8 * 60, span = (NIGHT - 18 * 60) / n;
    G.evs = [];
    for (let k = 0; k < n; k++) {
      const i = open.splice(Math.floor(G.rand() * open.length), 1)[0], boom = G.rand() < .6;
      G.evs.push({ i, boom, at: Math.round(from + span * (k + G.rand() * .6)), len: 10 * 60, m: boom ? 1.9 + G.rand() * .7 : .38 + G.rand() * .14, told: false, hit: false, cashed: false });
    }
  }
  function newGame(mode, demo) {
    rollDay();
    const start = 100 + 50 * up('purse');
    G = { mode, demo: !!demo, rand: seeded(mode === 'daily' && !demo ? 'nightmarket-' + dayKey : 'nm' + Math.random()), t: 0, nt: 0, night: demo ? 99 : 1, phase: 'trade', dawnT: 0, dawn: null,
      silver: start, start, paid: 0, score: 0, sel: 0, due: 0, over: 0, st: blankStats(), floats: [], toasts: [], news: null, flash: 0, shake: 0, newAch: [], newMis: [], hint: 0, evs: [],
      px: GOODS.map(it => ({ f: it.p, p: it.p, mood: 1, moodT: 0, q: 0, cost: 0, hist: [] })) };
    for (let i = 0; i < HIST; i++) tickPrices();
    planNight(); hold = null;
    return G;
  }
  const float = (x, y, text, c) => { if (!G.demo) { if (G.floats.length > 10) G.floats.shift(); G.floats.push({ x, y, text, c, life: 50 }); } };
  const say = (text, c = '#ffe9b0', life = 170) => { if (!G.demo) { G.toasts = G.toasts.filter(t => t.ach); G.toasts.push({ text, c, life }); } };

  /* ---------- buying and selling ---------- */
  const rowY = i => TOPY + i * ROWH;
  const sellBox = i => ({ x: 226, y: rowY(i) + 2, w: 80, h: ROWH - 8 });
  const buyBox = i => ({ x: 312, y: rowY(i) + 2, w: 80, h: ROWH - 8 });
  let lastDeny = 0;
  function deny(text) { if (G.t - lastDeny > 40) { lastDeny = G.t; sfx.deny(); if (text) say(text, '#ff9aa8', 90); } return false; }
  function sellOne(i, quiet) {
    const g = G.px[i]; if (g.q < 1) return false;
    const v = sellPrice(g), avg = g.cost / g.q, gain = v - avg, S = G.st, e = eventOn(i);
    G.silver += v; g.cost -= avg; g.q--; if (!g.q) g.cost = 0;
    if (gain > 0) { S.sold++; S.big = Math.max(S.big, Math.round(gain)); if (e && e.boom && !e.cashed) { e.cashed = true; S.tips++; if (!quiet) say('BOOM CASHED IN', '#ffd24a', 110); } }
    if (!quiet) { const b = sellBox(i); float(b.x + b.w / 2, b.y, (gain >= 0 ? '+' : '-') + fmt(Math.abs(Math.round(gain))), gain >= 0 ? '#ffd24a' : '#ff7a8a'); if (gain > 0) tone(880 + Math.min(600, gain * 4), .07, 'triangle', .045); else tone(260, .08, 'sine', .05, -60); }
    return true;
  }
  function trade(i, act) {
    if (gstate !== 'run' || !G || G.demo || G.phase !== 'trade' || !isOpen(i)) return false;
    const g = G.px[i]; G.sel = i;
    if (act === 'sell') return sellOne(i) || deny();
    if (act === 'dump') { if (!g.q) return deny(); let n = 0; while (g.q && n++ < 40) sellOne(i); return true; }
    if (held() >= cap()) return deny('THE CART IS FULL');
    if (G.silver < g.p) return deny('NOT ENOUGH SILVER');
    G.silver -= g.p; g.q++; g.cost += g.p; tone(520 + i * 40, .05, 'triangle', .04); buzz(8);
    return true;
  }

  /* ---------- dawn ---------- */
  function dawn() {
    const rent = rentFor(G.night), S = G.st; let forced = 0; hold = null;
    while (G.silver < rent) { // crates are sold off to cover the rent, dearest first
      let best = -1; G.px.forEach((g, i) => { if (g.q && (best < 0 || sellPrice(g) > sellPrice(G.px[best]))) best = i; });
      if (best < 0) break; sellOne(best, true); forced++;
    }
    if (G.silver < rent) { G.due = rent; G.score = Math.max(0, G.paid + worth() - G.start); gstate = 'ending'; G.over = 110; G.flash = 1; G.shake = 12; musicStop(); pauseBtn.hidden = true; buzz([40, 30, 80]); noise(.5, .16, 600, 'lowpass'); chime([660, 494, 330], 'square', .05, .16); return; }
    G.silver -= rent; G.paid += rent; S.nights = G.night; G.phase = 'dawn'; G.dawnT = DAWN; G.dawn = { rent, forced }; G.news = null; G.flash = .5; chime([523, 659, 784, 1046]);
  }
  function nextNight() {
    G.night++; G.nt = 0; G.phase = 'trade'; G.dawn = null;
    G.px.forEach((g, i) => { rollMood(g); g.f += (GOODS[i].p * g.mood - g.f) * .6; g.p = Math.max(1, Math.round(g.f)); g.hist.push(g.p); if (g.hist.length > HIST) g.hist.shift(); }); // prices move overnight
    planNight();
    const fresh = GOODS.find(it => it.from === G.night);
    say(fresh ? `${fresh.n.toUpperCase()} ${fresh.n.endsWith('s') ? 'HAVE' : 'HAS'} ARRIVED AT THE MARKET` : `NIGHT ${G.night} · RENT IS ${fmt(rentFor(G.night))} AT DAWN`, fresh ? fresh.c : '#ffe9b0', 200);
  }

  function step() {
    const S = G.st;
    G.t++; G.shake *= .9; if (G.shake < .2) G.shake = 0; G.flash = Math.max(0, G.flash - .03);
    for (const f of G.floats) { f.y -= .5; f.life--; } if (G.floats.length && G.floats[0].life <= 0) G.floats.shift();
    if (G.toasts.length && --G.toasts[0].life <= 0) G.toasts.shift();
    if (gstate === 'ending') { if (--G.over <= 0) finish(); return; }
    if (G.phase === 'dawn') { if (--G.dawnT <= 0) nextNight(); return; }
    G.nt++;
    if (G.nt % TICK === 0) tickPrices();
    for (const e of G.evs) {
      const it = GOODS[e.i];
      if (!e.told && G.nt >= e.at - lead()) { e.told = true; G.news = { i: e.i, c: e.boom ? '#ffd24a' : '#ff7a8a', text: `RUMOR · ${it.n.toUpperCase()} ABOUT TO ${e.boom ? 'SOAR' : 'CRASH'}`, until: e.at + e.len }; if (!G.demo) { tone(988, .07, 'square', .04); tone(1318, .1, 'square', .04, 0, .09); buzz(15); } }
      if (!e.hit && G.nt >= e.at) { e.hit = true; G.news = { i: e.i, c: e.boom ? '#ffd24a' : '#ff7a8a', text: `${it.n.toUpperCase()} ${it.n.endsWith('s') ? 'ARE' : 'IS'} ${e.boom ? 'SOARING · SELL HIGH' : 'CRASHING · BUY LOW'}`, until: e.at + e.len }; }
    }
    if (G.news && G.nt >= G.news.until) G.news = null;
    if (G.demo) { if (G.nt >= NIGHT) { G.nt = 0; planNight(); } return; }
    if (hold && ++hold.t > 22 && hold.t % 6 === 0) { if (!trade(hold.i, hold.act)) hold = null; }
    if (G.nt >= NIGHT) return dawn();
    if (G.nt === NIGHT - 10 * 60) { const r = rentFor(G.night); if (G.silver < r) say(worth() >= r ? 'DAWN IS CLOSE · SELL TO COVER THE RENT' : 'DAWN IS CLOSE AND THE RENT IS NOT COVERED', '#ff9aa8', 200); }
    G.score = Math.max(0, G.paid + worth() - G.start);
    S.score = Math.floor(G.score); if (G.mode === 'daily') S.daily = S.score;
    music.intensity = Math.min(5, 1 + Math.floor(G.night / 3) + (G.nt > NIGHT * .75 ? 1 : 0)); music.tense = G.nt > NIGHT * .6 && G.silver < rentFor(G.night);
    if (G.t % 30 === 0) { const a = checkAch(S), ms = missionTick(S, false); for (const x of a) { G.newAch.push(x); G.toasts.push({ ach: x, life: 110 }); chime([523, 659, 784], 'triangle', .05); } for (const x of ms) { G.newMis.push(x); say(`JOB DONE · +${x.pay} COINS`, '#5cf2b0'); } if (a.length || ms.length) saveLocal(); }
    if (!D.tut) { const H0 = [[50, 'BUY WHEN A PRICE DIPS UNDER ITS DASHED LINE'], [480, 'SELL WHEN IT CLIMBS BACK OVER THE LINE'], [960, 'KEEP ENOUGH SILVER FOR THE RENT AT DAWN']]; if (G.hint < H0.length && G.t >= H0[G.hint][0]) { say(H0[G.hint][1], '#ffe9b0', 260); if (++G.hint === H0.length) D.tut = true; } }
  }

  let acc = 0, lastFrame = 0, frameNo = 0;
  function startRun(mode) {
    if (GAME.modes.some(m => m.id === mode)) D.mode = mode; else mode = D.mode;
    initAudio(); newGame(mode); armRun(mode); gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; $('top').hidden = true; resize();
    say(mode === 'daily' ? `DAILY MARKET · ${dayLabel.toUpperCase()} · RENT IS ${fmt(rentFor(1))} AT DAWN` : `NIGHT 1 · RENT IS ${fmt(rentFor(1))} AT DAWN`, '#ffe9b0', D.tut ? 170 : 45);
    chime([392, 523]); music.intensity = 1; music.tense = false; musicStart(); acc = 0; lastFrame = performance.now();
  }
  function pauseRun() { if (gstate !== 'run') return; gstate = 'paused'; musicStop(); pauseBtn.hidden = true; hold = null; show('pause'); }
  function resumeRun() { if (gstate !== 'paused') return; initAudio(); gstate = 'run'; overlay.hidden = true; pauseBtn.hidden = false; musicStart(); acc = 0; lastFrame = performance.now(); }
  const logData = end => ({ end, m: G.night - 1, z: Math.min(20, G.night - 1), night: G.night, nt: Math.round(G.nt / 60), silver: Math.floor(G.silver), worth: Math.floor(worth()), rent: rentFor(G.night), held: held(), cap: cap(), sold: G.st.sold, tips: G.st.tips });
  const logMeta = () => ({ mode: G.mode, s: Math.floor(G.score), t: Math.round(G.t / 60), n: D.life.runs });
  function restartRun() { if (gstate !== 'run' && gstate !== 'paused') return; if (G.t > 600) logRun(Object.assign(logMeta(), logData('restart'))); musicStop(true); startRun(G.mode); }
  function leaveRun() { if ((gstate === 'run' || gstate === 'paused') && G.t > 600) logRun(Object.assign(logMeta(), logData('quit'))); musicStop(); gstate = 'idle'; $('top').hidden = false; pauseBtn.hidden = true; resize(); newGame('free', true); }
  function finish() {
    const S = G.st, n = G.night - 1;
    endRun({ mode: G.mode, score: G.score, stats: S, secs: G.t / 60, coins: Math.sqrt(G.score) * .9 + n * 5, xp: Math.sqrt(G.score) * 3 + n * 14, title: 'Stall closed', ach: G.newAch, mis: G.newMis,
      line: `The rent on <b>night ${G.night}</b> was ${fmt(G.due)} silver and the purse only had ${fmt(G.silver)}. You paid for ${n} dawn${n === 1 ? '' : 's'}${G.mode === 'daily' ? ' at the Daily Market' : ''}.`,
      rows: [['Dawns paid for', n], ['Rent paid', fmt(G.paid)], ['Crates sold at a profit', S.sold], ['Best profit on one crate', fmt(S.big)], ['Booms cashed in', S.tips]], note: n + ' night' + (n === 1 ? '' : 's'), meta: { nights: n },
      log: logData('rent') });
  }

  /* ---------- input ---------- */
  const inBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') usedTouch = true;
    initAudio(); if (gstate !== 'run') return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / SC, y = (e.clientY - r.top) / SC, i = Math.floor((y - TOPY) / ROWH);
    if (i < 0 || i >= GOODS.length || !isOpen(i)) return;
    const act = inBox(buyBox(i), x, y) ? 'buy' : inBox(sellBox(i), x, y) ? 'sell' : '';
    G.sel = i; if (!act) return;
    if (trade(i, act)) hold = { id: e.pointerId, i, act, t: 0 };
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  });
  for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, e => { if (hold && e.pointerId === hold.id) hold = null; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  function moveSel(d) { const n = GOODS.length; let i = G.sel; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (isOpen(i)) break; } G.sel = i; tone(700, .03, 'triangle', .02); }
  addEventListener('keydown', e => {
    if (capturing || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) || e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code || e.key || '';
    if (gstate === 'run') {
      if (KEY_ACTIONS.some(([a]) => bound(a, c))) { e.preventDefault(); usedTouch = false; }
      if (bound('up', c)) moveSel(-1); else if (bound('down', c)) moveSel(1);
      else if (bound('buy', c)) trade(G.sel, 'buy'); else if (bound('sell', c)) trade(G.sel, 'sell');
      else if (bound('dump', c) && !e.repeat) trade(G.sel, 'dump');
      else if (bound('pause', c)) pauseRun();
    }
    else if (gstate === 'paused' && view === 'pause' && bound('pause', c)) { e.preventDefault(); resumeRun(); }
    else if ((view === 'over' || view === 'home') && c === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); startRun(); }
  });
  addEventListener('blur', () => { hold = null; });

  /* ---------- drawing ---------- */
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function drawLantern(c, it, s) {
    const tall = it.sh === 'tall', box = it.sh === 'box', w = (tall ? 7 : 10) * s, h = (tall ? 13 : box ? 10 : 9) * s;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 22 * s); g.addColorStop(0, it.c + '66'); g.addColorStop(1, it.c + '00'); c.fillStyle = g; c.fillRect(-22 * s, -22 * s, 44 * s, 44 * s);
    c.strokeStyle = it.c2; c.lineWidth = 1.2 * s; c.beginPath(); c.moveTo(0, -h - 6 * s); c.lineTo(0, -h); c.stroke();
    c.fillStyle = it.c; if (box) { rr(c, -w, -h, w * 2, h * 2, 2 * s); c.fill(); } else { c.beginPath(); c.ellipse(0, 0, w, h, 0, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-w * .35, -h * .25, w * .25, h * .5, 0, 0, TAU); c.fill();
    c.strokeStyle = it.c2; c.lineWidth = s; c.globalAlpha *= .6; for (const k of [-.5, 0, .5]) { c.beginPath(); c.moveTo(w * k, -h * .9); c.lineTo(w * k, h * .9); c.stroke(); } c.globalAlpha /= .6;
    c.fillStyle = it.c2; c.fillRect(-w * .6, -h - 1.5 * s, w * 1.2, 3 * s); c.fillRect(-w * .6, h - 1.5 * s, w * 1.2, 3 * s);
    c.fillRect(-.8 * s, h + 1.5 * s, 1.6 * s, 6 * s);
  }
  const previews = {};
  function cosPreview(kind, it) { if (previews[it.id]) return previews[it.id]; const c = document.createElement('canvas'); c.width = c.height = 144; const x = c.getContext('2d'); x.fillStyle = '#1c1022'; x.fillRect(0, 0, 144, 144); x.fillStyle = '#27162d'; x.fillRect(0, 104, 144, 40); x.translate(72, 70); drawLantern(x, it, 3.6); return (previews[it.id] = c.toDataURL('image/png')); }
  const clearPreviews = () => { for (const k in previews) delete previews[k]; };
  function drawGood(c, it, x, y, s) { // a little picture for each stall
    c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = it.c; c.strokeStyle = it.c; c.lineWidth = 2.4;
    switch (it.id) {
      case 'tea': c.beginPath(); c.ellipse(0, 0, 11, 5.5, -.6, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-7, 5); c.lineTo(7, -5); c.stroke(); break;
      case 'spice': c.beginPath(); c.moveTo(-11, 8); c.quadraticCurveTo(0, -16, 11, 8); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-2, -3, 2, 2); c.fillRect(3, 2, 2, 2); c.fillRect(-5, 3, 2, 2); break;
      case 'lamp': c.beginPath(); c.ellipse(0, 0, 8, 9, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-5, -11, 10, 3); c.fillRect(-5, 8, 10, 3); break;
      case 'silk': for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(-11, k * 6); c.bezierCurveTo(-4, k * 6 - 6, 4, k * 6 + 6, 11, k * 6); c.stroke(); } break;
      case 'jade': c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.stroke(); break;
      case 'pearl': c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(-3, -3, 2.6, 0, TAU); c.fill(); break;
      case 'glass': c.beginPath(); for (let k = 0; k < 8; k++) { const a = k * TAU / 8 - Math.PI / 2, r = k % 2 ? 4 : 12; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); break;
      default: c.beginPath(); c.ellipse(0, 1, 8, 11, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(-2, -3, 2, 0, TAU); c.arc(3, 3, 2.4, 0, TAU); c.fill();
    }
    c.restore();
  }

  function drawGame(now) {
    const k = dpr * SC, F = '"Bungee",Impact,sans-serif', M = '"DM Mono",monospace', playing = !G.demo, lamp = cosItem('lantern', D.eq.lantern);
    const rent = rentFor(G.night), w$ = worth(), dawnF = G.phase === 'dawn' || gstate === 'ending' ? 1 : clamp((G.nt / NIGHT - .7) / .3, 0, 1), full = playing && held() >= cap();
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.save();
    if (G.shake > 0 && save.settings.shake && !reduceMotion) ctx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);
    ctx.fillStyle = '#0e0812'; ctx.fillRect(-20, -20, LW + 40, LH + 40);
    if (dawnF > 0) { const g = ctx.createLinearGradient(0, 0, 0, LH * .6); g.addColorStop(0, `rgba(255,150,90,${.3 * dawnF})`); g.addColorStop(1, 'rgba(255,150,90,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH * .6); }
    ctx.textBaseline = 'alphabetic';
    // the stalls
    GOODS.forEach((it, i) => {
      const g = G.px[i], y = rowY(i), h = ROWH - 4, mid = y + h / 2, open = isOpen(i), e = open && G.evs.find(v => v.i === i && v.told && G.nt < v.at + v.len);
      ctx.fillStyle = open ? '#1c1022' : '#150c19'; rr(ctx, 8, y, LW - 16, h, 8); ctx.fill();
      if (e) { ctx.strokeStyle = e.boom ? '#ffd24a' : '#ff7a8a'; ctx.lineWidth = 1.5; ctx.globalAlpha = reduceMotion ? .8 : .5 + .4 * Math.sin(now / 130); ctx.stroke(); ctx.globalAlpha = 1; }
      else if (playing && open && G.sel === i && !usedTouch) { ctx.strokeStyle = 'rgba(255,233,176,.55)'; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.globalAlpha = open ? 1 : .3; drawGood(ctx, it, 28, mid, Math.min(1, h / 40)); ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      if (!open) { ctx.font = '10px ' + F; ctx.fillStyle = '#6b5a76'; ctx.fillText(it.n.toUpperCase(), 48, mid - 1); ctx.font = '8px ' + M; ctx.fillText(`ARRIVES ON NIGHT ${it.from}`, 48, mid + 11); return; }
      const pct = Math.round((g.p / it.p - 1) * 100), cheap = pct <= -10, dear = pct >= 10;
      ctx.font = '11px ' + F; ctx.fillStyle = '#f6ecff'; ctx.fillText(it.n.toUpperCase(), 48, mid - 1);
      ctx.font = '8px ' + M; ctx.fillStyle = cheap ? '#5cf2b0' : dear ? '#ffb347' : '#a898b8'; ctx.fillText(pct === 0 ? 'USUAL PRICE' : `${Math.abs(pct)}% ${pct < 0 ? 'UNDER' : 'OVER'}`, 48, mid + 11);
      if (g.q) { ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(38, mid - 9, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#2b0f04'; ctx.font = '8px ' + F; ctx.textAlign = 'center'; ctx.fillText(g.q, 38, mid - 6); }
      // the chart: the dashed line is the usual price
      const cx = 134, cw = 84, top = y + 6, ch = h - 12, lo = Math.min(it.p * .8, ...g.hist), hi = Math.max(it.p * 1.25, ...g.hist), yy = v => top + ch - clamp((v - lo) / (hi - lo), 0, 1) * ch;
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, yy(it.p)); ctx.lineTo(cx + cw, yy(it.p)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = it.c; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.beginPath(); g.hist.forEach((v, n) => { const x = cx + cw * n / (HIST - 1); if (n) ctx.lineTo(x, yy(v)); else ctx.moveTo(x, yy(v)); }); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + cw * (g.hist.length - 1) / (HIST - 1), yy(g.p), 2.2, 0, TAU); ctx.fill();
      if (!playing) { ctx.textAlign = 'right'; ctx.font = '16px ' + F; ctx.fillStyle = cheap ? '#5cf2b0' : dear ? '#ffb347' : '#f6ecff'; ctx.fillText(fmt(g.p), LW - 22, mid + 6); return; }
      const sb = sellBox(i), bb = buyBox(i), sp = sellPrice(g), gain = g.q ? sp - g.cost / g.q : 0, canBuy = !full && G.silver >= g.p, small = sb.h < 30, big = small ? 12 : 14;
      const btn = (b, on, col, label, price) => {
        ctx.fillStyle = on ? col : 'rgba(255,255,255,.06)'; rr(ctx, b.x, b.y, b.w, b.h, 7); ctx.fill();
        if (hold && hold.i === i && ((hold.act === 'buy') === (b === bb))) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fill(); }
        ctx.textAlign = 'center'; ctx.fillStyle = on ? '#1c0a12' : '#6b5a76';
        if (small) { ctx.font = big + 'px ' + F; ctx.fillText(price, b.x + b.w / 2, b.y + b.h / 2 + 5); }
        else { ctx.font = '8px ' + M; ctx.fillText(label, b.x + b.w / 2, b.y + 11); ctx.font = big + 'px ' + F; ctx.fillText(price, b.x + b.w / 2, b.y + b.h - 6); }
      };
      btn(sb, g.q > 0, gain > 0 ? '#ffd24a' : '#b9a6c8', g.q ? `SELL ${gain >= 0 ? '+' : '-'}${fmt(Math.abs(Math.round(gain)))}` : 'SELL', fmt(sp));
      btn(bb, canBuy, cheap ? '#5cf2b0' : '#e6d6f2', 'BUY', fmt(g.p));
    });
    ctx.restore();
    if (!playing) return;
    ctx.textAlign = 'center'; for (const f of G.floats) { ctx.font = '11px ' + F; ctx.globalAlpha = Math.min(1, f.life / 16); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(f.text, f.x + 1, f.y + 1); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); } ctx.globalAlpha = 1;
    if (G.flash > 0) { ctx.fillStyle = gstate === 'ending' ? `rgba(255,60,80,${G.flash * .4})` : `rgba(255,220,150,${G.flash * .25})`; ctx.fillRect(0, 0, LW, LH); }
    // the purse, the night and the rent
    ctx.save(); ctx.translate(22, 26); drawLantern(ctx, lamp, 1.05); ctx.restore();
    ctx.textAlign = 'left'; ctx.font = '20px ' + F; ctx.fillStyle = '#ffe9b0'; ctx.fillText(fmt(G.silver), 40, 30);
    ctx.font = '8px ' + M; ctx.fillStyle = '#b8a6c6'; ctx.fillText(`SILVER · WORTH ${fmt(w$)}`, 40, 43);
    const covered = G.silver >= rent, left = Math.max(0, Math.ceil((NIGHT - G.nt) / 60));
    ctx.textAlign = 'right'; ctx.font = '13px ' + F; ctx.fillStyle = '#f6ecff'; ctx.fillText('NIGHT ' + G.night, LW - 12, 24);
    ctx.font = '8px ' + M; ctx.fillStyle = covered ? '#5cf2b0' : w$ >= rent ? '#ffb347' : '#ff7a8a'; ctx.fillText(`RENT ${fmt(rent)} · ${covered ? 'COVERED' : 'SHORT ' + fmt(rent - G.silver)}`, LW - 12, 37);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(ctx, 12, 51, LW - 24, 6, 3); ctx.fill();
    const nf = G.phase === 'dawn' ? 1 : G.nt / NIGHT, bar = ctx.createLinearGradient(12, 0, LW - 12, 0); bar.addColorStop(0, '#6a4aa8'); bar.addColorStop(.7, '#c04a8a'); bar.addColorStop(1, '#ffb347');
    ctx.fillStyle = bar; rr(ctx, 12, 51, Math.max(6, (LW - 24) * nf), 6, 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12 + (LW - 24) * nf, 54, 4, 0, TAU); ctx.fill();
    ctx.textAlign = 'center';
    if (G.news) { ctx.fillStyle = 'rgba(14,8,18,.9)'; rr(ctx, 12, 66, LW - 24, 26, 8); ctx.fill(); ctx.strokeStyle = G.news.c; ctx.lineWidth = 1; ctx.stroke(); ctx.font = '10px ' + F; ctx.fillStyle = G.news.c; ctx.fillText(G.news.text, LW / 2, 83); }
    else { ctx.font = '8px ' + M; ctx.fillStyle = left <= 10 ? '#ffb347' : '#8f7da0'; ctx.fillText(G.phase === 'dawn' ? 'THE SUN IS UP' : `${left} S UNTIL DAWN · NO RUMORS RIGHT NOW`, LW / 2, 82); }
    // the cart
    const n = cap(), have = held(), py = LH - 26, pw = Math.min(16, (LW - 112) / n - 3); let slot = 0;
    ctx.textAlign = 'left'; ctx.font = '9px ' + M; ctx.fillStyle = full ? '#ffb347' : '#b8a6c6'; ctx.fillText(`CART ${have}/${n}`, 12, py + 9);
    G.px.forEach((g, i) => { for (let q = 0; q < g.q && slot < n; q++, slot++) { ctx.fillStyle = GOODS[i].c; rr(ctx, 86 + slot * (pw + 3), py, pw, 11, 3); ctx.fill(); } });
    for (; slot < n; slot++) { ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(ctx, 86 + slot * (pw + 3), py, pw, 11, 3); ctx.fill(); }
    ctx.textAlign = 'right'; ctx.fillStyle = '#b8a6c6'; ctx.fillText(`EARNED ${fmt(G.score)}`, LW - 12, LH - 38);
    ctx.textAlign = 'center';
    if (G.phase === 'dawn' || gstate === 'ending') {
      const cy = TOPY + (LH - TOPY - FOOT) * .42, bad = gstate === 'ending';
      ctx.fillStyle = 'rgba(14,8,18,.78)'; ctx.fillRect(0, TOPY - 4, LW, LH - TOPY - FOOT + 8);
      ctx.font = '30px ' + F; ctx.fillStyle = bad ? '#ff5a6e' : '#ffb347'; ctx.fillText(bad ? 'STALL CLOSED' : 'DAWN', LW / 2, cy);
      ctx.font = '10px ' + M; ctx.fillStyle = '#f6ecff';
      if (bad) ctx.fillText(`RENT ${fmt(G.due)} · PURSE ${fmt(G.silver)}`, LW / 2, cy + 24);
      else { ctx.fillText(`RENT PAID · -${fmt(G.dawn.rent)} SILVER`, LW / 2, cy + 24); if (G.dawn.forced) { ctx.fillStyle = '#ff9aa8'; ctx.fillText(`${G.dawn.forced} CRATE${G.dawn.forced === 1 ? '' : 'S'} SOLD OFF TO COVER IT`, LW / 2, cy + 40); } ctx.fillStyle = '#b8a6c6'; ctx.fillText(`NEXT RENT ${fmt(rentFor(G.night + 1))}`, LW / 2, cy + (G.dawn.forced ? 56 : 40)); }
    }
    const tt = G.toasts[0];
    if (tt) { const label = tt.ach ? '★ ' + tt.ach.n.toUpperCase() : tt.text, c = tt.ach ? TIERS[tt.ach.tier].c : tt.c; ctx.globalAlpha = Math.min(1, tt.life / 22); ctx.font = '9px ' + F; const w = Math.min(LW - 16, ctx.measureText(label).width + 24), y = LH - 50; ctx.fillStyle = 'rgba(14,8,18,.94)'; rr(ctx, LW / 2 - w / 2, y - 15, w, 22, 11); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = tt.ach ? '#f6ecff' : c; ctx.fillText(label, LW / 2, y, LW - 30); ctx.globalAlpha = 1; }
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
  fixEquipped(); resize(); newGame('free', true); syncWallet();
  show('home'); lastFrame = performance.now(); requestAnimationFrame(frame); onlineBoot();
  if (DEV) window.NM = { get G() { return G; }, get save() { return save; }, get state() { return gstate; }, startRun, step, show, trade, GOODS, rentFor, sellPrice, worth, held, cap, NIGHT, TICK };
