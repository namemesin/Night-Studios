  /* ================= NIGHT WATCH: what the game is ================= */
  // Keep the campfire alive. Shades come out of the dark from every side; light burns them. The shared kit (in
  // kit/) handles saving, coins, levels, login, leaderboards and the common screens from the tables in this file.
  const GAME = {
    id: 'watch', name: 'Night Watch', saveKey: 'nightwatch-save1',
    keys: { lantern: ['Digit1', ''], bramble: ['Digit2', ''], flare: ['Digit3', ''], beacon: ['Digit4', ''], call: ['Space', 'Enter'], speed: ['KeyF', ''], pause: ['KeyP', 'Escape'] },
    keyActions: [['lantern', 'Pick Lantern'], ['bramble', 'Pick Bramble'], ['flare', 'Pick Flare'], ['beacon', 'Pick Beacon'], ['call', 'Call the next wave'], ['speed', 'Fast forward'], ['pause', 'Pause']],
    modes: [{ id: 'free', name: 'Keep Watch', sub: 'How many nights can you hold?' }, { id: 'daily', name: 'Daily Watch', sub: 'Same waves for everyone', daily: true }],
    boardNote: r => r.meta && r.meta.waves ? ` <span class="sub">· ${int(r.meta.waves)} wave${int(r.meta.waves) === 1 ? '' : 's'}</span>` : '',
    pauseLine: () => `<b>${fmt(G.score)}</b> points · night ${G.night}, wave ${G.wave} · fire at ${Math.max(0, Math.ceil(G.fire))}`,
    shareText: r => r.mode === 'daily' ? `I held the fire for ${r.meta.waves} waves on today's Night Watch and scored ${fmt(r.s)}. Same shades for everyone. Beat it.` : `I kept the campfire alive through ${r.meta.waves} waves in Night Watch. Score: ${fmt(r.s)}. Your turn.`,
    profileStats: () => [['Most waves', D.bs.waves], ['Shades burned', fmt(D.life.kills)], ['Built', fmt(D.life.built)]],
    help: () => `<div class="box"><h3>The fire</h3><p>Shades walk in from every side and every one that touches the fire takes some of it. When the fire is out, the watch is over. Light is the only thing that hurts them.</p></div>
      <div class="box"><h3>Build</h3><p>Pick something from the bar at the bottom, then tap the ground. Everything costs <b>embers</b>, which you get for every shade you burn and every wave you clear.</p>
        <p><b>Lantern</b> burns everything inside its circle. <b>Bramble</b> slows whatever walks through it. <b>Flare</b> is a one-shot mine with a big blast. <b>Beacon</b> has long reach and focuses on the shade nearest the fire.</p>
        <p>Tap a lantern or beacon you've already placed to upgrade it, twice.</p></div>
      <div class="box"><h3>Shades</h3><p><b>Shades</b> are slow and plain. <b>Runners</b> are quick and frail. <b>Brutes</b> are slow, tough and trample brambles. <b>Wisps</b> weave and ignore brambles. Every tenth wave brings an <b>Eclipse</b>, which dims lanterns near it.</p></div>
      <div class="box"><h3>Nights</h3><p>Ten waves make a night. Survive to sunrise and the fire recovers a little, then the next night starts harder. Between waves you can <b>call the next wave</b> early for bonus embers and points. The ▶▶ button fast-forwards.</p></div>`,
  };
  const FIRES = [
    { id: 'ember', n: 'Campfire', r: 'c', c: ['255,179,71', '255,107,61'] },
    { id: 'blue', n: 'Gas Flame', r: 'c', c: ['120,200,255', '61,123,255'], cost: 300 },
    { id: 'green', n: 'Witchfire', r: 'r', c: ['157,255,120', '40,190,120'], cost: 800 },
    { id: 'violet', n: 'Spirit Flame', r: 'r', c: ['205,160,255', '140,70,255'], cost: 1200 },
    { id: 'white', n: 'White Heat', r: 'e', c: ['255,255,255', '255,225,160'], lvl: 10 },
    { id: 'rose', n: 'Rosefire', r: 'e', c: ['255,170,200', '255,77,109'], ach: 'nights-3' },
    { id: 'prism', n: 'Prismfire', r: 'l', c: 'cycle', ach: 'waves-40' },
  ];
  const LAMPS = [
    { id: 'brass', n: 'Brass Lanterns', r: 'c', c: '255,210,120' },
    { id: 'iron', n: 'Ironwork', r: 'c', c: '200,220,255', cost: 250 },
    { id: 'paper', n: 'Paper Lanterns', r: 'r', c: '255,120,90', cost: 700 },
    { id: 'jade', n: 'Jade Lamps', r: 'r', c: '120,255,190', cost: 900 },
    { id: 'crystal', n: 'Crystal', r: 'e', c: '190,160,255', lvl: 8 },
    { id: 'sun', n: 'Little Suns', r: 'l', c: '255,245,200', ach: 'kills-400' },
  ];
  const COS = { fire: FIRES, lamp: LAMPS }, COS_LABEL = { fire: 'Fires', lamp: 'Lanterns' };
  const UPG = [
    { id: 'embers', n: 'Kindling', cost: [150, 400, 900, 1800], d: l => `Start each watch with ${100 + l * 20} embers` },
    { id: 'hearth', n: 'Stone Hearth', cost: [150, 400, 900, 1800], d: l => `The fire starts at ${100 + l * 20}` },
    { id: 'wick', n: 'Long Wicks', cost: [200, 500, 1100, 2200], d: l => l ? `Lanterns and beacons burn ${l * 8}% hotter` : 'Lanterns and beacons burn hotter' },
    { id: 'reach', n: 'Polished Glass', cost: [250, 600, 1300], d: l => l ? `Light reaches ${l * 6}% farther` : 'Light reaches farther' },
    { id: 'salvage', n: 'Ash Sifter', cost: [250, 600, 1300], d: l => l ? `Burned shades leave ${l * 12}% more embers` : 'Burned shades leave more embers' },
    { id: 'lucky', n: 'Lucky Coin', cost: [300, 700, 1400, 2400, 4000], d: l => l ? `+${l * 10}% coins from every watch` : 'More coins from every watch' },
  ];
  const RUN_STATS = ['score', 'waves', 'nights', 'kills', 'built', 'bosses', 'calls', 'daily'];
  const LIFE_KEYS = ['score', 'waves', 'kills', 'built', 'bosses', 'calls'];
  const FAMILIES = [
    ['The watch', 'waves', 'waves', 'run', 'Clear {n} wave{s} in one watch', [[3, 'b', 'First Light'], [10, 'b', 'Sunrise'], [20, 's', 'Second Dawn'], [30, 'g', 'Long Vigil'], [40, 'p', 'Keeper of the Flame'], [60, 'm', 'The Fire Never Dies']]],
    ['The watch', 'nights', 'nights', 'run', 'Survive {n} night{s} in one watch', [[1, 'b', 'Made It to Morning'], [3, 's', 'Three Nights Running'], [5, 'p', 'Unbroken Watch']]],
    ['The watch', 'score', 'score', 'run', 'Score {n} in one watch', [[2000, 'b', 'Warm Hands'], [10000, 's', 'Well Fed Fire'], [30000, 'g', 'Bonfire'], [80000, 'p', 'Beacon in the Dark'], [200000, 'm', 'Second Sun']]],
    ['The watch', 'wavesL', 'waves', 'life', 'Clear {n} waves in total', [[25, 'b', 'On Duty'], [200, 's', 'Night Shift'], [1000, 'g', 'Thousand Waves']]],
    ['Shades', 'kills', 'kills', 'run', 'Burn {n} shades in one watch', [[40, 'b', 'Ash Maker'], [150, 's', 'Shadow Bane'], [400, 'g', 'Little Suns'], [900, 'p', 'Nothing in the Dark']]],
    ['Shades', 'killsL', 'kills', 'life', 'Burn {n} shades in total', [[250, 'b', 'Lamplighter'], [2500, 's', 'Night Sweeper'], [15000, 'g', 'Dawn Bringer']]],
    ['Shades', 'bosses', 'bosses', 'life', 'Burn {n} Eclipse{s}', [[1, 's', 'Eclipse Chaser'], [10, 'g', 'Sun Saver'], [40, 'p', 'Total Eclipse of the Dark']]],
    ['Building', 'built', 'built', 'run', 'Build {n} things in one watch', [[8, 'b', 'Settling In'], [20, 's', 'Fortified'], [40, 'g', 'City of Light']]],
    ['Building', 'calls', 'calls', 'life', 'Call {n} wave{s} early', [[1, 'b', 'Bring It On'], [25, 's', 'Impatient'], [150, 'g', 'No Rest Needed']]],
    ['Daily', 'daily', 'daily', 'run', 'Score {n} on the Daily Watch', [[3000, 'b', 'Daily Duty'], [15000, 's', 'Daily Guardian'], [50000, 'g', 'Daily Legend']]],
    ['Daily', 'ddays', 'dailyDays', 'life', 'Keep the Daily Watch on {n} day{s}', [[1, 'b', 'Reported In'], [7, 's', 'Week of Watches'], [30, 'g', 'Month of Mornings']]],
    ['Career', 'runs', 'runs', 'life', 'Keep watch {n} time{s}', [[1, 'b', 'First Watch'], [25, 's', 'Regular'], [100, 'g', 'Old Guard']]],
  ];
  const EXTRA_ACH = [];
  const MISSION_POOL = [
    ['run', 'waves', 'Clear {n} waves in one watch', 6, 14, 24], ['run', 'score', 'Score {n} in one watch', 2500, 10000, 30000],
    ['run', 'kills', 'Burn {n} shades in one watch', 50, 150, 350], ['run', 'built', 'Build {n} things in one watch', 8, 16, 28],
    ['run', 'calls', 'Call {n} waves early in one watch', 2, 5, 9], ['day', 'runs', 'Finish {n} watches today', 2, 4, 6],
    ['day', 'kills', 'Burn {n} shades today', 150, 400, 900], ['day', 'waves', 'Clear {n} waves today', 15, 35, 60],
  ];
