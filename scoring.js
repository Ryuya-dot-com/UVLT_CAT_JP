const GH_NODES = [
  -4.499990707309392, -3.669950373404453, -2.967166927905603, -2.325732486173858,
  -1.7199925751864888, -1.1361155852109206, -0.5650695832555758, 0,
  0.5650695832555758, 1.1361155852109206, 1.7199925751864888, 2.325732486173858,
  2.967166927905603, 3.669950373404453, 4.499990707309392
];

const GH_WEIGHTS = [
  1.522475804253517e-9, 1.0591155477110666e-6, 0.00010000444123249987,
  0.002778068842912775, 0.030780033872546083, 0.15848891579593575,
  0.41202868749889863, 0.5641003087264175, 0.41202868749889863,
  0.15848891579593575, 0.030780033872546083, 0.002778068842912775,
  0.00010000444123249987, 1.0591155477110666e-6, 1.522475804253517e-9
];

function logistic(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function thetaGrid(model) {
  const min = Number(model.thetaGrid.min);
  const max = Number(model.thetaGrid.max);
  const step = Number(model.thetaGrid.step);
  const values = [];
  for (let value = min; value <= max + step / 2; value += step) {
    values.push(Number(value.toFixed(8)));
  }
  return values;
}

function normalLogDensity(value, mean, sd) {
  const z = (value - mean) / sd;
  return -0.5 * z * z - Math.log(sd) - 0.5 * Math.log(2 * Math.PI);
}

function normalizeWeights(weights) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) throw new Error("Posterior normalization failed");
  return weights.map(value => value / total);
}

function summarize(grid, weights) {
  const theta = grid.reduce((sum, value, index) => sum + value * weights[index], 0);
  const variance = grid.reduce((sum, value, index) => sum + ((value - theta) ** 2) * weights[index], 0);
  let mapIndex = 0;
  weights.forEach((weight, index) => {
    if (weight > weights[mapIndex]) mapIndex = index;
  });
  const edgeWidth = Math.min(5, Math.floor(weights.length / 4));
  const lowerEdgeMass = weights.slice(0, edgeWidth).reduce((sum, value) => sum + value, 0);
  const upperEdgeMass = weights.slice(-edgeWidth).reduce((sum, value) => sum + value, 0);
  return {
    theta,
    variance,
    se: Math.sqrt(Math.max(0, variance)),
    map: grid[mapIndex],
    lowerEdgeMass,
    upperEdgeMass,
    boundaryFlag: lowerEdgeMass > 0.01 || upperEdgeMass > 0.01 || mapIndex < edgeWidth || mapIndex >= weights.length - edgeWidth
  };
}

function patternOutcomes(pattern, itemCount) {
  return Array.from({ length: itemCount }, (_, index) => Boolean(pattern & (1 << index)));
}

export function patternIndexFromOutcomes(outcomes) {
  return outcomes.reduce((pattern, outcome, index) => pattern + (outcome ? (1 << index) : 0), 0);
}

function testletLikelihood(testlet, theta, outcomes, guessing) {
  const variance = Math.max(0, Number(testlet.testletVariance) || 0);
  const sigma = Math.sqrt(variance);
  let marginal = 0;
  for (let q = 0; q < GH_NODES.length; q += 1) {
    const gamma = Math.SQRT2 * sigma * GH_NODES[q];
    let conditional = 1;
    for (let itemIndex = 0; itemIndex < testlet.items.length; itemIndex += 1) {
      const item = testlet.items[itemIndex];
      const rasch = logistic(theta - item.difficulty + gamma);
      const probability = guessing + (1 - guessing) * rasch;
      conditional *= outcomes[itemIndex] ? probability : (1 - probability);
    }
    marginal += (GH_WEIGHTS[q] / Math.sqrt(Math.PI)) * conditional;
  }
  return Math.max(Number.MIN_VALUE, marginal);
}

function buildTestletCache(testlet, grid, guessing) {
  const patternCount = 2 ** testlet.items.length;
  const likelihoodByPattern = Array.from({ length: patternCount }, () => new Float64Array(grid.length));
  for (let pattern = 0; pattern < patternCount; pattern += 1) {
    const outcomes = patternOutcomes(pattern, testlet.items.length);
    for (let thetaIndex = 0; thetaIndex < grid.length; thetaIndex += 1) {
      likelihoodByPattern[pattern][thetaIndex] = testletLikelihood(testlet, grid[thetaIndex], outcomes, guessing);
    }
  }
  return { likelihoodByPattern };
}

export class TestletScorer {
  constructor(pack) {
    this.pack = pack;
    this.grid = thetaGrid(pack.model);
    this.cache = new Map();
    this.testletMap = new Map(pack.testlets.map(testlet => [testlet.testletId, testlet]));
  }

  createPrior() {
    const mean = Number(this.pack.model.priorMean);
    const sd = Number(this.pack.model.priorSD);
    const logWeights = this.grid.map(theta => normalLogDensity(theta, mean, sd));
    const max = Math.max(...logWeights);
    const weights = normalizeWeights(logWeights.map(value => Math.exp(value - max)));
    return { grid: this.grid, weights, summary: summarize(this.grid, weights) };
  }

  getCache(testletId) {
    if (!this.cache.has(testletId)) {
      const testlet = this.testletMap.get(testletId);
      if (!testlet) throw new Error(`Unknown testlet: ${testletId}`);
      this.cache.set(testletId, buildTestletCache(testlet, this.grid, Number(this.pack.model.guessing) || 0));
    }
    return this.cache.get(testletId);
  }

  update(posterior, testletId, outcomes) {
    const testlet = this.testletMap.get(testletId);
    if (!testlet) throw new Error(`Unknown testlet: ${testletId}`);
    if (!Array.isArray(outcomes) || outcomes.length !== testlet.items.length || outcomes.some(value => typeof value !== "boolean")) {
      throw new Error(`Outcomes for ${testletId} must contain exactly ${testlet.items.length} Boolean values`);
    }
    const cache = this.getCache(testletId);
    const pattern = patternIndexFromOutcomes(outcomes);
    const likelihood = cache.likelihoodByPattern[pattern];
    const weights = normalizeWeights(posterior.weights.map((weight, index) => weight * likelihood[index]));
    return { grid: this.grid, weights, summary: summarize(this.grid, weights) };
  }

  expectedVarianceReduction(posterior, testletId) {
    const cache = this.getCache(testletId);
    let expectedVariance = 0;
    for (let pattern = 0; pattern < cache.likelihoodByPattern.length; pattern += 1) {
      const likelihood = cache.likelihoodByPattern[pattern];
      let patternProbability = 0;
      for (let index = 0; index < posterior.weights.length; index += 1) {
        patternProbability += posterior.weights[index] * likelihood[index];
      }
      if (!(patternProbability > 0)) continue;
      const conditional = posterior.weights.map((weight, index) => (weight * likelihood[index]) / patternProbability);
      expectedVariance += patternProbability * summarize(this.grid, conditional).variance;
    }
    return Math.max(0, posterior.summary.variance - expectedVariance);
  }

  selectNext(posterior, administeredIds = []) {
    const administered = new Set(administeredIds);
    const candidates = this.pack.testlets
      .filter(testlet => !administered.has(testlet.testletId))
      .map(testlet => ({
        testlet,
        expectedVarianceReduction: this.expectedVarianceReduction(posterior, testlet.testletId)
      }))
      .sort((left, right) => right.expectedVarianceReduction - left.expectedVarianceReduction ||
        left.testlet.testletId.localeCompare(right.testlet.testletId));
    return candidates[0] || null;
  }

  score(responses) {
    let posterior = this.createPrior();
    const administered = new Set();
    responses.forEach(response => {
      if (administered.has(response.testletId)) throw new Error(`Duplicate testlet response: ${response.testletId}`);
      administered.add(response.testletId);
      posterior = this.update(posterior, response.testletId, response.outcomes);
    });
    return posterior;
  }

  shouldStop(posterior, administeredCount, limits = this.pack.cat) {
    const minTestlets = Number(limits.minTestlets ?? limits.min);
    const maxTestlets = Number(limits.maxTestlets ?? limits.max);
    const targetSE = Number(limits.targetSE);
    if (administeredCount >= maxTestlets) return "max_testlets";
    if (administeredCount < minTestlets) return null;
    if (!posterior.summary.boundaryFlag && posterior.summary.se <= targetSE) return "target_se";
    return null;
  }
}
