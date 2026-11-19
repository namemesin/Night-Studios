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

  /* ---------- the daily day ---------- */
  // Every daily course changes at midnight Denver time, for everyone (the games use the same rule). Players are
  // only ever shown when that is on their own clock: midnight in Colorado, 2:00 AM in Florida, 11:00 PM in California.
  const DAILY_TZ = 'America/Denver';
  function denParts(when) { const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: DAILY_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(when).forEach(x => { p[x.type] = x.value; }); return p; }
  function denDay(when = new Date()) { try { const p = denParts(when); return `${p.year}-${p.month}-${p.day}`; } catch (e) { return new Date(when.getTime() - 7 * 3600000).toISOString().slice(0, 10); } }
  function nextReset(now = new Date()) { const p = denParts(now), h = +p.hour % 24; return new Date(now.getTime() + ((24 - h) * 3600 - +p.minute * 60 - +p.second) * 1000 - now.getMilliseconds()); }
  // 'midnight' or '2:00 AM': when the next daily starts, on this player's clock
  function resetTime() { try { const d = nextReset(); return d.getHours() === 0 && d.getMinutes() === 0 ? 'midnight' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return 'midnight'; } }

  /* ---------- the Admin and Owner panel ---------- */
  // One game at a time (picked at the top), split into sections so nothing is a long scroll:
  //   Review   scores the fair-play check turned away or flagged, with a count on the tab
  //   Boards   any board as it stands, with a remove button on every score
  //   Players  search by name (or see who was on last); a player's card has their scores and every action
  //   Studio   numbers for the whole site, announcements, events, coins for everyone
  //   Data     how runs go in this game
  //   Owner    hiding games, admins, wiping, clearing data (owner only)
  // Names are clickable everywhere and open that player's card. Actions keep your place on the page.
  const SECS = [['review', 'Review'], ['boards', 'Boards'], ['players', 'Players'], ['studio', 'Studio'], ['data', 'Data'], ['owner', 'Owner']];
  const PREF = 'nightstudios-admin';
  const A = { on: false, game: GAME || 'run', sec: 'review', days: 7, stats: null, statsSt: 'idle', ov: null, own: null, queue: {}, flags: [], rej: null,
    bd: '', day: '', board: null, q: '', found: null, open: '', msg: null, busy: false, armed: '' };
  try { const p = JSON.parse(localStorage.getItem(PREF) || '{}'); if (SECS.some(s => s[0] === p.sec)) A.sec = p.sec; } catch (e) {}
  const remember = () => { try { localStorage.setItem(PREF, JSON.stringify({ sec: A.sec })); } catch (e) {} };
  const stat = (l, v) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`;
  const bar = (label, n, of, note) => `<div style="margin-top:7px"><div class="setrow" style="padding:0;font-size:12px"><span>${esc(label)}</span><span class="sub">${note}</span></div><div class="prog"><i style="width:${of ? Math.min(100, n / of * 100).toFixed(0) : 0}%"></i></div></div>`;
  const pct = (n, of) => of ? Math.round(n / of * 100) + '%' : '–';
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const shiftDay = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return dayKey(d); };
  const isDaily = (g, b) => b === 'daily';
  A.day = denDay();
  const waiting = g => { const q = A.queue[g]; return q ? int(q.rejects) + int(q.flags) : 0; };
  const attr = s => esc(s); // values go in data- attributes, escaped
  function panelEl() {
    let el = document.getElementById('studioAdmin');
    if (!el) {
      el = document.createElement('div'); el.id = 'studioAdmin';
      el.style.cssText = 'position:fixed;inset:0;z-index:80;overflow-y:auto;background:var(--bg,#0a1020);-webkit-overflow-scrolling:touch';
      el.innerHTML = '<div class="panel" id="studioAdminBody" style="max-width:760px"></div>'; document.body.appendChild(el);
      el.addEventListener('click', onClick); el.addEventListener('submit', onSubmit); el.addEventListener('change', onChange);
      el.addEventListener('input', e => { if (e.target.name === 'q' && e.target.closest('form[data-f="find"]')) { clearTimeout(A.findT); A.findT = setTimeout(() => { A.q = e.target.value.trim(); A.open = ''; loadSec(); }, 300); } });
    }
    return el;
  }

  /* loading: the counts for every game, plus whatever the open section shows */
  const safe = p => p.catch(e => ({ failed: e }));
  async function loadSec() {
    const t = token(), g = A.game, sec = A.sec; if (!t) return;
    const call = (fn, args) => safe(rpc(fn, Object.assign({ p_token: t }, args)));
    const jobs = [call('ng_admin_queue', {})];
    if (sec === 'review') jobs.push(call('ng_admin_rejects', { p_game: g }), call('ng_admin_flags', { p_game: g }));
    else if (sec === 'boards') { if (!GAMES[g].boards.includes(A.bd)) A.bd = GAMES[g].boards[0]; if (!A.day) A.day = denDay(); jobs.push(call('ng_admin_board', { p_game: g, p_board: A.bd, p_period: isDaily(g, A.bd) ? A.day : '' })); }
    else if (sec === 'players') jobs.push(call('ng_admin_find', { p_query: A.q }));
    else if (sec === 'studio') jobs.push(call('ng_admin_overview', {}));
    else if (sec === 'data') { A.statsSt = 'loading'; draw(); jobs.push(call('ng_admin_stats', { p_game: g, p_days: A.days, p_bucket: GAMES[g].bucket })); }
    else if (sec === 'owner' && me.owner) jobs.push(call('ng_owner_info', {}));
    const [qu, a, b] = await Promise.all(jobs);
    if (g !== A.game || sec !== A.sec) return;
    if (qu && qu.failed) { A.msg = { t: /Not an admin|Not logged in/.test(qu.failed.message) ? "This account isn't an admin." : "Couldn't reach the server." }; return draw(); }
    A.queue = qu || {};
    if (sec === 'review') { A.rej = a && Array.isArray(a.list) ? a : { waiting: 0, list: [] }; A.flags = Array.isArray(b) ? b : []; }
    else if (sec === 'boards') A.board = a && !a.failed ? a : { failed: true };
    else if (sec === 'players') A.found = Array.isArray(a) ? a : [];
    else if (sec === 'studio') { A.ov = a && !a.failed ? a : null; if (A.ov && A.ov.config) takeConfig(A.ov.config); }
    else if (sec === 'data') { A.stats = a && !a.failed ? a : null; A.statsSt = A.stats ? 'ready' : 'error'; }
    else if (sec === 'owner') { A.own = a && !a.failed ? a : null; if (A.own && Array.isArray(A.own.hidden)) cfg.hidden = A.own.hidden.map(String); }
    draw();
  }
  async function act(fn, args, ok) {
    if (A.busy) return; A.busy = true; A.msg = null; A.armed = ''; draw();
    try { const r = await rpc(fn, Object.assign({ p_token: token() }, args)); A.msg = r && r.error ? { t: r.error } : { ok: true, t: typeof ok === 'function' ? ok(r || {}) : ok }; if (r && 'now' in r) takeConfig(r); }
    catch (e) { A.msg = { t: /Not the owner/.test(e.message) ? 'Only the owner can do that.' : /Not an admin/.test(e.message) ? "This account isn't an admin." : "That didn't go through. Try again." }; }
    A.busy = false; await loadSec();
  }
  const go = (sec, extra) => { A.sec = sec; A.msg = null; A.armed = ''; Object.assign(A, extra || {}); remember(); draw(); loadSec(); };

  /* the pieces */
  const WHY = { 'no ticket': 'Sent from an old page (no run ticket)', 'ticket not found': 'Run ticket not recognized', 'ticket already used': 'Run ticket already used', 'day ended': 'The daily course had ended',
    distance: 'Too far for the time played', 'run length': 'Too short or too long for the mode', time: "The game's clock ran ahead of real time", score: 'Over the score limit', 'over 5,000,000': 'Over 5,000,000', replay: "The replay didn't check out" };
  const why = r => WHY[r] || (/^ticket for /.test(r) ? 'Run ticket was for another board or day' : r);
  const ago = t => { const m = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 60000)); return !t ? '' : m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const secs = v => v == null ? '?' : (+v).toFixed(1).replace(/\.0$/, '');
  const dis = () => A.busy ? 'disabled' : '';
  const who = n => `<button type="button" class="linkbtn" data-s="who" data-n="${attr(n)}" style="background:none;border:0;padding:0;color:var(--snow);font:inherit;font-weight:700;text-decoration:underline dotted;cursor:pointer">${esc(n)}</button>`;
  const where = (b, p) => `${esc(b)}${p ? ' ' + esc(p) : ''}`;
  // a button that asks "tap again" first, for anything that can't be undone
  const arm = (key, label, sure, data) => `<button type="button" class="buy ghost" data-s="arm" data-k="${attr(key)}" ${data || ''} ${dis()}>${A.armed === key ? sure || 'Tap again' : label}</button>`;
  const rmData = (n, g, b, p) => `data-n="${attr(n)}" data-g="${attr(g)}" data-b="${attr(b)}" data-p="${attr(p || '')}"`;
  const rmBtn = (n, g, b, p) => arm(`rm|${n}|${g}|${b}|${p || ''}`, 'Remove', 'Sure?', rmData(n, g, b, p));
  const row = (left, right) => `<div class="item" style="padding:7px 0;border-top:1px solid var(--line);align-items:flex-start"><span style="min-width:0">${left}</span><span style="white-space:nowrap;display:flex;gap:6px">${right}</span></div>`;
  const sel = (name, opts, cur) => `<select name="${name}" style="padding:10px;border-radius:10px;background:var(--bg2);color:var(--snow);border:1px solid var(--line)">${opts.map(([v, l]) => `<option value="${attr(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const HOURS = [[1, '1 hour'], [6, '6 hours'], [24, '1 day'], [72, '3 days'], [168, '1 week']];

  function reviewHTML() {
    const G0 = GAMES[A.game], R = A.rej;
    const others = Object.keys(GAMES).filter(g => g !== A.game && waiting(g));
    const elsewhere = others.length ? `<p class="sub">Also waiting: ${others.map(g => `<button type="button" class="buy ghost" data-s="jump" data-g="${g}" style="margin:2px">${GAMES[g].n} ${waiting(g)}</button>`).join('')}</p>` : '';
    if (!R) return `<div class="box"><p>Loading…</p></div>`;
    const rej = R.list.length ? `<div class="box"><h3>Turned away <b>${fmt(R.waiting)} waiting</b></h3><p class="sub">Scores the fair-play check didn't let through. Post one if it was a real run: it goes on the board if it beats that player's best there.</p>
      ${R.list.map(r => row(`${who(r.name)} <b>${fmt(r.score)}</b> <span class="sub">· ${where(r.board, r.period)} · ${esc(ago(r.at))}</span><br><span class="sub">${esc(why(r.reason))} · ${secs(r.secs)} s on the game clock${r.real != null ? `, ${secs(r.real)} s real` : ''}${r.limit != null ? ` · limit ${fmt(r.limit)}` : ''}</span>`,
        `<button type="button" class="buy" data-s="post" data-id="${int(r.id)}" ${dis()}>Post it</button><button type="button" class="buy ghost" data-s="dismiss" data-id="${int(r.id)}" ${dis()}>Dismiss</button>`)).join('')}</div>` : '';
    const fl = A.flags.length ? `<div class="box"><h3>Flagged <b>${A.flags.length} on the boards</b></h3><p class="sub">Posted, but high for the time played. Keep them or take them off.</p>
      ${A.flags.map(f => row(`${who(f.name)} <b>${fmt(f.score)}</b> <span class="sub">· ${where(f.board, f.period)} · ${esc(ago(f.at))}</span>`,
        `<button type="button" class="buy ghost" data-s="unflag" ${rmData(f.name, A.game, f.board, f.period)} ${dis()}>It's fine</button>${rmBtn(f.name, A.game, f.board, f.period)}`)).join('')}</div>` : '';
    return elsewhere + (rej || fl ? rej + fl : `<div class="box"><p>Nothing to review on ${G0.n}.</p></div>`);
  }
  function boardsHTML() {
    const g = A.game, G0 = GAMES[g], B = A.board, daily = isDaily(g, A.bd), today = denDay();
    const tabs = `<div class="tabs">${G0.boards.map(b => `<button type="button" data-s="bd" data-b="${b}" aria-pressed="${A.bd === b}">${esc(b)}</button>`).join('')}</div>`;
    const day = daily ? `<div class="setrow"><button type="button" class="buy ghost" data-s="day" data-d="-1">‹ Earlier</button><b style="white-space:nowrap">${A.day === today ? 'Today' : esc(A.day)}</b><button type="button" class="buy ghost" data-s="day" data-d="1" ${A.day >= today ? 'disabled' : ''}>Later ›</button></div>` : '';
    let list = '<p>Loading…</p>';
    if (B && B.failed) list = "<p>Couldn't load the board.</p>";
    else if (B && B.top) list = B.top.length ? `<p class="sub">${fmt(B.count)} ${B.count === 1 ? 'score' : 'scores'}${B.count > B.top.length ? `, top ${B.top.length} shown` : ''}.</p>` + B.top.map((r, i) => row(`<span class="sub">${i + 1}.</span> ${who(r.name)}${r.banned ? ' <span class="ttl" style="color:var(--rose)">banned</span>' : ''}${r.flagged ? ' <span class="ttl" style="color:var(--gold)">flagged</span>' : ''} <b>${fmt(r.score)}</b> <span class="sub">· ${esc(ago(r.at))}</span>`, rmBtn(r.name, g, A.bd, daily ? A.day : ''))).join('') : '<p>Nobody has posted here yet.</p>';
    return `<div class="box"><h3>${G0.n} boards</h3>${tabs}${day}${list}</div>`;
  }
  function playerCard(p) {
    const g = A.game, G0 = GAMES[g];
    const scores = (p.scores || []).map(s => row(`<span class="sub">${esc((GAMES[s.game] || { n: s.game }).n)} ·</span> ${where(s.board, s.period)} <b>${fmt(s.score)}</b>${s.flagged ? ' <span class="ttl" style="color:var(--gold)">flagged</span>' : ''} <span class="sub">· ${esc(ago(s.at))}</span>`, rmBtn(p.name, s.game, s.board, s.period))).join('');
    const games = Object.keys(GAMES).map(k => [k, GAMES[k].n]);
    return `<div style="margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--bg2)">
      <p class="sub">Level ${int(p.level)} · joined ${esc(ago(p.joined))} · last on ${esc(ago(p.seen))}${p.waiting ? ` · <b>${p.waiting} turned-away ${p.waiting === 1 ? 'score' : 'scores'} waiting</b>` : ''}</p>
      <form data-f="pgift" data-n="${attr(p.name)}" novalidate style="margin-top:8px"><label>Give coins</label><div class="inline"><input name="amount" type="text" inputmode="numeric" maxlength="7" placeholder="Amount">${sel('game', games, g)}</div><button class="buy" type="submit" ${dis()}>Send</button></form>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
        ${p.admin ? '' : p.banned ? `<button type="button" class="buy ghost" data-s="unban" data-n="${attr(p.name)}" ${dis()}>Unban</button>` : arm(`ban|${p.name}`, 'Ban from the boards', 'Tap again to ban', `data-n="${attr(p.name)}"`)}
        ${arm(`rmall|${p.name}`, `Remove all ${G0.n} scores`, 'Tap again to remove', `data-n="${attr(p.name)}"`)}
        ${me.owner && !p.owner ? (p.admin ? `<button type="button" class="buy ghost" data-s="unadmin" data-n="${attr(p.name)}" ${dis()}>Remove admin</button>` : `<button type="button" class="buy ghost" data-s="mkadmin" data-n="${attr(p.name)}" ${dis()}>Make admin</button>`) : ''}
        ${me.owner && !p.owner ? arm(`del|${p.name}`, 'Delete account', 'Tap again: this cannot be undone', `data-n="${attr(p.name)}"`) : ''}
      </div>
      <h3 style="margin-top:12px">Scores <b>${(p.scores || []).length ? (p.scores || []).length + ' on the boards' : 'none'}</b></h3>${scores}</div>`;
  }
  function playersHTML() {
    const list = A.found;
    const form = `<form data-f="find" novalidate><input name="q" type="search" maxlength="16" autocomplete="off" placeholder="Search players by name" value="${attr(A.q)}"></form>`;
    if (!list) return `<div class="box">${form}<p>Loading…</p></div>`;
    const head = A.q ? (list.length ? '' : `<p>No player matches “${esc(A.q)}”.</p>`) : '<p class="sub" style="margin-top:8px">Last on:</p>';
    return `<div class="box">${form}${head}${list.map(p => {
      const tags = [p.owner ? 'owner' : '', p.admin && !p.owner ? 'admin' : '', p.banned ? 'banned' : ''].filter(Boolean).map(t => ` <span class="ttl"${t === 'banned' ? ' style="color:var(--rose)"' : ''}>${t}</span>`).join('');
      const open = A.open.toLowerCase() === p.name.toLowerCase() || list.length === 1;
      return `<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="item"><span>${who(p.name)}${tags}${p.waiting ? ' <span class="ttl" style="color:var(--gold)">review</span>' : ''}</span><span class="sub">level ${int(p.level)} · ${esc(ago(p.seen))}</span></div>${open ? playerCard(p) : ''}</div>`; }).join('')}</div>`;
  }
  function studioHTML() {
    const o = A.ov, G0 = GAMES[A.game], msgOn = cfg.msg && cfg.msgEnds > Date.now(), evOn = cfg.ev && cfg.evEnds > Date.now();
    return `<div class="box"><h3>All of Night Studios</h3>${o ? `<div class="stats">${stat('Players', fmt(o.players))}${stat('Active 24 h', fmt(o.active))}${stat('New 24 h', fmt(o.new))}${stat('Scores', fmt(o.scores))}${stat('Banned', fmt(o.banned))}</div>` : '<p>Loading…</p>'}</div>
      <div class="box"><form data-f="announce" novalidate><label>Announcement on every game <b>${msgOn ? leftText(cfg.msgEnds - Date.now()) + ' left' : 'off'}</b></label><input name="text" type="text" maxlength="200" placeholder="Shown on everyone's home screen"><div class="inline">${sel('hours', HOURS)}<span><button class="buy" type="submit" ${dis()}>Post</button> <button class="buy ghost" type="button" data-s="annoff" ${dis()}>Take down</button></span></div></form></div>
      <div class="box"><form data-f="event" novalidate><label>Event in every game <b>${evOn ? esc(evLabel(cfg.ev)) + ' · ' + leftText(cfg.evEnds - Date.now()) + ' left' : 'off'}</b></label><div class="inline">${sel('kind', [['xp2', 'Double XP'], ['flakes2', 'Double coins'], ['both2', 'Double both'], ['xp3', 'Triple XP'], ['flakes3', 'Triple coins'], ['both3', 'Triple both']])}${sel('hours', HOURS)}</div><span><button class="buy" type="submit" ${dis()}>Start</button> <button class="buy ghost" type="button" data-s="evoff" ${dis()}>End it</button></span></form></div>
      <div class="box"><form data-f="giftall" novalidate><label>Give ${G0.coin} to everyone in ${G0.n}</label><div class="inline"><input name="amount" type="text" inputmode="numeric" maxlength="7" placeholder="Amount"><button class="buy" type="submit" ${dis()}>Send to everyone</button></div></form></div>`;
  }
  function ownerHTML() {
    if (!me.owner) return `<div class="box"><p>Only the owner can use this section.</p></div>`;
    const G0 = GAMES[A.game], own = A.own;
    return `<div class="box"><h3>Games <b>hidden games are only open to you</b></h3>${Object.keys(GAMES).map(g => `<div class="setrow"><span>${GAMES[g].n}</span><button type="button" class="switch" data-s="hide" data-g="${g}" aria-pressed="${!hidden(g)}" ${dis()}>${hidden(g) ? 'Hidden' : 'Live'}</button></div>`).join('')}</div>
      <div class="box"><h3>Admins</h3>${own ? (own.admins || []).map(n => row(who(n), `<button type="button" class="buy ghost" data-s="unadmin" data-n="${attr(n)}" ${dis()}>Remove</button>`)).join('') : '<p>Loading…</p>'}
        <form data-f="addadmin" novalidate style="margin-top:8px"><div class="inline"><input name="user" type="text" maxlength="16" autocomplete="off" placeholder="Username"><button class="buy" type="submit" ${dis()}>Make admin</button></div></form></div>
      <div class="box"><h3>${G0.n} <b>can't be undone</b></h3>
        <form data-f="wipe" novalidate><label>Wipe a leaderboard (every day of it)</label><div class="inline">${sel('board', [['', 'Every board']].concat(G0.boards.map(b => [b, b])))}${arm('wipe', 'Wipe it', 'Tap again: scores are gone for good')}</div></form>
        <div class="setrow" style="margin-top:8px"><span>Clear ${G0.n}'s player data</span>${arm('clearruns', 'Clear it', 'Tap again to clear')}</div></div>`;
  }
  function statsHTML() {
    const G0 = GAMES[A.game], d = A.stats;
    const days = `<div class="tabs">${[[1, '24 hours'], [7, '7 days'], [30, '30 days'], [90, '90 days']].map(([n, l]) => `<button type="button" data-s="days" data-d="${n}" aria-pressed="${A.days === n}">${l}</button>`).join('')}</div>`;
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
  function draw() {
    if (!A.on) return;
    const el = panelEl(), body = el.querySelector('#studioAdminBody'), y = el.scrollTop;
    const keep = {}; body.querySelectorAll('input[name], select[name]').forEach(i => { const f = i.closest('form'); if (i.value && f) keep[f.dataset.f + '.' + i.name] = i.value; }); // a redraw keeps what was typed or picked
    const focus = document.activeElement && body.contains(document.activeElement) && document.activeElement.name === 'q' ? document.activeElement.selectionStart : -1;
    const tabsList = SECS.filter(([k]) => k !== 'owner' || me.owner);
    const count = waiting(A.game);
    const head = `<div style="position:sticky;top:0;z-index:2;background:var(--bg,#0a1020);padding:6px 0 8px;display:grid;gap:8px">
      <div style="display:flex;gap:8px;align-items:center"><button class="back" type="button" data-s="close" style="flex:none">← Back</button>
        <select data-c="game" aria-label="Game" style="flex:1;min-width:0;padding:9px;border-radius:10px;background:var(--bg2);color:var(--snow);border:1px solid var(--line)">${Object.keys(GAMES).map(g => `<option value="${g}" ${g === A.game ? 'selected' : ''}>${GAMES[g].n}${hidden(g) ? ' (hidden)' : ''}${waiting(g) ? ' · ' + waiting(g) + ' to review' : ''}</option>`).join('')}</select></div>
      <div class="tabs">${tabsList.map(([k, l]) => `<button type="button" data-s="sec" data-k="${k}" aria-pressed="${A.sec === k}">${l}${k === 'review' && count ? ` (${count})` : ''}</button>`).join('')}</div>
      ${A.msg ? `<p class="${A.msg.ok ? 'ok' : 'err'}" role="alert" style="margin:0">${esc(A.msg.t)}</p>` : ''}</div>`;
    const main = { review: reviewHTML, boards: boardsHTML, players: playersHTML, studio: studioHTML, data: statsHTML, owner: ownerHTML }[A.sec] || reviewHTML;
    body.innerHTML = head + main();
    for (const k in keep) { const [f, n] = k.split('.'), i = body.querySelector(`form[data-f="${f}"] [name="${n}"]`); if (i) i.value = keep[k]; }
    if (focus >= 0) { const q = body.querySelector('form[data-f="find"] input[name="q"]'); if (q) { q.focus(); try { q.setSelectionRange(focus, focus); } catch (e) {} } }
    el.scrollTop = y;
  }
  const clear = (f, n) => { const i = document.querySelector(`#studioAdmin form[data-f="${f}"] [name="${n}"]`); if (i) i.value = ''; }; // after it went through
  const field = (f, n) => { const i = document.querySelector(`#studioAdmin form[data-f="${f}"] [name="${n}"]`); return i ? i.value.trim() : ''; };
  function onChange(e) { if (e.target.dataset.c === 'game' && GAMES[e.target.value]) { A.game = e.target.value; A.stats = null; A.flags = []; A.rej = null; A.board = null; A.open = ''; A.msg = null; draw(); loadSec(); } }
  function onClick(e) {
    const b = e.target.closest('[data-s]'); if (!b || b.disabled) return;
    const s = b.dataset.s, d = b.dataset, g = A.game, G0 = GAMES[g];
    if (s === 'close') { A.on = false; panelEl().remove(); return; }
    if (s === 'sec') return go(d.k);
    if (s === 'jump') { A.game = d.g; A.rej = null; A.flags = []; return go('review'); }
    if (s === 'who') return go('players', { q: d.n, open: d.n, found: null });
    if (s === 'bd') { A.bd = d.b; A.board = null; draw(); return loadSec(); }
    if (s === 'day') { A.day = shiftDay(A.day, +d.d); A.board = null; draw(); return loadSec(); }
    if (s === 'days') { A.days = +d.d || 7; A.stats = null; return loadSec(); }
    if (s === 'arm') {
      const k = d.k; if (A.armed !== k) { A.armed = k; draw(); setTimeout(() => { if (A.armed === k) { A.armed = ''; draw(); } }, 4000); return; }
      const kind = k.split('|')[0];
      if (kind === 'rm') return act('ng_admin_remove_score', { p_username: d.n, p_game: d.g, p_board: d.b, p_period: d.p }, r => `Took ${r.username}'s ${GAMES[d.g] ? GAMES[d.g].n : d.g} ${d.b}${d.p ? ' ' + d.p : ''} score off the board.`);
      if (kind === 'rmall') return act('ng_admin_remove_score', { p_username: d.n, p_game: g }, r => `Removed ${r.removed} of ${r.username}'s ${G0.n} scores.`);
      if (kind === 'ban') return act('ng_admin_ban', { p_username: d.n, p_banned: true }, r => `${r.username} is banned from the boards.`);
      if (kind === 'del') { A.open = ''; A.q = ''; return act('ng_owner_delete_player', { p_username: d.n }, r => `Deleted ${r.username}.`); }
      if (kind === 'wipe') { const bd = field('wipe', 'board'); return act('ng_owner_reset_board', { p_game: g, p_board: bd || null }, r => `Wiped ${r.removed} scores from ${G0.n}${bd ? ' ' + bd : ''}.`); }
      if (kind === 'clearruns') return act('ng_owner_clear_runs', { p_game: g }, r => `Cleared ${r.removed} run records for ${G0.n}.`);
      return;
    }
    if (s === 'post' || s === 'dismiss') return act('ng_admin_review', { p_id: +d.id, p_post: s === 'post' }, r => s === 'dismiss' ? `Dismissed ${r.username}'s ${fmt(r.score)}.` : r.best ? `Posted ${r.username}'s ${fmt(r.score)} to the board.` : `Marked ${r.username}'s ${fmt(r.score)} as real; their best there (${fmt(r.old)}) is higher, so the board is unchanged.`);
    if (s === 'unflag') return act('ng_admin_unflag', { p_username: d.n, p_game: d.g, p_board: d.b, p_period: d.p }, `Kept ${d.n}'s ${d.b} score.`);
    if (s === 'unban') return act('ng_admin_ban', { p_username: d.n, p_banned: false }, r => `${r.username} can post scores again.`);
    if (s === 'mkadmin' || s === 'unadmin') return act('ng_owner_set_admin', { p_username: d.n, p_admin: s === 'mkadmin' }, r => s === 'mkadmin' ? `${r.username} is an admin now.` : `${r.username} is no longer an admin.`);
    if (s === 'hide') return act('ng_owner_hide', { p_game: d.g, p_hidden: !hidden(d.g) }, hidden(d.g) ? `${GAMES[d.g].n} is live again.` : `${GAMES[d.g].n} is hidden.`);
    if (s === 'annoff') return act('ng_admin_announce', { p_message: '', p_hours: 0 }, 'Announcement taken down.');
    if (s === 'evoff') return act('ng_admin_event', { p_event: null, p_hours: 0 }, 'Event ended.');
  }
  function onSubmit(e) {
    e.preventDefault(); const form = e.target, f = form.dataset.f, g = A.game, G0 = GAMES[g], bad = t => { A.msg = { t }; draw(); };
    const amount = () => parseInt(field(f, 'amount').replace(/[, ]/g, ''), 10);
    if (f === 'find') { clearTimeout(A.findT); A.q = field('find', 'q'); A.open = A.q; return loadSec(); }
    if (f === 'pgift') { const n = amount(), gg = field('pgift', 'game') || g; if (!(n >= 1)) return bad('Enter an amount.'); return act('ng_admin_gift', { p_username: form.dataset.n, p_flakes: n, p_game: gg }, r => (clear('pgift', 'amount'), `Sent ${fmt(n)} ${GAMES[gg].coin} to ${r.username} in ${GAMES[gg].n}. They get it next time they open the game.`)); }
    if (f === 'giftall') { const n = amount(); if (!(n >= 1)) return bad('Enter an amount.'); return act('ng_admin_gift', { p_username: '*', p_flakes: n, p_game: g }, r => (clear('giftall', 'amount'), `Sent ${fmt(n)} ${G0.coin} to ${fmt(r.players)} players in ${G0.n}.`)); }
    if (f === 'announce') { const t = field('announce', 'text'); if (!t) return bad('Type the announcement first.'); return act('ng_admin_announce', { p_message: t, p_hours: +field('announce', 'hours') }, () => (clear('announce', 'text'), 'Announcement posted.')); }
    if (f === 'event') return act('ng_admin_event', { p_event: field('event', 'kind'), p_hours: +field('event', 'hours') }, 'Event started.');
    if (f === 'addadmin') { const u = field('addadmin', 'user'); if (u) act('ng_owner_set_admin', { p_username: u, p_admin: true }, r => (clear('addadmin', 'user'), `${r.username} is an admin now.`)); }
  }
  function openAdmin(game) { if (!token()) return; A.on = true; A.game = GAMES[game] ? game : (GAMES[GAME] ? GAME : 'run'); A.msg = null; A.stats = null; A.rej = null; A.board = null; A.found = null; panelEl(); draw(); refresh().then(() => { if (A.sec === 'owner' && !me.owner) A.sec = 'review'; draw(); loadSec(); }); }

  /* ---------- player profiles ---------- */
  // Tap a name on any leaderboard (anything marked data-profile="Name") to see that player: level, flair, when they
  // joined and were last on, and their best on every board in every game with its rank. Public information only;
  // the server (ng_profile) gives banned players no profile. Night Snowboard adds "Add friend" and its name colors.
  const BOARD_N = { free: 'Best', daily: 'Daily', park: 'Trick Park', rush: 'Rush Hour' };
  let flairFn = null, profEl = null, profName = '', profArmed = '';
  const pArm = (k, label) => `<button type="button" class="buy ghost" data-pact="${k}">${profArmed === k ? 'Tap again' : label}</button>`;
  const friendsChanged = () => { try { dispatchEvent(new Event('studio-friends')); } catch (e) {} };
  const today = () => denDay();
  const dayWord = k => { const t = today(), d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() - 1); const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return k === t ? 'today' : k === y ? 'yesterday' : esc(k); };
  const lastOn = d => d == null ? '' : d <= 0 ? 'last on today' : d === 1 ? 'last on yesterday' : d < 60 ? `last on ${d} days ago` : 'last on a while ago';
  (() => { const st = document.createElement('style'); st.textContent = '.pname{background:none;border:0;padding:0;margin:0;color:inherit;font:inherit;cursor:pointer;text-align:left}.pname:hover b,.pname:focus-visible b{text-decoration:underline}'; document.head.appendChild(st); })();
  function closeProfile() { if (profEl) { profEl.remove(); profEl = null; profName = ''; } }
  function profileHTML(p) {
    const order = Object.keys(GAMES).sort((a, b) => (b === GAME) - (a === GAME)), byGame = {};
    for (const s of p.bests || []) (byGame[s.game] = byGame[s.game] || []).push(s);
    const name = flairFn ? flairFn(p.name, p.color, p.title) : `<b>${esc(p.name)}</b>`;
    const games = order.filter(g => byGame[g]).map(g => `<div class="box"><h3>${esc(GAMES[g].n)}</h3>${byGame[g].sort((a, b) => GAMES[g].boards.indexOf(a.board) - GAMES[g].boards.indexOf(b.board) || (a.period < b.period ? 1 : -1)).map(s =>
      `<div class="setrow" style="padding:5px 0"><span>${esc(BOARD_N[s.board] || s.board)}${s.period ? ` <span class="sub">${dayWord(s.period)}</span>` : ''}</span><span><b>${fmt(s.score)}</b> <span class="sub">#${int(s.rank)} of ${fmt(s.of)}</span></span></div>`).join('')}</div>`).join('');
    const rel = p.friend;
    const friendBtn = !rel || rel === 'me' ? '' : rel === 'friends' ? `<span class="sub">You're friends.</span> ${pArm('unfriend', 'Remove friend')}`
      : rel === 'asked' ? `<span class="sub">Friend request sent.</span> ${pArm('unfriend', 'Cancel request')}`
      : `<button type="button" class="buy" data-pact="friend">${rel === 'asked you' ? 'Accept friend request' : 'Add friend'}</button>${rel === 'asked you' ? ' ' + pArm('unfriend', 'Decline') : ''}`;
    const adminBtn = (me.admin || me.owner) && rel !== 'me' ? `<button type="button" class="buy ghost" data-pact="admin">Open in the Admin panel</button>` : '';
    return `<div class="box"><div class="item"><span style="font-size:18px">${name}</span><button type="button" class="back" data-pact="close" aria-label="Close">✕</button></div>
      <p class="sub" style="margin-top:6px">Level ${int(p.level)} · joined ${esc(new Date(p.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))} · ${lastOn(p.days)}${rel === 'me' ? ' · this is you' : ''}</p>
      ${friendBtn || adminBtn ? `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px">${friendBtn}${adminBtn}</div>` : ''}<p class="sub" data-pmsg style="margin-top:6px"></p></div>
      ${games || '<div class="box"><p>No scores on the boards yet.</p></div>'}`;
  }
  async function showProfile(name) {
    name = String(name || '').slice(0, 16); if (!name || OFFLINE) return;
    closeProfile(); profName = name;
    profEl = document.createElement('div'); profEl.id = 'studioProfile'; profEl.setAttribute('role', 'dialog'); profEl.setAttribute('aria-label', name + "'s profile");
    profEl.style.cssText = 'position:fixed;inset:0;z-index:85;overflow-y:auto;background:rgba(4,8,18,.78);-webkit-overflow-scrolling:touch';
    profEl.innerHTML = `<div class="panel" style="max-width:440px"><div class="box"><div class="item"><b>${esc(name)}</b><button type="button" class="back" data-pact="close" aria-label="Close">✕</button></div><p>Loading…</p></div></div>`;
    document.body.appendChild(profEl);
    profEl.addEventListener('click', async e => {
      if (e.target === profEl || e.target.classList.contains('panel')) return closeProfile();
      const b = e.target.closest('[data-pact]'); if (!b) return;
      const a = b.dataset.pact, nm = profName;
      if (a === 'close') return closeProfile();
      if (a === 'admin') { closeProfile(); openAdmin(GAME); A.sec = 'players'; A.q = nm; A.open = nm; A.found = null; return; }
      if (a === 'friend' || a === 'unfriend') {
        if (a === 'unfriend' && profArmed !== a) { profArmed = a; const lab = b.textContent; b.textContent = 'Tap again'; setTimeout(() => { if (profArmed === a) { profArmed = ''; if (b.isConnected) b.textContent = lab; } }, 4000); return; } // ending a friendship takes two taps
        profArmed = ''; b.disabled = true; const m = profEl.querySelector('[data-pmsg]');
        try { const r = await rpc(a === 'friend' ? 'ng_friend_request' : 'ng_friend_remove', { p_token: token(), p_username: nm });
          if (r && r.error) { if (m) m.textContent = r.error; b.disabled = false; return; }
          friendsChanged(); return showProfile(nm); }
        catch (err) { if (m) m.textContent = "That didn't go through. Try again."; b.disabled = false; } }
    });
    let p;
    try { p = await rpc('ng_profile', { p_name: name, p_token: token() }); } catch (e) { p = { error: "Couldn't load this profile. Check your connection." }; }
    if (!profEl || profName !== name) return;
    profEl.querySelector('.panel').innerHTML = p && !p.error ? profileHTML(p) : `<div class="box"><div class="item"><b>${esc(name)}</b><button type="button" class="back" data-pact="close" aria-label="Close">✕</button></div><p>${esc((p && p.error) || 'Something went wrong.')}</p></div>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-profile]'); if (!b) return; e.preventDefault(); e.stopPropagation(); showProfile(b.dataset.profile); }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape' && profEl) { e.stopPropagation(); e.preventDefault(); closeProfile(); } }, true); // Escape closes the card, not the game's menu behind it
  // a leaderboard name that opens the profile: Studio.profileName('Sin', '<b>Sin</b>')
  const profileName = (name, inner) => `<button type="button" class="pname" data-profile="${esc(name)}">${inner == null ? `<b>${esc(name)}</b>` : inner}</button>`;

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

  window.Studio = { layoutRow, set side(f) { sideFn = f; drawSide(); }, url: SERVER, key: KEY, game: GAME, games: GAMES, offline: OFFLINE, rpc, acct, setAcct, ready, refresh, runStart, eventMult, notesHTML, hidden, openAdmin, showProfile, profileName, set flair(f) { flairFn = f; }, dayKey: denDay, resetTime, nextReset, onChange: f => hooks.push(f),
    get admin() { return me.admin || me.owner; }, get owner() { return me.owner; } };
})();
