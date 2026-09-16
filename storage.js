import { CONFIG } from './config.js';
import { QUESTIONS } from './content.js';
import { validAnswer, validNickname } from './scoring.js';
export const freshState = () => ({version:CONFIG.version,unlocked:false,nickname:'',stage:'home',answers:Array(QUESTIONS.length).fill(null),current:0,checkpoint:0,seenCheckpoints:[],completedAt:null});
export function validateState(data) {
  if (!data || data.version!==CONFIG.version || typeof data.unlocked!=='boolean' || typeof data.nickname!=='string' || !['home','intro','quiz','checkpoint','result'].includes(data.stage) || !Array.isArray(data.answers) || data.answers.length!==QUESTIONS.length || !data.answers.every(a=>a===null||validAnswer(a)) || !Number.isInteger(data.current) || data.current<0 || data.current>=QUESTIONS.length || !Array.isArray(data.seenCheckpoints) || !data.seenCheckpoints.every(n=>[10,20,30].includes(n))) return null;
  if (['quiz','checkpoint','result'].includes(data.stage)&&!validNickname(data.nickname)) return null;
  if (data.stage==='checkpoint' && (![10,20,30].includes(data.checkpoint)||!data.answers.slice(0,data.checkpoint).every(validAnswer))) return null;
  if (data.completedAt!==null && (!data.answers.every(validAnswer)||!Number.isFinite(Date.parse(data.completedAt)))) return null;
  if (data.stage==='result'&&!data.completedAt)return null;
  if (!data.unlocked)data.stage='home';
  return data;
}
export function loadState(storage) {
  try{return {state:validateState(JSON.parse(storage.getItem(CONFIG.storageKey)))||freshState(),available:true};}
  catch{return {state:freshState(),available:false};}
}
export function saveState(storage,state) {
  try{storage.setItem(CONFIG.storageKey,JSON.stringify(state));return true;}
  catch{return false;}
}
