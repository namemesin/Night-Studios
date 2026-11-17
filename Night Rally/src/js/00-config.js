  /* ================= NIGHT RALLY: what the game is ================= */
  // A top-down time trial. Three laps of a circuit at night; the car drives itself and you steer. Holding Drift
  // through a corner turns tighter and charges a boost that fires when you let go. Your best run on each track is
  // kept as a ghost to race. The shared kit (in kit/) handles saving, coins, levels, login, leaderboards and the
  // common screens from the tables in this file.
  const LAPS = 3, TMAX = 120 * 60; // a rally is three laps; it is called off after two minutes (in steps, 60 a second)
  // Leaderboards rank the highest score, so a time becomes a score: every hundredth of a second saved is 2 points.
  // The server's fair-play row for this game (backend/night-studios-rally.sql) is this same sum, so keep them together.
  const scoreFor = steps => 2000 + Math.round((TMAX - steps) * 10 / 3);
  const stepsFor = score => TMAX - (score - 2000) * .3;
  const tf = steps => { const s = Math.max(0, steps) / 60; return s >= 60 ? Math.floor(s / 60) + ':' + (s % 60).toFixed(2).padStart(5, '0') : s.toFixed(2); };
  const lapText = lapx => lapx > 0 ? (60 - lapx / 100).toFixed(2) + ' s' : 'None yet';
  const GAME = {
    id: 'rally', name: 'Night Rally', saveKey: 'nightrally-save1',
    keys: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], drift: ['Space', 'ShiftLeft'], brake: ['ArrowDown', 'KeyS'], pause: ['KeyP', 'Escape'] },
    keyActions: [['left', 'Steer left'], ['right', 'Steer right'], ['drift', 'Drift'], ['brake', 'Brake'], ['pause', 'Pause']],
    modes: [{ id: 'free', name: 'Moonlight Circuit', sub: 'Three laps against your ghost' }, { id: 'daily', name: 'Daily Stage', sub: 'Same track for everyone', daily: true }],
    submitFn: 'ng_rally_submit', submitMore: () => ({ p_ghost: sentGhost }), // a finished run is posted with its replay (see backend/night-studios-rally.sql)
    boardNote: r => r.meta && r.meta.t ? ` <span class="sub">· ${tf(int(r.meta.t) * .6)}</span>` : '',
    pauseLine: () => `<b>${tf(G.t)}</b> on the clock · lap ${Math.min(LAPS, G.c.lap + 1)} of ${LAPS}`,
    shareText: r => !r.meta.t ? `I ran out of time on Night Rally. See if you can finish three laps.` : r.mode === 'daily' ? `I drove today's Night Rally stage in ${tf(r.meta.t * .6)}. Same track for everyone. Beat it.` : `I lapped the Moonlight Circuit three times in ${tf(r.meta.t * .6)} on Night Rally. Your turn.`,
    profileStats: () => [['Best lap', lapText(D.bs.lapx)], ['Drifted', fmt(D.life.drift) + ' m'], ['Ghosts beaten', fmt(D.life.wins)]],
    help: () => `<div class="box"><h3>The rally</h3><p>Three laps, as fast as you can. The car <b>drives itself</b>; you steer. A faster time is a higher score.</p></div>
      <div class="box"><h3>Steer</h3><p>${COARSE ? 'Hold the <b>left</b> and <b>right</b> arrows at the bottom left of the screen.' : `Steer with <kbd>${esc(keyFor('left'))}</kbd> and <kbd>${esc(keyFor('right'))}</kbd>. <kbd>${esc(keyFor('brake'))}</kbd> brakes.`} Left and right are the car's own left and right, and the view turns with the road.</p></div>
      <div class="box"><h3>Drift</h3><p>${COARSE ? 'Hold <b>Drift</b> at the bottom right' : `Hold <kbd>${esc(keyFor('drift'))}</kbd>`} while steering into a corner. The car slides and turns much tighter. The ring around it fills <b style="color:#6fd3ff">blue</b>, <b style="color:#ffb347">orange</b>, then <b style="color:#ff5cf0">pink</b>. Let go and you get a <b>boost</b>, bigger for each color.</p>
        <p>Tight corners can't be taken flat out without a drift, and a long drift pays for itself on the next straight.</p></div>
      <div class="box"><h3>Stay on the road</h3><p>Grass is slow and empties the drift ring. Stray too far and you are put back on the road. A lap with no grass at all is a <b>clean lap</b>.</p></div>
      <div class="box"><h3>Ghosts</h3><p>The pale car is <b>your ghost</b>: your best run on this track, replayed. The <b style="color:#ffd24a">gold car</b> is the leader of the board: the fastest run anyone has posted on this track, replayed. Everyone gets the same Daily Stage, and it changes every day.</p></div>`,
  };
  const CARS = [
    { id: 'lime', n: 'Night Hatch', r: 'c', c: '#c6ff4a', c2: '#3a5a10' },
    { id: 'red', n: 'Red Kite', r: 'c', c: '#ff5a6e', c2: '#5a1020', cost: 250 },
    { id: 'ice', n: 'Ice Runner', r: 'c', c: '#9fdcff', c2: '#1f4a6a', cost: 300 },
    { id: 'works', n: 'Works Car', r: 'r', c: '#f1eeff', c2: '#2a4aa8', stripe: '#ff5a6e', cost: 800 },
    { id: 'gold', n: 'Gold Stage', r: 'r', c: '#ffd24a', c2: '#6a4a00', stripe: '#1a1408', cost: 900 },
    { id: 'night', n: 'Midnight', r: 'e', c: '#2a2f45', c2: '#0e101a', stripe: '#7fe8ff', lvl: 10 },
    { id: 'sideways', n: 'Sideways', r: 'e', c: '#ff5cf0', c2: '#4a1050', stripe: '#ffffff', ach: 'long-50' },
    { id: 'champ', n: 'Champion', r: 'l', c: '#ffffff', c2: '#c6ff4a', stripe: '#ffd24a', ach: 'score-16800' },
  ];
  const COS = { car: CARS }, COS_LABEL = { car: 'Cars' };
  const UPG = [
    { id: 'engine', n: 'Tuned Engine', cost: [200, 500, 1000, 2000], d: l => l ? `Top speed up ${(l * 1.5).toFixed(1)}%` : 'A higher top speed' },
    { id: 'tyres', n: 'Soft Tyres', cost: [200, 500, 1100], d: l => l ? `Steers ${l * 3}% sharper` : 'Sharper steering' },
    { id: 'spool', n: 'Quick Spool', cost: [200, 500, 1000], d: l => l ? `The drift ring fills ${l * 8}% faster` : 'The drift ring fills faster' },
    { id: 'turbo', n: 'Big Turbo', cost: [250, 600, 1300], d: l => l ? `Boosts last ${l * 12}% longer` : 'Longer boosts' },
    { id: 'mud', n: 'Rally Suspension', cost: [150, 400, 900], d: l => l ? `Grass slows you ${l * 12}% less` : 'Grass slows you less' },
    { id: 'lucky', n: 'Lucky Coin', cost: [300, 700, 1400, 2400, 4000], d: l => l ? `+${l * 10}% coins from every rally` : 'More coins from every rally' },
  ];
  // laps: laps finished. drift: metres spent drifting. long: the longest single drift, in metres. boosts: drift boosts
  // fired. clean: laps with no grass. wins: 1 when the run beat the ghost. lapx: best lap as (60 s - lap time) x 100.
  const RUN_STATS = ['score', 'laps', 'drift', 'long', 'boosts', 'clean', 'wins', 'lapx', 'daily'];
  const LIFE_KEYS = ['laps', 'drift', 'boosts', 'clean', 'wins'];
  const FAMILIES = [
    ['The clock', 'score', 'score', 'run', 'Score {n} in one rally', [[2000, 'b', 'Made It Home'], [11000, 'b', 'Finding the Line'], [13000, 's', 'Getting Quick'], [14600, 'g', 'Quick Hands'], [15800, 'p', 'Stage Winner'], [16800, 'm', 'Untouchable']]],
    ['The clock', 'lapsL', 'laps', 'life', 'Finish {n} laps in total', [[30, 'b', 'Getting the Line'], [300, 's', 'Knows Every Bump'], [1500, 'g', 'Part of the Tarmac']]],
    ['The clock', 'clean', 'clean', 'run', 'Drive {n} clean lap{s} in one rally', [[1, 'b', 'Tidy'], [2, 's', 'Tidier'], [3, 'g', 'Never Touched the Grass']]],
    ['The clock', 'cleanL', 'clean', 'life', 'Drive {n} clean laps in total', [[15, 'b', 'Neat Driver'], [150, 's', 'Smooth Operator'], [750, 'g', 'Metronome']]],
    ['Sideways', 'drift', 'drift', 'run', 'Drift {n} metres in one rally', [[100, 'b', 'Tail Out'], [250, 's', 'Loose Surface'], [400, 'g', 'Mostly Sideways'], [550, 'p', 'Forwards Is Optional']]],
    ['Sideways', 'driftL', 'drift', 'life', 'Drift {n} metres in total', [[2000, 'b', 'Tyre Bill'], [20000, 's', 'Rubber Budget'], [100000, 'g', 'Tyre Sponsor Wanted']]],
    ['Sideways', 'long', 'long', 'run', 'Hold one drift for {n} metres', [[20, 'b', 'Long Slide'], [35, 's', 'Still Sliding'], [50, 'g', 'One Long Corner'], [70, 'p', 'Round and Round']]],
    ['Sideways', 'boosts', 'boosts', 'run', 'Fire {n} drift boost{s} in one rally', [[3, 'b', 'Lit'], [8, 's', 'On the Boil'], [14, 'g', 'Anti-Lag'], [20, 'p', 'Flames Out the Back']]],
    ['Sideways', 'boostsL', 'boosts', 'life', 'Fire {n} drift boosts in total', [[50, 'b', 'Warm Turbo'], [500, 's', 'Hot Turbo'], [3000, 'g', 'Glowing Turbo']]],
    ['Ghosts', 'winsL', 'wins', 'life', 'Beat your own ghost {n} time{s}', [[1, 'b', 'Better Than Yesterday'], [10, 's', 'Chasing Yourself'], [40, 'g', 'Your Own Worst Rival']]],
    ['Daily', 'daily', 'daily', 'run', 'Score {n} on the Daily Stage', [[11000, 'b', 'Day Tripper'], [13000, 's', 'Daily Driver'], [15000, 'g', 'Daily Legend']]],
    ['Daily', 'ddays', 'dailyDays', 'life', 'Drive the Daily Stage on {n} day{s}', [[1, 'b', 'Clocked In'], [7, 's', 'Week of Stages'], [30, 'g', 'Month on the Road']]],
    ['Career', 'runs', 'runs', 'life', 'Take the start {n} time{s}', [[1, 'b', 'First Rally'], [25, 's', 'Regular Entrant'], [100, 'g', 'Old Hand']]],
  ];
  const EXTRA_ACH = [
    { id: 'lap-17', cat: 'The clock', n: 'Hot Lap', tier: 's', t: 'Finish a lap in under 17 seconds', f: () => D.bs.lapx >= 4300 },
    { id: 'lap-155', cat: 'The clock', n: 'Flying Lap', tier: 'p', t: 'Finish a lap in under 15.5 seconds', f: () => D.bs.lapx >= 4450 },
  ];
  const MISSION_POOL = [
    ['run', 'score', 'Score {n} in one rally', 9000, 12500, 14800], ['run', 'drift', 'Drift {n} metres in one rally', 80, 200, 350],
    ['run', 'boosts', 'Fire {n} drift boosts in one rally', 3, 7, 12], ['run', 'clean', 'Drive {n} clean laps in one rally', 1, 2, 3],
    ['run', 'long', 'Hold one drift for {n} metres', 15, 30, 45], ['day', 'runs', 'Finish {n} rallies today', 2, 4, 6],
    ['day', 'laps', 'Finish {n} laps today', 6, 12, 21], ['day', 'drift', 'Drift {n} metres today', 250, 600, 1200],
  ];
