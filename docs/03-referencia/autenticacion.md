# Autenticación y autorización

## Activación y sesión

La búsqueda pública devuelve cuentas pendientes por código. La activación valida código, evento y contraseña inicial, guarda la identidad en Supabase Auth y activa la membresía. La sesión se solicita en un paso posterior, con el código de participante y la contraseña. Consulta [flujos funcionales](flujos-funcionales.md#activación-sesión-y-selección).

El cliente conserva el token y la selección en `localStorage`. Cerrar sesión limpia el estado local. No se observó revocación remota en ese recorrido. El cliente común de solicitudes autenticadas también limpia la sesión y redirige a login ante un 401.

`POST /auth/login` responde 401 `Credenciales invalidas` tanto si la contraseña no coincide como si el código no tiene membresía activa, para no revelar qué códigos existen (Q02-2, resuelto el 21 de noviembre de 2026). El motivo real solo queda en el registro de intentos (`MEMBERSHIP_NOT_FOUND` o `INVALID_CREDENTIALS`). Un fallo al consultar la membresía también responde 401. La UI muestra «Credenciales inválidas» y ofrece «¿Primera vez? Activa tu cuenta», que abre la activación con el código escrito; la consulta de cuentas pendientes solo se hace al pulsar "Continuar". Otros 400, el 409 y los fallos de red conservan su mensaje.

## Contexto de servidor

`requireAuth` valida el bearer token en Supabase Auth, resuelve el usuario interno, carga las membresías activas y adjunta el contexto a `req.auth`. Eventos usa su parámetro de ruta. Posts, comentarios, perfiles y DM usan `x-event-id`. El slug de muro identifica el muro dentro del evento. Los controladores y servicios comprueban permisos adicionales sobre el recurso.

Para resolver el contexto de cada solicitud, la API consulta Auth y luego usa `get_auth_context_by_supabase_auth_user_id` (migración 012) para leer usuario y membresías en un solo viaje a Postgres. El JWT y la autorización se validan en cada solicitud; el resultado no se memoiza. Si la RPC aún no existe en el caché de esquema de PostgREST (`PGRST202`), se usa temporalmente la lectura anterior de usuario y membresías. Otros errores no activan ese fallback. La RPC solo se ejecuta con el rol `service_role`.

El canal privado de invalidación de reacciones valida al suscribirse el usuario activo, su membresía del evento y el acceso al muro. La autorización del socket puede quedar vigente tras un cambio de membresía mientras la conexión siga abierta; no se usa como autorización de datos. Cada `GET /posts/reactions` vuelve a validar el contexto y el acceso antes de leer.

## Administración

Las rutas administrativas con evento objetivo usan `requireEventAdmin`. Las dos rutas de colección de eventos usan `requireAdmin`, y el listado filtra solo eventos administrados. Consulta [roles y permisos](../01-producto/roles-y-permisos.md) y [ADR-005](../06-decisiones/ADR-005-autorizacion-administrativa-por-evento.md).

## Límites funcionales

No hay recuperación autónoma ni bloqueo por umbral de intentos. El panel ofrece restablecimiento de contraseña y suspensión por evento. El contexto se vuelve a leer al autenticar cada solicitud. La actualización de vistas abiertas y la revocación efectiva de suscripciones Realtime requieren verificación independiente.
