-- Primero crea el usuario desde Authentication > Users > Add user.
-- Elige su correo y contraseña en Supabase, no en el código de la aplicación.
-- Reemplaza el correo y nombre en este script antes de ejecutarlo.
insert into public.lab_members (user_id, display_name)
select id, 'Nombre del responsable'
from auth.users
where lower(email) = lower('REEMPLAZAR@laboratorio.cl')
on conflict (user_id) do update set display_name = excluded.display_name;

-- Comprueba que aparece el usuario autorizado:
select user_id, display_name from public.lab_members;
