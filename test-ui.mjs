// Functional DOM harness; does not replace browser layout verification.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TestletScorer } from './scoring.js';

let elements, blob, count=0, requests=[], downloads=[], blockDownload=false;
class Element {
  constructor(tag='div') { this.tag=tag; this.children=[]; this.listeners={}; this.value=''; this.hidden=false; this.textContent=''; }
  set id(value) { this._id=value; elements.set(value,this); }
  get id() { return this._id; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children=items; }
  add(item) { this.children.push(item); }
  addEventListener(event,fn) { this.listeners[event]=fn; }
  focus() {}
  click() { if (this.tag==='a') { if (blockDownload) throw new Error('download blocked'); downloads.push(this.download); } }
  remove() {}
}
globalThis.Option=class extends Element { constructor(label,value) { super('option'); this.textContent=label; this.value=value; } };
globalThis.window={addEventListener() {}};
globalThis.setInterval=()=>0;
globalThis.setTimeout=fn=>{fn();return 0;};
globalThis.confirm=()=>true;
URL.createObjectURL=value=>{blob=value;return 'blob:test';}; URL.revokeObjectURL=()=>{};
globalThis.fetch=async name=>{
  requests.push(name);
  const raw=readFileSync(new URL(name,import.meta.url),'utf8');
  return {ok:true,text:async()=>raw,json:async()=>JSON.parse(raw)};
};
const $=id=>elements.get(id);
async function page() {
  elements=new Map(); requests=[]; downloads=[]; blockDownload=false;
  const html=readFileSync(new URL('index.html',import.meta.url),'utf8');
  for (const match of html.matchAll(/<(\w+)([^>]*)>/g)) {
    const id=match[2].match(/\bid="([^"]+)"/);
    if (!id) continue;
    const el=new Element(match[1]); el.id=id[1]; el.hidden=/\bhidden\b/.test(match[2]); el.disabled=/\bdisabled\b/.test(match[2]);
  }
  globalThis.document={body:new Element('body'),getElementById:$,createElement:tag=>new Element(tag)};
  globalThis.location={reload(){}};
  await import(`./app.js?ui-test=${++count}`);
  assert.equal($('error').hidden,true,$('error').textContent);
  assert.equal($('start').disabled,false);
}
async function fire(id,event='click') {
  await $(id).listeners[event]({preventDefault(){}});
  assert.equal($('error').hidden,true,$('error').textContent);
}
const fill=()=>[0,1,2].forEach((value,i)=>{$(`answer-${i}`).value=String(value);});
async function begin() {
  $('participant-name').value='  Test Participant  '; $('student-id').value='0012345';
  await fire('identity-form','submit');
  for (let i=0;i<2;i++) { fill(); await fire('answer-form','submit'); await fire('answer-form','submit'); }
}
await page();
await fire('identity-form','submit'); assert.match($('identity-message').textContent,/氏名/); assert.equal($('welcome').hidden,false);
$('participant-name').value='Test'; await fire('identity-form','submit'); assert.match($('identity-message').textContent,/学籍番号/);
await begin();
assert.equal($('task').hidden,false);
await fire('answer-form','submit');
assert.match($('answer-message').textContent,/すべて/);
for (let i=0;i<3;i++) $(`answer-${i}`).value='0';
await fire('answer-form','submit'); assert.match($('answer-message').textContent,/2回/);
let sets=0;
while ($('result').hidden) {
  fill(); await fire('answer-form','submit'); sets++;
  assert.ok(sets<=14);
}
assert.ok(sets>=6);
assert.equal(downloads.length,1,'Completion must trigger CSV without another click');
assert.match(downloads[0],/^UVLT_CAT_JP_[\w-]+\.csv$/);
assert.doesNotMatch(downloads[0],/Participant|0012345/);
const automaticCsv=await blob.text();
assert.match(automaticCsv,/"Test Participant","0012345"/);
assert.equal(automaticCsv.trim().split('\r\n').length,sets*3+1);
await fire('download-json');
const record=JSON.parse(await blob.text());
assert.equal(record.responses.length,sets);
assert.deepEqual(record.identity,{participantName:'Test Participant',studentId:'0012345'});
assert.equal(record.practiceIncludedInScore,false);
assert.equal(record.purpose,'public_technical_demo');
assert.equal(record.unscoredDraft,null);
const pack=JSON.parse(readFileSync(new URL('bank.json',import.meta.url)));
const rescored=new TestletScorer(pack).score(record.responses);
assert.equal(rescored.summary.theta,record.finalEstimate.theta);
assert.equal(rescored.summary.se,record.finalEstimate.se);
assert.equal(new Set(record.responses.map(r=>r.testletId)).size,sets);
await fire('download-csv'); assert.equal(await blob.text(),automaticCsv);
await fire('download-json'); assert.deepEqual(JSON.parse(await blob.text()),record);
assert.deepEqual(requests,['bank.json','manifest.json']);

await page(); await begin(); $('answer-0').value='1'; blockDownload=true;
await fire('stop');
assert.equal($('result').hidden,false); assert.equal(downloads.length,0);
assert.match($('save-status').textContent,/開始できませんでした/);
blockDownload=false;
await fire('download-csv');
const partialCsv=await blob.text();
assert.match(partialCsv,/"session_summary"/); assert.match(partialCsv,/"Test Participant","0012345"/);
assert.equal(partialCsv.trim().split('\r\n').length,2);
await fire('download-json');
const partial=JSON.parse(await blob.text());
assert.equal(partial.responses.length,0);
assert.deepEqual(partial.unscoredDraft.choices,[1,null,null]);
assert.equal(partial.precisionReached,false);
assert.notEqual($('download-csv').disabled,true);
assert.equal($('zero-note').hidden,false);
console.log('PASS: required identity, complete CAT, automatic CSV, identity export, stable retry, blocked download recovery, zero-response summary and partial-set termination.');
