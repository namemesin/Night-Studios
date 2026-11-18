/* NIGHT STUDIOS: the part every page shares.
   - the one place the server address lives (every game reads it from here)
   - the studio login, announcements and events
   - games the owner has taken down are blocked here, for everyone but the owner
   - run tickets: the server only accepts a score for a run it saw start
   - the Admin and Owner panel, with player data for every game

   About the key below: it is Supabase's "publishable" key, and it is public on purpose. A website has to send it
   with every request, so it cannot be hidden from anyone who opens the page. It unlocks nothing by itself: every
   table is closed to it, and it can only call the ng_ functions, which check logins, admin rights and fair play
   on the server. The secret (service_role) key is the one that must never appear in this project. */
(() => {
  'use strict';
  const SERVER = 'https://bpspwjzxglazmonacbtr.supabase.co', KEY = 'sb_publishable_PCt45qNSdR6dPRehXvr4KQ_YeLWpE9Q';
  const OFFLINE = /[?&]offline\b/.test(location.search), GAME = document.documentElement.dataset.game || '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.floor(+n || 0).toLocaleString('en-US'), int = v => Math.max(0, Math.floor(+v || 0));
  const km = m => (m / 1000).toFixed(2) + ' km', nth = (n, w) => n + ' ' + w + (n === 1 ? '' : 's'), seq = w => Array.from({ length: 21 }, (_, i) => w + ' ' + (i + 1));
  // Every game on the site. A new game is added here and in build.py.
  const GAMES = {
    run: { n: 'Night Snowboard', coin: 'flakes', boards: ['free', 'daily', 'park'], bucket: 250, unit: m => fmt(m) + ' m', zones: ['Bunny Slope', 'Blue Ridge', 'Black Diamond', 'Double Black', 'Backcountry', 'The Summit', 'Aurora Peak'], causes: { tree: 'Tree', rock: 'Rock', skier: 'Skier', snowman: 'Snowman', crev: 'Crevasse', landing: 'Bad landing', time: 'Trick Park timer', crash: 'Crash' } },
    watch: { n: 'Night Watch', coin: 'coins', boards: ['free', 'daily'], bucket: 2, unit: m => nth(m, 'wave'), zones: seq('Night'), causes: { shade: 'Shade got through', runner: 'Runner got through', brute: 'Brute got through', wisp: 'Wisp got through', eclipse: 'Eclipse got through', fire: 'Fire went out' } },
    heist: { n: 'Night Heist', coin: 'coins', boards: ['free', 'daily'], bucket: 1, unit: m => nth(m, 'floor'), zones: seq('Floor'), causes: { guard: 'Caught by a guard', light: 'Caught in a searchlight' } },
    drive: { n: 'Night Drive', coin: 'coins', boards: ['free', 'daily', 'rush'], bucket: 500, unit: km, zones: ['Downtown', 'Neon Strip', 'Harbor Bridge', 'The Tunnel', 'Hill Pass', 'Skyline'], causes: { dawn: 'Ran out of night', time: 'Rush Hour timer' }, hits: { car: 'Car', van: 'Van', truck: 'Truck', oncoming: 'Oncoming car', lanechange: 'Lane changer' } },
    market: { n: 'Night Market', coin: 'coins', boards: ['free', 'daily'], bucket: 1, unit: m => nth(m, 'night'), zones: seq('Night'), causes: { rent: 'Could not pay the rent' } },
    rally: { n: 'Night Drift', coin: 'coins', boards: ['free', 'daily'], bucket: 1, unit: m => nth(m, 'quarter lap'), zones: ['Lap 1', 'Lap 2', 'Lap 3', 'Finished'], causes: { finish: 'Finished all three laps', time: 'Ran out of time' } },
    keep: { n: 'Night Keep', coin: 'coins', boards: ['free', 'daily'], bucket: 2, unit: m => nth(m, 'wave'), zones: ['Moonlit Meadow', 'Dusk Canyon', 'Frozen Pass', 'Murky Swamp', 'Ember Peak', 'Crystal Cavern'], causes: { lives: 'Keep fell', won: 'Banked a won map', slime: 'Slime got in', bat: 'Bat got in', blob: 'Blob got in', knight: 'Knight got in', golem: 'Golem got in', swarm: 'Bug got in', shaman: 'Healer got in', imp: 'Imp got in', beetle: 'Beetle got in', ghost: 'Ghost got in', hexer: 'Hexer got in', boss: 'Demon got in', lich: 'Lich got in' } },
  };

  /* ---------- login, shared by every page through one key in this browser ---------- */
  const ACCT = 'nightstudios-acct';
  function acct() { try { const raw = localStorage.getItem(ACCT); if (raw === null) return undefined; const a = JSON.parse(raw); return a && typeof a.token === 'string' ? a : null; } catch (e) { return null; } }
  function setAcct(a) { try { localStorage.setItem(ACCT, JSON.stringify(a ? { id: String(a.id), username: String(a.username), token: a.token, admin: !!a.admin, owner: !!a.owner } : null)); } catch (e) {} }
  async function rpc(fn, body) {
    const r = await fetch(SERVER + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) { const err = new Error((data && data.message) || 'HTTP ' + r.status); err.status = r.status; throw err; }
    return data;
  }
  const token = () => (acct() || {}).token || null;

  /* ---------- announcements, events and hidden games ---------- */
  let cfg = { msg: '', msgEnds: 0, ev: '', evEnds: 0, hidden: [] }, me = { admin: false, owner: false };
  const hooks = [];
  function takeConfig(c) {
    if (!c) return;
    const now = Date.parse(c.now) || Date.now(), rel = t => t ? Date.now() + (Date.parse(t) - now) : 0;
    cfg = { msg: c.message ? String(c.message).slice(0, 200) : '', msgEnds: rel(c.message_until), ev: /^(flakes|xp|both)[23]$/.test(c.event || '') ? c.event : '', evEnds: rel(c.event_until), hidden: Array.isArray(c.hidden) ? c.hidden.map(String) : [] };
    guard(); for (const f of hooks) try { f(); } catch (e) {}
  }
  // 2 or 3 during a double or triple event for 'coins' or 'xp', otherwise 1
  function eventMult(kind) { if (!cfg.ev || cfg.evEnds <= Date.now()) return 1; const m = /^(flakes|xp|both)([23])$/.exec(cfg.ev); return m && (m[1] === 'both' || (m[1] === 'xp') === (kind === 'xp')) ? +m[2] : 1; }
  const leftText = ms => { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`; };
  const evLabel = ev => { const m = /^(flakes|xp|both)([23])$/.exec(ev || ''); return m ? (m[2] === '3' ? 'Triple ' : 'Double ') + (m[1] === 'xp' ? 'XP' : m[1] === 'flakes' ? 'coins' : 'coins and XP') : ''; };
  function notesHTML() {
    let h = '';
    if (cfg.msg && cfg.msgEnds > Date.now()) h += `<div class="box" style="border-color:var(--ice)"><h3>Announcement</h3><p>${esc(cfg.msg)}</p></div>`;
    if (eventMult('xp') > 1 || eventMult('coins') > 1) h += `<div class="box" style="border-color:var(--gold)"><h3>${esc(evLabel(cfg.ev))} <b>${leftText(cfg.evEnds - Date.now())} left</b></h3><p>On every run, in every game.</p></div>`;
    return h;
  }
  const hidden = g => cfg.hidden.includes(g);
  // A game the owner has taken down shows this instead of the game. The owner still gets in, with a reminder.
  function guard() {
    let el = document.getElementById('studioGuard');
    const blocked = GAME && hidden(GAME);
    if (!blocked) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'studioGuard'; document.body.appendChild(el); }
    if (me.owner) { el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:40;padding:6px 10px;background:#5a2430;color:#fff;font:11px/1.4 var(--mono,monospace);text-align:center'; el.textContent = 'This game is hidden. Only you, the owner, can open it.'; }
    else { el.style.cssText = 'position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:24px;background:var(--bg,#0a1020);color:var(--snow,#e8eef7);text-align:center'; el.innerHTML = `<div><h2 style="font:26px var(--display,sans-serif);margin:0 0 10px">Back soon</h2><p style="color:var(--dim,#93a4c0);margin:0 0 18px">${esc((GAMES[GAME] || {}).n || 'This game')} is taken down for now.</p><a class="go" style="text-decoration:none;display:inline-block;width:auto;padding:12px 22px" href="../">Other Night Studios games</a></div>`; }
  }
  async function refresh() {
    if (OFFLINE) return;
    try {
      const t = token();
      if (t) { const r = await rpc('ng_game_load', { p_token: t, p_game: GAME || 'hub' }); if (r && r.id) { me = { admin: !!r.admin, owner: !!r.owner }; const a = acct(); if (a && (a.admin !== me.admin || a.owner !== me.owner)) setAcct(Object.assign(a, me)); takeConfig(r.config); return; } }
      me = { admin: false, owner: false }; takeConfig(await rpc('ng_config'));
    } catch (e) {}
  }
  const ready = refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 180000);

  /* ---------- run tickets ---------- */
  // Ask the server for a ticket when a run starts; the score is only accepted with that ticket, once, and the
  // server knows how long ago it was issued. Resolves to null for guests or when the server can't be reached.
  function runStart(game, board, period) { const t = token(); if (OFFLINE || !t) return Promise.resolve(null); return rpc('ng_run_start', { p_token: t, p_game: game, p_board: board, p_period: period || '' }).then(r => (r && r.run) || null, () => null); }

  /* ---------- the Admin and Owner panel ---------- */
  const A = { on: false, game: GAME || 'run', days: 7, stats: null, statsSt: 'idle', ov: null, own: null, flags: [], rej: null, msg: null, busy: false, armed: '' };
  const stat = (l, v) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`;
  const bar = (label, n, of, note) => `<div style="margin-top:7px"><div class="setrow" style="padding:0;font-size:12px"><span>${esc(label)}</span><span class="sub">${note}</span></div><div class="prog"><i style="width:${of ? Math.min(100, n / of * 100).toFixed(0) : 0}%"></i></div></div>`;
  const pct = (n, of) => of ? Math.round(n / of * 100) + '%' : '–';
  function panelEl() { let el = document.getElementById('studioAdmin'); if (!el) { el = document.createElement('div'); el.id = 'studioAdmin'; el.style.cssText = 'position:fixed;inset:0;z-index:80;overflow-y:auto;background:var(--bg,#0a1020);-webkit-overflow-scrolling:touch'; el.innerHTML = '<div class="panel" id="studioAdminBody"></div>'; document.body.appendChild(el); el.addEventListener('click', onClick); el.addEventListener('submit', onSubmit); } return el; }
  async function load() {
    const t = token(), g = A.game; if (!t) return;
    A.statsSt = 'loading'; draw();
    const safe = p => p.catch(e => ({ failed: e }));
    const [ov, st, fl, own, rj] = await Promise.all([safe(rpc('ng_admin_overview', { p_token: t })), safe(rpc('ng_admin_stats', { p_token: t, p_game: g, p_days: A.days, p_bucket: GAMES[g].bucket })), safe(rpc('ng_admin_flags', { p_token: t, p_game: g })), me.owner ? safe(rpc('ng_owner_info', { p_token: t })) : null, safe(rpc('ng_admin_rejects', { p_token: t, p_game: g }))]);
    if (g !== A.game) return;
    if (ov && ov.failed) { A.msg = { t: /Not an admin|Not logged in/.test(ov.failed.message) ? "This account isn't an admin." : "Couldn't reach the server." }; A.statsSt = 'error'; return draw(); }
    A.ov = ov; if (ov && ov.config) takeConfig(ov.config); A.stats = st && !st.failed ? st : null; A.statsSt = A.stats ? 'ready' : 'error'; A.flags = Array.isArray(fl) ? fl : []; A.rej = rj && Array.isArray(rj.list) ? rj : null; A.own = own && !own.failed ? own : null; if (A.own && Array.isArray(A.own.hidden)) cfg.hidden = A.own.hidden.map(String);
    draw();
  }
  async function act(fn, args, ok) {
    if (A.busy) return; A.busy = true; A.msg = null; A.armed = ''; draw();
    try { const r = await rpc(fn, Object.assign({ p_token: token() }, args)); A.msg = r && r.error ? { t: r.error } : { ok: true, t: typeof ok === 'function' ? ok(r || {}) : ok }; if (r && 'now' in r) takeConfig(r); }
    catch (e) { A.msg = { t: /Not the owner/.test(e.message) ? 'Only the owner can do that.' : /Not an admin/.test(e.message) ? "This account isn't an admin." : "That didn't go through. Try again." }; }
    A.busy = false; await load(); const el = document.getElementById('studioAdmin'); if (el) el.scrollTop = 0;
  }
  function statsHTML() {
    const G0 = GAMES[A.game], d = A.stats;
    const days = `<div class="tabs">${[[1, '24 hours'], [7, '7 days'], [30, '30 days'], [90, '90 days']].map(([n, l]) => `<button type="button" data-s="days:${n}" aria-pressed="${A.days === n}">${l}</button>`).join('')}</div>`;
    if (!d) return `<div class="box"><h3>Player data <b>${G0.n}</b></h3>${days}<p>${A.statsSt === 'error' ? "Couldn't load the data." : 'Loading…'}</p></div>`;
    const runs = int(d.runs), all = runs + int(d.restarts) + int(d.quits), rn = n => nth(int(n), 'run');
    if (!all) return `<div class="box"><h3>Player data <b>${G0.n}</b></h3>${days}<p>No runs recorded for ${G0.n} in this period yet.</p></div>`;
    const cause = c => G0.causes[c] || (c === 'restart' ? 'Restarted' : c === 'quit' ? 'Quit' : c);
    const causes = (d.causes || []).map(c => bar(cause(c.c), c.n, all, `${pct(c.n, all)} · ${fmt(c.n)} · typical ${G0.unit(int(c.med))}`)).join('');
    const zones = (d.zones || []).map(z => bar(G0.zones[z.z] || 'Zone ' + z.z, z.reached, runs, `${pct(z.reached, runs)} reach it · ${pct(z.ended, runs)} end here`)).join('');
    const maxB = Math.max(1, ...(d.buckets || []).map(b => b.n));
    const buckets = (d.buckets || []).map(b => bar(`${G0.unit(b.b * G0.bucket)}${b.b >= 23 ? ' or more' : ' to ' + G0.unit((b.b + 1) * G0.bucket)}`, b.n, maxB, `${fmt(b.n)} · ${pct(b.n, runs)}`)).join('');
    const zc = {}; for (const r of d.zoneCauses || []) (zc[r.z] = zc[r.z] || []).push(`${cause(r.c)} ${fmt(r.n)}`);
    const zoneWhy = Object.keys(zc).map(z => `<p class="sub"><b>${esc(G0.zones[z] || 'Zone ' + z)}:</b> ${esc(zc[z].join(' · '))}</p>`).join('');
    const hitTot = (d.hits || []).reduce((n, h) => n + h.n, 0), byKind = {}; for (const h of d.hits || []) byKind[h.k] = (byKind[h.k] || 0) + h.n;
    const hits = G0.hits && hitTot ? `<h3 style="margin-top:14px">Crashes along the way <b>${fmt(hitTot)} total · ${(hitTot / Math.max(1, runs)).toFixed(1)} per run</b></h3>${Object.keys(byKind).sort((a, b) => byKind[b] - byKind[a]).map(k => bar(G0.hits[k] || k, byKind[k], hitTot, `${pct(byKind[k], hitTot)} · ${fmt(byKind[k])}`)).join('')}` : '';
    const sideN = ['Far left', 'Left', 'Middle', 'Right', 'Far right'], sideT = (d.sides || []).reduce((n, s) => n + s.n, 0), sides = (d.sides || []).map(s => `${sideN[s.s]} ${pct(s.n, sideT)}`).join(' · ');
    const small = (title, rows) => rows.length ? `<p class="sub"><b>${title}:</b> ${rows.join(' · ')}</p>` : '';
    return `<div class="box"><h3>Player data <b>${G0.n} · last ${A.days === 1 ? '24 hours' : A.days + ' days'}</b></h3>${days}
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
  const armBtn = (key, label, sure) => `<button type="button" class="buy ghost" data-s="arm:${key}" ${A.busy ? 'disabled' : ''}>${A.armed === key ? sure || 'Tap again to confirm' : label}</button>`;
  const sel = (name, opts) => `<select name="${name}" style="padding:10px;border-radius:10px;background:var(--bg2);color:var(--snow);border:1px solid var(--line)">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
  // Why the fair-play check turned a score away, in words (see backend/night-studios-rejects.sql).
  const WHY = { 'no ticket': 'Sent from an old page (no run ticket)', 'ticket not found': 'Run ticket not recognized', 'ticket already used': 'Run ticket already used', 'day ended': 'The daily course had ended',
    distance: 'Too far for the time played', 'run length': 'Too short or too long for the mode', time: "The game's clock ran ahead of real time", score: 'Over the score limit', 'over 5,000,000': 'Over 5,000,000', replay: "The replay didn't check out" };
  const why = r => WHY[r] || (/^ticket for /.test(r) ? 'Run ticket was for another board or day' : r);
  const ago = t => { const m = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const secs = v => v == null ? '?' : (+v).toFixed(1).replace(/\.0$/, '');
  function rejectsHTML(G0, dis) {
    const R = A.rej; if (!R) return '';
    if (!R.list.length) return `<p class="sub" style="margin-top:10px">No turned-away scores on ${G0.n} waiting for a look.</p>`;
    return `<p class="sub" style="margin-top:10px"><b>Scores the fair-play check turned away</b> · ${fmt(R.waiting)} waiting. Post one if it was a real run; it goes on the board if it beats that player's best there.</p>${R.list.map(r => `<div class="item" style="padding:5px 0;align-items:flex-start"><span><b>${esc(r.name)}</b> ${fmt(r.score)} <span class="sub">· ${esc(r.board)}${r.period ? ' ' + esc(r.period) : ''} · ${esc(ago(r.at))}</span><br><span class="sub">${esc(why(r.reason))} · ${secs(r.secs)} s on the game clock${r.real != null ? `, ${secs(r.real)} s real` : ''}${r.limit != null ? ` · limit ${fmt(r.limit)}` : ''}</span></span><span style="white-space:nowrap"><button type="button" class="buy" data-s="post:${int(r.id)}" ${dis}>Post it</button> <button type="button" class="buy ghost" data-s="dismiss:${int(r.id)}" ${dis}>Dismiss</button></span></div>`).join('')}`;
  }
  const HOURS = [[1, '1 hour'], [6, '6 hours'], [24, '1 day'], [72, '3 days'], [168, '1 week']];
  function draw() {
    if (!A.on) return;
    const body = panelEl().querySelector('#studioAdminBody'), G0 = GAMES[A.game], o = A.ov, dis = A.busy ? 'disabled' : '';
    const keep = {}; body.querySelectorAll('input[name], select[name]').forEach(i => { const f = i.closest('form'); if (i.value && f) keep[f.dataset.f + '.' + i.name] = i.value; }); // a redraw keeps what was typed or picked
    const tabs = `<div class="tabs">${Object.keys(GAMES).map(g => `<button type="button" data-s="game:${g}" aria-pressed="${A.game === g}">${GAMES[g].n}${hidden(g) ? ' (hidden)' : ''}</button>`).join('')}</div>`;
    const flags = A.flags.length ? `<p class="sub" style="margin-top:10px"><b>Scores the fair-play check thinks look too good</b></p>${A.flags.map(f => `<div class="item" style="padding:5px 0"><span><b>${esc(f.name)}</b> ${fmt(f.score)} <span class="sub">· ${esc(f.board)}${f.period ? ' ' + esc(f.period) : ''}</span></span><span><button type="button" class="buy ghost" data-s="unflag:${esc(f.name)}" ${dis}>It's fine</button> ${armBtn('rmone:' + esc(f.name) + '|' + esc(f.board) + '|' + esc(f.period || ''), 'Remove', 'Sure?')}</span></div>`).join('')}` : `<p class="sub" style="margin-top:10px">No suspicious scores on ${G0.n} right now.</p>`;
    const rejects = rejectsHTML(G0, dis);
    const msgOn = cfg.msg && cfg.msgEnds > Date.now(), evOn = cfg.ev && cfg.evEnds > Date.now();
    const owner = !me.owner ? '' : `<div class="box" style="border-color:var(--gold)"><h3>Owner <b>only you can do these</b></h3>
        <p class="sub"><b>Show or hide a game</b>. A hidden game disappears from the home page and nobody but you can open or post to it.</p>
        ${Object.keys(GAMES).map(g => `<div class="setrow"><span>${GAMES[g].n}</span><button type="button" class="switch" data-s="hide:${g}" aria-pressed="${!hidden(g)}" ${dis}>${hidden(g) ? 'Hidden' : 'Live'}</button></div>`).join('')}
        <form data-f="adminset" novalidate><label>Admins${A.own ? ': ' + esc((A.own.admins || []).join(', ')) : ''}</label><div class="inline"><input name="user" type="text" maxlength="16" autocomplete="off" placeholder="Username"><span><button class="buy" type="submit" ${dis}>Make admin</button> <button class="buy ghost" type="button" data-s="unadmin" ${dis}>Remove</button></span></div></form>
        <form data-f="reset" novalidate><label>Wipe a ${G0.n} leaderboard</label><div class="inline">${sel('board', [['', 'Every board']].concat(G0.boards.map(b => [b, b])))}${armBtn('resetboard', 'Wipe it', 'Tap again: scores are gone for good')}</div></form>
        <form data-f="delplayer" novalidate><label>Delete an account and everything it has, in every game</label><div class="inline"><input name="user" type="text" maxlength="16" autocomplete="off" placeholder="Username">${armBtn('delplayer', 'Delete', 'Tap again: this cannot be undone')}</div></form>
        <div class="setrow"><span>Clear ${G0.n}'s player data</span>${armBtn('clearruns', 'Clear it', 'Tap again to clear')}</div></div>`;
    body.innerHTML = `<button class="back" type="button" data-s="close">← Back</button><h2>${me.owner ? 'Owner and admin' : 'Admin'}</h2>${A.msg ? `<p class="${A.msg.ok ? 'ok' : 'err'}" role="alert">${esc(A.msg.t)}</p>` : ''}${tabs}
      <div class="box"><h3>${G0.n} <b>commands for this game</b></h3>
        <form data-f="gift" novalidate><label>Give ${G0.coin} in ${G0.n}</label><div class="inline"><input name="user" type="text" maxlength="16" autocomplete="off" placeholder="Username, or * for everyone"><input name="amount" type="text" inputmode="numeric" maxlength="7" placeholder="Amount" style="width:104px"></div><button class="buy" type="submit" ${dis}>Send ${G0.coin}</button></form>
        <form data-f="rmscore" novalidate style="margin-top:10px"><label>Remove a player's ${G0.n} scores</label><div class="inline"><input name="user" type="text" maxlength="16" autocomplete="off" placeholder="Username">${sel('board', [['', 'Every board']].concat(G0.boards.map(b => [b, b])))}${armBtn('rmscoreform', 'Remove', 'Tap again to remove')}</div></form>${flags}${rejects}</div>
      ${statsHTML()}
      <div class="box"><h3>All of Night Studios</h3>${o ? `<div class="stats">${stat('Players', fmt(o.players))}${stat('Active 24 h', fmt(o.active))}${stat('New 24 h', fmt(o.new))}${stat('Scores', fmt(o.scores))}${stat('Banned', fmt(o.banned))}</div>` : ''}
        <form data-f="announce" novalidate style="margin-top:10px"><label>Announcement on every game <b>${msgOn ? leftText(cfg.msgEnds - Date.now()) + ' left' : 'off'}</b></label><input name="text" type="text" maxlength="200" placeholder="Shown on everyone's home screen"><div class="inline">${sel('hours', HOURS)}<span><button class="buy" type="submit" ${dis}>Post</button> <button class="buy ghost" type="button" data-s="annoff" ${dis}>Take down</button></span></div></form>
        <form data-f="event" novalidate style="margin-top:10px"><label>Event in every game <b>${evOn ? esc(evLabel(cfg.ev)) + ' · ' + leftText(cfg.evEnds - Date.now()) + ' left' : 'off'}</b></label><div class="inline">${sel('kind', [['xp2', 'Double XP'], ['flakes2', 'Double coins'], ['both2', 'Double both'], ['xp3', 'Triple XP'], ['flakes3', 'Triple coins'], ['both3', 'Triple both']])}${sel('hours', HOURS)}</div><span><button class="buy" type="submit" ${dis}>Start</button> <button class="buy ghost" type="button" data-s="evoff" ${dis}>End it</button></span></form>
        <form data-f="ban" novalidate style="margin-top:10px"><label>Ban from every leaderboard</label><div class="inline"><input name="user" type="text" maxlength="16" autocomplete="off" placeholder="Username"><span><button class="buy" type="submit" ${dis}>Ban</button> <button class="buy ghost" type="button" data-s="unban" ${dis}>Unban</button></span></div></form></div>
      ${owner}
      ${o && o.recent ? `<div class="box"><h3>Recently active</h3><ol class="lb">${o.recent.map(p => `<li><span class="n">${int(p.level)}</span><span>${esc(p.name)}${p.admin ? ' <span class="ttl">admin</span>' : ''}${p.banned ? ' <span class="ttl" style="color:var(--rose)">banned</span>' : ''}</span><b>${p.best ? fmt(p.best) : '–'}</b></li>`).join('')}</ol></div>` : ''}`;
    for (const k in keep) { const [f, n] = k.split('.'), i = body.querySelector(`form[data-f="${f}"] [name="${n}"]`); if (i) i.value = keep[k]; }
  }
  const field = (f, n) => { const i = document.querySelector(`#studioAdmin form[data-f="${f}"] [name="${n}"]`); return i ? i.value.trim() : ''; };
  function onClick(e) {
    const b = e.target.closest('[data-s]'); if (!b || b.disabled) return;
    const s = b.dataset.s, i = s.indexOf(':'), k = i < 0 ? s : s.slice(0, i), v = i < 0 ? '' : s.slice(i + 1), g = A.game, G0 = GAMES[g];
    if (k === 'close') { A.on = false; panelEl().remove(); return; }
    if (k === 'game') { if (GAMES[v]) { A.game = v; A.stats = null; A.flags = []; A.rej = null; load(); } return; }
    if (k === 'days') { A.days = +v || 7; A.stats = null; load(); return; }
    if (k === 'arm') { if (A.armed !== v) { A.armed = v; draw(); setTimeout(() => { if (A.armed === v) { A.armed = ''; draw(); } }, 4000); return; }
      if (v === 'rmscoreform') { const u = field('rmscore', 'user'), bd = field('rmscore', 'board'); if (u) act('ng_admin_remove_score', { p_username: u, p_game: g, p_board: bd || null }, r => `Removed ${r.removed} of ${r.username}'s ${G0.n} scores${bd ? ' on ' + bd : ''}.`); }
      else if (v.startsWith('rmone:')) { const [u, bd, per] = v.slice(6).split('|'); act('ng_admin_remove_score', { p_username: u, p_game: g, p_board: bd, p_period: per || '' }, r => `Took ${r.username}'s ${bd} score off the ${G0.n} board.`); }
      else if (v === 'resetboard') act('ng_owner_reset_board', { p_game: g, p_board: field('reset', 'board') || null }, r => `Wiped ${r.removed} scores from ${G0.n}.`);
      else if (v === 'delplayer') { const u = field('delplayer', 'user'); if (u) act('ng_owner_delete_player', { p_username: u }, r => `Deleted ${r.username}.`); }
      else if (v === 'clearruns') act('ng_owner_clear_runs', { p_game: g }, r => `Cleared ${r.removed} run records for ${G0.n}.`);
      return; }
    if (k === 'post' || k === 'dismiss') return act('ng_admin_review', { p_id: +v, p_post: k === 'post' }, r => k === 'dismiss' ? `Dismissed ${r.username}'s ${fmt(r.score)}.` : r.best ? `Posted ${r.username}'s ${fmt(r.score)} to the board.` : `Marked ${r.username}'s ${fmt(r.score)} as real; their best there (${fmt(r.old)}) is higher, so the board is unchanged.`);
    if (k === 'unflag') return act('ng_admin_unflag', { p_username: v, p_game: g }, 'Cleared.');
    if (k === 'hide') return act('ng_owner_hide', { p_game: v, p_hidden: !hidden(v) }, hidden(v) ? `${GAMES[v].n} is live again.` : `${GAMES[v].n} is hidden.`);
    if (k === 'unadmin') { const u = field('adminset', 'user'); if (u) act('ng_owner_set_admin', { p_username: u, p_admin: false }, r => `${r.username} is no longer an admin.`); return; }
    if (k === 'annoff') return act('ng_admin_announce', { p_message: '', p_hours: 0 }, 'Announcement taken down.');
    if (k === 'evoff') return act('ng_admin_event', { p_event: null, p_hours: 0 }, 'Event ended.');
    if (k === 'unban') { const u = field('ban', 'user'); if (u) act('ng_admin_ban', { p_username: u, p_banned: false }, r => `${r.username} can post scores again.`); }
  }
  function onSubmit(e) {
    e.preventDefault(); const f = e.target.dataset.f, g = A.game, G0 = GAMES[g], bad = t => { A.msg = { t }; draw(); };
    if (f === 'gift') { const u = field('gift', 'user'), n = parseInt(field('gift', 'amount').replace(/[, ]/g, ''), 10); if (!u || !(n >= 1)) return bad('Enter a username (or *) and an amount.'); act('ng_admin_gift', { p_username: u, p_flakes: n, p_game: g }, r => `Sent ${fmt(n)} ${G0.coin} to ${r.players === 1 && r.username ? r.username : fmt(r.players) + ' players'} in ${G0.n}. They get it next time they open the game.`); }
    else if (f === 'announce') { const t = field('announce', 'text'); if (!t) return bad('Type the announcement first.'); act('ng_admin_announce', { p_message: t, p_hours: +field('announce', 'hours') }, 'Announcement posted.'); }
    else if (f === 'event') act('ng_admin_event', { p_event: field('event', 'kind'), p_hours: +field('event', 'hours') }, 'Event started.');
    else if (f === 'ban') { const u = field('ban', 'user'); if (u) act('ng_admin_ban', { p_username: u, p_banned: true }, r => `${r.username} is banned from the boards.`); }
    else if (f === 'adminset') { const u = field('adminset', 'user'); if (u) act('ng_owner_set_admin', { p_username: u, p_admin: true }, r => `${r.username} is an admin now.`); }
  }
  function openAdmin(game) { if (!token()) return; A.on = true; A.game = GAMES[game] ? game : (GAMES[GAME] ? GAME : 'run'); A.msg = null; A.stats = null; panelEl(); draw(); refresh().then(load); }

  /* ---------- desktop and mobile layouts ---------- */
  // Every page has two layouts. Mobile is one phone-shaped column. Desktop fills the window: a game's playfield
  // stands beside its menus instead of under them, and the home page becomes a grid. Desktop is used on a wide
  // window unless the player picks a layout in Settings. The playfield itself is the same in both, so a score
  // means the same thing on a phone and on a computer.
  const LAYOUT = 'nightstudios-layout', LAYOUTS = { auto: 'Auto', desktop: 'Desktop', mobile: 'Mobile' };
  let sideFn = null, sideEl = null, dockEl = null;
  function layoutPref() { try { const v = localStorage.getItem(LAYOUT); return LAYOUTS[v] ? v : 'auto'; } catch (e) { return 'auto'; } }
  const wantDesk = () => { const p = layoutPref(); return p === 'desktop' || (p === 'auto' && innerWidth >= 960 && innerHeight >= 480); };
  // While a run is on, the menus are hidden, so their place beside the playfield shows how to play.
  function drawSide() {
    if (!sideEl || !dockEl.isConnected) return;
    const ov = document.getElementById('overlay'); let html = '';
    if (ov && ov.hidden) { try { html = sideFn ? sideFn() : ''; } catch (e) {} html = `<div class="panel">${html}<p class="sub">Your menus come back here when the run ends or you pause.</p></div>`; }
    sideEl.innerHTML = html;
  }
  function applyLayout() {
    const root = document.documentElement, stage = document.getElementById('stage'), ov = document.getElementById('overlay'), desk = wantDesk();
    root.classList.toggle('deskgame', desk && !!stage); root.classList.toggle('deskhub', desk && !stage);
    if (!stage || !ov) return;
    if (desk && ov.parentNode === stage) {
      if (!dockEl) { dockEl = document.createElement('div'); dockEl.className = 'dock'; sideEl = document.createElement('div'); sideEl.className = 'side'; dockEl.appendChild(sideEl); new MutationObserver(drawSide).observe(ov, { attributes: true, attributeFilter: ['hidden'] }); }
      stage.after(dockEl); dockEl.insertBefore(ov, sideEl);
    } else if (!desk && dockEl && ov.parentNode === dockEl) { stage.insertBefore(ov, document.getElementById('toasts')); dockEl.remove(); }
    drawSide();
  }
  const layoutRow = () => `<div class="setrow"><span>Layout</span><button type="button" class="switch" data-layout aria-pressed="true">${LAYOUTS[layoutPref()]}</button></div><p class="sub">Auto uses the desktop layout on a wide window and the mobile one on a phone.</p>`;
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-layout]'); if (!b) return;
    const order = Object.keys(LAYOUTS), next = order[(order.indexOf(layoutPref()) + 1) % order.length];
    try { localStorage.setItem(LAYOUT, next); } catch (err) {}
    b.textContent = LAYOUTS[next]; applyLayout(); dispatchEvent(new Event('resize'));
  });
  addEventListener('resize', applyLayout); // registered before any game's own resize, so a game always measures the new layout
  applyLayout();

  window.Studio = { layoutRow, set side(f) { sideFn = f; drawSide(); }, url: SERVER, key: KEY, game: GAME, games: GAMES, offline: OFFLINE, rpc, acct, setAcct, ready, refresh, runStart, eventMult, notesHTML, hidden, openAdmin, onChange: f => hooks.push(f),
    get admin() { return me.admin || me.owner; }, get owner() { return me.owner; } };
})();
