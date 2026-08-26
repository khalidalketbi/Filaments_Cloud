import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://fljoowkjmvqijqiaimpp.supabase.co';
const SUPABASE_KEY='sb_publishable_YdE-PNM_SrerYvKjBn68BQ_8YCpuKR9';
const FILE=path.join(os.homedir(),'.filaments-bridge','config.json');
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:true}});
const previous=new Map();
let busy=false;

function readConfig(){try{return JSON.parse(fs.readFileSync(FILE,'utf8'));}catch{return{};}}
async function ensureSession(){const c=readConfig();if(!c.session?.access_token||!c.session?.refresh_token)return false;const {data,error}=await db.auth.setSession(c.session);if(error){console.error('Print cleaner session:',error.message);return false;}return!!data.session;}

async function clearFinishedPrint(p){
  const {error}=await db.from('printers').update({
    current_file:null,
    print_progress:0,
    remaining_minutes:null,
    layer_num:null,
    total_layers:null,
    estimated_end_at:null,
    print_started_remote_at:null
  }).eq('id',p.id);
  if(error)console.error('Print cleaner:',error.message);
  else console.log(`Print cleared: ${p.name||p.id}`);
}

async function tick(){
  if(busy)return;busy=true;
  try{
    if(!(await ensureSession()))return;
    const {data,error}=await db.from('printers').select('id,name,status,current_file,bridge_last_seen_at').eq('connection_type','bambu_lan').eq('remote_enabled',true);
    if(error)return;
    for(const p of data||[]){
      const now=String(p.status||'');
      const before=previous.get(p.id);
      const finished=(before==='printing'||before==='paused')&&(now==='idle'||now==='error');
      if(finished&&p.current_file)await clearFinishedPrint(p);
      previous.set(p.id,now);
    }
  }catch(e){console.error('Print cleaner:',e.message||e);}finally{busy=false;}
}

console.log('Print state cleaner started');
setInterval(tick,900);
setTimeout(tick,500);
