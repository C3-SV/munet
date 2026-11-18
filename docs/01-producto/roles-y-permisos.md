# Roles y permisos

La membresía vincula a una persona con un evento, su rol y, cuando corresponde, su comité. El [snapshot](../../supabase/schema.sql) enumera `PARTICIPANT`, `MODERATOR`, `ADMIN_MUN` y `ADMIN_TECH`. El código determina si un rol es administrativo buscando `ADMIN`, `COORDINADOR` u `ORGANIZADOR` en el texto normalizado. El catálogo válido en la base del entorno requiere confirmación.

| Capacidad | Participante o moderador activo | Administración activa |
|---|---|---|
| Acceder al evento y a general/anuncios | Con membresía del evento | Con membresía del evento |
| Leer y publicar en comité | En su comité | En los comités del evento |
| Publicar o comentar en anuncios | Sin permiso | En su evento |
| Retirar publicaciones o comentarios | Contenido propio, según permisos del muro | Contenido de su evento donde tiene acceso |
| Editar perfiles | Propio, con campos protegidos | Propio y ajenos con restricciones sobre otros administradores |
| Chat individual | En conversaciones propias del evento | En conversaciones propias del evento |
| Gestionar comités, participantes, asignaciones e importación | Sin permiso | En el evento objetivo |
| Listar eventos administrados y crear eventos | Sin permiso | Con alguna membresía administrativa activa |
| Revisar reportes o supervisar DM | Pendiente | Pendiente |

`MODERATOR` puede asignarse en la importación, pero el rol por sí solo no concede acceso a comités ajenos ni a un panel de moderación. Para el comportamiento normativo histórico, consulta [reglas de negocio](reglas-de-negocio.md).

## Aplicación del contexto

- El layout web exige una membresía administrativa seleccionada para entrar al panel.
- En la API, `requireEventAdmin` resuelve el evento de la ruta, el cuerpo, la consulta o el recurso. Comprueba allí la membresía administrativa activa y la guarda como `req.auth.currentMembership`.
- `GET /admin/events` y `POST /admin/events` usan `requireAdmin` porque no tienen evento objetivo. El listado filtra los eventos administrados en el controlador. El alta intenta otorgar al creador membresía en el nuevo evento.
- No hay privilegio transversal especial para `ADMIN_TECH` en esta lógica. La autorización de otros módulos se describe en [autenticación](../03-referencia/autenticacion.md). Véase [ADR-005](../06-decisiones/ADR-005-autorizacion-administrativa-por-evento.md).
