# Control de temperaturas · alcance actual

Aplicación web con Vite y JavaScript, disponible localmente y en Netlify. Guardado centralizado en Supabase, con acceso a un laboratorio compartido para todas las cuentas autenticadas, sin membresía adicional.

Implementado: inventario, límites configurables, registro de lecturas, identificación de valores fuera del rango, seguimiento de incidencias, filtros y exportaciones. Vista demostrativa temporal para iterar el diseño.

Configuración externa: ejecutar `supabase/schema.sql` en una instalación nueva y crear usuarios en Supabase Auth. Para instalaciones anteriores, ejecutar `supabase/migrations/20260930_acceso_cuentas_autenticadas.sql`. Consultar README.md.

Pendiente de definir con el laboratorio: equipos reales, límites, frecuencia de registro, roles diferenciados, política de respaldo y validación para uso operativo.
