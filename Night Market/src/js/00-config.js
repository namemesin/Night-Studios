  /* ================= NIGHT MARKET: what the game is ================= */
  // Run a stall at a night bazaar. Prices move all night; buy under the usual price, sell over it, and pay the rent
  // at every dawn. The rent keeps climbing, and the night you can't pay it the stall closes. The shared kit (in kit/)
  // handles saving, coins, levels, login, leaderboards and the common screens from the tables in this file.
  const GAME = {
    id: 'market', name: 'Night Market', saveKey: 'nightmarket-save1',
    keys: { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], buy: ['ArrowRight', 'KeyD'], sell: ['ArrowLeft', 'KeyA'], dump: ['Space', 'KeyE'], pause: ['KeyP', 'Escape'] },
    keyActions: [['up', 'Stall above'], ['down', 'Stall below'], ['buy', 'Buy a crate'], ['sell', 'Sell a crate'], ['dump', 'Sell every crate of it'], ['pause', 'Pause']],
    modes: [{ id: 'free', name: 'Open Market', sub: 'How many dawns can you pay for?' }, { id: 'daily', name: 'Daily Market', sub: 'Same prices for everyone', daily: true }],
    boardNote: r => r.meta && r.meta.nights != null ? ` <span class="sub">· ${int(r.meta.nights)} night${int(r.meta.nights) === 1 ? '' : 's'}</span>` : '',
    pauseLine: () => `<b>${fmt(G.score)}</b> earned · night ${G.night} · ${fmt(G.silver)} silver in the purse`,
    shareText: r => r.mode === 'daily' ? `I earned ${fmt(r.s)} silver at today's Night Market and paid ${r.meta.nights} dawns of rent. Same prices for everyone. Beat it.` : `I kept my Night Market stall open for ${r.meta.nights} nights and earned ${fmt(r.s)} silver. Your turn.`,
    profileStats: () => [['Most nights', D.bs.nights], ['Crates sold at a profit', fmt(D.life.sold)], ['Booms cashed in', fmt(D.life.tips)]],
    help: () => `<div class="box"><h3>The stall</h3><p>You start with a little <b>silver</b> and an empty cart. Buy crates when they are cheap, sell them when they are dear. Your score is everything you earn.</p></div>
      <div class="box"><h3>Trade</h3><p>${COARSE ? 'Tap <b>Buy</b> or <b>Sell</b> on a stall. Hold to keep going.' : `Click <b>Buy</b> or <b>Sell</b>, or pick a stall with <kbd>${esc(keyFor('up'))}</kbd> <kbd>${esc(keyFor('down'))}</kbd>, buy with <kbd>${esc(keyFor('buy'))}</kbd>, sell with <kbd>${esc(keyFor('sell'))}</kbd> and sell the lot with <kbd>${esc(keyFor('dump'))}</kbd>.`} The cart only holds so many crates.</p></div>
      <div class="box"><h3>Reading a price</h3><p>Each chart has a dashed line: the <b>usual price</b>. Prices wander but always drift back to it. A green Buy button means it is well under usual; a gold Sell button means you would sell for more than you paid.</p></div>
      <div class="box"><h3>Rumors</h3><p>A rumor warns you a few seconds before a price <b>soars</b> or <b>crashes</b>. Buy before a boom and sell at the top. When a crash is coming, sell first and buy at the bottom.</p></div>
      <div class="box"><h3>Dawn</h3><p>Every dawn the <b>rent</b> comes out of your purse, and it grows each night. If the purse is short, crates are sold off to cover it. If that still isn't enough, the stall closes and the run ends. Richer goods arrive on later nights.</p></div>`,
  };
  // What the market sells. p: usual price, from: the night it arrives.
  const GOODS = [
    { id: 'tea', n: 'Tea', p: 14, c: '#8fe3a0', from: 1 },
    { id: 'spice', n: 'Spice', p: 28, c: '#ff8a4a', from: 1 },
    { id: 'lamp', n: 'Lanterns', p: 50, c: '#ffd24a', from: 1 },
    { id: 'silk', n: 'Silk', p: 95, c: '#b48cff', from: 2 },
    { id: 'jade', n: 'Jade', p: 180, c: '#5cf2b0', from: 4 },
    { id: 'pearl', n: 'Pearls', p: 340, c: '#c9e6ff', from: 6 },
    { id: 'glass', n: 'Starglass', p: 640, c: '#7fe8ff', from: 9 },
    { id: 'egg', n: 'Dragon Eggs', p: 1200, c: '#ff5a6e', from: 12 },
  ];
  const RENT0 = 25, RENTG = 1.38; // the first night's rent, and how much it grows every night
  const LANTERNS = [
    { id: 'paper', n: 'Paper Lantern', r: 'c', c: '#ff8a5c', c2: '#7a2a14' },
    { id: 'plum', n: 'Plum Lantern', r: 'c', c: '#c04a8a', c2: '#4a1236', cost: 250 },
    { id: 'jade', n: 'Jade Lantern', r: 'c', c: '#5cf2b0', c2: '#0f4a36', cost: 300 },
    { id: 'gold', n: 'Gilded Lantern', r: 'r', c: '#ffd24a', c2: '#6a4a00', sh: 'tall', cost: 800 },
    { id: 'frost', n: 'Frost Lantern', r: 'r', c: '#9fdcff', c2: '#1f4a6a', sh: 'tall', cost: 900 },
    { id: 'ghost', n: 'Ghost Light', r: 'e', c: '#e9e2ff', c2: '#6a5aa0', sh: 'box', lvl: 10 },
    { id: 'boom', n: 'Boomtown Lamp', r: 'e', c: '#ff5a6e', c2: '#ffd24a', sh: 'box', ach: 'tips-6' },
    { id: 'dragon', n: 'Dragon Lamp', r: 'l', c: '#ffffff', c2: '#ff5a6e', sh: 'tall', ach: 'nights-14' },
  ];
  const COS = { lantern: LANTERNS }, COS_LABEL = { lantern: 'Lanterns' };
  const UPG = [
    { id: 'cart', n: 'Bigger Cart', cost: [200, 500, 1000, 2000], d: l => `The cart holds ${10 + l * 2} crates` },
    { id: 'purse', n: 'Fat Purse', cost: [150, 400, 900], d: l => `Open the stall with ${100 + l * 50} silver` },
    { id: 'ears', n: 'Good Ears', cost: [200, 500, 1100], d: l => `Hear rumors ${3 + l} seconds early` },
    { id: 'tongue', n: 'Silver Tongue', cost: [250, 600, 1300, 2400], d: l => `Lose ${6 - l}% of the price when you sell` },
    { id: 'landlord', n: 'Friendly Landlord', cost: [300, 700, 1500], d: l => l ? `Rent is ${l * 5}% lower` : 'Lower rent' },
    { id: 'lucky', n: 'Lucky Coin', cost: [300, 700, 1400, 2400, 4000], d: l => l ? `+${l * 10}% coins from every run` : 'More coins from every run' },
  ];
  // nights: dawns paid for. sold: crates sold for more than they cost. big: best profit on one crate. tips: booms cashed in.
  const RUN_STATS = ['score', 'nights', 'sold', 'big', 'tips', 'daily'];
  const LIFE_KEYS = ['score', 'nights', 'sold', 'tips'];
  const FAMILIES = [
    ['The stall', 'nights', 'nights', 'run', 'Pay the rent {n} night{s} in one run', [[1, 'b', 'Open for Business'], [4, 'b', 'Regular Pitch'], [7, 's', 'Good Standing'], [10, 'g', 'Fixture'], [14, 'p', 'Market Royalty'], [18, 'm', 'They Named the Square After You']]],
    ['The stall', 'score', 'score', 'run', 'Earn {n} silver in one run', [[300, 'b', 'Pocket Money'], [2000, 's', 'Tidy Sum'], [8000, 'g', 'Small Fortune'], [30000, 'p', 'Merchant Prince'], [100000, 'm', 'Richer Than the Moon']]],
    ['The stall', 'nightsL', 'nights', 'life', 'Pay the rent {n} nights in total', [[25, 'b', 'Tenant'], [200, 's', 'Long Lease'], [1000, 'g', 'Part of the Furniture']]],
    ['Trading', 'sold', 'sold', 'run', 'Sell {n} crates at a profit in one run', [[10, 'b', 'First Sales'], [50, 's', 'Brisk Trade'], [120, 'g', 'Roaring Trade'], [250, 'p', 'Never Stops Selling']]],
    ['Trading', 'soldL', 'sold', 'life', 'Sell {n} crates at a profit in total', [[150, 'b', 'Shopkeeper'], [1500, 's', 'Wholesaler'], [8000, 'g', 'Trade Empire']]],
    ['Trading', 'big', 'big', 'run', 'Make {n} silver profit on a single crate', [[25, 'b', 'Nice Margin'], [150, 's', 'Sharp Deal'], [600, 'g', 'Daylight Robbery'], [1500, 'p', 'Deal of the Century']]],
    ['Rumors', 'tips', 'tips', 'run', 'Cash in on {n} boom{s} in one run', [[1, 'b', 'Heard It First'], [3, 's', 'Ear to the Ground'], [6, 'g', 'Boomtown'], [12, 'p', 'Knows Everything']]],
    ['Rumors', 'tipsL', 'tips', 'life', 'Cash in on {n} booms in total', [[10, 'b', 'Gossip'], [100, 's', 'Informant'], [500, 'g', 'Oracle']]],
    ['Daily', 'daily', 'daily', 'run', 'Earn {n} silver at the Daily Market', [[500, 'b', 'Day Trader'], [3000, 's', 'Daily Bread'], [12000, 'g', 'Daily Legend']]],
    ['Daily', 'ddays', 'dailyDays', 'life', 'Trade at the Daily Market on {n} day{s}', [[1, 'b', 'Clocked In'], [7, 's', 'Week of Trading'], [30, 'g', 'Month at the Market']]],
    ['Career', 'runs', 'runs', 'life', 'Finish {n} run{s}', [[1, 'b', 'First Night Out'], [25, 's', 'Familiar Face'], [100, 'g', 'Old Hand']]],
  ];
  const EXTRA_ACH = [];
  const MISSION_POOL = [
    ['run', 'nights', 'Pay the rent {n} nights in one run', 3, 6, 9], ['run', 'score', 'Earn {n} silver in one run', 300, 1500, 6000],
    ['run', 'sold', 'Sell {n} crates at a profit in one run', 15, 40, 80], ['run', 'tips', 'Cash in on {n} booms in one run', 1, 3, 5],
    ['run', 'big', 'Make {n} silver profit on a single crate', 20, 80, 250], ['day', 'runs', 'Finish {n} runs today', 2, 4, 6],
    ['day', 'nights', 'Pay the rent {n} nights today', 6, 14, 24], ['day', 'sold', 'Sell {n} crates at a profit today', 30, 80, 160],
  ];
