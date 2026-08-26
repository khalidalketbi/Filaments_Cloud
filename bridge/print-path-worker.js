import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';

const CLOUD='https://filaments-cloud.vercel.app';
const FILE=path.join(os.homedir(),'.filaments-bridge','config.json');
let db=null;
const clients=new Map();

function readConfig(){try{return JSON.parse(fs.readFileSync(FILE,'utf8'));}catch{return{};}}
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
  if(error){console.error('Print path session:',error.message);return false;}
  return !!data.session;
}
async function connectAll(){
  try{
    if(!(await ensureSession()))return;
    const d=await getDb(),cfg=readConfig();
    const {data,error}=await d.from('printers').select('id,name,lan_ip,serial_number,connection_type,remote_enabled').eq('connection_type','bambu_lan').eq('remote_enabled',true);
    if(error)return console.error('Print path query:',error.message);
    for(const p of data||[]){
      if(clients.has(p.id))continue;
      const secret=cfg.printers?.[p.id];
      if(!secret?.access_code)continue;
      const c=mqtt.connect(`mqtts://${p.lan_ip}:8883`,{username:'bblp',password:secret.access_code,rejectUnauthorized:false,reconnectPeriod:5000,connectTimeout:8000,clean:true});
      clients.set(p.id,c);
      c.on('connect',()=>{
        c.subscribe(`device/${p.serial_number}/report`,{qos:1});
        c.publish(`device/${p.serial_number}/request`,JSON.stringify({pushing:{sequence_id:String(Date.now()),command:'pushall',version:1,push_target:1}}),{qos:1});
      });
      c.on('message',async(_,buf)=>{
        try{
          const msg=JSON.parse(buf.toString());
          const pr=msg.print||{};
          const gcodeFile=pr.gcode_file||pr.gcode_file_prepare||null;
          if(gcodeFile){
            await d.from('printers').update({gcode_file_path:String(gcodeFile)}).eq('id',p.id);
          }
        }catch{}
      });
      c.on('error',()=>{});
      c.on('close',()=>{});
    }
  }catch(e){console.error('Print path worker:',e.message||e);}
}

console.log('Print path worker started');
setInterval(connectAll,15000);
setTimeout(connectAll,1200);
