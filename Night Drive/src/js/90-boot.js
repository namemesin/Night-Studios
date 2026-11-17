  /* ================= boot ================= */
  $('brandBtn').addEventListener('click', () => { if (gstate === 'idle' || gstate === 'over') { initAudio(); if (gstate === 'over') leaveRun(); show('home'); } });
  $('setBtn').addEventListener('click', () => { initAudio(); if (gstate === 'run') pauseRun(); show('settings'); });
  addEventListener('resize', () => { resize(); if (G && gstate !== 'run' && gstate !== 'ending') drawGame(performance.now()); });
  dayHooks.push(() => { missionsDay = ''; if (!overlay.hidden && view === 'home') render(); });
  setInterval(() => { if (gstate !== 'run' && gstate !== 'ending' && !document.hidden) rollDay(); }, 60000);
  fixEquipped(); resize(); newGame('free', true); syncWallet();
  for (let i = 0; i < 200; i++) step(); // start the backdrop in traffic instead of on an empty road
  if (location.hash === '#daily') D.mode = 'daily';
  show('home');
  lastFrame = performance.now(); requestAnimationFrame(frame);
  if (typeof onlineBoot === 'function') onlineBoot();
  if (DEV) window.ND = { get G() { return G; }, get save() { return save; }, get state() { return gstate; }, startRun, step, show, keys, earn, persist, fireNitro, autopilot, laneX };
