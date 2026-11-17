  /* ================= KIT: core shared by Night Studios games ================= */
  // A kit game's own 00-config.js comes before this file and says what the game is (GAME, its upgrades, cosmetics,
  // trophies and jobs). Everything here is the same for every kit game: saving, coins and levels, sound, screens.
  // Logins are studio-wide; progress, coins and leaderboards are each game's own.
  const SUPABASE_URL = Studio.url, SUPABASE_KEY = Studio.key; // the server address lives in one place: shared/studio.js
  const APP_VERSION = 'dev'; // the publish step replaces this with the real version number
  const DEV = APP_VERSION.startsWith('dev');
  const OFFLINE = /[?&]offline\b/.test(location.search); // local testing without touching the server

  const $ = id => document.getElementById(id);
  const cv = $('c'), ctx = cv.getContext('2d', { alpha: false });
  const stage = $('stage'), overlay = $('overlay'), panel = $('panel'), toastBox = $('toasts');
  const pauseBtn = $('pauseBtn');
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const TOP_LEVEL = window.self === window.top && /^https?:$/.test(location.protocol);
  const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const STANDALONE = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  let W = 360, H = 600, dpr = 1;
  const resizeHooks = [];
  function resize() {
    const low = save && save.settings.fx === 'low';
    dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2);
    W = stage.clientWidth || 360; H = stage.clientHeight || 600;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const f of resizeHooks) f();
  }

  // Seeded random numbers, so a daily course is the same for everyone.
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    let a = h >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // The day changes at midnight Mountain time for everyone.
  const DAILY_TZ = 'America/Denver';
  const todayKey = (when = new Date()) => {
    try {
      const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: DAILY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(when).forEach(x => { p[x.type] = x.value; });
      return `${p.year}-${p.month}-${p.day}`;
    } catch (e) { return new Date(when.getTime() - 7 * 3600000).toISOString().slice(0, 10); }
  };
  const dayLabelOf = k => new Date(k + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const prevDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10); };
  let dayKey = todayKey(), dayLabel = dayLabelOf(dayKey);
  const dayHooks = [];
  function rollDay() { const k = todayKey(); if (k === dayKey) return false; dayKey = k; dayLabel = dayLabelOf(k); for (const f of dayHooks) f(); return true; }

  /* ---------- save data ---------- */
  const SAVE_KEY = GAME.saveKey;
  const DEF_KEYS = GAME.keys, KEY_ACTIONS = GAME.keyActions;
  let usedTouch = COARSE;
  const defSettings = () => ({ music: 70, sfx: 80, shake: true, fx: 'full', steer: 'drag', haptics: true, stats: true, keys: JSON.parse(JSON.stringify(DEF_KEYS)) });
  const NAME_OK = /^[A-Za-z0-9 _.\-]{2,16}$/;
  const cleanName = v => String(v || '').replace(/\s+/g, ' ').trim();
  const int = v => Math.max(0, Math.floor(+v || 0));
  const strList = v => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && x.length < 40))] : [];
  const freshSave = () => ({ v: 1, name: '', dev: 'd' + Array.from({ length: 15 }, () => Math.floor(Math.random() * 36).toString(36)).join(''),
    settings: defSettings(), earned: 0, spent: 0, xp: 0, gift: 0, acct: null, d: {} });
  let save = freshSave();
  function loadSave(raw) {
    const s = freshSave();
    if (!raw || typeof raw !== 'object') return s;
    if (NAME_OK.test(cleanName(raw.name))) s.name = cleanName(raw.name);
    if (typeof raw.dev === 'string' && /^[a-z0-9]{8,40}$/.test(raw.dev)) s.dev = raw.dev;
    const st = raw.settings || {}, d = s.settings;
    for (const k of ['music', 'sfx']) if (Number.isFinite(+st[k])) d[k] = clamp(Math.round(+st[k]), 0, 100);
    for (const k of ['shake', 'haptics', 'stats']) if (typeof st[k] === 'boolean') d[k] = st[k];
    if (st.fx === 'low') d.fx = 'low';
    if (st.steer === 'sides') d.steer = 'sides';
    if (st.keys && typeof st.keys === 'object') for (const [a] of KEY_ACTIONS) if (Array.isArray(st.keys[a])) d.keys[a] = [0, 1].map(i => typeof st.keys[a][i] === 'string' ? st.keys[a][i].slice(0, 24) : '');
    s.earned = int(raw.earned); s.spent = Math.min(int(raw.spent), s.earned); s.xp = int(raw.xp); s.gift = int(raw.gift);
    if (raw.acct && typeof raw.acct === 'object' && typeof raw.acct.token === 'string') s.acct = { id: String(raw.acct.id || ''), username: String(raw.acct.username || ''), token: raw.acct.token, admin: !!raw.acct.admin, rev: raw.acct.rev == null ? null : +raw.acct.rev };
    s.d = raw.d && typeof raw.d === 'object' ? raw.d : {};
    return s;
  }
  try { save = loadSave(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); } catch (e) {}
  // The Night Studios login is shared by every game on the site through this one key. Never set: nobody has logged
  // in on this browser yet. null: logged out on purpose. Each game still keeps its own progress and currency.
  const STUDIO_KEY = 'nightstudios-acct';
  function studioAcct() { try { const raw = localStorage.getItem(STUDIO_KEY); if (raw === null) return undefined; const a = JSON.parse(raw); return a && typeof a.token === 'string' ? a : null; } catch (e) { return null; } }
  function setStudioAcct(a) { try { localStorage.setItem(STUDIO_KEY, JSON.stringify(a ? { id: String(a.id), username: String(a.username), token: a.token, admin: !!a.admin } : null)); } catch (e) {} }
  let saveBroken = false;
  function saveLocal() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); saveBroken = false; } catch (e) { saveBroken = true; } }
  function persist() { saveLocal(); syncWallet(); if (typeof cloudPush === 'function') cloudPush(); }

  /* ---------- coins (this game's currency) and player level ---------- */
  const coins = () => Math.max(0, save.earned - save.spent);
  function earn(n) { n = int(n); if (n) save.earned += n; return n; }
  function spend(n) { n = int(n); if (n > coins()) return false; save.spent += n; return true; }
  // Level L to L+1 costs 120 * L^1.55 XP: level 5 in an evening, 25 in a few weeks, 60 is a long road.
  const MAX_LEVEL = 60;
  const XP_AT = [0, 0]; for (let L = 2; L <= MAX_LEVEL + 1; L++) XP_AT.push(XP_AT[L - 1] + Math.round(120 * Math.pow(L - 1, 1.55)));
  const levelFor = xp => { let L = 1; while (L < MAX_LEVEL && xp >= XP_AT[L + 1]) L++; return L; };
  const level = () => levelFor(save.xp);
  const levelFrac = () => { const L = level(); return L >= MAX_LEVEL ? 1 : (save.xp - XP_AT[L]) / (XP_AT[L + 1] - XP_AT[L]); };
  // Every level pays coins; every fifth level pays a lot more.
  const levelReward = L => L % 5 === 0 ? 150 + L * 20 : 40 + L * 5;
  function addXP(n) {
    const before = level(); save.xp += int(n);
    const after = level(); let paid = 0;
    for (let L = before + 1; L <= after; L++) paid += earn(levelReward(L));
    return { levels: after - before, level: after, paid };
  }
  function syncWallet() { $('flkChip').textContent = fmt(coins()); $('lvlChip').textContent = 'Lv ' + level(); }

  /* ---------- audio ---------- */
  let ac = null, sfxBus = null, musBus = null, noiseBuf = null;
  function initAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor(); comp.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = save.settings.sfx / 100; sfxBus.connect(comp);
      musBus = ac.createGain(); musBus.gain.value = 0; musBus.connect(comp);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  let voices = 0;
  function tone(freq, dur = .12, type = 'sine', vol = .08, slide = 0, delay = 0, bus) {
    if (!ac || (!bus && !save.settings.sfx) || voices > 40) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(bus || sfxBus); o.start(t); o.stop(t + dur + .03);
    voices++; o.onended = () => { voices--; };
  }
  function noise(dur = .3, vol = .12, freq = 0, type = 'highpass', delay = 0, bus) {
    if (!ac || (!bus && !save.settings.sfx) || voices > 40) return;
    const t = ac.currentTime + delay, s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = noiseBuf; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let node = s;
    if (freq) { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; s.connect(f); node = f; }
    node.connect(g).connect(bus || sfxBus); s.start(t, Math.random() * .4); s.stop(t + dur + .02);
    voices++; s.onended = () => { voices--; };
  }
  const chime = (notes, type = 'triangle', vol = .05, gap = .085) => notes.forEach((f, i) => tone(f, i === notes.length - 1 ? .28 : .1, type, vol, 0, i * gap));
  const sfx = {
    click: () => tone(880, .05, 'triangle', .035), buy: () => chime([988, 1480]), deny: () => tone(160, .12, 'square', .04, -40),
    equip: () => tone(1046, .08, 'triangle', .04), win: () => chime([523, 659, 784, 1046]), level: () => chime([659, 784, 988, 1318, 1568], 'triangle', .06),
  };
  const buzz = ms => { try { if (save.settings.haptics && COARSE && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  // Procedural soundtrack. `intensity` (0-5) adds layers; a game sets it as the run heats up.
  const music = { timer: null, step: 0, next: 0, intensity: 0, tense: false };
  const PROG = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]], TENSE = [[50, 53, 57], [51, 55, 58], [50, 53, 56], [49, 52, 56]];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function musicStep(t, sp) {
    const lvl = music.intensity, bar = (music.step >> 4) % 4, s = music.step % 16, ch = (music.tense ? TENSE : PROG)[bar];
    if (s === 0) for (const m of ch) tone(mtof(m), sp * 16, 'sine', .024, 0, t - ac.currentTime, musBus);
    if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) tone(mtof(ch[0] - 24), sp * 1.6, 'triangle', .17, 0, t - ac.currentTime, musBus);
    if (s % 2 === 1) noise(.05, s % 4 === 3 ? .04 : .02, 7000, 'highpass', t - ac.currentTime, musBus);
    if (lvl >= 1 && s % 2 === 0) tone(mtof(ch[(s / 2) % 3] + 12 + ((s >> 3) & 1) * 12), sp * 1.2, 'square', .022, 0, t - ac.currentTime, musBus);
    if (lvl >= 2 && s % 4 === 0) tone(140, .16, 'sine', .3, -100, t - ac.currentTime, musBus);
    if (lvl >= 3 && (s === 0 || s === 6 || s === 10)) tone(mtof(ch[(s / 2) % 3] + 24), sp * 3, 'sawtooth', .014, 0, t - ac.currentTime, musBus);
    if (lvl >= 4 && s % 4 === 2) noise(.09, .05, 1800, 'bandpass', t - ac.currentTime, musBus);
    if (lvl >= 5 && s % 2 === 1) tone(mtof(ch[0] + 36), sp * .6, 'square', .009, 0, t - ac.currentTime, musBus);
  }
  function musicTick() {
    if (!ac || ac.state !== 'running') return;
    const sp = 60 / (122 + music.intensity * 6) / 4;
    if (music.next < ac.currentTime) music.next = ac.currentTime + .03;
    while (music.next < ac.currentTime + .18) { musicStep(music.next, sp); music.next += sp; music.step = (music.step + 1) % 64; }
  }
  function musicStart() {
    if (!ac || !save.settings.music) return;
    musicStop(true); music.step = 0; music.next = ac.currentTime + .05;
    const t = ac.currentTime; musBus.gain.cancelScheduledValues(t); musBus.gain.setValueAtTime(0, t); musBus.gain.linearRampToValueAtTime(.9 * save.settings.music / 100, t + .4);
    music.timer = setInterval(musicTick, 40);
  }
  function musicStop(fast) {
    if (music.timer) { clearInterval(music.timer); music.timer = null; }
    if (ac && musBus) { const t = ac.currentTime; musBus.gain.cancelScheduledValues(t); musBus.gain.setValueAtTime(musBus.gain.value, t); musBus.gain.linearRampToValueAtTime(0, t + (fast ? .03 : .6)); }
  }
  function applyVolumes() {
    if (!ac) return; const t = ac.currentTime;
    sfxBus.gain.setValueAtTime(save.settings.sfx / 100, t);
    if (music.timer) musBus.gain.setValueAtTime(.9 * save.settings.music / 100, t);
    if (!save.settings.music) musicStop(true);
  }

  /* ---------- screens ---------- */
  // Each screen is a function returning HTML. Buttons carry data-act="name:arg"; ACTIONS[name](arg, button) handles it.
  const VIEWS = {}, ACTIONS = {}, FORMS = {}, GAMES = [];
  let view = 'hub', viewArg = null;
  function show(v, arg) { view = v; viewArg = arg === undefined ? null : arg; overlay.hidden = false; render(); overlay.scrollTop = 0; }
  function render() {
    if (overlay.hidden) return;
    const el = document.activeElement, keep = el && el.id && panel.contains(el) && /^(INPUT|TEXTAREA)$/.test(el.tagName) ? { id: el.id, a: el.selectionStart, b: el.selectionEnd, v: el.value } : null;
    panel.innerHTML = (VIEWS[view] || VIEWS.hub)(viewArg);
    if (keep) { const n = $(keep.id); if (n) { n.value = keep.v; n.focus({ preventScroll: true }); try { n.setSelectionRange(keep.a, keep.b); } catch (e) {} } }
    syncWallet();
  }
  const backBtn = (to = 'hub', label = 'Back') => `<button class="back" type="button" data-act="go:${to}">← ${label}</button>`;
  ACTIONS.go = v => { sfx.click(); show(v); };
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    initAudio();
    const s = b.dataset.act, i = s.indexOf(':'), name = i < 0 ? s : s.slice(0, i), arg = i < 0 ? '' : s.slice(i + 1);
    if (ACTIONS[name]) ACTIONS[name](arg, b);
  });
  panel.addEventListener('submit', e => { e.preventDefault(); initAudio(); const f = FORMS[e.target.id]; if (f) f(e.target); });
  function toastUI(text, color = 'var(--mint)', ms = 2600) {
    const d = document.createElement('div'); d.className = 'toast'; d.style.borderColor = color; d.style.color = color; d.textContent = text;
    toastBox.appendChild(d); while (toastBox.children.length > 3) toastBox.firstChild.remove();
    setTimeout(() => d.remove(), ms);
  }
  // Two-tap confirm for anything that can't be undone.
  let armed = '';
  const armBtn = (act, label, sure = 'Tap again to confirm', cls = 'buy ghost') => `<button type="button" class="${cls}" data-act="arm:${act}">${armed === act ? sure : label}</button>`;
  ACTIONS.arm = act => { if (armed !== act) { armed = act; render(); setTimeout(() => { if (armed === act) { armed = ''; render(); } }, 4000); return; } armed = ''; const i = act.indexOf(':'), n = i < 0 ? act : act.slice(0, i); if (ACTIONS[n]) ACTIONS[n](i < 0 ? '' : act.slice(i + 1)); };

  /* ---------- keys ---------- */
  const KEY_NAMES = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', Escape: 'Esc', Enter: 'Enter' };
  const keyLabel = c => !c ? '+ Add' : KEY_NAMES[c] || (/^Key[A-Z]$/.test(c) ? c.slice(3) : /^Digit\d$/.test(c) ? c.slice(5) : c);
  const keyFor = a => keyLabel(save.settings.keys[a].find(Boolean) || '');
  const bound = (a, c) => !!c && save.settings.keys[a].includes(c);
  let capturing = null;
