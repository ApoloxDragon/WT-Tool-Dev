#!/usr/bin/env node
/* Fake War Thunder match-log generator — a dev-only stress-test tool (no dependencies).
 *
 *   node tests/generate-matches.js --count 10000 --out "example data/generated/fake-10k-matches.txt"
 *   options: --count N    unique matches to generate (default 1000)
 *            --seed N     same seed, same log (default 1)
 *            --dupes F    extra repeated matches, as a fraction of --count, like overlapping pastes (default 0)
 *            --crlf       Windows line endings
 *            --out PATH   write here instead of stdout
 *
 * Every match is random but typical: the win rate, mode mix, missions, which sections appear and how
 * the SL / RP figures are built are modelled on the real example logs, and the arithmetic the game
 * does holds in every block (section headers = the sum of their events; Earned = every section;
 * Total = Earned minus repairs, ammo and respawns; the trailing RP figure = research RP).
 * Output is labelled fake: a banner above the first match, and Session IDs that all start "fade".
 * Also usable as a module: require('./generate-matches').generate({ count, seed, dupes }). */
'use strict';

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const MODES = [['Domination', 81], ['Domination #1', 19], ['Domination #2', 22], ['Tank Assault', 69], ['Battle', 13], ['Battle #1', 2], ['Battle #2', 2],
  ['Conquest #1', 6], ['Conquest #2', 9], ['Conquest #3', 12]];
const MISSIONS = ['Sinai', 'Fulda', 'Mozdok', 'Ardennes', 'Port Novorossiysk', 'Japan', 'Cargo port', 'Kursk', 'Tunisia', 'Middle East', 'Maginot Line',
  'Finland', 'Second battle of El Alamein', 'North Holland', 'Fields of Normandy', 'Darwin Hill', 'Carpathians', 'American Desert', 'Normandy', 'Abandoned Town'];
const VEHICLES = ['Leopard 2K', 'Leopard 2 (PzBtl 123)', 'Puma', 'TAM 2C', 'KPz-70', 'T-72M1(Germany)', 'JaPz.K A2', 'Gepard 1A2', 'Pz.IV F2', 'Marder 1A3', 'Ostwind'];
const RESEARCH = ['Leopard 2K', 'Radkampfwagen 90', 'Wiesel 1A4', 'EMBT(Germany)', 'Marder 1A3', 'Leopard 2A4', 'TAM 2C'];
const MODULES = ['Engine', 'ESS', 'DM33', 'Suspension', 'Fire extinguisher', 'Horizontal Drive', 'Smoke grenade'];
const WEAPONS = ['3BM22', 'DM23', 'DM33', 'PzGr 39', 'PMC287', 'PMC308', 'XM578E1', 'DM13', 'Default (7.62mm)', 'API-T (12.7mm)', 'AP-I(c) (12.7mm)'];
const TARGETS = ['Leopard 1A5BE', 'AMX-32', 'MEPHISTO', 'VBCI', 'Merkava Mk.2D', 'T-55A', 'M3A3 Bradley', 'A-10A', 'F-4S Phantom II', 'Pe-8', 'G.91 Y', 'Recon Micro (AI)', 'AMX-30B2', 'Challenger 2'];
const AWARDS = [['Tank Rescuer', 50], ['Multi strike!', 100], ['Adamant', 300], ['Avenger', 150], ['Eye for Eye', 300], ['Help with Repairing', 100]];

// kind: how an event line is laid out. rp:null = the section has no RP. p = chance the section appears in a match.
const SECTIONS = [
  { name: 'Severe damage to the enemy', kind: 'kill', pts: 160, sl: [1200, 2400], rp: [60, 150], n: [1, 4], p: 0.06 },
  { name: 'Destruction of ground targets', kind: 'kill', pts: 200, sl: [800, 2400], rp: [45, 140], n: [1, 5], p: 0.45 },
  { name: 'Destruction of aircraft', kind: 'air', pts: 50, sl: [600, 1600], rp: [20, 60], n: [1, 3], p: 0.12 },
  { name: 'Destruction by allies of scouted enemies', kind: 'scoutkill', pts: 60, sl: [400, 900], rp: [20, 50], n: [1, 3], p: 0.40 },
  { name: 'Assistance in destroying the enemy', kind: 'kill', pts: 120, sl: [500, 1000], rp: [30, 60], n: [1, 3], p: 0.33 },
  { name: 'Critical damage to the enemy', kind: 'kill', pts: 60, sl: [100, 260], rp: [5, 20], n: [1, 6], p: 0.56 },
  { name: 'Damage to the enemy', kind: 'kill', pts: 20, sl: [60, 200], rp: [3, 8], n: [1, 12], p: 0.63 },
  { name: 'Capture of zones', kind: 'capture', pts: 200, sl: [1200, 3600], rp: [100, 280], n: [1, 2], p: 0.15 },
  { name: 'Scouting of the enemy', kind: 'scout', pts: 5, sl: [40, 200], rp: null, n: [1, 4], p: 0.53 },
  { name: 'Damage taken by scouted enemies', kind: 'scout', pts: 20, sl: [100, 300], rp: null, n: [1, 5], p: 0.40 },
  { name: 'Awards', kind: 'award', sl: [0, 0], rp: null, n: [1, 6], p: 0.63 }
];

const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const widest = (rows, i) => Math.max(...rows.map(r => r[i].length)) + 4; // column width keeping 2+ spaces between columns

function makeMatch(rand, id) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = a => a[Math.floor(rand() * a.length)];
  const chance = p => rand() < p;
  const weighted = list => { let r = rand() * sum(list, x => x[1]); for (const [v, w] of list) { if ((r -= w) < 0) return v; } return list[0][0]; };
  const jitter = b => Math.max(1, Math.round(b * (1 + (rand() - 0.5) * 0.06)));

  const win = chance(0.587), mode = weighted(MODES), mission = pick(MISSIONS);
  const assault = mode === 'Tank Assault';
  const boost = chance(0.45), tal = chance(0.08);
  const nVeh = assault ? 1 : weighted([[1, 45], [2, 35], [3, 20]]);
  const lineup = [...VEHICLES].sort(() => rand() - 0.5).slice(0, nVeh);

  // How the match time (4–20 min) splits between the vehicles.
  const total = int(240, 1200);
  const cuts = Array.from({ length: nVeh - 1 }, () => int(0, total)).sort((a, b) => a - b);
  const shares = [...cuts, total].map((c, i) => c - (i ? [...cuts, total][i - 1] : 0));
  const slAmt = (b, fullPA) => { const pa = fullPA ? b : Math.floor(b / 2), bo = boost ? Math.round(b * 0.2) : 0; return { tot: b + pa + bo, txt: `${b} + (PA)${pa}${bo ? ` + (Booster)${bo}` : ''} = ${b + pa + bo} SL` }; };
  const rpAmt = (r, talismans) => talismans ? { tot: 4 * r, txt: `${r} + (PA)${2 * r} + (Talismans)${r} = ${4 * r} RP` } : { tot: 2 * r, txt: `${r} + (PA)${r} = ${2 * r} RP` };

  const out = [`${win ? 'Victory' : 'Defeat'} in the [${mode}] ${mission} mission!`, ''];
  let earnedSL = 0, earnedRP = 0;

  for (const s of SECTIONS) {
    if (!chance(s.p)) continue;
    const n = int(s.n[0], s.n[1]);
    const baseSL = int(s.sl[0], s.sl[1]), baseRP = s.rp ? int(s.rp[0], s.rp[1]) : 0;
    const times = Array.from({ length: n }, () => int(10, total)).sort((a, b) => a - b);
    const ev = times.map(t => {
      const veh = pick(lineup);
      if (s.kind === 'award') { const [name, b] = pick(AWARDS); return { t, cells: [name], sl: slAmt(b, false), rp: null }; }
      const sl = slAmt(jitter(baseSL), false), rp = s.rp ? rpAmt(jitter(baseRP), tal) : null;
      if (s.kind === 'capture') return { t, cells: [veh, `${int(10, 99)}%`], pts: s.pts, sl, rp };
      if (s.kind === 'scout') return { t, cells: [veh, pick(TARGETS)], tail: 'without UAV', pts: s.pts, sl, rp };
      if (s.kind === 'scoutkill') return { t, cells: [veh, pick(TARGETS)], tail: 'without UAV    ×', pts: s.pts, sl, rp };
      if (s.kind === 'air') return { t, cells: [veh, chance(0.3) ? '— (crashed without damage)' : pick(WEAPONS), pick(TARGETS)], tail: '–', pts: s.pts, sl, rp };
      return { t, cells: [veh, pick(WEAPONS), pick(TARGETS)], pts: s.pts, sl, rp };
    });
    const secSL = sum(ev, e => e.sl.tot), secRP = sum(ev, e => (e.rp ? e.rp.tot : 0));
    earnedSL += secSL; earnedRP += secRP;
    out.push(`${s.name.padEnd(43)}${String(n).padStart(3)}  ${(secSL + ' SL').padStart(9)}${s.rp ? `  ${(secRP + ' RP').padStart(7)}` : ''}`);
    const w = [0, 1, 2].map(i => Math.max(...ev.map(e => (e.cells[i] || '').length)) + 4);
    ev.forEach(e => {
      const cells = e.cells.map((c, i) => c.padEnd(w[i])).join('');
      out.push(`    ${mmss(e.t).padEnd(8)}${cells}${e.pts ? `${e.pts} mission points    ` : ''}${e.tail ? e.tail + '    ' : ''}${e.sl.txt}${e.rp ? '    ' + e.rp.txt : ''}`);
    });
    out.push('');
  }

  // Activity Time, Time Played, the mission reward and the Skill Bonus: one line per vehicle.
  const acts = lineup.map((v, i) => {
    const idle = shares[i] < 60 && chance(0.3);
    return { v, share: shares[i], sl: idle ? null : slAmt(int(300, 2500) * Math.max(0.2, shares[i] / total) | 0 || 1, true), rp: idle ? null : rpAmt(int(30, 200), false) };
  });
  const actSL = sum(acts, a => (a.sl ? a.sl.tot : 0)), actRP = sum(acts, a => (a.rp ? a.rp.tot : 0));
  out.push(`${'Activity Time'.padEnd(43)}${(actSL + ' SL').padStart(10)}  ${(actRP + ' RP').padStart(7)}`);
  const wv = widest(acts.map(a => [a.v]), 0);
  acts.forEach(a => out.push(`    ${a.v.padEnd(wv)}${a.sl ? a.sl.txt + '    ' + a.rp.txt : '0 SL                                      0 RP'}`));
  out.push('');

  const plays = acts.map(a => ({ ...a, tp: a.rp ? rpAmt(Math.max(1, Math.round(a.share * (1.8 + rand()))), false) : null }));
  const tpRP = sum(plays, p => (p.tp ? p.tp.tot : 0));
  out.push(`${'Time Played'.padEnd(43)}${mmss(total).padEnd(16)}${tpRP} RP`);
  plays.forEach(p => out.push(`    ${p.v.padEnd(wv)}${assault ? '' : `${Math.round(100 * p.share / total * (0.75 + rand() * 0.25))}%`.padEnd(7)}${mmss(p.share).padEnd(8)}${p.tp ? p.tp.txt : '0 RP'}`));
  out.push('');

  const reward = win ? int(2500, 12000) : int(300, 8000);
  out.push(`${win ? 'Reward for winning' : 'Reward for participating in the mission'}`.padEnd(46) + `${reward} SL`, '');
  earnedSL += actSL + reward; earnedRP += actRP + tpRP;

  if (chance(0.45)) {
    const sk = lineup.map((v, i) => ({ v, rp: acts[i].rp ? int(50, 400) : 0 }));
    const skRP = sum(sk, x => x.rp); earnedRP += skRP;
    out.push(`${'Skill Bonus'.padEnd(55)}${skRP} RP`);
    sk.forEach(x => out.push(`    ${x.v.padEnd(wv)}I    ${x.rp} RP`));
    out.push('');
  }

  // Footer: what the match cost and what research it paid into.
  const repair = chance(0.05) ? 0 : int(800, 9000), ammo = chance(0.64) ? int(300, 2500) : 0, respawn = chance(0.29) ? int(2000, 22000) : 0;
  const net = earnedSL - repair - ammo - respawn, comp = net < 0 ? -net : 0;
  out.push(`Earned: ${earnedSL} SL, ${earnedRP} CRP`, `Activity: ${Math.round(sum(plays, p => (p.tp ? p.share : 0)) / total * 100 * (0.7 + rand() * 0.3))}%`);
  if (chance(0.67)) out.push(`Damaged Vehicles: ${lineup.slice(0, int(1, nVeh)).join(', ')}`);
  if (chance(0.23)) out.push(`Backup vehicles spent: ${pick(lineup)}`);
  out.push(repair ? `Automatic repair of all vehicles: -${repair} SL` : 'Automatic repair of all vehicles free.');
  if (ammo) out.push(`Automatic purchasing of ammo and "Crew Replenishment": -${ammo} SL`);
  if (respawn) out.push(`Respawns in battle: -${respawn} SL`);
  if (comp) out.push(`Expenses compensation: ${comp} SL`);
  out.push('');

  let researchRP = 0;
  if (!chance(0.013)) {
    const base = int(200, 9000), carried = chance(0.12) ? int(2000, 20000) : 0;
    researchRP += base + carried;
    out.push('Researched unit: ', `${pick(RESEARCH)}: ${base} RP${carried ? ` + earned in the previous battles: ${carried} RP` : ''}`, '');
  }
  if (chance(0.85)) {
    out.push('Researching progress: ');
    for (let i = 0, k = int(1, 2); i < k; i++) { const r = int(300, 4000); researchRP += r; out.push(`${pick(lineup)} - ${pick(MODULES)}: ${r} RP`); }
    out.push('');
  }
  if (chance(0.24)) out.push('Used items: ', 'Active boosters SL: ', 'Common: +20%SL', '* Personal booster', '+20%SL, gives (+20%SL).', '');

  out.push(`Session: ${id}`, `Total: ${Math.max(0, net)} SL, ${earnedRP} CRP${researchRP ? `, ${researchRP} RP` : ''}`);
  return { text: out.join('\n'), win, sl: Math.max(0, net), rp: earnedRP };
}

// Returns { text, stats }. `count` unique matches, plus round(count * dupes) repeats of earlier ones.
function generate({ count = 1000, seed = 1, dupes = 0, crlf = false } = {}) {
  const rand = rng(seed), ids = new Set(), made = [];
  for (let i = 0; i < count; i++) {
    let id;
    do { id = 'fade' + Array.from({ length: 11 }, () => Math.floor(rand() * 16).toString(16)).join(''); } while (ids.has(id));
    ids.add(id);
    made.push(makeMatch(rand, id));
  }
  const blocks = made.map(m => m.text);
  const extra = Math.round(count * dupes);
  for (let k = 0; k < extra && blocks.length; k++) {
    const src = blocks[Math.floor(rand() * made.length)];
    blocks.splice(blocks.indexOf(src) + 1 + Math.floor(rand() * (blocks.length - blocks.indexOf(src))), 0, src);
  }
  const banner = [`FAKE STRESS-TEST DATA — generated by tests/generate-matches.js (seed ${seed}, ${count} matches${extra ? ` + ${extra} repeats` : ''}). Not real War Thunder results.`, '', ''].join('\n');
  let text = banner + blocks.join('\n\n') + '\n';
  if (crlf) text = text.replace(/\n/g, '\r\n');
  const wins = made.filter(m => m.win).length;
  return { text, stats: { unique: count, repeats: extra, wins, winRate: count ? +(100 * wins / count).toFixed(1) : 0, sl: sum(made, m => m.sl), rp: sum(made, m => m.rp), bytes: Buffer.byteLength(text) } };
}

module.exports = { generate };

if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
  if (args.includes('--help') || args.includes('-h')) { console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n\/\* ?/, '')); process.exit(0); }
  const { text, stats } = generate({ count: +opt('count', 1000), seed: +opt('seed', 1), dupes: +opt('dupes', 0), crlf: args.includes('--crlf') });
  const out = opt('out', null);
  if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, text); } else process.stdout.write(text);
  console.error(`${stats.unique} matches (+${stats.repeats} repeats), ${stats.winRate}% wins, ${stats.sl} SL, ${stats.rp} RP, ${(stats.bytes / 1048576).toFixed(1)} MB${out ? ' → ' + out : ''}`);
}
