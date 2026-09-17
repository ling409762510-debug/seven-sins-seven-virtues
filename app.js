import { CONFIG, acceptsCode } from './config.js';
import { DIMENSIONS, QUESTIONS, OPTIONS, TRIGGERS } from './content.js';
import { makeReport, validAnswer, bandIndex, bandLabel, makeCheckpoint, normalizeNickname, validNickname } from './scoring.js';
import { freshState, loadState, saveState } from './storage.js';
import { orbital, radar } from './visuals.js';

const app=document.querySelector('#app');
let storage;
try { storage=window.localStorage; } catch { storage=null; }
const loaded=loadState(storage);
let state=loaded.state;
let storageAvailable=loaded.available;
let report=null;
let exporting=false; let advanceTimer=null;
const $=selector=>document.querySelector(selector);
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateText=()=>new Date(state.completedAt).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});
const bar=(score,virtue=false)=>`<div class="bar${virtue?' virtue':''}"><span style="width:${score}%"></span></div>`;
const sectionTitle=(index,title,en='')=>`<div class="section-title"><span class="index">${index}</span><h2>${title}</h2><small>${en}</small></div>`;
const stats=()=>'<div class="stats"><div><strong>30</strong><span>道情境题</span></div><div><strong>14</strong><span>个内在维度</span></div><div><strong>4–6</strong><span>分钟，慢慢作答</span></div></div>';
function notifyStorage(){const n=$('#storage-notice');n.hidden=storageAvailable;n.textContent='当前浏览器无法保存记录。你仍可完成测试，请在关闭页面前保存报告图片。';}
function persist(){storageAvailable=saveState(storage,state);notifyStorage();}
function navigate(stage,{top=true}={}){if(advanceTimer){clearTimeout(advanceTimer);advanceTimer=null;}state.stage=stage;persist();render();if(top)window.scrollTo(0,0);const heading=app.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
function resumeStage(){
  if(state.completedAt&&state.answers.every(validAnswer))return 'result';
  if(state.checkpoint&&!state.seenCheckpoints.includes(state.checkpoint)&&state.answers.slice(0,state.checkpoint).every(validAnswer))return 'checkpoint';
  return state.answers.some(validAnswer)?'quiz':'intro';
}
function home(){
  const hasResult=state.answers.every(validAnswer)&&state.completedAt;
  const answered=state.answers.filter(validAnswer).length;
  const access=state.unlocked
    ? `<div class="gate resume-card"><span class="eyebrow">WELCOME BACK</span><h2>${esc(state.nickname||'你')}，从这里继续</h2><p>${hasResult?'你上次的报告已保存。可以回看，也可以开启新一轮探索。':answered?`上次已完成 ${answered} / 30 题，你的选择仍然保留。`:'入口已开启，准备好认识自己的另一面了吗？'}</p>${answered&&!hasResult?`<div class="progress"><span style="width:${answered/30*100}%"></span></div>`:''}<button class="primary wide" id="enter-unlocked">${hasResult?'查看上次报告':answered?'继续上次探索':'开始探索'} <span aria-hidden="true">→</span></button>${answered?`<button class="text-button" id="home-restart">重新开始一轮测试</button>`:''}</div>`
    : `<form class="gate" id="gate-form"><span class="eyebrow">YOUR PRIVATE CHAPTER</span><label for="access-code">输入测试码，开启你的档案</label><div class="gate-input"><input id="access-code" name="access-code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="请输入测试码" aria-describedby="gate-error"><button class="primary" type="submit">开启档案 <span aria-hidden="true">↗</span></button></div><p class="error" id="gate-error" role="alert"></p><p class="privacy">每次进入均需输入测试码 · 上次进度仍会保留</p></form>`;
  app.innerHTML=`<section class="home"><div class="home-grid"><div class="home-copy"><span class="eyebrow">THE DUALITY WITHIN</span><h1>七宗罪<em>七美德</em></h1><p class="home-lead">欲望有它的声音，内心也有另一种回答。<br><strong>在十四种倾向里，读懂自己的选择。</strong></p></div><div class="orbit-frame">${orbital()}<p class="orbit-caption">欲望 · 边界 · 选择</p></div><div class="home-controls">${stats()}${access}</div></div><p class="scope-note">一份娱乐型自我觉察测试。结果记录当下的倾向，不用于心理诊断，也不评价你的好坏。</p></section>`;
  if(state.unlocked){
    $('#enter-unlocked').onclick=()=>navigate(resumeStage());
    if($('#home-restart'))$('#home-restart').onclick=()=>$('#restart-dialog').showModal();
  }else $('#gate-form').onsubmit=e=>{
    e.preventDefault();const input=$('#access-code');
    if(!acceptsCode(input.value)){input.setAttribute('aria-invalid','true');$('#gate-error').textContent=input.value.trim()?'测试码不正确，请检查后再试。':'请先输入测试码。';input.focus();return;}
    state.unlocked=true;
    if(answered||hasResult){home();$('#enter-unlocked').focus();}else navigate('intro');
  };
}
function journeyMarkup(active, completed=false){
  return `<ol class="journey" aria-label="三段探索进度">${['初见自己','向内一步','拼合全貌'].map((label,i)=>`<li class="${i<active||completed?'done':i===active?'current':''}" ${i===active?'aria-current="step"':''}><span>${i<active||completed?'✓':String(i+1).padStart(2,'0')}</span><b>${label}</b></li>`).join('')}</ol>`;
}
function intro(){
  app.innerHTML=`<section class="intro">${journeyMarkup(0)}<span class="eyebrow">BEFORE YOU BEGIN</span><h1>这份图谱，写给真实的你。</h1><p class="intro-lead">回想最近一个月的自己，凭第一反应作答。30 道题，约 4–6 分钟；每 10 题会停下来，给你一段阶段小结。</p><form id="intro-form"><div class="nickname-field"><label for="nickname">怎么称呼你？</label><input id="nickname" name="nickname" type="text" maxlength="32" autocomplete="off" placeholder="输入昵称，写进你的专属报告" value="${esc(state.nickname)}" aria-describedby="nickname-error"><p class="error" id="nickname-error" role="alert"></p><p class="privacy">1–16 个字即可，不必使用真实姓名。昵称与答案仅保存在当前浏览器。</p></div><ol class="intro-list"><li><b>01</b><div><strong>选完即前进，不用再点下一题</strong><p>可随时返回上一题，原来的选择会保留。修改后会自动继续。</p></div></li><li><b>02</b><div><strong>按真实反应回答，没有标准答案</strong><p>若没有遇到类似情境，就选你最可能的反应。你可以中途暂停，稍后回来继续。</p></div></li></ol><p class="disclaimer">简短说明：本测试仅供娱乐与自我探索，未经心理量表验证，不构成心理诊断、医疗建议或道德评价。结果请结合实际情境理解；若感到不适，可随时停止。</p><button type="submit" class="primary wide" id="begin">开始我的 30 题探索 <span aria-hidden="true">→</span></button></form></section>`;
  $('#intro-form').onsubmit=e=>{e.preventDefault();const value=normalizeNickname($('#nickname').value);if(!validNickname(value)){$('#nickname-error').textContent='请输入 1–16 个字的昵称。';$('#nickname').setAttribute('aria-invalid','true');$('#nickname').focus();return;}state.nickname=value;navigate('quiz');};
}
function advanceAnswer(){
  const end=state.current+1;
  if(end%10===0&&!state.seenCheckpoints.includes(end)){state.checkpoint=end;navigate('checkpoint');return;}
  if(end<QUESTIONS.length){state.current++;navigate('quiz');return;}
  const missing=state.answers.findIndex(a=>!validAnswer(a));
  if(missing!==-1){state.current=missing;navigate('quiz');return;}
  state.completedAt=new Date().toISOString();navigate('result');
}
function quiz(){
  const q=QUESTIONS[state.current],answered=state.answers.filter(validAnswer).length;
  app.innerHTML=`<section class="quiz">${journeyMarkup(Math.floor(state.current/10))}<div class="quiz-top"><strong>${esc(state.nickname)}的探索</strong><span>第 ${state.current+1} / ${QUESTIONS.length} 题</span></div><div class="progress" role="progressbar" aria-label="已答题数" aria-valuenow="${answered}" aria-valuemin="0" aria-valuemax="${QUESTIONS.length}"><span style="width:${answered/QUESTIONS.length*100}%"></span></div><div class="question-milestone"><span>已完成 ${answered} 题</span><strong>${Math.round(answered/30*100)}%</strong><span>${(Math.floor(state.current/10)+1)*10-answered>0?`再答 ${(Math.floor(state.current/10)+1)*10-answered} 题，解锁阶段小结`:'本段已完成'}</span></div><div class="question-panel"><div class="question-number" aria-hidden="true">${String(state.current+1).padStart(2,'0')}.</div><h1 id="question-text">${esc(q.text)}</h1><p class="question-hint">选完自动继续 · 随时可返回修改</p><div class="options" role="group" aria-labelledby="question-text">${OPTIONS.map((option,i)=>`<button type="button" class="option${state.answers[state.current]===i?' selected':''}" data-answer="${i}" aria-pressed="${state.answers[state.current]===i}"><span class="option-letter" aria-hidden="true">${'ABCDE'[i]}</span><span>${option}</span><span class="option-check" aria-hidden="true">✓</span></button>`).join('')}</div></div><div class="quiz-nav auto-nav"><button class="secondary" id="prev">${state.current===0?'返回说明':'上一题'}</button><p>${state.current<10?'01 · 看见日常反应':state.current<20?'02 · 探索欲望与边界':'03 · 找到内在资源'}</p></div><p class="save-note" role="status">${storageAvailable?'进度自动保存，可随时回来继续。':'当前浏览器无法保存，请保持页面开启。'}</p><p class="quiz-disclaimer">仅供娱乐与自我探索，不构成心理诊断或医疗建议。</p></section>`;
  let locked=false;
  document.querySelectorAll('[data-answer]').forEach(btn=>btn.onclick=()=>{
    if(locked)return;locked=true;
    state.answers[state.current]=Number(btn.dataset.answer);state.completedAt=null;persist();
    document.querySelectorAll('[data-answer]').forEach(b=>{const selected=b===btn;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.disabled=true;});
    $('#prev').disabled=true;
    advanceTimer=setTimeout(()=>{advanceTimer=null;advanceAnswer();},220);
  });
  $('#prev').onclick=()=>{if(state.current===0){navigate('intro');return;}state.current--;navigate('quiz');};
}
function checkpoint(){
  const count=state.checkpoint,summary=makeCheckpoint(state.answers,count,state.nickname),chapter=count/10;
  app.innerHTML=`<section class="checkpoint"><div class="checkpoint-top"><span class="eyebrow">A MOMENT FOR YOURSELF</span><span class="chapter-label">第 ${chapter} 段 / 共 3 段</span></div>${journeyMarkup(chapter-1,count===30)}<div class="chapter-card"><div class="chapter-art" aria-hidden="true"><div class="orbit-line"></div><div class="orbit-line second"></div><span class="orbit-star">✦</span><div class="chapter-ring" style="--completion:${count/30*100}%"><div><strong>${count}</strong><span>/ 30 题</span></div></div><p>已完成 ${Math.round(count/30*100)}%</p></div><div class="chapter-content"><span class="eyebrow">CHAPTER ${String(chapter).padStart(2,'0')} · COMPLETE</span><h1>${esc(state.nickname)}，<br>${count===10?'你已看见第一束线索。':count===20?'再走一步，图谱就完整了。':'属于你的图谱，已准备好。'}</h1><p class="chapter-lead">${count===10?'每一个真实回答，都在为你的轮廓添上一笔。':count===20?'不用追求前后一致，你在不同情境里可以有不同的样子。':'30 个选择，汇成你的欲望、资源与行动方向。'}</p></div></div><div class="chapter-observation"><span class="mini-label">${count===30?'即将为你呈现':'刚刚的一个线索'}</span>${count===30?'<div class="report-preview"><span><b>14</b>维倾向图谱</span><span><b>4</b>种触发线索</span><span><b>4</b>条行动建议</span></div>':`<p>${esc(summary.copy)}</p>`}</div><div class="chapter-forward"><div><span class="mini-label">${count===30?'YOUR NEXT PAGE':'NEXT CHAPTER'}</span><h2>${count===30?'把觉察，带回生活。':count===10?'走近你的欲望与边界':'拼合你的内在资源'}</h2><p>${esc(summary.next)}</p></div><span class="forward-arrow" aria-hidden="true">↗</span></div><button id="continue-checkpoint" class="primary wide">${summary.button} <span aria-hidden="true">→</span></button><div class="checkpoint-bottom"><button id="checkpoint-back" class="text-button">← 修改第 ${count} 题</button><span>${count<30?'阶段线索 · 完整解读将在答完后呈现':'30 / 30 · 已全部完成'}</span></div></section>`;
  $('#continue-checkpoint').onclick=()=>{if(!state.seenCheckpoints.includes(count))state.seenCheckpoints.push(count);if(count===QUESTIONS.length){state.completedAt=new Date().toISOString();navigate('result');}else{state.current=count;navigate('quiz');}};
  $('#checkpoint-back').onclick=()=>{state.current=count-1;navigate('quiz');};
}

function leadersMarkup(){
  return `<div class="leader-grid">${[[report.sinLeaders,'七宗罪 · 主导倾向',''],[report.virtueLeaders,'七美德 · 内在资源','virtue']].map(([leaders,title,cls])=>`<article class="leader ${cls}"><small>${title}</small><h3 class="${leaders.length>1?'many':''}">${leaders.map(d=>'<span>'+d.name+'</span>').join(' ')}</h3><p class="score">${leaders[0].score}<span>/ 100</span></p>${leaders.length>1?`<span class="tie">${leaders.length===7?'七个维度得分相同':`${leaders.length} 项并列最高`}</span>`:'<span class="tie">本次回答中得分最高的维度</span>'}</article>`).join('')}</div><p class="summary-note">两组倾向独立计分。欲望与美德，可以同时出现在一个人身上。</p>`;
}
function radarMarkup(){return `<div class="radar-wrap">${radar(report.scores)}</div><div class="radar-legend"><span>七宗罪</span><span>七美德</span></div>`;}
function rankMarkup(){return `<div class="rank-columns">${[[report.sins,'七宗罪',''],[report.virtues,'七美德','virtue']].map(([list,label,cls])=>`<div class="rank-group ${cls}"><h3>${label}</h3>${list.map(d=>`<div class="rank-row"><div class="rank-label"><span>${d.name}</span><span>${d.score}</span></div>${bar(d.score)}</div>`).join('')}</div>`).join('')}</div>`;}
function insightMarkup(expanded=false){
  const labels=['你的主要倾向','你能调用的资源',...(report.insight.length===5?['两种力量如何相处']:[]),'压力下的你','留意这个触发点'];
  return `<div class="insight"><h3 class="personal-headline">${esc(report.headline)}</h3><div class="insight-grid">${report.insight.map((p,i)=>`<article class="insight-card"><span class="mini-label">${String(i+1).padStart(2,'0')} / ${labels[i]}</span><p>${esc(p)}</p></article>`).join('')}</div>${report.reflections.length?`<details class="evidence-drawer" ${expanded?'open':''}><summary>从你的回答里，寻找这些线索 <span aria-hidden="true">＋</span></summary><div class="answer-evidence">${report.reflections.map(r=>`<blockquote><span class="evidence-tag">${r.dimension} · ${r.choice}</span><p>“${esc(r.question)}”</p></blockquote>`).join('')}</div></details>`:''}${report.contrasts.length?`<div class="context-notes"><h3>你也有不一样的一面</h3>${report.contrasts.slice(0,3).map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}</div>`;
}
function triggerMarkup(){
  return `<div class="trigger-grid">${TRIGGERS.map((t,i)=>{const score=report.triggers[t.id];return `<article class="trigger-card"><span class="trigger-symbol" aria-hidden="true">${['◇','◈','✳','◎'][i]}</span><div class="trigger-score">${score}<small>/ 100</small></div><h3>${t.name}</h3><span class="band-pill">${bandLabel(score)}</span>${bar(score)}<p>${t.description}</p></article>`;}).join('')}</div><p class="method-note">由相关情境题汇总，帮助你观察反应从何处开始。</p>`;
}
function detailsMarkup(dimensions,expanded=false){
  return `<div class="dimension-grid">${dimensions.map(d=>`<details class="dimension-detail ${d.group==='virtue'?'virtue':''}" ${expanded?'open':''}><summary><div class="dimension-summary"><div><span class="mini-label">${d.keyword}</span><h3>${d.name}</h3></div><strong>${report.scores[d.id]}<small>/100</small></strong></div>${bar(report.scores[d.id])}<div class="dimension-meta"><span>${bandLabel(report.scores[d.id])}</span><span class="expand-label">展开解读 <b aria-hidden="true">＋</b></span></div></summary><div class="dimension-body"><p class="reading">${d.bands[bandIndex(report.scores[d.id])]}</p><p>${d.description}</p><div class="detail-evidence"><span class="mini-label">你的作答依据</span>${report.evidence[d.id].map(e=>`<p>“${esc(e.text)}”<br><span>${e.answer}</span></p>`).join('')}</div></div></details>`).join('')}</div>`;
}
function actionsMarkup(){return `<div class="action-grid">${report.actions.map(([title,copy],i)=>`<article class="action-item"><div class="action-top"><b>${String(i+1).padStart(2,'0')}</b><span>${['从今天开始','试着用一次','给自己缓冲','与需要相遇'][i]}</span></div><h3>${title}</h3><p>${copy}</p></article>`).join('')}</div>`;}
function aboutMarkup(){
  return '<div class="reading-guide"><div class="guide-heading"><span class="eyebrow">BEFORE READING</span><h2>先读懂图谱，再看见自己。</h2><p>这份结果是一面镜子，留给你理解自己的空间。</p></div><div class="guide-grid"><article><span>01</span><h3>看倾向，不贴标签</h3><p>分数记录本次回答中的反应，不评价好坏。</p></article><article><span>02</span><h3>两面可以共存</h3><p>欲望和美德各自计分，可以同时较高。</p></article><article><span>03</span><h3>从一件小事开始</h3><p>选一条适合你的建议，带回真实生活。</p></article></div><details class="guide-more"><summary>了解测试边界与词语含义</summary><p>本测试为原创娱乐型自我觉察问卷，未经心理量表验证，不用于诊断，不提供人群百分位。“主导”只比较你自己的得分。“暴食”借指过度沉浸；“贞洁”关注双方意愿、边界与承诺。它们不评价体型、身体经历或关系形式。昵称、答案与报告仅保存在当前浏览器。</p></details></div>';
}
function results(){
  report=makeReport(state.answers,state.nickname);
  app.innerHTML=`<section class="report">${aboutMarkup()}<header class="report-heading"><div class="report-crest" aria-hidden="true"><span>VII</span></div><span class="eyebrow">YOUR INNER SPECTRUM</span><h1>${esc(state.nickname)}的<br><em>内在图谱</em></h1><p>每一种面向，都是认识自己的线索。</p><div class="report-stamp"><span>30 个真实回答</span><i>✦</i><span>${dateText()}</span></div></header><nav class="report-nav" aria-label="报告导航"><a href="#spectrum">倾向图谱</a><a href="#insights">专属洞察</a><a href="#dimensions">14 维解读</a><a href="#actions">行动建议</a></nav><section class="report-section signature-section" id="spectrum">${sectionTitle('01','你的双面倾向','THE DUALITY')}${leadersMarkup()}</section><section class="report-section chart-section">${sectionTitle('02','十四维倾向雷达','THE SPECTRUM')}${radarMarkup()}<p class="summary-note">左侧七宗罪 · 右侧七美德<br>中心为 0 分，外圈为 100 分</p><details class="ranking-drawer"><summary>查看全部维度排行 <span aria-hidden="true">＋</span></summary>${rankMarkup()}</details></section><section class="report-section insight-section" id="insights">${sectionTitle('03','写给你的洞察','PERSONAL NOTES')}${insightMarkup()}</section><section class="report-section">${sectionTitle('04','你的反应，从哪里开始','TRIGGERS')}${triggerMarkup()}</section><section class="report-section dimensions-section" id="dimensions">${sectionTitle('05','14 种面向，慢慢读懂','YOUR DIMENSIONS')}<p class="section-intro">先看整体轮廓，再轻点任意一张卡片，展开专属解读。</p><h3 class="group-heading"><span>THE SEVEN SINS</span>七宗罪 <small>欲望与反应</small></h3>${detailsMarkup(DIMENSIONS.filter(d=>d.group==='sin'))}<h3 class="group-heading virtue"><span>THE SEVEN VIRTUES</span>七美德 <small>资源与选择</small></h3>${detailsMarkup(DIMENSIONS.filter(d=>d.group==='virtue'))}</section><section class="report-section action-section" id="actions">${sectionTitle('06','把觉察，带回生活','SMALL STEPS')}<p class="section-intro">不必同时做到。先挑一件今天愿意试的小事。</p>${actionsMarkup()}</section><section class="report-ending"><span class="ending-star" aria-hidden="true">✦</span><h2>图谱有边界，<br>你还有更多可能。</h2><p>保存这次的自己，也给下一次变化留一点空间。</p><div class="report-actions"><button class="primary" id="export-summary">保存精美摘要图 ↗</button><button class="secondary" id="export-full">保存完整报告图</button></div><button class="text-button" id="restart">开启新一轮探索</button></section></section>`;
  $('#export-summary').onclick=()=>exportReport(false);
  $('#export-full').onclick=()=>exportReport(true);
  $('#restart').onclick=()=>$('#restart-dialog').showModal();
}

function render(){if(!state.unlocked){home();}else{({home,intro,quiz,checkpoint,result:results}[state.stage]||home)();}notifyStorage();}
$('#home-link').onclick=e=>{e.preventDefault();state.unlocked=false;render();window.scrollTo(0,0);};
window.addEventListener('pageshow',event=>{if(event.persisted){state.unlocked=false;if(advanceTimer){clearTimeout(advanceTimer);advanceTimer=null;}document.querySelectorAll('dialog[open]').forEach(d=>d.close());render();window.scrollTo(0,0);}});

$('#cancel-restart').onclick=()=>$('#restart-dialog').close();
$('#confirm-restart').onclick=()=>{state={...freshState(),unlocked:true,nickname:state.nickname};report=null;$('#restart-dialog').close();navigate('intro');};
$('#close-export').onclick=()=>$('#export-dialog').close();

function exportPages(full){
  const pages=[['结果摘要',`<header class="report-heading"><span class="eyebrow">YOUR INNER SPECTRUM</span><h1>${esc(state.nickname)}的内在图谱</h1><p>${dateText()}</p></header>${leadersMarkup()}${radarMarkup()}`]];
  if(!full)return pages;
  pages.unshift(['阅读指南',aboutMarkup()]);
  pages.push(['维度排行',rankMarkup()],['专属洞察',insightMarkup(true)],['触发因素',triggerMarkup()]);
  for(const group of ['sin','virtue']){const list=DIMENSIONS.filter(d=>d.group===group);for(let i=0;i<list.length;i+=2){pages.push([`${group==='sin'?'七宗罪':'七美德'} · ${list.slice(i,i+2).map(d=>d.name).join('与')}`,detailsMarkup(list.slice(i,i+2),true)]);}}
  pages.push(['把觉察带回生活',actionsMarkup()]);
  return pages;
}
async function exportReport(full){
  if(exporting)return;
  exporting=true;
  const dialog=$('#export-dialog'), status=$('#export-status'), images=$('#export-images');
  images.replaceChildren();dialog.showModal();status.textContent='正在生成图片，请稍候…';
  let sheet;
  try{
    if(typeof window.html2canvas!=='function')throw new Error('图片工具未能加载，请联网刷新后重试。');
    await document.fonts.ready;
    const pages=exportPages(full);
    for(let i=0;i<pages.length;i++){
      if(!dialog.open)break;
      status.textContent=`正在生成第 ${i+1} / ${pages.length} 张图片…`;
      const [title,markup]=pages[i];
      sheet=document.createElement('div');sheet.className='export-sheet';sheet.setAttribute('aria-hidden','true');
      sheet.innerHTML=`<div class="export-brand">七宗罪 | 七美德</div>${i>0?sectionTitle(String(i+1).padStart(2,'0'),title):''}${markup}<p class="export-footer">娱乐型自我觉察 · 非心理诊断<br>${dateText()} · ${i+1} / ${pages.length}</p>`;
      sheet.querySelectorAll('details').forEach(d=>d.open=true);
      document.body.append(sheet);
      // Convert SVG to actual PNG pixels before html2canvas paints the export.
      for(const svg of sheet.querySelectorAll('svg')){
        const displayWidth=svg.getBoundingClientRect().width;
        svg.setAttribute('width','1120');svg.setAttribute('height','1120');
        const svgImage=new Image();
        svgImage.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await svgImage.decode();
        const chart=document.createElement('canvas');chart.width=1120;chart.height=1120;chart.getContext('2d').drawImage(svgImage,0,0,1120,1120);
        const png=new Image();png.width=displayWidth;png.height=displayWidth;png.style.display='block';png.alt='十四维雷达';png.src=chart.toDataURL('image/png');await png.decode();svg.replaceWith(png);
      }
      const canvas=await window.html2canvas(sheet,{backgroundColor:'#100e10',scale:2,logging:false,windowWidth:440,scrollY:0,scrollX:0});
      const src=canvas.toDataURL('image/png');
      const card=document.createElement('section');card.className='export-item';
      const heading=document.createElement('h3');heading.textContent=`${i+1}. ${title}`;
      const img=new Image();img.src=src;img.alt=`七宗罪七美德报告：${title}`;
      const link=document.createElement('a');link.href=src;link.download=`七宗罪七美德-${String(i+1).padStart(2,'0')}.png`;link.textContent='下载这张图片';
      card.append(heading,img,link);images.append(card);sheet.remove();sheet=null;
    }
    if(dialog.open)status.textContent='图片已生成。手机可长按每张图片保存；电脑可点击下载。';
  }catch(error){status.textContent=error.message||'图片生成失败，请重试。也可以先截图保存当前报告。';}
  finally{sheet?.remove();exporting=false;}
}
render();

