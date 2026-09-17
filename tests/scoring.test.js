import test from 'node:test';
import assert from 'node:assert/strict';
import { DIMENSIONS, QUESTIONS, TRIGGERS } from '../content.js';
import { scoreAnswers, makeReport, itemScore, bandIndex, makeCheckpoint, validNickname, normalizeNickname } from '../scoring.js';
import { acceptsCode } from '../config.js';
import { freshState, loadState, saveState, validateState } from '../storage.js';
import { RADAR_IDS, radar } from '../visuals.js';

test('30 unique items, 14 independent dimensions, 1 direct + 1 reverse and two context items',()=>{
  assert.equal(QUESTIONS.length,30);assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,30);
  assert.equal(DIMENSIONS.length,14);assert.equal(DIMENSIONS.filter(d=>d.group==='sin').length,7);
  for(const d of DIMENSIONS){const qs=QUESTIONS.filter(q=>q.dimension===d.id);assert.equal(qs.length,2);assert.equal(qs.filter(q=>q.reverse).length,1);assert.equal(d.bands.length,3);}
  assert.ok(QUESTIONS.every((q,i)=>i===0||q.dimension!==QUESTIONS[i-1].dimension));
});
test('both extreme score profiles produce exactly 0 or 100, including reverse items',()=>{
  for(const max of [false,true]){const answers=QUESTIONS.map(q=>max?(q.reverse?0:4):(q.reverse?4:0));const r=scoreAnswers(answers);assert.ok(Object.values(r.scores).every(s=>s===(max?100:0)));assert.ok(Object.values(r.triggers).every(s=>s===(max?100:0)));}
});
test('neutral answers produce 50, full ties explicitly retained, deterministic report',()=>{
  const a=Array(30).fill(2);const r=makeReport(a);assert.ok(Object.values(r.scores).every(s=>s===50));assert.equal(r.sinLeaders.length,7);assert.equal(r.virtueLeaders.length,7);assert.equal(r.actions.length,4);assert.match(r.insight[0],/没有单一/);assert.deepEqual(r,makeReport(a));
});
test('one response changes its own dimension only, virtues never inferred from sins',()=>{
  const a=Array(30).fill(2), before=scoreAnswers(a).scores;a[0]=4;const after=scoreAnswers(a).scores;
  assert.deepEqual(Object.keys(before).filter(id=>before[id]!==after[id]),[QUESTIONS[0].dimension]);
  const high=QUESTIONS.map(q=>q.reverse?0:4);assert.equal(makeReport(high).sinLeaders[0].score,100);assert.equal(makeReport(high).virtueLeaders[0].score,100);
});
test('invalid or missing answers cannot generate a report',()=>{
  for(const a of [[],Array(30).fill(null),Array(30).fill(5),Array(30).fill(-1),Array(30).fill('2'),Array(30).fill(2.5)])assert.throws(()=>scoreAnswers(a));
});
test('trigger scores use their explicitly tagged items and reverse scoring',()=>{
  const a=QUESTIONS.map((_,i)=>i%5),result=scoreAnswers(a);
  for(const t of TRIGGERS){const tagged=QUESTIONS.map((q,i)=>({q,a:a[i]})).filter(({q})=>q.trigger===t.id);assert.ok(tagged.length>0);assert.equal(result.triggers[t.id],Math.round(tagged.reduce((s,{q,a})=>s+itemScore(q,a),0)/tagged.length/4*100));}
  assert.equal(bandIndex(33),0);assert.equal(bandIndex(34),1);assert.equal(bandIndex(66),1);assert.equal(bandIndex(67),2);
});
test('shared code tolerates outer whitespace and case; invalid inputs rejected',()=>{
  for(const s of ['SEVEN2026',' seven2026 ','SeVeN2026'])assert.equal(acceptsCode(s),true);
  for(const s of ['',null,'SEVEN2027','SEVEN 2026'])assert.equal(acceptsCode(s),false);
});
test('state saves/resumes, rejects incompatible or corrupt data and degrades without storage',()=>{
  const map=new Map(),store={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  const state=freshState();state.unlocked=true;state.nickname="测试者";state.stage='quiz';state.answers[0]=3;state.current=1;
  assert.equal(saveState(store,state),true);assert.deepEqual(loadState(store).state,{...state,unlocked:false});
  assert.equal(validateState({...state,version:99}),null);assert.equal(validateState({...state,current:30}),null);
  assert.equal(validateState({...state,stage:'result'}),null);assert.equal(saveState(null,state),false);assert.equal(loadState(null).available,false);
  const resultState={...state,stage:'result',answers:Array(30).fill(2),completedAt:'2026-09-15T00:00:00.000Z'};assert.ok(validateState(resultState));
  assert.deepEqual(freshState().answers,Array(30).fill(null));
});
test('radar contains all dimensions exactly once, sin on left and virtue on right',()=>{
  assert.equal(new Set(RADAR_IDS).size,14);assert.ok(RADAR_IDS.slice(0,7).every(id=>DIMENSIONS.find(d=>d.id===id).group==='sin'));assert.ok(RADAR_IDS.slice(7).every(id=>DIMENSIONS.find(d=>d.id===id).group==='virtue'));
  const svg=radar(scoreAnswers(Array(30).fill(2)).scores);assert.ok(!svg.includes('NaN'));for(const d of DIMENSIONS)assert.ok(svg.includes(d.name));
});


test('checkpoints use only completed answers, at 10, 20, 30',()=>{
  const a=Array(30).fill(null);a.fill(2,0,10);
  assert.match(makeCheckpoint(a,10,'小杏').title,/小杏/);
  assert.match(makeCheckpoint(a,10,'小杏').next,/接下来 10 题/);
  assert.throws(()=>makeCheckpoint(a,20,'小杏'));
  a.fill(2,10,30);assert.match(makeCheckpoint(a,20,'小杏').next,/只剩 10 题/);
  assert.equal(makeCheckpoint(a,30,'小杏').button,'查看我的专属报告');
  const untouched=makeCheckpoint(a,10,'小杏');a[29]=4;assert.deepEqual(makeCheckpoint(a,10,'小杏'),untouched);
});
test('same scores can produce different evidence and context-sensitive report',()=>{
  const a=Array(30).fill(2),b=[...a];
  QUESTIONS.forEach((q,i)=>{if(q.dimension==='pride')b[i]=0;});
  const ra=makeReport(a,'甲'),rb=makeReport(b,'甲');
  assert.deepEqual(ra.scores,rb.scores);assert.notDeepEqual(ra.evidence,rb.evidence);assert.ok(rb.contrasts.length>0);
  const c=[...a];c[29]=4;assert.notDeepEqual(makeReport(c,'甲').actions,ra.actions);
});
test('nickname limits and checkpoint/result persistence validation',()=>{
  assert.equal(normalizeNickname(' 小杏 '),'小杏');assert.equal(validNickname('   '),false);
  assert.equal(validNickname('杏'.repeat(17)),false);assert.equal(validNickname('杏'.repeat(16)),true);
  const s={...freshState(),unlocked:true,nickname:'小杏',stage:'checkpoint',checkpoint:10,answers:Array(30).fill(null)};
  s.answers.fill(2,0,10);assert.ok(validateState(s));
  assert.equal(validateState({...s,checkpoint:20}),null);
  assert.equal(validateState({...s,nickname:''}),null);
});

test('every visit requires code, including legacy unlocked results and checkpoints',()=>{
  const completed={...freshState(),unlocked:true,nickname:'小杏',stage:'result',answers:Array(30).fill(2),completedAt:'2026-09-16T00:00:00Z'};
  const store={getItem:()=>JSON.stringify(completed)};
  const restored=loadState(store).state;
  assert.equal(restored.unlocked,false);
  assert.equal(restored.stage,'result');
  assert.deepEqual(restored.answers,completed.answers);
  const partial={...completed,stage:'checkpoint',checkpoint:20,completedAt:null,answers:[...Array(20).fill(3),...Array(10).fill(null)]};
  assert.equal(validateState(partial).unlocked,false);
  assert.equal(validateState(partial).checkpoint,20);
});
