import { TestletScorer } from './scoring.js?v=jp-0.2.0';
import { PRACTICE_TESTLETS } from './practice.js?v=jp-0.2.0';
import { VERSION, normalizeIdentity, validatePack, resultRecord, resultCsv } from './results.js?v=jp-0.2.0';

const $ = id => document.getElementById(id);
let pack, bankHash, scorer, posterior, current, session, record, identity;
let stage = 'welcome', practiceIndex = 0, practiceReviewed = false, currentStarted = 0, saved = false;
const hash = async raw => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))].map(b => b.toString(16).padStart(2,'0')).join('');
function fail(error) { $('error').textContent = `処理を完了できませんでした。${error.message}`; $('error').hidden = false; }
function on(id, event, callback) {
  $(id).addEventListener(event, async e => { e.preventDefault(); $('error').hidden = true; try { await callback(); } catch (error) { fail(error); } });
}
function show(name) {
  for (const id of ['welcome','task','result']) $(id).hidden = id !== name;
}
function choices() {
  return current.items.map((_, i) => $(`answer-${i}`).value === '' ? null : Number($(`answer-${i}`).value));
}
function validChoices(values) {
  if (values.some(v => !Number.isInteger(v) || v < 0 || v > 5)) return '3つすべての意味に回答してください。';
  if (new Set(values).size !== 3) return '同じ語を2回選ぶことはできません。';
  return '';
}
function renderTask() {
  const practice = stage === 'practice';
  show('task');
  $('task-title').textContent = practice ? `練習 ${practiceIndex + 1} / ${PRACTICE_TESTLETS.length}` : '最も合う語を選んでください';
  $('progress').hidden = practice;
  $('progress').value = session?.responses.length || 0;
  $('progress').max = pack.cat.maxTestlets;
  $('progress-label').textContent = practice ? '練習は結果に含まれません。' : `回答済み ${session.responses.length}セット ／ 最大${pack.cat.maxTestlets}セット`;
  $('progress-help').textContent = practice ? '回答後に正答を確認できます。' : 'バーは最大セット数に対する進み具合です。終了までの残り問題数ではありません。';
  $('elapsed').textContent = '';
  $('stop').hidden = practice;
  $('answer-message').textContent = '';
  $('submit').textContent = practice ? '練習の回答を確認' : '回答を確定して次へ';
  $('submit').disabled = false;
  $('words').replaceChildren(...current.options.map(word => {
    const li = document.createElement('li'); li.textContent = word; return li;
  }));
  $('questions').replaceChildren(...current.items.map((item, i) => {
    const row = document.createElement('div'); row.className = 'question';
    const label = document.createElement('label'); label.htmlFor = `answer-${i}`;
    label.textContent = `${i + 1}. ${item.prompt}`; label.lang = 'en';
    const select = document.createElement('select'); select.id = `answer-${i}`; select.lang = 'en';
    select.add(new Option('選んでください', ''));
    current.options.forEach((word, j) => select.add(new Option(word, String(j))));
    row.append(label, select); return row;
  }));
  currentStarted = Date.now();
  $('task-title').focus();
}
function startMain() {
  stage = 'main';
  session = { sessionId: crypto.randomUUID(), identity, startedAt: new Date().toISOString(), responses: [] };
  posterior = scorer.createPrior();
  current = scorer.selectNext(posterior, []).testlet;
  renderTask();
}
function finish(reason) {
  if (stage !== 'main') return;
  const draft = reason === 'user_stop' ? { testletId: current.testletId, choices: choices(), elapsedMs: Math.max(0, Date.now()-currentStarted) } : null;
  record = resultRecord(pack, bankHash, session, posterior, reason, new Date().toISOString(), draft);
  stage = 'result'; show('result');
  $('completion-reason').textContent = {
    target_se: 'すべての回答が完了しました。',
    max_testlets: 'すべての回答が完了しました。',
    user_stop: 'ご自身の操作で終了しました。回答途中のセットは採点していません。'
  }[reason];
  const correct = record.bands.reduce((n, b) => n+b.correct, 0);
  $('result-counts').textContent = `本番 ${record.responses.length}セット・${record.answeredItems}問に回答し、${correct}問正解しました。`;
  $('bands').replaceChildren(...record.bands.map(band => {
    const tr = document.createElement('tr');
    for (const value of [band.band.toUpperCase(), band.answered ? `${band.correct} ／ ${band.answered}` : '今回は出題されていません']) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    return tr;
  }));
  $('zero-note').hidden = record.responses.length !== 0;
  $('result-title').focus();
  try { download('csv'); }
  catch { $('save-status').textContent = '自動ダウンロードを開始できませんでした。「結果CSVをもう一度保存」を押してください。'; }
}

on('identity-form', 'submit', () => {
  $('identity-message').textContent = '';
  try { identity = normalizeIdentity({participantName:$('participant-name').value,studentId:$('student-id').value}); }
  catch (error) { $('identity-message').textContent = error.message; return; }
  stage = 'practice'; practiceIndex = 0; practiceReviewed = false;
  current = PRACTICE_TESTLETS[practiceIndex]; renderTask();
});
on('answer-form', 'submit', () => {
  if (!['practice','main'].includes(stage)) return;
  if (stage === 'practice' && practiceReviewed) {
    practiceIndex++; practiceReviewed = false;
    if (practiceIndex === PRACTICE_TESTLETS.length) startMain();
    else { current = PRACTICE_TESTLETS[practiceIndex]; renderTask(); }
    return;
  }
  const values = choices(), message = validChoices(values);
  if (message) { $('answer-message').textContent = message; return; }
  const outcomes = current.items.map((item, i) => current.options[values[i]] === item.correctOption);
  if (stage === 'practice') {
    practiceReviewed = true;
    current.items.forEach((_, i) => { $(`answer-${i}`).disabled = true; });
    $('answer-message').textContent = `${outcomes.filter(Boolean).length} / 3問正解。正答：${current.items.map((item, i) => `${i+1}. ${item.correctOption}`).join('、')}`;
    $('submit').textContent = practiceIndex + 1 === PRACTICE_TESTLETS.length ? '本番を開始する' : '次の練習へ';
    return;
  }
  const updated = scorer.update(posterior, current.testletId, outcomes);
  session.responses.push({ testletId: current.testletId, band: current.band, itemIds: current.items.map(i => i.itemId),
    choices: values, outcomes, submittedAt: new Date().toISOString(), elapsedMs: Math.max(0,Date.now()-currentStarted), estimate: { ...updated.summary } });
  posterior = updated;
  const stop = scorer.shouldStop(posterior, session.responses.length);
  if (stop) { finish(stop); return; }
  current = scorer.selectNext(posterior, session.responses.map(r => r.testletId)).testlet;
  renderTask();
});
on('stop','click',() => finish('user_stop'));
function download(kind) {
  if (!record) throw new Error('結果がまだありません。');
  const data = kind === 'json' ? JSON.stringify(record,null,2) : resultCsv(record);
  const blob = new Blob([data], { type: kind === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `UVLT_CAT_JP_${record.sessionId}.${kind}`;
  document.body.append(link);
  try { link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  saved = true;
  $('save-status').textContent = 'ダウンロードを開始しました。見つからない場合は、保存ボタンをもう一度押してください。';
}
on('download-json','click',() => download('json'));
on('download-csv','click',() => download('csv'));
on('restart','click',() => { if (saved || confirm('結果を保存していない場合、この記録は失われます。最初からやり直しますか？')) location.reload(); });
window.addEventListener('beforeunload', event => {
  if (stage === 'main' || (stage === 'result' && !saved)) { event.preventDefault(); event.returnValue = ''; }
});
setInterval(() => {
  if (stage === 'main') $('elapsed').textContent = `経過 ${Math.floor(Math.max(0,Date.now()-Date.parse(session.startedAt))/60000)}分`;
}, 1000);

try {
  const [bankResponse, manifestResponse] = await Promise.all([fetch('bank.json',{cache:'no-store'}),fetch('manifest.json',{cache:'no-store'})]);
  if (!bankResponse.ok || !manifestResponse.ok) throw new Error('問題データを取得できません。ページを再読み込みしてください。');
  const raw = await bankResponse.text(), manifest = await manifestResponse.json();
  bankHash = await hash(raw);
  if (manifest.version !== VERSION || manifest.files['bank.json'] !== bankHash) throw new Error('公開データの版が一致しません。ページを再読み込みしてください。');
  pack = validatePack(JSON.parse(raw)); scorer = new TestletScorer(pack);
  $('start').disabled = false; $('start').textContent = '練習から始める';
} catch (error) { fail(error); $('start').textContent = '読み込みできませんでした'; }
