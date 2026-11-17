  /* ================= screens ================= */
  const playerName = () => (save.acct && save.acct.username) || save.name || 'Guest';
  const progBar = (f, cls = '') => `<div class="prog ${cls}"><i style="width:${(clamp(f, 0, 1) * 100).toFixed(0)}%"></i></div>`;
  const stat = (label, v) => `<div class="stat"><span>${label}</span><b>${v}</b></div>`;
  const MODES = { free: ['Night Drive', 'Outrun the dawn'], daily: ['Daily Route', 'Same traffic for everyone'], rush: ['Rush Hour', '90 seconds of gridlock'] };
  function announce(list) { for (const a of list) toastUI(`${TIERS[a.tier].n} trophy: ${a.n} · +${TIERS[a.tier].r}`, TIERS[a.tier].c, 3600); if (list.length) { sfx.win(); persist(); } }
  const achRow = (a, un, p) => `<div class="ach${un ? '' : ' locked'}"><span class="medal" style="${un ? `background:${TIERS[a.tier].c}` : `border-color:${TIERS[a.tier].c}`}">${un ? '★' : ''}</span><div><h4>${esc(a.n)}</h4><p>${esc(a.t)}</p>${!un && p >= 0 ? progBar(p) : ''}</div><span class="rw">${un ? 'Done' : TIERS[a.tier].n + '<br>+' + TIERS[a.tier].r}</span></div>`;
  function missionsHTML() {
    const ms = curMissions(), M = D.missions, n = M.done.filter(Boolean).length;
    return `<div class="box"><h3>Tonight's jobs <b>${n}/3${M.bonus ? ' · bonus paid' : ` · all three pays +${MISSION_BONUS}`}</b></h3>${ms.map((m, i) => { const v = Math.min(m.g, missionVal(m, i, null, false)), done = M.done[i];
      return `<div class="mission${done ? ' done' : ''}"><span class="mt t${m.tier}">${MISSION_TIER[m.tier]}</span><div><b>${esc(m.t)}</b>${done ? '' : progBar(v / m.g) + `<span>${fmt(v)} / ${fmt(m.g)}</span>`}</div><span class="mp">${done ? '✓' : '+' + m.pay}</span></div>`; }).join('')}</div>`;
  }
  function nextAchHTML() {
    const next = ACH.filter(a => !D.done.includes(a.id)).map((a, i) => ({ a, i, p: Math.max(0, achProg(a)) })).sort((x, y) => y.p - x.p || x.i - y.i).slice(0, 3);
    return next.length ? `<div class="box"><h3>Up next <b>${achCount()} / ${ACH.length}</b></h3>${next.map(({ a, p }) => achRow(a, false, p)).join('')}</div>` : `<div class="box"><h3>Trophies <b>All ${ACH.length}</b></h3><p>The city is yours.</p></div>`;
  }
  VIEWS.hub = VIEWS.home = () => {
    const mode = D.mode, lv = level();
    const btn = m => `<button class="go${mode === m ? '' : ' alt'}" type="button" data-act="play:${m}">${MODES[m][0]}<small>${m === 'daily' ? dayLabel + ' · ' + MODES[m][1] : m === 'free' ? 'Best ' + fmt(D.best) : 'Best ' + fmt(D.bestRush)}</small></button>`;
    return `<a class="back" href="../">← Night Studios</a><div class="hero"><img src="${cosPreview('car', cosItem('car', D.eq.car))}" alt="" width="72" height="72"><div style="flex:1"><div><b>${esc(playerName())}</b> <span class="ttl">${esc(cosItem('car', D.eq.car).n)}</span></div>
        <p class="sub">Driver level ${lv}${lv < MAX_LEVEL ? ` · ${fmt(save.xp - XP_AT[lv])} / ${fmt(XP_AT[lv + 1] - XP_AT[lv])} XP` : ' · max'}</p>${progBar(levelFrac(), 'gold')}</div></div>
      ${typeof onlineNotes === 'function' ? onlineNotes() : ''}
      ${btn('free')}<div class="row2">${btn('daily')}${btn('rush')}</div>
      <div class="nav"><button type="button" data-act="go:garage">Garage<b>${cosCount('car')}/${CARS.length} cars</b></button><button type="button" data-act="go:shop">Upgrades<b>${UPG.reduce((n, u) => n + up(u.id), 0)}/${UPG.reduce((n, u) => n + u.cost.length, 0)}</b></button><button type="button" data-act="go:ach">Trophies<b>${achCount()}/${ACH.length}</b></button>
        <button type="button" data-act="go:board">Leaderboard<b>${typeof boardHint === 'function' ? boardHint() : 'Your best'}</b></button><button type="button" data-act="go:help">How to play<b>Tips</b></button><button type="button" data-act="go:profile">Profile<b>${esc(playerName())}</b></button>${Studio.admin ? `<button type="button" data-act="studioadmin">Admin<b>${Studio.owner ? 'Owner tools' : 'Commands &amp; data'}</b></button>` : ''}</div>
      ${missionsHTML()}${nextAchHTML()}
      ${IS_IOS && TOP_LEVEL && !STANDALONE ? `<p class="sub">Play it like an app: tap Share in Safari, then <b>Add to Home Screen</b>.</p>` : ''}${saveBroken ? `<p class="err">This browser is blocking storage, so progress won't be kept.</p>` : ''}
      <p class="ver">Night Drive · a Night Studios game · version ${esc(APP_VERSION)}</p>`;
  };
  ACTIONS.play = m => startRun(m);

  VIEWS.pause = () => `<h2>Paused</h2><p><b>${fmt(G.score)}</b> points · ${(G.px / PXM / 1000).toFixed(2)} km · ${(G.clock / 60).toFixed(1)} s of night left</p>
    <button class="go" type="button" data-act="resume">Resume</button><div class="row3"><button class="go alt" type="button" data-act="restart">Restart</button><button class="go alt" type="button" data-act="go:settings">Settings</button><button class="go alt" type="button" data-act="quit">Quit</button></div>
    <p class="sub"><kbd>${esc(keyFor('pause'))}</kbd> resumes, <kbd>${esc(keyFor('restart'))}</kbd> restarts. Quitting or restarting throws this drive away.</p>`;
  ACTIONS.resume = resumeRun; ACTIONS.restart = restartRun; ACTIONS.quit = ACTIONS.menu = () => { leaveRun(); show('home'); };

  VIEWS.over = () => {
    const r = lastRun; if (!r) return VIEWS.home();
    const s = r.st, z = ZONES[r.z], lv = level();
    const rows = [['Distance', (s.meters / 1000).toFixed(2) + ' km'], ['Top speed', s.kmh + ' km/h'], ['Best combo', 'x' + s.maxCombo], ['Near misses', s.nearMiss + (s.oncoming ? ` · ${s.oncoming} head-on` : '')], ['Checkpoints', s.cps], ['Nitro fired', s.nitros], ['Crashes', s.crashes], ['Coins grabbed', s.coins]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    return `<h2>${esc(r.title)}</h2><div class="big">${fmt(r.s)}</div>
      <p>${r.mode === 'rush' ? 'Rush Hour' : `${(r.d / 1000).toFixed(2)} km · reached <b style="color:${z.color}">${z.name}</b>${r.mode === 'daily' ? ' on the daily route' : ''}`}</p>
      <div class="box"><div class="setrow" style="padding:0"><span><b style="color:var(--ice)">+${fmt(r.coins)} coins</b></span><span><b style="color:var(--gold)">+${fmt(r.xp)} XP</b></span></div>
        <p class="sub" style="margin-top:6px">Driver level ${lv}${r.lv.levels ? ` · <b style="color:var(--gold)">Level up! +${fmt(r.lv.paid)} coins</b>` : ''}</p>${progBar(levelFrac(), 'gold')}</div>
      ${r.post ? `<p class="sub">${r.post}</p>` : ''}
      <button class="go" type="button" data-act="play:${r.mode}">Drive again<small>${MODES[r.mode][0]}</small></button>
      <div class="row2"><button class="go alt" type="button" data-act="share">Challenge a friend</button><button class="go alt" type="button" data-act="menu">Menu</button></div><div id="shareMsg"></div>
      ${r.mis.length ? `<div class="box"><h3>Jobs done <b>+${fmt(r.mis.reduce((n, m) => n + m.pay, 0))} coins</b></h3>${r.mis.map(m => `<p class="sub">✓ ${esc(m.t)}</p>`).join('')}</div>` : ''}
      ${r.ach.length ? `<div class="box"><h3>Unlocked <b>+${fmt(r.ach.reduce((n, a) => n + TIERS[a.tier].r, 0))} coins</b></h3>${r.ach.map(a => achRow(a, true)).join('')}</div>` : ''}
      <div class="box"><h3>This drive</h3><div class="break">${rows}</div></div>`;
  };
  ACTIONS.share = () => {
    const r = lastRun; if (!r) return;
    const url = TOP_LEVEL ? location.origin + location.pathname : '';
    const text = r.mode === 'daily' ? `I scored ${fmt(r.s)} on today's Night Drive route. Same traffic for everyone. Beat it before midnight.` : r.mode === 'rush' ? `${fmt(r.s)} in 90 seconds of Night Drive rush hour. Your turn.` : `I made it ${(r.d / 1000).toFixed(1)} km before dawn in Night Drive and scored ${fmt(r.s)}. Catch me.`;
    const full = url ? text + ' ' + url : text, box = $('shareMsg'), fallback = () => { if (box) box.innerHTML = `<p class="sub">Copy this and send it:</p><input type="text" readonly value="${esc(full)}">`; };
    if (navigator.share && COARSE && TOP_LEVEL) navigator.share(url ? { text, url } : { text }).catch(e => { if (!e || e.name !== 'AbortError') fallback(); });
    else try { navigator.clipboard.writeText(full).then(() => toastUI('Copied. Paste it to a friend.'), fallback); } catch (e) { fallback(); }
  };

  VIEWS.shop = () => `${backBtn('home')}<h2>Upgrades</h2><p>Coins come from the road, jobs, trophies and level-ups.</p><div class="list">${UPG.map(u => { const l = up(u.id), max = l >= u.cost.length;
    return `<div class="box item"><div><h4>${u.n}</h4><p>${u.d(l)}${max ? '' : `<br><span style="color:var(--mint)">Next: ${u.d(l + 1)}</span>`}</p><div class="pips">${u.cost.map((_, i) => `<span class="${i < l ? 'on' : ''}"></span>`).join('')}</div></div><button class="buy" type="button" data-act="upg:${u.id}" ${max || coins() < u.cost[l] ? 'disabled' : ''}>${max ? 'Maxed' : fmt(u.cost[l])}</button></div>`; }).join('')}</div>`;
  ACTIONS.upg = id => { const u = UPG.find(x => x.id === id), l = up(id); if (!u || l >= u.cost.length || !spend(u.cost[l])) return sfx.deny(); D.up[id] = l + 1; sfx.buy(); announce(checkAch()); persist(); render(); };

  let garageTab = 'car';
  VIEWS.garage = () => { const kind = garageTab;
    return `${backBtn('home')}<h2>Garage</h2><div class="tabs">${Object.keys(COS).map(k => `<button type="button" data-act="gtab:${k}" aria-pressed="${k === kind}">${COS_LABEL[k]} ${cosCount(k)}/${COS[k].length}</button>`).join('')}</div>
      <div class="grid">${COS[kind].map(it => { const own = cosOwned(kind, it), on = D.eq[kind] === it.id;
        return `<div class="cos${on ? ' on' : ''}${own ? '' : ' locked'}"><img src="${cosPreview(kind, it)}" alt="" width="72" height="72"><b>${esc(it.n)}</b><span class="rar r-${it.r}">${RARITY[it.r].toUpperCase()}</span>
          ${on ? `<span class="how" style="color:var(--mint)">Driving</span>` : own ? `<button type="button" class="buy" data-act="equip:${kind}.${it.id}">Use</button>` : it.cost ? `<button type="button" class="buy" data-act="cosbuy:${kind}.${it.id}" ${coins() < it.cost ? 'disabled' : ''}>${fmt(it.cost)}</button>` : `<span class="how">${esc(cosHow(it))}</span>`}</div>`; }).join('')}</div>
      <p class="sub">Cars and underglow are looks only. Every car drives the same; upgrades are what make you faster.</p>`; };
  ACTIONS.gtab = k => { if (COS[k]) garageTab = k; sfx.click(); render(); };
  ACTIONS.equip = s => { const [kind, id] = s.split('.'), it = COS[kind] && COS[kind].find(x => x.id === id); if (!it || !cosOwned(kind, it)) return; D.eq[kind] = id; clearPreviews(); sfx.equip(); persist(); render(); };
  ACTIONS.cosbuy = s => { const [kind, id] = s.split('.'), it = COS[kind] && COS[kind].find(x => x.id === id); if (!it || !it.cost || cosOwned(kind, it) || !spend(it.cost)) return sfx.deny(); D.own[kind].push(id); D.eq[kind] = id; clearPreviews(); sfx.buy(); announce(checkAch()); persist(); render(); };

  let achQuery = '', achFilter = 'all';
  function achListHTML() {
    const q = achQuery.trim().toLowerCase();
    return ACH_CATS.map(cat => { const all = ACH.filter(a => a.cat === cat), got = all.filter(a => D.done.includes(a.id)).length;
      const shown = all.filter(a => (achFilter === 'all' || (achFilter === 'done') === D.done.includes(a.id)) && (!q || (a.n + ' ' + a.t + ' ' + TIERS[a.tier].n).toLowerCase().includes(q)));
      return shown.length ? `<details${q || achFilter !== 'all' ? ' open' : ''}><summary><span>${esc(cat)}</span><b>${got}/${all.length}</b></summary>${shown.map(a => achRow(a, D.done.includes(a.id), achProg(a))).join('')}</details>` : ''; }).join('') || `<p>Nothing matches.</p>`;
  }
  VIEWS.ach = () => `${backBtn('home')}<h2>Trophies</h2><p>${achCount()} of ${ACH.length} unlocked. ${Object.values(TIERS).map(t => `<b style="color:${t.c}">${t.n}</b> +${t.r}`).join(' · ')}</p>
    <input id="achQ" type="search" maxlength="40" placeholder="Search trophies" value="${esc(achQuery)}" aria-label="Search trophies">
    <div class="tabs">${[['all', 'All'], ['locked', 'To get'], ['done', 'Unlocked']].map(([id, l]) => `<button type="button" data-act="achf:${id}" aria-pressed="${achFilter === id}">${l}</button>`).join('')}</div><div id="achList" class="list">${achListHTML()}</div>`;
  ACTIONS.achf = f => { achFilter = f; render(); };

  let boardTab = 'free';
  VIEWS.board = () => {
    const tabs = `<div class="tabs">${[['free', 'Night Drive'], ['daily', 'Today'], ['rush', 'Rush Hour']].map(([id, l]) => `<button type="button" data-act="board:${id}" aria-pressed="${boardTab === id}">${l}</button>`).join('')}</div>`;
    const online = typeof boardHTML === 'function' ? boardHTML(boardTab) : '';
    const mine = D.top.length ? `<ol class="lb">${D.top.map((t, i) => `<li><span class="n">${i + 1}</span><span>${ZONES[t.z].name} · ${(t.d / 1000).toFixed(2)} km${t.m === 'daily' ? ' · daily' : ''}</span><b>${fmt(t.s)}</b></li>`).join('')}</ol>` : `<p>No drives yet.</p>`;
    return `${backBtn('home')}<h2>Leaderboard</h2>${tabs}${online}<div class="box"><h3>Your best drives <b>Rush Hour best ${fmt(D.bestRush)}</b></h3>${mine}</div>`;
  };
  ACTIONS.board = t => { boardTab = t; sfx.click(); render(); if (typeof boardLoad === 'function') boardLoad(t); };

  VIEWS.help = () => `${backBtn('home')}<h2>How to play</h2>
    <div class="box"><h3>The night clock</h3><p>You start with 40 seconds of night. Every checkpoint (one each ${CP_GAP} m) adds more, but a little less each time. When the clock hits zero, dawn breaks and the drive is over.</p></div>
    <div class="box"><h3>Drive</h3><p>${COARSE ? 'Slide a finger left and right to steer.' : `Steer with <kbd>${esc(keyFor('left'))}</kbd> <kbd>${esc(keyFor('right'))}</kbd>.`} Hitting a car doesn't end the night: it spins you out, kills your combo and burns seconds off the clock. Scraping the barrier only slows you down.</p></div>
    <div class="box"><h3>Multiplier</h3><p>Pass cars with a hair's width to spare for a <b>near miss</b>. Each one builds your combo, and every combo step adds 10% to everything you score, up to x5. Skimming <b>oncoming</b> traffic is worth triple.</p></div>
    <div class="box"><h3>Nitro</h3><p>Tuck in close behind a car to <b>draft</b>: your nitro tank fills while you sit there. Near misses and nitro cans fill it too. ${COARSE ? 'Tap <b>Nitro</b>' : `Press <kbd>${esc(keyFor('nitro'))}</kbd>`} to burn one charge: a lot more speed, and everything scores double while it lasts.</p></div>
    <div class="box"><h3>The route</h3><p>${ZONES.map(z => `<b style="color:${z.color}">${z.name}</b> ${(z.at / 1000).toFixed(1)} km`).join(' · ')}</p><p>From the Harbor Bridge on, cars change lanes: watch for the blinker. The Tunnel is lit only by headlights. In the hills the two left lanes carry oncoming traffic.</p></div>
    <div class="box"><h3>Modes</h3><p><b>Night Drive</b> is endless and different every time. The <b>Daily Route</b> has the same traffic for everyone and changes at midnight Mountain time. <b>Rush Hour</b> is 90 seconds of dense traffic with no checkpoints: pure score.</p></div>`;

  VIEWS.profile = () => {
    const L = D.life, hrs = L.secs >= 3600 ? (L.secs / 3600).toFixed(1) + ' h' : Math.round(L.secs / 60) + ' min';
    return `${backBtn('home')}<h2>Profile</h2>
      ${save.acct ? `<p>Signed in as <b>${esc(save.acct.username)}</b> with your Night Studios login. Night Drive progress saves to it; it is kept separate from other Night Studios games.</p><button class="go alt" type="button" data-act="go:account">Account</button>`
        : `<form class="box" id="nameForm" novalidate><label for="uname">Your name on this device</label><div class="inline"><input id="uname" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="NightOwl" value="${esc(save.name)}"><button class="buy" type="submit">Save</button></div><p class="err" id="nameErr" role="alert"></p></form>
           ${typeof accountsOn === 'function' && accountsOn() ? `<button class="go violet" type="button" data-act="go:account">Log in with Night Studios<small>One login for every Night Studios game</small></button>` : ''}`}
      <div class="box"><h3>Career <b>Level ${level()}</b></h3><div class="stats">${stat('Best score', fmt(D.best))}${stat('Rush Hour', fmt(D.bestRush))}${stat('Drives', fmt(L.runs))}${stat('Distance', (L.meters / 1000).toFixed(1) + ' km')}${stat('Time driving', hrs)}${stat('Top speed', D.bs.kmh + ' km/h')}${stat('Best combo', 'x' + D.bs.maxCombo)}${stat('Near misses', fmt(L.nearMiss))}${stat('Trophies', achCount() + '/' + ACH.length)}</div></div>
      <button class="go alt" type="button" data-act="go:settings">Settings</button>
      ${armBtn('wipe', save.acct ? 'Log out and erase this device' : 'Erase all progress on this device', 'Tap again: this device is wiped')}`;
  };
  FORMS.nameForm = () => { const n = cleanName($('uname').value); if (!NAME_OK.test(n)) { $('nameErr').textContent = 'Use 2 to 16 letters, numbers, spaces, dots, dashes or underscores.'; return; } save.name = n; persist(); sfx.buy(); toastUI('Name saved'); render(); };
  ACTIONS.wipe = () => { const keep = { settings: save.settings, dev: save.dev }; if (save.acct && typeof signedOut === 'function') signedOut(''); save = Object.assign(freshSave(), keep); D = save.d = cleanData(null); clearPreviews(); saveLocal(); syncWallet(); show('home'); toastUI('Progress erased', 'var(--rose)'); };

  VIEWS.settings = () => {
    const st = save.settings, inRun = gstate === 'paused';
    const slider = (id, label, v) => `<div class="slider"><label for="${id}">${label}</label><input type="range" id="${id}" min="0" max="100" step="5" value="${v}"><output id="${id}Out">${v ? v + '%' : 'Off'}</output></div>`;
    const sw = (k, label, on, a = 'On', b = 'Off') => `<div class="setrow"><span>${label}</span><button type="button" class="switch" data-act="set:${k}" aria-pressed="${on}">${on ? a : b}</button></div>`;
    const keyRows = KEY_ACTIONS.map(([a, label]) => `<div class="keyrow"><span>${label}</span>${[0, 1].map(i => { const hot = capturing && capturing.a === a && capturing.i === i, k = st.keys[a][i]; return `<button type="button" class="keycap${hot ? ' listening' : ''}${k ? '' : ' empty'}" data-act="bind:${a}.${i}">${hot ? 'Press a key…' : esc(keyLabel(k))}</button>`; }).join('')}</div>`).join('');
    return `${backBtn(inRun ? 'pause' : 'home', inRun ? 'Back to pause menu' : 'Back')}<h2>Settings</h2>
      <div class="box"><h3>Sound</h3>${slider('volMusic', 'Music', st.music)}${slider('volSfx', 'Effects', st.sfx)}</div>
      <div class="box"><h3>Touch</h3>${sw('steer', 'Steering', st.steer === 'drag', 'Drag', 'Sides')}<p class="sub">${st.steer === 'drag' ? 'Put a finger down anywhere and slide. Slide farther to turn harder.' : 'Hold the left or right half of the screen.'}</p>${sw('haptics', 'Vibration', st.haptics)}</div>
      <div class="box"><h3>Keyboard <button type="button" class="back" data-act="set:keys">Reset</button></h3>${keyRows}<p class="sub">Click a box, then press a key. <kbd>Esc</kbd> cancels.</p></div>
      <div class="box"><h3>Game</h3>${sw('shake', 'Screen shake', st.shake)}${sw('fx', 'Effects quality', st.fx === 'full', 'Full', 'Low')}${sw('stats', 'Share run data', st.stats)}<p class="sub">How far each run got and what ended it. It helps balance the game and never includes personal details.</p>${Studio.layoutRow()}</div>
      <p class="ver">Version ${esc(APP_VERSION)}</p>`;
  };
  Studio.side = () => VIEWS.help ? VIEWS.help() : ''; // desktop layout: shown beside the playfield during a run
  ACTIONS.set = k => { const st = save.settings; if (k === 'steer') st.steer = st.steer === 'drag' ? 'sides' : 'drag'; else if (k === 'fx') { st.fx = st.fx === 'low' ? 'full' : 'low'; resize(); } else if (k === 'keys') st.keys = JSON.parse(JSON.stringify(DEF_KEYS)); else st[k] = !st[k]; sfx.click(); persist(); render(); };
  ACTIONS.bind = s => { const [a, i] = s.split('.'); capturing = { a, i: +i }; render(); };
  panel.addEventListener('input', e => {
    const id = e.target.id; if (id !== 'volMusic' && id !== 'volSfx') { if (id === 'achQ') { achQuery = e.target.value; const b = $('achList'); if (b) b.innerHTML = achListHTML(); } return; }
    const v = clamp(Math.round(+e.target.value || 0), 0, 100); save.settings[id === 'volMusic' ? 'music' : 'sfx'] = v; $(id + 'Out').textContent = v ? v + '%' : 'Off'; applyVolumes(); saveLocal();
  });
  panel.addEventListener('change', e => { if (e.target.id === 'volSfx') { initAudio(); applyVolumes(); chime([880, 1320]); } });
  ACTIONS.studioadmin = () => Studio.openAdmin(GAME);
  Studio.onChange(() => { if (!overlay.hidden && view === 'home') render(); });
