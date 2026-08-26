import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://fljoowkjmvqijqiaimpp.supabase.co';
const SUPABASE_KEY='sb_publishable_YdE-PNM_SrerYvKjBn68BQ_8YCpuKR9';
const DIR=path.join(os.homedir(),'.filaments-bridge');
const FILE=path.join(DIR,'config.json');
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:true}});
let busy=false;

function readConfig(){try{return JSON.parse(fs.readFileSync(FILE,'utf8'));}catch{return{};}}
async function ensureSession(){const c=readConfig();if(!c.session?.access_token||!c.session?.refresh_token)return false;const {data,error}=await db.auth.setSession(c.session);if(error){console.error('Usage session:',error.message);return false;}return!!data.session;}
function safeName(name=''){return path.basename(name).replace(/[^a-zA-Z0-9._-]/g,'_');}
function extractGcode(buf,name){
  if(/\.3mf$/i.test(name)){
    const zip=new AdmZip(buf);
    const entries=zip.getEntries();
    const gc=entries.find(e=>/plate_\d+\.gcode$/i.test(e.entryName))||entries.find(e=>/\.gcode$/i.test(e.entryName));
    if(!gc)throw new Error('3MF has no sliced G-code');
    return gc.getData().toString('utf8');
  }
  return buf.toString('utf8');
}
function parseTotalGrams(text){
  const m=text.match(/filament used \[g\]\s*=\s*([^\r\n]+)/i);
  if(!m)return null;
  const nums=m[1].match(/[0-9.]+/g)||[];
  const n=nums.reduce((a,x)=>a+Number(x),0);
  return Number.isFinite(n)&&n>0?n:null;
}
function parseLayerUsage(text,totalGrams){
  let relative=false,lastE=0,currentLayer=0,maxLayer=0,totalPositiveE=0;
  const raw=[];
  const lines=text.split(/\r?\n/);
  const commitLayer=()=>{if(currentLayer>0){const prev=raw.length?raw[raw.length-1].e:0;raw.push({layer:currentLayer,e:Math.max(prev,totalPositiveE)});maxLayer=Math.max(maxLayer,currentLayer);}};
  for(const lineRaw of lines){
    const line=lineRaw.trim();
    let lm=line.match(/^;\s*layer\s+num\/total_layer_count\s*:\s*(\d+)\s*\/\s*(\d+)/i);
    if(lm){commitLayer();currentLayer=Math.max(1,Number(lm[1]));maxLayer=Math.max(maxLayer,Number(lm[2]));continue;}
    lm=line.match(/^;\s*LAYER\s*:\s*(\d+)/i);
    if(lm){commitLayer();currentLayer=Math.max(1,Number(lm[1])+1);continue;}
    if(/^;\s*LAYER_CHANGE/i.test(line)){commitLayer();currentLayer=Math.max(1,currentLayer+1);continue;}
    if(/^M82\b/i.test(line)){relative=false;continue;}
    if(/^M83\b/i.test(line)){relative=true;continue;}
    const g92=line.match(/^G92\b[^;]*\bE(-?[0-9.]+)/i);if(g92){lastE=Number(g92[1]);continue;}
    if(!/^G0?1\b/i.test(line))continue;
    const em=line.match(/\bE(-?[0-9.]+)/i);if(!em)continue;
    const e=Number(em[1]);if(!Number.isFinite(e))continue;
    const delta=relative?e:e-lastE;
    if(!relative)lastE=e;
    if(delta>0&&delta<1000)totalPositiveE+=delta;
  }
  commitLayer();
  if(!raw.length||totalPositiveE<=0||!totalGrams)return{usage:[],layers:maxLayer||null};
  const seen=new Map();
  for(const x of raw)seen.set(x.layer,x.e);
  const usage=[...seen.entries()].sort((a,b)=>a[0]-b[0]).map(([layer,e])=>({layer,grams:Number((Math.min(1,e/totalPositiveE)*totalGrams).toFixed(4))}));
  return{usage,layers:maxLayer||usage.at(-1)?.layer||null};
}
function gramsAtLayer(usage,layer,totalGrams,progress){
  const l=Number(layer)||0;
  if(Array.isArray(usage)&&usage.length&&l>0){let g=0;for(const x of usage){if(Number(x.layer)<=l)g=Math.max(g,Number(x.grams)||0);else break;}return g;}
  const pct=Math.max(0,Math.min(100,Number(progress)||0));
  return totalGrams?totalGrams*pct/100:0;
}
async function undoLegacyFullDeduction(printerId,spoolId,fileName,commandCreatedAt){
  if(!spoolId)return;
  const safe=safeName(fileName);
  const {data:logs}=await db.from('usage_logs').select('id,grams_used,note,created_at').eq('printer_id',printerId).eq('spool_id',spoolId).eq('source','printer').gte('created_at',commandCreatedAt).order('created_at',{ascending:false}).limit(10);
  const legacy=(logs||[]).find(x=>String(x.note||'')===`Auto: ${safe}`);
  if(!legacy)return;
  const grams=Number(legacy.grams_used)||0;if(grams<=0)return;
  const {data:s}=await db.from('spools').select('remaining_weight').eq('id',spoolId).maybeSingle();
  if(s)await db.from('spools').update({remaining_weight:Number(s.remaining_weight||0)+grams}).eq('id',spoolId);
  await db.from('usage_logs').delete().eq('id',legacy.id);
  console.log(`Usage: reversed legacy upfront deduction ${grams.toFixed(2)}g`);
}
async function prepareJobs(){
  const {data:cmds,error}=await db.from('printer_commands').select('id,printer_id,payload,status,created_at,completed_at,usage_prepared').eq('command','upload_print').eq('status','done').eq('usage_prepared',false).order('created_at',{ascending:true}).limit(20);
  if(error)return;
  for(const cmd of cmds||[]){
    const fileId=cmd.payload?.file_id,spoolId=cmd.payload?.spool_id||null;if(!fileId){await db.from('printer_commands').update({usage_prepared:true}).eq('id',cmd.id);continue;}
    const {data:p}=await db.from('printers').select('id,active_print_file_id,usage_committed,current_file').eq('id',cmd.printer_id).maybeSingle();if(!p)continue;
    const {data:f}=await db.from('print_files').select('*').eq('id',fileId).maybeSingle();if(!f)continue;
    let total=Number(f.estimated_grams)||null,usage=f.layer_usage||[],layers=f.parsed_total_layers||null;
    if(!usage.length||!total){
      const dl=await db.storage.from('print-files').download(f.storage_path);if(dl.error){console.error('Usage download:',dl.error.message);continue;}
      const buf=Buffer.from(await dl.data.arrayBuffer());
      try{const text=extractGcode(buf,f.name);total=total||parseTotalGrams(text);const parsed=parseLayerUsage(text,total);usage=parsed.usage;layers=parsed.layers;}
      catch(e){console.error('Usage parse:',e.message);continue;}
      await db.from('print_files').update({estimated_grams:total,layer_usage:usage,parsed_total_layers:layers}).eq('id',fileId);
    }
    await undoLegacyFullDeduction(cmd.printer_id,spoolId,f.name,cmd.created_at);
    await db.from('printers').update({active_print_file_id:fileId,active_print_spool_id:spoolId,estimated_grams:total,actual_grams_used:0,usage_committed:false,usage_tracking_started:false,last_completed_grams:null}).eq('id',cmd.printer_id);
    await db.from('printer_commands').update({usage_prepared:true}).eq('id',cmd.id);
  }
}
async function commitUsage(p,f,actual){
  if(p.usage_committed)return;
  const grams=Math.max(0,Number(actual)||0),spoolId=p.active_print_spool_id;
  if(spoolId&&grams>0){
    const {data:s}=await db.from('spools').select('remaining_weight').eq('id',spoolId).maybeSingle();
    if(s){const used=Math.min(Number(s.remaining_weight)||0,grams);await db.from('spools').update({remaining_weight:Math.max(0,Number(s.remaining_weight||0)-used),last_used:new Date().toISOString()}).eq('id',spoolId);await db.from('usage_logs').insert({spool_id:spoolId,printer_id:p.id,grams_used:used,source:'printer',note:`Actual: ${safeName(f.name)} · Layer ${p.layer_num||0}/${p.total_layers||f.parsed_total_layers||'?'}`});}
  }
  await db.from('printers').update({actual_grams_used:grams,last_completed_grams:grams,usage_committed:true,usage_tracking_started:false,active_print_file_id:null,active_print_spool_id:null}).eq('id',p.id);
  console.log(`Usage committed: ${grams.toFixed(2)}g · ${p.name||p.id}`);
}
async function trackActive(){
  const {data:ps,error}=await db.from('printers').select('id,name,status,layer_num,total_layers,print_progress,active_print_file_id,active_print_spool_id,estimated_grams,actual_grams_used,usage_committed,usage_tracking_started').not('active_print_file_id','is',null);
  if(error)return;
  for(const p of ps||[]){
    const {data:f}=await db.from('print_files').select('id,name,estimated_grams,layer_usage,parsed_total_layers').eq('id',p.active_print_file_id).maybeSingle();if(!f)continue;
    const total=Number(f.estimated_grams||p.estimated_grams)||0;
    const actual=gramsAtLayer(f.layer_usage,p.layer_num,total,p.print_progress);
    const started=p.usage_tracking_started||['printing','paused'].includes(p.status)||Number(p.layer_num)>0||Number(p.print_progress)>0;
    const patch={actual_grams_used:Number(actual.toFixed(3))};if(started&&!p.usage_tracking_started)patch.usage_tracking_started=true;
    await db.from('printers').update(patch).eq('id',p.id);
    if(started&&['idle','error','offline'].includes(String(p.status||'')))await commitUsage({...p,usage_tracking_started:true},f,actual);
  }
}
async function tick(){if(busy)return;busy=true;try{if(!(await ensureSession()))return;await prepareJobs();await trackActive();}catch(e){console.error('Usage worker:',e.message||e);}finally{busy=false;}}

console.log('Filament usage worker started');
setInterval(tick,1000);
setTimeout(tick,500);
