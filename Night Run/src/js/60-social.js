  /* ================= friends, friend ghosts and the admin panel ================= */
  // Ghosts travel as base64: the start position, then 3 bytes per sample (x across the slope 0-1000, distance moved).
  function packGhost(r) {
    const n = r.length >> 1, b = new Uint8Array(4 + n * 3), d0 = Math.max(0, r[1] | 0);
    b[0] = d0 >>> 24 & 255; b[1] = d0 >>> 16 & 255; b[2] = d0 >>> 8 & 255; b[3] = d0 & 255;
    let prev = d0;
    for (let i = 0; i < n; i++) { const x = clamp(r[i * 2] | 0, 0, 1000), dd = clamp((r[i * 2 + 1] | 0) - prev, 0, 255); prev += dd; b[4 + i * 3] = x >> 8; b[5 + i * 3] = x & 255; b[6 + i * 3] = dd; }
    let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
    return btoa(s);
  }
  function unpackGhost(str) {
    const bin = atob(str), r = [];
    let d = ((bin.charCodeAt(0) << 24) | (bin.charCodeAt(1) << 16) | (bin.charCodeAt(2) << 8) | bin.charCodeAt(3)) >>> 0;
    for (let i = 4; i + 2 < bin.length; i += 3) { d += bin.charCodeAt(i + 2); r.push(Math.min(1000, (bin.charCodeAt(i) << 8) | bin.charCodeAt(i + 1)), d); }
    return r;
  }
  function uploadGhost(mode, s, rec) {
    if (!save.acct || !accountsOn() || (mode !== 'free' && mode !== 'daily') || rec.length > 120000) return;
    rpc('ng_save_ghost', { p_token: save.acct.token, p_game: 'run', p_kind: mode, p_period: mode === 'daily' ? dayKey : '', p_score: s, p_data: packGhost(rec) }).catch(() => {});
  }

  const fr = { list: [], incoming: [], outgoing: [], st: 'idle', msg: null, busy: false, at: 0 };
  let friendReqs = 0;
  const canSocial = () => accountsOn() && !!save.acct;
  async function loadFriends() {
    if (!canSocial() || fr.loading) return;
    fr.loading = true;
    try {
      const r = await rpc('ng_friends', { p_token: save.acct.token, p_period: dayKey });
      fr.list = (r && r.friends) || []; fr.incoming = (r && r.incoming) || []; fr.outgoing = (r && r.outgoing) || []; fr.st = 'ready'; fr.at = Date.now(); friendReqs = fr.incoming.length;
    } catch (e) { if (loggedOut(e)) { fr.loading = false; return signedOut('You were logged out. Log in again.'); } if (fr.st !== 'ready') fr.st = 'error'; }
    fr.loading = false;
    if (!overlay.hidden && view === 'friends') render();
  }
  async function friendDo(fn, args, ok) {
    if (fr.busy || !canSocial()) return;
    fr.busy = true; fr.msg = null; render();
    try { const r = await rpc(fn, Object.assign({ p_token: save.acct.token }, args)); fr.msg = r && r.error ? { t: r.error } : ok ? { ok: true, t: typeof ok === 'function' ? ok(r) : ok } : null; if (!(r && r.error)) sfx.buy(); }
    catch (e) { fr.msg = { t: "That didn't go through. Check your connection and try again." }; }
    fr.busy = false; fr.at = 0; await loadFriends(); if (view === 'friends') render();
  }
  const seenText = ts => { const m = Math.max(0, Math.round((Date.now() - Date.parse(ts)) / 60000)); return !ts ? '' : m < 6 ? 'online now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
  VIEWS.friends = () => {
    const top = `${backBtn()}<h2>Friends</h2>`;
    if (!canSocial()) return top + `<p>${accountsOn() ? 'Log in to add friends, compare scores and race their ghosts.' : "Friends aren't available right now."}</p>${accountsOn() ? `<button class="go violet" type="button" data-act="go:account">Log in with Night Studios</button>` : ''}`;
    if (Date.now() - fr.at > 15000) loadFriends();
    const msg = fr.msg ? `<p class="${fr.msg.ok ? 'ok' : 'err'}" role="alert">${esc(fr.msg.t)}</p>` : '';
    const add = `<form class="box" id="friendForm" novalidate><label for="friendName">Add a friend by username</label><div class="inline"><input id="friendName" type="text" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Their username"><button class="buy" type="submit" ${fr.busy ? 'disabled' : ''}>Add</button></div></form>`;
    const reqs = fr.incoming.length || fr.outgoing.length ? `<div class="box"><h3>Requests</h3>${fr.incoming.map(r => `<div class="item" style="padding:5px 0"><span><b>${esc(r.name)}</b> wants to be friends</span><span><button type="button" class="buy" data-act="fryes:${esc(r.id)}">Accept</button> <button type="button" class="buy ghost" data-act="frno:${esc(r.id)}">No</button></span></div>`).join('')}${fr.outgoing.map(r => `<div class="item" style="padding:5px 0"><span>Waiting on <b>${esc(r.name)}</b></span><button type="button" class="buy ghost" data-act="frno:${esc(r.id)}">Cancel</button></div>`).join('')}</div>` : '';
    const me = { me: true, name: playerName(), color: save.flair.color, title: save.flair.title, level: level(), best: R.best, park: R.bestPark };
    const rows = fr.list.concat([me]).sort((a, b) => int(b.best) - int(a.best)).map((f, i) => `<div class="box"><div class="item"><span><span class="ttl" style="margin:0 6px 0 0">#${i + 1}</span>${nameHTML(String(f.name || 'Player').slice(0, 16), f.color, f.title)}${f.me ? ' (you)' : ''}</span><span class="sub">Lv ${int(f.level) || 1}${f.me ? '' : ' · ' + esc(seenText(f.last_seen))}</span></div>
        <p class="sub">Free Ride ${f.best ? fmt(f.best) : '–'} · Today ${f.daily ? fmt(f.daily) : '–'} · Park ${f.park ? fmt(f.park) : '–'}</p>
        ${f.me ? '' : `<div class="row3" style="margin-top:8px"><button type="button" class="buy" data-act="ghost:${esc(f.id)}.free" ${f.ghost_free ? '' : 'disabled'}>Race best</button><button type="button" class="buy" data-act="ghost:${esc(f.id)}.daily" ${f.ghost_daily ? '' : 'disabled'}>Race today</button>${armBtn('frno:' + esc(f.id), 'Remove', 'Sure?')}</div>`}</div>`).join('');
    const list = fr.list.length ? `<div class="list">${rows}</div><p class="sub">Racing a ghost drops you onto the mountain next to a replay of their best run. Beat their score to win.</p>` : fr.st === 'ready' ? `<p>No friends yet. Add someone by their username.</p>` : fr.st === 'error' ? `<p>Couldn't load your friends. Try again in a minute.</p>` : `<p>Loading…</p>`;
    return top + msg + add + reqs + list;
  };
  FORMS.friendForm = () => { const n = cleanName($('friendName').value); if (n) friendDo('ng_friend_request', { p_username: n }, r => r.friends ? `You and ${r.name} are friends now.` : `Request sent to ${r.name}.`); };
  ACTIONS.fryes = id => friendDo('ng_friend_respond', { p_id: id, p_accept: true }, "You're friends now.");
  ACTIONS.frno = id => friendDo('ng_friend_respond', { p_id: id, p_accept: false }, null);
  ACTIONS.ghost = async s => {
    const [id, kind] = s.split('.'); if (!canSocial() || fr.busy) return;
    fr.busy = true; fr.msg = { ok: true, t: 'Loading their ghost…' }; render();
    try {
      const g = await rpc('ng_get_ghost', { p_token: save.acct.token, p_id: id, p_game: 'run', p_kind: kind, p_period: kind === 'daily' ? dayKey : '' });
      fr.busy = false;
      if (!g || g.error) { fr.msg = { t: (g && g.error) || 'No ghost to race yet.' }; return render(); }
      const r = unpackGhost(g.data); if (r.length < 8) { fr.msg = { t: 'That ghost is too short to race.' }; return render(); }
      fr.msg = null; pendingGhost = { mode: kind, name: String(g.name || 'Friend').slice(0, 16), s: int(g.score), r };
      startRun(kind);
    } catch (e) { fr.busy = false; fr.msg = { t: "Couldn't load that ghost. Try again in a minute." }; render(); }
  };

  /* ---------- admin panel (only shown to admin accounts; the server checks every call) ---------- */
  const adm = { ov: null, msg: null, busy: false, at: 0 };
  async function admLoad() {
    if (adm.loading || !save.acct) return; adm.loading = true;
    try { adm.ov = await rpc('ng_admin_overview', { p_token: save.acct.token }); takeConfig(adm.ov && adm.ov.config); adm.at = Date.now(); }
    catch (e) { adm.msg = { t: /Not an admin/.test(e.message) ? "This account isn't an admin." : "Couldn't load the admin panel." }; adm.at = Date.now(); }
    adm.loading = false; if (!overlay.hidden && view === 'admin') render();
  }
  async function admDo(fn, args, ok) {
    if (adm.busy || !save.acct) return; adm.busy = true; adm.msg = null; render();
    try { const r = await rpc(fn, Object.assign({ p_token: save.acct.token }, args)); adm.msg = r && r.error ? { t: r.error } : { ok: true, t: typeof ok === 'function' ? ok(r) : ok }; if (r && 'now' in r) takeConfig(r); }
    catch (e) { adm.msg = { t: /Not an admin/.test(e.message) ? "This account isn't an admin." : "That didn't go through. Try again." }; }
    adm.busy = false; adm.at = 0; admLoad(); render();
  }
  VIEWS.admin = () => {
    if (!save.acct || !save.acct.admin) return `${backBtn()}<h2>Admin</h2><p>This account isn't an admin.</p>`;
    if (Date.now() - adm.at > 30000) admLoad();
    const o = adm.ov, dis = adm.busy ? 'disabled' : '', hours = id => `<select id="${id}" style="padding:10px;border-radius:10px;background:var(--bg2);color:var(--snow);border:1px solid var(--line)">${[[1, '1 hour'], [6, '6 hours'], [24, '1 day'], [72, '3 days'], [168, '1 week']].map(([h, l]) => `<option value="${h}"${h === 24 ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    const msgOn = cfg.msg && cfg.msgEnds > Date.now(), evOn = cfg.ev && cfg.evEnds > Date.now();
    return `${backBtn()}<h2>Admin</h2>${adm.msg ? `<p class="${adm.msg.ok ? 'ok' : 'err'}" role="alert">${esc(adm.msg.t)}</p>` : ''}
      ${o ? `<div class="stats">${stat('Players', fmt(o.players))}${stat('Active 24 h', fmt(o.active))}${stat('New 24 h', fmt(o.new))}${stat('Scores', fmt(o.scores))}${stat('Banned', fmt(o.banned))}</div>` : '<p>Loading…</p>'}
      <form class="box" id="admAnn" novalidate><h3>Announcement <b>${msgOn ? leftText(cfg.msgEnds - Date.now()) + ' left' : 'off'}</b></h3><input id="admAnnText" type="text" maxlength="200" placeholder="Shown on everyone's home screen" value="${msgOn ? esc(cfg.msg) : ''}"><div class="inline">${hours('admAnnHrs')}<span><button class="buy" type="submit" ${dis}>Post</button> <button class="buy ghost" type="button" data-act="admannoff" ${dis}>Take down</button></span></div></form>
      <form class="box" id="admEv" novalidate><h3>Event <b>${evOn ? esc(cfg.ev) + ' · ' + leftText(cfg.evEnds - Date.now()) + ' left' : 'off'}</b></h3><div class="inline"><select id="admEvKind" style="padding:10px;border-radius:10px;background:var(--bg2);color:var(--snow);border:1px solid var(--line)">${[['xp2', 'Double XP'], ['flakes2', 'Double flakes'], ['both2', 'Double both'], ['xp3', 'Triple XP'], ['flakes3', 'Triple flakes'], ['both3', 'Triple both']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>${hours('admEvHrs')}</div><span><button class="buy" type="submit" ${dis}>Start</button> <button class="buy ghost" type="button" data-act="admevoff" ${dis}>End it</button></span></form>
      <form class="box" id="admGift" novalidate><h3>Gift flakes</h3><div class="inline"><input id="admGiftName" type="text" maxlength="16" autocomplete="off" placeholder="Username, or * for everyone"><input id="admGiftAmt" type="text" inputmode="numeric" maxlength="7" placeholder="Flakes" style="width:110px"></div><button class="buy" type="submit" ${dis}>Send gift</button></form>
      <form class="box" id="admBan" novalidate><h3>Leaderboard ban</h3><div class="inline"><input id="admBanName" type="text" maxlength="16" autocomplete="off" placeholder="Username"><span><button class="buy" type="submit" ${dis}>Ban</button> <button class="buy ghost" type="button" data-act="admunban" ${dis}>Unban</button></span></div><p class="sub">Banned players keep playing but disappear from every board.</p></form>
      ${statsHTML()}
      ${o && o.recent ? `<div class="box"><h3>Recently active</h3><ol class="lb">${o.recent.map(p => `<li><span class="n">${int(p.level)}</span><span>${esc(p.name)}${p.admin ? ' <span class="ttl">admin</span>' : ''}${p.banned ? ' <span class="ttl" style="color:var(--rose)">banned</span>' : ''} <span class="sub">· ${esc(seenText(p.last_seen))}</span></span><b>${p.best ? fmt(p.best) : '–'}</b></li>`).join('')}</ol></div>` : ''}`;
  };
  FORMS.admAnn = () => { const t = $('admAnnText').value.trim(); if (!t) { adm.msg = { t: 'Type the announcement first.' }; return render(); } admDo('ng_admin_announce', { p_message: t, p_hours: +$('admAnnHrs').value }, 'Announcement posted.'); };
  ACTIONS.admannoff = () => admDo('ng_admin_announce', { p_message: '', p_hours: 0 }, 'Announcement taken down.');
  FORMS.admEv = () => admDo('ng_admin_event', { p_event: $('admEvKind').value, p_hours: +$('admEvHrs').value }, 'Event started.');
  ACTIONS.admevoff = () => admDo('ng_admin_event', { p_event: null, p_hours: 0 }, 'Event ended.');
  FORMS.admGift = () => { const n = $('admGiftName').value.trim(), v = parseInt($('admGiftAmt').value.replace(/[, ]/g, ''), 10); if (!n || !(v >= 1)) { adm.msg = { t: 'Enter a username (or *) and an amount.' }; return render(); } admDo('ng_admin_gift', { p_username: n, p_flakes: v }, r => `Sent ${fmt(v)} flakes to ${r.players === 1 && r.username ? r.username : fmt(r.players) + ' players'}. They get it next time they open the game.`); };
  const banName = () => $('admBanName').value.trim();
  FORMS.admBan = () => { if (banName()) admDo('ng_admin_ban', { p_username: banName(), p_banned: true }, r => `${r.username} is banned from the boards.`); };
  ACTIONS.admunban = () => { if (banName()) admDo('ng_admin_ban', { p_username: banName(), p_banned: false }, r => `${r.username} can post scores again.`); };

  /* ---------- player data: where and how runs end, for balancing every game ---------- */
  const STAT_GAMES = {
    run: { n: 'Night Run', bucket: 250, unit: m => fmt(m) + ' m', zones: ZONES.map(z => z.name), causes: { tree: 'Tree', rock: 'Rock', skier: 'Skier', snowman: 'Snowman', crev: 'Crevasse', landing: 'Bad landing', time: 'Trick Park timer', crash: 'Crash' } },
    drive: { n: 'Night Drive', bucket: 500, unit: m => (m / 1000).toFixed(2) + ' km', zones: ['Downtown', 'Neon Strip', 'Harbor Bridge', 'The Tunnel', 'Hill Pass', 'Skyline'], causes: { dawn: 'Ran out of night', time: 'Rush Hour timer' },
      hits: { car: 'Car', van: 'Van', truck: 'Truck', oncoming: 'Oncoming car', lanechange: 'Lane changer' } },
    watch: { n: 'Night Watch', bucket: 2, unit: m => m + ' waves', zones: Array.from({ length: 21 }, (_, i) => 'Night ' + (i + 1)), causes: { shade: 'Shade got through', runner: 'Runner got through', brute: 'Brute got through', wisp: 'Wisp got through', eclipse: 'Eclipse got through', fire: 'Fire went out' } },
    heist: { n: 'Night Heist', bucket: 1, unit: m => m + ' floors', zones: Array.from({ length: 21 }, (_, i) => 'Floor ' + (i + 1)), causes: { guard: 'Caught by a guard', light: 'Caught in a searchlight' } },
  };
  const ast = { game: 'run', days: 7, data: null, st: 'idle', key: '' };
  async function admStats() {
    if (!save.acct) return;
    const key = ast.game + ast.days; ast.key = key; ast.st = 'loading';
    try { const d = await rpc('ng_admin_stats', { p_token: save.acct.token, p_game: ast.game, p_days: ast.days, p_bucket: STAT_GAMES[ast.game].bucket }); if (ast.key !== key) return; ast.data = d || {}; ast.st = 'ready'; }
    catch (e) { if (ast.key !== key) return; ast.st = 'error'; }
    if (!overlay.hidden && view === 'admin') render();
  }
  ACTIONS.astg = g => { if (STAT_GAMES[g]) { ast.game = g; ast.data = null; admStats(); render(); } };
  ACTIONS.astd = d => { ast.days = +d || 7; ast.data = null; admStats(); render(); };
  function statsHTML() {
    const G0 = STAT_GAMES[ast.game], d = ast.data;
    const tabs = `<div class="tabs">${Object.keys(STAT_GAMES).map(g => `<button type="button" data-act="astg:${g}" aria-pressed="${ast.game === g}">${STAT_GAMES[g].n}</button>`).join('')}</div>
      <div class="tabs">${[[1, '24 hours'], [7, '7 days'], [30, '30 days'], [90, '90 days']].map(([n, l]) => `<button type="button" data-act="astd:${n}" aria-pressed="${ast.days === n}">${l}</button>`).join('')}</div>`;
    if (ast.st === 'idle') { admStats(); }
    if (!d) return `<div class="box"><h3>Player data</h3>${tabs}<p>${ast.st === 'error' ? "Couldn't load the data." : 'Loading…'}</p></div>`;
    const runs = int(d.runs), pct = (n, of) => of ? Math.round(n / of * 100) + '%' : '–';
    const rn = n => fmt(n) + (int(n) === 1 ? ' run' : ' runs');
    const bar = (label, n, of, note) => `<div style="margin-top:7px"><div class="setrow" style="padding:0;font-size:12px"><span>${esc(label)}</span><span class="sub">${note}</span></div>${progBar(of ? n / of : 0)}</div>`;
    if (!runs && !int(d.restarts) && !int(d.quits)) return `<div class="box"><h3>Player data</h3>${tabs}<p>No runs recorded for ${G0.n} in this period yet.</p></div>`;
    const all = runs + int(d.restarts) + int(d.quits);
    const causes = (d.causes || []).map(c => bar(G0.causes[c.c] || (c.c === 'restart' ? 'Restarted' : c.c === 'quit' ? 'Quit' : c.c), c.n, all, `${pct(c.n, all)} · ${fmt(c.n)} · typical ${G0.unit(int(c.med))}`)).join('');
    const zones = (d.zones || []).map(z => bar(G0.zones[z.z] || 'Zone ' + z.z, z.reached, runs, `${pct(z.reached, runs)} reach it · ${pct(z.ended, runs)} end here`)).join('');
    const maxB = Math.max(1, ...(d.buckets || []).map(b => b.n));
    const buckets = (d.buckets || []).map(b => bar(`${G0.unit(b.b * G0.bucket)}${b.b >= 23 ? '+' : ' – ' + G0.unit((b.b + 1) * G0.bucket)}`, b.n, maxB, `${fmt(b.n)} · ${pct(b.n, runs)}`)).join('');
    const zc = {}; for (const r of d.zoneCauses || []) (zc[r.z] = zc[r.z] || []).push(`${G0.causes[r.c] || r.c} ${fmt(r.n)}`);
    const zoneWhy = Object.keys(zc).map(z => `<p class="sub"><b>${esc(G0.zones[z] || 'Zone ' + z)}:</b> ${esc(zc[z].join(' · '))}</p>`).join('');
    const hitTot = (d.hits || []).reduce((n, h) => n + h.n, 0), byKind = {}; for (const h of d.hits || []) byKind[h.k] = (byKind[h.k] || 0) + h.n;
    const hits = G0.hits && hitTot ? `<h3 style="margin-top:14px">Crashes along the way <b>${fmt(hitTot)} total · ${(hitTot / Math.max(1, runs)).toFixed(1)} per drive</b></h3>${Object.keys(byKind).sort((a, b) => byKind[b] - byKind[a]).map(k => bar(G0.hits[k] || k, byKind[k], hitTot, `${pct(byKind[k], hitTot)} · ${fmt(byKind[k])}`)).join('')}
      ${G0.zones.map((zn, i) => { const n = (d.hits || []).filter(h => h.z === i).reduce((a, h) => a + h.n, 0); return n ? `<p class="sub"><b>${esc(zn)}:</b> ${fmt(n)} crashes (${(d.hits || []).filter(h => h.z === i).map(h => `${G0.hits[h.k] || h.k} ${h.n}`).join(' · ')})</p>` : ''; }).join('')}` : '';
    const sideN = ['Far left', 'Left', 'Middle', 'Right', 'Far right'], sideT = (d.sides || []).reduce((n, s) => n + s.n, 0);
    const sides = (d.sides || []).map(s => `${sideN[s.s]} ${pct(s.n, sideT)}`).join(' · ');
    const small = (title, rows) => rows.length ? `<p class="sub"><b>${title}:</b> ${rows.join(' · ')}</p>` : '';
    return `<div class="box"><h3>Player data <b>${G0.n} · last ${ast.days === 1 ? '24 hours' : ast.days + ' days'}</b></h3>${tabs}
      <div class="stats" style="margin-top:10px">${stat('Runs', fmt(runs))}${stat('Players', fmt(d.players))}${stat('Typical run', G0.unit(int(d.medianM)))}${stat('Top 10% reach', G0.unit(int(d.p90M)))}${stat('Typical time', int(d.medianS) + ' s')}${stat('Typical score', fmt(d.medianScore))}</div>
      <h3 style="margin-top:14px">What ends runs <b>${pct(int(d.restarts), all)} restarted · ${pct(int(d.quits), all)} quit</b></h3>${causes}
      <h3 style="margin-top:14px">How far players get</h3>${zones}${zoneWhy}
      <h3 style="margin-top:14px">Where runs end</h3>${buckets}${hits}
      <h3 style="margin-top:14px">Who is playing</h3>
      ${small('By mode', (d.modes || []).map(m => `${esc(m.mode || '?')} ${rn(m.n)}, typical ${G0.unit(int(m.med))}, score ${fmt(m.score)}`))}
      ${small('Controls', (d.devices || []).map(v => `${v.touch === true ? 'Touch' : v.touch === false ? 'Keyboard' : 'Unknown'} ${rn(v.n)}, typical ${G0.unit(int(v.med))}`))}
      ${small('Experience', (d.experience || []).map(x => `${['', 'First 5 runs', 'Runs 6 to 25', 'Over 25 runs'][x.g]}: ${rn(x.n)}, typical ${G0.unit(int(x.med))}`))}
      ${small('Where on the screen runs end', sides ? [sides] : [])}
      ${small('By version', (d.versions || []).map(v => `${esc(v.version || '?')}: ${rn(v.n)}, typical ${G0.unit(int(v.med))}`))}</div>`;
  }
