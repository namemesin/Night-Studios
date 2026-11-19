  /* ================= NIGHT STUDIOS: home page ================= */
  // Pick a game, and log in once for all of them. The login lives in this browser under one shared key that every
  // game reads; each game keeps its own progress, currency and leaderboards and never touches another game's.
  const SUPABASE_URL = Studio.url, SUPABASE_KEY = Studio.key; // the server address lives in one place: shared/studio.js
  const APP_VERSION = 'dev'; // the publish step replaces this with the real version number
  const OFFLINE = /[?&]offline\b/.test(location.search);
  const $ = id => document.getElementById(id), panel = $('panel');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.floor(+n || 0).toLocaleString('en-US');
  const NAME_OK = /^[A-Za-z0-9 _.\-]{2,16}$/, cleanName = v => String(v || '').replace(/\s+/g, ' ').trim();
  const readJSON = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };

  // The shared login. Never set: nobody has logged in here yet. null: logged out on purpose.
  const STUDIO_KEY = 'nightstudios-acct';
  function studioAcct() { try { const raw = localStorage.getItem(STUDIO_KEY); if (raw === null) return undefined; const a = JSON.parse(raw); return a && typeof a.token === 'string' ? a : null; } catch (e) { return null; } }
  function setStudioAcct(a) { try { localStorage.setItem(STUDIO_KEY, JSON.stringify(a ? { id: String(a.id), username: String(a.username), token: a.token, admin: !!a.admin } : null)); } catch (e) {} }

  const sbReady = !OFFLINE && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) && SUPABASE_KEY.length > 20;
  let serverUp = sbReady, acct = studioAcct(), mode = 'login', busy = false, err = '';
  async function rpc(fn, body) {
    const r = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) { const e = new Error((data && data.message) || 'HTTP ' + r.status); e.status = r.status; throw e; }
    return data;
  }
  // Someone who logged in to Night Snowboard before the studio login existed stays logged in.
  if (acct === undefined) { const old = (readJSON('nightgames-save1') || {}).acct; if (old && typeof old.token === 'string') { setStudioAcct(old); acct = studioAcct(); } }

  let versions = {};
  const GAMES = [
    { id: 'run', href: 'snowboard/', cls: '', name: 'Night Snowboard', desc: 'Snowboard a midnight mountain. Spin off kickers, grind rails and skim the trees to build a multiplier.',
      meta: () => { const r = ((readJSON('nightgames-save1') || {}).games || {}).run || {}; return [r.best ? 'Your best ' + fmt(r.best) : 'Not played yet', 'Free Ride · Daily Course · Trick Park']; } },
    { id: 'watch', href: 'watch/', cls: ' watch', name: 'Night Watch', desc: 'Keep the campfire alive until sunrise. Build lanterns, brambles, flares and beacons to hold back the shades.',
      meta: () => { const d = (readJSON('nightwatch-save1') || {}).d || {}, b = (d.best || {}).free; return [b ? 'Your best ' + fmt(b) : 'Not played yet', 'Keep Watch · Daily Watch']; } },
    { id: 'drive', href: 'drive/', cls: ' drive', name: 'Night Drive', desc: 'Race the dawn through a neon city. Weave traffic, draft for nitro and skim past cars to keep the clock alive.',
      meta: () => { const d = (readJSON('nightdrive-save1') || {}).d || {}; return [d.best ? 'Your best ' + fmt(d.best) : 'Not played yet', 'Night Drive · Daily Route · Rush Hour']; } },
    { id: 'heist', href: 'heist/', cls: ' heist', name: 'Night Heist', desc: 'Slip past the guards and searchlights, take the vault piece and get out. Every floor is tighter than the last.',
      meta: () => { const d = (readJSON('nightheist-save1') || {}).d || {}, b = (d.best || {}).free; return [b ? 'Your best ' + fmt(b) : 'Not played yet', 'The Job · Daily Job']; } },
    { id: 'keep', href: 'keep/', cls: ' keep', name: 'Night Keep', desc: 'Hold the keep against the night. Build towers beside the road, send your knight into the fight and call down meteors.',
      meta: () => { const d = (readJSON('nightkeep-save1') || {}).d || {}, b = (d.best || {}).free; return [b ? 'Your best ' + fmt(b) : 'Not played yet', 'Six maps · Daily Siege']; } },
    { id: 'market', href: 'market/', cls: ' market', name: 'Night Market', desc: 'Run a stall at the night bazaar. Buy low, sell high, chase the rumors and make the rent before every dawn.',
      meta: () => { const d = (readJSON('nightmarket-save1') || {}).d || {}, b = (d.best || {}).free; return [b ? 'Your best ' + fmt(b) : 'Not played yet', 'Open Market · Daily Market']; } },
    { id: 'rally', href: 'drift/', cls: ' rally', name: 'Night Drift', desc: 'Top-down drift racing. Slide through the corners for a boost, and race your own ghost and the daily best.',
      meta: () => { const d = (readJSON('nightrally-save1') || {}).d || {}, b = (d.best || {}).free; return [b ? 'Your best ' + fmt(b) : 'Not played yet', 'Moonlight Circuit · Daily Stage']; } },
  ];
  /* ---------- friends: one list for every game ---------- */
  // Add friends here (or from anyone's profile, by tapping their name on a leaderboard) and compare bests and
  // today's dailies in every game. Tapping a name opens that player's profile with all their stats.
  const fr = { st: 'idle', at: 0, data: null, game: 'run', msg: null, busy: false };
  const seen = t => { const m = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 60000)); return !t ? '' : m < 6 ? 'on now' : m < 60 ? `on ${m} min ago` : m < 1440 ? `on ${Math.round(m / 60)} h ago` : `on ${Math.round(m / 1440)} d ago`; };
  async function loadFriends(force) {
    if (!acct || !serverUp || (fr.st === 'loading') || (!force && Date.now() - fr.at < 20000)) return;
    fr.st = 'loading'; const tok = acct.token;
    try { const r = await rpc('ng_friends_all', { p_token: tok }); if (acct && acct.token === tok && r && Array.isArray(r.players)) { fr.data = r; fr.st = 'ready'; fr.at = Date.now(); } else { fr.st = 'error'; fr.at = Date.now(); } }
    catch (ex) { fr.st = 'error'; fr.at = Date.now(); } // tries again on the next look after 20 seconds
    render();
  }
  async function friendDo(fn, args, ok) {
    if (fr.busy || !acct) return; fr.busy = true; fr.msg = null; render();
    try { const r = await rpc(fn, Object.assign({ p_token: acct.token }, args)); fr.msg = r && r.error ? { t: r.error } : ok ? { ok: true, t: typeof ok === 'function' ? ok(r) : ok } : null; }
    catch (ex) { fr.msg = { t: "That didn't go through. Check your connection and try again." }; }
    fr.busy = false; await loadFriends(true);
  }
  function friendsHTML() {
    if (!acct || !serverUp) return '';
    const D = fr.data, dis = fr.busy ? 'disabled' : '';
    const add = `<form id="friendForm" novalidate><div class="inline"><input id="friendName" type="text" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Add a friend by username"><button class="buy" type="submit" ${dis}>Add</button></div></form>`;
    const msg = fr.msg ? `<p class="${fr.msg.ok ? 'ok' : 'err'}" role="alert">${esc(fr.msg.t)}</p>` : '';
    if (!D) return `<div class="box"><h3>Friends <b>every game</b></h3>${add}${msg}<p>${fr.st === 'error' ? "Couldn't load your friends. Try again in a minute." : 'Loading your friends…'}</p></div>`;
    const reqs = D.incoming.map(r => `<div class="item" style="padding:6px 0"><span>${Studio.profileName(r.name)} wants to be friends</span><span><button type="button" class="buy" data-fr="yes" data-id="${esc(r.id)}" ${dis}>Accept</button> <button type="button" class="buy ghost" data-fr="no" data-id="${esc(r.id)}" ${dis}>Decline</button></span></div>`).join('')
      + D.outgoing.map(r => `<div class="item" style="padding:6px 0"><span class="sub">Waiting on ${Studio.profileName(r.name)}</span><button type="button" class="buy ghost" data-fr="no" data-id="${esc(r.id)}" ${dis}>Cancel</button></div>`).join('');
    const games = GAMES.filter(g => !Studio.hidden(g.id) || Studio.owner); if (!games.some(g => g.id === fr.game)) fr.game = games[0].id;
    const g = fr.game, friends = D.players.filter(p => !p.me);
    const tabs = `<div class="tabs" style="margin-top:10px">${games.map(x => `<button type="button" data-frg="${x.id}" aria-pressed="${x.id === g}">${esc(x.name.replace(/^Night /, ''))}</button>`).join('')}</div>`;
    const rows = D.players.slice().sort((a, b) => (+(b.best || {})[g] || 0) - (+(a.best || {})[g] || 0) || a.name.localeCompare(b.name)).map((p, i) => {
      const best = (p.best || {})[g], today = (p.today || {})[g];
      return `<div class="item" style="padding:7px 0;border-top:1px solid var(--line)"><span><span class="sub">${i + 1}.</span> ${Studio.profileName(p.name)}${p.me ? ' <span class="sub">(you)</span>' : ''} <span class="ttl">${Math.max(1, Math.floor(+p.level || 1))}</span>${p.me ? '' : `<br><span class="sub">${esc(seen(p.seen))}</span>`}</span><span style="text-align:right"><b>${best ? fmt(best) : '–'}</b><br><span class="sub">today ${today ? fmt(today) : '–'}</span></span></div>`; }).join('');
    const list = friends.length ? tabs + rows : `<p class="sub" style="margin-top:8px">No friends yet. Add someone by their username, or tap a name on any leaderboard and choose Add friend.</p>`;
    return `<div class="box"><h3>Friends <b>${friends.length ? friends.length + (friends.length === 1 ? ' friend' : ' friends') + ' · every game' : 'every game'}</b></h3>${add}${msg}${reqs ? `<div style="margin-top:8px">${reqs}</div>` : ''}${list}${friends.length ? `<p class="sub" style="margin-top:8px">Best score and today's daily. Tap a name to see all of their stats. A new daily starts at ${esc(Studio.resetTime())}.</p>` : ''}</div>`;
  }
  function render() {
    const keep = document.activeElement && document.activeElement.id === 'uname' ? $('uname').value : null, keepF = $('friendName') ? $('friendName').value : '', focusF = document.activeElement && document.activeElement.id === 'friendName';
    $('whoChip').textContent = acct ? acct.username : 'Guest';
    // a game the owner has taken down is not listed (the owner still sees it, marked)
    const cards = GAMES.filter(g => !Studio.hidden(g.id) || Studio.owner).map(g => `<a class="game live${g.cls}" href="${g.href}"><span class="tag">${Studio.hidden(g.id) ? 'HIDDEN FROM PLAYERS · ' : ''}PLAY NOW${versions[g.id] && versions[g.id] !== 'dev' ? ' · VERSION ' + esc(versions[g.id]) : ''}</span><h3>${g.name}</h3><p>${g.desc}</p><div class="meta">${g.meta().map(m => `<span>${esc(m)}</span>`).join('')}</div></a>`).join('');
    let login;
    if (!serverUp) login = `<div class="box"><h3>Login</h3><p>Logins aren't available right now. You can still play; progress saves on this device.</p></div>`;
    else if (acct) login = `<div class="box"><div class="who"><div><h3 style="margin:0">${esc(acct.username)}</h3><p class="sub">Signed in to Night Studios. Every game uses this login and saves its own progress to it.</p></div><button class="buy ghost" type="button" id="outBtn" ${busy ? 'disabled' : ''}>Log out</button></div></div>`;
    else { const reg = mode === 'register';
      login = `<form class="box" id="authForm" novalidate><h3>${reg ? 'Create your Night Studios login' : 'Log in to Night Studios'} <b>one login, every game</b></h3>
        <div class="tabs"><button type="button" data-mode="login" aria-pressed="${!reg}">I have a login</button><button type="button" data-mode="register" aria-pressed="${reg}">New here</button></div>
        <label for="uname">Username</label><input id="uname" type="text" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="NightOwl">
        <label for="upass">Password</label><input id="upass" type="password" maxlength="72" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'At least 6 characters' : 'Your password'}">
        <p class="err" role="alert">${esc(err)}</p><button class="go violet" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'One sec…' : reg ? 'Create login' : 'Log in'}</button>
        <p class="sub">${reg ? "Posts your scores and keeps each game's progress on every device. There's no password reset, so pick one you'll remember." : 'You can also just play. Logging in later keeps what you earned on this device.'}</p></form>`; }
    panel.innerHTML = `<h1 class="studio">Night Studios</h1><p>Games after dark. Pick one and play.</p><div class="games">${cards}<div class="game soon"><span class="tag">COMING SOON</span><h3>More on the way</h3><p>New games will show up here. Each one keeps its own progress, currency and leaderboards.</p></div></div>${login}${friendsHTML()}${acct && Studio.admin ? `<button class="go alt" type="button" id="adminBtn">${Studio.owner ? 'Owner and admin panel' : 'Admin panel'}</button>` : ''}<div class="box lay">${Studio.layoutRow()}</div><p class="ver">Night Studios · version ${esc(APP_VERSION)}</p>`;
    if (keep !== null && $('uname')) { $('uname').value = keep; }
    if ($('friendName')) { $('friendName').value = keepF; if (focusF) $('friendName').focus(); }
    if (acct && serverUp && fr.st !== 'loading' && Date.now() - fr.at > 20000) loadFriends();
  }
  panel.addEventListener('click', async e => {
    const m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; err = ''; return render(); }
    if (e.target.id === 'adminBtn') return Studio.openAdmin('run');
    const fg = e.target.closest('[data-frg]'); if (fg) { fr.game = fg.dataset.frg; return render(); }
    const fb = e.target.closest('[data-fr]'); if (fb && !fb.disabled) { const yes = fb.dataset.fr === 'yes'; return friendDo('ng_friend_respond', { p_id: fb.dataset.id, p_accept: yes }, yes ? "You're friends now." : null); }
    if (e.target.id === 'outBtn' && acct && !busy) { const t = acct.token; setStudioAcct(null); acct = null; render(); rpc('ng_logout', { p_token: t }).catch(() => {}); }
  });
  panel.addEventListener('submit', async e => {
    e.preventDefault();
    if (e.target.id === 'friendForm') { const n = cleanName($('friendName').value); if (!n) return; return friendDo('ng_friend_request', { p_username: n }, r => { if ($('friendName')) $('friendName').value = ''; return r.friends ? `You and ${r.name} are friends now.` : `Request sent to ${r.name}.`; }); }
    if (busy) return;
    const user = cleanName($('uname').value), pass = $('upass').value;
    if (!NAME_OK.test(user)) { err = 'Usernames are 2 to 16 letters, numbers, spaces, dots, dashes or underscores.'; return render(); }
    if (pass.length < 6) { err = 'Passwords need at least 6 characters.'; return render(); }
    busy = true; err = ''; render();
    try {
      const res = await rpc(mode === 'register' ? 'ng_register' : 'ng_login', { p_username: user, p_password: pass });
      if (res && res.token) { setStudioAcct({ id: res.id, username: res.username, token: res.token, admin: res.admin }); acct = studioAcct(); Studio.refresh(); fr.data = null; fr.at = 0; fr.st = 'idle'; } else err = (res && res.error) || 'Something went wrong. Try again.';
    } catch (ex) { err = "Couldn't reach the server. Check your connection and try again."; }
    busy = false; render();
  });
  // Coming back to this tab after logging in or out inside a game.
  addEventListener('storage', e => { if (e.key === STUDIO_KEY) { acct = studioAcct(); fr.data = null; fr.at = 0; fr.st = 'idle'; render(); } });
  addEventListener('studio-friends', () => loadFriends(true)); // added or removed someone from a profile card
  addEventListener('pageshow', () => { acct = studioAcct(); render(); });
  render(); Studio.onChange(render);
  fetch('versions.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(v => { if (v && typeof v === 'object') { versions = v; render(); } }).catch(() => {});
  if (sbReady && acct) rpc('ng_me', { p_token: acct.token }).then(me => { if (me && me.error) { setStudioAcct(null); acct = null; err = 'Your login expired. Log in again.'; render(); } }).catch(ex => { if (ex.status === 404) { serverUp = false; render(); } });
