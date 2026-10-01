export const VERSION = 'jp-0.1.0';

export function validatePack(pack) {
  if (pack.model?.modelId !== 'M3_RASCH_TESTLET_BAND_G0' || pack.model.calibrationSampleSize !== 463 ||
      pack.developmentOnly !== true || pack.operationallyFrozen !== false || pack.testlets?.length !== 50 ||
      pack.cat.minTestlets !== 6 || pack.cat.maxTestlets !== 14 || pack.cat.targetSE !== 0.48) {
    throw new Error('日本語463名版の開発パックを確認できません。');
  }
  const ids = new Set();
  for (const t of pack.testlets) {
    if (ids.has(t.testletId) || t.items?.length !== 3 || t.options?.length !== 6 ||
        !Number.isFinite(t.testletVariance) || t.testletVariance < 0) throw new Error('バンクの構造が不正です。');
    ids.add(t.testletId);
    for (const i of t.items) {
      if (ids.has(i.itemId) || !Number.isFinite(i.difficulty) || !t.options.includes(i.correctOption)) throw new Error('項目の対応が不正です。');
      ids.add(i.itemId);
    }
  }
  return pack;
}

export function interval95(posterior) {
  let sum = 0, lower, upper;
  posterior.weights.forEach((weight, i) => {
    sum += weight;
    if (lower === undefined && sum >= 0.025) lower = posterior.grid[i];
    if (upper === undefined && sum >= 0.975) upper = posterior.grid[i];
  });
  return [lower ?? posterior.grid[0], upper ?? posterior.grid.at(-1)];
}

export function resultRecord(pack, bankHash, session, posterior, reason, completedAt, draft = null) {
  const responses = structuredClone(session.responses);
  const bands = ['1k','2k','3k','4k','5k'].map(band => {
    const rows = responses.filter(r => r.band === band);
    return { band, answered: rows.length * 3, correct: rows.reduce((n, r) => n + r.outcomes.filter(Boolean).length, 0) };
  });
  const minimumMet = responses.length >= pack.cat.minTestlets;
  const precisionReached = minimumMet && !posterior.summary.boundaryFlag && posterior.summary.se <= pack.cat.targetSE;
  return {
    schemaVersion: 'uvlt-jp-cat-demo-result-1', appVersion: VERSION,
    purpose: 'public_technical_demo', operationallyFrozen: false,
    packId: pack.packId, bankSHA256: bankHash, model: structuredClone(pack.model), limits: structuredClone(pack.cat),
    sessionId: session.sessionId, startedAt: session.startedAt, completedAt,
    stopReason: reason, minimumMet, precisionReached, answeredItems: responses.length * 3,
    finalEstimate: { ...posterior.summary, interval95: interval95(posterior), intervalType: 'model-conditional equal-tail posterior interval' },
    bands, responses, unscoredDraft: structuredClone(draft),
    practiceIncludedInScore: false, elapsedDefinition: 'wall-clock time including background-tab time'
  };
}

export function resultCsv(record) {
  const columns = ['session_id','purpose','app_version','pack_id','bank_sha256','stop_reason','minimum_met','precision_reached',
    'testlet_ordinal','testlet_id','band','item_id','selected_option_position','correct','testlet_elapsed_ms',
    'theta_after_testlet','posterior_sd_after_testlet','final_theta','final_posterior_sd'];
  const rows = record.responses.flatMap((r, order) => r.itemIds.map((id, i) => [
    record.sessionId,record.purpose,record.appVersion,record.packId,record.bankSHA256,record.stopReason,
    record.minimumMet,record.precisionReached,order+1,r.testletId,r.band,id,r.choices[i]+1,r.outcomes[i],r.elapsedMs,
    r.estimate.theta,r.estimate.se,record.finalEstimate.theta,record.finalEstimate.se
  ]));
  const cell = value => '"' + String(value ?? '').replaceAll('"','""') + '"';
  return '\uFEFF' + [columns,...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
