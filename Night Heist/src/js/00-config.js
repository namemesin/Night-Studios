  /* ================= NIGHT HEIST: what the game is ================= */
  // Sneak through a guarded floor, take the vault piece, reach the exit, go again on a harder floor. Being seen fills
  // the alarm; a full alarm ends the job. The shared kit (in kit/) handles saving, coins, levels, login, leaderboards
  // and the common screens from the tables in this file.
  const GAME = {
    id: 'heist', name: 'Night Heist', saveKey: 'nightheist-save1',
    keys: { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], smoke: ['Space', 'KeyE'], pause: ['KeyP', 'Escape'] },
    keyActions: [['up', 'Move up'], ['down', 'Move down'], ['left', 'Move left'], ['right', 'Move right'], ['smoke', 'Smoke bomb'], ['pause', 'Pause']],
    modes: [{ id: 'free', name: 'The Job', sub: 'How many floors can you clean out?' }, { id: 'daily', name: 'Daily Job', sub: 'Same building for everyone', daily: true }],
    boardNote: r => r.meta && r.meta.floors != null ? ` <span class="sub">· ${int(r.meta.floors)} floor${int(r.meta.floors) === 1 ? '' : 's'}</span>` : '',
    pauseLine: () => `<b>${fmt(G.score)}</b> points · floor ${G.floor} · ${G.smoke} smoke bomb${G.smoke === 1 ? '' : 's'}`,
    shareText: r => r.mode === 'daily' ? `I cleaned out ${r.meta.floors} floors of today's Night Heist building for ${fmt(r.s)}. Same guards for everyone. Beat it.` : `I got ${r.meta.floors} floors deep in Night Heist before they caught me. Score: ${fmt(r.s)}. Your turn.`,
    profileStats: () => [['Deepest floor', D.bs.floors], ['Loot taken', fmt(D.life.loot)], ['Unseen floors', fmt(D.life.ghosts)]],
    help: () => `<div class="box"><h3>The job</h3><p>Every floor has a <b>vault piece</b> (the big gem). Take it and the exit at the top unlocks. Everything else lying around is optional loot for points.</p></div>
      <div class="box"><h3>Move</h3><p>${COARSE ? 'Drag anywhere to move in any direction.' : `Move with <kbd>${esc(keyFor('up'))}</kbd> <kbd>${esc(keyFor('left'))}</kbd> <kbd>${esc(keyFor('down'))}</kbd> <kbd>${esc(keyFor('right'))}</kbd> or the arrow keys.`} Walls block you, and they block what guards can see.</p></div>
      <div class="box"><h3>Staying unseen</h3><p>Guards walk fixed rounds and see in a cone in front of them. Standing in a cone, or in a sweeping <b>searchlight</b>, fills the <b>alarm</b>. Step out and it drains. If it fills, or a guard touches you, the job is over.</p>
        <p>A guard who spots you stops and stares, so break the line of sight behind a wall.</p></div>
      <div class="box"><h3>Smoke</h3><p>${COARSE ? 'Tap <b>Smoke</b>' : `Press <kbd>${esc(keyFor('smoke'))}</kbd>`} to vanish for a couple of seconds. You carry very few, and spare ones sometimes lie on the floor.</p></div>
      <div class="box"><h3>Score</h3><p>Loot, a bonus for each floor, a speed bonus for beating the clock, and a <b>Ghost</b> bonus for finishing a floor without ever raising the alarm. Deeper floors pay more and guard harder.</p></div>`,
  };
  const THIEVES = [
    { id: 'shadow', n: 'Shadow', r: 'c', c: '#3df0c0', c2: '#0f3a30' },
    { id: 'burglar', n: 'Cat Burglar', r: 'c', c: '#c9d6e8', c2: '#1a1f2b', stripe: 1, cost: 250 },
    { id: 'crimson', n: 'Red Hood', r: 'c', c: '#ff5a6e', c2: '#4a1020', cost: 300 },
    { id: 'gold', n: 'Golden Glove', r: 'r', c: '#ffd24a', c2: '#5a3a00', cost: 800 },
    { id: 'night', n: 'Night Owl', r: 'r', c: '#7b8cff', c2: '#1a1f55', cost: 900 },
    { id: 'ninja', n: 'Shinobi', r: 'e', c: '#1a1f2b', c2: '#ff5a6e', stripe: 1, lvl: 10 },
    { id: 'phantom', n: 'Phantom', r: 'e', c: '#d9c6ff', c2: '#5a3aa0', alpha: .6, ach: 'ghosts-5' },
    { id: 'mastermind', n: 'Mastermind', r: 'l', c: '#ffffff', c2: '#ffd24a', stripe: 1, ach: 'floors-15' },
  ];
  const COS = { thief: THIEVES }, COS_LABEL = { thief: 'Thieves' };
  const UPG = [
    { id: 'shoes', n: 'Soft Soles', cost: [200, 500, 1100], d: l => l ? `Move ${l * 5}% faster` : 'Move faster' },
    { id: 'smoke', n: 'Deep Pockets', cost: [300, 900], d: l => `Start each job with ${1 + l} smoke bomb${l ? 's' : ''}` },
    { id: 'cloak', n: 'Dark Clothes', cost: [200, 500, 1000, 2000], d: l => l ? `The alarm fills ${l * 8}% slower` : 'The alarm fills slower' },
    { id: 'nerves', n: 'Steady Breath', cost: [200, 500, 1000], d: l => l ? `The alarm drains ${l * 20}% faster` : 'The alarm drains faster' },
    { id: 'fence', n: 'Good Fence', cost: [250, 600, 1300, 2400], d: l => l ? `Loot is worth ${l * 10}% more` : 'Loot is worth more' },
    { id: 'lucky', n: 'Lucky Coin', cost: [300, 700, 1400, 2400, 4000], d: l => l ? `+${l * 10}% coins from every job` : 'More coins from every job' },
  ];
  const RUN_STATS = ['score', 'floors', 'loot', 'ghosts', 'smokes', 'fast', 'daily'];
  const LIFE_KEYS = ['score', 'floors', 'loot', 'ghosts', 'smokes', 'fast'];
  const FAMILIES = [
    ['The job', 'floors', 'floors', 'run', 'Clean out {n} floor{s} in one job', [[1, 'b', 'Foot in the Door'], [3, 'b', 'Second Story'], [6, 's', 'Getting Greedy'], [10, 'g', 'Penthouse'], [15, 'p', 'Mastermind'], [22, 'm', 'They Never Saw a Thing']]],
    ['The job', 'score', 'score', 'run', 'Score {n} in one job', [[1500, 'b', 'Petty Cash'], [6000, 's', 'Decent Haul'], [15000, 'g', 'Big Score'], [35000, 'p', 'Heist of the Year'], [80000, 'm', 'Heist of the Century']]],
    ['The job', 'floorsL', 'floors', 'life', 'Clean out {n} floors in total', [[20, 'b', 'Regular'], [150, 's', 'Professional'], [800, 'g', 'Career Criminal']]],
    ['Stealth', 'ghosts', 'ghosts', 'run', 'Finish {n} floor{s} unseen in one job', [[1, 'b', 'Unnoticed'], [3, 's', 'Light Feet'], [5, 'g', 'Phantom'], [9, 'p', 'Never There']]],
    ['Stealth', 'ghostsL', 'ghosts', 'life', 'Finish {n} floors unseen in total', [[10, 'b', 'Quiet Type'], [75, 's', 'Shadow'], [400, 'g', 'Rumor']]],
    ['Stealth', 'fast', 'fast', 'run', 'Beat the clock on {n} floor{s} in one job', [[2, 'b', 'In and Out'], [5, 's', 'Smash and Grab'], [9, 'g', 'Gone in Sixty']]],
    ['Loot', 'loot', 'loot', 'run', 'Take {n} pieces of loot in one job', [[8, 'b', 'Sticky Fingers'], [20, 's', 'Full Bag'], [40, 'g', 'Need a Bigger Bag']]],
    ['Loot', 'lootL', 'loot', 'life', 'Take {n} pieces of loot in total', [[75, 'b', 'Collector'], [600, 's', 'Hoarder'], [3000, 'g', 'Dragon']]],
    ['Loot', 'smokes', 'smokes', 'life', 'Use {n} smoke bomb{s}', [[1, 'b', 'Poof'], [25, 's', 'Smoke Screen'], [150, 'g', 'Fog Machine']]],
    ['Daily', 'daily', 'daily', 'run', 'Score {n} on the Daily Job', [[2000, 'b', 'Day Job'], [8000, 's', 'Daily Bread'], [25000, 'g', 'Daily Legend']]],
    ['Daily', 'ddays', 'dailyDays', 'life', 'Pull the Daily Job on {n} day{s}', [[1, 'b', 'Clocked In'], [7, 's', 'Week of Work'], [30, 'g', 'Month of Mischief']]],
    ['Career', 'runs', 'runs', 'life', 'Finish {n} job{s}', [[1, 'b', 'First Job'], [25, 's', 'Known to Police'], [100, 'g', 'Most Wanted']]],
  ];
  const EXTRA_ACH = [];
  const MISSION_POOL = [
    ['run', 'floors', 'Clean out {n} floors in one job', 2, 5, 9], ['run', 'score', 'Score {n} in one job', 1500, 6000, 15000],
    ['run', 'ghosts', 'Finish {n} floors unseen in one job', 1, 2, 4], ['run', 'loot', 'Take {n} pieces of loot in one job', 8, 16, 28],
    ['run', 'fast', 'Beat the clock on {n} floors in one job', 1, 3, 5], ['day', 'runs', 'Finish {n} jobs today', 3, 6, 10],
    ['day', 'floors', 'Clean out {n} floors today', 6, 14, 25], ['day', 'loot', 'Take {n} pieces of loot today', 25, 60, 110],
  ];
