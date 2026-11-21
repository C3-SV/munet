# Autenticación y autorización

## Activación y sesión

La búsqueda pública devuelve cuentas pendientes por código. La activación valida código, evento y contraseña inicial, guarda la identidad en Supabase Auth y activa la membresía. La sesión se solicita en un paso posterior, con el código de participante y la contraseña. Consulta [flujos funcionales](flujos-funcionales.md#activación-sesión-y-selección).

El cliente conserva el token y la selección en `localStorage`. Cerrar sesión limpia el estado local. No se observó revocación remota en ese recorrido. El cliente común de solicitudes autenticadas también limpia la sesión y redirige a login ante un 401.

En login, el cliente orienta según el estado HTTP de `POST /auth/login`: un 400 con `Membership no encontrado` indica que el código no tiene membresía activa. Ese par también puede aparecer si falla la búsqueda, por lo que la UI ofrece revisar el código o abrir la activación con el código escrito; la consulta de cuentas pendientes solo se hace al pulsar "Continuar". Un 401 muestra credenciales inválidas. Otros 400, el 409 y los fallos de red conservan su mensaje.

## Contexto de servidor

`requireAuth` valida el bearer token en Supabase Auth, resuelve el usuario interno, carga las membresías activas y adjunta el contexto a `req.auth`. Eventos usa su parámetro de ruta. Posts, comentarios, perfiles y DM usan `x-event-id`. El slug de muro identifica el muro dentro del evento. Los controladores y servicios comprueban permisos adicionales sobre el recurso.

## Administración

Las rutas administrativas con evento objetivo usan `requireEventAdmin`. Las dos rutas de colección de eventos usan `requireAdmin`, y el listado filtra solo eventos administrados. Consulta [roles y permisos](../01-producto/roles-y-permisos.md) y [ADR-005](../06-decisiones/ADR-005-autorizacion-administrativa-por-evento.md).

## Límites funcionales

No hay recuperación autónoma ni bloqueo por umbral de intentos. El panel ofrece restablecimiento de contraseña y suspensión por evento. El contexto se vuelve a leer al autenticar cada solicitud. La actualización de vistas abiertas y la revocación efectiva de suscripciones Realtime requieren verificación independiente.
