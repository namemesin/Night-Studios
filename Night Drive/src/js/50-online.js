  /* ================= online: Night Studios login, this game's own cloud save and leaderboards ================= */
  // The login is the studio-wide one (ng_login / ng_register). Everything else is per game: progress lives in its own
  // row (ng_game_load / ng_game_save with game 'drive') and scores go to this game's boards. Nothing here reads or
  // changes another Night Studios game's progress or currency.
  const GAME = 'drive';
  const sbReady = !OFFLINE && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) && SUPABASE_KEY.length > 20;
  const sbBase = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/';
  let serverUp = sbReady, authMode = 'login', authBusy = false, authErr = '';
  const accountsOn = () => sbReady && serverUp;
  async function rpc(fn, body, keepalive) {
    const r = await fetch(sbBase + fn, { method: 'POST', keepalive: !!keepalive, headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) { const err = new Error((data && data.message) || 'HTTP ' + r.status); err.status = r.status; throw err; }
    return data;
  }
  const loggedOut = e => /Not logged in/.test(String(e && e.message));
  const missing = e => e && (e.status === 404 || /schema cache|Could not find the function/i.test(String(e.message)));
  function onlineNotes() { return Studio.notesHTML() + (accountsOn() && !save.acct ? `<button class="go violet" type="button" data-act="go:account">Log in with Night Studios<small>Post scores and keep this game's progress on every device</small></button>` : ''); }

  // Two copies of this game's progress (this device and the account) are merged so nothing earned on either is lost.
  const maxObj = (a, b, ks) => { for (const k of ks) a[k] = Math.max(int(a[k]), int(b && b[k])); };
  function mergeSave(remote) {
    if (!remote || typeof remote !== 'object') return;
    save.earned = Math.max(save.earned, int(remote.earned)); save.spent = Math.min(Math.max(save.spent, int(remote.spent)), save.earned); save.xp = Math.max(save.xp, int(remote.xp)); save.gift = Math.max(int(save.gift), int(remote.gift));
    const A = D, B = cleanData(remote.d);
    A.best = Math.max(A.best, B.best); A.bestRush = Math.max(A.bestRush, B.bestRush); A.tut = A.tut || B.tut;
    maxObj(A.up, B.up, UPG.map(u => u.id)); maxObj(A.bs, B.bs, RUN_STATS); maxObj(A.life, B.life, LIFE_KEYS);
    A.done = strList(A.done.concat(B.done)); for (const k in COS) A.own[k] = strList(A.own[k].concat(B.own[k]));
    const seen = new Set(); A.top = A.top.concat(B.top).sort((x, y) => y.s - x.s).filter(t => { const k = t.s + ':' + t.d; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
    if (B.dlast > A.dlast) A.dlast = B.dlast;
    if (B.missions && (!A.missions || B.missions.day > A.missions.day)) A.missions = B.missions;
    else if (B.missions && A.missions && B.missions.day === A.missions.day) { for (let i = 0; i < 3; i++) { A.missions.prog[i] = Math.max(A.missions.prog[i], B.missions.prog[i]); A.missions.done[i] = A.missions.done[i] || B.missions.done[i]; } A.missions.bonus = A.missions.bonus || B.missions.bonus; }
    fixEquipped(); clearPreviews();
  }
  const cloudCopy = () => ({ v: 1, earned: save.earned, spent: save.spent, xp: save.xp, gift: save.gift, level: level(), d: save.d });
  let pushTimer = null, syncing = false, syncAgain = false, lastPushed = '';
  function cloudPush(now) { if (!save.acct || !accountsOn()) return; clearTimeout(pushTimer); pushTimer = setTimeout(cloudSync, now ? 0 : 1500); }
  async function cloudSync() {
    if (!save.acct || !accountsOn()) return;
    if (syncing) { syncAgain = true; return; }
    syncing = true; const token = save.acct.token;
    try {
      for (let tries = 0; tries < 3; tries++) {
        const body = cloudCopy(), json = JSON.stringify(body);
        if (json === lastPushed && save.acct.rev != null) break;
        const res = await rpc('ng_game_save', { p_token: token, p_game: GAME, p_data: body, p_rev: save.acct.rev });
        if (!save.acct || save.acct.token !== token) break;
        if (res && res.stale) { mergeSave(res.save); save.acct.rev = res.rev; saveLocal(); continue; }
        if (res && res.rev != null) { save.acct.rev = res.rev; lastPushed = json; saveLocal(); }
        break;
      }
    } catch (e) { if (loggedOut(e)) signedOut('You were logged out. Log in again to keep your progress synced.'); }
    syncing = false; if (syncAgain) { syncAgain = false; cloudPush(); }
  }
  function cloudForget() { save.acct = null; lastPushed = ''; }
  function signedOut(msg) { cloudForget(); setStudioAcct(null); authErr = msg || ''; authMode = 'login'; saveLocal(); if (!overlay.hidden) render(); }
  function takeAccount(res, token) {
    save.acct = { id: String(res.id), username: String(res.username), token, admin: false, rev: res.rev == null ? null : +res.rev };
    save.name = save.acct.username; setStudioAcct({ id: save.acct.id, username: save.acct.username, token: save.acct.token, admin: (studioAcct() || {}).admin });
    if (res.save) mergeSave(res.save);
    // coins an admin sent: the server keeps the total ever gifted, and whatever this progress hasn't seen yet is paid out
    if (int(res.gift) > int(save.gift)) { const n = int(res.gift) - int(save.gift); save.gift = int(res.gift); earn(n); toastUI(`A gift for you: +${fmt(n)} coins`, 'var(--gold)', 5000); sfx.win(); }
    announce(checkAch()); saveLocal(); syncWallet(); cloudPush(true);
  }
  addEventListener('pagehide', () => { try { if (save.acct && accountsOn() && save.acct.rev != null) rpc('ng_game_save', { p_token: save.acct.token, p_game: GAME, p_data: cloudCopy(), p_rev: save.acct.rev }, true).catch(() => {}); } catch (e) {} });

  VIEWS.account = () => {
    if (!accountsOn()) return `${backBtn('profile')}<h2>Account</h2><p>Logins aren't available right now. Your progress is saved on this device.</p>`;
    if (save.acct) return `${backBtn('profile')}<h2>Account</h2><p>Signed in as <b>${esc(save.acct.username)}</b>. This is your Night Studios login, the same one as in the studio's other games. Your Night Drive coins, cars and scores belong to this game only.</p>
      <button class="go alt" type="button" data-act="logout" ${authBusy ? 'disabled' : ''}>Log out</button><p class="sub">Logging out signs you out of every Night Studios game on this device and leaves a copy of your progress here. To change your password, use the account screen in Night Snowboard.</p>`;
    const reg = authMode === 'register';
    return `${backBtn('profile')}<h2>${reg ? 'Create a Night Studios login' : 'Log in with Night Studios'}</h2>
      <div class="tabs"><button type="button" data-act="auth:login" aria-pressed="${!reg}">I have a login</button><button type="button" data-act="auth:register" aria-pressed="${reg}">New login</button></div>
      <form class="box" id="authForm" novalidate><label for="uname">Username</label><input id="uname" type="text" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="NightOwl" value="${esc(save.name)}">
        <label for="upass">Password</label><input id="upass" type="password" maxlength="72" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'At least 6 characters' : 'Your password'}">
        <p class="err" role="alert">${esc(authErr)}</p><button class="go" type="submit" ${authBusy ? 'disabled' : ''}>${authBusy ? 'One sec…' : reg ? 'Create login' : 'Log in'}</button>
        <p class="sub">${reg ? "One login works in every Night Studios game. Each game keeps its own progress and currency. There's no password reset, so pick one you'll remember." : 'Use the same username and password as in Night Snowboard. What you have earned on this device joins your account.'}</p></form>`;
  };
  ACTIONS.auth = m => { authMode = m === 'register' ? 'register' : 'login'; authErr = ''; render(); };
  FORMS.authForm = async () => {
    if (authBusy) return;
    const user = cleanName($('uname').value), pass = $('upass').value;
    if (!NAME_OK.test(user)) { authErr = 'Usernames are 2 to 16 letters, numbers, spaces, dots, dashes or underscores.'; return render(); }
    if (pass.length < 6) { authErr = 'Passwords need at least 6 characters.'; return render(); }
    authBusy = true; authErr = ''; render();
    try {
      const res = await rpc(authMode === 'register' ? 'ng_register' : 'ng_login', { p_username: user, p_password: pass });
      if (res && res.token) {
        const mine = await rpc('ng_game_load', { p_token: res.token, p_game: GAME });
        authBusy = false; takeAccount(mine && mine.id ? mine : { id: res.id, username: res.username, rev: null }, res.token); sfx.win(); toastUI(`Welcome, ${res.username}`); return show('home');
      }
      authErr = (res && res.error) || 'Something went wrong. Try again.';
    } catch (e) { authErr = missing(e) ? "Logins aren't switched on yet." : "Couldn't reach the server. Check your connection and try again."; }
    authBusy = false; render();
  };
  ACTIONS.logout = async () => {
    if (authBusy || !save.acct) return;
    authBusy = true; render(); clearTimeout(pushTimer); const token = save.acct.token;
    await Promise.race([cloudSync(), new Promise(r => setTimeout(r, 6000))]);
    rpc('ng_logout', { p_token: token }).catch(() => {});
    authBusy = false; signedOut(''); toastUI('Logged out'); show('home');
  };

  const boards = {};
  const boardKey = tab => tab === 'daily' ? 'daily|' + dayKey : tab + '|';
  async function boardLoad(tab, quiet) {
    if (!accountsOn()) return;
    const key = boardKey(tab), b = boards[key] || (boards[key] = { st: 'loading', top: [], count: 0, me: null, at: 0 });
    if (b.busy || (quiet && Date.now() - b.at < 20000)) return;
    b.busy = true;
    try { const res = await rpc('ng_board', { p_game: GAME, p_board: tab, p_period: tab === 'daily' ? dayKey : '', p_token: save.acct ? save.acct.token : null }); b.top = Array.isArray(res && res.top) ? res.top : []; b.count = int(res && res.count); b.me = res && res.me ? res.me : null; b.st = 'ready'; b.at = Date.now(); }
    catch (e) { if (missing(e)) serverUp = false; if (b.st !== 'ready') b.st = 'error'; }
    b.busy = false; if (!overlay.hidden && (view === 'board' || view === 'home')) render();
  }
  function boardHint() { const b = boards[boardKey('free')]; return b && b.me && b.me.rank ? `#${b.me.rank} of ${fmt(b.count)}` : accountsOn() ? 'World ranks' : 'Your best'; }
  function boardHTML(tab) {
    if (!accountsOn()) return `<div class="box"><p>Shared leaderboards aren't available right now. Your own best drives are below.</p></div>`;
    const b = boards[boardKey(tab)];
    if (!b || b.st === 'loading') { if (!b) boardLoad(tab); return `<div class="box"><p>Loading the board…</p></div>`; }
    if (b.st === 'error') return `<div class="box"><p>Couldn't load the board. <button class="back" type="button" data-act="board:${tab}">Try again</button></p></div>`;
    const meId = save.acct && save.acct.id, title = tab === 'daily' ? `Daily route · ${dayLabel}` : tab === 'rush' ? 'Rush Hour' : 'Night Drive';
    const rows = b.top.map((r, i) => `<li class="${r.id === meId ? 'me' : ''}"><span class="n">${i + 1}</span><span><b>${esc(String(r.name || 'Driver').slice(0, 16))}</b>${r.meta && r.meta.dist && tab !== 'rush' ? ` <span class="sub">· ${(int(r.meta.dist) / 1000).toFixed(2)} km</span>` : ''}</span><b>${fmt(r.score)}</b></li>`).join('');
    const mine = b.me && b.me.rank > b.top.length ? `<ol class="lb" style="margin-top:6px"><li class="me"><span class="n">${b.me.rank}</span><span><b>${esc(playerName())}</b></span><b>${fmt(b.me.score)}</b></li></ol>` : '';
    return `<div class="box"><h3>${title} <b>${b.count > b.top.length ? `Top ${b.top.length} of ${fmt(b.count)}` : b.count === 1 ? '1 driver' : fmt(b.count) + ' drivers'}</b></h3>${rows ? `<ol class="lb">${rows}</ol>${mine}` : `<p>Nobody has posted here yet. Be the first.</p>`}${save.acct ? '' : `<p class="sub" style="margin-top:8px">Log in from your profile to post your scores.</p>`}</div>`;
  }
  // A run ticket: asked for when a run starts, sent with its score. The server only accepts a score for a run it saw start.
  let runTok = null;
  function armRun(mode) { runTok = save.acct && accountsOn() ? Studio.runStart(GAME, mode, mode === 'daily' ? dayKey : '') : null; }
  function submitScore(r) {
    if (!accountsOn()) return;
    if (!save.acct) { r.post = 'Log in with Night Studios from your profile to post scores.'; return; }
    const tab = r.mode; r.post = 'Posting your score…';
    const tok = save.acct.token;
    Promise.resolve(runTok).then(run => rpc('ng_submit', { p_token: tok, p_game: GAME, p_board: tab, p_period: tab === 'daily' ? dayKey : '', p_score: r.s, p_meta: { dist: r.d, zone: r.z, secs: r.secs, v: APP_VERSION } , p_run: run }))
      .then(res => { r.post = res && res.error ? esc(res.error) : res && res.rank ? `${res.best ? 'New personal best on the board' : 'Your best still stands'}: <b>#${res.rank}</b> of ${fmt(res.count)} on ${tab === 'daily' ? "today's route" : tab === 'rush' ? 'Rush Hour' : 'Night Drive'}.` : ''; const b = boards[boardKey(tab)]; if (b) b.at = 0; boardLoad(tab, true); })
      .catch(e => { if (loggedOut(e)) return signedOut("You were logged out, so that drive wasn't posted."); r.post = "Couldn't reach the leaderboard, so this drive wasn't posted."; })
      .finally(() => { if (lastRun === r && view === 'over' && !overlay.hidden) render(); });
  }

  /* ---------- run data for balancing ---------- */
  // Every run that ends, restarts or is quit reports how far it got and what ended it, so the game can be balanced
  // on what really happens. No names or personal details. Players can switch it off in Settings. Runs that can't be
  // sent (offline) wait in a small queue and go out the next time the game opens.
  function sendRun(item) { return fetch(sbBase + 'ng_log_run', { method: 'POST', keepalive: true, headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(item) }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); }); }
  function logRun(d) {
    try {
      if (!sbReady || !save.settings.stats || (DEV && !/[?&]logs\b/.test(location.search))) return; // local development stays out of the data; add ?logs to test it
      const item = { p_game: 'drive', p_data: Object.assign({ v: APP_VERSION, touch: usedTouch, at: Date.now() }, d), p_device: save.dev, p_token: save.acct ? save.acct.token : null };
      sendRun(item).catch(() => { try { const q = JSON.parse(localStorage.getItem('nightdrive-runq') || '[]'); q.push(item); localStorage.setItem('nightdrive-runq', JSON.stringify(q.slice(-20))); } catch (e) {} });
    } catch (e) {}
  }
  function flushRuns() { let q = []; try { q = JSON.parse(localStorage.getItem('nightdrive-runq') || '[]'); localStorage.removeItem('nightdrive-runq'); } catch (e) {} if (Array.isArray(q)) q.forEach((item, i) => setTimeout(() => sendRun(item).catch(() => {}), i * 2200)); }

  async function onlineBoot() {
    if (!sbReady) return;
    flushRuns();
    // pick up the studio login: logged in or out on the home page or in another game since this one was last open
    const shared = studioAcct();
    if (shared === undefined) { if (save.acct) setStudioAcct(save.acct); }
    else if (shared === null) { if (save.acct) { cloudForget(); saveLocal(); } }
    else if (!save.acct || save.acct.token !== shared.token) { save.acct = { id: String(shared.id), username: String(shared.username), token: shared.token, admin: !!shared.admin, rev: null }; lastPushed = ''; saveLocal(); }
    try {
      if (save.acct) { const me = await rpc('ng_game_load', { p_token: save.acct.token, p_game: GAME }); if (me && me.id) takeAccount(me, save.acct.token); else if (me && me.error) signedOut('Your login expired. Log in again.'); }
      else await rpc('ng_config');
    } catch (e) { if (missing(e)) serverUp = false; }
    if (!overlay.hidden) render();
    if (accountsOn()) boardLoad('free', true);
  }
