// Walk-forward Elo over the full history of international football.
// Standard World Football Elo shape: K scaled by competition importance,
// goal-difference multiplier, ±100 Elo home advantage on non-neutral venues.
// Every team starts at 1500; ratings are built purely from results — no
// hand-set seeds.

export const START_ELO = 1500;

// K factor by competition importance.
export function kFactor(tournament) {
  const t = tournament.toLowerCase();
  if (t === 'fifa world cup') return 60;
  if (t.includes('world cup qual')) return 40;
  if (['uefa euro', 'copa', 'africa cup', 'asian cup', 'gold cup', 'confederations', 'nations league']
    .some((x) => t.includes(x))) return 45;
  if (t.includes('friendly')) return 20;
  return 30;
}

// Goal-difference multiplier (World Football Elo convention).
export function goalMultiplier(goalDiff) {
  const gd = Math.abs(goalDiff);
  return gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
}

/**
 * Update both ratings after one match. Returns the rating delta applied to
 * the home team (the away team gets -delta).
 */
export function eloDelta(eloHome, eloAway, homeScore, awayScore, tournament, neutral) {
  const dr = eloHome - eloAway + (neutral ? 0 : 100);
  const expected = 1 / (1 + 10 ** (-dr / 400));
  const actual = homeScore > awayScore ? 1 : homeScore === awayScore ? 0.5 : 0;
  return kFactor(tournament) * goalMultiplier(homeScore - awayScore) * (actual - expected);
}
