-- Ejecutar en SQL Editor del proyecto existente de TermoLab.
-- Todas las cuentas autenticadas comparten el laboratorio sin requerir membresía.
-- No borra equipos, lecturas, cierres ni las membresías antiguas.
begin;

alter policy "Members read equipment" on public.equipment
  using ((select auth.uid()) is not null);
alter policy "Members add equipment" on public.equipment
  with check (created_by = (select auth.uid()));
alter policy "Members read readings" on public.readings
  using ((select auth.uid()) is not null);
alter policy "Members add readings" on public.readings
  with check (created_by = (select auth.uid()));
alter policy "Members read resolutions" on public.incident_resolutions
  using ((select auth.uid()) is not null);
alter policy "Members add resolutions" on public.incident_resolutions
  with check (created_by = (select auth.uid()));

-- Las políticas siguen limitadas al rol authenticated.
-- Los visitantes sin sesión no pueden leer ni insertar registros.
commit;
