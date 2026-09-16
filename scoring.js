import { DIMENSIONS, QUESTIONS, TRIGGERS, OPTIONS, GENERAL_ACTIONS } from './content.js';
export const validAnswer = value => Number.isInteger(value) && value >= 0 && value <= 4;
export const itemScore = (question, answer) => question.reverse ? 4-answer : answer;
export const bandIndex = score => score <= 33 ? 0 : score <= 66 ? 1 : 2;
export const bandLabel = score => ['较少显现','情境性显现','较常显现'][bandIndex(score)];
export const normalizeNickname = value => typeof value==='string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g,'') : '';
export const validNickname = value => normalizeNickname(value).length>0 && Array.from(normalizeNickname(value)).length<=16;
const answerFor = (answers,id) => answers[QUESTIONS.findIndex(q=>q.id===id)];

export function scoreAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length || !answers.every(validAnswer)) throw new Error(`请完成全部 ${QUESTIONS.length} 道题后查看报告。`);
  const scores = Object.fromEntries(DIMENSIONS.map(d => {
    const items=QUESTIONS.flatMap((q,i)=>q.dimension===d.id?[itemScore(q,answers[i])]:[]);
    return [d.id,Math.round(items.reduce((a,b)=>a+b,0)/(items.length*4)*100)];
  }));
  const triggers = Object.fromEntries(TRIGGERS.map(t => {
    const values = QUESTIONS.flatMap((q,i) => q.trigger === t.id ? [itemScore(q,answers[i])] : []);
    return [t.id, Math.round(values.reduce((sum,v) => sum+v,0)/(values.length*4)*100)];
  }));
  return {scores,triggers};
}
export function makeCheckpoint(answers, count, nickname) {
  if (![10,20,30].includes(count) || answers.slice(0,count).length!==count || !answers.slice(0,count).every(validAnswer)) throw new Error('阶段答题尚未完成。');
  const start=count-10;
  const candidates=QUESTIONS.slice(start,count).map((q,i)=>({...q,answer:answers[start+i]})).filter(q=>q.dimension);
  const evidence=candidates.filter(q=>q.answer!==2).sort((a,b)=>Math.abs(b.answer-2)-Math.abs(a.answer-2))[0];
  const observed=evidence ? `你对“${evidence.text}”选择了“${OPTIONS[evidence.answer]}”。这个回答会和后面的情境一起，帮助我们理解你的反应方式。` : '你目前的回答都落在中间位置。接下来也可以继续按每个情境里的真实反应选择，不需要刻意拉开差异。';
  return {
    title:count===10?`${nickname}，已走完三分之一。`:count===20?`${nickname}，你的图谱正在成形。`:`${nickname}，30 个回答已收齐。`,
    copy:count===30?'接下来会把你的回答、十四维倾向和可调用的资源放在一起，生成属于这次探索的报告。':observed,
    next:count===10?'接下来 10 题，看看你在放松、关系和压力面前如何选择。':count===20?'只剩 10 题。另一种问法会补充前面的线索，不必刻意保持一致。':'你可以查看完整报告，也可以返回修改最后一题。',
    button:count===30?'查看我的专属报告':count===10?'继续探索 · 还剩 20 题':'继续探索 · 最后 10 题',
  };
}
export function makeReport(answers, nickname='你') {
  const {scores,triggers} = scoreAnswers(answers);
  const ranked = group => DIMENSIONS.filter(d => d.group === group).map(d => ({...d,score:scores[d.id]})).sort((a,b) => b.score-a.score);
  const sins = ranked('sin'), virtues = ranked('virtue');
  const leaders = list => list.filter(d => d.score === list[0].score);
  const sinLeaders = leaders(sins), virtueLeaders = leaders(virtues);
  const primary=sins[0], resource=virtues[0];
  const differentiated = sinLeaders.length<7;
  const pause=answerFor(answers,'context-pause'), support=answerFor(answers,'context-support');
  const evidence=Object.fromEntries(DIMENSIONS.map(d=>[d.id,QUESTIONS.flatMap((q,i)=>q.dimension===d.id?[{text:q.text,answer:OPTIONS[answers[i]],score:itemScore(q,answers[i])}]:[])]));
  const balanced=sinLeaders.length===7&&virtueLeaders.length===7;
  const headline=balanced?'不同面向，正在同一张图谱里相遇':`${primary.keyword.split('与')[0]}的声音，与${resource.keyword.split('与')[0]}的力量`;
  const insight=[
    sinLeaders.length===7?`${nickname}，你的七宗罪得分都为 ${primary.score}，这次没有单一主导倾向。与其给自己选一个标签，更适合从具体回答找线索。`:`${nickname}，这次你更常显现的倾向是${sinLeaders.map(d=>`「${d.name}」`).join('、')}（${primary.score} 分${sinLeaders.length>1?'，并列':''}）。${primary.bands[bandIndex(primary.score)]}`,
    virtueLeaders.length===7?`七美德也处于同一水平（${resource.score} 分）。这不表示资源相同，只说明这组简短问题还没有区分出明显差异。`:`与你同时出现的资源是${virtueLeaders.map(d=>`「${d.name}」`).join('、')}（${resource.score} 分${virtueLeaders.length>1?'，并列':''}）。${resource.bands[bandIndex(resource.score)]}`,
  ];
  if(!balanced){
    const bridge=primary.score>=67&&resource.score>=67?`你的${primary.name}与${resource.name}都较常显现。你可能同时有强烈的反应和调节的资源；重点是让资源在当下用得上。`:primary.score>=67?`本次${primary.name}比可见的${resource.name}资源更突出。先给自己一个外部提示或较小的行动门槛，比要求自己立刻改变更实际。`:resource.score>=67?`你在${resource.name}上的回答较稳定，可以把它用于应对${primary.name}相关的情境；也不必因为某一项排第一，就把它当成严重问题。`:`这些倾向主要落在较低或中间范围。${primary.name}与${resource.name}的组合提供了一条观察线索，暂时不必据此给自己定性。`;
    insight.push(bridge);
  }
  const pauseText=pause>=3?'你愿意在压力下停一会儿，这是你已经报告过的缓冲方式。':pause<=1?'你较少在压力下自然停下来，提醒自己暂缓回复可能比当场说服自己更容易。':'是否能停下来，可能取决于情境；可以留意哪些场合最难给自己留空隙。';
  const supportText=support>=3?'你也愿意向信任的人说出需要，遇到卡住的事可以继续调用这份支持。':support<=1?'你较少向他人表达需要，可以先写下一句话，再决定是否向一个安全的人说出来。':'你有时会借助他人的支持，提前选好一个愿意倾听的人可能有帮助。';
  insight.push(pauseText+supportText);
  const topTriggers=TRIGGERS.map(t=>({...t,score:triggers[t.id]})).sort((a,b)=>b.score-a.score);
  const triggerLeaders=topTriggers.filter(t=>t.score===topTriggers[0].score);
  insight.push(triggerLeaders.length===4?'四类触发线索的得分相同。可以记录一次真实情境，再看是哪一种线索先出现。':`从相关题目看，${triggerLeaders.map(t=>t.name).join('、')}更容易成为入口（${topTriggers[0].score} 分）。这来自你的具体作答，不代表每次都会如此。`);
  const concrete=QUESTIONS.map((q,i)=>({...q,answer:answers[i]})).filter(q=>q.dimension&&q.answer!==2).sort((a,b)=>Math.abs(b.answer-2)-Math.abs(a.answer-2));
  const selected=[];for(const q of concrete){if(!selected.some(x=>x.dimension===q.dimension))selected.push(q);if(selected.length===3)break;}
  const reflections=selected.map(q=>({question:q.text,choice:OPTIONS[q.answer],dimension:DIMENSIONS.find(d=>d.id===q.dimension).name}));
  const contrasts=DIMENSIONS.flatMap(d=>{const [a,b]=evidence[d.id];return Math.abs(a.score-b.score)>=3?[`${d.name}的两种情境回答差异较大。你可能在不同场合表现不同，${scores[d.id]} 分只是这两题的平均值。`]:[];});
  const actions=[
    differentiated?primary.action:GENERAL_ACTIONS[0],
    virtueLeaders.length<7?[`用${resource.name}支持一次具体选择`,resource.action[1]]:['挑选一种你愿意练习的资源','从耐心、行动、分享或边界里选一个，在本周的一次小事里练习。'],
    pause>=3?['把已有的缓冲用在难处','选一个经常让你失去节奏的情境，提前约定：先停一会儿，再选择回应。']:['给自动反应加一个提示','把“先等十秒”写在常用便签上。下一次压力升起时，先看见提醒，再决定怎么做。'],
    support>=3?['发出一个具体求助','找一个你信任的人，只提出一件小而明确的需要，例如“能听我说十分钟吗？”']:['先把需要写给自己','写下“我现在需要的是……”，不急着解决。若愿意，再将这一句话告诉可信任的人。'],
  ];
  return {scores,triggers,sins,virtues,sinLeaders,virtueLeaders,headline,insight,actions,evidence,reflections,contrasts};
}
