import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TestletScorer } from './scoring.js';
import { PRACTICE_TESTLETS } from './practice.js';
import { validatePack, interval95, resultRecord, resultCsv } from './results.js';

const read = name => readFileSync(new URL(name, import.meta.url));
const pack = JSON.parse(read('bank.json'));
const manifest = JSON.parse(read('manifest.json'));

test('release hashes preserve the exact Japanese development bank, scorer and practice', () => {
  validatePack(pack);
  for (const [name, expected] of Object.entries(manifest.files)) {
    assert.equal(createHash('sha256').update(read(name)).digest('hex'), expected, name);
  }
  for (const [name, source] of Object.entries(manifest.sources)) assert.equal(manifest.files[name], source.sha256);
  assert.equal(pack.model.calibrationPopulation, 'Japanese L1 university development sample');
  assert.equal(pack.model.guessing, 0);
  assert.equal(pack.testlets.flatMap(t => t.items).length, 150);
  for (const t of pack.testlets) assert.equal(t.testletVariance, pack.model.testletVarianceByBand[t.band]);
  const altered = structuredClone(pack); altered.model.modelId = '2PL';
  assert.throws(() => validatePack(altered));
});

test('unscored practice does not repeat main-bank options or targets', () => {
  const words = new Set(pack.testlets.flatMap(t => t.options));
  for (const t of PRACTICE_TESTLETS) {
    assert.equal(t.scored, false);
    assert.equal(t.items.length, 3);
    for (const word of t.options) assert.ok(!words.has(word), word);
  }
});

test('public engine reproduces the source application paths and posterior estimates', () => {
  const golden = JSON.parse(read('golden.json'));
  for (const scenario of golden.scenarios) {
    const scorer = new TestletScorer(pack), responses = [];
    let p = scorer.createPrior();
    assert.ok(Math.abs(p.summary.se-pack.model.priorSD) < 1e-8);
    for (const row of scenario.path) {
      const chosen = scorer.selectNext(p, responses.map(r => r.testletId));
      assert.equal(chosen.testlet.testletId, row.testletId);
      const likelihood = scorer.getCache(row.testletId).likelihoodByPattern;
      for (let i=0; i<p.grid.length; i++) assert.ok(Math.abs(likelihood.reduce((n,x) => n+x[i],0)-1)<1e-12);
      p = scorer.update(p, row.testletId, row.outcomes);
      responses.push(row);
      assert.ok(Math.abs(p.summary.theta-row.theta)<1e-12);
      assert.ok(Math.abs(p.summary.se-row.posteriorSD)<1e-12);
      assert.equal(scorer.shouldStop(p,responses.length),row.stopReason);
    }
    assert.ok(responses.length>=6 && responses.length<=14);
    assert.equal(new Set(responses.map(r => r.testletId)).size,responses.length);
  }
});

test('stop boundaries, partial data, model-conditional intervals and exports stay explicit', () => {
  const scorer = new TestletScorer(pack), p = scorer.createPrior();
  const precise = { summary: {se:.1,boundaryFlag:false} };
  assert.equal(scorer.shouldStop(precise,5),null);
  assert.equal(scorer.shouldStop(precise,6),'target_se');
  assert.equal(scorer.shouldStop(precise,14),'max_testlets');
  assert.equal(scorer.shouldStop({summary:{se:.1,boundaryFlag:true}},6),null);
  assert.deepEqual(interval95({grid:[-1,0,1],weights:[.02,.96,.02]}),[0,0]);
  const draft = {testletId:pack.testlets[0].testletId,choices:[1,null,null]};
  const record = resultRecord(pack,manifest.files['bank.json'],{sessionId:'test',startedAt:'2026-10-01',responses:[]},p,'user_stop','2026-10-01',draft);
  assert.equal(record.answeredItems,0);
  assert.equal(record.precisionReached,false);
  assert.equal(record.purpose,'public_technical_demo');
  assert.deepEqual(record.unscoredDraft,draft);
  assert.equal(record.finalEstimate.se,p.summary.se);
  assert.equal(resultCsv(record).trim().split('\r\n').length,1);
  assert.ok(record.bands.every(b => b.answered===0));
  assert.doesNotMatch(JSON.stringify(record), /correctOption|"prompt"|"options"/);
});
