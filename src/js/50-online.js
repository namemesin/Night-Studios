  /* ================= online: accounts, cloud save, leaderboards, events ================= */
  // Everything here talks to the functions in backend/night-games.sql. With no server set up (or ?offline while
  // developing) the game simply keeps progress on the device.
  const sbReady = !OFFLINE && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) && SUPABASE_KEY.length > 20;
  const sbBase = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/';
  let serverUp = sbReady, cfg = { msg: '', msgEnds: 0, ev: '', evEnds: 0 }, authMode = 'register', authBusy = false, authErr = '', acctNote = '';
  const accountsOn = () => sbReady && serverUp;
  async function rpc(fn, body, keepalive) {
    const r = await fetch(sbBase + fn, { method: 'POST', keepalive: !!keepalive, headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) { const err = new Error((data && data.message) || 'HTTP ' + r.status); err.status = r.status; throw err; }
    return data;
  }
  const loggedOut = e => /Not logged in/.test(String(e && e.message));
  const missing = e => e && (e.status === 404 || /schema cache|Could not find the function/i.test(String(e.message)));

  /* ---------- events and announcements ---------- */
  function takeConfig(c) {
    if (!c) return;
    const now = Date.parse(c.now) || Date.now(), rel = t => t ? Date.now() + (Date.parse(t) - now) : 0;
    cfg = { msg: c.message ? String(c.message).slice(0, 200) : '', msgEnds: rel(c.message_until), ev: /^(flakes|xp|both)[23]$/.test(c.event || '') ? c.event : '', evEnds: rel(c.event_until) };
  }
  function serverEvent(kind) { if (!cfg.ev || cfg.evEnds <= Date.now()) return 1; const m = /^(flakes|xp|both)([23])$/.exec(cfg.ev); return m && (m[1] === kind || m[1] === 'both') ? +m[2] : 1; }
  const leftText = ms => { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`; };
  function onlineNotes() {
    let h = '';
    if (cfg.msg && cfg.msgEnds > Date.now()) h += `<div class="box" style="border-color:var(--ice)"><h3>Announcement</h3><p>${esc(cfg.msg)}</p></div>`;
    if (serverEvent('xp') > 1 || serverEvent('flakes') > 1) { const m = /^(flakes|xp|both)([23])$/.exec(cfg.ev); h += `<div class="box" style="border-color:var(--gold)"><h3>${m[2] === '3' ? 'Triple' : 'Double'} ${m[1] === 'both' ? 'flakes and XP' : m[1] === 'xp' ? 'XP' : 'flakes'} <b>${leftText(cfg.evEnds - Date.now())} left</b></h3><p>On every run, in every game.</p></div>`; }
    if (accountsOn() && !save.acct) h += `<button class="go violet" type="button" data-act="go:account">Create a free account<small>Post scores and keep your progress on every device</small></button>`;
    return h;
  }

  /* ---------- cloud save ---------- */
  // Two copies of the same progress (this device and the account) are merged so nothing earned on either is lost:
  // totals and bests take the higher number, unlock lists are joined.
  const maxObj = (a, b, keys) => { for (const k of keys) a[k] = Math.max(int(a[k]), int(b && b[k])); };
  function mergeSave(remote) {
    const r = loadSave(remote); if (!remote || typeof remote !== 'object') return;
    save.earned = Math.max(save.earned, r.earned); save.spent = Math.min(Math.max(save.spent, r.spent), save.earned); save.xp = Math.max(save.xp, r.xp); save.gift = Math.max(save.gift, r.gift);
    if (r.login.last > save.login.last) save.login = { last: r.login.last, streak: r.login.streak, total: Math.max(r.login.total, save.login.total) }; else save.login.total = Math.max(r.login.total, save.login.total);
    const F = save.flair; F.colors = strList(F.colors.concat(r.flair.colors)); F.titles = strList(F.titles.concat(r.flair.titles)); if (!F.color) F.color = r.flair.color; if (!F.title) F.title = r.flair.title;
    const A = R, B = cleanRunSave(r.games.run);
    A.best = Math.max(A.best, B.best); A.bestPark = Math.max(A.bestPark, B.bestPark); A.tut = A.tut || B.tut;
    maxObj(A.up, B.up, UPG.map(u => u.id)); maxObj(A.bs, B.bs, RUN_STATS); maxObj(A.life, B.life, LIFE_KEYS);
    A.done = strList(A.done.concat(B.done)); for (const k in COS) A.own[k] = strList(A.own[k].concat(B.own[k]));
    for (const b of BOOSTS) A.kit[b.id] = A.kit[b.id] || B.kit[b.id];
    const seen = new Set(); A.top = A.top.concat(B.top).sort((x, y) => y.s - x.s).filter(t => { const k = t.s + ':' + t.d; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
    if (B.dlast > A.dlast) { A.dlast = B.dlast; A.dstreak = B.dstreak; }
    if (B.missions && (!A.missions || B.missions.day > A.missions.day)) A.missions = B.missions;
    else if (B.missions && A.missions && B.missions.day === A.missions.day) { for (let i = 0; i < 3; i++) { A.missions.prog[i] = Math.max(A.missions.prog[i], B.missions.prog[i]); A.missions.done[i] = A.missions.done[i] || B.missions.done[i]; } A.missions.bonus = A.missions.bonus || B.missions.bonus; }
    fixEquipped(); clearPreviews();
  }
  const cloudCopy = () => ({ v: 1, name: save.acct ? save.acct.username : save.name, earned: save.earned, spent: save.spent, xp: save.xp, gift: save.gift, level: level(), login: save.login, flair: save.flair, games: save.games });
  let pushTimer = null, syncing = false, syncAgain = false, lastPushed = '';
  function cloudPush(now) { if (!save.acct || !accountsOn()) return; clearTimeout(pushTimer); pushTimer = setTimeout(cloudSync, now ? 0 : 1500); }
  async function cloudSync() {
    if (!save.acct || !accountsOn()) return;
    if (syncing) { syncAgain = true; return; }
    syncing = true;
    const token = save.acct.token;
    try {
      for (let tries = 0; tries < 3; tries++) {
        const body = cloudCopy(), json = JSON.stringify(body);
        if (json === lastPushed && save.acct.rev != null) break;
        const res = await rpc('ng_save', { p_token: token, p_data: body, p_rev: save.acct.rev });
        if (!save.acct || save.acct.token !== token) break;
        if (res && res.stale) { mergeSave(res.save); save.acct.rev = res.rev; saveLocal(); continue; } // another device saved first
        if (res && res.rev != null) { save.acct.rev = res.rev; lastPushed = json; saveLocal(); }
        break;
      }
    } catch (e) { if (loggedOut(e)) signedOut('You were logged out. Log in again to keep your progress synced.'); }
    syncing = false;
    if (syncAgain) { syncAgain = false; cloudPush(); }
  }
  function cloudForget() { save.acct = null; lastPushed = ''; friendReqs = 0; fr.list = []; fr.incoming = []; fr.outgoing = []; fr.at = 0; fr.st = 'idle'; adm.ov = null; }
  function signedOut(msg) { cloudForget(); authErr = msg || ''; authMode = 'login'; saveLocal(); if (!overlay.hidden) render(); }
  function takeAccount(res) {
    save.acct = { id: String(res.id), username: String(res.username), token: res.token || save.acct.token, admin: !!res.admin, rev: res.rev == null ? null : +res.rev };
    save.name = save.acct.username;
    if (res.save) mergeSave(res.save);
    // flakes an admin sent: the server keeps the total ever gifted, and whatever this progress hasn't seen yet is paid out
    if (int(res.gift) > save.gift) { const n = int(res.gift) - save.gift; save.gift = int(res.gift); earn(n); toastUI(`A gift for you: +${fmt(n)} flakes`, 'var(--gold)', 5000); sfx.win(); }
    if (res.requests != null) friendReqs = int(res.requests);
    takeConfig(res.config); announce(checkAch()); saveLocal(); syncWallet(); cloudPush(true);
  }
  addEventListener('pagehide', () => { try { if (save.acct && accountsOn() && save.acct.rev != null) rpc('ng_save', { p_token: save.acct.token, p_data: cloudCopy(), p_rev: save.acct.rev }, true).catch(() => {}); } catch (e) {} });

  /* ---------- account screen ---------- */
  VIEWS.account = () => {
    if (!accountsOn()) return `${backBtn('profile')}<h2>Account</h2><p>Accounts aren't available right now. Your progress is saved on this device.</p>`;
    if (save.acct) return `${backBtn('profile')}<h2>Account</h2><p>Signed in as <b>${esc(save.acct.username)}</b>. Progress saves to your account automatically.</p>${acctNote ? `<p class="ok">${esc(acctNote)}</p>` : ''}
      <form class="box" id="passForm" novalidate><label for="oldPass">Change password</label><input id="oldPass" type="password" maxlength="72" autocomplete="current-password" placeholder="Current password"><input id="newPass" type="password" maxlength="72" autocomplete="new-password" placeholder="New password (6+ characters)"><p class="err" role="alert">${esc(authErr)}</p><button class="buy" type="submit" ${authBusy ? 'disabled' : ''}>Change password</button></form>
      <button class="go alt" type="button" data-act="logout" ${authBusy ? 'disabled' : ''}>Log out</button><p class="sub">Logging out leaves a copy of your progress on this device.</p>`;
    const reg = authMode === 'register';
    return `${backBtn('profile')}<h2>${reg ? 'Create account' : 'Log in'}</h2>
      <div class="tabs"><button type="button" data-act="auth:register" aria-pressed="${reg}">New account</button><button type="button" data-act="auth:login" aria-pressed="${!reg}">I have one</button></div>
      <form class="box" id="authForm" novalidate><label for="uname">Username</label><input id="uname" type="text" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="PowderHound" value="${esc(save.name)}">
        <label for="upass">Password</label><input id="upass" type="password" maxlength="72" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'At least 6 characters' : 'Your password'}">
        <p class="err" role="alert">${esc(authErr)}</p><button class="go" type="submit" ${authBusy ? 'disabled' : ''}>${authBusy ? 'One sec…' : reg ? 'Create account' : 'Log in'}</button>
        <p class="sub">${reg ? "Everything you've earned on this device moves into the account. There's no password reset, so pick one you'll remember." : 'Progress on this device is combined with your account.'}</p></form>`;
  };
  ACTIONS.auth = m => { authMode = m === 'login' ? 'login' : 'register'; authErr = ''; render(); };
  FORMS.authForm = async () => {
    if (authBusy) return;
    const user = cleanName($('uname').value), pass = $('upass').value;
    if (!NAME_OK.test(user)) { authErr = 'Usernames are 2 to 16 letters, numbers, spaces, dots, dashes or underscores.'; return render(); }
    if (pass.length < 6) { authErr = 'Passwords need at least 6 characters.'; return render(); }
    authBusy = true; authErr = ''; render();
    try {
      const res = await rpc(authMode === 'register' ? 'ng_register' : 'ng_login', { p_username: user, p_password: pass });
      if (res && res.token) { authBusy = false; save.acct = { token: res.token }; takeAccount(res); sfx.win(); toastUI(`Welcome, ${res.username}`); acctNote = ''; rpc('ng_me', { p_token: res.token }).then(me => { if (me && me.id && save.acct) { takeAccount(me); render(); } }).catch(() => {}); return show('hub'); }
      authErr = (res && res.error) || 'Something went wrong. Try again.';
    } catch (e) { authErr = missing(e) ? "Accounts aren't switched on yet." : "Couldn't reach the server. Check your connection and try again."; }
    authBusy = false; render();
  };
  FORMS.passForm = async () => {
    if (authBusy || !save.acct) return;
    authBusy = true; authErr = ''; acctNote = ''; const a = $('oldPass').value, b = $('newPass').value; render();
    try { const res = await rpc('ng_change_password', { p_token: save.acct.token, p_old: a, p_new: b }); if (res && res.error) authErr = res.error; else acctNote = 'Password changed. Other devices were logged out.'; }
    catch (e) { if (loggedOut(e)) { authBusy = false; return signedOut('You were logged out. Log in again.'); } authErr = "Couldn't reach the server. Try again."; }
    authBusy = false; render();
  };
  ACTIONS.logout = async () => {
    if (authBusy || !save.acct) return;
    authBusy = true; render(); clearTimeout(pushTimer);
    const token = save.acct.token;
    await Promise.race([cloudSync(), new Promise(r => setTimeout(r, 6000))]);
    rpc('ng_logout', { p_token: token }).catch(() => {});
    authBusy = false; signedOut(''); toastUI('Logged out'); show('hub');
  };

  /* ---------- leaderboards ---------- */
  const boards = {};
  const boardKey = tab => tab === 'daily' ? 'daily|' + dayKey : tab + '|';
  async function boardLoad(tab, quiet) {
    if (!accountsOn()) return;
    const key = boardKey(tab), b = boards[key] || (boards[key] = { st: 'loading', top: [], count: 0, me: null, at: 0 });
    if (b.busy || (quiet && Date.now() - b.at < 20000)) return;
    b.busy = true;
    try {
      const res = await rpc('ng_board', { p_game: 'run', p_board: tab, p_period: tab === 'daily' ? dayKey : '', p_token: save.acct ? save.acct.token : null });
      b.top = Array.isArray(res && res.top) ? res.top : []; b.count = int(res && res.count); b.me = res && res.me ? res.me : null; b.st = 'ready'; b.at = Date.now();
    } catch (e) { if (missing(e)) serverUp = false; if (b.st !== 'ready') b.st = 'error'; }
    b.busy = false;
    if (!overlay.hidden && (view === 'run-board' || view === 'run-home')) render();
  }
  function boardHint() { const b = boards[boardKey('free')]; return b && b.me && b.me.rank ? `#${b.me.rank} of ${fmt(b.count)}` : accountsOn() ? 'World ranks' : 'Your best runs'; }
  function boardHTML(tab) {
    if (!accountsOn()) return `<div class="box"><p>Shared leaderboards aren't available right now. Your own best runs are below.</p></div>`;
    const b = boards[boardKey(tab)];
    if (!b || b.st === 'loading') { if (!b) boardLoad(tab); return `<div class="box"><p>Loading the board…</p></div>`; }
    if (b.st === 'error') return `<div class="box"><p>Couldn't load the board. <button class="back" type="button" data-act="board:${tab}">Try again</button></p></div>`;
    const meId = save.acct && save.acct.id, title = tab === 'daily' ? `Daily course · ${dayLabel}` : tab === 'park' ? 'Trick Park' : 'Free Ride';
    const rows = b.top.map((r, i) => `<li class="${r.id === meId ? 'me' : ''}"><span class="n">${i + 1}</span><span>${r.level ? `<span class="ttl" style="margin:0 6px 0 0">${int(r.level)}</span>` : ''}${nameHTML(String(r.name || 'Rider').slice(0, 16), r.color, r.title)}${r.meta && r.meta.dist && tab !== 'park' ? ` <span class="sub">· ${fmt(r.meta.dist)} m</span>` : ''}</span><b>${fmt(r.score)}</b></li>`).join('');
    const mine = b.me && b.me.rank > b.top.length ? `<ol class="lb" style="margin-top:6px"><li class="me"><span class="n">${b.me.rank}</span><span>${nameHTML(playerName(), save.flair.color, save.flair.title)}</span><b>${fmt(b.me.score)}</b></li></ol>` : '';
    return `<div class="box"><h3>${title} <b>${b.count > b.top.length ? `Top ${b.top.length} of ${fmt(b.count)}` : b.count === 1 ? '1 rider' : fmt(b.count) + ' riders'}</b></h3>${rows ? `<ol class="lb">${rows}</ol>${mine}` : `<p>Nobody has posted here yet. Be the first.</p>`}
      ${save.acct ? '' : `<p class="sub" style="margin-top:8px">Log in from your profile to post your scores.</p>`}</div>`;
  }
  function submitScore(r) {
    if (!accountsOn()) return;
    if (!save.acct) { r.post = 'Create a free account from your profile to post scores to the leaderboards.'; return; }
    const tab = r.mode, period = tab === 'daily' ? dayKey : '';
    r.post = 'Posting your score…';
    rpc('ng_submit', { p_token: save.acct.token, p_game: 'run', p_board: tab, p_period: period, p_score: r.s, p_meta: { dist: r.d, zone: r.z, secs: r.secs, v: APP_VERSION } })
      .then(res => { r.post = res && res.error ? esc(res.error) : res && res.rank ? `${res.best ? 'New personal best on the board' : 'Your best still stands'}: <b>#${res.rank}</b> of ${fmt(res.count)} on ${tab === 'daily' ? "today's course" : tab === 'park' ? 'Trick Park' : 'Free Ride'}.` : ''; const b = boards[boardKey(tab)]; if (b) b.at = 0; boardLoad(tab, true); })
      .catch(e => { if (loggedOut(e)) return signedOut("You were logged out, so that run wasn't posted."); r.post = "Couldn't reach the leaderboard, so this run wasn't posted."; })
      .finally(() => { if (lastRun === r && view === 'run-over' && !overlay.hidden) render(); });
  }

  async function onlineBoot() {
    if (!sbReady) return;
    try {
      if (save.acct) {
        const me = await rpc('ng_me', { p_token: save.acct.token });
        if (me && me.id) takeAccount(me); else if (me && me.error) signedOut('Your login expired. Log in again.');
      } else takeConfig(await rpc('ng_config'));
    } catch (e) { if (missing(e)) serverUp = false; } // offline or not set up yet: carry on with the saved copy
    if (!overlay.hidden) render();
    if (accountsOn()) boardLoad('free', true);
    setInterval(() => { if (accountsOn() && !document.hidden && gstate !== 'run' && gstate !== 'crash') rpc('ng_config').then(c => { const k = cfg.msg + cfg.ev; takeConfig(c); if (k !== cfg.msg + cfg.ev && !overlay.hidden && view === 'hub') render(); }).catch(() => {}); }, 120000);
  }
