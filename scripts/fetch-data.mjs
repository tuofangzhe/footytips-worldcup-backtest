// Download the martj42/international_results dataset (CC0) to data/results.csv.
// Uses a 6-hour cache so repeated runs don't hammer the upstream repo.
import { writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(__dirname, '../data/results.csv');
const CSV_URL = 'https://raw.githubusercontent.com/martj42/international_results/master/results.csv';

if (existsSync(CACHE) && Date.now() - statSync(CACHE).mtimeMs < 6 * 3600e3) {
  console.log('Using cached data/results.csv (less than 6h old)');
} else {
  console.log('Downloading martj42/international_results (CC0) …');
  const csv = await (await fetch(CSV_URL)).text();
  writeFileSync(CACHE, csv);
  console.log(`Saved ${(csv.length / 1e6).toFixed(1)} MB to data/results.csv`);
}
