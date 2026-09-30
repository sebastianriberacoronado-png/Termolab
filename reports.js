import { filterReadings, localDay, outside, status, csvCell } from './domain.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decimal = value => Number(value).toLocaleString('es-CL', {minimumFractionDigits:1, maximumFractionDigits:2});
const measurementDate = value => new Date(value).toLocaleString('es-CL', {dateStyle:'short', timeStyle:'short'});

export function reportData(readings, {equipmentId, from, to}) {
  const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(new Date(`${value}T00:00:00`).getTime()) && localDay(`${value}T00:00:00`) === value;
  if (!equipmentId) throw Error('Selecciona un refrigerador.');
  if (!validDay(from) || !validDay(to)) throw Error('Selecciona una fecha inicial y una fecha final válidas.');
  if (from > to) throw Error('La fecha inicial no puede ser posterior a la fecha final.');
  const rows = filterReadings(readings, {equipmentId, from, to}).sort((a,b) => new Date(a.measuredAt) - new Date(b.measuredAt) || new Date(a.createdAt) - new Date(b.createdAt));
  const stats = rows.reduce((s,r) => ({min:Math.min(s.min,r.temperature), max:Math.max(s.max,r.temperature), sum:s.sum+r.temperature, alerts:s.alerts+Number(outside(r))}), {min:Infinity,max:-Infinity,sum:0,alerts:0});
  return {rows, count:rows.length, min:rows.length?stats.min:null, max:rows.length?stats.max:null, average:rows.length?stats.sum/rows.length:null, alerts:stats.alerts};
}

export function reportChart(rows, {from,to,equipmentName}) {
  if (!rows.length) return '';
  const width=960, height=340, left=65, right=25, top=30, bottom=65;
  const start=new Date(`${from}T00:00:00`).getTime();
  const endDate=new Date(`${to}T00:00:00`); endDate.setDate(endDate.getDate()+1);
  const end=endDate.getTime()-1;
  const values=rows.reduce((range,r)=>({min:Math.min(range.min,r.temperature,r.min),max:Math.max(range.max,r.temperature,r.max)}),{min:Infinity,max:-Infinity});
  const padding=Math.max((values.max-values.min)*0.15,1);
  const low=values.min-padding, high=values.max+padding;
  const x=value=>left+(new Date(value).getTime()-start)/(end-start)*(width-left-right);
  const y=value=>top+(high-value)/(high-low)*(height-top-bottom);
  const coordinate=value=>Number(value.toFixed(2));
  const points=field=>rows.map(r=>`${coordinate(x(r.measuredAt))},${coordinate(y(r[field]))}`).join(' ');
  const yTicks=Array.from({length:6},(_,i)=>{
    const value=low+(high-low)*i/5, py=coordinate(y(value));
    return `<line x1="${left}" y1="${py}" x2="${width-right}" y2="${py}" class="chart-grid"/><text x="${left-12}" y="${py+4}" text-anchor="end">${decimal(value)}</text>`;
  }).join('');
  const xTicks=Array.from({length:5},(_,i)=>{
    const time=start+(end-start)*i/4, px=coordinate(x(time));
    const label=new Date(time).toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit'});
    const hour=new Date(time).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
    return `<text x="${px}" y="${height-bottom+23}" text-anchor="${i===0?'start':i===4?'end':'middle'}">${escapeHtml(label)}<tspan x="${px}" dy="15">${escapeHtml(hour)}</tspan></text>`;
  }).join('');
  const limitLine=(field,kind)=>rows.every(r=>r[field]===rows[0][field])
    ? `<line x1="${left}" x2="${width-right}" y1="${coordinate(y(rows[0][field]))}" y2="${coordinate(y(rows[0][field]))}" class="chart-limit ${kind}"/>`
    : `<polyline points="${points(field)}" class="chart-limit ${kind}"/>`;
  return `<svg viewBox="0 0 ${width} ${height}" class="temperature-chart" role="group" aria-labelledby="report-chart-title report-chart-description"><title id="report-chart-title">Temperaturas de ${escapeHtml(equipmentName)}</title><desc id="report-chart-description">${rows.length} lecturas en orden cronológico. Eje horizontal: fecha y hora; eje vertical: temperatura en grados Celsius. Los mismos valores están en la tabla inferior.</desc>${yTicks}${xTicks}<text x="${left}" y="16">Temperatura (°C)</text><text x="${width/2}" y="${height-4}" text-anchor="middle">Fecha y hora de medición</text>${limitLine('min','lower')}${limitLine('max','upper')}${rows.length>1?`<polyline points="${points('temperature')}" class="chart-series"/>`:''}${rows.map((r,i)=>`<circle cx="${coordinate(x(r.measuredAt))}" cy="${coordinate(y(r.temperature))}" r="5" class="chart-point ${outside(r)?'out-of-range':''}" data-report-point="${i}" tabindex="0" role="button" aria-label="${escapeHtml(`${measurementDate(r.measuredAt)}: ${decimal(r.temperature)} °C. ${status(r)}. ${r.responsible}`)}"><title>${escapeHtml(`${measurementDate(r.measuredAt)} · ${decimal(r.temperature)} °C · ${r.responsible}`)}</title></circle>`).join('')}</svg>`;
}

export function createReports({getState,isReady,getMode}) {
  const $=id=>document.getElementById(id);
  let current=null;
  const today=new Date(), initial=new Date(today); initial.setDate(initial.getDate()-6);
  $('report-from').value=localDay(initial);
  $('report-to').value=localDay(today);
  function clear(message) {
    current=null;
    $('report-results').hidden=true;
    $('report-chart').innerHTML='';
    $('report-values').innerHTML='';
    $('report-summary').innerHTML='';
    $('report-detail').textContent='';
    $('report-status').textContent=message;
    $('report-export').disabled=true;
  }
  function render() {
    $('report-error').textContent='';
    if (!isReady()) {clear('Inicia sesión o abre la demostración para consultar informes.');return;}
    const {equipment,readings}=getState();
    const filters={equipmentId:$('report-equipment').value,from:$('report-from').value,to:$('report-to').value};
    const selected=equipment.find(e=>e.id===filters.equipmentId);
    try {
      const data=reportData(readings,filters);
      if(!selected)throw Error('Selecciona un refrigerador disponible.');
      if(!data.count){clear('No hay mediciones de este refrigerador en el período seleccionado.');return;}
      current={...data,...filters,equipment:selected};
      $('report-results').hidden=false;
      $('report-status').textContent=`${getMode()==='demo'?'DEMOSTRACIÓN · ':''}${selected.code} · ${selected.name} · ${filters.from} al ${filters.to} · ${data.count} lecturas. Ambos días incluidos.`;
      $('report-summary').innerHTML=[['Lecturas',data.count],['Mínima',`${decimal(data.min)} °C`],['Máxima',`${decimal(data.max)} °C`],['Promedio',`${decimal(data.average)} °C`],['Fuera de rango',data.alerts]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
      $('report-chart').innerHTML=reportChart(data.rows,{...filters,equipmentName:`${selected.code} · ${selected.name}`});
      $('report-detail').textContent='Selecciona un punto para consultar la medición.';
      $('report-values').innerHTML=data.rows.map((r,i)=>`<tr data-report-row="${i}"><td>${i+1}</td><td>${escapeHtml(measurementDate(r.measuredAt))}</td><td><b>${decimal(r.temperature)} °C</b></td><td>${decimal(r.min)} a ${decimal(r.max)} °C</td><td><span class="tag ${outside(r)?'alert':'ok'}">${status(r)}</span></td><td>${escapeHtml(r.responsible)}</td><td>${escapeHtml(r.notes)||'—'}</td></tr>`).join('');
      $('report-export').disabled=false;
    }catch(error){clear('Ajusta los filtros para consultar el informe.');$('report-error').textContent=error.message;}
  }
  function sync() {
    const select=$('report-equipment'),previous=select.value;
    select.innerHTML='<option value="">Selecciona un refrigerador</option>'+getState().equipment.map(e=>`<option value="${escapeHtml(e.id)}">${escapeHtml(e.code)} · ${escapeHtml(e.name)}</option>`).join('');
    select.value=getState().equipment.some(e=>e.id===previous)?previous:getState().equipment[0]?.id||'';
    $('report-consult').disabled=!isReady()||!getState().equipment.length;
    render();
  }
  $('report-form').addEventListener('submit',event=>{event.preventDefault();render();});
  for(const id of ['report-equipment','report-from','report-to'])$(id).addEventListener('change',render);
  function selectPoint(event) {
    const point=event.target.closest('[data-report-point]');
    if(!point||!current)return;
    const index=Number(point.dataset.reportPoint),r=current.rows[index];
    $('report-detail').textContent=`${measurementDate(r.measuredAt)} · ${decimal(r.temperature)} °C · ${status(r)} · Responsable: ${r.responsible}${r.notes?` · ${r.notes}`:''}`;
    $('report-values').querySelectorAll('tr').forEach(row=>row.classList.toggle('selected-report-row',Number(row.dataset.reportRow)===index));
  }
  $('report-chart').addEventListener('click',selectPoint);
  $('report-chart').addEventListener('focusin',selectPoint);
  $('report-chart').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectPoint(event);}});
  $('report-export').addEventListener('click',()=>{
    if(!current)return;
    const rows=[['Equipo','Fecha y hora local','Medición UTC','Temperatura °C','Mínimo °C','Máximo °C','Estado','Responsable','Observaciones'],...current.rows.map(r=>[current.equipment.code,measurementDate(r.measuredAt),new Date(r.measuredAt).toISOString(),r.temperature,r.min,r.max,status(r),r.responsible,r.notes])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`informe-${getMode()}-${current.equipment.code.replace(/[^a-z0-9_-]/gi,'_')}-${current.from}-${current.to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  return {sync};
}
