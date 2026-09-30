# TermoLab

Aplicación local para el registro manual de temperaturas de refrigeradores. Interfaz en español y almacenamiento en Supabase.

## Abrir la aplicación

Con el servidor iniciado: http://127.0.0.1:5173

Para iniciarlo en otra sesión, haz doble clic en `iniciar.cmd` y deja su ventana abierta. También puedes ejecutar:

```powershell
npm.cmd install
npm.cmd run dev -- --port 5173 --strictPort
```

Se requiere Node.js compatible con Vite 7 (en este equipo se verificó Node 24). Ahora la aplicación se abre mediante el servidor local, no con doble clic en index.html.

## Activar el guardado en Supabase

La configuración se guarda en `.env.local`, excluido del control de versiones. Copia `.env.example` como `.env.local` y completa la URL y la clave pública de tu proyecto. Reinicia Vite después de cambiarlos. Nunca uses una clave secreta o service_role en variables VITE_: su contenido llega al navegador.

1. Abre tu proyecto en [Supabase](https://supabase.com/dashboard) y entra en SQL Editor.
2. Copia el contenido completo de `supabase/schema.sql` y ejecútalo una vez. Crea equipment, readings, incident_resolutions y lab_members, sus validaciones y políticas de acceso.
3. En Supabase, ve a Authentication > Users > Add user y crea tu usuario con correo y contraseña.
4. Inicia sesión en «Conexión con Supabase». Todas las cuentas autenticadas tienen acceso; no necesitas crear membresías. Agrega un refrigerador y registra una lectura. Actualiza la página para comprobar su persistencia.

Si la base de datos ya existía con la restricción de membresía, ejecuta una vez `supabase/migrations/20260930_acceso_cuentas_autenticadas.sql` en SQL Editor. No vuelvas a ejecutar el esquema inicial. La migración conserva los datos y habilita las cuentas existentes y futuras al iniciar sesión.

La clave pública sirve para conectar el cliente, pero no permite crear tablas ni administrar usuarios. No hace falta compartir tu contraseña con el asistente.

## Publicar en Netlify

Sitio de producción: https://termolab-clinico.netlify.app

Panel de administración: https://app.netlify.com/projects/termolab-clinico

El primer despliegue se realiza con la CLI. El repositorio de GitHub no está enlazado automáticamente: para que cada push despliegue una nueva versión, enlázalo desde la configuración del proyecto en Netlify.

El archivo `netlify.toml` configura Node 24, `npm run build` y la carpeta de publicación `dist`.

Para despliegues automáticos, importa este repositorio en Netlify y selecciona la rama `main`. Configura estas variables para el proceso de compilación antes de desplegar:

- `VITE_SUPABASE_URL`: URL de tu proyecto Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: clave pública publishable del proyecto.

Los valores están en `.env.local` en el computador de desarrollo; ese archivo no se publica en GitHub. Netlify necesita su propia configuración. Nunca utilices una clave secreta ni service_role. Tras cambiar variables, vuelve a desplegar.

También se puede publicar la compilación local con la herramienta oficial de Netlify. El sitio resultante funciona sin mantener encendido el computador. La disponibilidad depende del servicio y del plan de Netlify y Supabase.

Referencia: [Vite en Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/).

## Interfaz

- Vista general: cantidad de equipos, equipos dentro del rango, incidencias pendientes y lecturas de hoy.
- Tarjetas por refrigerador con última temperatura, límites y fecha de medición.
- Orden personal de tarjetas: arrastra el control ⠿ de una tarjeta sobre otra. También puedes enfocar ese control y usar las flechas del teclado. El orden se conserva por usuario en este navegador; la demostración tiene su propio orden. Los equipos nuevos aparecen al final. Esta preferencia visual no se sincroniza entre computadores; los registros siguen guardándose en Supabase.
- Formularios para equipos, lecturas y acciones de cierre.
- Historial filtrable por equipo, fechas e incidencias pendientes; exportación CSV y JSON.
- Informes: elige un refrigerador y fechas Desde/Hasta (ambos días incluidos, en la zona horaria del computador). El gráfico de puntos y líneas y la tabla muestran todas las lecturas de ese período en orden cronológico. Incluye mínima, máxima, promedio por lectura, cantidad fuera de rango y exportación CSV del informe. Selecciona un punto para consultar su detalle. Las líneas discontinuas representan los límites conservados en cada lectura; las conexiones entre puntos no representan monitoreo continuo. El informe usa los registros cargados: pulsa Actualizar para traer cambios de otros usuarios.
- Demostración con datos ficticios, disponible sin iniciar sesión. Sus cambios viven solo en memoria y se eliminan al recargar; nunca se envían a Supabase.
- Botón Actualizar para cargar cambios realizados desde otros equipos. No hay suscripción en tiempo real.

## Datos y permisos

Modelo de un laboratorio: todas las cuentas autenticadas de este proyecto Supabase comparten equipos, lecturas y cierres. No se requiere una fila en `lab_members`; esa tabla se conserva por compatibilidad. Los visitantes sin sesión no tienen acceso a los datos. La aplicación no incluye un formulario de registro; los usuarios se crean en Supabase Auth y deben poder autenticarse según su configuración de correo y contraseña.

Las lecturas se insertan individualmente. El servidor toma los límites del equipo y establece la fecha de ingreso y el usuario autenticado. Conserva la fecha de medición como timestamptz; la interfaz muestra la hora local del computador. Los límites son inclusivos.

Los cierres se guardan por separado, una sola vez por incidencia. Desde la aplicación no se pueden borrar ni modificar lecturas originales. El nombre de responsable es declarativo; created_by conserva además la identidad autenticada.

No se guardan nuevas lecturas en localStorage. Supabase Auth sí puede conservar la sesión en el navegador. Cierra sesión en computadores compartidos. La exportación JSON es una copia de los registros disponibles al usuario; no sustituye los respaldos de la base de datos ni tiene restauración automática.

Si usaste la versión anterior mediante file://, sus datos permanecen en ese origen y no se migran automáticamente al servidor local. Conservar o exportar esos datos antes de cambiar de navegador. La aplicación ofrece rescatar el JSON anterior solo si está disponible en el mismo origen.

## Desarrollo y verificación

```powershell
npm.cmd test
npm.cmd run build
node --env-file=.env.local scripts/check-supabase.js
```

Fuentes de referencia: [claves públicas y seguridad](https://supabase.com/docs/guides/getting-started/api-keys), [inicio de sesión](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [protección de datos](https://supabase.com/docs/guides/database/secure-data).

Versión en desarrollo para evaluación. No incluye sensores, avisos por correo, registros de calibración, reglas de frecuencia de medición ni validación operativa del laboratorio.
