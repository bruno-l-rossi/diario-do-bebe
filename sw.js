/* Diário do Bebê — service worker
   Faz 3 coisas:
   1) cache do app pra instalar e funcionar offline
   2) notificação fixa com botões de registro
   3) grava no Supabase (REST) quando você toca num botão, mesmo com o app fechado */

const SB_URL='https://xvydkvqfcgfysrkmzsae.supabase.co';
const SB_KEY='sb_publishable_Iylj-64xnspCSFg-u34jmw_sdWa2TU-';

const CACHE='diario-v2';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const NOTIF_TAG='diario-fixo';

/* ---------- ciclo de vida + cache ---------- */
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()).catch(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const ks=await caches.keys();
    await Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.hostname.endsWith('supabase.co'))return; // API sempre na rede
  if(url.origin===location.origin){
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));return r;})
      .catch(()=>caches.match(req).then(m=>m||caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));return r;})));
  }
});

/* ---------- IndexedDB (guarda a sessão pro SW poder gravar) ---------- */
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('diario',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function kvGet(k){const db=await idb();return new Promise((res,rej)=>{const t=db.transaction('kv','readonly').objectStore('kv').get(k);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error);});}
async function kvSet(k,v){const db=await idb();return new Promise((res,rej)=>{const s=db.transaction('kv','readwrite').objectStore('kv');const r=s.put(v,k);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
async function kvDel(k){const db=await idb();return new Promise((res)=>{const s=db.transaction('kv','readwrite').objectStore('kv');s.delete(k);s.transaction.oncomplete=()=>res();});}

/* ---------- token Supabase (com refresh quando expira) ---------- */
async function getToken(){
  let s=await kvGet('session');
  if(!s||!s.access_token)return null;
  const now=Math.floor(Date.now()/1000);
  if(s.expires_at && s.expires_at-30<=now){
    try{
      const r=await fetch(SB_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'apikey':SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});
      if(!r.ok)return null;
      const j=await r.json();
      s={access_token:j.access_token,refresh_token:j.refresh_token,expires_at:j.expires_at||(now+(j.expires_in||3600))};
      await kvSet('session',s);
    }catch(e){return null;}
  }
  return s.access_token;
}
async function rest(path,opts){
  const token=await getToken(); if(!token)throw new Error('no-session');
  opts=opts||{};
  const h=Object.assign({'apikey':SB_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'},opts.headers||{});
  return fetch(SB_URL+'/rest/v1/'+path,Object.assign({},opts,{headers:h}));
}
async function activeEvent(type){
  const r=await rest('events?select=*&type=eq.'+type+'&end_ts=is.null&order=ts.desc&limit=1',{method:'GET'});
  const a=await r.json();
  return Array.isArray(a)&&a.length?a[0]:null;
}
function insertEvent(body){return rest('events',{method:'POST',headers:{'Prefer':'return=minimal'},body:JSON.stringify(body)});}
function patchEvent(id,body){return rest('events?id=eq.'+id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify(body)});}
function deleteEvent(id){return rest('events?id=eq.'+id,{method:'DELETE'});}

/* ---------- ações (mesma lógica do app) ---------- */
const STARTED={soneca:'Soneca iniciada 😴',mamada:'Mamada iniciada 🍼',despertar:'Acordou de noite 🌙'};
const ENDED={soneca:'Soneca encerrada 😴',mamada:'Mamada encerrada 🍼',despertar:'Voltou a dormir 🌙'};
async function doAction(action){
  const nowISO=new Date().toISOString();
  if(action==='sono'){
    const a=await activeEvent('sono');
    if(a){
      const d=await activeEvent('despertar');
      if(d && new Date(d.ts).getTime()>=new Date(a.ts).getTime()) await deleteEvent(d.id);
      await patchEvent(a.id,{end_ts:nowISO}); return 'Bom dia! ☀️';
    }
    await insertEvent({type:'sono',ts:nowISO}); return 'Sono noturno iniciado 🛌';
  }
  const a=await activeEvent(action);
  if(a){ await patchEvent(a.id,{end_ts:nowISO}); return ENDED[action]||'Encerrado'; }
  await insertEvent({type:action,ts:nowISO}); return STARTED[action]||'Registrado';
}

/* ---------- notificação fixa ---------- */
function showNotif(body){
  return self.registration.showNotification('Diário do Bebê',{
    tag:NOTIF_TAG,
    body:body||'Toque num botão pra registrar',
    icon:'./icon-192.png',
    badge:'./icon-192.png',
    requireInteraction:true,
    silent:true,
    renotify:false,
    actions:[
      {action:'soneca',title:'😴 Soneca'},
      {action:'mamada',title:'🍼 Mamada'},
      {action:'despertar',title:'🌙 Despertar'},
      {action:'sono',title:'🛌 Sono'},
      {action:'refeicao',title:'🥣 Refeição'}
    ]
  });
}
async function closeNotif(){
  const ns=await self.registration.getNotifications({tag:NOTIF_TAG});
  ns.forEach(n=>n.close());
}

self.addEventListener('notificationclick',ev=>{
  const action=ev.action;
  ev.waitUntil((async()=>{
    // refeição (precisa escolher quantidade/quem serviu) e clique no corpo => abre o app
    if(!action || action==='refeicao'){
      const url=action==='refeicao'?'./?open=refeicao':'./';
      const cls=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      for(const c of cls){ if('focus' in c){ c.postMessage({type:action==='refeicao'?'open-refeicao':'focus'}); try{return c.focus();}catch(e){} } }
      return self.clients.openWindow(url);
    }
    let msg=null;
    try{ msg=await doAction(action); }catch(e){ msg=null; }
    await showNotif(msg?('✓ '+msg):'Não consegui gravar. Abra o app pra entrar de novo.');
    const cls=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    cls.forEach(c=>c.postMessage({type:'reload'}));
  })());
});

/* ---------- mensagens do app ---------- */
self.addEventListener('message',ev=>{
  const d=ev.data||{};
  if(d.type==='session'){ ev.waitUntil(kvSet('session',d.session)); }
  else if(d.type==='show-notif'){ ev.waitUntil(showNotif(d.body)); }
  else if(d.type==='hide-notif'){ ev.waitUntil(closeNotif()); }
  else if(d.type==='logout'){ ev.waitUntil((async()=>{ await kvDel('session'); await closeNotif(); })()); }
});
