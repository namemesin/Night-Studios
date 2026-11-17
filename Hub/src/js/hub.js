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
  // Someone who logged in to Night Run before the studio login existed stays logged in.
  if (acct === undefined) { const old = (readJSON('nightgames-save1') || {}).acct; if (old && typeof old.token === 'string') { setStudioAcct(old); acct = studioAcct(); } }

  let versions = {};
  const GAMES = [
    { id: 'run', href: 'run/', cls: '', name: 'Night Run', desc: 'Snowboard a midnight mountain. Spin off kickers, grind rails and skim the trees to build a multiplier.',
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
  ];
  function render() {
    const keep = document.activeElement && document.activeElement.id === 'uname' ? $('uname').value : null;
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
    panel.innerHTML = `<h1 class="studio">Night Studios</h1><p>Games after dark. Pick one and play.</p><div class="games">${cards}<div class="game soon"><span class="tag">COMING SOON</span><h3>More on the way</h3><p>New games will show up here. Each one keeps its own progress, currency and leaderboards.</p></div></div>${login}${acct && Studio.admin ? `<button class="go alt" type="button" id="adminBtn">${Studio.owner ? 'Owner and admin panel' : 'Admin panel'}</button>` : ''}<p class="ver">Night Studios · version ${esc(APP_VERSION)}</p>`;
    if (keep !== null && $('uname')) { $('uname').value = keep; }
  }
  panel.addEventListener('click', async e => {
    const m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; err = ''; return render(); }
    if (e.target.id === 'adminBtn') return Studio.openAdmin('run');
    if (e.target.id === 'outBtn' && acct && !busy) { const t = acct.token; setStudioAcct(null); acct = null; render(); rpc('ng_logout', { p_token: t }).catch(() => {}); }
  });
  panel.addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return;
    const user = cleanName($('uname').value), pass = $('upass').value;
    if (!NAME_OK.test(user)) { err = 'Usernames are 2 to 16 letters, numbers, spaces, dots, dashes or underscores.'; return render(); }
    if (pass.length < 6) { err = 'Passwords need at least 6 characters.'; return render(); }
    busy = true; err = ''; render();
    try {
      const res = await rpc(mode === 'register' ? 'ng_register' : 'ng_login', { p_username: user, p_password: pass });
      if (res && res.token) { setStudioAcct({ id: res.id, username: res.username, token: res.token, admin: res.admin }); acct = studioAcct(); Studio.refresh(); } else err = (res && res.error) || 'Something went wrong. Try again.';
    } catch (ex) { err = "Couldn't reach the server. Check your connection and try again."; }
    busy = false; render();
  });
  // Coming back to this tab after logging in or out inside a game.
  addEventListener('storage', e => { if (e.key === STUDIO_KEY) { acct = studioAcct(); render(); } });
  addEventListener('pageshow', () => { acct = studioAcct(); render(); });
  render(); Studio.onChange(render);
  fetch('versions.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(v => { if (v && typeof v === 'object') { versions = v; render(); } }).catch(() => {});
  if (sbReady && acct) rpc('ng_me', { p_token: acct.token }).then(me => { if (me && me.error) { setStudioAcct(null); acct = null; err = 'Your login expired. Log in again.'; render(); } }).catch(ex => { if (ex.status === 404) { serverUp = false; render(); } });
