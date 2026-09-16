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
function home(){
  const hasResult=state.answers.every(validAnswer)&&state.completedAt;
  const hasProgress=state.answers.some(validAnswer);
  app.innerHTML=`<section class="home"><div class="home-grid"><div class="home-copy"><span class="eyebrow">THE DUALITY WITHIN</span><h1>七宗罪<em>七美德</em></h1><p class="home-lead">欲望有它的声音，内心也有另一种回答。<br><strong>在十四种倾向里，读懂自己的选择。</strong></p></div><div class="orbit-frame">${orbital()}<p class="orbit-caption">欲望 · 边界 · 选择</p></div><div class="home-controls">${stats()}${state.unlocked?`<div class="gate"><label>你的探索入口已开启</label><button class="primary wide" id="enter-unlocked">${hasResult?'查看我的报告':hasProgress?'继续上次测试':'开始探索'}</button><p class="privacy">记录仅保存在当前浏览器，你可以随时继续。</p></div>`:`<form class="gate" id="gate-form"><label for="access-code">输入测试码，开启你的档案</label><div class="gate-input"><input id="access-code" name="access-code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="请输入测试码" aria-describedby="gate-error"><button class="primary" type="submit">开启档案 <span aria-hidden="true">↗</span></button></div><p class="error" id="gate-error" role="alert"></p><p class="privacy">无需注册 · 答案仅保存在当前浏览器</p></form>`}</div></div><p class="scope-note">这是一份<strong>娱乐型自我觉察测试</strong>。七宗罪与七美德是理解内在倾向的文化视角，结果不用于心理诊断，也不评价你的好坏。</p></section>`;
  if(state.unlocked)$('#enter-unlocked').onclick=()=>navigate(hasResult?'result':hasProgress?'quiz':'intro');
  else $('#gate-form').onsubmit=e=>{e.preventDefault();const input=$('#access-code');if(!acceptsCode(input.value)){input.setAttribute('aria-invalid','true');$('#gate-error').textContent=input.value.trim()?'测试码不正确，请检查后再试。':'请先输入测试码。';input.focus();return;}state.unlocked=true;navigate('intro');};
}
function intro(){
  app.innerHTML=`<section class="intro"><span class="eyebrow">BEFORE YOU BEGIN</span><h1>这份图谱，写给真实的你。</h1><p class="intro-lead">回想最近一个月的自己，凭第一反应作答。30 道题，约 4–6 分钟；每 10 题会停下来，给你一段阶段小结。</p><form id="intro-form"><div class="nickname-field"><label for="nickname">怎么称呼你？</label><input id="nickname" name="nickname" type="text" maxlength="32" autocomplete="off" placeholder="输入昵称，写进你的专属报告" value="${esc(state.nickname)}" aria-describedby="nickname-error"><p class="error" id="nickname-error" role="alert"></p><p class="privacy">1–16 个字即可，不必使用真实姓名。昵称与答案仅保存在当前浏览器。</p></div><ol class="intro-list"><li><b>01</b><div><strong>选完即前进，不用再点下一题</strong><p>可随时返回上一题，原来的选择会保留。修改后会自动继续。</p></div></li><li><b>02</b><div><strong>按真实反应回答，没有标准答案</strong><p>若没有遇到类似情境，就选你最可能的反应。你可以中途暂停，稍后回来继续。</p></div></li></ol><p class="disclaimer">简短说明：本测试仅供娱乐与自我探索，未经心理量表验证，不构成心理诊断、医疗建议或道德评价。结果请结合实际情境理解；若感到不适，可随时停止。</p><button type="submit" class="primary wide" id="begin">开始我的 30 题探索 <span aria-hidden="true">→</span></button></form></section>`;
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
  app.innerHTML=`<section class="quiz"><div class="quiz-top"><strong>${esc(state.nickname)}的探索</strong><span>第 ${state.current+1} / ${QUESTIONS.length} 题</span></div><div class="progress" role="progressbar" aria-label="已答题数" aria-valuenow="${answered}" aria-valuemin="0" aria-valuemax="${QUESTIONS.length}"><span style="width:${answered/QUESTIONS.length*100}%"></span></div><div class="question-panel"><div class="question-number" aria-hidden="true">${String(state.current+1).padStart(2,'0')}.</div><h1 id="question-text">${esc(q.text)}</h1><p class="question-hint">选完自动继续 · 随时可返回修改</p><div class="options" role="group" aria-labelledby="question-text">${OPTIONS.map((option,i)=>`<button type="button" class="option${state.answers[state.current]===i?' selected':''}" data-answer="${i}" aria-pressed="${state.answers[state.current]===i}"><span class="option-letter" aria-hidden="true">${'ABCDE'[i]}</span><span>${option}</span><span class="option-check" aria-hidden="true">✓</span></button>`).join('')}</div></div><div class="quiz-nav auto-nav"><button class="secondary" id="prev">${state.current===0?'返回说明':'上一题'}</button><p>${state.current<10?'01 · 看见日常反应':state.current<20?'02 · 探索欲望与边界':'03 · 找到内在资源'}</p></div><p class="save-note" role="status">${storageAvailable?'进度自动保存，可随时回来继续。':'当前浏览器无法保存，请保持页面开启。'}</p><p class="quiz-disclaimer">仅供娱乐与自我探索，不构成心理诊断或医疗建议。</p></section>`;
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
  const count=state.checkpoint,summary=makeCheckpoint(state.answers,count,state.nickname);
  app.innerHTML=`<section class="checkpoint"><span class="eyebrow">CHAPTER ${String(count/10).padStart(2,'0')} / 03</span><div class="checkpoint-orbit" aria-hidden="true">${count}<small>/ 30</small></div><h1>${esc(summary.title)}</h1><div class="checkpoint-copy"><p>${esc(summary.copy)}</p><p class="checkpoint-next">${esc(summary.next)}</p></div><p class="checkpoint-caution">${count<30?'这是基于已答题目的阶段线索，完整解读将在答完后呈现。':'所有题目已完成。你的昵称、作答线索和行动建议会一起写进报告。'}</p><button id="continue-checkpoint" class="primary wide">${summary.button} <span aria-hidden="true">→</span></button><button id="checkpoint-back" class="text-button">返回修改第 ${count} 题</button></section>`;
  $('#continue-checkpoint').onclick=()=>{if(!state.seenCheckpoints.includes(count))state.seenCheckpoints.push(count);if(count===QUESTIONS.length){state.completedAt=new Date().toISOString();navigate('result');}else{state.current=count;navigate('quiz');}};
  $('#checkpoint-back').onclick=()=>{state.current=count-1;navigate('quiz');};
}

function leadersMarkup(){
  return `<div class="leader-grid">${[[report.sinLeaders,'七宗罪 · 主导倾向',''],[report.virtueLeaders,'七美德 · 内在资源','virtue']].map(([leaders,title,cls])=>`<article class="leader ${cls}"><small>${title}</small><h3 class="${leaders.length>1?'many':''}">${leaders.map(d=>d.name).join(' · ')}</h3><p class="score">${leaders[0].score}<span>/ 100</span></p>${leaders.length>1?`<span class="tie">${leaders.length===7?'七个维度得分相同':`${leaders.length} 项并列最高`}</span>`:'<span class="tie">本次回答中得分最高的维度</span>'}</article>`).join('')}</div><p class="summary-note">两组倾向独立计分。欲望与美德，可以同时出现在一个人身上。</p>`;
}
function radarMarkup(){return `<div class="radar-wrap">${radar(report.scores)}</div><div class="radar-legend"><span>七宗罪</span><span>七美德</span></div>`;}
function rankMarkup(){return `<div class="rank-columns">${[[report.sins,'七宗罪',''],[report.virtues,'七美德','virtue']].map(([list,label,cls])=>`<div class="rank-group ${cls}"><h3>${label}</h3>${list.map(d=>`<div class="rank-row"><div class="rank-label"><span>${d.name}</span><span>${d.score}</span></div>${bar(d.score)}</div>`).join('')}</div>`).join('')}</div>`;}
function insightMarkup(){return `<div class="insight"><h3 class="personal-headline">${esc(report.headline)}</h3>${report.insight.map(p=>`<p>${esc(p)}</p>`).join('')}${report.reflections.length?`<div class="answer-evidence"><h3>这些线索，来自你的回答</h3>${report.reflections.map(r=>`<blockquote><p>“${esc(r.question)}”</p><span>你的选择：${r.choice}</span></blockquote>`).join('')}</div>`:''}${report.contrasts.length?`<div class="context-notes"><h3>值得留意的情境差异</h3>${report.contrasts.slice(0,3).map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}</div>`;}
function triggerMarkup(){return `${TRIGGERS.map(t=>{const score=report.triggers[t.id];const filled=Math.round(score/20);return `<div class="trigger-row"><div><h3>${t.name}</h3><p>${t.description}</p></div><div class="trigger-meter"><div class="dots" aria-hidden="true">${'●'.repeat(filled)}${'○'.repeat(5-filled)}</div><small>${score} / 100<br>${bandLabel(score)}</small></div></div>`;}).join('')}<p class="method-note">由相关情境题汇总，是阅读线索，不是独立诊断指标。</p>`;}
function detailsMarkup(dimensions){return dimensions.map(d=>`<article class="dimension-detail ${d.group==='virtue'?'virtue':''}"><header><h3>${d.name}</h3><span>${report.scores[d.id]}</span></header><div class="tagline">${d.keyword} · ${bandLabel(report.scores[d.id])}</div>${bar(report.scores[d.id])}<p>${d.description}</p><p class="reading">${d.bands[bandIndex(report.scores[d.id])]}</p><div class="detail-evidence">${report.evidence[d.id].map(e=>`<p>“${esc(e.text)}”<br><span>你的选择：${e.answer}</span></p>`).join('')}</div></article>`).join('');}
function actionsMarkup(){return report.actions.map(([title,copy],i)=>`<article class="action-item"><b>${String(i+1).padStart(2,'0')}</b><div><h3>${title}</h3><p>${copy}</p></div></article>`).join('');}
function aboutMarkup(){return '<div class="about-result"><p>分数较高，表示这类反应在本次回答里较常出现；分数较低，也不意味着你缺少价值或能力。这里的“主导”只比较你自己的各项分数。</p><p>本测试为原创娱乐型自我觉察问卷，未经过心理量表信效度验证。它不用于诊断，不提供人群百分位，也不对人格或道德作定论。</p><p>“暴食”借指过度沉浸；“贞洁”关注双方意愿、边界与承诺。它们不评价体型、身体经历或关系形式。</p><p>结果仅保存在当前浏览器。你可以保存图片，也可以在状态变化后重新探索。</p></div>';}
function results(){
  report=makeReport(state.answers,state.nickname);
  app.innerHTML=`<section class="report"><header class="report-heading"><span class="eyebrow">YOUR INNER SPECTRUM</span><h1>${esc(state.nickname)}的内在图谱</h1><p>七宗罪 | 七美德 · ${dateText()}</p></header><div class="report-actions"><button class="primary" id="export-summary">保存结果摘要图</button><button class="secondary" id="export-full">保存完整报告图</button><button class="text-button" id="restart">重新测试</button></div><section class="report-section">${sectionTitle('01','你的双面倾向','THE DUALITY')}${leadersMarkup()}</section><section class="report-section">${sectionTitle('02','十四维人格雷达','THE SPECTRUM')}${radarMarkup()}<p class="summary-note">左侧七宗罪，右侧七美德。外圈为 100 分，中心为 0 分。</p></section><section class="report-section">${sectionTitle('03','维度排行','DIMENSIONS')}${rankMarkup()}</section><section class="report-section">${sectionTitle('04','洞察总结','INSIGHT')}${insightMarkup()}</section><section class="report-section">${sectionTitle('05','触发因素','TRIGGERS')}${triggerMarkup()}</section><section class="report-section">${sectionTitle('06','七宗罪 · 逐项解读','SEVEN SINS')}${detailsMarkup(DIMENSIONS.filter(d=>d.group==='sin'))}</section><section class="report-section">${sectionTitle('07','七美德 · 逐项解读','SEVEN VIRTUES')}${detailsMarkup(DIMENSIONS.filter(d=>d.group==='virtue'))}</section><section class="report-section">${sectionTitle('08','把觉察带回生活','YOUR NEXT STEP')}${actionsMarkup()}</section><section class="report-section">${sectionTitle('09','如何理解这份结果')}${aboutMarkup()}</section><div class="report-actions"><button class="primary" id="export-bottom">保存完整报告图</button><button class="text-button" id="restart-bottom">重新测试</button></div></section>`;
  $('#export-summary').onclick=()=>exportReport(false);
  $('#export-full').onclick=$('#export-bottom').onclick=()=>exportReport(true);
  $('#restart').onclick=$('#restart-bottom').onclick=()=>$('#restart-dialog').showModal();
}
function render(){if(!state.unlocked&&state.stage!=='home'){state.stage='home';}({home,intro,quiz,checkpoint,result:results}[state.stage]||home)();notifyStorage();}
$('#home-link').onclick=e=>{e.preventDefault();navigate('home');};
$('#cancel-restart').onclick=()=>$('#restart-dialog').close();
$('#confirm-restart').onclick=()=>{state={...freshState(),unlocked:true,nickname:state.nickname};report=null;$('#restart-dialog').close();navigate('intro');};
$('#close-export').onclick=()=>$('#export-dialog').close();

function exportPages(full){
  const pages=[['结果摘要',`<header class="report-heading"><span class="eyebrow">YOUR INNER SPECTRUM</span><h1>${esc(state.nickname)}的内在图谱</h1><p>${dateText()}</p></header>${leadersMarkup()}${radarMarkup()}`]];
  if(!full)return pages;
  pages.push(['维度排行',rankMarkup()],['专属洞察',insightMarkup()],['触发因素',triggerMarkup()]);
  for(const group of ['sin','virtue']){const list=DIMENSIONS.filter(d=>d.group===group);for(let i=0;i<list.length;i+=2){pages.push([`${group==='sin'?'七宗罪':'七美德'} · ${list.slice(i,i+2).map(d=>d.name).join('与')}`,detailsMarkup(list.slice(i,i+2))]);}}
  pages.push(['行动建议与阅读说明',actionsMarkup()+aboutMarkup()]);
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

