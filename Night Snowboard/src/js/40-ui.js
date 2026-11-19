  /* ================= screens ================= */
  const nameReady = () => true;
  const playerName = () => (save.acct && save.acct.username) || save.name || 'Guest';
  const progBar = (f, cls = '') => `<div class="prog ${cls}"><i style="width:${(clamp(f, 0, 1) * 100).toFixed(0)}%"></i></div>`;
  const stat = (label, v) => `<div class="stat"><span>${label}</span><b>${v}</b></div>`;

  // The site's home page (one folder up) is where you pick a game. This page's own home is the Night Snowboard menu.
  VIEWS.hub = () => VIEWS['run-home']();
  function checkinHTML() {
    const L = loginState();
    const days = LOGIN_PAY.map((p, i) => { const pos = L.streak % 7, got = L.claimed ? i < (pos || 7) : i < pos, now = !L.claimed && i === pos; return `<i class="${got ? 'got' : now ? 'now' : ''}">${p}</i>`; }).join('');
    return `<div class="box"><h3>Daily check-in <b>${L.claimed ? `Day ${L.streak} streak · back tomorrow` : `Day ${L.streak + 1}`}</b></h3><div class="streak">${days}</div>${L.claimed ? '' : `<button class="go gold" style="margin-top:10px" type="button" data-act="claim">Claim ${L.next} flakes</button>`}</div>`;
  }
  ACTIONS.claim = () => { const n = claimLogin(); if (n) { sfx.win(); toastUI(`+${n} flakes · day ${save.login.streak}`, 'var(--gold)'); announce(checkAch()); } render(); };
  function announce(list) { for (const a of list) toastUI(`${TIERS[a.tier].n} achievement: ${a.n} · +${TIERS[a.tier].r}`, TIERS[a.tier].c, 3600); if (list.length) { sfx.win(); persist(); } }

  VIEWS.profile = () => {
    const L = R.life, hrs = L.secs >= 3600 ? (L.secs / 3600).toFixed(1) + ' h' : Math.round(L.secs / 60) + ' min';
    return `${backBtn()}<h2>Profile</h2>
      ${save.acct ? `<p>Signed in as <b>${esc(save.acct.username)}</b>. This is your Night Studios login. Your Night Snowboard progress follows it to any device.</p><button class="go alt" type="button" data-act="go:account">Account</button>`
        : `<form class="box" id="nameForm" novalidate><label for="uname">Your name on the leaderboards</label><div class="inline"><input id="uname" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="PowderHound" value="${esc(save.name)}"><button class="buy" type="submit">Save</button></div><p class="err" id="nameErr" role="alert"></p></form>
           ${typeof accountsOn === 'function' && accountsOn() ? `<button class="go violet" type="button" data-act="go:account">Create an account or log in<small>Keep your progress on every device and post scores</small></button>` : ''}`}
      <div class="box"><h3>Rider <b>Level ${level()}</b></h3><div class="stats">${stat('Flakes earned', fmt(save.earned))}${stat('Check-ins', fmt(save.login.total))}${stat('Best streak', save.login.streak + ' d')}</div></div>
      <div class="box"><h3>Night Snowboard</h3><div class="stats">${stat('Best score', fmt(R.best))}${stat('Park best', fmt(R.bestPark))}${stat('Runs', fmt(L.runs))}${stat('Distance', L.meters >= 10000 ? (L.meters / 1000).toFixed(1) + ' km' : fmt(L.meters) + ' m')}${stat('Time riding', hrs)}${stat('Tricks', fmt(L.tricks))}${stat('Best combo', 'x' + R.bs.maxCombo)}${stat('Biggest spin', R.bs.maxSpin * 180 + '°')}${stat('Achievements', achCount() + '/' + ACH.length)}</div></div>
      ${armBtn('wipe', save.acct ? 'Log out and erase this device' : 'Erase all progress on this device', 'Tap again: this device is wiped')}`;
  };
  FORMS.nameForm = () => {
    const n = cleanName($('uname').value);
    if (!NAME_OK.test(n)) { $('nameErr').textContent = 'Use 2 to 16 letters, numbers, spaces, dots, dashes or underscores.'; return; }
    save.name = n; persist(); sfx.buy(); toastUI('Name saved'); render();
  };
  ACTIONS.wipe = () => { const keep = { settings: save.settings, dev: save.dev }; if (save.acct && typeof signedOut === 'function') signedOut(''); save = Object.assign(freshSave(), keep); R = save.games.run = cleanRunSave(null); for (const m of ['free', 'daily']) try { localStorage.removeItem(ghostKey(m)); } catch (e) {} clearPreviews(); saveLocal(); syncWallet(); show('hub'); toastUI('Progress erased', 'var(--rose)'); };

  VIEWS.flair = () => {
    const F = save.flair;
    const cols = COLORS.map(c => { const own = F.colors.includes(c.id), on = F.color === c.id; return `<div class="cos${on ? ' on' : ''}"><div class="pic" style="${c.c === 'rainbow' ? 'background:linear-gradient(90deg,#ff5577,#ffd24a,#5cf2b0,#4aa3ff,#b48cff)' : 'background:' + c.c}"></div><b>${c.n}</b><button type="button" class="buy${on ? ' on' : ''}" data-act="color:${c.id}" ${!own && coins() < c.cost ? 'disabled' : ''}>${on ? 'Take off' : own ? 'Use' : fmt(c.cost)}</button></div>`; }).join('');
    const tits = TITLES.map(t => { const own = titleOwned(t), on = F.title === t.id; return `<div class="item box"><div><h4>${esc(t.n)}</h4><p>${t.lvl ? `Reach level ${t.lvl}` : own ? 'Owned' : fmt(t.cost) + ' flakes'}</p></div><button type="button" class="buy${on ? ' on' : ''}" data-act="title:${t.id}" ${!own && (t.lvl || coins() < t.cost) ? 'disabled' : ''}>${on ? 'Take off' : own ? 'Use' : t.lvl ? 'Locked' : 'Buy'}</button></div>`; }).join('');
    return `${backBtn()}<h2>Flair</h2><p>How your name looks on Night Snowboard's leaderboards.</p>
      <div class="box" style="text-align:center;font-size:18px">${nameHTML(playerName(), F.color, F.title)}</div>
      <h3>Name colors</h3><div class="grid">${cols}</div><h3>Titles</h3><div class="list">${tits}</div>`;
  };
  ACTIONS.color = id => { const c = colorById(id), F = save.flair; if (!c) return; if (!F.colors.includes(id)) { if (!spend(c.cost)) return sfx.deny(); F.colors.push(id); F.color = id; sfx.buy(); } else { F.color = F.color === id ? '' : id; sfx.equip(); } persist(); render(); };
  ACTIONS.title = id => { const t = titleById(id), F = save.flair; if (!t) return; if (!titleOwned(t)) { if (t.lvl || !spend(t.cost)) return sfx.deny(); F.titles.push(id); F.title = id; sfx.buy(); } else { F.title = F.title === id ? '' : id; sfx.equip(); } persist(); render(); };

  VIEWS.settings = () => {
    const st = save.settings, inRun = gstate === 'paused';
    const slider = (id, label, v) => `<div class="slider"><label for="${id}">${label}</label><input type="range" id="${id}" min="0" max="100" step="5" value="${v}"><output id="${id}Out">${v ? v + '%' : 'Off'}</output></div>`;
    const sw = (k, label, on, a = 'On', b = 'Off') => `<div class="setrow"><span>${label}</span><button type="button" class="switch" data-act="set:${k}" aria-pressed="${on}">${on ? a : b}</button></div>`;
    const keyRows = KEY_ACTIONS.map(([a, label]) => `<div class="keyrow"><span>${label}</span>${[0, 1].map(i => { const hot = capturing && capturing.a === a && capturing.i === i, k = st.keys[a][i]; return `<button type="button" class="keycap${hot ? ' listening' : ''}${k ? '' : ' empty'}" data-act="bind:${a}.${i}">${hot ? 'Press a key…' : esc(keyLabel(k))}</button>`; }).join('')}</div>`).join('');
    return `${backBtn(inRun ? 'run-pause' : 'hub', inRun ? 'Back to pause menu' : 'Back')}<h2>Settings</h2>
      <div class="box"><h3>Sound</h3>${slider('volMusic', 'Music', st.music)}${slider('volSfx', 'Effects', st.sfx)}</div>
      <div class="box"><h3>Touch</h3>${sw('steer', 'Steering', st.steer === 'drag', 'Drag', 'Sides')}<p class="sub">${st.steer === 'drag' ? 'Put a finger down anywhere and slide. Slide farther to turn harder.' : 'Hold the left or right half of the screen.'}</p>${sw('haptics', 'Vibration', st.haptics)}</div>
      <div class="box"><h3>Keyboard <button type="button" class="back" data-act="set:keys">Reset</button></h3>${keyRows}<p class="sub">Click a box, then press a key. <kbd>Esc</kbd> cancels.</p></div>
      <div class="box"><h3>Game</h3>${sw('shake', 'Screen shake', st.shake)}${sw('ghost', 'Ghost of your best run', st.ghost)}${sw('fx', 'Effects quality', st.fx === 'full', 'Full', 'Low')}<p class="sub">Low draws fewer particles at a lower resolution. Try it if the game stutters.</p>${sw('stats', 'Share run data', st.stats)}<p class="sub">How far each run got and what ended it. It helps balance the game and never includes personal details.</p>${Studio.layoutRow()}</div>
      <p class="ver">Version ${esc(APP_VERSION)}</p>`;
  };
  Studio.side = () => VIEWS['run-help'] ? VIEWS['run-help']() : ''; // desktop layout: shown beside the playfield during a run
  ACTIONS.set = k => { const st = save.settings; if (k === 'steer') st.steer = st.steer === 'drag' ? 'sides' : 'drag'; else if (k === 'fx') { st.fx = st.fx === 'low' ? 'full' : 'low'; resize(); } else if (k === 'keys') st.keys = JSON.parse(JSON.stringify(DEF_KEYS)); else st[k] = !st[k]; sfx.click(); persist(); render(); };
  ACTIONS.bind = s => { const [a, i] = s.split('.'); capturing = { a, i: +i }; render(); };
  panel.addEventListener('input', e => {
    const id = e.target.id; if (id !== 'volMusic' && id !== 'volSfx') { if (id === 'achQ') { achQuery = e.target.value; const b = $('achList'); if (b) b.innerHTML = achListHTML(); } return; }
    const v = clamp(Math.round(+e.target.value || 0), 0, 100); save.settings[id === 'volMusic' ? 'music' : 'sfx'] = v; $(id + 'Out').textContent = v ? v + '%' : 'Off'; applyVolumes(); saveLocal();
  });
  panel.addEventListener('change', e => { if (e.target.id === 'volSfx') { initAudio(); applyVolumes(); chime([880, 1320]); } });

  /* ---------- Night Snowboard ---------- */
  const MODES = { free: ['Free Ride', 'Endless mountain'], daily: ['Daily Course', 'Same course for everyone'], park: ['Trick Park', '75 seconds, nothing to hit'] };
  function missionsHTML() {
    const ms = curMissions(), M = R.missions, n = M.done.filter(Boolean).length;
    return `<div class="box"><h3>Today's missions <b>${n}/3${M.bonus ? ' · bonus paid' : ` · all three pays +${MISSION_BONUS}`}</b></h3>${ms.map((m, i) => { const v = Math.min(m.g, missionVal(m, i, null, false)), done = M.done[i];
      return `<div class="mission${done ? ' done' : ''}"><span class="mt t${m.tier}">${MISSION_TIER[m.tier]}</span><div><b>${esc(m.t)}</b>${done ? '' : progBar(v / m.g) + `<span>${fmt(v)} / ${fmt(m.g)}</span>`}</div><span class="mp">${done ? '✓' : '+' + m.pay}</span></div>`; }).join('')}</div>`;
  }
  function nextAchHTML() {
    const next = ACH.filter(a => !R.done.includes(a.id)).map((a, i) => ({ a, i, p: Math.max(0, achProg(a)) })).sort((x, y) => y.p - x.p || x.i - y.i).slice(0, 3);
    if (!next.length) return `<div class="box"><h3>Achievements <b>All ${ACH.length} unlocked</b></h3><p>The mountain is yours.</p></div>`;
    return `<div class="box"><h3>Up next <b>${achCount()} / ${ACH.length}</b></h3>${next.map(({ a, p }) => achRow(a, false, p)).join('')}</div>`;
  }
  const achRow = (a, un, p) => `<div class="ach${un ? '' : ' locked'}"><span class="medal" style="${un ? `background:${TIERS[a.tier].c}` : `border-color:${TIERS[a.tier].c}`}">${un ? '★' : ''}</span><div><h4>${esc(a.n)}</h4><p>${esc(a.t)}</p>${!un && p >= 0 ? progBar(p) : ''}</div><span class="rw">${un ? 'Done' : TIERS[a.tier].n + '<br>+' + TIERS[a.tier].r}</span></div>`;
  VIEWS['run-home'] = () => {
    const mode = R.mode, kit = BOOSTS.map(b => `<button type="button" class="buy ${R.kit[b.id] ? 'on' : 'ghost'}" data-act="boost:${b.id}" ${!R.kit[b.id] && coins() < b.cost ? 'disabled' : ''} title="${esc(b.d)}">${b.short}<br><small>${R.kit[b.id] ? 'Ready' : fmt(b.cost)}</small></button>`).join('');
    const btn = m => `<button class="go${mode === m ? '' : ' alt'}" type="button" data-act="play:${m}">${MODES[m][0]}<small>${m === 'free' ? 'Best ' + fmt(R.best) : m === 'park' ? 'Best ' + fmt(R.bestPark) : MODES[m][1] + ' · new one at ' + Studio.resetTime()}</small></button>`;
    const lv = level();
    return `<a class="back" href="../">← Night Studios</a><div class="hero"><img src="${cosPreview('skin', cosItem('skin', R.eq.skin))}" alt="" width="72" height="72"><div style="flex:1"><div>${nameHTML(playerName(), save.flair.color, save.flair.title)}</div>
        <p class="sub">Rider level ${lv}${lv < MAX_LEVEL ? ` · ${fmt(save.xp - XP_AT[lv])} / ${fmt(XP_AT[lv + 1] - XP_AT[lv])} XP` : ' · max level'}</p>${progBar(levelFrac(), 'gold')}</div></div>
      ${typeof onlineNotes === 'function' ? onlineNotes() : ''}
      ${btn('free')}<div class="row2">${btn('daily')}${btn('park')}</div>
      <div class="box"><h3>Boosts <b>next Free Ride only</b></h3><div class="row4">${kit}</div></div>
      <div class="nav"><button type="button" data-act="go:run-shop">Upgrades<b>${UPG.reduce((n, u) => n + up(u.id), 0)}/${UPG.reduce((n, u) => n + u.cost.length, 0)}</b></button><button type="button" data-act="go:run-locker">Locker<b>${Object.keys(COS).reduce((n, k) => n + cosCount(k), 0)} items</b></button><button type="button" data-act="go:run-ach">Trophies<b>${achCount()}/${ACH.length}</b></button>
        <button type="button" data-act="go:run-board">Leaderboard<b>${typeof boardHint === 'function' ? boardHint() : 'Your best runs'}</b></button><button type="button" data-act="go:run-help">How to play<b>Tricks &amp; tips</b></button><button type="button" data-act="go:friends">Friends<b>${friendReqs ? friendReqs + ' new' : canSocial() ? 'Race ghosts' : 'Log in'}</b></button>
        <button type="button" data-act="go:profile">Profile<b>${esc(playerName())}</b></button><button type="button" data-act="go:flair">Flair<b>Colors &amp; titles</b></button>${Studio.admin ? `<button type="button" data-act="studioadmin">Admin<b>${Studio.owner ? 'Owner tools' : 'Commands &amp; data'}</b></button>` : `<button type="button" data-act="go:settings">Settings<b>Sound &amp; keys</b></button>`}</div>
      ${checkinHTML()}${missionsHTML()}${nextAchHTML()}
      ${IS_IOS && TOP_LEVEL && !STANDALONE ? `<p class="sub">Play it like an app: tap Share in Safari, then <b>Add to Home Screen</b>.</p>` : ''}${saveBroken ? `<p class="err">This browser is blocking storage, so progress won't be kept after you close the page.</p>` : ''}
      <p class="ver">Night Snowboard · a Night Studios game · version ${esc(APP_VERSION)}</p>`;
  };
  ACTIONS.play = m => { pendingGhost = null; startRun(m); };
  ACTIONS.boost = id => { const b = BOOSTS.find(x => x.id === id); if (!b) return; if (R.kit[id]) { R.kit[id] = false; save.spent = Math.max(0, save.spent - b.cost); sfx.equip(); } else { if (!spend(b.cost)) return sfx.deny(); R.kit[id] = true; sfx.buy(); } persist(); render(); };

  VIEWS['run-pause'] = () => `<h2>Paused</h2><p><b>${fmt(G.score)}</b> points · ${fmt(G.px / 10)} m${G.park ? ' · Trick Park' : ' · ' + ZONES[G.zone].name}</p>
    <button class="go" type="button" data-act="resume">Resume</button><div class="row3"><button class="go alt" type="button" data-act="restart">Restart</button><button class="go alt" type="button" data-act="go:settings">Settings</button><button class="go alt" type="button" data-act="quit">Quit</button></div>
    <p class="sub"><kbd>${esc(keyFor('pause'))}</kbd> resumes, <kbd>${esc(keyFor('restart'))}</kbd> restarts. Quitting or restarting throws this run away.</p>`;
  ACTIONS.resume = resumeRun; ACTIONS.restart = restartRun; ACTIONS.quit = () => { leaveRun(); show('run-home'); };
  ACTIONS.home = () => { leaveRun(); show('run-home'); };

  VIEWS['run-over'] = () => {
    const r = lastRun; if (!r) return VIEWS['run-home']();
    const s = r.st, z = ZONES[r.z], lv = level();
    const rows = [['Distance', fmt(s.meters) + ' m'], ['Best combo', 'x' + s.maxCombo], ['Tricks', `${s.tricks}${s.maxSpin ? ` · biggest ${s.maxSpin * 180}°` : ''}`], ['Best trick', fmt(s.bestTrick)], ['Rails · gates', `${s.rails} · ${s.gates}`], ['Near misses', s.nearMiss], ['Flakes grabbed', s.flakes]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    return `<h2>${esc(r.title)}</h2><div class="big">${fmt(r.s)}</div>
      <p>${r.mode === 'park' ? 'Trick Park session' : `${fmt(r.d)} m · reached <b style="color:${z.color}">${z.name}</b>${r.mode === 'daily' ? ' on the daily course' : ''}`}</p>
      <div class="box"><div class="setrow" style="padding:0"><span><b style="color:var(--ice)">+${fmt(r.flakes)} flakes</b></span><span><b style="color:var(--gold)">+${fmt(r.xp)} XP</b></span></div>
        <p class="sub" style="margin-top:6px">Level ${lv}${r.lv.levels ? ` · <b style="color:var(--gold)">Level up! +${fmt(r.lv.paid)} flakes</b>` : ''}</p>${progBar(levelFrac(), 'gold')}</div>
      ${r.vs ? `<div class="box" style="border-color:${r.vs.beat ? 'var(--mint)' : 'var(--rose)'}"><h3>Ghost race <b>${r.vs.beat ? 'You win!' : 'Not this time'}</b></h3><div class="break"><div><span>You</span><b>${fmt(r.s)}</b></div><div><span>${esc(r.vs.name)}'s ghost</span><b>${fmt(r.vs.s)}</b></div></div></div>` : ''}
      ${r.post ? `<p class="sub">${r.post}</p>` : ''}${r.newGhost ? `<p class="sub">This run is your new ghost.</p>` : ''}
      <button class="go" type="button" data-act="play:${r.mode}">Ride again<small>${MODES[r.mode][0]}</small></button>
      <div class="row2"><button class="go alt" type="button" data-act="share">Challenge a friend</button><button class="go alt" type="button" data-act="home">Menu</button></div><div id="shareMsg"></div>
      ${r.mis.length ? `<div class="box"><h3>Missions done <b>+${fmt(r.mis.reduce((n, m) => n + m.pay, 0))} flakes</b></h3>${r.mis.map(m => `<p class="sub">✓ ${esc(m.t)}</p>`).join('')}</div>` : ''}
      ${r.ach.length ? `<div class="box"><h3>Unlocked <b>+${fmt(r.ach.reduce((n, a) => n + TIERS[a.tier].r, 0))} flakes</b></h3>${r.ach.map(a => achRow(a, true)).join('')}</div>` : ''}
      <div class="box"><h3>This run</h3><div class="break">${rows}</div></div>`;
  };
  ACTIONS.share = () => {
    const r = lastRun; if (!r) return;
    const url = TOP_LEVEL ? location.origin + location.pathname : '';
    const text = r.mode === 'daily' ? `I scored ${fmt(r.s)} on today's Night Snowboard course. Same mountain for everyone. Beat it today.` : r.mode === 'park' ? `${fmt(r.s)} in 75 seconds of Night Snowboard's Trick Park. Your turn.` : `I just scored ${fmt(r.s)} on Night Snowboard. Bet you can't make it past ${ZONES[Math.min(r.z + 1, ZONES.length - 1)].name}.`;
    const full = url ? text + ' ' + url : text, box = $('shareMsg');
    const fallback = () => { if (box) box.innerHTML = `<p class="sub">Copy this and send it:</p><input type="text" readonly value="${esc(full)}">`; };
    if (navigator.share && COARSE && TOP_LEVEL) navigator.share(url ? { text, url } : { text }).catch(e => { if (!e || e.name !== 'AbortError') fallback(); });
    else try { navigator.clipboard.writeText(full).then(() => toastUI('Copied. Paste it to a friend.'), fallback); } catch (e) { fallback(); }
  };

  VIEWS['run-shop'] = () => `${backBtn()}<h2>Upgrades</h2><p>Flakes come from the slope, missions, trophies, check-ins and level-ups.</p><div class="list">${UPG.map(u => {
    const l = up(u.id), max = l >= u.cost.length;
    return `<div class="box item"><div><h4>${u.n}</h4><p>${u.d(l)}${max ? '' : `<br><span style="color:var(--mint)">Next: ${u.d(l + 1)}</span>`}</p><div class="pips">${u.cost.map((_, i) => `<span class="${i < l ? 'on' : ''}"></span>`).join('')}</div></div><button class="buy" type="button" data-act="upg:${u.id}" ${max || coins() < u.cost[l] ? 'disabled' : ''}>${max ? 'Maxed' : fmt(u.cost[l])}</button></div>`; }).join('')}</div>`;
  ACTIONS.upg = id => { const u = UPG.find(x => x.id === id), l = up(id); if (!u || l >= u.cost.length || !spend(u.cost[l])) return sfx.deny(); R.up[id] = l + 1; sfx.buy(); announce(checkAch()); persist(); render(); };

  let lockerTab = 'skin';
  VIEWS['run-locker'] = () => {
    const kind = lockerTab, items = COS[kind];
    return `${backBtn()}<h2>Locker</h2><div class="tabs">${Object.keys(COS).map(k => `<button type="button" data-act="locker:${k}" aria-pressed="${k === kind}">${COS_LABEL[k]} ${cosCount(k)}/${COS[k].length}</button>`).join('')}</div>
      <div class="grid">${items.map(it => { const own = cosOwned(kind, it), on = R.eq[kind] === it.id;
        return `<div class="cos${on ? ' on' : ''}${own ? '' : ' locked'}"><img src="${cosPreview(kind, it)}" alt="" width="72" height="72"><b>${esc(it.n)}</b><span class="rar r-${it.r}">${RARITY[it.r].toUpperCase()}</span>
          ${on ? `<span class="how" style="color:var(--mint)">Equipped</span>` : own ? `<button type="button" class="buy" data-act="equip:${kind}.${it.id}">Use</button>` : it.cost ? `<button type="button" class="buy" data-act="cosbuy:${kind}.${it.id}" ${coins() < it.cost ? 'disabled' : ''}>${fmt(it.cost)}</button>` : `<span class="how">${esc(cosHow(it))}</span>`}</div>`; }).join('')}</div>`;
  };
  ACTIONS.locker = k => { if (COS[k]) lockerTab = k; sfx.click(); render(); };
  ACTIONS.equip = s => { const [kind, id] = s.split('.'), it = COS[kind] && COS[kind].find(x => x.id === id); if (!it || !cosOwned(kind, it)) return; R.eq[kind] = id; clearPreviews(); sfx.equip(); persist(); render(); };
  ACTIONS.cosbuy = s => { const [kind, id] = s.split('.'), it = COS[kind] && COS[kind].find(x => x.id === id); if (!it || !it.cost || cosOwned(kind, it) || !spend(it.cost)) return sfx.deny(); R.own[kind].push(id); R.eq[kind] = id; clearPreviews(); sfx.buy(); announce(checkAch()); persist(); render(); };

  let achQuery = '', achFilter = 'all';
  function achListHTML() {
    const q = achQuery.trim().toLowerCase();
    return ACH_CATS.map(cat => {
      const all = ACH.filter(a => a.cat === cat), got = all.filter(a => R.done.includes(a.id)).length;
      const shown = all.filter(a => (achFilter === 'all' || (achFilter === 'done') === R.done.includes(a.id)) && (!q || (a.n + ' ' + a.t + ' ' + TIERS[a.tier].n).toLowerCase().includes(q)));
      return shown.length ? `<details${q || achFilter !== 'all' ? ' open' : ''}><summary><span>${esc(cat)}</span><b>${got}/${all.length}</b></summary>${shown.map(a => achRow(a, R.done.includes(a.id), achProg(a))).join('')}</details>` : '';
    }).join('') || `<p>Nothing matches.</p>`;
  }
  VIEWS['run-ach'] = () => `${backBtn()}<h2>Trophies</h2><p>${achCount()} of ${ACH.length} unlocked. ${Object.values(TIERS).map(t => `<b style="color:${t.c}">${t.n}</b> +${t.r}`).join(' · ')}</p>
    <input id="achQ" type="search" maxlength="40" placeholder="Search trophies" value="${esc(achQuery)}" aria-label="Search trophies">
    <div class="tabs">${[['all', 'All'], ['locked', 'To get'], ['done', 'Unlocked']].map(([id, l]) => `<button type="button" data-act="achf:${id}" aria-pressed="${achFilter === id}">${l}</button>`).join('')}</div><div id="achList" class="list">${achListHTML()}</div>`;
  ACTIONS.achf = f => { achFilter = f; render(); };

  let boardTab = 'free';
  VIEWS['run-board'] = () => {
    const tabs = `<div class="tabs">${[['free', 'Free Ride'], ['daily', 'Today'], ['park', 'Trick Park']].map(([id, l]) => `<button type="button" data-act="board:${id}" aria-pressed="${boardTab === id}">${l}</button>`).join('')}</div>`;
    const online = typeof boardHTML === 'function' ? boardHTML(boardTab) : `<div class="box"><p>Shared leaderboards aren't switched on in this copy. Your own best runs are below.</p></div>`;
    const mine = R.top.length ? `<ol class="lb">${R.top.map((t, i) => `<li><span class="n">${i + 1}</span><span>${ZONES[t.z].name} · ${fmt(t.d)} m${t.m === 'daily' ? ' · daily' : ''}</span><b>${fmt(t.s)}</b></li>`).join('')}</ol>` : `<p>No runs yet.</p>`;
    return `${backBtn()}<h2>Leaderboard</h2>${tabs}${online}<div class="box"><h3>Your best runs <b>Park best ${fmt(R.bestPark)}</b></h3>${mine}</div>`;
  };
  ACTIONS.board = t => { boardTab = t; sfx.click(); render(); if (typeof boardLoad === 'function') boardLoad(t); };

  VIEWS['run-help'] = () => `${backBtn()}<h2>How to play</h2>
    <div class="box"><h3>Ride</h3><p>${COARSE ? 'Slide a finger left and right to steer.' : `Steer with <kbd>${esc(keyFor('left'))}</kbd> <kbd>${esc(keyFor('right'))}</kbd>.`} Trees, rocks, snowmen and skiers end your run. There is always a clear line through.</p></div>
    <div class="box"><h3>Multiplier</h3><p>Skim past obstacles, clear gates, land tricks, finish grinds and smash things to build your <b>combo</b>. Every combo step adds 10% to everything you score, up to x6. Stop taking risks and it runs out.</p></div>
    <div class="box"><h3>Tricks</h3><p>Hit a kicker or ride off the end of a rail to get air. Steer to spin; let go and the board settles on the nearest clean angle. Every half turn counts: 180, 360, 540 and up. Land crooked and you bail.</p>
      <p>${COARSE ? 'Hold <b>Grab</b>' : `Hold <kbd>${esc(keyFor('grab'))}</kbd>`} in the air for a grab bonus, but let go before you land. Land dead straight for a <b>Perfect</b> (+50%). Landing an odd spin leaves you riding <b>switch</b>, which pays +20% on the next trick.</p></div>
    <div class="box"><h3>Lanterns and Flares</h3><p>Three lanterns charge a <b>Flare</b>${COARSE ? '' : ` (<kbd>${esc(keyFor('flare'))}</kbd>)`}: a few seconds of smashing through everything at full speed while flakes fly to you.</p></div>
    <div class="box"><h3>The mountain</h3><p>${ZONES.map(z => `<b style="color:${z.color}">${z.name}</b> ${fmt(z.at)} m`).join(' · ')}</p><p>The Backcountry is dark: lanterns light the way. The Summit has crevasses to jump. Ice patches make you slide.</p></div>
    <div class="box"><h3>Modes</h3><p><b>Free Ride</b> is endless and random. The <b>Daily Course</b> is the same for everyone and changes every day at ${Studio.resetTime()}; boosts are off there. <b>Trick Park</b> is 75 seconds of kickers and rails with nothing to hit.</p></div>`;
  ACTIONS.studioadmin = () => Studio.openAdmin('run');
  Studio.onChange(() => { if (!overlay.hidden && view === 'run-home') render(); });
