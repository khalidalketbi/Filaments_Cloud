import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const CLOUD='https://filaments-cloud.vercel.app';
const CONFIG_FILE=path.join(os.homedir(),'.filaments-bridge','config.json');
let db=null,busy=false;

function readConfig(){try{return JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8'));}catch{return{};}}
async function getDb(){if(db)return db;const txt=await fetch(`${CLOUD}/config.js?stats=${Date.now()}`).then(r=>r.text());const url=txt.match(/SUPABASE_URL:\s*["']([^"']+)/)?.[1],key=txt.match(/SUPABASE_ANON_KEY:\s*["']([^"']+)/)?.[1];if(!url||!key)throw new Error('Cloud config unavailable');db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:true}});return db;}
async function ensureSession(){const c=readConfig();if(!c.session?.access_token||!c.session?.refresh_token)return false;const d=await getDb();const {data,error}=await d.auth.setSession(c.session);if(error){console.error('Printer stats session:',error.message);return false;}return!!data.session;}

async function tick(){
  if(busy)return;busy=true;
  try{
    if(!(await ensureSession()))return;
    const d=await getDb();
    const {data:{user}}=await d.auth.getUser();if(!user)return;
    const {data:printers,error}=await d.from('printers').select('id,name,status,current_file,print_progress,print_started_remote_at,actual_grams_used,last_completed_grams').order('name');
    if(error)throw error;
    for(const p of printers||[]){
      const active=['printing','paused'].includes(String(p.status||''));
      const {data:open}=await d.from('printer_print_sessions').select('*').eq('printer_id',p.id).is('ended_at',null).order('started_at',{ascending:false}).limit(1).maybeSingle();
      if(active&&!open){
        const started=p.print_started_remote_at||new Date().toISOString();
        const {error:e}=await d.from('printer_print_sessions').insert({user_id:user.id,printer_id:p.id,file_name:p.current_file||null,started_at:started,result:'printing'});if(e)throw e;
        console.log(`Stats session started: ${p.name}`);
      }else if(active&&open){
        const patch={file_name:p.current_file||open.file_name,updated_at:new Date().toISOString(),grams_used:Number(p.actual_grams_used)||open.grams_used||null};
        await d.from('printer_print_sessions').update(patch).eq('id',open.id);
      }else if(!active&&open){
        const ended=new Date();const started=new Date(open.started_at);const seconds=Math.max(0,Math.round((ended-started)/1000));
        const result=String(p.status||'')==='error'?'error':Number(p.print_progress)>=99?'completed':'stopped';
        const grams=Number(p.last_completed_grams||p.actual_grams_used||open.grams_used)||null;
        await d.from('printer_print_sessions').update({ended_at:ended.toISOString(),duration_seconds:seconds,result,grams_used:grams,updated_at:ended.toISOString()}).eq('id',open.id);
        console.log(`Stats session ended: ${p.name} · ${result} · ${seconds}s`);
      }
    }
  }catch(e){console.error('Printer stats worker:',e.message||e);}finally{busy=false;}
}

console.log('Printer stats worker started');
setInterval(tick,2000);
setTimeout(tick,900);
