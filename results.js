export const VERSION = 'jp-0.2.0';

export function normalizeIdentity(input) {
  const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const participantName = clean(input?.participantName), studentId = clean(input?.studentId);
  if (!participantName) throw new Error('氏名を入力してください。');
  if (!studentId) throw new Error('学籍番号を入力してください。');
  if (participantName.length > 100 || studentId.length > 64) throw new Error('氏名は100文字、学籍番号は64文字以内で入力してください。');
  return Object.freeze({ participantName, studentId });
}

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
    schemaVersion: 'uvlt-jp-cat-result-2', appVersion: VERSION,
    purpose: 'public_technical_demo', operationallyFrozen: false,
    packId: pack.packId, bankSHA256: bankHash, model: structuredClone(pack.model), limits: structuredClone(pack.cat),
    sessionId: session.sessionId, identity: normalizeIdentity(session.identity), startedAt: session.startedAt, completedAt,
    stopReason: reason, minimumMet, precisionReached, answeredItems: responses.length * 3,
    finalEstimate: { ...posterior.summary, interval95: interval95(posterior), intervalType: 'model-conditional equal-tail posterior interval' },
    bands, responses, unscoredDraft: structuredClone(draft),
    practiceIncludedInScore: false, elapsedDefinition: 'wall-clock time including background-tab time'
  };
}

export function resultCsv(record) {
  const columns = ['schema_version','session_id','participant_name','student_id','purpose','app_version','pack_id','bank_sha256',
    'started_at','completed_at','stop_reason','minimum_met','precision_reached','answered_items','row_type',
    'testlet_ordinal','testlet_id','band','item_id','selected_option_position','correct','testlet_elapsed_ms',
    'theta_after_testlet','posterior_sd_after_testlet','final_theta','final_posterior_sd'];
  const shared = [record.schemaVersion,record.sessionId,record.identity.participantName,record.identity.studentId,
    record.purpose,record.appVersion,record.packId,record.bankSHA256,record.startedAt,record.completedAt,
    record.stopReason,record.minimumMet,record.precisionReached,record.answeredItems];
  const rows = record.responses.flatMap((r, order) => r.itemIds.map((id, i) => [
    ...shared,'item_response',order+1,r.testletId,r.band,id,r.choices[i]+1,r.outcomes[i],r.elapsedMs,
    r.estimate.theta,r.estimate.se,record.finalEstimate.theta,record.finalEstimate.se
  ]));
  if (!rows.length) rows.push([...shared,'session_summary',...Array(9).fill(''),record.finalEstimate.theta,record.finalEstimate.se]);
  const cell = value => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"','""') + '"';
  };
  return '\uFEFF' + [columns,...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
