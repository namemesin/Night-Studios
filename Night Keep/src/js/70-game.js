  /* ================= NIGHT KEEP: the game ================= */
  // The battle runs on a 320 x 192 pixel map (the small canvas with id "game"), scaled up to fit the screen. The stat
  // bar, tower bar and upgrade box around it are ordinary page elements inside #keep. Everything between the braces
  // below is the battle itself and keeps its own short names; the kit talks to it through K.
  let G = null, acc = 0, lastFrame = 0;
  const K = {}, keepEl = $('keep');
  {
const TILE=16,COLS=20,ROWS=12,W=320,H=192,MAXWAVE=20;
const cv=$('game'),ctx=cv.getContext('2d');
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function sprite(rows,pal){
  const w=Math.max(...rows.map(r=>r.length)),c=document.createElement('canvas');
  c.width=w;c.height=rows.length;const x=c.getContext('2d');
  rows.forEach((r,y)=>{for(let i=0;i<r.length;i++){const p=pal[r[i]];if(p){x.fillStyle=p;x.fillRect(i,y,1,1);}}});
  c.sw=w;c.sh=rows.length;return c;
}
const perk=k=>up(k);
/* ---------- sprites ---------- */
const stone={s:'#9a98a8',d:'#5d5b6b'};
const SLIME=[
"...gggg...",
"..gGGGGg..",
".gGGGGGGg.",
".gGwkGwkg.",
".gGGGGGGg.",
"gGGGGGGGGg",
"gGGGGGGGGg",
".gggggggg."];
const SPR={
  archer:sprite([
"................",
"......rrrr......",
".....rrrrrr.....",
"....rrRRRRrr....",
"...rrrrrrrrrr...",
"....wwwwwwww....",
"....wkkwwkkw....",
"....wkkwwkkw....",
"....wwwwwwww....",
"....sswwwwss....",
"....sswwwwss....",
"....ssssssss....",
"....sdsssdss....",
"....ssssssss....",
"...ssdssssdss...",
"...dddddddddd..."],{...stone,r:'#c8423a',R:'#e2675c',w:'#a8743c',k:'#2a1d18'}),
  cannon:sprite([
"................",
"................",
"................",
"......kkkk......",
".....kkkkkk.....",
".....kkllkk.....",
".....kkkkkk.....",
"....ssssssss....",
"...ssssssssss...",
"...sdssssssds...",
"...ssssssssss...",
"...ssssddssss...",
"...ssssssssss...",
"...sdssssssds...",
"..ssssssssssss..",
"..dddddddddddd.."],{...stone,k:'#23222b',l:'#6b6a78'}),
  frost:sprite([
"................",
".......cc.......",
"......cCCc......",
"......cCWc......",
".....cCWWCc.....",
".....cCWCCc.....",
"......cCCc......",
"......cCCc......",
".......cc.......",
"......ssss......",
".....ssssss.....",
"....ssssssss....",
"....sdssssds....",
"....ssssssss....",
"...ssssssssss...",
"...dddddddddd..."],{...stone,c:'#3d9bd6',C:'#8fdcff',W:'#ffffff'}),
  poison:sprite([
"................",
"......g..g......",
".....g.gg.......",
"......gggg......",
".....vvvvvv.....",
"....vGGGGGGv....",
"....vGgGGgGv....",
"....vGGGGGGv....",
".....vvvvvv.....",
"......ssss......",
".....ssssss.....",
"....ssssssss....",
"....sdssssds....",
"....ssssssss....",
"...ssssssssss...",
"...dddddddddd..."],{...stone,g:'#9be35a',G:'#5fb52f',v:'#3a2a4a'}),
  sniper:sprite([
".........gg.....",
".........ggg....",
".........g......",
"......pppp......",
".....pppppp.....",
".....pkkkkp.....",
".....pppppp.....",
"......ssss......",
"......sdss......",
"......ssss......",
"......ssds......",
"......ssss......",
".....ssssss.....",
".....sdssds.....",
"....ssssssss....",
"....dddddddd...."],{...stone,g:'#58c96a',p:'#7a5bb5',k:'#1d1629'}),
  flame:sprite([
"................",
".......o........",
"......oo.o......",
"......oyoo......",
".....ooyyoo.....",
".....oyyWyo.....",
".....oyWWyo.....",
"......oyyo......",
"....kkkkkkkk....",
".....kkkkkk.....",
"......kkkk......",
".....ssssss.....",
"....ssssssss....",
"....sdssssds....",
"...ssssssssss...",
"...dddddddddd..."],{...stone,o:'#ff7a2f',y:'#ffd24a',W:'#ffffff',k:'#2b2530'}),
  tesla:sprite([
"................",
"......yyyy......",
".....yYYYYy.....",
".....yYWWYy.....",
".....yYYYYy.....",
"......yyyy......",
".......mm.......",
"......mmmm......",
".......mm.......",
"......mmmm......",
".......mm.......",
".....ssssss.....",
"....ssssssss....",
"....sdssssds....",
"...ssssssssss...",
"...dddddddddd..."],{...stone,y:'#d9a521',Y:'#ffe066',W:'#ffffff',m:'#b0683a'}),
  mortar:sprite([
"................",
"................",
".........kk.....",
"........kkkk....",
".......kkkkl....",
"......kkkkl.....",
".....kkkkl......",
".....kkkk.......",
"....wwwwwwww....",
"...wwkwwwwkww...",
"...ssssssssss...",
"...sdssssssds...",
"...ssssssssss...",
"...ssssddssss...",
"..ssssssssssss..",
"..dddddddddddd.."],{...stone,k:'#23222b',l:'#6b6a78',w:'#a8743c'}),
  mine:sprite([
"................",
"................",
"....wwwwwwww....",
"...wwwwwwwwww...",
"..wwwwwwwwwwww..",
"...tttttttttt...",
"...tkkkkkkkkt...",
"...tkkkkkkkkt...",
"...tkkyykkkkt...",
"...tkyyyykykt...",
"...tyyyyyyyyt...",
"...ssssssssss...",
"...sdssssssds...",
"...ssssssssss...",
"..ssssssssssss..",
"..dddddddddddd.."],{...stone,w:'#8a4a2c',t:'#a8743c',k:'#1c1512',y:'#ffd24a'}),
  laser:sprite([
"................",
".......rr.......",
"......rRRr......",
"......rRWr......",
"......rRRr......",
".......rr.......",
"......mmmm......",
".....mm..mm.....",
".....m.rr.m.....",
".....mm..mm.....",
"......mmmm......",
".....ssssss.....",
"....ssssssss....",
"....sdssssds....",
"...ssssssssss...",
"...dddddddddd..."],{...stone,r:'#d43b47',R:'#ff8a8a',W:'#ffffff',m:'#6b7280'}),
  slime:sprite(SLIME,{g:'#2f8f3a',G:'#6fe06a',w:'#ffffff',k:'#10220f'}),
  blob:sprite(SLIME,{g:'#2f5fb0',G:'#6fb4ff',w:'#ffffff',k:'#0f1a33'}),
  bat:sprite([
"k..........k",
"kk..kkkk..kk",
"kkkkrkkrkkkk",
".kkkkkkkkkk.",
"..kk.kk.kk.."],{k:'#4a3566',r:'#ff5d6c'}),
  knight:sprite([
"...ssss...",
"..ssssss..",
"..skkkks..",
"..ssssss..",
".ssssssss.",
"sbssssssbs",
"sbssssssbs",
".ssssssss.",
"..ss..ss..",
"..dd..dd.."],{s:'#b9c0cc',k:'#20242c',b:'#3f6fd0',d:'#6b7280'}),
  golem:sprite([
"..bbbbbb..",
".bBBBBBBb.",
".BoBBBBoB.",
".BBBBBBBB.",
"bBBBBBBBBb",
"bBBBBBBBBb",
"bBBBBBBBBb",
".BBBBBBBB.",
".BB....BB.",
".bb....bb."],{b:'#5a4636',B:'#8c6f55',o:'#ff9a3c'}),
  swarm:sprite([
".pppp.",
"pPwPwp",
"pPPPPp",
".pppp.",
"p.pp.p"],{p:'#8a2f7a',P:'#d95fc4',w:'#ffffff'}),
  shaman:sprite([
"....yy....",
"...yyyy...",
"..pppppp..",
"..pwkwkp..",
"..pppppp..",
".pppppppp.",
".pPppppPp.",
".pppppppp.",
"..pppppp..",
"..p....p.."],{p:'#3f8f7a',P:'#6fe0c4',y:'#ffe066',w:'#ffffff',k:'#0f2620'}),
  boss:sprite([
"r........r",
"rr......rr",
".rRRRRRRr.",
".RyRRRRyR.",
".RRRRRRRR.",
".RRwwwwRR.",
"rRRRRRRRRr",
"rRRRRRRRRr",
".RRRRRRRR.",
".rr....rr."],{r:'#7a1420',R:'#d43b47',y:'#ffe066',w:'#ffffff'}),
  ghost:sprite([
"...wwww...",
"..wwwwww..",
".wwwwwwww.",
".wkkwwkkw.",
".wkkwwkkw.",
".wwwwwwww.",
".wwwwwwww.",
".wwwwwwww.",
".w.ww.ww.w"],{w:'rgba(225,238,255,0.82)',k:'#34466b'}),
  hexer:sprite([
"....pp....",
"...pppp...",
"..pppppp..",
".pppppppp.",
"..ffffff..",
"..fkffkf..",
"..ffffff..",
".rrrrrrrr.",
".rrrrrrrry",
".rrrrrrrry",
"..rr..rr.y"],{p:'#5a2d8a',f:'#e8c9a0',k:'#2a1d18',r:'#7a1f6a',y:'#ffe066'}),
  hero:sprite([
"....rr....",
"...ssss...",
"..ssssss..",
"..skkkks..",
"..ssssss..",
".bbssssbb.",
"bbbsssssbW",
"bbbsssss.W",
".bbssss..W",
"..ss.ss...",
"..ss.ss...",
"..dd.dd..."],{s:'#e6e8f0',k:'#20242c',r:'#ff5d6c',b:'#2f6fe0',W:'#ffffff',d:'#6b7280'}),
  imp:sprite([
".r....r.",
".rr..rr.",
".rRRRRr.",
"rRwRRwRr",
"rRRRRRRr",
".rRkkRr.",
"..rRRr..",
"..r..r.."],{r:'#8a1c2a',R:'#ff6a5a',w:'#ffe066',k:'#2a0a10'}),
  beetle:sprite([
"..bbbbbb..",
".bBBccBBb.",
"bBBBccBBBb",
"bBBBccBBBb",
"bBBBccBBBb",
".bBBccBBb.",
"..kkkkkk..",
".k.k..k.k."],{b:'#1f5f66',B:'#2fa3a8',c:'#8ff0e6',k:'#10282b'}),
  lich:sprite([
"...yyyy...",
"..yWWWWy..",
"..pppppp..",
".pPkPPkPp.",
".pPPPPPPp.",
".pPPwwPPp.",
"..pPPPPp..",
".pppppppp.",
"pPppppppPp",
"pPppppppPp",
".pppppppp.",
"..pp..pp.."],{p:'#3b1d5e',P:'#6a3fa8',k:'#9bff6a',w:'#ffffff',y:'#d9a521',W:'#ffe066'}),
  meteor:sprite([
"................",
"...........oo...",
"..........oyo...",
".........oyo....",
"........oyo.....",
".......oyo......",
"....rrroo.......",
"...rRRRRr.......",
"..rRRyRRRr......",
"..rRyyyRRr......",
"..rRRyRRRr......",
"..rRRRRRRr......",
"...rRRRRr.......",
"....rrrr........",
"................",
"................"],{o:'#ff7a2f',y:'#ffd24a',r:'#7a3a1c',R:'#c2602c'}),
  freeze:sprite([
"................",
".......CC.......",
"...C...CC...C...",
"....C..CC..C....",
".....C.CC.C.....",
"......CCCC......",
".CCCCCCWWCCCCCC.",
".CCCCCCWWCCCCCC.",
"......CCCC......",
".....C.CC.C.....",
"....C..CC..C....",
"...C...CC...C...",
".......CC.......",
"................",
"................",
"................"],{C:'#8fdcff',W:'#ffffff'}),
  portal:sprite([
"................",
"....kkkkkkkk....",
"...kkppppppkk...",
"..kkppPPPPppkk..",
"..kppPPppPPppk..",
"..kpPPppppPPpk..",
"..kpPppWWppPpk..",
"..kpPppWWppPpk..",
"..kpPPppppPPpk..",
"..kppPPppPPppk..",
"..kkppPPPPppkk..",
"...kkppppppkk...",
"....kkkkkkkk....",
"................",
"................",
"................"],{k:'#1d1629',p:'#6a2fb0',P:'#b46fff',W:'#ffffff'}),
  keep:sprite([
"........rr......",
"........krrr....",
"........krr.....",
"........k.......",
".ss.ss.ss.ss.ss.",
".ssssssssssssss.",
".sdssssssssssds.",
".ssssssssssssss.",
".ssssssssssdsss.",
".sdssskkkksssss.",
".sssskkkkkkssss.",
".sssskkkkkkssss.",
".sdsskkkkkkssds.",
".sssskkkkkkssss.",
".dddddddddddddd.",
"................"],{s:'#c9c7d6',d:'#77758a',k:'#2a1d18',r:'#58c96a'})
};
const TREE=[
"................",
"......gggg......",
"....gggGGggg....",
"...ggGGGGGGgg...",
"...gGGGGGGGGg...",
"..ggGGGGGGGGgg..",
"..gGGGGGGGGGGg..",
"..ggGGGGGGGGgg..",
"...ggGGGGGGgg...",
"....gggggggg....",
"......tttt......",
".......tt.......",
".......tt.......",
".......tt.......",
"......tttt......",
"................"];
const ROCK=[
"................","................","................","................","................","................",
"......ssss......",
"....ssSSSSss....",
"...sSSSSSSSSs...",
"..sSSSSSSSSSSs..",
"..sSSSdSSSSSSs..",
"..sSSSSSSSdSSs..",
"..ssSSSSSSSSss..",
"...dddddddddd...",
"................","................"];
const FONT={'0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001001001001','8':'111101111101111','9':'111101111001111','+':'000010111010000'};
function ptext(str,x,y,c){
  for(let pass=0;pass<2;pass++){ctx.fillStyle=pass?c:'#1a1220';let cx=x+(pass?0:1);const cy=y+(pass?0:1);
    for(const ch of str){const g=FONT[ch];if(g)for(let i=0;i<15;i++)if(g[i]==='1')ctx.fillRect(cx+i%3,cy+(i/3|0),1,1);cx+=4;}}
}
/* ---------- data ---------- */
const TOWERS={
  archer:{name:'Archer',phys:1,cost:50,range:46,rate:0.45,dmg:9,pspd:190,unlock:0,desc:'Fast single shots. Cheap and reliable.',
    specs:[{name:'Rapid fire',desc:'Shoots much faster',rate:0.65},{name:'Volley',desc:'Hits 2 enemies at once',multi:2}]},
  cannon:{name:'Cannon',phys:1,cost:90,range:42,rate:1.4,dmg:23,splash:18,pspd:130,unlock:0,desc:'Slow shells that hit everything nearby.',
    specs:[{name:'Big Bertha',desc:'Bigger blast, more damage',splash:1.3,dmg:1.25},{name:'Stun shells',desc:'Blast stuns enemies for a moment',stun:0.6}]},
  frost:{name:'Frost',cost:70,range:38,rate:0.9,dmg:2,splash:16,slow:1,pspd:160,unlock:6,desc:'Slows groups of enemies. Low damage.',
    specs:[{name:'Deep freeze',desc:'Enemies barely move',slowMul:0.7},{name:'Shatter',desc:'Ice shards deal real damage',dmg:2.2}]},
  poison:{name:'Poison',cost:80,range:44,rate:1.0,dmg:2,dot:18,dotDur:3.5,pspd:150,unlock:8,desc:'Poison eats through armor over time.',
    specs:[{name:'Plague',desc:'Poison cloud hits a group',splashAdd:24},{name:'Venom',desc:'Much deadlier poison',dot:1.7}]},
  sniper:{name:'Sniper',phys:1,cost:120,range:95,rate:2.0,dmg:52,unlock:10,desc:'Huge range and damage. Punches through armor.',
    specs:[{name:'Assassin',desc:'Far more damage per shot',dmg:1.6},{name:'Spotter',desc:'Reloads much faster',rate:0.62}]},
  flame:{name:'Flame',cost:100,range:32,dmg:21,cont:1,unlock:12,desc:'Burns every enemy close by. Ignores armor.',
    specs:[{name:'Inferno',desc:'More range and heat',range:1.3,dmg:1.4},{name:'Napalm',desc:'Enemies keep burning',burn:22}]},
  tesla:{name:'Tesla',cost:130,range:42,rate:0.7,dmg:14,chain:3,unlock:15,desc:'Lightning that jumps between enemies.',
    specs:[{name:'Storm',desc:'Jumps to 4 more enemies and hits harder',chainAdd:4,dmg:1.3},{name:'Overcharge',desc:'Much more damage',dmg:1.5}]},
  mortar:{name:'Mortar',phys:1,cost:160,range:125,minRange:28,rate:3.2,dmg:42,splash:24,pspd:95,unlock:18,desc:'Shells almost any spot on the map. Cannot hit close enemies.',
    specs:[{name:'Cluster',desc:'Fires 2 shells',multi:2,dmg:0.85},{name:'Heavy shells',desc:'Far more damage',dmg:1.6}]},
  mine:{name:'Gold mine',cost:120,range:0,dmg:0,income:25,unlock:20,desc:'Pays gold after every wave. Does not attack.',
    specs:[{name:'Vault',desc:'Double income',income:2},{name:'Bank',desc:'Also pays 4% interest on your gold',interest:0.04}]},
  laser:{name:'Laser',cost:160,range:50,dmg:25,ramp:4,cont:1,unlock:25,desc:'A beam that grows stronger the longer it holds a target.',
    specs:[{name:'Prism',desc:'Splits into 2 beams',multi:2},{name:'Focus',desc:'Beam ramps twice as high',ramp:2}]}
};
const TKEYS=Object.keys(TOWERS);
const isUnl=k=>TOWERS[k].unlock===0||up('t_'+k)>0;
const ENEMIES={
  slime:{name:'slime',hp:30,speed:22,gold:4,armor:0,lives:1,c:'#6fe06a'},
  bat:{name:'bat',hp:20,speed:42,gold:4,armor:0,lives:1,c:'#8a6fb5'},
  blob:{name:'blob',hp:110,speed:17,gold:6,armor:0,lives:2,scale:2,split:3,c:'#6fb4ff'},
  knight:{name:'knight',hp:70,speed:18,gold:8,armor:3,lives:1,c:'#b9c0cc'},
  golem:{name:'golem',hp:220,speed:12,gold:15,armor:1,lives:2,c:'#8c6f55'},
  swarm:{name:'bug',hp:9,speed:34,gold:1,armor:0,lives:1,c:'#d95fc4'},
  shaman:{name:'healer',hp:60,speed:20,gold:10,armor:0,lives:1,heal:1,c:'#6fe0c4'},
  imp:{name:'imp',hp:14,speed:50,gold:2,armor:0,lives:1,c:'#ff6a5a'},
  beetle:{name:'beetle',hp:80,speed:16,gold:10,armor:0,lives:1,shield:4,c:'#2fa3a8'},
  ghost:{name:'ghost',hp:45,speed:26,gold:8,armor:0,lives:1,ghost:1,c:'#e6f0ff'},
  hexer:{name:'hexer',hp:55,speed:19,gold:12,armor:0,lives:1,hex:1,c:'#b46fff'},
  boss:{name:'demon',hp:520,speed:9,gold:150,armor:4,lives:5,scale:2,boss:1,c:'#d43b47'},
  lich:{name:'lich',hp:620,speed:8,gold:300,armor:2,lives:6,scale:2,boss:1,summon:1,c:'#6a3fa8'}
};
const BEAST={slime:'The basic walker. Weak alone, dangerous in a crowd.',imp:'Very fast and fragile. Needs quick towers or splash.',bat:'Fast flier. Dies quickly if anything can reach it.',blob:'Tough, and splits into three slimes when it dies.',
  knight:'Armored. Small hits bounce off, so bring big hits, poison, fire or lasers.',beetle:'Its shell blocks the first few hits completely. Fast-firing towers strip it.',bug:'Tiny and numerous. Splash and chain lightning clear them.',
  golem:'Slow and very tough. Costs 2 lives if it gets through.',healer:'Heals every enemy around it. Kill it first.',hexer:'Puts the nearest tower to sleep every few seconds.',ghost:'Takes less than half damage from Archer, Cannon, Sniper and Mortar. Use magic towers, the knight or the meteor.',
  demon:'Boss. Huge health and armor. Costs 5 lives.',lich:'Final boss. Summons bugs as it walks. Costs 6 lives.'};
for(const k of Object.keys(BEAST)){if(!ENEMIES[k]){const real=Object.keys(ENEMIES).find(q=>ENEMIES[q].name===k);BEAST[real]=BEAST[k];delete BEAST[k];}}
const THEMES={
  meadow:{g:'#4a8f3c',g2:'#5aa148',g3:'#3f7d33',p:'#c9a56b',p2:'#b8935a',e:'#8a6a3c',decor:[TREE,{g:'#2f6b2a',G:'#3d8a34',t:'#6b4423'}]},
  desert:{g:'#d9b36c',g2:'#e3c283',g3:'#c79f58',p:'#a8744a',p2:'#96643d',e:'#6f4729',decor:[ROCK,{s:'#8d8d99',S:'#b1b1bd',d:'#5f5f6b'}]},
  frost:{g:'#dfeaf2',g2:'#f4f9fc',g3:'#c5d6e3',p:'#7d8fa3',p2:'#6c7d91',e:'#4c5a6b',decor:[TREE,{g:'#2d5f5a',G:'#3f7f78',t:'#5b4030'}]},
  swamp:{g:'#3f5a3a',g2:'#4c6b45',g3:'#34492f',p:'#7a6846',p2:'#6a5a3b',e:'#3d3222',decor:[TREE,{g:'#24402a',G:'#2f5536',t:'#3d2c1c'}]},
  lava:{g:'#3a2f33',g2:'#4a3b3f',g3:'#2c2327',p:'#8a5a3c',p2:'#774a30',e:'#ff7a2f',decor:[ROCK,{s:'#1f191c',S:'#56484d',d:'#ff7a2f'}]},
  crystal:{g:'#1f2440',g2:'#2a3056',g3:'#181c33',p:'#4a4f7a',p2:'#3f4469',e:'#6fd3ff',decor:[ROCK,{s:'#2a6f9a',S:'#6fd3ff',d:'#c8f4ff'}]}
};
THEMES.crystal.dark=0.3;THEMES.crystal.f=['#6fd3ff','#b46fff'];THEMES.meadow.dark=0.3;THEMES.desert.dark=0.28;THEMES.frost.dark=0.24;THEMES.swamp.dark=0.3;THEMES.lava.dark=0.34;
THEMES.meadow.f=['#ffd24a','#ff8fb0','#ffffff'];THEMES.desert.f=['#b8935a','#f1dca7'];THEMES.frost.f=['#ffffff','#a9c4d8'];THEMES.swamp.f=['#7fae5f','#c4a64a'];THEMES.lava.f=['#ff7a2f','#ffb347'];
const MAPS=[
  {name:'Green Meadow',theme:'meadow',seed:11,hp:1,gold:160,note:'Long winding road. A good place to learn.',
   paths:[[[-1,2],[4,2],[4,8],[9,8],[9,3],[14,3],[14,9],[20,9]]]},
  {name:'Dry Canyon',theme:'desert',seed:27,hp:1.1,gold:180,note:'Tougher monsters and tighter corners.',
   paths:[[[2,-1],[2,9],[7,9],[7,2],[12,2],[12,7],[17,7],[17,12]]]},
  {name:'Frozen Pass',theme:'frost',seed:53,hp:1.15,gold:240,note:'A short road. Every tower counts.',
   paths:[[[-1,5],[6,5],[6,2],[13,2],[13,9],[20,9]]]},
  {name:'Murky Swamp',theme:'swamp',seed:71,hp:2,gold:240,note:'A long spiral to a keep in the middle.',
   paths:[[[-1,1],[17,1],[17,10],[2,10],[2,4],[13,4],[13,7],[6,7]]]},
  {name:'Ember Peak',theme:'lava',seed:97,hp:1.8,gold:280,note:'Two portals. Enemies come from both sides.',
   paths:[[[-1,2],[6,2],[6,6],[13,6],[13,9],[20,9]],[[18,-1],[18,3],[10,3],[10,6],[13,6],[13,9],[20,9]]]},
  {name:'Crystal Cavern',theme:'crystal',seed:131,hp:1.9,gold:300,note:'Three portals feed one road.',
   paths:[[[-1,1],[5,1],[5,5],[12,5],[12,9],[20,9]],[[-1,10],[5,10],[5,5],[12,5],[12,9],[20,9]],[[16,-1],[16,5],[12,5],[12,9],[20,9]]]}
];
MAPS.forEach((m,i)=>{m.name=MAP_NAMES[i];});
const inB=(x,y)=>x>=0&&y>=0&&x<COLS&&y<ROWS;
function mk(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;c.sw=w;c.sh=h;fn(c.getContext('2d'));return c;}
const PORTAL=mk(20,20,x=>{const r=rng(5);for(let py=0;py<20;py++)for(let px=0;px<20;px++){const d=Math.hypot(px-9.5,py-9.5);if(d>10)continue;
  x.fillStyle=d>7?(r()<0.3?'#5d5b6b':'#8a8898'):d>4.5?'#2a1248':'#4a1f80';x.fillRect(px,py,1,1);}});
const keepArt=(fc,fc2)=>mk(32,32,x=>{
  const R=(a,b,w,h,c)=>{x.fillStyle=c;x.fillRect(a,b,w,h);},S='#c9c7d6',D='#8d8ba0',K='#2a1d18',L='#e9e7f3';
  R(4,18,24,14,S);for(let i=0;i<6;i++)R(4+i*4,16,2,2,S);
  R(11,8,10,12,S);R(11,6,2,2,S);R(15,6,2,2,S);R(19,6,2,2,S);
  R(0,12,8,20,S);R(24,12,8,20,S);for(let i=0;i<3;i++){R(i*3,10,2,2,S);R(24+i*3,10,2,2,S);}
  R(7,12,1,20,D);R(24,12,1,20,D);R(11,8,1,10,D);R(20,8,1,10,D);R(0,30,32,2,D);R(8,18,16,1,L);R(0,12,7,1,L);R(25,12,7,1,L);R(12,8,8,1,L);
  const r=rng(9);for(let i=0;i<24;i++)R(r()*30|0,20+(r()*9|0),2,1,D);
  R(12,22,8,10,K);R(13,21,6,1,K);R(14,20,4,1,K);R(3,17,2,3,K);R(27,17,2,3,K);R(15,11,2,3,K);
  R(16,0,1,6,K);R(17,0,5,3,fc);R(17,3,3,1,fc2);
});
const hitOf=k=>mk(32,32,x=>{x.drawImage(k,0,0);x.globalCompositeOperation='source-atop';x.fillStyle='rgba(255,60,70,.65)';x.fillRect(0,0,32,32);});
let KEEP=keepArt('#58c96a','#3fa253'),KEEP_HIT=hitOf(KEEP);
const HERO_ROWS=["....rr....","...ssss...","..ssssss..","..skkkks..","..ssssss..",".bbssssbb.","bbbsssssbW","bbbsssss.W",".bbssss..W","..ss.ss...","..ss.ss...","..dd.dd..."];
const heroArt=it=>sprite(HERO_ROWS,{s:it.s,k:it.k,r:it.p,b:it.b,W:'#ffffff',d:it.d});
function buildMap(m){
  if(m.built)return m.built;
  const th=THEMES[m.theme],r=rng(m.seed),cl=(v,a,b)=>Math.max(a,Math.min(b,v));
  const occ=Array.from({length:ROWS},()=>new Array(COLS).fill(0));
  const raws=m.paths.map(raw=>raw.map(([x,y])=>[cl(x,0,COLS-1),cl(y,0,ROWS-1)]));
  const lastR=raws[0][raws[0].length-1],keep={tx:lastR[0],ty:lastR[1],cx:cl(lastR[0]*TILE+8,16,W-16),by:cl(lastR[1]*TILE+16,32,H)};
  const paths=raws.map(raw=>{
    for(let i=1;i<raw.length;i++){
      let[x,y]=raw[i-1];const[bx,by]=raw[i];const dx=Math.sign(bx-x),dy=Math.sign(by-y);
      for(;;){occ[y][x]=1;if(x===bx&&y===by)break;x+=dx;y+=dy;}
    }
    const pts=raw.map(([x,y])=>({x:x*TILE+8,y:y*TILE+8})),n=pts.length;
    if(pts[1].x!==pts[0].x)pts[0].x=cl(pts[0].x,10,W-10);else pts[0].y=cl(pts[0].y,10,H-10);
    if(pts[n-1].x!==pts[n-2].x)pts[n-1].x=keep.cx;else pts[n-1].y=keep.by-12;
    const cum=[0],dirs=[null];
    for(let i=1;i<n;i++){cum.push(cum[i-1]+Math.abs(pts[i].x-pts[i-1].x)+Math.abs(pts[i].y-pts[i-1].y));dirs.push({dx:Math.sign(pts[i].x-pts[i-1].x),dy:Math.sign(pts[i].y-pts[i-1].y)});}
    return{pts,cum,dirs,total:cum[n-1],entry:{tx:raw[0][0],ty:raw[0][1],x:pts[0].x,y:pts[0].y}};
  });
  for(let ty=0;ty<ROWS;ty++)for(let tx=0;tx<COLS;tx++){if(occ[ty][tx])continue;const x0=tx*TILE,y0=ty*TILE;
    if(x0<keep.cx+16&&x0+TILE>keep.cx-16&&y0<keep.by&&y0+TILE>keep.by-30)occ[ty][tx]=2;}
  const bg=document.createElement('canvas');bg.width=W;bg.height=H;const x=bg.getContext('2d');
  const isP=(tx,ty)=>!inB(tx,ty)||occ[ty][tx]===1;
  for(let ty=0;ty<ROWS;ty++)for(let tx=0;tx<COLS;tx++){
    const p=occ[ty][tx]===1,px=tx*TILE,py=ty*TILE;
    x.fillStyle=p?th.p:th.g;x.fillRect(px,py,TILE,TILE);
    for(let i=0;i<7;i++){x.fillStyle=p?th.p2:(r()<0.5?th.g2:th.g3);x.fillRect(px+(r()*TILE|0),py+(r()*TILE|0),r()<0.3?2:1,1);}
    if(!p&&r()<0.16){const fx=px+2+(r()*11|0),fy=py+2+(r()*11|0);x.fillStyle=th.f[r()*th.f.length|0];x.fillRect(fx,fy,1,1);x.fillRect(fx+1,fy+1,1,1);x.fillRect(fx-1,fy+1,1,1);}
    if(p){x.fillStyle=th.e;
      if(!isP(tx,ty-1))x.fillRect(px,py,TILE,1);if(!isP(tx,ty+1))x.fillRect(px,py+TILE-1,TILE,1);
      if(!isP(tx-1,ty))x.fillRect(px,py,1,TILE);if(!isP(tx+1,ty))x.fillRect(px+TILE-1,py,1,TILE);}
  }
  const dec=sprite(th.decor[0],th.decor[1]);
  for(let n=0,tries=0;n<12&&tries<300;tries++){
    const tx=r()*COLS|0,ty=r()*ROWS|0;if(occ[ty][tx])continue;
    occ[ty][tx]=2;x.drawImage(dec,tx*TILE,ty*TILE);n++;
  }
  const vig=document.createElement('canvas');vig.width=W;vig.height=H;const vx=vig.getContext('2d'),dk=th.dark||0;
  if(dk){vx.fillStyle='rgba(8,6,24,'+dk+')';vx.fillRect(0,0,W,H);}
  const gr=vx.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,W*0.62);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,'+(0.28+dk*0.5)+')');vx.fillStyle=gr;vx.fillRect(0,0,W,H);
  return m.built={occ,bg,paths,keep,vig};
}
function posAt(P,d){
  if(d<=0)return{x:P.pts[0].x,y:P.pts[0].y,i:1};
  for(let i=1;i<P.pts.length;i++)if(d<=P.cum[i]){const a=P.pts[i-1],b=P.pts[i],f=(d-P.cum[i-1])/(P.cum[i]-P.cum[i-1]);return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,i};}
  const l=P.pts[P.pts.length-1];return{x:l.x,y:l.y,i:P.pts.length-1};
}
const GROW=1.13,WSC=[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],WHP=[1.18,1.92,2.53,1.86,3.19,2.69,4.28,4.09,5.49,6.45,8.29,6.48,11.22,11.03,14.33,14.48,22.29,15.11,31.54,20.72];
const DIFFS=[{name:'Normal',hp:1.05,grow:1,spd:1,gems:1,gold:1,lives:1},{name:'Hard',hp:1.4,grow:1.008,spd:1.05,gems:2,gold:1,lives:1},{name:'Nightmare',hp:1.68,grow:1.013,spd:1.1,gems:3,gold:1,lives:0.5,mut:1,mp:0.4}];
const MUTS=[{name:'Swift',spd:1.4},{name:'Armored',armor:4},{name:'Shielded',shield:3},{name:'Horde',count:1.6},{name:'Regenerating',regen:0.025},{name:'Giant',hp:1.9,count:0.6}];
function mutators(w){
  const n=Math.min(3,(w>MAXWAVE?1+Math.floor((w-MAXWAVE-1)/8):0)+(G&&G.D.mut&&w>=6?1:0)),out=[];
  for(let i=0;i<n;i++){const m=MUTS[(w*7+i*5+3)%MUTS.length];if(!out.includes(m))out.push(m);}
  return out;
}
function waveMul(w){const g=G?G.D.grow:1;if(w<=MAXWAVE)return WHP[w-1]*Math.pow(g,w-1);const k=w-MAXWAVE;return WHP[isBossWave(w)||w%2===0?19:18]*Math.pow(g,MAXWAVE-1)*Math.pow(TUNE.endGrow,k)*(1+TUNE.endLin*k);}
const isBossWave=n=>n%10===0||(n>MAXWAVE&&n%5===0);
function buildWave(n){
  const g=[];
  if(isBossWave(n)){
    const k=Math.floor(n/10);
    if(k>=2)g.push(['lich',k-1,8]);
    g.push(['boss',k>=2?k-1:1,5]);
    g.push(['knight',4+(n>>1),1]);g.push(['bat',n>>1,0.5]);if(n>=20)g.push(['shaman',3,3]);if(n>MAXWAVE)g.push(['ghost',n>>2,0.8]);
  }else{
    g.push(['slime',Math.min(6+n,18),0.8]);
    if(n>=2&&n%3===2)g.push(['imp',4+n,0.35]);
    if(n>=3&&(n%3===0||n>6))g.push(['bat',2+(n>>1),0.6]);
    if(n>=4&&n%2===0)g.push(['blob',1+(n>>2),1.8]);
    if(n>=5&&n%2===1)g.push(['knight',1+(n>>1),1.1]);
    if(n>=6&&n%3===0)g.push(['beetle',1+(n>>2),1.6]);
    if(n>=7&&n%4===3)g.push(['swarm',10+n,0.25]);
    if(n>=8)g.push(['golem',n>>2,2.2]);
    if(n>=9&&n%3===0)g.push(['shaman',1+(n/6|0),2.5]);
    if(n>=11&&n%2===1)g.push(['hexer',1+(n>>3),3]);
    if(n>=12&&n%2===0)g.push(['ghost',3+(n>>2),0.9]);
  }
  let cm=n>MAXWAVE?Math.min(3,1+0.06*(n-MAXWAVE)):WSC[n-1];for(const m of mutators(n))cm*=m.count||1;
  if(cm!==1)for(const e of g){if(ENEMIES[e[0]].boss)continue;e[1]=Math.max(1,Math.round(e[1]*cm));e[2]=e[2]/Math.sqrt(Math.max(1,cm));}
  const q=[];let start=0;
  for(const[type,count,gap]of g){for(let i=0;i<count;i++)q.push({t:start+i*gap,type});start+=count*gap*0.6;}
  q.sort((a,b)=>a.t-b.t);return{q,g};
}
let lastShot=0,RT=0;
function sfx(k){
  if(k==='shot'||k==='zap'||k==='snipe'||k==='pop'){const n=performance.now();if(n-lastShot<50)return;lastShot=n;}
  if(k==='shot')tone(520,0.05,'square',0.015,-200);
  else if(k==='zap')tone(900,0.08,'sawtooth',0.02,-500);
  else if(k==='snipe')tone(240,0.12,'square',0.03,-150);
  else if(k==='boom')tone(110,0.18,'sawtooth',0.04,-60);
  else if(k==='pop')tone(300,0.06,'triangle',0.03,200);
  else if(k==='leak')tone(120,0.25,'sawtooth',0.05,-60);
  else if(k==='build')tone(440,0.08,'square',0.03,220);
  else if(k==='up'){tone(523,0.08,'square',0.03);setTimeout(()=>tone(784,0.12,'square',0.03),80);}
  else if(k==='wave')tone(330,0.2,'square',0.03,330);
  else if(k==='win'){tone(523,0.15,'square',0.04);setTimeout(()=>tone(784,0.3,'square',0.04),150);}
  else if(k==='lose')tone(200,0.6,'sawtooth',0.05,-150);
}
let uid=0;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');}
function newGame(mi,diff,mode){
  diff=diff|0;const DF=DIFFS[diff],map=MAPS[mi],b=buildMap(map),lives=Math.max(5,Math.round((20+5*perk('lives'))*DF.lives)),hp=posAt(b.paths[0],b.paths[0].total-46);
  const fl=cosItem('flag',D.eq.flag);KEEP=keepArt(fl.c,fl.c2);KEEP_HIT=hitOf(KEEP);SPR.hero=heroArt(cosItem('hero',D.eq.hero));
  G={mi,map,diff,D:DF,mode,score:0,won:false,stars:0,bossK:0,lastLeak:'',st:blankStats(),newAch:[],newMis:[],cleared:0,lastStart:0,tips:{},kills:0,leaks:0,built:0,spell:{done:0,kills:0},occ:b.occ.map(r=>r.slice()),bg:b.bg,vig:b.vig,paths:b.paths,keep:b.keep,towers:[],enemies:[],shots:[],fx:[],parts:[],texts:[],queue:[],
    gold:Math.round(map.gold*DF.gold)+40*perk('gold'),lives,maxLives:lives,wave:0,active:false,waveT:0,spawned:0,speed:1,paused:false,auto:false,autoT:0,
    placing:null,sel:null,hover:null,aim:null,cd:{meteor:0,freeze:0},flash:0,keepHit:0,time:0,over:false,endless:false,shake:0,
    hero:{x:hp.x,y:hp.y,tx:hp.x,ty:hp.y,lvl:1,xp:0,cd:0,swing:0,face:-1,done:0,kills:0},heroSel:false};
  for(const k in cache)delete cache[k];$('btnSpeed').textContent='1x';$('btnAuto').textContent='Auto: off';$('btnAuto').classList.remove('on');
  const L=$('labels');L.innerHTML='';L.classList.remove('hide');
  const place=(cls,text,x,top,bottom)=>{const d=document.createElement('div');d.className='lbl '+cls;d.textContent=text;
    const px=x/W*100,above=top/H>0.12;let tf=above?'translateY(-100%)':'';
    d.style.top=((above?top:bottom)/H*100)+'%';
    if(px<25)d.style.left='1%';else if(px>75)d.style.right='1%';else{d.style.left=px+'%';tf+=' translateX(-50%)';}
    d.style.transform=tf;L.appendChild(d);};
  G.paths.forEach(P=>place('in','Enemies come out here',P.entry.x,P.entry.y-14,P.entry.y+14));
  place('out','Defend your castle',G.keep.cx,G.keep.by-36,G.keep.by+4);
  refreshBar();renderInfo();if(diff)toast(DF.name+': tougher monsters, '+DF.gems+'x points and coins');
}
const heroDmg=h=>TUNE.heroBase*Math.pow(TUNE.heroGrow,h.lvl-1)*(1+0.08*perk('dmg'));
function heroAct(dt){
  const h=G.hero,dx=h.tx-h.x,dy=h.ty-h.y,dd=Math.hypot(dx,dy);
  if(dd>1){const mv=Math.min(dd,48*dt);h.x+=dx/dd*mv;h.y+=dy/dd*mv;if(Math.abs(dx)>1)h.face=dx>0?1:-1;}
  h.cd-=dt;if(h.swing>0)h.swing-=dt;if(h.cd>0)return;
  let best=null,bd=22*22;for(const e of G.enemies){if(e.dead)continue;const q=(e.x-h.x)**2+(e.y-h.y)**2;if(q<bd){bd=q;best=e;}}
  if(!best){h.cd=0;return;}
  h.cd=TUNE.heroRate+Math.max(h.cd,-0.06);h.swing=0.15;h.face=best.x>=h.x?1:-1;const d=heroDmg(h);hurt(best,d,0,h);
  G.texts.push({x:best.x-4,y:best.y-12,s:String(Math.round(d)),c:'#ffffff',life:0.5});
  if(best.dead&&h.lvl<20){h.xp++;if(h.xp>=5+4*h.lvl){h.xp=0;h.lvl++;toast('Your knight reached level '+h.lvl+'!');burst(h.x,h.y,'#ffd24a',12);sfx('up');if(G.heroSel)renderInfo();}}
}
const TUNE={slow:[0.6,0.52,0.45,0.4],stunImm:1.6,LM:[1,1.7,2.8,3.6],upC:[0.9,1.5,2.5],ocCost:3,ocGrow:1.4,ocPow:0.12,heroBase:14,heroGrow:1.13,heroRate:0.6,meteorDmg:75,meteorCd:50,freezeCd:75,freezeDur:3,waveGold:15,endGrow:1.1,endLin:0.03};
const LM=TUNE.LM;
function tstat(t,lvl){
  const b=TOWERS[t.type],l=lvl==null?t.lvl:lvl,sp=(l>=3&&t.spec!=null)?b.specs[t.spec]:{},pd=(1+0.08*perk('dmg'))*(1+TUNE.ocPow*(t.oc||0));
  return{dmg:b.dmg*LM[l]*(sp.dmg||1)*pd,range:b.range*[1,1.1,1.2,1.25][l]*(sp.range||1)*(1+0.05*perk('range')),rate:(b.rate||0)*[1,0.9,0.8,0.75][l]*(sp.rate||1),
    splash:(b.splash||0)*[1,1.15,1.3,1.4][l]*(sp.splash||1)+(sp.splashAdd||0),slow:b.slow?TUNE.slow[l]*(sp.slowMul||1):0,
    chain:b.chain?b.chain+l+(sp.chainAdd||0):0,multi:sp.multi||1,stun:sp.stun||0,
    dot:(b.dot||0)*LM[l]*(sp.dot||1)*pd+(sp.burn||0)*pd,dotDur:b.dotDur||3,
    income:b.income?Math.round(b.income*[1,1.6,2.4,3][l]*(sp.income||1)*(1+TUNE.ocPow*(t.oc||0))):0,interest:sp.interest||0,ramp:(b.ramp||0)*(sp.ramp||1)};
}
const upCost=t=>t.lvl>=3?(G.endless?Math.round(TOWERS[t.type].cost*TUNE.ocCost*Math.pow(TUNE.ocGrow,t.oc||0)):null):Math.round(TOWERS[t.type].cost*TUNE.upC[t.lvl]);
const sellVal=t=>t.fresh&&!G.active?t.spent:Math.floor(t.spent*Math.min(1,0.7+0.1*perk('sell')));
const towerAt=(tx,ty)=>G.towers.find(t=>t.x===tx&&t.y===ty);
const canBuild=(tx,ty)=>inB(tx,ty)&&G.occ[ty][tx]===0;
function build(type,tx,ty){
  const b=TOWERS[type];if(!isUnl(type)||!canBuild(tx,ty)||G.gold<b.cost)return false;
  G.gold-=b.cost;G.occ[ty][tx]=3;G.towers.push({type,x:tx,y:ty,lvl:0,spec:null,cd:0,spent:b.cost,mode:type==='sniper'?'strong':'first',flash:0,ramp:0,lock:null,beam:null,dis:0,oc:0,done:0,kills:0,fresh:!G.active});G.built++;
  G.towers.sort((a,c)=>a.y-c.y);sfx('build');burst(tx*TILE+8,ty*TILE+12,'#c9c7d6',6);return true;
}
function upgrade(t,spec){
  const c=upCost(t);if(c==null||G.gold<c)return false;
  if(t.lvl>=3)t.oc=(t.oc||0)+1;
  else{if(t.lvl===2){if(spec!==0&&spec!==1)return false;t.spec=spec;}t.lvl++;}
  G.gold-=c;t.spent+=c;sfx('up');burst(t.x*TILE+8,t.y*TILE+6,'#ffd24a',10);return true;
}
function sell(t){G.gold+=sellVal(t);G.occ[t.y][t.x]=0;G.towers=G.towers.filter(o=>o!==t);if(G.sel===t)G.sel=null;sfx('pop');}
const big=v=>v>=1e6?(v/1e6).toFixed(1)+'m':v>=1e3?(v/1e3).toFixed(1)+'k':String(Math.round(v));
function burst(x,y,c,n){for(let i=0;i<n;i++)G.parts.push({x,y,vx:(Math.random()-0.5)*60,vy:(Math.random()-0.8)*60,life:0.3+Math.random()*0.2,c,g:140});}
const canRush=()=>G.active&&(G.endless||G.wave<MAXWAVE)&&G.time-G.lastStart>3;
function startWave(){
  if(!G||G.over||(G.active&&!canRush()))return;
  const rush=G.active;G.wave++;G.lastStart=G.time;
  const bw=buildWave(G.wave),q=bw.q.map(o=>({t:o.t+(rush?G.waveT:0),type:o.type,w:G.wave}));
  if(rush){const bonus=8+2*G.wave;G.gold+=bonus;G.queue=G.queue.concat(q).sort((a,b)=>a.t-b.t);toast('Wave '+G.wave+' called early: +'+bonus+' gold');}
  else{G.queue=q;G.waveT=0;G.active=true;
    const mu=mutators(G.wave).map(m=>m.name).join(' + '),has=k=>bw.g.some(e=>e[0]===k);
    if(has('ghost')&&!G.tips.ghost){G.tips.ghost=1;toast('Ghosts shrug off arrows and shells. Use magic towers, your knight or the meteor.');}
    else if(has('hexer')&&!G.tips.hexer){G.tips.hexer=1;toast('Hexers put nearby towers to sleep. Kill them fast.');}
    else if(has('beetle')&&!G.tips.beetle){G.tips.beetle=1;toast('Beetles block the first few hits. Fast towers break their shields.');}
    else toast('Wave '+G.wave+(isBossWave(G.wave)?': BOSS!':'')+(mu?' ('+mu+')':''));}
  for(const t of G.towers)t.fresh=false;
  sfx('wave');$('labels').classList.add('hide');renderInfo();
}
function spawn(type,d0,P,w){
  w=w||G.wave;const b=ENEMIES[type],D=G.D,mu=b.boss?[]:mutators(w);let hpM=1,spM=1,ar=0,sh=0,rg=0;
  for(const m of mu){hpM*=m.hp||1;spM*=m.spd||1;ar+=m.armor||0;sh+=m.shield||0;rg+=m.regen||0;}
  const hp=Math.round(b.hp*Math.pow(G.map.hp,D.mp||1)*D.hp*hpM*waveMul(w)),spd=b.speed*D.spd*spM*(w>MAXWAVE?Math.min(1.8,1+0.02*(w-MAXWAVE)):1);
  if(!P){P=G.paths[b.boss?0:G.spawned%G.paths.length];G.spawned++;}
  const p=posAt(P,d0||0);
  G.enemies.push({id:uid++,type,P,w,hp,max:hp,speed:spd,gold:b.gold,armor:b.armor+ar,lives:b.lives,scale:b.scale||1,d:d0||0,x:p.x,y:p.y,
    shield:(b.shield?b.shield+(w/6|0):0)+sh,regen:rg,hexT:2,sumT:3,slowT:0,slowF:1,stunT:0,stunImm:0,dot:0,dotT:0,healT:1.5,hitT:0,dead:false});
}
function kill(e,src){
  if(e.dead)return;e.dead=true;G.kills++;if(src)src.kills=(src.kills||0)+1;
  const b=ENEMIES[e.type],g=Math.round(e.gold*(1+0.1*perk('bounty')));G.gold+=g;G.score+=e.gold*5*G.D.gems;
  G.texts.push({x:e.x-4,y:e.y-8,s:'+'+g,c:'#ffd24a',life:0.7});
  burst(e.x,e.y,b.c,6*e.scale);sfx('pop');
  if(b.boss){G.bossK++;G.shake=0.5;burst(e.x,e.y,'#ffd24a',30);G.fx.push({k:'boom',x:e.x,y:e.y,r:26,t:0.45,T:0.45});sfx('boom');toast((e.type==='lich'?'Lich':'Demon')+' slain!');}
  if(b.split)for(let i=0;i<b.split;i++)spawn('slime',Math.max(0,e.d-i*7),e.P,e.w);
}
function hurt(e,d,phys,src){
  if(e.dead)return;
  if(phys&&ENEMIES[e.type].ghost)d*=0.4;
  if(e.shield>0){e.shield--;e.hitT=0.08;G.parts.push({x:e.x,y:e.y-4,vx:(Math.random()-0.5)*40,vy:-30,life:0.25,c:'#8ff0e6',g:140});return;}
  const a=Math.min(e.hp,Math.max(1,d-e.armor));e.hp-=a;if(src)src.done=(src.done||0)+a;e.hitT=0.08;if(e.hp<=0)kill(e,src);
}
function stun(e,d){if(e.stunImm>0)return;if(ENEMIES[e.type].boss)d/=2;e.stunT=Math.max(e.stunT,d);e.stunImm=d+TUNE.stunImm;}
function burn(e,d,src){if(e.dead)return;const a=Math.min(e.hp,d);e.hp-=a;if(src)src.done=(src.done||0)+a;if(e.hp<=0)kill(e,src);}
function pickTargets(t,s,n){
  const cx=t.x*TILE+8,cy=t.y*TILE+8,r2=s.range*s.range,m=TOWERS[t.type].minRange||0,m2=m*m,list=[];
  for(const e of G.enemies){if(e.dead)continue;const q=(e.x-cx)**2+(e.y-cy)**2;if(q>r2||q<m2)continue;
    list.push({e,v:t.mode==='first'?e.d/e.P.total:t.mode==='strong'?e.hp:-q});}
  if(t.type==='poison'){const fresh=list.filter(o=>o.e.dotT<=0.5);if(fresh.length)list.length=0,list.push(...fresh);}
  list.sort((a,b)=>b.v-a.v);
  return(n?list.slice(0,n):list).map(o=>o.e);
}
function towerAct(t,dt){
  const b=TOWERS[t.type];if(b.income)return;
  if(t.dis>0){t.dis-=dt;t.beam=null;return;}
  if(t.flash>0)t.flash-=dt;
  const s=tstat(t),ox=t.x*TILE+8,oy=t.y*TILE+4;
  if(t.type==='laser'){
    const tg=pickTargets(t,s,s.multi);
    if(!tg.length){t.ramp=0;t.lock=null;t.beam=null;return;}
    if(tg[0]!==t.lock){t.lock=tg[0];t.ramp*=0.5;}
    t.ramp=Math.min(1,t.ramp+dt/2.5);t.beam=tg;
    const dps=s.dmg*(1+t.ramp*s.ramp);for(const e of tg)burn(e,dps*dt,t);return;
  }
  if(t.type==='flame'){
    const tg=pickTargets(t,s,0);t.beam=tg.length?tg:null;if(!tg.length)return;
    for(const e of tg){if(s.dot){e.dot=Math.max(e.dot,s.dot);e.dotT=s.dotDur;e.dotSrc=t;}burn(e,s.dmg*dt,t);}
    const e=tg[Math.random()*tg.length|0],dx=e.x-ox,dy=e.y-oy,d=Math.hypot(dx,dy)||1;
    G.parts.push({x:ox,y:oy,vx:dx/d*110+(Math.random()-0.5)*40,vy:dy/d*110+(Math.random()-0.5)*40,life:Math.min(0.35,d/110+0.05),c:Math.random()<0.5?'#ff7a2f':'#ffd24a',g:0});
    return;
  }
  t.cd-=dt;if(t.cd>0)return;
  const tg=pickTargets(t,s,t.type==='mortar'?1:s.multi);
  if(!tg.length){t.cd=0;return;}
  t.cd=s.rate+Math.max(t.cd,-0.06);t.flash=0.1;
  if(t.type==='tesla'){
    const pts=[{x:ox,y:oy}],hit=new Set();let cur=tg[0],d=s.dmg;
    for(let i=0;i<=s.chain&&cur;i++){
      hit.add(cur);pts.push({x:cur.x,y:cur.y});const cx=cur.x,cy=cur.y;hurt(cur,d,0,t);d*=0.85;
      let best=null,bd=34*34;for(const e of G.enemies){if(e.dead||hit.has(e))continue;const q=(e.x-cx)**2+(e.y-cy)**2;if(q<bd){bd=q;best=e;}}
      cur=best;}
    G.fx.push({k:'bolt',pts,t:0.12});sfx('zap');
  }else if(t.type==='sniper'){
    G.fx.push({k:'line',pts:[{x:ox,y:oy},{x:tg[0].x,y:tg[0].y}],t:0.1});G.texts.push({x:tg[0].x-4,y:tg[0].y-12,s:String(Math.round(s.dmg)),c:'#ffffff',life:0.5});hurt(tg[0],s.dmg,1,t);sfx('snipe');
  }else if(t.type==='mortar'){
    const e=tg[0];
    for(let i=0;i<s.multi;i++){
      const fl=Math.hypot(e.x-ox,e.y-oy)/b.pspd,p=posAt(e.P,Math.min(e.P.total,e.d+(e.stunT>0?0:e.speed*e.slowF*fl)));
      const tx=p.x+(i?(Math.random()-0.5)*26:0),ty=p.y+(i?(Math.random()-0.5)*26:0);
      G.shots.push({k:'mortar',x:ox,y:oy,tx,ty,tg:null,spd:b.pspd,total:Math.hypot(tx-ox,ty-oy)||1,dmg:s.dmg,splash:s.splash,phys:1,src:t});
    }
    sfx('snipe');
  }else{
    for(const e of tg)G.shots.push({k:t.type,x:ox,y:oy,tx:e.x,ty:e.y,tg:e,spd:b.pspd,dmg:s.dmg,splash:s.splash,slow:s.slow,stun:s.stun,dot:s.dot,dotDur:s.dotDur,phys:b.phys,src:t});
    sfx('shot');
  }
}
function impact(s){
  const hit=e=>{
    if(s.slow){const f=ENEMIES[e.type].boss?1-(1-s.slow)/2:s.slow;e.slowF=Math.min(e.slowT>0?e.slowF:1,f);e.slowT=1.8;}
    if(s.stun)stun(e,s.stun);
    if(s.dot){e.dot=Math.max(e.dot,s.dot);e.dotT=s.dotDur;e.dotSrc=s.src;}
    hurt(e,s.dmg,s.phys,s.src);};
  if(s.splash){
    const r2=s.splash*s.splash;
    for(const e of G.enemies){if(!e.dead&&(e.x-s.tx)**2+(e.y-s.ty)**2<=r2)hit(e);}
    const c=s.k==='frost'?'#8fdcff':s.k==='poison'?'#9be35a':'#ffb347';
    G.fx.push({k:'ring',x:s.tx,y:s.ty,r:s.splash,t:0.18,c});
    if(s.k==='cannon'||s.k==='mortar'){G.fx.push({k:'boom',x:s.tx,y:s.ty,r:s.splash,t:0.3,T:0.3});burst(s.tx,s.ty,'#ffb347',s.k==='mortar'?12:6);sfx('boom');if(s.k==='mortar')G.shake=Math.max(G.shake,0.1);}
  }else if(s.tg&&!s.tg.dead)hit(s.tg);
}
function endWave(){
  G.active=false;const n=Math.max(1,G.wave-G.cleared),DF=G.D;let inc=0;
  for(let w=G.cleared+1;w<=G.wave;w++){inc+=TUNE.waveGold+Math.min(w,30);G.score+=50*w*DF.gems;}
  G.cleared=G.wave;
  for(const t of G.towers){const s=tstat(t);if(!s.income)continue;
    const v=(s.income+Math.min(80,Math.floor(G.gold*s.interest)))*n;inc+=v;G.texts.push({x:t.x*TILE+2,y:t.y*TILE-4,s:'+'+v,c:'#ffd24a',life:1.2});}
  G.gold+=inc;
  if(G.wave>=MAXWAVE&&!G.won){
    // the map is won; the siege carries on in endless mode until the keep falls or the player banks the score
    G.stars=G.lives>=G.maxLives*0.9?3:G.lives>=G.maxLives*0.5?2:1;G.won=true;G.endless=true;G.score+=(2000+50*G.lives)*DF.gems;sfx('win');
    toast('Victory! '+'\u2605'.repeat(G.stars)+' Endless waves begin. Bank your score whenever you like.');
  }
  G.autoT=1.5;renderInfo();
}
function lose(){G.over=true;G.lives=0;sfx('lose');finish(G.lastLeak||'lives');}
function step(dt){
  G.time+=dt;if(G.shake>0)G.shake-=dt;if(G.flash>0)G.flash-=dt;if(G.keepHit>0)G.keepHit-=dt;
  for(const k in G.cd)if(G.cd[k]>0)G.cd[k]-=dt;
  if(G.active){G.waveT+=dt;while(G.queue.length&&G.queue[0].t<=G.waveT){const o=G.queue.shift();spawn(o.type,0,null,o.w);}}
  for(const e of G.enemies){
    if(e.dead)continue;
    if(e.dotT>0){e.dotT-=dt;burn(e,e.dot*dt,e.dotSrc);if(e.dead)continue;if(e.dotT<=0)e.dot=0;}
    if(e.slowT>0){e.slowT-=dt;if(e.slowT<=0)e.slowF=1;}
    if(e.hitT>0)e.hitT-=dt;
    if(ENEMIES[e.type].heal){e.healT-=dt;if(e.healT<=0){e.healT=1.6;let any=false;
      for(const o of G.enemies){if(o===e||o.dead||o.hp>=o.max)continue;if((o.x-e.x)**2+(o.y-e.y)**2<34*34){o.hp=Math.min(o.max,o.hp+o.max*(ENEMIES[o.type].boss?0.01:0.06));any=true;}}
      if(any)G.fx.push({k:'ring',x:e.x,y:e.y,r:34,t:0.18,c:'#6fe0c4'});}}
    if(e.regen&&e.hp<e.max)e.hp=Math.min(e.max,e.hp+e.max*e.regen*dt);
    if(ENEMIES[e.type].hex){e.hexT-=dt;if(e.hexT<=0){e.hexT=4.5;let bt=null,bd=46*46;
      for(const t of G.towers){if(t.dis>0||TOWERS[t.type].income)continue;const q=(t.x*TILE+8-e.x)**2+(t.y*TILE+8-e.y)**2;if(q<bd){bd=q;bt=t;}}
      if(bt){bt.dis=2.5;G.fx.push({k:'bolt',pts:[{x:e.x,y:e.y-4},{x:bt.x*TILE+8,y:bt.y*TILE+6}],t:0.2});G.fx.push({k:'ring',x:bt.x*TILE+8,y:bt.y*TILE+8,r:10,t:0.18,c:'#b46fff'});}}}
    if(ENEMIES[e.type].summon){e.sumT-=dt;if(e.sumT<=0){e.sumT=3.5;for(let i=0;i<2;i++)spawn('swarm',Math.max(0,e.d-8-i*6),e.P,e.w);G.fx.push({k:'ring',x:e.x,y:e.y,r:16,t:0.18,c:'#b46fff'});}}
    if(e.stunImm>0)e.stunImm-=dt;
    if(e.stunT>0){e.stunT-=dt;continue;}
    e.d+=e.speed*e.slowF*dt;
    if(e.d>=e.P.total){e.dead=true;G.lives-=e.lives;G.leaks++;G.lastLeak=e.type;G.shake=Math.max(G.shake,0.25);G.keepHit=0.35;burst(G.keep.cx,G.keep.by-8,'#ff5d6c',8);sfx('leak');}
    else{const p=posAt(e.P,e.d);e.x=p.x;e.y=p.y;}
  }
  for(const t of G.towers)towerAct(t,dt);
  heroAct(dt);
  for(const s of G.shots){
    if(s.tg&&!s.tg.dead){s.tx=s.tg.x;s.ty=s.tg.y;}
    const dx=s.tx-s.x,dy=s.ty-s.y,dist=Math.hypot(dx,dy),mv=s.spd*dt;
    if(dist<=mv+1){s.done=true;impact(s);}else{s.x+=dx/dist*mv;s.y+=dy/dist*mv;}
  }
  G.shots=G.shots.filter(s=>!s.done);
  G.enemies=G.enemies.filter(e=>!e.dead);
  for(const f of G.fx){f.t-=dt;if(f.k==='meteor'&&f.t<=0&&!f.hit){f.hit=true;meteorHit(f);}}G.fx=G.fx.filter(f=>f.t>0);
  for(const p of G.parts){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.g*dt;}G.parts=G.parts.filter(p=>p.life>0);
  for(const p of G.texts){p.life-=dt;p.y-=12*dt;}G.texts=G.texts.filter(p=>p.life>0);
  if(G.lives<=0&&!G.over){lose();return;}
  if(G.active&&!G.queue.length&&!G.enemies.length)endWave();
  else if(!G.active&&G.auto&&!G.over){G.autoT-=dt;if(G.autoT<=0)startWave();}
}
const WX={meadow:{n:14,vx:6,vy:2,c:'#fff7b0',a:0.5},desert:{n:22,vx:70,vy:4,c:'#f1dca7',a:0.3,w:3},frost:{n:44,vx:-8,vy:22,c:'#ffffff',a:0.8},
  swamp:{n:16,vx:3,vy:-2,c:'#c8ff7a',a:0.9,blink:1,glow:1},lava:{n:26,vx:2,vy:-18,c:'#ff9a3c',a:0.9,glow:1},crystal:{n:22,vx:0.5,vy:-4,c:'#aeeaff',a:0.9,blink:1,glow:1}};
function draw(){
  ctx.imageSmoothingEnabled=false;
  if(!G){ctx.fillStyle='#17131f';ctx.fillRect(0,0,W,H);return;}
  const glows=[];
  ctx.save();
  if(G.shake>0&&!G.paused)ctx.translate(Math.round((Math.random()-0.5)*4),Math.round((Math.random()-0.5)*4));
  ctx.drawImage(G.bg,0,0);
  if(!G.active&&!G.over){
    const a=G.wave===0?0.95:0.5,off=(G.time*28)%18;
    ctx.fillStyle='rgba(255,70,80,'+a+')';
    for(const P of G.paths)for(let d=14+off;d<P.total-14;d+=18){
      const p=posAt(P,d),dr=P.dirs[p.i],x=Math.round(p.x),y=Math.round(p.y);
      for(let i=-2;i<=2;i++){const k=2-Math.abs(i);ctx.fillRect(x+dr.dx*k-dr.dy*i-(dr.dx>0?1:0),y+dr.dy*k+dr.dx*i-(dr.dy>0?1:0),2,2);}
    }
    if(G.wave===0&&G.time%0.8<0.5){ctx.lineWidth=1;ctx.strokeStyle='#ff4650';for(const P of G.paths)ctx.strokeRect(Math.round(P.entry.x)-11.5,Math.round(P.entry.y)-11.5,23,23);
      ctx.strokeStyle='#6fe08a';ctx.strokeRect(G.keep.cx-17.5,G.keep.by-33.5,35,35);}
  }
  for(const P of G.paths){
    const cx=P.entry.x,cy=P.entry.y;ctx.drawImage(PORTAL,Math.round(cx-10),Math.round(cy-10));
    for(let k=0;k<8;k++){const a=G.time*3+k*0.9,rr=0.8+k*0.8;ctx.fillStyle=k%2?'#b46fff':'#ffffff';ctx.fillRect(Math.round(cx+Math.cos(a)*rr-0.5),Math.round(cy+Math.sin(a)*rr-0.5),1,1);}
    glows.push([cx,cy,18,'#7a3fd0',0.1]);
  }
  const showRange=(cx,cy,r,ok,mr)=>{ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);if(mr)ctx.arc(cx,cy,mr,0,Math.PI*2,true);ctx.fillStyle=ok?'rgba(255,255,255,.14)':'rgba(255,80,80,.18)';ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle=ok?'rgba(255,255,255,.6)':'rgba(255,80,80,.7)';ctx.lineWidth=1;ctx.stroke();};
  if(G.sel&&TOWERS[G.sel.type].range){const s=tstat(G.sel);showRange(G.sel.x*TILE+8,G.sel.y*TILE+8,s.range,true,TOWERS[G.sel.type].minRange);}
  if(G.placing&&G.hover){const{tx,ty}=G.hover,b=TOWERS[G.placing],ok=canBuild(tx,ty)&&G.gold>=b.cost;
    if(b.range)showRange(tx*TILE+8,ty*TILE+8,b.range*(1+0.05*perk('range')),ok,b.minRange);
    else{ctx.fillStyle=ok?'rgba(255,255,255,.2)':'rgba(255,80,80,.3)';ctx.fillRect(tx*TILE,ty*TILE,TILE,TILE);}
    ctx.globalAlpha=0.7;ctx.drawImage(SPR[G.placing],tx*TILE,ty*TILE);ctx.globalAlpha=1;}
  if(G.aim&&G.hover){ctx.beginPath();ctx.arc(G.hover.px,G.hover.py,30,0,Math.PI*2);ctx.fillStyle='rgba(255,122,47,.25)';ctx.fill();ctx.strokeStyle='#ff7a2f';ctx.lineWidth=1;ctx.stroke();}
  for(const t of G.towers){
    const px=t.x*TILE,py=t.y*TILE+(t.flash>0?1:0),ty=t.y*TILE;
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(px+1,ty+15,14,2);
    ctx.drawImage(SPR[t.type],px,py);
    if(t.type==='flame'){for(let i=0;i<3;i++){ctx.fillStyle=Math.random()<0.5?'#ffd24a':'#ff7a2f';ctx.fillRect(px+6+(Math.random()*4|0),py+(Math.random()*4|0),1,1);}glows.push([px+8,ty+5,13+Math.random()*3,'#ff7a2f',t.beam?0.14:0.08]);}
    else if(t.type==='tesla'){if(Math.random()<0.3){ctx.fillStyle='#ffffff';ctx.fillRect(px+4+(Math.random()*8|0),py+(Math.random()*6|0),1,1);}glows.push([px+8,ty+3,t.flash>0?16:8,'#ffe066',t.flash>0?0.16:0.07]);}
    else if(t.type==='frost'){if(Math.sin(G.time*3+t.x*2)>0.7){ctx.fillStyle='#ffffff';ctx.fillRect(px+6+(t.y%4),py+2+(t.x%4),1,1);}glows.push([px+8,ty+5,9,'#8fdcff',0.06]);}
    else if(t.type==='mine'){if((G.time*1.5+t.x)%3<0.25){ctx.fillStyle='#ffffff';ctx.fillRect(px+6,py+9,1,1);ctx.fillRect(px+5,py+10,3,1);}}
    else if(t.type==='laser'){if(t.beam){ctx.fillStyle='#ffffff';ctx.fillRect(px+7,py+2,2,2);}glows.push([px+8,ty+3,t.beam?11:6,'#ff5d6c',t.beam?0.14:0.07]);}
    else if(t.type==='poison'){const k=(G.time*5+t.x*3)%6|0;ctx.fillStyle='#c8ff7a';ctx.fillRect(px+6+(k%3),py+3-k,1,1);}
    if(t.dis>0){ctx.fillStyle='rgba(40,10,60,.6)';ctx.fillRect(px+2,py+1,12,14);const z=G.time*4%3|0;ctx.fillStyle='#b46fff';ctx.fillRect(px+7+z,py-1-z,2,1);ctx.fillRect(px+8+z,py-z,1,1);}
    if(t.lvl>=3){ctx.fillStyle=t.spec?'#6fd3ff':'#ff9a3c';ctx.fillRect(px+6,ty+12,4,3);ctx.fillStyle='#fff';ctx.fillRect(px+7,ty+13,2,1);}
    else{ctx.fillStyle='#ffd24a';for(let i=0;i<t.lvl;i++)ctx.fillRect(px+5+i*4,ty+13,2,2);}
    const c=upCost(t);
    if(c!=null&&G.gold>=c&&G.time%1<0.6){ctx.fillStyle='#103a1c';ctx.fillRect(px+10,py-1,6,6);ctx.fillStyle='#6fe08a';ctx.fillRect(px+12,py,2,4);ctx.fillRect(px+11,py+1,4,1);}
    if(G.sel===t){ctx.strokeStyle='#ffd24a';ctx.lineWidth=1;ctx.strokeRect(px+0.5,ty+0.5,TILE-1,TILE-1);}
  }
  const es=G.enemies.slice().sort((a,b)=>a.y-b.y);
  for(const e of es){
    const sp=SPR[e.type],w=sp.sw*e.scale,h=sp.sh*e.scale,fly=e.type==='bat',bob=e.stunT>0?0:fly?Math.round(Math.sin(G.time*10+e.id)*2)-3:Math.round(Math.sin(G.time*8+e.id));
    const px=Math.round(e.x-w/2),py=Math.round(e.y-h/2+bob),fade=Math.min(1,0.2+e.d/14);
    ctx.fillStyle='rgba(0,0,0,'+(0.28*fade)+')';ctx.fillRect(px+1,Math.round(e.y+h/2)+(fly?1:-1),w-2,2);
    ctx.globalAlpha=fade*(e.hitT>0?0.55:1);
    ctx.drawImage(sp,px,py,w,h);ctx.globalAlpha=1;
    if(e.shield>0){ctx.strokeStyle='rgba(143,240,230,.85)';ctx.lineWidth=1;ctx.strokeRect(px-1.5,py-1.5,w+3,h+3);}
    if(e.slowT>0){ctx.fillStyle='#8fdcff';ctx.fillRect(px+w-2,py,2,2);}
    if(e.dotT>0){ctx.fillStyle='#9be35a';ctx.fillRect(px,py,2,2);}
    if(e.stunT>0){ctx.fillStyle='#ffe066';ctx.fillRect(px+(w>>1)-2+Math.round(Math.sin(G.time*14)*2),py-2,1,1);ctx.fillRect(px+(w>>1)+1-Math.round(Math.sin(G.time*14)*2),py-3,1,1);}
    if(e.hp<e.max){const bw=e.scale>1?20:10,bx=Math.round(e.x-bw/2);ctx.fillStyle='#2a1d18';ctx.fillRect(bx,py-4,bw,2);ctx.fillStyle=e.hp/e.max>0.4?'#6fe08a':'#ff5d6c';ctx.fillRect(bx,py-4,Math.max(1,Math.round(bw*e.hp/e.max)),2);}
    if(e.type==='lich')glows.push([e.x,e.y,16,'#9bff6a',0.08]);
  }
  const hr=G.hero,hx=Math.round(hr.x),hy=Math.round(hr.y),moving=Math.hypot(hr.tx-hr.x,hr.ty-hr.y)>1,hb=moving?Math.round(Math.abs(Math.sin(G.time*14))*2):0;
  if(G.heroSel){ctx.strokeStyle='#ffd24a';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(hx,hy+5,9,3.5,0,0,Math.PI*2);ctx.stroke();
    if(moving){ctx.fillStyle='#ffd24a';ctx.fillRect(Math.round(hr.tx)-1,Math.round(hr.ty)-3,1,6);ctx.fillRect(Math.round(hr.tx),Math.round(hr.ty)-3,4,3);}}
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(hx-4,hy+5,8,2);
  ctx.save();ctx.translate(hx,hy-7-hb);if(hr.face<0)ctx.scale(-1,1);ctx.drawImage(SPR.hero,-5,0);
  if(hr.swing>0){ctx.fillStyle='#ffffff';ctx.fillRect(6,1,1,8);ctx.fillRect(7,2,1,6);ctx.fillRect(8,4,1,2);}
  ctx.restore();
  ctx.drawImage(G.keepHit>0?KEEP_HIT:KEEP,G.keep.cx-16,G.keep.by-32+(G.keepHit>0.25?1:0));
  glows.push([G.keep.cx,G.keep.by-6,12,'#ffb347',0.07]);
  for(const t of G.towers)if(t.type==='laser'&&t.beam){
    for(const e of t.beam){if(e.dead)continue;ctx.strokeStyle=t.ramp>0.6?'#ffffff':'#ff8a8a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(t.x*TILE+8,t.y*TILE+3);ctx.lineTo(e.x,e.y);ctx.stroke();
      ctx.fillStyle='#ff5d6c';ctx.fillRect(Math.round(e.x)-1,Math.round(e.y)-1,3,3);glows.push([e.x,e.y,6+t.ramp*5,'#ff5d6c',0.14]);}
  }
  for(const s of G.shots){
    const x=Math.round(s.x),y=Math.round(s.y);
    if(s.k==='archer'){ctx.fillStyle='#fff3c4';ctx.fillRect(x,y,2,2);}
    else if(s.k==='cannon'){ctx.fillStyle='#16151c';ctx.fillRect(x-1,y-1,3,3);}
    else if(s.k==='poison'){ctx.fillStyle='#9be35a';ctx.fillRect(x-1,y-1,3,3);}
    else if(s.k==='mortar'){const p=1-Math.hypot(s.tx-s.x,s.ty-s.y)/s.total,arc=Math.round(Math.sin(p*Math.PI)*16);
      ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(x-1,y,3,2);ctx.fillStyle='#16151c';ctx.fillRect(x-2,y-arc-2,4,4);ctx.fillStyle='#ff7a2f';ctx.fillRect(x-1,y-arc-1,1,1);}
    else{ctx.fillStyle='#8fdcff';ctx.fillRect(x-1,y-1,2,2);}
  }
  for(const f of G.fx){
    if(f.k==='ring'){ctx.beginPath();ctx.arc(f.x,f.y,f.r*(1-f.t/0.18*0.6),0,Math.PI*2);ctx.strokeStyle=f.c;ctx.lineWidth=1;ctx.stroke();}
    else if(f.k==='boom'){const p=1-Math.max(0,f.t)/f.T,r=f.r*(0.3+0.7*Math.sqrt(p));ctx.globalAlpha=1-p*p;ctx.fillStyle=p<0.2?'#ffffff':p<0.45?'#ffe066':p<0.7?'#ff7a2f':'#5a4a4a';
      ctx.beginPath();ctx.arc(f.x,f.y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;glows.push([f.x,f.y,f.r*1.5,'#ff9a3c',0.2*(1-p)]);}
    else if(f.k==='meteor'){const p=Math.max(0,f.t/0.45),x=Math.round(f.x-p*70),y=Math.round(f.y-p*130);
      ctx.fillStyle='#ff7a2f';for(let i=1;i<5;i++)ctx.fillRect(x-i*4,y-i*7,3,3);ctx.fillStyle='#7a3a1c';ctx.fillRect(x-3,y-3,7,7);ctx.fillStyle='#ffd24a';ctx.fillRect(x-1,y-1,3,3);glows.push([x,y,14,'#ff7a2f',0.18]);}
    else{ctx.strokeStyle=f.k==='bolt'?'#ffe066':'#ffffff';ctx.lineWidth=1;ctx.beginPath();
      f.pts.forEach((p,i)=>{const j=f.k==='bolt'&&i>0?(Math.random()-0.5)*3:0;if(i)ctx.lineTo(p.x+j,p.y+j);else ctx.moveTo(p.x,p.y);});ctx.stroke();}
  }
  for(const p of G.parts){ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.g?1:2,p.g?1:2);}
  const wx=WX[G.map.theme],mod=(v,m)=>((v%m)+m)%m;
  ctx.fillStyle=wx.c;
  for(let i=0;i<wx.n;i++){
    if(wx.blink&&Math.sin(RT*1.7+i*2.3)<0)continue;
    const sp=0.6+((i*17)%10)/12,x=mod(i*73.7+RT*wx.vx*sp+Math.sin(RT+i)*5,W),y=mod(i*41.3+RT*wx.vy*sp,H);
    ctx.globalAlpha=wx.a;ctx.fillRect(Math.round(x),Math.round(y),wx.w||1,1);
    if(wx.glow)glows.push([x,y,4,wx.c,0.12]);
  }
  ctx.globalAlpha=1;
  ctx.drawImage(G.vig,0,0);
  ctx.globalCompositeOperation='lighter';
  for(const[x,y,r,c,a]of glows){ctx.globalAlpha=a;ctx.fillStyle=c;for(let i=3;i>0;i--){ctx.beginPath();ctx.arc(x,y,r*i/3,0,Math.PI*2);ctx.fill();}}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ptext(String(hr.lvl),hx-(hr.lvl>9?3:1),hy-14-hb,'#ffd24a');
  for(const p of G.texts)ptext(p.s,Math.round(p.x),Math.round(p.y),p.c);
  ctx.restore();
  if(G.flash>0){ctx.fillStyle='rgba(143,220,255,'+Math.min(0.5,G.flash*1.6)+')';ctx.fillRect(0,0,W,H);}
  if(G.paused&&!G.over){ctx.fillStyle='rgba(16,12,24,.5)';ctx.fillRect(0,0,W,H);}
}
const cache={};
function setText(id,v){if(cache[id]!==v){cache[id]=v;$(id).textContent=v;}}
function hud(){
  if(!G)return;
  const goldChanged=cache.gold!==G.gold;
  setText('gold',G.gold);setText('lives',Math.max(0,G.lives));setText('wave',G.wave+(G.endless?'':'/'+MAXWAVE));setText('score',fmt(Math.floor(G.score)));setText('foes',G.enemies.length+G.queue.length);
  if(goldChanged){
    TKEYS.forEach(k=>$('tb-'+k).classList.toggle('poor',isUnl(k)&&G.gold<TOWERS[k].cost));
    if(G.sel){const c=upCost(G.sel),aff=c!=null&&G.gold>=c;if(cache.popAff!==aff)renderPop();}
  }
  TKEYS.forEach(k=>$('tb-'+k).classList.toggle('on',G.placing===k));
  $('sp-meteor').classList.toggle('on',G.aim==='meteor');
  for(const k of SPELLS){const v=G.cd[k]>0?Math.ceil(G.cd[k])+'s':'Ready';if(cache['sc'+k]!==v){cache['sc'+k]=v;$('sc-'+k).textContent=v;$('sp-'+k).classList.toggle('cool',G.cd[k]>0);}}
  const bw=$('btnWave');bw.disabled=G.over||(G.active&&!canRush());
  const label=G.active?(canRush()?'Rush +'+(10+2*G.wave)+'g':'Wave '+G.wave+'...'):'Start wave '+(G.wave+1);if(cache.bw!==label){cache.bw=label;bw.textContent=label;}
  const boss=G.enemies.find(e=>ENEMIES[e.type].boss),bv=boss?Math.max(0,Math.round(boss.hp/boss.max*100)):-1;
  if(cache.boss!==bv){cache.boss=bv;$('bossbar').style.display=boss?'block':'none';if(boss)$('bossfill').style.width=bv+'%';}
}
const SPELLS=['meteor','freeze'];
function statLine(t,s){
  const b=TOWERS[t.type];
  if(b.income)return'Pays '+s.income+'g per wave'+(s.interest?' + interest':'');
  if(b.cont)return Math.round(s.dmg)+(s.ramp?'-'+Math.round(s.dmg*(1+s.ramp)):'')+' dmg/s · Range '+Math.round(s.range);
  return'Dmg '+Math.round(s.dmg)+(s.dot?' + '+Math.round(s.dot)+'/s':'')+' · Range '+Math.round(s.range)+' · '+(1/s.rate).toFixed(1)+'/s';
}
function blurb(k){const b=TOWERS[k];return'<span class="t">'+b.name+' ('+(isUnl(k)?b.cost+'g':'locked, unlock it under Upgrades')+')</span><span>'+b.desc+(b.income?'':b.phys?' Physical damage.':' Magic damage.')+'</span><span>Final upgrade: '+b.specs[0].name+' or '+b.specs[1].name+'</span>';}
function renderPop(){
  const pop=$('pop');if(!G||!G.sel||G.over){pop.classList.remove('show');cache.popAff=null;return;}
  const t=G.sel,b=TOWERS[t.type],s=tstat(t),c=upCost(t),aff=c!=null&&G.gold>=c;cache.popAff=aff;
  let h='<div class="pt">'+b.name+' <span>'+(t.lvl>=3?b.specs[t.spec].name+(t.oc?' +'+t.oc:''):'Level '+(t.lvl+1)+' of 4')+'</span></div><div>'+statLine(t,s)+'</div>';
  if(c==null)h+='<div class="up">Fully upgraded. Endless mode adds Overclock.</div>';
  else if(t.lvl>=3)h+='<div class="up">Overclock: +12% power, as many times as you can pay for.</div><button class="go" data-act="up"'+(aff?'':' disabled')+'>Overclock: '+c+'g</button>';
  else if(t.lvl===2)h+='<div class="up">Final upgrade, pick one ('+c+'g):</div>'+b.specs.map((sp,i)=>'<button class="spec" data-act="spec'+i+'"'+(aff?'':' disabled')+'>'+sp.name+'<small>'+sp.desc+'</small></button>').join('');
  else h+='<div class="up">Next: '+statLine(t,tstat(t,t.lvl+1))+'</div><button class="go" data-act="up"'+(aff?'':' disabled')+'>Upgrade: '+c+'g</button>';
  if(c!=null&&!aff)h+='<div>Not enough gold yet.</div>';
  h+='<div class="prow">'+(b.range?'<button data-act="mode">Aim: '+t.mode+'</button>':'')+'<button data-act="sell">'+(t.fresh&&!G.active?'Undo':'Sell')+' +'+sellVal(t)+'g</button></div>';
  if(!b.income&&(t.done||t.kills))h+='<div>Kills '+t.kills+' · Damage '+big(t.done)+'</div>';
  pop.innerHTML=h;
  const px=(t.x+0.5)/COLS*100,py=(t.y+0.5)/ROWS*100,left=px<55;
  pop.style.setProperty('--l',left?(px+5)+'%':'auto');pop.style.setProperty('--r',left?'auto':(100-px+5)+'%');
  pop.style.setProperty('--t',Math.max(2,Math.min(42,py-22))+'%');
  pop.classList.add('show');
}
function renderInfo(){
  const el=$('info');renderPop();if(!G){el.innerHTML='';return;}
  if(G.sel)el.innerHTML='<span class="t">'+TOWERS[G.sel.type].name+' selected.</span><span>Use the box beside the tower to upgrade it, change its aim or sell it. Click anywhere else to close.</span>';
  else if(G.aim)el.innerHTML='<span class="t">Meteor:</span><span>click the map where it should land. Esc cancels.</span>';
  else if(G.placing)el.innerHTML=blurb(G.placing)+'<span class="up">Click a grass tile to build. Hold Shift to place more than one.</span>';
  else if(G.heroSel)el.innerHTML='<span class="t">Knight, level '+G.hero.lvl+' ('+Math.round(heroDmg(G.hero))+' damage).</span><span>Click anywhere on the map to send him there. He fights any enemy next to him and levels up from kills. Esc lets go.</span>';
  else if(G.wave===0&&!G.towers.length)el.innerHTML='<span class="t">Step 1:</span><span>pick the Archer below, then click a grass tile next to the road.</span>';
  else if(G.wave===0&&!G.active)el.innerHTML='<span class="t">Step 2:</span><span>click a tower to upgrade it, or click your knight by the castle and send him to the road. Then press Start wave.</span>';
  else{
    el.innerHTML='<span class="t">Next wave'+(mutators(G.wave+1).length?' ('+mutators(G.wave+1).map(m=>m.name).join(' + ')+')':'')+':</span><span>'+buildWave(G.wave+1).g.map(([t,c])=>'<canvas class="ico" data-spr="'+t+'"></canvas>'+c+' '+ENEMIES[t].name+(c>1?'s':'')).join(' ')+'</span>'+
      '<span class="sp"></span><span class="up">A green arrow on a tower means you can afford its upgrade.</span>';
    el.querySelectorAll('canvas[data-spr]').forEach(c=>{const s=SPR[c.dataset.spr];c.width=s.sw;c.height=s.sh;c.getContext('2d').drawImage(s,0,0);});
  }
}
$('pop').addEventListener('pointerdown',ev=>{
  const btn=ev.target.closest('button');if(!btn||btn.disabled||!G||!G.sel)return;ev.preventDefault();
  const a=btn.dataset.act;
  if(a==='up')upgrade(G.sel);else if(a==='spec0')upgrade(G.sel,0);else if(a==='spec1')upgrade(G.sel,1);else if(a==='sell')sell(G.sel);
  else if(a==='mode')G.sel.mode={first:'strong',strong:'close',close:'first'}[G.sel.mode];
  renderInfo();
});
function castSpell(k){
  if(!G||G.over||G.paused)return;
  if(G.cd[k]>0){toast((k==='meteor'?'Meteor':'Freeze')+' is recharging: '+Math.ceil(G.cd[k])+'s');return;}
  if(k==='freeze'){G.cd.freeze=TUNE.freezeCd;for(const e of G.enemies){e.stunImm=0;stun(e,TUNE.freezeDur);}G.flash=0.3;sfx('zap');toast('Freeze!');}
  else{G.aim=G.aim?null:'meteor';G.placing=null;G.sel=null;G.heroSel=false;renderInfo();}
}
function meteorAt(x,y){G.aim=null;G.cd.meteor=TUNE.meteorCd;G.fx.push({k:'meteor',x,y,t:0.45});sfx('snipe');renderInfo();}
function meteorHit(f){
  const dmg=Math.round(TUNE.meteorDmg*G.map.hp*waveMul(Math.max(1,G.wave)));
  for(const e of G.enemies)if(!e.dead&&(e.x-f.x)**2+(e.y-f.y)**2<=900)burn(e,dmg,G.spell);
  G.fx.push({k:'boom',x:f.x,y:f.y,r:30,t:0.45,T:0.45});burst(f.x,f.y,'#ff7a2f',24);burst(f.x,f.y,'#ffd24a',12);G.shake=Math.max(G.shake,0.3);sfx('boom');
}
function pick(k){
  if(!G||G.over)return;
  if(!isUnl(k)){toast(TOWERS[k].name+' is locked. Unlock it under Upgrades in the menu.');return;}
  G.placing=G.placing===k?null:k;G.sel=null;G.aim=null;G.heroSel=false;renderInfo();
}
function refreshBar(){
  TKEYS.forEach(k=>{const u=isUnl(k),b=$('tb-'+k);b.classList.toggle('locked',!u);$('tc-'+k).textContent=u?TOWERS[k].cost+'g':'Locked';});
}
(function buildBar(){
  const bar=$('towerBar');
  const mkBtn=(id,cls,title,spr,key,smallId,smallText)=>{
    const b=document.createElement('button');b.className=cls;b.id=id;b.title=title;
    const c=document.createElement('canvas');c.width=16;c.height=16;c.getContext('2d').drawImage(spr,0,0);
    const s=document.createElement('small');s.id=smallId;s.textContent=smallText;
    const kb=document.createElement('kbd');kb.textContent=key;
    b.append(kb,c,s);bar.appendChild(b);return b;};
  TKEYS.forEach((k,i)=>{
    const b=mkBtn('tb-'+k,'tbtn',TOWERS[k].name+': '+TOWERS[k].desc,SPR[k],(i+1)%10,'tc-'+k,TOWERS[k].cost+'g');
    b.addEventListener('click',()=>pick(k));
    b.addEventListener('pointerenter',()=>{if(G&&!G.sel&&!G.placing&&!G.aim)$('info').innerHTML=blurb(k);});
    b.addEventListener('pointerleave',()=>{if(G&&!G.sel&&!G.placing&&!G.aim)renderInfo();});
  });
  const sp=document.createElement('span');sp.className='sp';bar.appendChild(sp);
  mkBtn('sp-meteor','tbtn spell','Meteor: click the map to blast an area',SPR.meteor,'Q','sc-meteor','Ready').addEventListener('click',()=>castSpell('meteor'));
  mkBtn('sp-freeze','tbtn spell','Freeze: stops every enemy for 3 seconds',SPR.freeze,'W','sc-freeze','Ready').addEventListener('click',()=>castSpell('freeze'));
  const au=$('btnAuto');
  au.addEventListener('click',()=>{if(!G)return;G.auto=!G.auto;G.autoT=0.5;au.textContent='Auto: '+(G.auto?'on':'off');au.classList.toggle('on',G.auto);});
  $('btnWave').addEventListener('click',startWave);
})();
$('btnSpeed').addEventListener('click',()=>{if(!G)return;G.speed=G.speed===1?2:G.speed===2?4:1;$('btnSpeed').textContent=G.speed+'x';});
$('btnPause').addEventListener('click',()=>pauseRun());
$('btnBank').addEventListener('click',()=>{if(G&&G.won&&gstate==='run')finish('won');});
function tileAt(ev){const r=cv.getBoundingClientRect(),fx=(ev.clientX-r.left)/r.width,fy=(ev.clientY-r.top)/r.height;return{tx:Math.floor(fx*COLS),ty:Math.floor(fy*ROWS),px:fx*W,py:fy*H};}
cv.addEventListener('pointermove',ev=>{if(G)G.hover=tileAt(ev);});
cv.addEventListener('pointerleave',()=>{if(G)G.hover=null;});
cv.addEventListener('contextmenu',ev=>{ev.preventDefault();if(G){G.placing=null;G.sel=null;G.aim=null;G.heroSel=false;renderInfo();}});
cv.addEventListener('pointerdown',ev=>{
  initAudio();if(!G||gstate!=='run'||ev.button===2)return;
  const h=tileAt(ev);G.hover=h;
  if(G.aim){meteorAt(h.px,h.py);return;}
  const hr=G.hero,onHero=(h.px-hr.x)**2+(h.py-hr.y+2)**2<110,t=towerAt(h.tx,h.ty);
  if(G.placing){
    if(t){G.sel=t;G.placing=null;}
    else if(build(G.placing,h.tx,h.ty)){if(!ev.shiftKey||G.gold<TOWERS[G.placing].cost)G.placing=null;}
    else if(!canBuild(h.tx,h.ty))toast('Towers go on open grass, not on the road.');else toast('Not enough gold.');
  }
  else if(onHero&&!G.heroSel){G.heroSel=true;G.sel=null;}
  else if(t){G.sel=G.sel===t?null:t;G.heroSel=false;}
  else if(G.heroSel){hr.tx=clamp(h.px,5,W-5);hr.ty=clamp(h.py,8,H-6);sfx('build');}
  else G.sel=null;
  renderInfo();
});
addEventListener('keydown',ev=>{
  if(capturing||(ev.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName||''))||ev.metaKey||ev.ctrlKey||ev.altKey)return;
  const c=ev.code||ev.key||'';
  if(gstate==='paused'&&view==='pause'&&(bound('pause',c)||c==='Escape')){ev.preventDefault();resumeRun();return;}
  if(!G||gstate!=='run')return;
  if(KEY_ACTIONS.some(([a])=>bound(a,c)))ev.preventDefault();
  const n=/^Digit\d$/.test(c)?+c.slice(5):-1,idle=()=>{G.placing=null;G.sel=null;G.aim=null;G.heroSel=false;renderInfo();};
  if(n>=0){const k=TKEYS[(n+9)%10];if(k)pick(k);}
  else if(c==='Escape'){if(G.placing||G.sel||G.aim||G.heroSel)idle();else pauseRun();}
  else if(bound('wave',c)){if(!G.active&&!ev.repeat)startWave();}
  else if(bound('hero',c)){const on=!G.heroSel;idle();G.heroSel=on;renderInfo();}
  else if(bound('meteor',c))castSpell('meteor');
  else if(bound('freeze',c))castSpell('freeze');
  else if(bound('speed',c)){if(!ev.repeat)$('btnSpeed').click();}
  else if(bound('pause',c))pauseRun();
  else if(bound('upgrade',c)&&G.sel&&G.sel.lvl!==2){upgrade(G.sel);renderInfo();}
});
Object.assign(K,{newGame,step,draw,hud,toast,startWave,build,upgrade,sell,canBuild,castSpell,meteorAt,pick,renderInfo,buildMap,buildWave,posAt,tstat,upCost,isUnl,keepArt,heroArt,MAPS,DIFFS,TOWERS,TKEYS,ENEMIES,TUNE,tick:dt=>{RT+=dt;}});
  }

  /* ---------- a siege from start to finish ---------- */
  const dailyMap = () => Math.floor(seeded('nightkeep-' + dayKey)() * K.MAPS.length);
  const mapOpen = i => i === 0 || D.bs['won' + (i - 1)] > 0;
  function startRun(mode, mi, diff) {
    if (!GAME.modes.some(m => m.id === mode)) mode = D.mode;
    D.mode = mode;
    if (mode === 'daily') { rollDay(); mi = dailyMap(); diff = 0; }
    else if (mi == null) { if (gstate === 'over') leaveRun(); return show('maps'); } // Defend: pick a map first
    initAudio(); K.newGame(mi, diff, mode); armRun(mode); gstate = 'run'; overlay.hidden = true; $('top').hidden = true; keepEl.hidden = false; resize();
    if (mode === 'daily') K.toast(`Daily Siege · ${dayLabel} · ${MAP_NAMES[mi]}`);
    chime([392, 523]); music.intensity = 0; music.tense = false; musicStart(); acc = 0; lastFrame = performance.now();
  }
  function pauseRun() { if (gstate !== 'run') return; gstate = 'paused'; musicStop(); show('pause'); }
  function resumeRun() { if (gstate !== 'paused') return; initAudio(); gstate = 'run'; overlay.hidden = true; musicStart(); acc = 0; lastFrame = performance.now(); }
  // What the run report records, for balancing: where the siege stood when it ended.
  const logData = end => ({ end, m: G.cleared, z: G.mi, diff: G.diff, wave: G.wave, lives: Math.max(0, G.lives), gold: Math.round(G.gold), leaks: G.leaks, kills: G.kills, hero: G.hero.lvl, won: G.won,
    towers: G.towers.reduce((o, t) => { o[t.type] = (o[t.type] || 0) + 1; return o; }, {}) });
  // Leaving a siege whose map is already won banks the score; otherwise it is only noted for balancing.
  function wrapUp(end) {
    if (gstate !== 'run' && gstate !== 'paused') return;
    if (G.won) finish('won'); else if (G.cleared > 0) logRun(Object.assign({ mode: G.mode, s: Math.floor(G.score), t: Math.round(G.time), n: D.life.runs }, logData(end)));
  }
  function restartRun() { if (gstate !== 'run' && gstate !== 'paused') return; const { mode, mi, diff } = G; wrapUp('restart'); musicStop(true); startRun(mode, mi, diff); }
  function leaveRun() { wrapUp('quit'); musicStop(); gstate = 'idle'; $('top').hidden = false; keepEl.hidden = true; resize(); }
  function syncStats() { const S = G.st; S.score = Math.floor(G.score); S.waves = G.cleared; S.kills = G.kills; S.bosses = G.bossK; S.built = G.built; if (G.mode === 'daily') S.daily = S.score; return S; }
  function finish(end) {
    const S = syncStats(), w = G.cleared, mult = G.D.gems, where = `${MAP_NAMES[G.mi]} on ${DIFF_NAMES[G.diff]}`;
    if (G.won) { S.wins = 1; S['won' + G.mi] = G.diff + 1; S['star' + G.mi] = G.stars; }
    S['wave' + G.mi] = w;
    let top = null; for (const t of G.towers) if (!top || t.done > top.done) top = t;
    keepEl.hidden = true; musicStop();
    endRun({ mode: G.mode, score: G.score, stats: S, secs: G.time, coins: (w * 20 + G.bossK * 60 + (G.won ? 250 : 0)) * mult, xp: G.score / 40 + w * 8, title: G.won ? 'The keep stands' : 'The keep fell', ach: G.newAch, mis: G.newMis,
      line: G.won ? `You won <b>${where}</b> with ${'★'.repeat(G.stars)}${'☆'.repeat(3 - G.stars)} and held for <b>${w} waves</b>${G.mode === 'daily' ? ' on the Daily Siege' : ''}.` : `The keep on <b>${where}</b> fell on wave ${G.wave} after <b>${w} cleared</b>${G.mode === 'daily' ? ' on the Daily Siege' : ''}.`,
      rows: [['Waves cleared', w], ['Monsters slain', G.kills], ['Bosses slain', G.bossK], ['Towers built', G.built], ['Knight level', G.hero.lvl]].concat(top && top.done ? [['Top tower', K.TOWERS[top.type].name]] : []),
      note: `wave ${w} · ${MAP_NAMES[G.mi]}`, meta: { waves: w, map: G.mi, diff: G.diff }, log: logData(end) });
  }

  /* ---------- the map picker ---------- */
  const mapShots = {};
  const mapShot = i => mapShots[i] || (mapShots[i] = K.buildMap(K.MAPS[i]).bg.toDataURL('image/png'));
  VIEWS.maps = () => `${backBtn('home')}<h2>Choose a map</h2><p>Win a map to unlock the next one. Hard pays double points and coins. Nightmare pays triple, halves your lives and mutates its waves.</p>
    <div class="list">${K.MAPS.map((m, i) => {
      const open = mapOpen(i), won = D.bs['won' + i], st = D.bs['star' + i];
      return `<div class="box kmap${open ? '' : ' locked'}"><img src="${mapShot(i)}" alt="" width="320" height="192"><h3>${i + 1}. ${MAP_NAMES[i]}${won ? `<b>${'★'.repeat(st)}${'☆'.repeat(3 - st)} ${DIFF_NAMES[won - 1]}</b>` : ''}</h3>
        <p class="sub">${open ? esc(m.note) + (D.bs['wave' + i] ? ` Your best: wave ${D.bs['wave' + i]}.` : '') : 'Win the map before this one to unlock it.'}</p>
        ${open ? `<div class="row3">${DIFF_NAMES.map((d, di) => `<button class="go${di ? ' alt' : ''}" type="button" data-act="siege:${i}.${di}">${d}${di ? `<small>${di + 1}x points</small>` : '<small>start here</small>'}</button>`).join('')}</div>` : ''}</div>`;
    }).join('')}</div>`;
  ACTIONS.siege = s => { const [i, d] = s.split('.').map(Number); if (!K.MAPS[i] || !K.DIFFS[d] || !mapOpen(i)) return sfx.deny(); startRun('free', i, d); };

  /* ---------- knights and banners in the locker ---------- */
  const previews = {};
  function cosPreview(kind, it) {
    const key = kind + '.' + it.id; if (previews[key]) return previews[key];
    const c = document.createElement('canvas'); c.width = c.height = 144; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#1a1528'; x.fillRect(0, 0, 144, 144); x.fillStyle = '#2a2140'; x.fillRect(0, 104, 144, 40);
    if (kind === 'hero') x.drawImage(K.heroArt(it), 27, 14, 90, 108); else x.drawImage(K.keepArt(it.c, it.c2), 8, 4, 128, 128);
    return (previews[key] = c.toDataURL('image/png'));
  }
  const clearPreviews = () => { for (const k in previews) delete previews[k]; };

  /* ---------- the loop ---------- */
  // Behind the menus: a still of the first map the player hasn't won yet.
  function backdrop() {
    if (!keepEl.hidden) return;
    let i = 0; while (i < 5 && D.bs['won' + i] > 0) i++;
    const bg = K.buildMap(K.MAPS[i]).bg, s = Math.max(W / 320, H / 192);
    ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#120f1c'; ctx.fillRect(0, 0, W, H); ctx.drawImage(bg, (W - 320 * s) / 2, (H - 192 * s) / 2, 320 * s, 192 * s);
  }
  resizeHooks.push(backdrop);
  const achChip = $('achChip'), bankBtn = $('btnBank');
  function notice(text) { achChip.textContent = text; achChip.classList.remove('show'); void achChip.offsetWidth; achChip.classList.add('show'); }
  let frameNo = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastFrame = now; return; }
    const dtMs = Math.min(100, now - lastFrame); lastFrame = now; frameNo++;
    if (gstate === 'run' && G) {
      // fixed steps of 1/60 s, more of them per frame at 2x and 4x
      acc += dtMs * G.speed; let n = 0;
      while (acc >= 1000 / 60 && n++ < 20) { acc -= 1000 / 60; K.step(1 / 60); if (gstate !== 'run') break; }
      if (n >= 20) acc = 0;
      if (gstate === 'run' && frameNo % 30 === 0) {
        const S = syncStats(), a = checkAch(S), ms = missionTick(S, false);
        for (const x of a) { G.newAch.push(x); notice('★ ' + x.n); }
        for (const x of ms) { G.newMis.push(x); notice(`Job done · +${x.pay} coins`); }
        music.intensity = G.active ? Math.min(5, 1 + Math.floor(G.wave / 5)) : 0; music.tense = G.lives < G.maxLives * .3;
      }
    }
    if (G && !keepEl.hidden) { K.tick(dtMs / 1000); K.draw(); K.hud(); if (bankBtn.hidden === G.won) bankBtn.hidden = !G.won; }
  }

  /* ---------- boot ---------- */
  addEventListener('resize', resize);
  fixEquipped(); resize(); syncWallet();
  show('home'); lastFrame = performance.now(); requestAnimationFrame(frame); onlineBoot();
  if (DEV) window.NK = { get G() { return G; }, get save() { return save; }, get state() { return gstate; }, K, startRun, finish, show, earn, persist };
