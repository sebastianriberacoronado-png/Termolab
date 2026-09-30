import { outside, status, latest, localDay, filterReadings, csvCell, validateEquipment, validateReading } from './domain.js';
import { configured, supabase, loadData, insertEquipment, insertReading, insertResolution } from './data.js';
import { equipmentOrdering } from './equipment-order.js';
import { createReports } from './reports.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'});
const number = value => Number(value).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:2});
const nowLocal = () => {const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
let state = {equipment:[],readings:[]};
let mode = 'setup';
let session = null;
let ready = false;
let busy = false;
let lastSynced = null;
let toastTimer;
let generation = 0;
const cardOrdering = equipmentOrdering($('equipment'), {
  getScope: () => mode === 'demo' ? 'demo' : `operator:${session?.user.id || 'guest'}`,
  announce: message => notify(message)
});
const reports = createReports({getState:()=>state,isReady:()=>ready,getMode:()=>mode});

function notify(message,error=false) { clearTimeout(toastTimer);$('message').textContent=message;$('message').classList.toggle('error',error);toastTimer=setTimeout(()=>$('message').textContent='',8000); }
function errorMessage(error) {
  if(error.code==='23505') return 'Ese registro ya existe. Actualiza los datos antes de volver a intentarlo.';
  if(error.code==='42501') return 'Tu usuario no tiene acceso. Revisa su membresía en lab_members.';
  if(error.message?.includes('Failed to fetch')) return 'No se pudo conectar. Revisa Internet y vuelve a intentarlo; no se confirmó el guardado.';
  return error.message || 'No se pudo completar la operación.';
}
function canWrite() {return ready && !busy && (mode==='demo' || Boolean(session));}
function filtered() {return filterReadings(state.readings,{equipmentId:$('filter-equipment').value,from:$('filter-from').value,to:$('filter-to').value,onlyOpen:$('filter-open').checked});}
function renderHistory() {
  const rows=filtered();
  $('history-count').textContent=`${rows.length} ${rows.length===1?'lectura':'lecturas'}`;
  $('history').innerHTML=rows.map(r=>{const e=state.equipment.find(e=>e.id===r.equipmentId);return `<tr><td>${esc(date(r.measuredAt))}<small>Ingreso: ${esc(date(r.createdAt))}</small></td><td>${esc(e?.code)}<small>${esc(e?.name)}</small></td><td><b>${number(r.temperature)} °C</b></td><td>${number(r.min)} a ${number(r.max)}</td><td><span class="tag ${outside(r)?'alert':'ok'}">${status(r)}</span></td><td>${esc(r.responsible)}</td><td>${r.notes?`<small>${esc(r.notes)}</small>`:''}${outside(r)?r.resolution?`<span class="tag">Cerrada</span><small>${esc(r.resolution.action)}</small><small>${esc(r.resolution.responsible)} · ${esc(date(r.resolution.closedAt))}</small>`:`<button class="secondary" data-close="${esc(r.id)}" ${canWrite()?'':'disabled'}>Registrar acción</button>`:'—'}</td></tr>`;}).join('')||'<tr><td colspan="7" class="empty">No hay mediciones para estos filtros.</td></tr>';
}
function render() {
  const last=state.equipment.map(e=>latest(state.readings,e.id));
  const within=last.filter(r=>r&&!outside(r)).length;
  const open=state.readings.filter(r=>outside(r)&&!r.resolution).length;
  const today=state.readings.filter(r=>localDay(r.measuredAt)===localDay(new Date())).length;
  $('summary').innerHTML=[['Equipos registrados',state.equipment.length,`${last.filter(r=>!r).length} sin mediciones`,'▤'],['Dentro del rango',within,'Según última lectura','✓'],['Incidencias pendientes',open,'Lecturas por revisar','⚑'],['Lecturas de hoy',today,'Registradas para hoy','◷']].map(([label,value,note,icon])=>`<article class="stat"><span class="stat-label">${label}</span><span class="stat-icon">${icon}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
  $('incident-count').textContent=open;
  $('equipment').innerHTML=state.equipment.map(e=>{const r=latest(state.readings,e.id);const position=r?Math.min(97,Math.max(3,(r.temperature-e.min)/(e.max-e.min)*100)):50;return `<article class="equipment-card ${outside(r)?'has-alert':''}"><div class="card-top"><div class="fridge-icon" aria-hidden="true"></div><span class="tag ${r?outside(r)?'alert':'ok':''}">${status(r)}</span></div><h3>${esc(e.name)}</h3><p>${esc(e.location)}</p><div class="equipment-code">${esc(e.code)}</div><div class="temperature">${r?number(r.temperature):'—'}<span>°C</span></div><div class="range">Rango permitido: ${number(e.min)} a ${number(e.max)} °C</div>${r?`<div class="range-bar" style="--position:${position}%"></div>`:''}<div class="card-bottom"><p>${r?esc(date(r.measuredAt)):'Sin mediciones todavía'}</p><button class="secondary" data-reading="${esc(e.id)}" ${canWrite()?'':'disabled'}>＋ Lectura</button></div></article>`;}).join('')||`<div class="empty"><strong>${ready?'Tu inventario comienza aquí':'Tu laboratorio, en un solo lugar'}</strong>${ready?'Agrega el primer refrigerador y define su rango permitido.':'Conecta Supabase o explora la demostración para ver la interfaz en acción.'}</div>`;
  for(const id of ['reading-equipment','filter-equipment']) {const selected=$(id).value;$(id).innerHTML=`<option value="">${id==='filter-equipment'?'Todos los equipos':'Selecciona un refrigerador'}</option>`+state.equipment.map(e=>`<option value="${esc(e.id)}">${esc(e.code)} · ${esc(e.name)}</option>`).join('');$(id).value=selected;}
  $('new-reading').disabled=!canWrite()||!state.equipment.length;
  $('new-equipment').disabled=!canWrite();
  $('refresh').disabled=busy||mode!=='cloud'||!session;
  $('backup').disabled=!ready||busy;
  $('export').disabled=!ready||busy;
  $('demo').hidden=Boolean(session);
  $('demo').disabled=busy;
  $('demo').textContent=mode==='demo'?'Salir de la demostración':'Explorar demostración';
  $('login-form').hidden=Boolean(session);
  $('session-panel').hidden=!session;
  $('session-email').textContent=session?.user.email||'';
  $('login-button').disabled=!configured||busy;
  $('logout').disabled=busy;
  $('login-hint').textContent=configured?'Usa un usuario habilitado en el laboratorio.':'Disponible al configurar .env.local.';
  $('connection-description').textContent=configured?'Proyecto configurado. Inicia sesión para consultar y guardar los registros en Supabase.':'Conexión pendiente: agrega la URL y la clave pública del proyecto en .env.local. Puedes explorar la demostración mientras tanto.';
  $('connection-badge').textContent=mode==='demo'?'Demostración':session?(ready?'Supabase conectado':'Conexión pendiente'):configured?'Supabase · iniciar sesión':'Supabase pendiente';
  $('connection-badge').className=`tag ${mode==='demo'?'alert':ready?'ok':''}`;
  $('mode-notice').classList.toggle('demo-notice',mode==='demo');
  $('mode-notice').textContent=mode==='demo'?'DEMOSTRACIÓN · Equipos y lecturas ficticios para probar la interfaz. Los cambios se pierden al recargar y no se envían a Supabase.':session?(ready?`Datos guardados en Supabase · Última actualización: ${date(lastSynced)}. Usa Actualizar para ver cambios de otros usuarios.`:'No se han cargado los datos. Pulsa Actualizar para reintentar la conexión.'):'Inicia sesión para guardar en Supabase. La demostración permite probar la interfaz sin guardar datos reales.';
  cardOrdering.decorate(state.equipment, canWrite());
  renderHistory();
  reports.sync();
}
function demoData() {
  const equipment=[{id:'demo-1',code:'RF-01',name:'Refrigerador de reactivos',location:'Área de bioquímica',min:2,max:8},{id:'demo-2',code:'RF-02',name:'Refrigerador de muestras',location:'Área de recepción',min:2,max:8},{id:'demo-3',code:'RF-03',name:'Refrigerador de respaldo',location:'Sala de almacenamiento',min:2,max:8}];
  const readings=[4.2,8.7,5.1].map((temperature,i)=>({id:`demo-reading-${i}`,equipmentId:equipment[i].id,temperature,min:2,max:8,measuredAt:new Date(Date.now()-(i+1)*600000).toISOString(),createdAt:new Date().toISOString(),responsible:'Usuario de demostración',notes:i===1?'Ejemplo de una lectura fuera del rango.':''}));
  return {equipment,readings};
}
async function refresh() {
  if(!session||busy) return;
  busy=true;render();
  const ticket=generation;
  try {
    const {data:member,error}=await supabase.from('lab_members').select('display_name').eq('user_id',session.user.id).maybeSingle();
    if(error) throw error;
    if(!member) throw Error('Tu cuenta aún no está habilitada en lab_members. Agrega la membresía desde Supabase.');
    const next=await loadData();
    if(ticket!==generation) return;
    state=next;ready=true;lastSynced=new Date();
  } catch(error) {if(ticket===generation){ready=false;state={equipment:[],readings:[]};notify(errorMessage(error),true);}} finally {busy=false;render();}
}
function showReading(id='') {if(!canWrite())return;$('reading-error').textContent='';$('reading-form').reset();$('reading-equipment').value=id;$('reading-form').elements.measuredAt.value=nowLocal();$('reading-dialog').showModal();}
$('new-reading').addEventListener('click',()=>showReading());
$('new-equipment').addEventListener('click',()=>{if(canWrite()){$('equipment-error').textContent='';$('equipment-dialog').showModal();}});
$('equipment').addEventListener('click',event=>{const button=event.target.closest('[data-reading]');if(button)showReading(button.dataset.reading);});
document.querySelectorAll('[data-dismiss]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();}));
async function submit(form,errorId,operation) {
  if(!canWrite())return;
  busy=true;$(errorId).textContent='';
  const controls=[...form.closest('dialog').querySelectorAll('button')];controls.forEach(b=>b.disabled=true);
  render();
  try{await operation();form.reset();form.closest('dialog').close();}catch(error){$(errorId).textContent=errorMessage(error);}finally{busy=false;controls.forEach(b=>b.disabled=false);render();}
}
$('equipment-form').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.target);submit(event.target,'equipment-error',async()=>{
  const e={id:crypto.randomUUID(),code:f.get('code').trim(),name:f.get('name').trim(),location:f.get('location').trim(),min:Number(f.get('min')),max:Number(f.get('max'))};validateEquipment(e);
  if(state.equipment.some(item=>item.code.toLowerCase()===e.code.toLowerCase()))throw Error('Ya existe ese identificador de equipo.');
  const saved=mode==='demo'?e:await insertEquipment(e);state.equipment.push(saved);notify(mode==='demo'?'Equipo agregado a la demostración.':'Refrigerador guardado en Supabase.');
});});
$('reading-form').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.target);submit(event.target,'reading-error',async()=>{
  const e=state.equipment.find(e=>e.id===$('reading-equipment').value);if(!e)throw Error('Selecciona un refrigerador.');
  const r={id:crypto.randomUUID(),equipmentId:e.id,temperature:Number(f.get('temperature')),measuredAt:f.get('measuredAt'),responsible:f.get('responsible').trim(),notes:f.get('notes').trim(),min:e.min,max:e.max,createdAt:new Date().toISOString()};validateReading(r);r.measuredAt=new Date(r.measuredAt).toISOString();
  const saved=mode==='demo'?r:await insertReading(r);state.readings.push(saved);notify(`${mode==='demo'?'Lectura de prueba registrada':'Lectura guardada en Supabase'}${outside(saved)?' · Fuera de rango. Requiere seguimiento.':'.'}`);
});});
$('history').addEventListener('click',event=>{const button=event.target.closest('[data-close]');if(!button||!canWrite())return;$('resolution-form').reset();$('resolution-form').elements.readingId.value=button.dataset.close;$('resolution-error').textContent='';$('resolution-dialog').showModal();});
$('resolution-form').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.target);submit(event.target,'resolution-error',async()=>{
  const r=state.readings.find(r=>r.id===f.get('readingId'));if(!r||r.resolution)throw Error('La incidencia ya no está disponible.');
  const resolution={action:f.get('action').trim(),responsible:f.get('responsible').trim(),closedAt:new Date().toISOString()};if(!resolution.action||!resolution.responsible)throw Error('Completa la acción y el responsable.');
  r.resolution=mode==='demo'?resolution:await insertResolution(r.id,resolution);notify(mode==='demo'?'Incidencia de prueba cerrada.':'Acción y cierre guardados en Supabase.');
});});
for(const id of ['filter-equipment','filter-from','filter-to','filter-open'])$(id).addEventListener('change',renderHistory);
$('show-incidents').addEventListener('click',()=>{$('filter-open').checked=true;$('filter-equipment').value='';$('filter-from').value='';$('filter-to').value='';renderHistory();$('history-section').scrollIntoView({behavior:'smooth'});});
$('refresh').addEventListener('click',refresh);
$('demo').addEventListener('click',()=>{if(session||busy)return;generation++;mode=mode==='demo'?'setup':'demo';state=mode==='demo'?demoData():{equipment:[],readings:[]};ready=mode==='demo';render();});
$('login-form').addEventListener('submit',async event=>{event.preventDefault();if(!supabase||busy)return;busy=true;render();const f=new FormData(event.target);try{const {data,error}=await supabase.auth.signInWithPassword({email:f.get('email').trim(),password:f.get('password')});if(error)throw error;generation++;session=data.session;mode='cloud';state={equipment:[],readings:[]};ready=false;event.target.reset();}catch(error){notify(errorMessage(error),true);}finally{busy=false;render();}if(session)await refresh();});
$('logout').addEventListener('click',async()=>{if(busy)return;busy=true;render();try{const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error;clearSession();}catch(error){notify(errorMessage(error),true);}finally{busy=false;render();}});
function clearSession(){generation++;session=null;state={equipment:[],readings:[]};mode='setup';ready=false;document.querySelectorAll('dialog').forEach(d=>d.close());}
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('backup').addEventListener('click',()=>download(JSON.stringify({format:'termolab-v2',mode,exportedAt:new Date().toISOString(),...state},null,2),'application/json',`termolab-${mode}-${localDay(new Date())}.json`));
$('export').addEventListener('click',()=>{const rows=[['Equipo','Medición (UTC)','Ingreso (UTC)','Temperatura °C','Mínimo °C','Máximo °C','Estado','Responsable','Observaciones','Acción','Responsable cierre','Cierre (UTC)'],...filtered().map(r=>[state.equipment.find(e=>e.id===r.equipmentId)?.code,r.measuredAt,r.createdAt,r.temperature,r.min,r.max,status(r),r.responsible,r.notes,r.resolution?.action,r.resolution?.responsible,r.resolution?.closedAt])];download('\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8',`termolab-${mode}-${localDay(new Date())}.csv`);});
try{const legacy=localStorage.getItem('termolab-v1');if(legacy){$('legacy-backup').hidden=false;$('legacy-backup').addEventListener('click',()=>download(legacy,'application/json','termolab-version-anterior.json'));}}catch{/* No se almacenan lecturas nuevas en el navegador. */}
$('today').textContent=new Date().toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'});
render();
if(supabase){
  supabase.auth.onAuthStateChange((event,next)=>{if(event==='SIGNED_OUT'){clearSession();render();}else if(event==='TOKEN_REFRESHED'){session=next;}});
  try{const {data,error}=await supabase.auth.getSession();if(error)throw error;if(data.session){session=data.session;mode='cloud';await refresh();}}catch(error){notify(errorMessage(error),true);}
}
