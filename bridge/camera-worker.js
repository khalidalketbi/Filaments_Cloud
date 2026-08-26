import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://fljoowkjmvqijqiaimpp.supabase.co';
const SUPABASE_KEY='sb_publishable_YdE-PNM_SrerYvKjBn68BQ_8YCpuKR9';
const CONFIG_FILE=path.join(os.homedir(),'.filaments-bridge','config.json');
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:true}});
const cameras=new Map();
let config={session:null,printers:{}};

function reloadConfig(){
  try{config=JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8'));}catch{}
}
async function ensureSession(){
  reloadConfig();
  if(!config.session?.access_token||!config.session?.refresh_token)return false;
  const {data,error}=await db.auth.setSession(config.session);
  return !error&&!!data.session;
}
async function uploadFrame(printerId,jpeg){
  try{
    const {data:{user}}=await db.auth.getUser();if(!user)return;
    const storagePath=`${user.id}/camera/${printerId}.jpg`;
    const {error}=await db.storage.from('print-files').upload(storagePath,jpeg,{contentType:'image/jpeg',upsert:true,cacheControl:'0'});
    if(error)throw error;
    await db.from('printers').update({camera_path:storagePath}).eq('id',printerId);
  }catch(e){console.error('Camera upload:',e.message||e);}
}
function stop(id){const s=cameras.get(id);if(s){try{s.destroy();}catch{}cameras.delete(id);}}
function start(p){
  if(cameras.has(p.id))return;
  const secret=config.printers?.[p.id];
  if(!secret?.access_code||!p.lan_ip)return;
  if(!/^(a1|p1)/i.test(String(p.model||'')))return;
  let buffer=Buffer.alloc(0),lastUpload=0;
  const socket=tls.connect({host:p.lan_ip,port:6000,rejectUnauthorized:false,servername:p.lan_ip},()=>{
    console.log(`Camera connected: ${p.name} (${p.model})`);
    const auth=Buffer.alloc(80);
    auth.writeUInt32LE(0x40,0);
    auth.writeUInt32LE(0x3000,4);
    auth.writeUInt32LE(0,8);
    auth.writeUInt32LE(0,12);
    auth.write('bblp',16,'ascii');
    auth.write(String(secret.access_code),48,'ascii');
    socket.write(auth);
  });
  cameras.set(p.id,socket);
  socket.on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    while(buffer.length>=16){
      const size=buffer.readUInt32LE(0);
      if(size<=0||size>20_000_000){buffer=buffer.subarray(1);continue;}
      if(buffer.length<16+size)break;
      const jpg=buffer.subarray(16,16+size);
      buffer=buffer.subarray(16+size);
      if(jpg.length>4&&jpg[0]===0xff&&jpg[1]===0xd8&&jpg[jpg.length-2]===0xff&&jpg[jpg.length-1]===0xd9){
        const now=Date.now();
        if(now-lastUpload>=1500){lastUpload=now;uploadFrame(p.id,Buffer.from(jpg));}
      }
    }
  });
  const retry=()=>{if(cameras.get(p.id)===socket)cameras.delete(p.id);setTimeout(()=>sync().catch(()=>{}),4000);};
  socket.on('error',e=>console.error(`Camera ${p.name}:`,e.message));
  socket.on('close',retry);
}
async function sync(){
  if(!(await ensureSession()))return;
  const {data,error}=await db.from('printers').select('id,name,model,lan_ip,remote_enabled').eq('connection_type','bambu_lan').eq('remote_enabled',true);
  if(error)return console.error('Camera list:',error.message);
  const active=new Set();
  for(const p of data||[]){
    if(/^(a1|p1)/i.test(String(p.model||''))&&config.printers?.[p.id]?.access_code){active.add(p.id);start(p);}
  }
  for(const id of cameras.keys())if(!active.has(id))stop(id);
}

await sync();
setInterval(()=>sync().catch(e=>console.error('Camera sync:',e.message||e)),10000);
