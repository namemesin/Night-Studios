  /* ================= boot ================= */
  $('brandBtn').addEventListener('click', () => { if (gstate === 'idle' || gstate === 'over') { initAudio(); if (gstate === 'over') leaveRun(); show('hub'); } });
  $('setBtn').addEventListener('click', () => { initAudio(); if (gstate === 'run') pauseRun(); show('settings'); });
  addEventListener('resize', () => { resize(); if (G && gstate !== 'run' && gstate !== 'crash') drawRun(performance.now()); });
  dayHooks.push(() => { missionsDay = ''; if (!overlay.hidden && (view === 'hub' || view === 'run-home')) render(); });
  setInterval(() => { if (gstate !== 'run' && gstate !== 'crash' && !document.hidden) rollDay(); }, 60000);
  fixEquipped(); resize(); newGame('free', true); syncWallet();
  for (let i = 0; i < 240; i++) step(); // start the backdrop mid-slope instead of on an empty hill
  if (location.hash === '#daily') R.mode = 'daily';
  show(location.hash === '#run' || location.hash === '#daily' ? 'run-home' : 'hub');
  lastFrame = performance.now(); requestAnimationFrame(frame);
  if (typeof onlineBoot === 'function') onlineBoot();
  Studio.watchUpdates(APP_VERSION, () => gstate === 'idle' ? 'menu' : gstate === 'over' ? 'results' : 'round'); // loads a newer version by itself, never mid-round
  if (DEV) window.NG = { get G() { return G; }, get save() { return save; }, get state() { return gstate; }, startRun, step, show, keys, earn, persist, addXP, fireFlare, finishRun, spawnRow, newGame, lineAt };
