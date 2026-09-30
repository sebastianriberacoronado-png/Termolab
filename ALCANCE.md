# Control de temperaturas · alcance actual

Aplicación web local con Vite y JavaScript. Guardado centralizado en Supabase, con inicio de sesión y miembros autorizados para un laboratorio.

Implementado: inventario, límites configurables, registro de lecturas, identificación de valores fuera del rango, seguimiento de incidencias, filtros y exportaciones. Vista demostrativa temporal para iterar el diseño.

Configuración externa: ejecutar `supabase/schema.sql`, crear un usuario de Supabase Auth y agregarlo a `lab_members`. Consultar README.md.

Pendiente de definir con el laboratorio: equipos reales, límites, frecuencia de registro, roles diferenciados, política de respaldo y validación para uso operativo.
