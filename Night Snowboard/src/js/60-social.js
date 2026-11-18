  /* ================= friends and friend ghosts ================= */
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
    rpc('ng_save_ghost', { p_token: save.acct.token, p_game: 'run', p_kind: mode, p_period: mode === 'daily' ? runDay || dayKey : '', p_score: s, p_data: packGhost(rec) }).catch(() => {});
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
