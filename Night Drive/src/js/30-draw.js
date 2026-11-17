  /* ================= drawing ================= */
  const sprites = {};
  function sprite(key, w, h, paint) { const k = dpr * SC, c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k)); const x = c.getContext('2d'); x.scale(k, k); paint(x); sprites[key] = { c, w, h }; }
  const stamp = (key, x, y, sx = 1, sy = sx) => { const sp = sprites[key]; ctx.drawImage(sp.c, x - sp.w * sx / 2, y - sp.h * sy / 2, sp.w * sx, sp.h * sy); };
  function glowSprite(key, rgb) { sprite(key, 64, 64, x => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, `rgba(${rgb},.9)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }); }
  let fog = null, fctx = null;
  function buildSprites() {
    for (const k in sprites) delete sprites[k];
    for (const [k, rgb] of [['gYellow', '255,225,74'], ['gCyan', '61,245,255'], ['gPink', '255,61,203'], ['gGreen', '92,242,176'], ['gBlue', '143,211,255'], ['gRed', '255,60,80'], ['gWarm', '255,190,110'], ['gWhite', '240,244,255']]) glowSprite(k, rgb);
    sprite('hole', 64, 64, x => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.55, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
    sprite('beam', 120, 220, x => { const g = x.createLinearGradient(0, 220, 0, 0); g.addColorStop(0, 'rgba(255,244,200,.34)'); g.addColorStop(1, 'rgba(255,244,200,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(48, 220); x.lineTo(72, 220); x.lineTo(118, 0); x.lineTo(2, 0); x.fill(); });
    fog = document.createElement('canvas'); fog.width = Math.ceil(LW / 2); fog.height = Math.ceil(LH / 2); fctx = fog.getContext('2d');
  }
  resizeHooks.push(buildSprites);
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  const hash = (i, s) => { let h = Math.imul(i ^ (s * 374761393), 668265263); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  function paintOf(c, def, now) {
    if (Array.isArray(def.c)) { const g = c.createLinearGradient(0, -19, 0, 19); g.addColorStop(0, def.c[0]); g.addColorStop(1, def.c[1]); return g; }
    if (def.c === 'cycle') return `hsl(${(now / 10) % 360},90%,62%)`;
    if (def.c === 'chrome') { const g = c.createLinearGradient(-11, -19, 11, 19), o = (Math.sin(now / 500) + 1) / 2; g.addColorStop(0, '#8a96ab'); g.addColorStop(clamp(o, .05, .95), '#ffffff'); g.addColorStop(1, '#5d6880'); return g; }
    return def.c;
  }
  // Your car, nose up, centered on the origin. Used on the road and in the garage.
  function drawCar(c, def, now) {
    if (def.alpha) c.globalAlpha *= def.alpha;
    if (def.glowBody) { const g = c.createRadialGradient(0, 0, 4, 0, 0, 34); g.addColorStop(0, `rgba(${def.glowBody},.4)`); g.addColorStop(1, `rgba(${def.glowBody},0)`); c.fillStyle = g; c.fillRect(-34, -34, 68, 68); }
    c.fillStyle = paintOf(c, def, now); rr(c, -11, -19, 22, 38, 6); c.fill();
    c.fillStyle = def.c2;
    if (def.stripe === 'twin') { c.fillRect(-4.5, -19, 3, 38); c.fillRect(1.5, -19, 3, 38); }
    else if (def.stripe === 'bar') c.fillRect(-11, 9, 22, 5);
    else if (def.stripe === 'check') { for (let i = 0; i < 6; i++) if (i % 2) c.fillRect(-11 + i * 3.7, 8, 3.7, 3); else c.fillRect(-11 + i * 3.7, 11, 3.7, 3); }
    c.fillStyle = '#0b0a1a'; rr(c, -8, -10, 16, 8, 2); c.fill(); rr(c, -8, 6, 16, 5, 2); c.fill();
    c.fillStyle = def.stripe === 'num' ? '#f1eeff' : 'rgba(255,255,255,.12)'; c.fillRect(-8, -1, 16, 6);
    if (def.stripe === 'num') { c.fillStyle = def.c2; c.beginPath(); c.arc(0, 2, 4.2, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.font = '6px "Bungee",Impact,sans-serif'; c.textAlign = 'center'; c.fillText('7', 0, 4.2); }
    if (def.lights) { c.fillStyle = Math.floor(now / 160) % 2 ? '#ff4d6d' : '#3d7bff'; c.fillRect(-7, -1, 6, 3); c.fillStyle = Math.floor(now / 160) % 2 ? '#3d7bff' : '#ff4d6d'; c.fillRect(1, -1, 6, 3); }
    c.fillStyle = '#fff6c8'; c.fillRect(-9.5, -19, 5, 2.5); c.fillRect(4.5, -19, 5, 2.5);
    c.fillStyle = '#ff3c50'; c.fillRect(-9.5, 16.5, 5, 2.5); c.fillRect(4.5, 16.5, 5, 2.5);
  }
  const previews = {};
  function cosPreview(kind, it) {
    const key = kind + ':' + it.id + ':' + (kind === 'glow' ? D.eq.car : D.eq.glow);
    if (previews[key]) return previews[key];
    const c = document.createElement('canvas'); c.width = c.height = 144; const x = c.getContext('2d');
    x.fillStyle = '#15132b'; x.fillRect(0, 0, 144, 144); x.fillStyle = '#1f1c3d'; x.fillRect(34, 0, 76, 144); x.fillStyle = 'rgba(241,238,255,.25)'; for (let y = 6; y < 144; y += 40) { x.fillRect(33, y, 2, 20); x.fillRect(109, y, 2, 20); }
    const glow = kind === 'glow' ? it : cosItem('glow', D.eq.glow), car = kind === 'car' ? it : cosItem('car', D.eq.car), rgb = glow.c === 'cycle' ? '255,61,203' : glow.c;
    x.translate(72, 74); x.scale(2.6, 2.6);
    if (rgb) { const g = x.createRadialGradient(0, 0, 6, 0, 0, 30); g.addColorStop(0, `rgba(${rgb},.75)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(-30, -30, 60, 60); }
    drawCar(x, car, 900);
    return (previews[key] = c.toDataURL('image/png'));
  }
  const clearPreviews = () => { for (const k in previews) delete previews[k]; };

  function drawTraffic(c, sy, now) {
    const hw = c.w / 2, hl = c.len / 2, x = c.x;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, x - hw + 3, sy - hl + 4, c.w, c.len, 5); ctx.fill();
    ctx.fillStyle = c.col; rr(ctx, x - hw, sy - hl, c.w, c.len, c.kind === 'truck' ? 3 : 6); ctx.fill();
    if (c.kind === 'truck') { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x - hw + 2, sy - hl + 20, c.w - 4, c.len - 24); ctx.fillStyle = '#0b0a1a'; ctx.fillRect(x - hw + 3, sy - hl + 6, c.w - 6, 7); }
    else { ctx.fillStyle = '#0b0a1a'; ctx.fillRect(x - hw + 3, sy - hl + 9, c.w - 6, 7); ctx.fillRect(x - hw + 3, sy + hl - 13, c.w - 6, 5); }
    // lights face the way the car is going: tail lights toward you, or headlights if it is oncoming
    const back = c.onc ? '#fff6c8' : '#ff3c50', front = c.onc ? '#ff3c50' : '#fff6c8';
    ctx.fillStyle = back; ctx.fillRect(x - hw + 1.5, sy + hl - 3, 5, 2.5); ctx.fillRect(x + hw - 6.5, sy + hl - 3, 5, 2.5);
    ctx.fillStyle = front; ctx.fillRect(x - hw + 1.5, sy - hl + .5, 5, 2.5); ctx.fillRect(x + hw - 6.5, sy - hl + .5, 5, 2.5);
    if (c.onc) stamp('gWarm', x, sy + hl + 16, .9, 1.3);
    if (c.lc === 2 && Math.floor(now / 140) % 2) { const side = c.to > c.lane ? 1 : -1; ctx.fillStyle = '#ffb347'; ctx.fillRect(x + side * hw - (side > 0 ? 3 : 0), sy - hl + 2, 3, 4); ctx.fillRect(x + side * hw - (side > 0 ? 3 : 0), sy + hl - 6, 3, 4); stamp('gWarm', x + side * hw, sy + hl - 4, .35); }
  }
  function drawPick(o, sy, now) {
    const x = o.x, k = o.k;
    if (k === 'coin') { stamp('gYellow', x, sy, .42); ctx.fillStyle = '#b38a12'; ctx.beginPath(); ctx.arc(x, sy + 1, 7.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x, sy, 7.5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, sy, 4.4, 0, TAU); ctx.stroke(); return; }
    const p = reduceMotion ? 1 : 1 + Math.sin(now / 170 + x) * .12;
    stamp(k === 'clock' ? 'gGreen' : k === 'nitro' ? 'gCyan' : k === 'shield' ? 'gBlue' : 'gPink', x, sy, .95 * p);
    ctx.fillStyle = '#0b0a1a'; ctx.beginPath(); ctx.arc(x, sy, 11, 0, TAU); ctx.fill();
    ctx.strokeStyle = k === 'clock' ? '#5cf2b0' : k === 'nitro' ? '#3df5ff' : k === 'shield' ? '#8fd3ff' : '#ff3dcb'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.font = '8px "Bungee",Impact,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(k === 'clock' ? '+3' : k === 'nitro' ? 'N' : k === 'shield' ? 'B' : 'M', x, sy + 3);
  }

  // Roadside: one item every 120 units on each side, chosen by where it sits on the route so districts scroll in.
  const SIDE = { city: ['#141230', '#ffd98a'], neon: ['#1a1036', '#ff3dcb'], sky: ['#10142e', '#bfe6ff'] };
  function drawRoadside(now) {
    const first = Math.floor((G.px - (LH - CY) - 60) / 120), last = Math.floor((G.px + CY + 60) / 120);
    for (let i = first; i <= last; i++) {
      const sy = CY - (i * 120 - G.px), kind = G.rush ? 'city' : ZONES[zoneAt(i * 120 / PXM)].kind;
      for (let s = 0; s < 2; s++) {
        const x0 = s ? RX + RW + 6 : 2, w = RX - 8, h = hash(i, s);
        if (kind === 'bridge') {
          ctx.fillStyle = `rgba(143,211,255,${.05 + h * .08})`; ctx.fillRect(x0 + h * 20, sy - 60 - h * 40, 16 + h * 14, 2);
          ctx.fillStyle = '#2a3350'; ctx.fillRect(s ? RX + RW + 2 : RX - 6, sy - 122, 4, 120);
          if (i % 2 === 0) { ctx.fillStyle = '#8a93ad'; ctx.fillRect(s ? RX + RW + 1 : RX - 7, sy - 8, 6, 6); stamp('gWarm', s ? RX + RW + 4 : RX - 4, sy - 5, .6); }
        } else if (kind === 'tunnel') {
          ctx.fillStyle = '#131219'; ctx.fillRect(x0 - 2, sy - 122, w + 4, 122);
          if (i % 2 === 0) { ctx.fillStyle = '#ff9a4d'; ctx.fillRect(s ? RX + RW + 3 : RX - 7, sy - 40, 4, 26); stamp('gWarm', s ? RX + RW + 5 : RX - 5, sy - 27, .8, 1.2); }
        } else if (kind === 'hills') {
          for (let t = 0; t < 2; t++) { const tx = x0 + 8 + hash(i, s + 2 + t) * (w - 16), ty = sy - 30 - t * 55, r = 11 + hash(i, s + 5 + t) * 8; ctx.fillStyle = '#0d2a20'; ctx.beginPath(); ctx.arc(tx, ty, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#184634'; ctx.beginPath(); ctx.arc(tx - 2, ty - 2, r * .6, 0, TAU); ctx.fill(); }
        } else {
          const [body, lit] = SIDE[kind] || SIDE.city, bh = 84 + h * 30;
          ctx.fillStyle = body; ctx.fillRect(x0, sy - bh, w, bh - 8);
          ctx.fillStyle = lit;
          for (let r = 0; r < 5; r++) for (let c2 = 0; c2 < 3; c2++) if (hash(i * 31 + r * 3 + c2, s) > (kind === 'sky' ? .35 : .55)) { ctx.globalAlpha = .35 + hash(i + r, c2 + s) * .5; ctx.fillRect(x0 + 5 + c2 * 12, sy - bh + 7 + r * 14, 7, 6); }
          ctx.globalAlpha = 1;
          if (kind === 'neon' && h > .4) { const col = h > .7 ? '#3df5ff' : '#ff3dcb'; ctx.fillStyle = col; ctx.fillRect(s ? x0 : x0 + w - 4, sy - bh + 10, 4, 40); stamp(h > .7 ? 'gCyan' : 'gPink', s ? x0 + 2 : x0 + w - 2, sy - bh + 30, .7, 1.3); }
          if (i % 3 === 0) stamp('gWarm', s ? RX + RW + 6 : RX - 6, sy - 4, .7);
        }
      }
    }
  }

  function drawDark(a) {
    const fw = fog.width, fh = fog.height;
    fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, fw, fh); fctx.fillStyle = `rgba(4,3,10,${a})`; fctx.fillRect(0, 0, fw, fh);
    fctx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, rx, ry = rx) => fctx.drawImage(sprites.hole.c, (x - rx) / 2, (y - ry) / 2, rx, ry);
    hole(G.x, CY, 90); hole(G.x, CY - 130, 190, 300); hole(G.x, CY - 280, 230, 260);
    for (const c of G.cars) { if (c.hit) continue; const sy = CY - (c.wy - G.px); if (sy > -60 && sy < LH + 60) hole(c.x, sy + (c.onc ? 30 : 0), c.onc ? 90 : 46, c.onc ? 130 : 46); }
    for (const o of G.picks) { if (o.hit) continue; const sy = CY - (o.wy - G.px); if (sy > -30 && sy < LH + 30) hole(o.x, sy, o.k === 'coin' ? 26 : 44); }
    for (let i = Math.floor((G.px - 200) / 240); i <= Math.floor((G.px + CY + 60) / 240); i++) { const sy = CY - (i * 240 - G.px) - 27; hole(RX - 5, sy, 70); hole(RX + RW + 5, sy, 70); }
    ctx.drawImage(fog, 0, 0, LW, LH);
  }

  let darkA = 0;
  const GROUND = { city: '#0d0c1f', neon: '#100a22', bridge: '#07172b', tunnel: '#08080d', hills: '#08130f', sky: '#0b0c20' };
  function drawGame(now) {
    const k = dpr * SC, low = save.settings.fx === 'low', playing = !G.demo, shakeOn = save.settings.shake && !reduceMotion, zk = G.rush ? 'city' : ZONES[zoneAt(G.px / PXM)].kind, zc = G.rush ? '#ffd24a' : ZONES[zoneAt(G.px / PXM)].color;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.save();
    if (G.punch > 0 && shakeOn) { const z = 1 + G.punch * .04; ctx.translate(LW / 2, CY); ctx.scale(z, z); ctx.translate(-LW / 2, -CY); }
    if (G.shake > 0 && shakeOn) ctx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);
    ctx.fillStyle = GROUND[zk]; ctx.fillRect(-20, -20, LW + 40, LH + 40);
    drawRoadside(now);
    // road, edges and lane markings
    ctx.fillStyle = zk === 'tunnel' ? '#121118' : '#1a1830'; ctx.fillRect(RX, -20, RW, LH + 40);
    ctx.fillStyle = zc; ctx.globalAlpha = .9; ctx.fillRect(RX - 3, -20, 3, LH + 40); ctx.fillRect(RX + RW, -20, 3, LH + 40);
    ctx.globalAlpha = .16; ctx.fillRect(RX - 8, -20, 13, LH + 40); ctx.fillRect(RX + RW - 5, -20, 13, LH + 40); ctx.globalAlpha = 1;
    const onc = G.zone >= 4 && !G.rush && playing;
    ctx.strokeStyle = 'rgba(241,238,255,.3)'; ctx.lineWidth = 2; ctx.setLineDash([26, 34]); ctx.lineDashOffset = -(G.px % 60);
    ctx.beginPath(); for (let i = 1; i < LANES; i++) { if (onc && i === 2) continue; const lx = RX + i * LANE_W; ctx.moveTo(lx, -60); ctx.lineTo(lx, LH + 60); } ctx.stroke(); ctx.setLineDash([]);
    if (onc) { ctx.strokeStyle = '#ffd24a'; ctx.beginPath(); for (const o of [-2.5, 2.5]) { ctx.moveTo(RX + 2 * LANE_W + o, -20); ctx.lineTo(RX + 2 * LANE_W + o, LH + 20); } ctx.stroke(); }
    if (playing && G.speed > 11 && !reduceMotion) { ctx.strokeStyle = `rgba(241,238,255,${Math.min(.22, (G.speed - 11) * .03)})`; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 10; i++) { const sx = RX + (i * 97 + 13) % RW, sy = ((i * 131 + G.px * 2.2) % (LH + 80)) - 40; ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 50); } ctx.stroke(); }
    // checkpoint line
    if (playing && !G.rush) { const sy = CY - (G.cpAt * PXM - G.px); if (sy > -40 && sy < LH + 20) { for (let i = 0; i < 20; i++) { ctx.fillStyle = i % 2 ? '#5cf2b0' : '#0b0a1a'; ctx.fillRect(RX + i * 15, sy - 6, 15, 6); ctx.fillStyle = i % 2 ? '#0b0a1a' : '#5cf2b0'; ctx.fillRect(RX + i * 15, sy, 15, 6); } stamp('gGreen', RX - 4, sy, 1); stamp('gGreen', RX + RW + 4, sy, 1); } }

    for (const o of G.picks) { if (o.hit) continue; const sy = CY - (o.wy - G.px); if (sy > -30 && sy < LH + 30) drawPick(o, sy, now); }
    for (const c of G.cars) { if (c.hit) continue; const sy = CY - (c.wy - G.px); if (sy > -70 && sy < LH + 70) drawTraffic(c, sy, now); }
    for (let i = 0; i < pn; i++) { const p = parts[i]; ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    ctx.globalAlpha = 1;

    // your car
    const car = cosItem('car', D.eq.car), glow = cosItem('glow', D.eq.glow);
    stamp('beam', G.x, CY - 122, 1);
    if (glow.c) { if (glow.c === 'cycle') stamp(['gCyan', 'gPink', 'gYellow', 'gGreen'][Math.floor(now / 260) % 4], G.x, CY, 1.25, 1.6); else stamp({ '61,245,255': 'gCyan', '255,61,203': 'gPink', '157,255,61': 'gGreen', '255,179,71': 'gWarm', '160,110,255': 'gPink', '235,245,255': 'gWhite', '255,60,80': 'gRed' }[glow.c] || 'gCyan', G.x, CY, 1.25, 1.6); }
    if (G.burn > 0) stamp('gCyan', G.x, CY + 26, .9, 1.4);
    ctx.save(); ctx.translate(G.x, CY); ctx.rotate(G.ang);
    if (G.inv > 0 && Math.floor(now / 80) % 2) ctx.globalAlpha = .45;
    drawCar(ctx, car, now); ctx.restore(); ctx.globalAlpha = 1;
    if (G.shield) { ctx.strokeStyle = `rgba(143,211,255,${.55 + Math.sin(now / 150) * .2})`; ctx.lineWidth = 2; rr(ctx, G.x - 16, CY - 25, 32, 50, 10); ctx.stroke(); }
    if (G.magT > 0) { ctx.strokeStyle = 'rgba(255,61,203,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(G.x, CY, 150, 0, TAU); ctx.stroke(); }
    ctx.restore();

    darkA += ((zk === 'tunnel' && playing ? .86 : 0) - darkA) * .03;
    if (darkA > .02) drawDark(darkA);
    if (!playing) return;
    // the sky lightens as the night runs out
    const dawn = gstate === 'ending' && G.cause === 'dawn' ? 1 - G.over / 90 * .5 : G.rush ? 0 : clamp(1 - G.clock / 600, 0, 1) * .5;
    if (dawn > 0) { const g = ctx.createLinearGradient(0, 0, 0, LH); g.addColorStop(0, `rgba(255,150,80,${dawn * .7})`); g.addColorStop(.6, `rgba(255,120,150,${dawn * .3})`); g.addColorStop(1, `rgba(255,200,120,${dawn * .12})`); ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH); }

    ctx.textAlign = 'center';
    for (const f of G.floats) { ctx.font = (f.big ? '15px' : '11px') + ' "Bungee",Impact,sans-serif'; ctx.globalAlpha = Math.min(1, f.life / 18); ctx.fillStyle = 'rgba(11,10,26,.85)'; ctx.fillText(f.text, f.x + 1, f.y + 1.5); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
    if (G.flash > 0) { ctx.fillStyle = G.spin > 0 ? `rgba(255,77,109,${G.flash * .3})` : `rgba(160,240,255,${G.flash * .25})`; ctx.fillRect(0, 0, LW, LH); }
    drawHUD(now, zc);
  }

  function drawHUD(now, zc) {
    const F = '"Bungee",Impact,sans-serif', M = '"DM Mono",monospace', z = ZONES[G.zone];
    ctx.textAlign = 'left'; ctx.font = '22px ' + F; ctx.fillStyle = 'rgba(11,10,26,.7)'; ctx.fillText(fmt(G.score), 13, 31); ctx.fillStyle = '#f1eeff'; ctx.fillText(fmt(G.score), 12, 30);
    ctx.font = '9px ' + M; ctx.fillStyle = zc; ctx.fillText(G.rush ? 'RUSH HOUR' : `${z.name.toUpperCase()} · ${(G.px / PXM / 1000).toFixed(2)} KM`, 12, 44);
    let hy = 66;
    if (G.combo > 0) {
      const col = G.combo >= 20 ? '#ffd24a' : '#3df5ff', win = comboWin(up('combo'));
      ctx.font = '17px ' + F; ctx.fillStyle = col; ctx.fillText('x' + mult().toFixed(1), 12, hy);
      ctx.font = '8px ' + M; ctx.fillStyle = '#c9c4e8'; ctx.fillText('COMBO ' + G.combo, 62, hy - 5);
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(62, hy - 2, 60, 3); ctx.fillStyle = col; ctx.fillRect(62, hy - 2, 60 * G.comboT / win, 3); hy += 20;
    }
    if (G.burn > 0) { ctx.font = '9px ' + F; ctx.fillStyle = '#3df5ff'; ctx.fillText('NITRO · 2X POINTS', 12, hy); hy += 14; }
    if (G.drafting) { ctx.font = '9px ' + F; ctx.fillStyle = '#b48cff'; ctx.fillText('DRAFTING · NITRO FILLING', 12, hy); }

    // the night clock
    const secs = G.clock / 60, lowT = secs < 10, cs = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}.${Math.floor(secs * 10 % 10)}`;
    ctx.textAlign = 'right'; ctx.font = (lowT && Math.floor(now / 250) % 2 ? '24px ' : '22px ') + F; ctx.fillStyle = lowT ? '#ff4d6d' : secs < 20 ? '#ffb347' : '#f1eeff'; ctx.fillText(cs, LW - 12, 30);
    ctx.font = '8px ' + M; ctx.fillStyle = '#c9c4e8';
    let ry = 38;
    if (G.rush) ctx.fillText('TIME LEFT', LW - 12, 43);
    else { const left = Math.max(0, G.cpAt - G.px / PXM); ctx.fillText(`CHECKPOINT ${Math.ceil(left)} M`, LW - 12, 43); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(LW - 72, 47, 60, 3); ctx.fillStyle = '#5cf2b0'; ctx.fillRect(LW - 72, 47, 60 * (1 - left / CP_GAP), 3); }
    ry = 56;
    // achievements: a small pill in the corner, never over the road ahead
    const tt = G.toasts[0];
    if (tt && tt.ach) {
      const a = tt.ach, tier = TIERS[a.tier], age = tt.max - tt.life, more = G.toasts.filter(x => x.ach).length - 1;
      ctx.font = '9px ' + F; const label = a.n.toUpperCase() + (more > 0 ? `  +${more} MORE` : ''), w = Math.min(200, ctx.measureText(label).width + 34), x = LW - 10 - w, y = ry;
      ctx.globalAlpha = Math.min(.92, tt.life / 20, age / 6); ctx.fillStyle = 'rgba(11,10,26,.9)'; rr(ctx, x, y, w, 20, 10); ctx.fill(); ctx.strokeStyle = tier.c; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillStyle = tier.c; ctx.fillText('★', x + 8, y + 14); ctx.fillStyle = '#f1eeff'; ctx.fillText(label, x + 22, y + 14); ctx.globalAlpha = 1;
    } else if (tt) {
      ctx.globalAlpha = Math.min(1, tt.life / 25); ctx.font = '9px ' + F; ctx.textAlign = 'center';
      const w = Math.min(LW - 16, ctx.measureText(tt.text).width + 24), y = 96;
      ctx.fillStyle = 'rgba(11,10,26,.88)'; rr(ctx, LW / 2 - w / 2, y - 15, w, 22, 11); ctx.fill(); ctx.strokeStyle = tt.c; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = tt.c; ctx.fillText(tt.text, LW / 2, y); ctx.globalAlpha = 1;
    }
    // nitro tank and speed along the bottom
    const nx = LW / 2 - 63, ny = LH - 26;
    for (let i = 0; i < 3; i++) { const f = clamp(G.nitro - i, 0, 1); ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, nx + i * 44, ny, 38, 9, 4); ctx.fill(); if (f > 0) { ctx.fillStyle = f >= 1 ? '#3df5ff' : 'rgba(61,245,255,.5)'; rr(ctx, nx + i * 44, ny, 38 * f, 9, 4); ctx.fill(); } }
    ctx.font = '8px ' + M; ctx.textAlign = 'center'; ctx.fillStyle = G.nitro >= 1 && G.burn <= 0 ? '#3df5ff' : '#7b7799'; ctx.fillText(G.burn > 0 ? 'BURNING' : G.nitro >= 1 ? (usedTouch ? 'NITRO READY' : keyFor('nitro').toUpperCase() + ': NITRO') : 'NITRO', LW / 2, ny - 5);
    ctx.textAlign = 'left'; ctx.font = '16px ' + F; ctx.fillStyle = '#f1eeff'; ctx.fillText(kmhOf(G.speed), 12, LH - 18); ctx.font = '8px ' + M; ctx.fillStyle = '#c9c4e8'; ctx.fillText('KM/H', 12 + ctx.measureText('000').width + 22, LH - 18);
    if (G.banner > 0 && gstate === 'run' && !G.rush) { ctx.globalAlpha = Math.min(1, G.banner / 30, (150 - G.banner) / 15 + .2); ctx.textAlign = 'center'; ctx.font = '26px ' + F; ctx.fillStyle = z.color; ctx.fillText(z.name.toUpperCase(), LW / 2, LH * .34); ctx.globalAlpha = 1; }
    if (gstate === 'ending') { ctx.globalAlpha = 1 - G.over / 90; ctx.textAlign = 'center'; ctx.font = '30px ' + F; ctx.fillStyle = '#fff2b0'; ctx.fillText(G.rush ? "TIME'S UP" : 'DAWN', LW / 2, LH * .4); ctx.globalAlpha = 1; }
    if (stick && !stick.sides && gstate === 'run') { const dx = clamp(stick.x - stick.ox, -STICK_R, STICK_R) / SC, ox = stick.ox / SC, oy = stick.y / SC, sr = STICK_R / SC; ctx.globalAlpha = .22; ctx.strokeStyle = '#f1eeff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox - sr, oy); ctx.lineTo(ox + sr, oy); ctx.stroke(); ctx.globalAlpha = .5; ctx.fillStyle = '#f1eeff'; ctx.beginPath(); ctx.arc(ox + dx, oy, 8, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  }
