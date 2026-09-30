import test from 'node:test';
import assert from 'node:assert/strict';
import { reportData, reportChart } from '../reports.js';

const base={equipmentId:'rf-1',min:2,max:8,responsible:'Operador',notes:'',createdAt:'2026-09-30T18:00:00Z'};
const rows=[
  {...base,id:'last',measuredAt:'2026-09-29T23:59:59.999',temperature:9},
  {...base,id:'before',measuredAt:'2026-09-27T23:59:59.999',temperature:-10},
  {...base,id:'first',measuredAt:'2026-09-28T00:00:00',temperature:2},
  {...base,id:'after',measuredAt:'2026-09-30T00:00:00',temperature:30},
  {...base,id:'middle',measuredAt:'2026-09-28T12:00:00',temperature:4},
  {...base,id:'other',equipmentId:'rf-2',measuredAt:'2026-09-28T12:00:00',temperature:100}
];
const filters={equipmentId:'rf-1',from:'2026-09-28',to:'2026-09-29'};
test('informe incluye días completos, ordena por medición y excluye otros equipos',()=>{
  const data=reportData(rows,filters);
  assert.deepEqual(data.rows.map(r=>r.id),['first','middle','last']);
  assert.equal(data.count,3);assert.equal(data.min,2);assert.equal(data.max,9);assert.equal(data.average,5);assert.equal(data.alerts,1);
  const svg=reportChart(data.rows,{...filters,equipmentName:'Equipo'});
  assert.equal((svg.match(/data-report-point=/g)||[]).length,data.count);
  assert.match(svg,/class="chart-series"/);
  assert.equal((svg.match(/class="chart-limit/g)||[]).length,2);
  assert.doesNotMatch(svg,/NaN|Infinity/);
});
test('informe vacío o de una sola lectura no inventa valores',()=>{
  const empty=reportData([],filters);assert.equal(empty.min,null);assert.equal(empty.average,null);assert.equal(reportChart([],filters),'');
  const data=reportData([rows[0]],filters);
  const svg=reportChart(data.rows,{...filters,equipmentName:'<script>alert(1)</script>'});
  assert.equal((svg.match(/data-report-point=/g)||[]).length,1);
  assert.doesNotMatch(svg,/class="chart-series"|<script>|NaN|Infinity/);
  assert.match(svg,/&lt;script&gt;/);
});
test('fechas inválidas, ausentes o invertidas no generan informes engañosos',()=>{
  for(const invalid of [{...filters,from:'2026-02-30'},{...filters,to:''},{...filters,from:'2026-10-01'},{...filters,equipmentId:''}])assert.throws(()=>reportData(rows,invalid));
});
test('mediciones con valores iguales, negativos o mismo instante conservan todos los puntos',()=>{
  const data=reportData([1,2].map(id=>({...base,id,temperature:-20,min:-25,max:-15,measuredAt:'2026-09-28T12:00:00'})),{...filters,to:filters.from});
  assert.equal(data.count,2);assert.equal(data.average,-20);
  const svg=reportChart(data.rows,{...filters,to:filters.from,equipmentName:'Congelador'});
  assert.doesNotMatch(svg,/NaN|Infinity/);assert.equal((svg.match(/data-report-point=/g)||[]).length,2);
});
