import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const CLOUD='https://filaments-cloud.vercel.app';
const CONFIG_FILE=path.join(os.homedir(),'.filaments-bridge','config.json');
let db=null;

function readConfig(){try{return JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8'));}catch{return{};}}
function norm(v=''){return path.basename(String(v)).toLowerCase().replace(/\.gcode\.3mf$/i,'').replace(/\.3mf$/i,'').replace(/\.gcode$/i,'').replace(/[^a-z0-9]+/g,'');}

async function getDb(){
  if(db)return db;
  const txt=await fetch(`${CLOUD}/config.js?bridge=${Date.now()}`).then(r=>r.text());
  const url=txt.match(/SUPABASE_URL:\s*["']([^"']+)/)?.[1];
  const key=txt.match(/SUPABASE_ANON_KEY:\s*["']([^"']+)/)?.[1];
  if(!url||!key)throw new Error('Cloud config unavailable');
  db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:true}});
  return db;
}

async function ensureSession(){
  const c=readConfig();
  if(!c.session?.access_token||!c.session?.refresh_token)return false;
  const d=await getDb();
  const {data,error}=await d.auth.setSession(c.session);
  if(error){console.error('Multi printer linker session:',error.message);return false;}
  return !!data.session;
}

async function tick(){
  try{
    if(!(await ensureSession()))return;
    const d=await getDb();
    const {data:printers,error}=await d.from('printers')
      .select('id,name,status,current_file,total_layers,loaded_spool_id,active_print_spool_id,active_print_file_id')
      .eq('connection_type','bambu_lan')
      .in('status',['printing','paused'])
      .is('active_print_file_id',null);
    if(error)throw error;
    if(!printers?.length)return;

    const {data:files,error:fe}=await d.from('print_files')
      .select('id,name,estimated_grams,parsed_total_layers,created_at')
      .not('estimated_grams','is',null)
      .order('created_at',{ascending:false})
      .limit(100);
    if(fe)throw fe;

    for(const p of printers){
      const n=norm(p.current_file);
      if(!n)continue;
      const match=(files||[]).find(f=>{
        if(norm(f.name)!==n)return false;
        if(p.total_layers&&f.parsed_total_layers&&Number(p.total_layers)!==Number(f.parsed_total_layers))return false;
        return Number(f.estimated_grams)>0;
      });
      if(!match)continue;
      const spoolId=p.loaded_spool_id||p.active_print_spool_id||null;
      const {error:u}=await d.from('printers').update({
        active_print_file_id:match.id,
        active_print_spool_id:spoolId,
        estimated_grams:Number(match.estimated_grams),
        actual_grams_used:0,
        usage_committed:false,
        usage_tracking_started:true
      }).eq('id',p.id).is('active_print_file_id',null);
      if(!u)console.log(`Multi printer file linked: ${p.name} -> ${match.name} (${Number(match.estimated_grams).toFixed(1)}g)`);
    }
  }catch(e){console.error('Multi printer file linker:',e.message||e);}
}

console.log('Multi printer file linker started');
setInterval(tick,3000);
setTimeout(tick,1200);
