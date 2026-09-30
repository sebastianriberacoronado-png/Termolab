import test from 'node:test';
import assert from 'node:assert/strict';
import { outside, status, latest, filterReadings, csvCell, validateEquipment, validateReading } from '../domain.js';

test('los límites son inclusivos y la ausencia de lecturas no indica normalidad',()=>{
  assert.equal(status(null),'Sin lecturas');
  for(const temperature of [2,5,8]) assert.equal(outside({temperature,min:2,max:8}),false);
  for(const temperature of [1.9,8.1]) assert.equal(outside({temperature,min:2,max:8}),true);
});
test('última medición ordena instantes con diferentes offsets, no el orden de ingreso',()=>{
  const readings=[{id:1,equipmentId:'a',measuredAt:'2026-09-29T10:00:00-03:00',createdAt:'2026-09-30T10:00:00Z'},{id:2,equipmentId:'a',measuredAt:'2026-09-29T12:00:00Z',createdAt:'2026-09-30T11:00:00Z'}];
  assert.equal(latest(readings,'a').id,1);
  assert.equal(latest(readings,'b'),undefined);
});
test('filtro de incidencias excluye lecturas normales y cierres',()=>{
  const base={equipmentId:'a',temperature:9,min:2,max:8,measuredAt:'2026-09-29T12:00:00Z'};
  const rows=[{...base,id:1},{...base,id:2,resolution:{action:'Revisado'}},{...base,id:3,temperature:4}];
  assert.deepEqual(filterReadings(rows,{onlyOpen:true}).map(r=>r.id),[1]);
  assert.equal(filterReadings(rows,{equipmentId:'b'}).length,0);
  assert.equal(filterReadings(rows,{from:'2026-10-01'}).length,0);
});
test('validación rechaza rangos invertidos, fechas futuras y valores no finitos',()=>{
  assert.throws(()=>validateEquipment({code:'a',name:'b',location:'c',min:8,max:2}));
  assert.throws(()=>validateReading({temperature:Infinity,responsible:'Test',measuredAt:'2020-01-01'}));
  assert.throws(()=>validateReading({temperature:4,responsible:'Test',measuredAt:new Date(Date.now()+3600000).toISOString()}));
  assert.throws(()=>validateReading({temperature:4,responsible:' ',measuredAt:'2020-01-01'}));
});
test('CSV neutraliza fórmulas en texto y conserva temperaturas negativas numéricas',()=>{
  assert.equal(csvCell('=1+1'),'"\'=1+1"');
  assert.equal(csvCell(-20),'"-20"');
  assert.equal(csvCell('a"b'),'"a""b"');
});
