import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fljoowkjmvqijqiaimpp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YdE-PNM_SrerYvKjBn68BQ_8YCpuKR9';
const PORT = Number(process.env.FILAMENTS_BRIDGE_PORT || 18473);
const DIR = path.join(os.homedir(), '.filaments-bridge');
const FILE = path.join(DIR, 'config.json');
const allowedOrigins = new Set([
  'https://filaments-cloud.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
let config = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { session: null, printers: {} };
const clients = new Map();
let db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: true } });

function saveConfig(){ fs.writeFileSync(FILE, JSON.stringify(config, null, 2), { mode: 0o600 }); }
function reply(res,status,body,origin){
  if(origin && allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers','content-type');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS,GET');
  res.setHeader('Content-Type','application/json');
  res.writeHead(status);res.end(JSON.stringify(body));
}
async function ensureSession(){
  if(!config.session?.access_token || !config.session?.refresh_token) return false;
  const { data, error } = await db.auth.setSession(config.session);
  if(error) return false;
  if(data.session){ config.session={access_token:data.session.access_token,refresh_token:data.session.refresh_token}; saveConfig(); }
  return true;
}
function commandPayload(command,payload={}){
  const seq=String(Date.now());
  if(command==='pause'||command==='resume'||command==='stop') return {print:{sequence_id:seq,command,param:''}};
  if(command==='print_speed') return {print:{sequence_id:seq,command:'print_speed',param:String(payload.level||2)}};
  return null;
}
async function updatePrinter(id, patch){
  const { error } = await db.from('printers').update({...patch,last_seen_at:new Date().toISOString()}).eq('id',id);
  if(error) console.error('DB update:',error.message);
}
function connectPrinter(p){
  if(clients.has(p.id)) return;
  const c=mqtt.connect(`mqtts://${p.lan_ip}:8883`,{
    username:'bblp',password:p.access_code,rejectUnauthorized:false,reconnectPeriod:3000,connectTimeout:8000,clean:true
  });
  clients.set(p.id,c);
  let state={};
  c.on('connect',()=>{
    console.log(`Connected: ${p.name} (${p.lan_ip})`);
    c.subscribe(`device/${p.serial_number}/report`,{qos:1});
    c.publish(`device/${p.serial_number}/request`,JSON.stringify({pushing:{sequence_id:String(Date.now()),command:'pushall',version:1,push_target:1}}),{qos:1});
    updatePrinter(p.id,{status:'idle'});
  });
  c.on('message',async(_,buf)=>{
    try{
      const msg=JSON.parse(buf.toString());
      if(msg.print) state={...state,...msg.print};
      const s=state;
      const g=String(s.gcode_state||'').toUpperCase();
      const status=g==='RUNNING'?'printing':g==='PAUSE'?'paused':g==='FAILED'?'error':'idle';
      await updatePrinter(p.id,{
        status,
        nozzle_temp:s.nozzle_temper ?? null,
        nozzle_target:s.nozzle_target_temper ?? null,
        bed_temp:s.bed_temper ?? null,
        bed_target:s.bed_target_temper ?? null,
        chamber_temp:s.chamber_temper ?? null,
        print_progress:s.mc_percent ?? null,
        remaining_minutes:s.mc_remaining_time ?? null,
        current_file:s.subtask_name || s.gcode_file || null
      });
    }catch(e){ console.error('MQTT parse:',e.message); }
  });
  c.on('error',e=>console.error(`${p.name}:`,e.message));
  c.on('close',()=>updatePrinter(p.id,{status:'offline'}));
}
async function loadPrinters(){
  if(!(await ensureSession())) return;
  const { data, error } = await db.from('printers').select('id,name,lan_ip,serial_number,connection_type,remote_enabled').eq('connection_type','bambu_lan').eq('remote_enabled',true);
  if(error) return console.error(error.message);
  for(const row of data||[]){
    const secret=config.printers[row.id];
    if(secret) connectPrinter({...row,...secret});
  }
}
async function pollCommands(){
  if(!(await ensureSession())) return;
  const ids=[...clients.keys()];if(!ids.length)return;
  const { data } = await db.from('printer_commands').select('*').in('printer_id',ids).eq('status','queued').order('created_at',{ascending:true}).limit(20);
  for(const cmd of data||[]){
    const c=clients.get(cmd.printer_id);const p=config.printers[cmd.printer_id];if(!c||!p||!c.connected)continue;
    const body=commandPayload(cmd.command,cmd.payload);if(!body)continue;
    try{
      await db.from('printer_commands').update({status:'sent'}).eq('id',cmd.id);
      c.publish(`device/${p.serial_number}/request`,JSON.stringify(body),{qos:1},async err=>{
        await db.from('printer_commands').update(err?{status:'failed',error:err.message,completed_at:new Date().toISOString()}:{status:'done',completed_at:new Date().toISOString()}).eq('id',cmd.id);
      });
    }catch(e){ console.error(e.message); }
  }
}

const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin||'';
  if(req.method==='OPTIONS') return reply(res,204,{},origin);
  if(req.url==='/health'&&req.method==='GET') return reply(res,200,{ok:true,printers:clients.size},origin);
  if(req.url==='/pair'&&req.method==='POST'){
    if(origin && !allowedOrigins.has(origin)) return reply(res,403,{error:'Origin not allowed'},origin);
    let raw='';for await(const chunk of req) raw+=chunk;
    try{
      const b=JSON.parse(raw||'{}');
      if(!b.printer_id||!b.lan_ip||!b.serial_number||!b.access_code||!b.access_token||!b.refresh_token) return reply(res,400,{error:'Missing pairing data'},origin);
      config.session={access_token:b.access_token,refresh_token:b.refresh_token};
      config.printers[b.printer_id]={name:b.name||'Bambu',lan_ip:b.lan_ip,serial_number:b.serial_number,access_code:b.access_code};
      saveConfig();
      await ensureSession();
      connectPrinter({id:b.printer_id,...config.printers[b.printer_id]});
      return reply(res,200,{ok:true},origin);
    }catch(e){return reply(res,400,{error:e.message},origin);}
  }
  reply(res,404,{error:'Not found'},origin);
});

server.listen(PORT,'127.0.0.1',()=>console.log(`Filaments Bridge listening on http://127.0.0.1:${PORT}`));
await ensureSession();
await loadPrinters();
setInterval(loadPrinters,15000);
setInterval(pollCommands,1000);
