  /* ================= NIGHT RUN: drawing ================= */
  // Things drawn many times a frame (glows, trees, rocks) are painted once into small off-screen canvases and stamped.
  const sprites = {};
  function sprite(key, w, h, paint) {
    const k = dpr * SC, c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k));
    const x = c.getContext('2d'); x.scale(k, k); paint(x); sprites[key] = { c, w, h }; return sprites[key];
  }
  const stamp = (key, x, y, s = 1) => { const sp = sprites[key]; ctx.drawImage(sp.c, x - sp.w * s / 2, y - sp.h * s / 2, sp.w * s, sp.h * s); };
  function glowSprite(key, rgb) { sprite(key, 64, 64, x => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, `rgba(${rgb},.9)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }); }
  function paintTree(x, s, dark) {
    x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(4, s * .55, s * .55, s * .16, 0, 0, TAU); x.fill();
    x.fillStyle = '#3a2a1e'; x.fillRect(-2, s * .2, 4, s * .4);
    for (let i = 0; i < 3; i++) {
      const w = s * (1 - i * .22), top = -s * .9 + i * s * .35;
      x.fillStyle = (i % 2 ? !dark : dark) ? '#24574a' : '#2f6b55';
      x.beginPath(); x.moveTo(0, top - s * .3); x.lineTo(-w * .6, top + s * .5); x.lineTo(w * .6, top + s * .5); x.fill();
      x.fillStyle = 'rgba(232,238,247,.6)'; x.fillRect(-w * .5, top + s * .45, w, 2);
    }
    x.fillStyle = 'rgba(232,238,247,.9)'; x.beginPath(); x.moveTo(0, -s * 1.2); x.lineTo(-s * .18, -s * .9); x.lineTo(s * .18, -s * .9); x.fill();
  }
  let bgGrad = null, fog = null, fctx = null;
  function buildSprites() {
    for (const k in sprites) delete sprites[k];
    glowSprite('gIce', '143,211,255'); glowSprite('gAmber', '255,179,71'); glowSprite('gRed', '255,68,102'); glowSprite('gGold', '255,210,74'); glowSprite('gViolet', '180,140,255');
    sprite('hole', 64, 64, x => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.5, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
    for (const d of [0, 1]) sprite('tree' + d, 44, 84, x => { x.translate(22, 46); paintTree(x, 30, !!d); });
    sprite('rock', 54, 40, x => {
      x.translate(27, 20); const s = 26;
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(3, s * .3, s * .7, s * .25, 0, 0, TAU); x.fill();
      x.fillStyle = '#56657c'; x.beginPath(); x.ellipse(0, 0, s * .7, s * .45, 0, 0, TAU); x.fill();
      x.fillStyle = '#3f4b5e'; x.beginPath(); x.ellipse(s * .2, s * .12, s * .35, s * .22, 0, 0, TAU); x.fill();
      x.fillStyle = '#e8eef7'; x.beginPath(); x.ellipse(-2, -s * .22, s * .45, s * .16, 0, 0, TAU); x.fill();
    });
    sprite('snowman', 40, 50, x => {
      x.translate(20, 30);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(3, 12, 13, 4, 0, 0, TAU); x.fill();
      x.fillStyle = '#f4f8ff'; x.beginPath(); x.arc(0, 4, 10, 0, TAU); x.fill(); x.beginPath(); x.arc(0, -9, 7, 0, TAU); x.fill();
      x.fillStyle = '#cfdcec'; x.beginPath(); x.arc(3, 7, 6, 0, TAU); x.fill();
      x.fillStyle = '#1a1f2b'; x.fillRect(-6, -17, 12, 2); x.fillRect(-4, -24, 8, 7); x.fillRect(-3, -11, 2, 2); x.fillRect(2, -11, 2, 2);
      x.fillStyle = '#ff7a3d'; x.beginPath(); x.moveTo(0, -8); x.lineTo(7, -7); x.lineTo(0, -6); x.fill();
      x.fillStyle = '#ff5577'; x.fillRect(-7, -4, 14, 2.5);
    });
    sprite('ramp', 70, 30, x => {
      x.translate(35, 15); const hw = 28;
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(-hw + 4, 10, 56, 5);
      x.fillStyle = '#c7d3e4'; x.beginPath(); x.moveTo(-hw, 10); x.lineTo(hw, 10); x.lineTo(hw - 6, -10); x.lineTo(-hw + 6, -10); x.fill();
      x.fillStyle = '#e8eef7'; x.fillRect(-hw + 6, 6, 44, 4);
      x.strokeStyle = '#ffb347'; x.lineWidth = 2.5; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(i * 14 - 5, -3); x.lineTo(i * 14, 3); x.lineTo(i * 14 + 5, -3); x.stroke(); }
    });
    bgGrad = ctx.createLinearGradient(0, 0, 0, LH); bgGrad.addColorStop(0, '#131f3d'); bgGrad.addColorStop(.55, '#0d152b'); bgGrad.addColorStop(1, '#0a1020');
    fog = document.createElement('canvas'); fog.width = Math.ceil(LW / 2); fog.height = Math.ceil(LH / 2); fctx = fog.getContext('2d');
  }
  resizeHooks.push(buildSprites);

  const snowfall = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + .4 }));
  const stars = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random() * .3, a: .2 + Math.random() * .5 }));
  let shooter = null;
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function zoneIcon(c, z, x, y, r) {
    c.fillStyle = z.color;
    if (z.shape === 'circle') { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    else if (z.shape === 'square') c.fillRect(x - r, y - r, r * 2, r * 2);
    else if (z.shape === 'warn') { c.beginPath(); c.moveTo(x, y - r * 1.2); c.lineTo(x + r * 1.2, y + r); c.lineTo(x - r * 1.2, y + r); c.fill(); c.fillStyle = '#0a1020'; c.fillRect(x - r * .12, y - r * .4, r * .24, r * .8); }
    else if (z.shape === 'peak') { c.beginPath(); c.moveTo(x - r * 1.3, y + r); c.lineTo(x - r * .3, y - r * .3); c.lineTo(x, y); c.lineTo(x + r * .5, y - r * 1.1); c.lineTo(x + r * 1.3, y + r); c.fill(); }
    else if (z.shape === 'star') { c.beginPath(); for (let i = 0; i < 10; i++) { const q = i % 2 ? r * .5 : r * 1.25, a = -Math.PI / 2 + i * Math.PI / 5; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); } c.fill(); }
    else { const d = cx => { c.beginPath(); c.moveTo(cx, y - r * 1.2); c.lineTo(cx + r, y); c.lineTo(cx, y + r * 1.2); c.lineTo(cx - r, y); c.fill(); }; if (z.shape === 'diamond') d(x); else { d(x - r * 1.1); d(x + r * 1.1); } }
  }

  function boardFill(c, b, now) {
    if (Array.isArray(b.c)) { const g = c.createLinearGradient(-15, 0, 15, 0); g.addColorStop(0, b.c[0]); g.addColorStop(1, b.c[1]); return g; }
    if (b.c === 'cycle') return `hsl(${(now / 12) % 360},90%,65%)`;
    if (b.c === 'plasma') return `hsl(${330 + Math.sin(now / 300) * 30},95%,62%)`;
    if (b.c === 'chrome') { const g = c.createLinearGradient(-15, 0, 15, 0), o = (Math.sin(now / 500) + 1) / 2; g.addColorStop(0, '#8a96ab'); g.addColorStop(clamp(o, .05, .95), '#ffffff'); g.addColorStop(1, '#6b778c'); return g; }
    return b.c;
  }
  // The rider and board, centered on the origin. Used on the slope and for the shop pictures.
  function drawRider(c, sk, board, now, sw) {
    const jacket = sk.jacket === 'aurora' ? `hsl(${(now / 10) % 360},85%,62%)` : sk.jacket;
    if (sk.alpha) c.globalAlpha *= sk.alpha;
    if (sk.glow) { const g = c.createRadialGradient(0, -4, 2, 0, -4, 24); g.addColorStop(0, `rgba(${sk.glow},.45)`); g.addColorStop(1, `rgba(${sk.glow},0)`); c.fillStyle = g; c.beginPath(); c.arc(0, -4, 24, 0, TAU); c.fill(); }
    if (sk.extra === 'lantern') { const g = c.createRadialGradient(0, -4, 2, 0, -4, 22); g.addColorStop(0, 'rgba(255,179,71,.55)'); g.addColorStop(1, 'rgba(255,179,71,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -4, 22, 0, TAU); c.fill(); }
    if (sw) c.scale(-1, 1);
    if (sk.extra === 'cape') { c.fillStyle = '#8a1c3c'; c.beginPath(); c.moveTo(-5, -9); c.lineTo(5, -9); c.lineTo(9, 9 + Math.sin(now / 120) * 2); c.lineTo(-9, 9 - Math.sin(now / 120) * 2); c.fill(); }
    c.fillStyle = boardFill(c, board, now); rr(c, -15, 5, 30, 6, 3); c.fill();
    if (board.edge) { c.strokeStyle = board.edge; c.lineWidth = 1; c.stroke(); }
    c.fillStyle = 'rgba(10,16,32,.35)'; c.fillRect(-15, 8, 30, 1);
    c.fillStyle = jacket; c.fillRect(-5, -10, 10, 16);
    if (sk.rim) { c.strokeStyle = 'rgba(232,238,247,.55)'; c.lineWidth = .9; c.strokeRect(-5, -10, 10, 16); }
    c.fillStyle = sk.stripe;
    if (sk.pattern === 'stripes') { c.fillRect(-5, -7, 10, 2); c.fillRect(-5, -2, 10, 2); c.fillRect(-5, 3, 10, 2); }
    else if (sk.pattern === 'buttons') { for (const y of [-6, -2, 2]) { c.beginPath(); c.arc(0, y, 1.2, 0, TAU); c.fill(); } }
    else if (sk.pattern === 'cross') { c.fillRect(-1.5, -7, 3, 9); c.fillRect(-4, -4, 8, 3); }
    else if (sk.pattern === 'fur') { for (let i = 0; i < 4; i++) c.fillRect(-5 + i * 3, -9 + (i % 2) * 5, 2, 4); }
    else c.fillRect(-5, -4, 10, 3);
    if (sk.extra === 'medal') { c.fillStyle = '#4aa3ff'; c.fillRect(-1, -10, 2, 5); c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(0, -4, 2.4, 0, TAU); c.fill(); }
    if (sk.extra === 'bowtie') { c.fillStyle = '#ff4466'; c.beginPath(); c.moveTo(0, -9); c.lineTo(-3.5, -11); c.lineTo(-3.5, -7); c.moveTo(0, -9); c.lineTo(3.5, -11); c.lineTo(3.5, -7); c.fill(); }
    if (sk.extra === 'scarf') { c.fillStyle = sk.scarf; c.fillRect(-5.5, -11, 11, 3); c.save(); c.translate(4, -10); c.rotate(-.5 + Math.sin(now / 140) * .25); c.fillRect(0, 0, 7, 2.5); c.restore(); }
    if (sk.extra === 'lantern') { c.fillStyle = '#3a2a1e'; c.fillRect(5, -7, 1, 4); c.fillStyle = '#ffe0a8'; c.fillRect(4, -4, 3.5, 4); }
    c.fillStyle = sk.helmet; c.beginPath(); c.arc(0, -14, 5, 0, TAU); c.fill();
    if (sk.rim) { c.beginPath(); c.arc(0, -14, 5, 0, TAU); c.stroke(); }
    if (sk.eyes) { c.fillStyle = 'rgba(255,68,102,.45)'; c.fillRect(-5, -17, 10, 5); }
    c.fillStyle = sk.goggle; if (sk.hat === 'visor') { c.beginPath(); c.arc(0, -14, 3.6, 0, TAU); c.fill(); } else c.fillRect(-4, -16, 8, 3);
    if (sk.nose) { c.fillStyle = '#ff7a3d'; c.beginPath(); c.moveTo(1, -13); c.lineTo(6, -12); c.lineTo(1, -11); c.fill(); }
    if (sk.hat === 'beanie') { c.fillStyle = sk.hatC; c.beginPath(); c.arc(0, -15, 5.4, Math.PI, 0); c.fill(); c.fillRect(-5.4, -16, 10.8, 2); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, -21, 2, 0, TAU); c.fill(); }
    if (sk.hat === 'tophat') { c.fillStyle = '#1a1f2b'; c.fillRect(-6.5, -19.5, 13, 2); c.fillRect(-4, -27, 8, 8); c.fillStyle = '#ff4466'; c.fillRect(-4, -21.5, 8, 1.5); }
    if (sk.hat === 'crown') { c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(-5, -18); c.lineTo(-5, -23); c.lineTo(-2.5, -20.5); c.lineTo(0, -24.5); c.lineTo(2.5, -20.5); c.lineTo(5, -23); c.lineTo(5, -18); c.fill(); c.fillStyle = '#ff4466'; c.beginPath(); c.arc(0, -20, 1, 0, TAU); c.fill(); }
    if (sk.halo) { c.strokeStyle = 'rgba(255,224,130,.9)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, -28, 6, 2, 0, 0, TAU); c.stroke(); }
  }
  // Small pictures for the locker and shop, made once each.
  const previews = {};
  function cosPreview(kind, it) {
    const key = kind + ':' + it.id + (kind === 'skin' ? ':' + R.eq.board : kind === 'board' ? ':' + R.eq.skin : '');
    if (previews[key]) return previews[key];
    const c = document.createElement('canvas'); c.width = c.height = 144; const x = c.getContext('2d');
    x.fillStyle = '#121c34'; x.fillRect(0, 0, 144, 144);
    if (kind === 'skin' || kind === 'board') { x.translate(72, 92); x.scale(3.3, 3.3); drawRider(x, kind === 'skin' ? it : cosItem('skin', R.eq.skin), kind === 'board' ? it : cosItem('board', R.eq.board), 900); }
    else if (kind === 'trail') {
      x.lineCap = 'round';
      for (const off of it.twin ? [-12, 12] : [0]) for (let i = 0; i < 20; i++) {
        x.strokeStyle = it.c === 'rainbow' || it.c === 'aurora' ? `hsl(${it.c === 'aurora' ? 140 + i * 6 : i * 18},90%,65%)` : it.c; x.globalAlpha = Math.min(1, it.a + .25); x.lineWidth = (it.w || 2.5) * 2;
        x.beginPath(); x.moveTo(72 + off + Math.sin(i * .45) * 30, 20 + i * 5.5); x.lineTo(72 + off + Math.sin((i + 1) * .45) * 30, 20 + (i + 1) * 5.5); x.stroke();
      }
      x.globalAlpha = 1; if (it.spark || it.fire) for (let i = 0; i < 12; i++) { x.fillStyle = it.fire ? (i % 2 ? '#ff4b2b' : '#ffb347') : it.spark; x.fillRect(30 + (i * 37) % 84, 24 + (i * 53) % 100, 4, 4); }
    } else for (let i = 0; i < 46; i++) { const a = i * 2.4, d = 14 + (i * 13) % 50; x.fillStyle = it.sw[i % it.sw.length]; x.globalAlpha = 1 - d / 80; const s = 4 + i % 5; x.fillRect(72 + Math.cos(a) * d - s / 2, 72 + Math.sin(a) * d - s / 2, s, s); }
    return (previews[key] = c.toDataURL('image/png'));
  }
  const clearPreviews = () => { for (const k in previews) delete previews[k]; };

  function drawObj(o, sy, now) {
    const k = o.k, x = o.x;
    if (k === 'tree') stamp(o.wob > 3 ? 'tree1' : 'tree0', x, sy - o.s * .13, o.s / 30);
    else if (k === 'rock') stamp('rock', x, sy, o.s / 26);
    else if (k === 'snowman') stamp('snowman', x, sy - 4);
    else if (k === 'skier') {
      const s = Math.sign(o.vx) || 1;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 3, sy + 10, 12, 3, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b9c9de'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 12, sy + 7 - s * 2); ctx.lineTo(x + 12, sy + 7 + s * 2); ctx.moveTo(x - 12, sy + 10 - s * 2); ctx.lineTo(x + 12, sy + 10 + s * 2); ctx.stroke();
      ctx.fillStyle = '#ff4466'; ctx.fillRect(x - 4, sy - 8, 8, 14); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x, sy - 11, 4.5, 0, TAU); ctx.fill();
    } else if (k === 'gate') {
      for (const [gx, col, side] of [[x - o.w / 2, '#ff4466', 1], [x + o.w / 2, '#4aa3ff', -1]]) {
        ctx.strokeStyle = '#b9c9de'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, sy + 8); ctx.lineTo(gx, sy - 18); ctx.stroke();
        ctx.fillStyle = o.passed ? '#56657c' : col; ctx.beginPath(); ctx.moveTo(gx, sy - 18); ctx.lineTo(gx + 12 * side, sy - 13); ctx.lineTo(gx, sy - 8); ctx.fill();
      }
    } else if (k === 'flake') {
      stamp('gIce', x, sy, .42);
      ctx.strokeStyle = '#e6f6ff'; ctx.lineWidth = 1.6; const a = reduceMotion ? o.wob : now / 600 + o.wob;
      ctx.beginPath(); for (let i = 0; i < 3; i++) { const q = a + i * Math.PI / 3, cx = Math.cos(q) * 7, cy = Math.sin(q) * 7; ctx.moveTo(x - cx, sy - cy); ctx.lineTo(x + cx, sy + cy); } ctx.stroke();
    } else if (k === 'gem') {
      stamp('gViolet', x, sy, .8); ctx.fillStyle = '#d9c6ff'; ctx.beginPath(); ctx.moveTo(x, sy - 9); ctx.lineTo(x + 7, sy - 2); ctx.lineTo(x, sy + 9); ctx.lineTo(x - 7, sy - 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x, sy - 9); ctx.lineTo(x + 3, sy - 2); ctx.lineTo(x - 3, sy - 2); ctx.fill();
    } else if (k === 'lantern') {
      const p = reduceMotion ? 1 : 1 + Math.sin(now / 160 + o.wob) * .15; stamp('gAmber', x, sy, .95 * p);
      ctx.fillStyle = '#3a2a1e'; ctx.fillRect(x - 3, sy - 8, 6, 2); ctx.fillStyle = '#ffe0a8'; rr(ctx, x - 4, sy - 6, 8, 11, 2); ctx.fill(); ctx.fillStyle = '#ffb347'; ctx.fillRect(x - 1.5, sy - 3, 3, 5);
    } else if (k === 'shield') {
      stamp('gIce', x, sy, .9); ctx.fillStyle = '#e0f4ff'; ctx.beginPath(); ctx.moveTo(x - 7, sy - 8); ctx.lineTo(x + 7, sy - 8); ctx.lineTo(x + 7, sy); ctx.quadraticCurveTo(x + 6, sy + 7, x, sy + 10); ctx.quadraticCurveTo(x - 6, sy + 7, x - 7, sy); ctx.fill();
      ctx.fillStyle = '#4aa3ff'; ctx.fillRect(x - 1, sy - 5, 2, 10); ctx.fillRect(x - 4, sy - 2, 8, 2);
    } else if (k === 'magnet') {
      stamp('gRed', x, sy, .8); ctx.strokeStyle = '#ff4466'; ctx.lineWidth = 5; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(x, sy - 2, 7, Math.PI, 0); ctx.stroke(); ctx.lineCap = 'round';
      ctx.fillStyle = '#e8eef7'; ctx.fillRect(x - 9.5, sy - 2, 5, 5); ctx.fillRect(x + 4.5, sy - 2, 5, 5);
    } else if (k === 'x2') {
      stamp('gGold', x, sy, .8); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x, sy, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a1020'; ctx.font = '9px "Bungee",Impact,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('2X', x, sy + 3.5);
    }
  }
  function drawFlat(o, sy) {
    const k = o.k, x = o.x;
    if (k === 'ramp') stamp('ramp', x, sy, o.w / 56);
    else if (k === 'rail') {
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 4, sy + 4); ctx.lineTo(x + 4, sy + o.len + 4); ctx.stroke();
      ctx.fillStyle = '#3a4a64'; for (let p = 10; p < o.len; p += 48) ctx.fillRect(x - 4, sy + p, 8, 4);
      ctx.strokeStyle = '#a9b8cf'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy + o.len); ctx.stroke();
      ctx.fillStyle = '#ffb347'; ctx.fillRect(x - 5, sy + o.len - 3, 10, 3); ctx.fillRect(x - 5, sy, 10, 3);
    } else if (k === 'ice') {
      ctx.fillStyle = 'rgba(143,211,255,.16)'; ctx.beginPath(); ctx.ellipse(x, sy, o.w / 2, o.h / 2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(232,244,255,.4)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - o.w * .25, sy - 6); ctx.lineTo(x - o.w * .08, sy + 4); ctx.moveTo(x + o.w * .05, sy - 9); ctx.lineTo(x + o.w * .22, sy + 2); ctx.stroke();
    } else if (k === 'crev') {
      const hw = o.w / 2, hh = o.h / 2, n = o.jag.length - 1, px = i => x - hw + i / n * o.w, tp = i => Math.pow(Math.sin(Math.PI * i / n), .6);
      const crack = sc => { ctx.beginPath(); ctx.moveTo(px(0), sy); for (let i = 1; i <= n; i++) ctx.lineTo(px(i), sy + o.jag[i] - hh * sc * tp(i)); for (let i = n - 1; i >= 1; i--) ctx.lineTo(px(i), sy + o.jag[i] * .6 + hh * sc * tp(i)); ctx.closePath(); };
      crack(1.3); ctx.fillStyle = 'rgba(205,180,255,.18)'; ctx.fill();
      crack(1); ctx.fillStyle = '#0b1530'; ctx.fill(); ctx.strokeStyle = 'rgba(232,244,255,.85)'; ctx.lineWidth = 1.5; ctx.stroke();
      crack(.5); ctx.fillStyle = '#020309'; ctx.fill();
    } else if (k === 'gate' && !o.passed) { ctx.strokeStyle = 'rgba(74,163,255,.3)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - o.w / 2, sy + 8); ctx.lineTo(x + o.w / 2, sy + 8); ctx.stroke(); ctx.setLineDash([]); }
  }

  function drawPlayer(now) {
    const prog = G.air > 0 ? 1 - G.air / G.airMax : 0, z = G.air > 0 ? Math.sin(Math.PI * prog) * (14 + G.airMax * .2) : G.grind ? 5 : 0, sc = 1 + z / 55, py = PY - z;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(G.x + 3 + z * .3, PY + 11, 15 / sc, 4 / sc, 0, 0, TAU); ctx.fill();
    if (G.flareT > 0) stamp('gAmber', G.x, py, 1.1 + Math.sin(now / 60) * .1);
    if (G.magT > 0) { ctx.strokeStyle = `rgba(255,68,102,${.16 + Math.sin(now / 120) * .08})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(G.x, PY, 150, 0, TAU); ctx.stroke(); }
    if (G.shield) { ctx.strokeStyle = `rgba(143,211,255,${.55 + Math.sin(now / 150) * .2})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(G.x, py - 2, 20 * sc, 0, TAU); ctx.stroke(); if (G.spare) { ctx.beginPath(); ctx.arc(G.x, py - 2, 24 * sc, 0, TAU); ctx.stroke(); } }
    ctx.save(); ctx.translate(G.x, py); ctx.rotate(G.lean + G.spin); ctx.scale(sc, sc);
    if (G.inv > 0 && Math.floor(now / 80) % 2) ctx.globalAlpha = .4;
    if (G.air > 0 && G.grabT > 0 && (keys.grab || touchGrab)) ctx.scale(1, .82);
    drawRider(ctx, cosItem('skin', R.eq.skin), cosItem('board', R.eq.board), now, G.sw);
    ctx.restore(); ctx.globalAlpha = 1;
    if (G.air > 0 && !G.demo) {
      const n = Math.round(Math.abs(G.spin) / Math.PI), err = Math.abs(Math.abs(G.spin) - n * Math.PI), ok = err < landTol(up('soft')) + (G.park ? .15 : 0);
      ctx.font = '11px "Bungee",Impact,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = ok ? (err < .13 && n ? '#ffd24a' : '#5cf2b0') : '#ff5577';
      ctx.fillText(Math.round(Math.abs(G.spin) / Math.PI * 18) * 10 + '°', G.x, py - 32 * sc);
      // landing meter: time left in the air
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(G.x - 16, py - 28 * sc, 32, 2.5); ctx.fillStyle = ok ? '#5cf2b0' : '#ff5577'; ctx.fillRect(G.x - 16, py - 28 * sc, 32 * (G.air / G.airMax), 2.5);
    }
  }
  function drawGhost(now) {
    if (!G.ghost) return;
    const gy = PY + G.gd - G.px;
    if (gy < -30 || gy > LH + 30) return;
    ctx.font = '8px "Bungee",Impact,sans-serif'; ctx.textAlign = 'center';
    if (G.gDone) { ctx.strokeStyle = 'rgba(180,140,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(G.gx - 7, gy - 7); ctx.lineTo(G.gx + 7, gy + 7); ctx.moveTo(G.gx + 7, gy - 7); ctx.lineTo(G.gx - 7, gy + 7); ctx.stroke(); ctx.fillStyle = 'rgba(180,140,255,.85)'; ctx.fillText(G.gName ? G.gName.toUpperCase() + ' CRASHED HERE' : 'BEST RUN ENDED', G.gx, gy - 14); return; }
    ctx.globalAlpha = .36 + Math.sin(now / 200) * .06; ctx.fillStyle = '#b48cff';
    rr(ctx, G.gx - 15, gy + 5, 30, 6, 3); ctx.fill(); ctx.fillRect(G.gx - 5, gy - 10, 10, 16); ctx.beginPath(); ctx.arc(G.gx, gy - 14, 5, 0, TAU); ctx.fill();
    ctx.globalAlpha = .8; ctx.fillText(G.gName ? G.gName.toUpperCase() : 'GHOST', G.gx, gy - 24); ctx.globalAlpha = 1;
  }
  function drawDark(a) {
    const fw = fog.width, fh = fog.height;
    fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, fw, fh); fctx.fillStyle = `rgba(3,5,12,${a})`; fctx.fillRect(0, 0, fw, fh);
    fctx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => fctx.drawImage(sprites.hole.c, (x - r) / 2, (y - r) / 2, r, r);
    if (gstate !== 'crash') { hole(G.x, PY, G.flareT > 0 ? 250 : 80); hole(G.x, PY + 90, 150); hole(G.x, PY + 200, 170); }
    for (const o of G.obs) { if (o.hit) continue; const sy = PY + o.wy - G.px; if (sy < -60 || sy > LH + 60) continue; if (o.k === 'lantern') hole(o.x, sy, 110); else if (o.k === 'flake' || o.k === 'gem' || o.k === 'shield' || o.k === 'magnet' || o.k === 'x2') hole(o.x, sy, 34); }
    ctx.drawImage(fog, 0, 0, LW, LH);
  }

  let darkA = 0, auroraA = 0;
  function drawRun(now) {
    const k = dpr * SC, t = now / 1000, low = save.settings.fx === 'low', playing = !G.demo, shakeOn = save.settings.shake && !reduceMotion;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.save();
    if (G.punch > 0 && shakeOn) { const z = 1 + G.punch * .05; ctx.translate(LW / 2, PY); ctx.scale(z, z); ctx.translate(-LW / 2, -PY); }
    if (G.shake > 0 && shakeOn) ctx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);
    ctx.fillStyle = bgGrad; ctx.fillRect(-20, -20, LW + 40, LH + 40);
    darkA += ((G.zone === 4 && playing ? .9 : 0) - darkA) * .02; auroraA += ((G.zone >= 5 ? 1 : 0) - auroraA) * .015;

    ctx.fillStyle = '#e8eef7'; for (const s of stars) { ctx.globalAlpha = s.a * (.7 + Math.sin(t * 2 + s.x * 40) * .3); ctx.fillRect(s.x * LW, s.y * LH, 1.4, 1.4); } ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    const hues = ['92,242,176', '120,140,255', '92,242,176'];
    for (let i = 0; i < 3; i++) {
      const base = LH * (.11 + i * .065); ctx.beginPath(); ctx.moveTo(-20, base);
      for (let x = -20; x <= LW + 20; x += 28) ctx.lineTo(x, base + Math.sin(x * .012 + t * (.4 + i * .2) + i) * (22 + auroraA * 16));
      ctx.lineTo(LW + 20, -30); ctx.lineTo(-20, -30); ctx.fillStyle = `rgba(${hues[i]},${[.06, .045, .035][i] * (1 + auroraA * 2.6)})`; ctx.fill();
    }
    if (auroraA > .02) { const base = LH * .23; ctx.beginPath(); ctx.moveTo(-20, base); for (let x = -20; x <= LW + 20; x += 28) ctx.lineTo(x, base + Math.sin(x * .009 - t * .5) * 30); ctx.lineTo(LW + 20, -30); ctx.lineTo(-20, -30); ctx.fillStyle = `rgba(255,92,240,${.07 * auroraA})`; ctx.fill(); }
    if (!reduceMotion && !low) {
      if (!shooter && Math.random() < .004) { const d = Math.random() < .5 ? -1 : 1; shooter = { x: d > 0 ? Math.random() * LW * .5 : LW * (.5 + Math.random() * .5), y: Math.random() * LH * .16, vx: d * (6 + Math.random() * 4), vy: 2 + Math.random(), life: 40 }; }
      if (shooter) { const s = shooter; ctx.strokeStyle = `rgba(255,255,255,${.8 * Math.min(1, s.life / 15)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 7, s.y - s.vy * 7); ctx.stroke(); s.x += s.vx; s.y += s.vy; if (--s.life <= 0) shooter = null; }
    }
    ctx.globalCompositeOperation = 'source-over';

    // slope texture that scrolls with the hill, and speed lines when you're flying
    ctx.strokeStyle = 'rgba(143,179,217,.07)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const gx = (i * 137.5) % LW, gy = LH - ((G.px + i * 211) % (LH + 120)) + 60; ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + 20 + G.speed * 5); } ctx.stroke();
    if (playing && G.speed > 9 && !reduceMotion) { ctx.strokeStyle = `rgba(232,238,247,${Math.min(.2, (G.speed - 9) * .035)})`; ctx.beginPath(); for (let i = 0; i < 9; i++) { const sx = (i * 97 + t * 300) % LW, sy = LH - (i * 131 + t * G.speed * 120) % LH; ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 46); } ctx.stroke(); }

    const top = G.px - PY - 60, bot = G.px - PY + LH + 60, obs = G.obs;
    ctx.lineCap = 'round';
    for (let i = 0; i < obs.length; i++) { const o = obs[i]; if (o.wy + (o.len || 0) < top || o.wy > bot || (o.hit && o.k !== 'ramp')) continue; const kk = o.k; if (kk === 'ramp' || kk === 'rail' || kk === 'ice' || kk === 'crev' || kk === 'gate') drawFlat(o, PY + o.wy - G.px); }

    // board trail
    const tr = cosItem('trail', R.eq.trail), T = G.trail, hot = G.flareT > 0;
    if (T.length >= 6) {
      const col = hot ? '#ff9640' : tr.c === 'rainbow' ? `hsl(${(now / 5) % 360},90%,65%)` : tr.c === 'aurora' ? `hsl(${140 + Math.sin(now / 700) * 50},85%,62%)` : tr.c;
      ctx.strokeStyle = col; ctx.globalAlpha = hot ? .7 : tr.a; ctx.lineWidth = tr.w || 2.5;
      for (const off of tr.twin ? [-6, 6] : [0]) { ctx.beginPath(); let pen = false; for (let i = 0; i < T.length; i += 3) { if (!T[i + 2]) { pen = false; continue; } const sx = T[i] + off, sy = PY + 8 + T[i + 1] - G.px; if (pen) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); pen = true; } ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < obs.length; i++) { const o = obs[i]; if (o.hit || o.wy < top || o.wy > bot) continue; const kk = o.k; if (kk !== 'ramp' && kk !== 'rail' && kk !== 'ice' && kk !== 'crev') drawObj(o, PY + o.wy - G.px, now); }
    for (let i = 0; i < pn; i++) { const p = parts[i]; ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    ctx.globalAlpha = 1;
    if (playing) drawGhost(now);
    if (gstate !== 'crash' || G.cause === 'time') drawPlayer(now);
    ctx.fillStyle = 'rgba(232,238,247,.5)'; ctx.beginPath();
    for (let i = 0, n = low ? 24 : snowfall.length; i < n; i++) { const f = snowfall[i]; if (!reduceMotion) { f.y -= (G.speed * .0014 + f.r * .0008); f.x += .0004 * f.r; if (f.y < 0) { f.y = 1; f.x = Math.random(); } if (f.x > 1) f.x -= 1; } ctx.rect(f.x * LW, f.y * LH, f.r * 1.5, f.r * 1.5); }
    ctx.fill();
    ctx.restore();
    if (darkA > .02) drawDark(darkA);
    if (!playing) return;

    ctx.textAlign = 'center';
    for (const f of G.floats) { ctx.font = (f.big ? '15px' : '11px') + ' "Bungee",Impact,sans-serif'; ctx.globalAlpha = Math.min(1, f.life / 18); ctx.fillStyle = 'rgba(10,16,32,.8)'; ctx.fillText(f.text, f.x + 1, f.y + 1.5); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
    if (G.flash > 0) { ctx.fillStyle = `rgba(255,224,168,${G.flash * .35})`; ctx.fillRect(0, 0, LW, LH); }
    drawHUD(now);
  }

  function hudBar(x, y, w, frac, col, label) {
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x - w, y, w, 4); ctx.fillStyle = col; ctx.fillRect(x - w, y, w * clamp(frac, 0, 1), 4);
    ctx.font = '8px "DM Mono",monospace'; ctx.textAlign = 'right'; ctx.fillText(label, x - w - 5, y + 5);
  }
  function drawHUD(now) {
    const z = ZONES[G.zone], F = '"Bungee",Impact,sans-serif', M = '"DM Mono",monospace';
    ctx.textAlign = 'left'; ctx.font = '22px ' + F; ctx.fillStyle = 'rgba(10,16,32,.7)'; ctx.fillText(fmt(G.score), 13, 31); ctx.fillStyle = '#e8eef7'; ctx.fillText(fmt(G.score), 12, 30);
    ctx.font = '9px ' + M; ctx.fillStyle = '#b9c9de';
    if (G.park) ctx.fillText('TRICK PARK', 12, 44); else { zoneIcon(ctx, z, 17, 41, 4); ctx.fillStyle = '#b9c9de'; ctx.fillText(`${z.name.toUpperCase()} · ${fmt(G.px / 10)} M`, 27, 44); }
    let hy = 66;
    if (G.combo > 0) {
      const hot = G.combo >= 20, col = hot ? '#ffd24a' : '#5cf2b0', pop = 1 + Math.max(0, (G.comboT - comboWin(up('combo')) + 8)) * .02;
      ctx.font = Math.round(17 * pop) + 'px ' + F; ctx.fillStyle = col; ctx.fillText('x' + mult().toFixed(1), 12, hy);
      ctx.font = '8px ' + M; ctx.fillStyle = '#b9c9de'; ctx.fillText('COMBO ' + G.combo, 62, hy - 5);
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(62, hy - 2, 60, 3); ctx.fillStyle = col; ctx.fillRect(62, hy - 2, 60 * G.comboT / comboWin(up('combo')), 3);
      hy += 22;
    }
    if (G.chain > 1) { ctx.font = '11px ' + F; ctx.fillStyle = '#4aa3ff'; ctx.fillText('GATES x' + G.chain, 12, hy); hy += 16; }
    if (G.grind) { ctx.font = '11px ' + F; ctx.fillStyle = '#e8eef7'; ctx.fillText('GRINDING ' + fmt(G.grindPts), 12, hy); hy += 16; }
    if (G.sw) { ctx.font = '8px ' + M; ctx.fillStyle = '#ffd24a'; ctx.fillText('RIDING SWITCH · TRICKS +20%', 12, hy); }

    let ry = 18;
    if (G.park) { const s = Math.max(0, Math.ceil(G.parkT / 60)); ctx.textAlign = 'right'; ctx.font = '22px ' + F; ctx.fillStyle = s <= 10 ? '#ff5577' : '#ffd24a'; ctx.fillText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, LW - 12, 30); ry = 42; }
    else { for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(LW - 18 - i * 17, 22, 6, 0, TAU); ctx.fillStyle = i < G.lant ? '#ffb347' : 'rgba(255,179,71,.16)'; ctx.fill(); } ry = 38; }
    ctx.textAlign = 'right';
    if (G.lant >= 3 && G.flareT <= 0 && !usedTouch) { ctx.font = '10px ' + M; ctx.fillStyle = Math.floor(now / 300) % 2 ? '#ffb347' : '#ffe0a8'; ctx.fillText(keyFor('flare').toUpperCase() + ': FLARE', LW - 12, ry + 6); ry += 14; }
    if (G.revive) { ctx.font = '8px ' + M; ctx.fillStyle = '#7fe8ff'; ctx.fillText('2ND CHANCE READY', LW - 12, ry + 5); ry += 12; }
    if (G.flareT > 0) { hudBar(LW - 12, ry, 54, G.flareT / flareDur(up('flare')), '#ffb347', 'FLARE'); ry += 11; }
    if (G.magT > 0) { hudBar(LW - 12, ry, 54, G.magT / magnetDur(up('magnet')), '#ff6680', 'MAGNET'); ry += 11; }
    if (G.x2T > 0) { hudBar(LW - 12, ry, 54, G.x2T / 480, '#ffd24a', '2X'); ry += 11; }
    const achY = ry + 4;

    if (G.ghost && gstate === 'run') {
      const gap = Math.round((G.gd - G.px) / 10), gy = PY + G.gd - G.px; ctx.font = '8px ' + F; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(180,140,255,.85)';
      if (gy > LH + 30) ctx.fillText(`▼ ${G.gName ? G.gName.toUpperCase() : 'GHOST'} ${gap} M AHEAD`, clamp(G.gx, 70, LW - 70), LH - 16);
      else if (gy < -30 && !G.gDone) ctx.fillText(`▲ ${-gap} M AHEAD OF ${G.gName ? G.gName.toUpperCase() : 'YOUR GHOST'}`, LW / 2, LH - 16);
    }
    if (G.banner > 0 && gstate === 'run') {
      ctx.globalAlpha = Math.min(1, G.banner / 30, (150 - G.banner) / 15 + .2); ctx.textAlign = 'center';
      zoneIcon(ctx, z, LW / 2, LH * .56 - 30, 11); ctx.font = '26px ' + F; ctx.fillStyle = z.color; ctx.fillText(z.name.toUpperCase(), LW / 2, LH * .56 + 8); ctx.globalAlpha = 1;
    }
    if (stick && !stick.sides && gstate === 'run') {
      const dx = clamp(stick.x - stick.ox, -STICK_R, STICK_R) / SC, ox = stick.ox / SC, oy = stick.y / SC, sr = STICK_R / SC;
      ctx.globalAlpha = .22; ctx.strokeStyle = '#e8eef7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox - sr, oy); ctx.lineTo(ox + sr, oy); ctx.stroke();
      ctx.globalAlpha = .5; ctx.fillStyle = '#e8eef7'; ctx.beginPath(); ctx.arc(ox + dx, oy, 8, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    const tt = G.toasts[0];
    if (tt && tt.ach) {
      // a small pill in the top right corner, out of the way of the slope
      const a = tt.ach, tier = TIERS[a.tier], age = tt.max - tt.life, more = G.toasts.filter(x => x.ach).length - 1;
      ctx.font = '9px ' + F; const label = a.n.toUpperCase() + (more > 0 ? `  +${more} MORE` : ''), w = Math.min(210, ctx.measureText(label).width + 34), x = LW - 10 - w + (1 - Math.min(1, age / 10)) * 60, y = achY;
      ctx.globalAlpha = Math.min(.92, tt.life / 20, age / 6); ctx.fillStyle = 'rgba(10,16,32,.9)'; rr(ctx, x, y, w, 20, 10); ctx.fill(); ctx.strokeStyle = tier.c; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = tier.c; ctx.textAlign = 'left'; ctx.fillText('★', x + 8, y + 14); ctx.fillStyle = '#e8eef7'; ctx.save(); ctx.beginPath(); ctx.rect(x + 22, y, w - 28, 20); ctx.clip(); ctx.fillText(label, x + 22, y + 14); ctx.restore(); ctx.globalAlpha = 1;
    } else if (tt) {
      ctx.globalAlpha = Math.min(1, tt.life / 25); ctx.font = '10px ' + F; ctx.textAlign = 'center';
      const w = Math.min(LW - 20, ctx.measureText(tt.text).width + 26), y = LH - 96;
      ctx.fillStyle = 'rgba(10,16,32,.9)'; rr(ctx, LW / 2 - w / 2, y - 16, w, 24, 12); ctx.fill(); ctx.strokeStyle = tt.c; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = tt.c; ctx.fillText(tt.text, LW / 2, y); ctx.globalAlpha = 1;
    }
  }
