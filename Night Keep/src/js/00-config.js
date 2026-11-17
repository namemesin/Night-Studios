  /* ================= NIGHT KEEP: what the game is ================= */
  // Tower defense. Monsters pour out of the portal and march down the road to your keep; towers beside the road, a
  // knight and two spells stop them. Twenty waves win a map, then it goes on for as long as the keep stands. The shared
  // kit (in kit/) handles saving, coins, levels, login, leaderboards and the common screens from the tables in this file.
  const MAP_NAMES = ['Moonlit Meadow', 'Dusk Canyon', 'Frozen Pass', 'Murky Swamp', 'Ember Peak', 'Crystal Cavern'];
  const DIFF_NAMES = ['Normal', 'Hard', 'Nightmare'];
  const GAME = {
    id: 'keep', name: 'Night Keep', saveKey: 'nightkeep-save1',
    keys: { wave: ['Space', 'Enter'], hero: ['KeyH', ''], meteor: ['KeyQ', ''], freeze: ['KeyW', ''], upgrade: ['KeyU', ''], speed: ['KeyF', ''], pause: ['KeyP', ''] },
    keyActions: [['wave', 'Start or rush the wave'], ['hero', 'Pick the knight'], ['meteor', 'Meteor'], ['freeze', 'Freeze'], ['upgrade', 'Upgrade the picked tower'], ['speed', 'Game speed'], ['pause', 'Pause']],
    modes: [{ id: 'free', name: 'Defend', sub: 'Pick a map and hold the keep' }, { id: 'daily', name: 'Daily Siege', sub: 'Same map for everyone', daily: true }],
    boardNote: r => r.meta && r.meta.waves != null ? ` <span class="sub">· wave ${int(r.meta.waves)}${MAP_NAMES[r.meta.map] ? ' · ' + MAP_NAMES[r.meta.map] : ''}${r.meta.diff ? ' · ' + DIFF_NAMES[r.meta.diff] : ''}</span>` : '',
    pauseLine: () => `<b>${fmt(G.score)}</b> points · ${MAP_NAMES[G.mi]} on ${DIFF_NAMES[G.diff]} · wave ${G.wave} · ${Math.max(0, G.lives)} lives${G.won ? '<br>The map is won. Leaving now banks your score.' : ''}`,
    shareText: r => r.mode === 'daily' ? `I held today's Night Keep siege for ${r.meta.waves} waves and scored ${fmt(r.s)}. Same map for everyone. Beat it.` : `I held ${MAP_NAMES[r.meta.map] || 'the keep'} for ${r.meta.waves} waves in Night Keep. Score: ${fmt(r.s)}. Your turn.`,
    profileStats: () => [['Most waves', D.bs.waves], ['Monsters slain', fmt(D.life.kills)], ['Maps won', [0, 1, 2, 3, 4, 5].filter(i => D.bs['won' + i] > 0).length + ' of 6']],
    help: () => `<div class="box"><h3>The siege</h3><p>Monsters come out of the <b>portal</b> and walk the road to your <b>keep</b>. Each one that gets in costs lives. Clear <b>20 waves</b> to win the map; after that it keeps going, harder every wave, until the keep falls.</p></div>
      <div class="box"><h3>Towers</h3><p>Pick a tower from the bar, then ${COARSE ? 'tap' : 'click'} open ground to build it. ${COARSE ? 'Tap' : 'Click'} a built tower to upgrade it, change its aim or sell it. Every tower has 4 levels and the last is a choice between two specializations.</p>
        <p>A tower placed between waves can be undone for a full refund until the next wave starts. You begin with the Archer and the Cannon; the rest are unlocked with coins under <b>Upgrades</b>.</p></div>
      <div class="box"><h3>Knight and spells</h3><p>${COARSE ? 'Tap' : 'Click'} your knight, then anywhere on the map to send him there. He fights whatever is next to him and levels up from kills. <b>Meteor</b> blasts a spot you choose. <b>Freeze</b> stops every monster for a moment. Both recharge.</p></div>
      <div class="box"><h3>Monsters</h3><p><b>Ghosts</b> shrug off physical damage (Archer, Cannon, Sniper, Mortar). <b>Knights</b> are armored, so bring big hits, poison, fire or lasers. <b>Beetles</b> block the first few hits. <b>Healers</b> mend everything near them. <b>Hexers</b> put the nearest tower to sleep. <b>Blobs</b> split into slimes. Every tenth wave brings a <b>boss</b>.</p></div>
      <div class="box"><h3>Score and coins</h3><p>Points come from kills, cleared waves and winning the map. Hard doubles them and Nightmare triples them. While a wave is running, <b>Rush</b> calls the next one early for bonus gold. Coins are paid when the siege ends.</p>
        ${COARSE ? '' : `<p>Keys: <kbd>1</kbd> to <kbd>0</kbd> pick a tower, <kbd>${esc(keyFor('hero'))}</kbd> knight, <kbd>${esc(keyFor('meteor'))}</kbd> meteor, <kbd>${esc(keyFor('freeze'))}</kbd> freeze, <kbd>${esc(keyFor('wave'))}</kbd> wave, <kbd>${esc(keyFor('upgrade'))}</kbd> upgrade, <kbd>Esc</kbd> cancel.</p>`}</div>`,
  };
  // s armor, k visor, r plume, b shield and cape, d boots
  const HEROES = [
    { id: 'knight', n: 'Keep Knight', r: 'c', s: '#e6e8f0', k: '#20242c', p: '#ff5d6c', b: '#2f6fe0', d: '#6b7280' },
    { id: 'ranger', n: 'Wood Warden', r: 'c', s: '#9fd6a0', k: '#12301a', p: '#ffd24a', b: '#2f8f3a', d: '#3d5a3c', cost: 250 },
    { id: 'crimson', n: 'Red Guard', r: 'c', s: '#f0d0d0', k: '#3a0a12', p: '#ffffff', b: '#d43b47', d: '#7a2f38', cost: 300 },
    { id: 'gilded', n: 'Gilded Champion', r: 'r', s: '#ffe08a', k: '#4a3200', p: '#ff5d6c', b: '#d9a521', d: '#8a6a12', cost: 900 },
    { id: 'frost', n: 'Frost Sentinel', r: 'r', s: '#d6f1ff', k: '#123a55', p: '#8fdcff', b: '#3d9bd6', d: '#5a7a90', cost: 1100 },
    { id: 'shade', n: 'Night Blade', r: 'e', s: '#4a4760', k: '#b46fff', p: '#b46fff', b: '#23202f', d: '#16141f', lvl: 10 },
    { id: 'ember', n: 'Ember Lord', r: 'e', s: '#ffb38a', k: '#3a1000', p: '#ffd24a', b: '#ff7a2f', d: '#8a3a1c', ach: 'bosses-10' },
    { id: 'moon', n: 'Moon Paladin', r: 'l', s: '#ffffff', k: '#6fd3ff', p: '#ffe066', b: '#b48cff', d: '#c9c7d6', ach: 'allmaps' },
  ];
  const FLAGS = [
    { id: 'green', n: 'Green Banner', r: 'c', c: '#58c96a', c2: '#3fa253' },
    { id: 'red', n: 'Red Banner', r: 'c', c: '#ff5d6c', c2: '#c23a48', cost: 150 },
    { id: 'blue', n: 'Blue Banner', r: 'c', c: '#6fb4ff', c2: '#3f7fd0', cost: 150 },
    { id: 'gold', n: 'Royal Gold', r: 'r', c: '#ffd24a', c2: '#c79a1e', cost: 600 },
    { id: 'violet', n: 'Night Studios Violet', r: 'r', c: '#b48cff', c2: '#7a55c8', lvl: 5 },
    { id: 'white', n: 'White Flag (Never)', r: 'e', c: '#ffffff', c2: '#c9c7d6', ach: 'waves-30' },
    { id: 'black', n: 'Black Standard', r: 'l', c: '#2a2438', c2: '#ff5d6c', ach: 'nightmare' },
  ];
  const COS = { hero: HEROES, flag: FLAGS }, COS_LABEL = { hero: 'Knights', flag: 'Banners' };
  // The six boosts, then one entry for each tower that has to be unlocked (ids start with t_).
  const UPG = [
    { id: 'dmg', n: 'Sharp Tips', cost: [125, 300, 625], d: l => l ? `+${l * 8}% tower damage` : 'More tower damage' },
    { id: 'range', n: 'Eagle Eye', cost: [125, 300, 625], d: l => l ? `+${l * 5}% tower range` : 'More tower range' },
    { id: 'gold', n: 'Treasury', cost: [100, 250, 500], d: l => l ? `Start with ${l * 40} more gold` : 'More starting gold' },
    { id: 'lives', n: 'Ramparts', cost: [100, 250, 500], d: l => l ? `+${l * 5} lives` : 'More lives' },
    { id: 'bounty', n: 'Bounty', cost: [150, 350, 700], d: l => l ? `+${l * 10}% gold per kill` : 'More gold per kill' },
    { id: 'sell', n: 'Salvage', cost: [75, 200, 400], d: l => l ? `+${l * 10}% back when you sell a tower` : 'Better sell refunds' },
    { id: 't_frost', n: 'Tower: Frost', cost: [150], d: l => (l ? 'Unlocked. ' : '') + 'Slows groups of monsters' },
    { id: 't_poison', n: 'Tower: Poison', cost: [200], d: l => (l ? 'Unlocked. ' : '') + 'Poison that eats through armor' },
    { id: 't_sniper', n: 'Tower: Sniper', cost: [250], d: l => (l ? 'Unlocked. ' : '') + 'Huge range and damage' },
    { id: 't_flame', n: 'Tower: Flame', cost: [300], d: l => (l ? 'Unlocked. ' : '') + 'Burns everything close by' },
    { id: 't_tesla', n: 'Tower: Tesla', cost: [400], d: l => (l ? 'Unlocked. ' : '') + 'Lightning that jumps between monsters' },
    { id: 't_mortar', n: 'Tower: Mortar', cost: [450], d: l => (l ? 'Unlocked. ' : '') + 'Shells almost any spot on the map' },
    { id: 't_mine', n: 'Tower: Gold Mine', cost: [500], d: l => (l ? 'Unlocked. ' : '') + 'Pays gold after every wave' },
    { id: 't_laser', n: 'Tower: Laser', cost: [650], d: l => (l ? 'Unlocked. ' : '') + 'A beam that grows stronger on one target' },
  ];
  // wonN: hardest difficulty beaten on map N (1 Normal, 2 Hard, 3 Nightmare). starN: best stars. waveN: best wave.
  const MAP_STATS = [0, 1, 2, 3, 4, 5].flatMap(i => ['won' + i, 'star' + i, 'wave' + i]);
  const RUN_STATS = ['score', 'waves', 'kills', 'bosses', 'built', 'wins', 'daily', ...MAP_STATS];
  const LIFE_KEYS = ['score', 'waves', 'kills', 'bosses', 'built', 'wins'];
  const FAMILIES = [
    ['Defense', 'waves', 'waves', 'run', 'Clear {n} wave{s} in one siege', [[5, 'b', 'Holding the Gate'], [10, 'b', 'Demon Slayer'], [20, 's', 'The Keep Stands'], [30, 'g', 'Past Midnight'], [40, 'p', 'Unbreakable'], [60, 'm', 'Eternal Watch']]],
    ['Defense', 'score', 'score', 'run', 'Score {n} in one siege', [[3000, 'b', 'Skirmish'], [15000, 's', 'Battle Won'], [40000, 'g', 'War Hero'], [100000, 'p', 'Legend of the Keep'], [250000, 'm', 'Myth of the Keep']]],
    ['Defense', 'wavesL', 'waves', 'life', 'Clear {n} waves in total', [[50, 'b', 'Recruit'], [400, 's', 'Captain'], [2000, 'g', 'Warden of the Night']]],
    ['Defense', 'wins', 'wins', 'life', 'Win {n} map{s}', [[1, 'b', 'Victory'], [5, 's', 'Campaigner'], [20, 'g', 'Conqueror']]],
    ['Monsters', 'kills', 'kills', 'run', 'Slay {n} monsters in one siege', [[100, 'b', 'Pest Control'], [400, 's', 'Monster Hunter'], [1200, 'g', 'One-Keep Army']]],
    ['Monsters', 'killsL', 'kills', 'life', 'Slay {n} monsters in total', [[1000, 'b', 'Slayer'], [10000, 's', 'Exterminator'], [50000, 'g', 'Bane of the Portal']]],
    ['Monsters', 'bosses', 'bosses', 'life', 'Slay {n} boss{s}', [[1, 'b', 'Demonbane'], [10, 's', 'Lich Breaker'], [50, 'g', 'Nothing Scares You']]],
    ['Building', 'built', 'built', 'life', 'Build {n} tower{s}', [[25, 'b', 'Apprentice Mason'], [250, 's', 'Master Builder'], [1500, 'g', 'Architect of War']]],
    ['Daily', 'daily', 'daily', 'run', 'Score {n} on the Daily Siege', [[3000, 'b', 'Day Shift'], [15000, 's', 'Daily Defender'], [40000, 'g', 'Daily Legend']]],
    ['Daily', 'ddays', 'dailyDays', 'life', 'Fight the Daily Siege on {n} day{s}', [[1, 'b', 'Reporting In'], [7, 's', 'Week on the Wall'], [30, 'g', 'Month on the Wall']]],
    ['Career', 'runs', 'runs', 'life', 'Finish {n} siege{s}', [[1, 'b', 'First Siege'], [25, 's', 'Seasoned'], [100, 'g', 'Old Guard']]],
  ];
  const EXTRA_ACH = [
    { id: 'allmaps', cat: 'Defense', n: 'Lord of Six Lands', tier: 'p', t: 'Win every map', f: () => [0, 1, 2, 3, 4, 5].every(i => D.bs['won' + i] > 0) },
    { id: 'hard', cat: 'Defense', n: 'Hardened', tier: 's', t: 'Win a map on Hard', f: () => [0, 1, 2, 3, 4, 5].some(i => D.bs['won' + i] >= 2) },
    { id: 'nightmare', cat: 'Defense', n: 'Sweet Dreams', tier: 'g', t: 'Win a map on Nightmare', f: () => [0, 1, 2, 3, 4, 5].some(i => D.bs['won' + i] >= 3) },
    { id: 'flawless', cat: 'Defense', n: 'Not a Scratch', tier: 'g', t: 'Win a map with 3 stars', f: () => [0, 1, 2, 3, 4, 5].some(i => D.bs['star' + i] >= 3) },
  ];
  const MISSION_POOL = [
    ['run', 'waves', 'Clear {n} waves in one siege', 5, 10, 20], ['run', 'score', 'Score {n} in one siege', 3000, 12000, 30000],
    ['run', 'kills', 'Slay {n} monsters in one siege', 60, 150, 350], ['run', 'built', 'Build {n} towers in one siege', 5, 10, 16],
    ['day', 'waves', 'Clear {n} waves today', 10, 25, 45], ['day', 'kills', 'Slay {n} monsters today', 150, 400, 900],
    ['day', 'bosses', 'Slay {n} bosses today', 1, 2, 4], ['day', 'runs', 'Finish {n} sieges today', 2, 4, 6],
  ];
