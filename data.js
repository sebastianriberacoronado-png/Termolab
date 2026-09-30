import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const configured = Boolean(url && key && !url.includes('TU-PROYECTO') && !key.includes('REEMPLAZAR'));
export const supabase = configured ? createClient(url, key) : null;

async function allRows(table, order = 'id') {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(order).range(start, start + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
const equipmentFromDb = e => ({id:e.id,code:e.code,name:e.name,location:e.location,min:Number(e.min_temperature),max:Number(e.max_temperature)});
const readingFromDb = (r, resolutions) => ({id:r.id,equipmentId:r.equipment_id,temperature:Number(r.temperature),min:Number(r.min_temperature),max:Number(r.max_temperature),measuredAt:r.measured_at,createdAt:r.created_at,responsible:r.responsible,notes:r.notes,resolution:resolutions.get(r.id)});
export async function loadData() {
  const [equipment, readings, closures] = await Promise.all([allRows('equipment'),allRows('readings'),allRows('incident_resolutions')]);
  const resolutions = new Map(closures.map(r => [r.reading_id,{action:r.action,responsible:r.responsible,closedAt:r.closed_at}]));
  return {equipment:equipment.map(equipmentFromDb),readings:readings.map(r=>readingFromDb(r,resolutions))};
}
export async function insertEquipment(e) {
  const { data, error } = await supabase.from('equipment').insert({id:e.id,code:e.code,name:e.name,location:e.location,min_temperature:e.min,max_temperature:e.max}).select().single();
  if (error) throw error;
  return equipmentFromDb(data);
}
export async function insertReading(r) {
  const { data, error } = await supabase.from('readings').insert({id:r.id,equipment_id:r.equipmentId,temperature:r.temperature,measured_at:r.measuredAt,responsible:r.responsible,notes:r.notes}).select().single();
  if (error) throw error;
  return readingFromDb(data,new Map());
}
export async function insertResolution(readingId, resolution) {
  const { data, error } = await supabase.from('incident_resolutions').insert({reading_id:readingId,action:resolution.action,responsible:resolution.responsible}).select().single();
  if (error) throw error;
  return {action:data.action,responsible:data.responsible,closedAt:data.closed_at};
}
