# Roles y permisos

La membresía vincula a una persona con un evento, su rol y, cuando corresponde, su comité. El [snapshot](../../supabase/schema.sql) enumera `PARTICIPANT`, `MODERATOR`, `ADMIN_MUN` y `ADMIN_TECH`. La base del entorno usa esos cuatro valores (confirmado el 20 de noviembre de 2026). El código reconoce como administrativos solo `ADMIN_MUN` y `ADMIN_TECH` (`isAdminRole`). La API rechaza con 400 cualquier otro valor al crear cuentas o membresías y al filtrar. En pantalla se muestran como Delegado, Moderador, Administrador MUN y Administrador técnico, y los formularios usan un select.

| Capacidad | Participante o moderador activo | Administración activa |
|---|---|---|
| Acceder al evento y a general/anuncios | Con membresía del evento | Con membresía del evento |
| Leer y publicar en comité | En su comité | En los comités del evento |
| Publicar o comentar en anuncios | Sin permiso | En su evento |
| Retirar publicaciones o comentarios | Contenido propio, según permisos del muro | Contenido de su evento donde tiene acceso |
| Moderar desde el panel (ver todos los muros del evento, eliminar con motivo, fijar y desfijar) | Solo `MODERATOR` | Sí |
| Editar perfiles | Propio, con campos protegidos | Propio y ajenos con restricciones sobre otros administradores |
| Chat individual | En conversaciones propias del evento | En conversaciones propias del evento |
| Gestionar comités, participantes, asignaciones e importación | Sin permiso, también para `MODERATOR` | En el evento objetivo |
| Dar o quitar `MODERATOR` | Sin permiso | En el evento objetivo, solo sobre cuentas no administrativas |
| Listar eventos administrados | Sin permiso | Con alguna membresía administrativa activa |
| Crear eventos | Sin permiso | Solo `ADMIN_TECH` activo. `ADMIN_MUN` recibe 403 |
| Revisar reportes o supervisar DM | Pendiente | Pendiente |

`MODERATOR` puede asignarse en la importación y con `PATCH /admin/participants/:membershipId/role`. En el panel solo ve Moderación; no crea cuentas, no cambia comités, no edita el evento ni publica en anuncios. Su acceso transversal a muros de comité está en `canAccessCommitteeWall`, cuya prueba unitaria (`rbac.utils.test.mjs`) sigue esperando lo contrario: véase [pendientes](../PENDIENTES.md). Para el comportamiento normativo histórico, consulta [reglas de negocio](reglas-de-negocio.md).

## Aplicación del contexto

- El layout web exige una membresía seleccionada con rol administrativo o `MODERATOR` para entrar al panel. Con `MODERATOR` redirige a Moderación cualquier otra ruta del panel; la API responde 403 de todos modos.
- En la API, `requireEventAdmin` resuelve el evento de la ruta, el cuerpo, la consulta o el recurso. Comprueba allí la membresía administrativa activa y la guarda como `req.auth.currentMembership`.
- `GET /admin/events` y `POST /admin/events` usan `requireAdmin` porque no tienen evento objetivo. El listado filtra los eventos administrados en el controlador. El alta intenta otorgar al creador membresía en el nuevo evento.
- `ADMIN_TECH` es el único rol que crea eventos (`requireSuperAdmin`). Las rutas `/admin/moderation/*` usan `requireEventModerator`, que acepta `ADMIN_MUN`, `ADMIN_TECH` y `MODERATOR` activos del evento del recurso. La autorización de otros módulos se describe en [autenticación](../03-referencia/autenticacion.md). Véase [ADR-005](../06-decisiones/ADR-005-autorizacion-administrativa-por-evento.md).
