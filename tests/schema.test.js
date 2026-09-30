import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('SQL: permisos, límites del servidor, lecturas inmutables y cierres únicos',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);
    await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
    await db.exec(`insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
      insert into lab_members values ('00000000-0000-4000-8000-000000000001','Operador');
      set role authenticated;
      set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
      insert into equipment(id,code,name,location,min_temperature,max_temperature) values ('00000000-0000-4000-8000-000000000010','RF-01','Reactivos','Laboratorio',2,8);`);
    await assert.rejects(()=>db.exec(`insert into equipment(code,name,location,min_temperature,max_temperature) values ('rf-01','Duplicado','Laboratorio',2,8)`));
    await db.exec(`insert into readings(id,equipment_id,temperature,min_temperature,max_temperature,measured_at,responsible) values ('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',9,-100,100,now()-interval '1 minute','Operador')`);
    const result=await db.query('select min_temperature,max_temperature,created_by from readings');
    assert.equal(Number(result.rows[0].min_temperature),2);
    assert.equal(Number(result.rows[0].max_temperature),8);
    assert.equal(result.rows[0].created_by,'00000000-0000-4000-8000-000000000001');
    await assert.rejects(()=>db.exec(`insert into readings(equipment_id,temperature,measured_at,responsible) values ('00000000-0000-4000-8000-000000000010',4,now()+interval '1 day','Operador')`));
    await assert.rejects(()=>db.exec('update readings set temperature=4'));
    await assert.rejects(()=>db.exec('delete from readings'));
    await db.exec(`insert into incident_resolutions(reading_id,action,responsible) values ('00000000-0000-4000-8000-000000000020','Revisión','Operador')`);
    await assert.rejects(()=>db.exec(`insert into incident_resolutions(reading_id,action,responsible) values ('00000000-0000-4000-8000-000000000020','Otro cierre','Operador')`));
    await db.exec(`set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002'`);
    assert.equal((await db.query('select * from readings')).rows.length,0);
    await assert.rejects(()=>db.exec(`insert into equipment(code,name,location,min_temperature,max_temperature) values ('RF-02','No autorizado','Laboratorio',2,8)`));
    await db.exec('reset role; set role anon;');
    await assert.rejects(()=>db.query('select * from readings'));
  } finally {await db.close();}
});
