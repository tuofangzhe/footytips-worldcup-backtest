// Render results/backtest.json into an SVG bar chart (hit rate by edition).
// Usage: npm run chart
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { backtest: b } = JSON.parse(readFileSync(resolve(__dirname, '../results/backtest.json'), 'utf8'));

const W = 900, H = 380, PAD = { l: 48, r: 175, t: 44, b: 42 }; // 右侧留出基线标签区,避免压在柱子上
const years = b.editions;
const bw = (W - PAD.l - PAD.r) / years.length;
const y = (v) => PAD.t + (100 - v) / 100 * (H - PAD.t - PAD.b);

let bars = '';
years.forEach((yr, i) => {
  const v = b.byYear[yr];
  const x = PAD.l + i * bw;
  bars += `<rect x="${(x + 2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" fill="#2f9e63" rx="2"/>`;
  bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y(v) - 5).toFixed(1)}" font-size="11" text-anchor="middle" fill="#333">${v}</text>`;
  bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - PAD.b + 16}" font-size="10" text-anchor="middle" fill="#555" transform="rotate(0)">${String(yr).slice(2)}</text>`;
});

const grid = [33.3, 45, 56.6].map((v, i) => {
  const labels = ['random 33.3%', 'always-favourite ~45%', `overall ${b.hitRate}%`];
  const dash = i === 2 ? '' : 'stroke-dasharray="4 4"';
  const color = i === 2 ? '#c0392b' : '#999';
  return `<line x1="${PAD.l}" x2="${W - PAD.r + 4}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${color}" ${dash} stroke-width="1"/>
  <text x="${W - PAD.r + 8}" y="${(y(v) + 4).toFixed(1)}" font-size="11" text-anchor="start" fill="${color}">${labels[i]}</text>`;
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif">
<rect width="${W}" height="${H}" fill="white"/>
<text x="${PAD.l}" y="24" font-size="16" font-weight="600" fill="#111">World Cup win/draw/loss hit rate by edition — walk-forward Elo + Poisson (${b.games} matches)</text>
${grid}${bars}
<text x="${PAD.l}" y="${H - 8}" font-size="10" fill="#888">Data: martj42/international_results (CC0) · Model &amp; backtest: footytips.io</text>
</svg>`;

writeFileSync(resolve(__dirname, '../results/charts/hit-rate-by-edition.svg'), svg);
console.log('Written results/charts/hit-rate-by-edition.svg');
