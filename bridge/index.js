import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import mqtt from 'mqtt';
import * as ftp from 'basic-ftp';
import AdmZip from 'adm-zip';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://fljoowkjmvqijqiaimpp.supabase.co';
const SUPABASE_KEY='sb_publishable_YdE-PNM_SrerYvKjBn68BQ_8YCpuKR9';
const PORT=Number(process.env.FILAMENTS_BRIDGE_PORT||18473);
const DIR=path.join(os.homedir(),'.filaments-bridge');
const FILE=path.join(DIR,'config.json');
const CLOUD='https://filaments-cloud.vercel.app';
fs.mkdirSync(DIR,{recursive:true,mode:0o700});
let config=fs.existsSync(FILE)?JSON.parse(fs.readFileSync(FILE,'utf8')):{session:null,printers:{}};
const clients=new Map();
const cameras=new Map();
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:true}});

function saveConfig(){fs.writeFileSync(FILE,JSON.stringify(config,null,2),{mode:0o600});}
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
function html(res,status,body){res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);}
async function ensureSession(){if(!config.session?.access_token||!config.session?.refresh_token)return false;const {data,error}=await db.auth.setSession(config.session);if(error){console.error('Cloud session:',error.message);return false;}if(data.session){config.session={access_token:data.session.access_token,refresh_token:data.session.refresh_token};saveConfig();}return true;}
const seq=()=>String(Date.now());
const gcode=param=>({print:{sequence_id:seq(),command:'gcode_line',param}});
function commandPayload(command,p={}){
  if(['pause','resume','stop'].includes(command))return{print:{sequence_id:seq(),command,param:''}};
  if(command==='print_speed')return{print:{sequence_id:seq(),command:'print_speed',param:String(Math.max(1,Math.min(4,Number(p.level)||2)))}};
  if(command==='nozzle_temp')return gcode(`M104 S${Math.max(0,Math.min(300,Number(p.temp)||0))}`);
  if(command==='bed_temp')return gcode(`M140 S${Math.max(0,Math.min(100,Number(p.temp)||0))}`);
  if(command==='fan')return gcode(`M106 P${p.fan==='aux'?2:p.fan==='chamber'?3:1} S${Math.round(Math.max(0,Math.min(100,Number(p.percent)||0))*2.55)}`);
  if(command==='light')return{system:{sequence_id:seq(),command:'ledctrl',led_node:'chamber_light',led_mode:p.on?'on':'off',led_on_time:500,led_off_time:500,loop_times:1,interval_time:1000}};
  if(command==='unload_filament')return{print:{sequence_id:seq(),command:'unload_filament'}};
  if(command==='load_filament')return{print:{sequence_id:seq(),command:'ams_change_filament',target:Number.isFinite(Number(p.slot))?Number(p.slot):254,curr_temp:Number(p.temp)||220,tar_temp:Number(p.temp)||220}};
  if(command==='calibration')return{print:{sequence_id:seq(),command:'calibration',option:Number(p.option)||0}};
  if(command==='move'){const axis=['X','Y','Z'].includes(p.axis)?p.axis:'X';const n=Math.max(-50,Math.min(50,Number(p.distance)||0));return gcode(`G91\nG1 ${axis}${n} F${axis==='Z'?600:6000}\nG90`);}
  if(command==='extrude'){const n=Math.max(-20,Math.min(20,Number(p.distance)||0));return gcode(`M83\nG1 E${n} F300`);}
  if(command==='skip_objects'){const ids=(p.object_ids||[]).map(Number).filter(Number.isFinite);return{print:{sequence_id:seq(),command:'skip_objects',timestamp:Math.floor(Date.now()/1000),obj_list:ids}};}
  if(command==='set_spool')return{print:{sequence_id:seq(),command:'ams_filament_setting',ams_id:Number(p.ams_id)||0,tray_id:Number.isFinite(Number(p.tray_id))?Number(p.tray_id):254,tray_info_idx:p.tray_info_idx||'GFL99',tray_type:p.material||'PLA',tray_sub_brands:p.name||'',tray_color:String(p.color||'#FFFFFF').replace('#','')+'FF',nozzle_temp_min:Number(p.nozzle_min)||190,nozzle_temp_max:Number(p.nozzle_max)||260}};
  return null;
}
async function patchPrinter(id,patch){const {error}=await db.from('printers').update(patch).eq('id',id);if(error)console.error('DB update:',error.message);}
async function markSeen(id,patch={}){await patchPrinter(id,{...patch,last_seen_at:new Date().toISOString(),bridge_last_seen_at:new Date().toISOString(),remote_error:null});}
function publish(printerId,body){const c=clients.get(printerId),p=config.printers[printerId];if(!c||!p||!c.connected)throw new Error('Printer MQTT offline');return new Promise((resolve,reject)=>c.publish(`device/${p.serial_number}/request`,JSON.stringify(body),{qos:1},e=>e?reject(e):resolve()));}

async function uploadCameraFrame(printerId,jpeg){
  try{
    const {data:{user}}=await db.auth.getUser();if(!user)return;
    const storagePath=`${user.id}/camera/${printerId}.jpg`;
    const up=await db.storage.from('print-files').upload(storagePath,jpeg,{contentType:'image/jpeg',upsert:true,cacheControl:'0'});
    if(up.error)throw up.error;
    await patchPrinter(printerId,{camera_path:storagePath});
  }catch(e){console.error('Camera upload:',e.message||e);}
}
function stopCamera(id){const old=cameras.get(id);if(old){try{old.destroy();}catch{}cameras.delete(id);}}
function startA1Camera(p){
  if(!/^(a1|p1)/i.test(String(p.model||'')))return;
  if(cameras.has(p.id))return;
  let buffer=Buffer.alloc(0),lastUpload=0,reconnectTimer=null;
  const socket=tls.connect({host:p.lan_ip,port:6000,rejectUnauthorized:false,servername:p.lan_ip},()=>{
    console.log(`Camera connected: ${p.name}`);
    const auth=Buffer.alloc(80);auth.writeUInt32LE(0x40,0);auth.writeUInt32LE(0x3000,4);auth.writeUInt32LE(0,8);auth.writeUInt32LE(0,12);auth.write('bblp',16,'ascii');auth.write(String(p.access_code||''),48,'ascii');socket.write(auth);
  });
  cameras.set(p.id,socket);
  socket.on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    while(buffer.length>=16){const size=buffer.readUInt32LE(0);if(size<=0||size>20_000_000){buffer=buffer.subarray(1);continue;}if(buffer.length<16+size)break;const jpg=buffer.subarray(16,16+size);buffer=buffer.subarray(16+size);if(jpg[0]===0xff&&jpg[1]===0xd8&&jpg[jpg.length-2]===0xff&&jpg[jpg.length-1]===0xd9){const now=Date.now();if(now-lastUpload>=1800){lastUpload=now;uploadCameraFrame(p.id,Buffer.from(jpg));}}}
  });
  const retry=()=>{if(cameras.get(p.id)===socket)cameras.delete(p.id);if(!reconnectTimer)reconnectTimer=setTimeout(()=>{reconnectTimer=null;startA1Camera(p);},5000);};
  socket.on('error',e=>{console.error(`Camera ${p.name}:`,e.message);});socket.on('close',retry);
}

function connectPrinter(p){
  const existing=clients.get(p.id);if(existing){try{existing.end(true);}catch{}clients.delete(p.id);}stopCamera(p.id);
  const c=mqtt.connect(`mqtts://${p.lan_ip}:8883`,{username:'bblp',password:p.access_code,rejectUnauthorized:false,reconnectPeriod:3000,connectTimeout:8000,clean:true});clients.set(p.id,c);let state={};
  c.on('connect',async()=>{console.log(`Connected: ${p.name} (${p.lan_ip})`);await c.subscribe(`device/${p.serial_number}/report`,{qos:1});c.publish(`device/${p.serial_number}/request`,JSON.stringify({pushing:{sequence_id:seq(),command:'pushall',version:1,push_target:1}}),{qos:1});await markSeen(p.id,{status:'idle'});startA1Camera(p);});
  c.on('reconnect',()=>console.log(`Reconnecting: ${p.name}`));
  c.on('message',async(_,buf)=>{try{const msg=JSON.parse(buf.toString());if(msg.print)state={...state,...msg.print};const s=state,g=String(s.gcode_state||'').toUpperCase();const status=g==='RUNNING'?'printing':g==='PAUSE'?'paused':g==='FAILED'?'error':g==='FINISH'?'idle':'idle';const rem=s.mc_remaining_time??null;const patch={status,nozzle_temp:s.nozzle_temper??null,nozzle_target:s.nozzle_target_temper??null,bed_temp:s.bed_temper??null,bed_target:s.bed_target_temper??null,chamber_temp:s.chamber_temper??null,part_fan_percent:s.cooling_fan_speed!=null?Math.round(Number(s.cooling_fan_speed)/2.55):null,aux_fan_percent:s.big_fan1_speed!=null?Math.round(Number(s.big_fan1_speed)/2.55):null,chamber_fan_percent:s.big_fan2_speed!=null?Math.round(Number(s.big_fan2_speed)/2.55):null,light_on:Array.isArray(s.lights_report)?s.lights_report.some(x=>x.node==='chamber_light'&&x.mode==='on'):null,print_progress:s.mc_percent??null,remaining_minutes:rem,current_file:s.subtask_name||s.gcode_file||null,layer_num:s.layer_num??null,total_layers:s.total_layer_num??null,speed_level:s.spd_lvl??null,ams_tray:s.ams?.tray_now??null,hms:s.hms||[],skipped_objects:s.s_obj||[],estimated_end_at:rem!=null?new Date(Date.now()+Number(rem)*60000).toISOString():null};if(status==='printing'&&!s._filamentsStarted){patch.print_started_remote_at=new Date().toISOString();s._filamentsStarted=true;}if(status!=='printing'&&status!=='paused')s._filamentsStarted=false;await markSeen(p.id,patch);}catch(e){console.error('MQTT parse:',e.message);}});
  c.on('error',async e=>{console.error(`${p.name}:`,e.message);await patchPrinter(p.id,{status:'offline',remote_error:e.message});});
  c.on('close',async()=>{await patchPrinter(p.id,{status:'offline'});});
}
async function pair(body){if(!body.printer_id||!body.lan_ip||!body.serial_number||!body.access_code||!body.access_token||!body.refresh_token)throw new Error('Missing pairing data');config.session={access_token:body.access_token,refresh_token:body.refresh_token};config.printers[body.printer_id]={name:body.name||'Bambu',model:body.model||'Bambu',lan_ip:body.lan_ip,serial_number:body.serial_number,access_code:body.access_code};saveConfig();if(!(await ensureSession()))throw new Error('Cloud session failed');connectPrinter({id:body.printer_id,...config.printers[body.printer_id]});}
async function loadPrinters(){if(!(await ensureSession()))return;const {data,error}=await db.from('printers').select('id,name,model,lan_ip,serial_number,connection_type,remote_enabled').eq('connection_type','bambu_lan').eq('remote_enabled',true);if(error)return console.error(error.message);for(const row of data||[]){const secret=config.printers[row.id];if(secret&&!clients.has(row.id))connectPrinter({...row,...secret,model:row.model||secret.model});}}
function parse3mf(buf){let grams=null,objects=[],thumb=null,plate='Metadata/plate_1.gcode';try{const zip=new AdmZip(buf),entries=zip.getEntries();const gc=entries.find(e=>/plate_\d+\.gcode$/i.test(e.entryName))||entries.find(e=>/\.gcode$/i.test(e.entryName));if(gc){plate=gc.entryName;const t=gc.getData().toString('utf8');const m=t.match(/filament used \[g\]\s*=\s*([^\r\n]+)/i);if(m){const nums=m[1].match(/[0-9.]+/g)||[];grams=nums.reduce((a,x)=>a+Number(x),0)||null;}}const si=entries.find(e=>/slice_info\.config$/i.test(e.entryName));if(si){const txt=si.getData().toString('utf8');objects=[...txt.matchAll(/identify_id[^0-9]+([0-9]+)/gi)].map(m=>Number(m[1]));objects=[...new Set(objects)];}const png=entries.find(e=>/plate_\d+\.png$/i.test(e.entryName))||entries.find(e=>/thumbnail.*\.png$/i.test(e.entryName));if(png)thumb=png.getData();}catch{}return{grams,objects,thumb,plate};}
async function uploadAndPrint(cmd,p){const fileId=cmd.payload?.file_id;if(!fileId)throw new Error('Missing file_id');const {data:f,error}=await db.from('print_files').select('*').eq('id',fileId).single();if(error||!f)throw new Error(error?.message||'File not found');const dl=await db.storage.from('print-files').download(f.storage_path);if(dl.error)throw dl.error;const buf=Buffer.from(await dl.data.arrayBuffer());let meta={grams:f.estimated_grams,objects:f.object_ids||[],thumb:null,plate:'Metadata/plate_1.gcode'};if(/\.3mf$/i.test(f.name))meta={...meta,...parse3mf(buf)};const safe=path.basename(f.name).replace(/[^a-zA-Z0-9._-]/g,'_'),temp=path.join(os.tmpdir(),`filaments-${Date.now()}-${safe}`);fs.writeFileSync(temp,buf);const client=new ftp.Client(20000);try{await client.access({host:p.lan_ip,port:990,user:'bblp',password:p.access_code,secure:'implicit',secureOptions:{rejectUnauthorized:false}});await client.uploadFrom(temp,safe);}finally{client.close();try{fs.unlinkSync(temp);}catch{}}let thumbPath=f.thumbnail_path;if(meta.thumb){const {data:{user}}=await db.auth.getUser();if(user){thumbPath=`${user.id}/previews/${fileId}.png`;await db.storage.from('print-files').upload(thumbPath,meta.thumb,{contentType:'image/png',upsert:true});}}await db.from('print_files').update({estimated_grams:meta.grams,object_ids:meta.objects,thumbnail_path:thumbPath}).eq('id',fileId);if(/\.3mf$/i.test(safe))await publish(cmd.printer_id,{print:{sequence_id:seq(),command:'project_file',param:meta.plate||'Metadata/plate_1.gcode',project_id:'0',profile_id:'0',task_id:'0',subtask_id:'0',subtask_name:safe,file:'',url:`ftp:///${safe}`,md5:'',timelapse:!!cmd.payload?.timelapse,bed_type:'auto',bed_levelling:cmd.payload?.bed_levelling!==false,flow_cali:!!cmd.payload?.flow_cali,vibration_cali:!!cmd.payload?.vibration_cali,layer_inspect:true,ams_mapping:cmd.payload?.ams_mapping||'',use_ams:!!cmd.payload?.use_ams}});else await publish(cmd.printer_id,{print:{sequence_id:seq(),command:'gcode_file',param:`/sdcard/${safe}`}});const grams=Number(meta.grams||cmd.payload?.estimated_grams||0),spoolId=cmd.payload?.spool_id;if(spoolId&&grams>0){const {data:s}=await db.from('spools').select('remaining_weight').eq('id',spoolId).single();if(s){const used=Math.min(Number(s.remaining_weight)||0,grams);await db.from('spools').update({remaining_weight:Math.max(0,Number(s.remaining_weight)-used),last_used:new Date().toISOString()}).eq('id',spoolId);await db.from('usage_logs').insert({spool_id:spoolId,printer_id:cmd.printer_id,grams_used:used,source:'printer',note:`Auto: ${safe}`});}}await markSeen(cmd.printer_id,{print_started_remote_at:new Date().toISOString(),estimated_grams:grams||null,current_file:safe});}
async function recoverCommands(){const ids=[...clients.keys()];if(!ids.length)return;const cutoff=new Date(Date.now()-15000).toISOString();await db.from('printer_commands').update({status:'queued'}).in('printer_id',ids).eq('status','sent').lt('created_at',cutoff);}
async function pollCommands(){if(!(await ensureSession()))return;const ids=[...clients.entries()].filter(([,c])=>c.connected).map(([id])=>id);if(!ids.length)return;const {data}=await db.from('printer_commands').select('*').in('printer_id',ids).eq('status','queued').order('created_at',{ascending:true}).limit(30);for(const cmd of data||[]){const p=config.printers[cmd.printer_id];if(!p)continue;try{await db.from('printer_commands').update({status:'sent',error:null}).eq('id',cmd.id);if(cmd.command==='upload_print')await uploadAndPrint(cmd,p);else{const body=commandPayload(cmd.command,cmd.payload);if(!body)throw new Error('Unsupported command');await publish(cmd.printer_id,body);}await db.from('printer_commands').update({status:'done',completed_at:new Date().toISOString()}).eq('id',cmd.id);}catch(e){console.error('Command:',e.message);await db.from('printer_commands').update({status:'failed',error:e.message,completed_at:new Date().toISOString()}).eq('id',cmd.id);}}}
function pairingPage(){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Filaments Bridge</title><style>body{margin:0;background:#080d18;color:#eef4ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial;display:grid;place-items:center;min-height:100vh;padding:20px}.card{width:min(520px,100%);background:#111a2b;border:1px solid #26354d;border-radius:20px;padding:24px;box-sizing:border-box}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#fbbf24;margin-left:8px}.ok{background:#22c55e}.bad{background:#f87171}.muted{color:#91a2bb;font-size:13px}.btn{display:inline-block;margin-top:16px;padding:11px 16px;border-radius:12px;background:#60a5fa;color:#07111e;text-decoration:none;font-weight:800}</style></head><body><div class="card"><h1>Filaments Bridge</h1><p id="state"><span class="dot"></span>جاري ربط الطابعة...</p><p class="muted" id="detail">لا تغلق هذه الصفحة.</p><a id="back" class="btn" href="${CLOUD}" style="display:none">الرجوع إلى Filaments Manager</a></div><script>(async()=>{const state=document.getElementById('state'),detail=document.getElementById('detail'),back=document.getElementById('back');try{if(!location.hash)throw new Error('بيانات الربط غير موجودة');const data=JSON.parse(decodeURIComponent(location.hash.slice(1)));history.replaceState(null,'',location.pathname);const r=await fetch('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Pair failed');state.innerHTML='<span class="dot ok"></span>تم ربط الطابعة بنجاح';detail.textContent='تم تشغيل الاتصال والتحكم والكاميرا المحلية.';back.style.display='inline-block';setTimeout(()=>location.href='${CLOUD}',1800);}catch(e){state.innerHTML='<span class="dot bad"></span>فشل الربط';detail.textContent=e.message||String(e);back.style.display='inline-block';}})();</script></body></html>`}
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/health'&&req.method==='GET')return json(res,200,{ok:true,printers:[...clients.entries()].map(([id,c])=>({id,connected:c.connected}))});if(url.pathname==='/pair-setup'&&req.method==='GET')return html(res,200,pairingPage());if(url.pathname==='/pair'&&req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;try{await pair(JSON.parse(raw||'{}'));return json(res,200,{ok:true});}catch(e){return json(res,400,{error:e.message});}}return json(res,404,{error:'Not found'});});
server.listen(PORT,'127.0.0.1',()=>console.log(`Filaments Bridge listening on http://127.0.0.1:${PORT}`));await ensureSession();await loadPrinters();await recoverCommands();setInterval(loadPrinters,15000);setInterval(pollCommands,1000);setInterval(recoverCommands,30000);setInterval(()=>{for(const [id,c] of clients)if(c.connected)markSeen(id);},10000);setInterval(()=>{for(const [id,c] of clients)if(c.connected){const p=config.printers[id];if(p)c.publish(`device/${p.serial_number}/request`,JSON.stringify({pushing:{sequence_id:seq(),command:'pushall',version:1,push_target:1}}),{qos:1});}},300000);
