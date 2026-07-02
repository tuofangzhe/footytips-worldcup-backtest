// Poisson scoreline model — converts an Elo gap into expected goals, then into
// win/draw/loss probabilities and a full scoreline distribution.
// This file is a verbatim extract of the model running on footytips.io.

// Model parameters, calibrated on the 448 modern-era World Cup matches (1998+):
// baseGoals minimises Over-2.5 Brier (modern average is ~2.54 goals/game);
// eloToGoals and rho minimise 1X2 Brier.
export const MODEL_PARAMS = { baseGoals: 1.20, eloToGoals: 0.0024, rho: -0.04 };

export function poissonPmf(k, lambda) {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / fact;
}

// Dixon-Coles low-score correction: multiply the 0-0/0-1/1-0/1-1 cells by tau,
// then renormalise. rho < 0 lifts 0-0 and 1-1, fixing the slight draw
// underestimation of independent Poissons.
export function dcTau(x, y, lambdaHome, lambdaAway, rho) {
  if (x === 0 && y === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (x === 0 && y === 1) return 1 + lambdaHome * rho;
  if (x === 1 && y === 0) return 1 + lambdaAway * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/**
 * Predict a match from the two teams' Elo ratings.
 * @param {number} eloHome
 * @param {number} eloAway
 * @param {object} opts
 *   baseGoals   baseline expected goals per team
 *   homeAdv     home advantage in Elo points (pass 0 for neutral venues)
 *   eloToGoals  log-linear effect of each Elo point on lambda
 *   maxGoals    scoreline matrix cap
 *   rho         Dixon-Coles correction parameter
 */
export function predictMatch(eloHome, eloAway, opts = {}) {
  const {
    baseGoals = MODEL_PARAMS.baseGoals,
    homeAdv = 100, // World Football Elo convention; callers pass 0 for neutral venues
    eloToGoals = MODEL_PARAMS.eloToGoals,
    maxGoals = 8,
    rho = MODEL_PARAMS.rho,
  } = opts;

  const dr = eloHome + homeAdv - eloAway;
  const lambdaHome = baseGoals * Math.exp(eloToGoals * dr);
  const lambdaAway = baseGoals * Math.exp(-eloToGoals * dr);

  const ph = [], pa = [];
  for (let k = 0; k <= maxGoals; k++) {
    ph[k] = poissonPmf(k, lambdaHome);
    pa[k] = poissonPmf(k, lambdaAway);
  }

  let pHome = 0, pDraw = 0, pAway = 0, over25 = 0, btts = 0;
  const best = {
    HOME: { p: -1, i: 1, j: 0 },
    DRAW: { p: -1, i: 1, j: 1 },
    AWAY: { p: -1, i: 0, j: 1 },
  };
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = ph[i] * pa[j] * dcTau(i, j, lambdaHome, lambdaAway, rho);
      if (i > j) {
        pHome += p;
        if (p > best.HOME.p) best.HOME = { p, i, j };
      } else if (i === j) {
        pDraw += p;
        if (p > best.DRAW.p) best.DRAW = { p, i, j };
      } else {
        pAway += p;
        if (p > best.AWAY.p) best.AWAY = { p, i, j };
      }
      if (i + j >= 3) over25 += p;
      if (i >= 1 && j >= 1) btts += p;
    }
  }
  // Renormalise (the maxGoals cutoff loses a tiny amount of probability mass).
  const tot = pHome + pDraw + pAway;
  const topOutcome = pHome >= pDraw && pHome >= pAway ? 'HOME'
    : pAway >= pDraw ? 'AWAY' : 'DRAW';
  const score = best[topOutcome];
  return {
    p_home: pHome / tot,
    p_draw: pDraw / tot,
    p_away: pAway / tot,
    // The representative scoreline follows the model's top outcome, so a
    // home-win favourite never displays a 1-1 "most likely score".
    score_home: score.i,
    score_away: score.j,
    lambda_home: lambdaHome,
    lambda_away: lambdaAway,
    over25_prob: over25 / tot,
    btts_prob: btts / tot,
  };
}
