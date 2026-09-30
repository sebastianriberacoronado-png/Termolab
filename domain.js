export const outside = r => Boolean(r && (r.temperature < r.min || r.temperature > r.max));
export function status(r) {
  return !r ? 'Sin lecturas' : r.temperature < r.min ? 'Bajo el límite' : r.temperature > r.max ? 'Sobre el límite' : 'Dentro del rango';
}
export function latest(readings, id) {
  return readings.filter(r => r.equipmentId === id).sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt) || new Date(b.createdAt) - new Date(a.createdAt))[0];
}
export function localDay(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function filterReadings(readings, {equipmentId = '', from = '', to = '', onlyOpen = false} = {}) {
  return readings.filter(r => (!equipmentId || r.equipmentId === equipmentId) && (!from || localDay(r.measuredAt) >= from) && (!to || localDay(r.measuredAt) <= to) && (!onlyOpen || (outside(r) && !r.resolution))).sort((a,b) => new Date(b.measuredAt) - new Date(a.measuredAt));
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function validateEquipment(e) {
  if (!e.code?.trim() || !e.name?.trim() || !e.location?.trim()) throw Error('Completa el identificador, nombre y ubicación.');
  if (!Number.isFinite(e.min) || !Number.isFinite(e.max) || e.min >= e.max) throw Error('El límite mínimo debe ser menor que el máximo.');
}
export function validateReading(r) {
  if (!Number.isFinite(r.temperature) || !r.responsible?.trim()) throw Error('Indica una temperatura válida y el responsable.');
  if (!Number.isFinite(new Date(r.measuredAt).getTime()) || new Date(r.measuredAt) > new Date()) throw Error('La fecha de medición debe ser válida y no puede estar en el futuro.');
}
