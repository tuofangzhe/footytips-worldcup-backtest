// Walk-forward backtest of the Elo + Poisson model across all 22 World Cups
// (1930–2022). Replays every international match since 1872 in date order;
// for each historical World Cup match it predicts using only the Elo
// available before kick-off, then updates ratings. No future information
// can leak into any prediction.
//
// Usage: npm run backtest   (downloads the open dataset first if needed)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { predictMatch } from './poisson.mjs';
import { START_ELO, eloDelta } from './elo.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, '../data/results.csv');
const OUT_PATH = resolve(__dirname, '../results/backtest.json');
const BACKTEST_MAX_YEAR = 2022; // 2026 runs live at footytips.io/track-record/, settled publicly

// Minimal CSV parser (the dataset quotes some team names).
function parseLine(l) {
  const out = []; let cur = '', q = false;
  for (const ch of l) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const csv = readFileSync(CSV_PATH, 'utf8');
const matches = csv.split('\n').filter(Boolean).slice(1).map(parseLine)
  .map((c) => ({ date: c[0], home: c[1], away: c[2], hs: c[3], as: c[4], tour: c[5], neutral: c[8] === 'TRUE' }))
  .filter((m) => m.hs !== '' && m.hs !== 'NA' && m.as !== 'NA')
  .sort((a, b) => (a.date < b.date ? -1 : 1));

const elo = new Map();
const rating = (t) => elo.get(t) ?? START_ELO;

const bt = { n: 0, hit: 0, brier: 0, byYear: {} };

for (const m of matches) {
  const hs = +m.hs, as = +m.as;
  const eh = rating(m.home), ea = rating(m.away);
  const year = +m.date.slice(0, 4);

  // Predict BEFORE updating Elo with this result — that is the whole point.
  if (m.tour === 'FIFA World Cup' && year <= BACKTEST_MAX_YEAR) {
    const p = predictMatch(eh, ea, { homeAdv: m.neutral ? 0 : 100 });
    const [ph, pd, pa] = [p.p_home, p.p_draw, p.p_away];
    const actual = hs > as ? 'H' : as > hs ? 'A' : 'D';
    const pred = ph >= pd && ph >= pa ? 'H' : pa >= pd ? 'A' : 'D';
    bt.n++; (bt.byYear[year] ??= { n: 0, hit: 0 }).n++;
    if (pred === actual) { bt.hit++; bt.byYear[year].hit++; }
    const o = actual === 'H' ? [1, 0, 0] : actual === 'D' ? [0, 1, 0] : [0, 0, 1];
    bt.brier += (ph - o[0]) ** 2 + (pd - o[1]) ** 2 + (pa - o[2]) ** 2;
  }

  const delta = eloDelta(eh, ea, hs, as, m.tour, m.neutral);
  elo.set(m.home, eh + delta);
  elo.set(m.away, ea - delta);
}

const editions = Object.keys(bt.byYear).map(Number).sort((a, b) => a - b);
const byYear = Object.fromEntries(
  Object.entries(bt.byYear).sort().map(([y, v]) => [y, +(v.hit / v.n * 100).toFixed(0)]),
);
const result = {
  computedAt: new Date().toISOString(),
  historyMatches: matches.length,
  backtest: {
    editions,
    games: bt.n,
    hitRate: +(bt.hit / bt.n * 100).toFixed(1),
    brier: +(bt.brier / bt.n).toFixed(3),
    byYear,
  },
};
writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));

// ---- Pretty terminal report ----
const pad = (s, n) => String(s).padEnd(n);
console.log('\nWorld Cup backtest — walk-forward Elo + Poisson (no future data)');
console.log(`Matches: ${bt.n} across ${editions.length} editions (${editions[0]}–${editions.at(-1)})\n`);
const half = Math.ceil(editions.length / 2);
console.log(pad('Edition', 9) + pad('Hit rate', 12) + pad('Edition', 9) + 'Hit rate');
for (let i = 0; i < half; i++) {
  const l = editions[i], r = editions[i + half];
  console.log(
    pad(l, 9) + pad(byYear[l] + '%', 12) +
    (r ? pad(r, 9) + byYear[r] + '%' : ''),
  );
}
console.log('─'.repeat(42));
console.log(`Overall: ${result.backtest.hitRate}%   Brier: ${result.backtest.brier}`);
console.log('Baselines: random 33.3% · always-favourite ~45%');
console.log(`\nWritten to results/backtest.json (dataset: ${matches.length} matches, martj42, CC0)`);
