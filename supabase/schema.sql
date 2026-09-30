-- Ejecutar una vez en SQL Editor de un proyecto Supabase nuevo.
-- Un laboratorio compartido por todas las cuentas autenticadas.
begin;

-- Tabla conservada por compatibilidad; ya no es necesaria para el acceso.
create table public.lab_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0)
);
alter table public.lab_members enable row level security;
create policy "Read own membership" on public.lab_members for select to authenticated using (user_id = (select auth.uid()));

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  code text not null check (length(trim(code)) between 1 and 40),
  name text not null check (length(trim(name)) between 1 and 100),
  location text not null check (length(trim(location)) between 1 and 100),
  min_temperature numeric(6,2) not null,
  max_temperature numeric(6,2) not null,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  check (min_temperature < max_temperature),
  check (min_temperature > '-Infinity'::numeric and max_temperature < 'Infinity'::numeric)
);
create unique index equipment_code_unique on public.equipment (lower(trim(code)));

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id),
  temperature numeric(6,2) not null check (temperature > '-Infinity'::numeric and temperature < 'Infinity'::numeric),
  min_temperature numeric(6,2) not null,
  max_temperature numeric(6,2) not null,
  measured_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  responsible text not null check (length(trim(responsible)) between 1 and 100),
  notes text not null default '' check (length(notes) <= 1000)
);
create index readings_equipment_date on public.readings (equipment_id, measured_at desc);

-- Los límites y la fecha de ingreso se establecen en el servidor.
create function public.prepare_reading() returns trigger language plpgsql set search_path = '' as $$
begin
  select min_temperature, max_temperature into new.min_temperature, new.max_temperature
  from public.equipment where id = new.equipment_id;
  if not found then raise exception 'Refrigerador no disponible'; end if;
  if new.measured_at > clock_timestamp() then raise exception 'La medición no puede estar en el futuro'; end if;
  new.created_at := clock_timestamp();
  new.created_by := auth.uid();
  return new;
end;
$$;
create trigger prepare_reading before insert on public.readings for each row execute function public.prepare_reading();

create table public.incident_resolutions (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null unique references public.readings(id),
  action text not null check (length(trim(action)) between 1 and 2000),
  responsible text not null check (length(trim(responsible)) between 1 and 100),
  closed_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id)
);
create function public.prepare_resolution() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.readings where id = new.reading_id and (temperature < min_temperature or temperature > max_temperature)) then
    raise exception 'La lectura no corresponde a una incidencia';
  end if;
  new.closed_at := clock_timestamp();
  new.created_by := auth.uid();
  return new;
end;
$$;
create trigger prepare_resolution before insert on public.incident_resolutions for each row execute function public.prepare_resolution();

alter table public.equipment enable row level security;
alter table public.readings enable row level security;
alter table public.incident_resolutions enable row level security;

create policy "Members read equipment" on public.equipment for select to authenticated using ((select auth.uid()) is not null);
create policy "Members add equipment" on public.equipment for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Members read readings" on public.readings for select to authenticated using ((select auth.uid()) is not null);
create policy "Members add readings" on public.readings for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Members read resolutions" on public.incident_resolutions for select to authenticated using ((select auth.uid()) is not null);
create policy "Members add resolutions" on public.incident_resolutions for insert to authenticated with check (created_by = (select auth.uid()));

revoke all on public.lab_members, public.equipment, public.readings, public.incident_resolutions from anon, authenticated;
grant select on public.lab_members to authenticated;
grant select, insert on public.equipment, public.readings, public.incident_resolutions to authenticated;
-- No se permite modificar ni borrar lecturas desde el cliente.
commit;

-- Después de crear un usuario en Authentication > Users, puede iniciar sesión.
-- No se requiere crear una fila en lab_members.
