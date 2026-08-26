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
const CLOUD = 'https://filaments-cloud.vercel.app';

fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
let config = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { session: null, printers: {} };
const clients = new Map();
const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: true } });

function saveConfig(){ fs.writeFileSync(FILE, JSON.stringify(config, null, 2), { mode: 0o600 }); }
function json(res,status,body){ res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body)); }
function html(res,status,body){ res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body); }
async function ensureSession(){
  if(!config.session?.access_token || !config.session?.refresh_token) return false;
  const { data, error } = await db.auth.setSession(config.session);
  if(error) return false;
  if(data.session){config.session={access_token:data.session.access_token,refresh_token:data.session.refresh_token};saveConfig();}
  return true;
}
function commandPayload(command,payload={}){
  const sequence_id=String(Date.now());
  if(['pause','resume','stop'].includes(command)) return {print:{sequence_id,command,param:''}};
  if(command==='print_speed') return {print:{sequence_id,command:'print_speed',param:String(payload.level||2)}};
  return null;
}
async function updatePrinter(id,patch){
  const {error}=await db.from('printers').update({...patch,last_seen_at:new Date().toISOString()}).eq('id',id);
  if(error) console.error('DB update:',error.message);
}
function connectPrinter(p){
  const old=clients.get(p.id);
  if(old){ try{old.end(true);}catch{} clients.delete(p.id); }
  const c=mqtt.connect(`mqtts://${p.lan_ip}:8883`,{username:'bblp',password:p.access_code,rejectUnauthorized:false,reconnectPeriod:3000,connectTimeout:8000,clean:true});
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
      const msg=JSON.parse(buf.toString()); if(msg.print) state={...state,...msg.print};
      const s=state,g=String(s.gcode_state||'').toUpperCase();
      const status=g==='RUNNING'?'printing':g==='PAUSE'?'paused':g==='FAILED'?'error':'idle';
      await updatePrinter(p.id,{status,nozzle_temp:s.nozzle_temper??null,nozzle_target:s.nozzle_target_temper??null,bed_temp:s.bed_temper??null,bed_target:s.bed_target_temper??null,chamber_temp:s.chamber_temper??null,print_progress:s.mc_percent??null,remaining_minutes:s.mc_remaining_time??null,current_file:s.subtask_name||s.gcode_file||null});
    }catch(e){console.error('MQTT parse:',e.message);}
  });
  c.on('error',e=>console.error(`${p.name}:`,e.message));
  c.on('close',()=>updatePrinter(p.id,{status:'offline'}));
}
async function pair(body){
  if(!body.printer_id||!body.lan_ip||!body.serial_number||!body.access_code||!body.access_token||!body.refresh_token) throw new Error('Missing pairing data');
  config.session={access_token:body.access_token,refresh_token:body.refresh_token};
  config.printers[body.printer_id]={name:body.name||'Bambu',lan_ip:body.lan_ip,serial_number:body.serial_number,access_code:body.access_code};
  saveConfig();
  if(!(await ensureSession())) throw new Error('Cloud session failed');
  connectPrinter({id:body.printer_id,...config.printers[body.printer_id]});
}
async function loadPrinters(){
  if(!(await ensureSession()))return;
  const {data,error}=await db.from('printers').select('id,name,lan_ip,serial_number,connection_type,remote_enabled').eq('connection_type','bambu_lan').eq('remote_enabled',true);
  if(error)return console.error(error.message);
  for(const row of data||[]){const secret=config.printers[row.id];if(secret&&!clients.has(row.id))connectPrinter({...row,...secret});}
}
async function pollCommands(){
  if(!(await ensureSession()))return;
  const ids=[...clients.keys()];if(!ids.length)return;
  const {data}=await db.from('printer_commands').select('*').in('printer_id',ids).eq('status','queued').order('created_at',{ascending:true}).limit(20);
  for(const cmd of data||[]){
    const c=clients.get(cmd.printer_id),p=config.printers[cmd.printer_id];if(!c||!p||!c.connected)continue;
    const body=commandPayload(cmd.command,cmd.payload);if(!body)continue;
    await db.from('printer_commands').update({status:'sent'}).eq('id',cmd.id);
    c.publish(`device/${p.serial_number}/request`,JSON.stringify(body),{qos:1},async err=>{
      await db.from('printer_commands').update(err?{status:'failed',error:err.message,completed_at:new Date().toISOString()}:{status:'done',completed_at:new Date().toISOString()}).eq('id',cmd.id);
    });
  }
}

function pairingPage(){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Filaments Bridge</title><style>body{margin:0;background:#080d18;color:#eef4ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial;display:grid;place-items:center;min-height:100vh;padding:20px}.card{width:min(520px,100%);background:#111a2b;border:1px solid #26354d;border-radius:20px;padding:24px;box-sizing:border-box}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#fbbf24;margin-left:8px}.ok{background:#22c55e}.bad{background:#f87171}.muted{color:#91a2bb;font-size:13px}.btn{display:inline-block;margin-top:16px;padding:11px 16px;border-radius:12px;background:#60a5fa;color:#07111e;text-decoration:none;font-weight:800}</style></head><body><div class="card"><h1>Filaments Bridge</h1><p id="state"><span class="dot"></span>جاري ربط الطابعة...</p><p class="muted" id="detail">لا تغلق هذه الصفحة.</p><a id="back" class="btn" href="${CLOUD}" style="display:none">الرجوع إلى Filaments Manager</a></div><script>
(async()=>{const state=document.getElementById('state'),detail=document.getElementById('detail'),back=document.getElementById('back');try{if(!location.hash)throw new Error('بيانات الربط غير موجودة');const data=JSON.parse(decodeURIComponent(location.hash.slice(1)));history.replaceState(null,'',location.pathname);const r=await fetch('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Pair failed');state.innerHTML='<span class="dot ok"></span>تم ربط الطابعة بنجاح';detail.textContent='الـBridge استلم بيانات الطابعة وبدأ محاولة الاتصال بها.';back.style.display='inline-block';setTimeout(()=>location.href='${CLOUD}',1800);}catch(e){state.innerHTML='<span class="dot bad"></span>فشل الربط';detail.textContent=e.message||String(e);back.style.display='inline-block';}})();
</script></body></html>`}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/health'&&req.method==='GET')return json(res,200,{ok:true,printers:clients.size});
  if(url.pathname==='/pair-setup'&&req.method==='GET')return html(res,200,pairingPage());
  if(url.pathname==='/pair'&&req.method==='POST'){
    let raw='';for await(const chunk of req)raw+=chunk;
    try{await pair(JSON.parse(raw||'{}'));return json(res,200,{ok:true});}catch(e){return json(res,400,{error:e.message});}
  }
  return json(res,404,{error:'Not found'});
});

server.listen(PORT,'127.0.0.1',()=>console.log(`Filaments Bridge listening on http://127.0.0.1:${PORT}`));
await ensureSession();await loadPrinters();setInterval(loadPrinters,15000);setInterval(pollCommands,1000);
