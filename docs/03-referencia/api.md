# Referencia de API

Base local predeterminada `http://localhost:3002`. Todas las rutas requieren `Authorization: Bearer <JWT>` salvo las indicadas como públicas. Posts, comentarios, perfiles y DM usan `x-event-id` para el contexto. El slug del muro identifica el muro dentro del evento. Los controladores TypeScript contienen los contratos y formatos de error.

## Autenticación y eventos

| Método y ruta | Entrada | Resultado |
|---|---|---|
| `GET /auth/events-by-code/:participant_code` | Público, código de participante; límite por IP (`authIpLimiter`) | Membresías pendientes de activación: `membership_id`, `participant_code`, `account_status` y el evento. Ya no devuelve el rol. |
| `POST /auth/activate` | Público, `participant_code`, `event_id`, `initial_password`, `new_password` | Activa y devuelve `{ success: true }`. |
| `POST /auth/login` | Público, `participant_code`, `password` | Token y contexto. 409 si el código activo identifica a usuarios distintos. |
| `GET /auth/context` | JWT | Usuario y membresías activas. |
| `GET /events/:eventId/walls` | Membresía activa del evento | Metadatos y banderas de acceso/publicación. |
| `GET /events/:eventId/committees` | Membresía activa del evento | Comités del evento. |
| `GET /events/:eventId/participants?q=&committee_id=&page=&limit=` | JWT y membresía activa del evento; `x-event-id`, si se envía, debe coincidir | Directorio paginado: `{ participants, page, limit, hasMore }`. Filas con `membershipId`, nombres, `alias`, `avatar` (la foto de perfil o, si no tiene, un avatar predeterminado con su nombre; siempre una URL), `committee` (`{id, name}` o `null`) y `delegationCode`. `page` ≥ 1 (por defecto 1); `limit` 1–100 (por defecto 20); `committee_id` debe ser un comité no borrado del mismo evento. Búsqueda sin distinguir tildes ni mayúsculas. Sin `participant_code` ni correo. 400 en parámetros inválidos, 403 sin membresía activa, 500 genérico si falla la base. Filtra en memoria por lotes de 500; el coste se mide en Q03. |

## Publicaciones y comentarios

| Método y ruta | Entrada | Regla principal |
|---|---|---|
| `GET /posts?muro=<slug>` | Query `muro` | Feed de muro autorizado. Cada post incluye `commentCount` (comentarios visibles). |
| `POST /posts` | `muro`, `content`, `post_type`, `poll_options?` | Texto o encuesta de 2 a 10 opciones. |
| `DELETE /posts/:postId` | — | Autor o administración. Borrado lógico. |
| `POST /posts/:postId/poll/vote` | `option_id` | Reemplaza voto vigente. |
| `POST /posts/:postId/poll/close` | — | El autor cierra la encuesta. |
| `GET /posts/:postId/comments` | — | Comentarios visibles en el muro autorizado. |
| `POST /posts/:postId/comments` | `content`, `parent_comment_id?` | Se puede responder a un comentario o a otra respuesta del mismo post (`parent_comment_id`). En anuncios solo comentan administradores y moderadores. |
| `DELETE /posts/:postId/comments/:commentId` | — | Autor o administración. |

### Adjuntos (planificado, no implementado)

Contrato propuesto en [ADR-006](../06-decisiones/ADR-006-adjuntos-en-r2-con-url-firmada.md) y [plan-adjuntos-r2.md](../04-desarrollo/plan-adjuntos-r2.md). No existe en el código.

| Método y ruta | Entrada | Regla principal |
|---|---|---|
| `POST /posts/attachments/init` | `muro`, `file_name`, `mime_type`, `size` | Exige membresía y permiso de publicar en el muro. JPG/PNG ≤ 5 MB o PDF ≤ 20 MB. Devuelve `upload_id` y una URL firmada de `PUT` de 5 minutos. 429 con 3 intentos sin consumir o más de 20 por hora. |
| `POST /posts` con `upload_id` | Los campos actuales más `upload_id` | Verifica el objeto, lo copia a su ruta final y crea post y adjunto. Un intento solo se usa una vez; un reintento devuelve el mismo post. |
| `GET /posts/:postId/attachment/download` | — | Comprueba membresía, acceso al muro y post no eliminado. Devuelve `{ url, expiresAt }` con URL firmada de 60 segundos. |
| `DELETE /posts/:postId/attachment` | — | El autor retira su adjunto. |
| `POST /admin/moderation/posts/:postId/attachment/delete` | `reason` (3–500) | Administrador o `MODERATOR` del evento. Retira el adjunto sin borrar el post y audita el motivo. |

`GET /posts` incluirá `attachment` (`id`, `name`, `mimeType`, `size`, `canRemove`) sin URL. `canRemove` es verdadero solo para el autor del post.

## Perfiles

| Método y ruta | Entrada | Regla principal |
|---|---|---|
| `GET /profiles/me` | — | Perfil propio. |
| `PATCH /profiles/me` | `display_name?`, `bio?`, `profile_image_path?`, `alias?` | Alias vacío o `null` lo borra. Campos institucionales protegidos. |
| `POST /profiles/me/avatar` | `file_name`, `mime_type`, `base64_data` | JPEG, PNG o WebP. |
| `GET /profiles/:membershipId` | — | Perfil del mismo evento. |
| `PATCH /profiles/:membershipId` | Campos permitidos de perfil y membresía | Administración, con restricciones sobre otros administradores. |
| `POST /profiles/:membershipId/avatar` | Archivo base64 | Administración. |

## Mensajería directa

| Método y ruta | Entrada | Regla principal |
|---|---|---|
| `GET /dm/conversations` | — | Conversaciones de la membresía activa. |
| `GET /dm/participants?search=` | Búsqueda | Participantes activos del mismo evento. Cada participante, y `otherParticipant` en las conversaciones, incluye `alias` (o `null`). |
| `POST /dm/conversations` | `targetMembershipId` | Crea o reutiliza conversación 1:1. |
| `GET /dm/conversations/:conversationId/messages` | — | Solo integrante. Cada mensaje incluye `readAt` (cuándo la otra persona lo leyó; `null` si no). |
| `POST /dm/conversations/:conversationId/messages` | `content` | Solo integrante activo. |
| `POST /dm/conversations/:conversationId/read` | — | Solo integrante. Marca como leídos los mensajes que envió la otra persona y siguen sin leer; nunca los propios. Responde `{ readCount, readAt }`. Lo pide la pantalla solo cuando la conversación está abierta, visible y al final. Se rechaza en evento cerrado. Requiere la migración 004. |
| `DELETE /dm/conversations/:conversationId/messages/:messageId` | — | Solo autor. Borrado lógico. |

## Administración

`GET /admin/events` exige alguna membresía administrativa activa. `POST /admin/events` exige `ADMIN_TECH` activo. Las demás rutas exigen membresía administrativa activa del evento objetivo. El evento se obtiene de la URL, la consulta, el cuerpo o el recurso indicado. El encabezado `x-event-id` no reemplaza ese contexto.

| Método y ruta | Entrada principal | Uso en web |
|---|---|---|
| `GET /admin/events` | `page?`, `limit?` | Listado de eventos administrados. |
| `POST /admin/events` | `name`, `slug`, `description?`, `start_date?`, `end_date?` | Formulario de alta. Véase [compatibilidad](../07-auditoria/discrepancias.md#d-05--compatibilidad-entre-api-y-esquema). |
| `GET /admin/events/:eventId` | — | Configuración. |
| `PATCH /admin/events/:eventId` | Campos parciales del alta y `status?` | Configuración. Estados editables `ACTIVE`, `CLOSED`, `ARCHIVED`. |
| `GET /admin/committees?event_id=` | `event_id` | Listado. |
| `GET /admin/committees/:committeeId` | — | Edición. |
| `POST /admin/committees` | `event_id`, `name`, `code`, `description?`, `sort_order?` | Alta con creación de muro. |
| `PATCH /admin/committees/:committeeId` | `name?`, `code?`, `description?`, `sort_order?` | Edición. Actualiza nombre del muro cuando cambia el nombre. |
| `DELETE /admin/committees/:committeeId` | — | Botón «Eliminar» en la lista de comités, con confirmación. Borrado lógico de comité e intento de borrar su muro; no comprueba participantes (quedan sin comité en el contexto, aunque conservan `committee_id`). |
| `POST /admin/memberships` | `event_id`, `user_id`, `role`, `participant_code`, campos opcionales de comité/delegación/institución | Sin pantalla. Vincula un usuario existente sin generar contraseña inicial ni perfil. Valida que el comité exista, sea del evento y no esté archivado (404 o 400). 409 si el código ya existe en el evento o si lo usa otra persona en otro evento. |
| `POST /admin/create-account` | `event_id`, `participant_code`, `role`, `first_name`, `last_name`, campos opcionales de comité y perfil | Alta individual. Devuelve `initial_password`, `delegation_code` y `warnings`. La pantalla muestra la contraseña. 409 si el código ya existe en el evento o lo usa otra persona en otro evento. |
| `GET /admin/participants` | `event_id`, `page?`, `limit?`, `committee_id?`, `role?`, `status?`, `q?` | Listado y filtros. La API admite búsqueda `q` por nombre, alias o códigos. |
| `GET /admin/participants/:membershipId` | — | Ficha individual. |
| `PATCH /admin/participants/:membershipId` | Rol, comité, delegación, institución y campos de perfil, incluido alias | Edición individual. Código de ingreso y evento fuera de los campos editables. La ficha carece de control de alias. |
| `POST /admin/participants/:membershipId/suspend` | `reason` | Suspensión. Rechaza (400) una cuenta ya suspendida y una que nunca se activó (`PENDING_ACTIVATION`): para esa última, restablecer la contraseña inicial. |
| `POST /admin/participants/:membershipId/reactivate` | `reason` | Reactivación de una membresía suspendida. |
| `POST /admin/participants/:membershipId/reset-password` | — | Devuelve `temporary_password`, con `Cache-Control: no-store`. |
| `PATCH /admin/participants/:membershipId/committee` | `committee_id` (ID o `null`), `reason?` | Sin cliente dedicado. La ficha usa el PATCH general. |
| `PATCH /admin/participants/:membershipId/role` | `role` (`PARTICIPANT` o `MODERATOR`), `reason?` | Ficha y listado. Solo admin del evento. 400 si ya tiene el rol, 403 si la cuenta es administrativa. Devuelve `membership`. |
| `POST /admin/participants/import/preview` | `event_id`, `csv` como texto | Sin pantalla. Separa `valid`, `invalid`, `duplicates`, sin alta. |
| `POST /admin/participants/import/confirm` | `event_id`, `rows` del preview | Sin pantalla. Devuelve `summary`, `created` con credenciales iniciales y `failed` por fila. |

### Moderación

Aceptan administrador o `MODERATOR` activo del evento del recurso. Errores como `{ "error": "texto" }`; las escrituras tienen límite de frecuencia y pueden responder 429. Detalle de tipos en [SPRINT_3_FRONTEND_ADMIN.md](../SPRINT_3_FRONTEND_ADMIN.md); cliente en `apps/web/lib/api/moderation.ts`.

| Método y ruta | Entrada principal | Uso en web |
|---|---|---|
| `GET /admin/moderation/walls` | `event_id` | Selector de muro con `visible_posts` y `pinned_posts`. |
| `GET /admin/moderation/people` | `event_id` | Solo lectura para moderadores. Personas activas del evento (`id` de membresía, `participant_code`, `first_name`, `last_name`, `alias`), ordenadas por apellido y nombre, sin datos de contacto. Alimenta el selector «Persona». |
| `GET /admin/moderation/posts` | `wall_id`, `status?` (`VISIBLE`, `DELETED`, `ALL`), `page?`, `limit?` (máx. 100), `author_membership_id?` (UUID) | Lista paginada, fijados primero. Incluye texto original, datos de borrado y `attachment` (`id`, `name`, `mimeType`, `size`, o `null`), también en posts eliminados hasta la purga. `author_membership_id` filtra por persona dentro del muro; si viene vacío o no es UUID responde 400, y si la membresía no pertenece al evento responde 404 «La persona no pertenece a este evento». Sin el parámetro la respuesta no cambia. |
| `POST /admin/moderation/posts/:postId/attachment/delete` | `reason` (3–500) | Botón «Retirar adjunto» de la tarjeta. Retira el adjunto sin borrar el post. 404 si ya no hay adjunto. Audita `MODERATE_DELETE_ATTACHMENT`. |
| `GET /admin/moderation/posts/:postId/comments` | `status?` | Comentarios al expandir un post. La web pide `ALL`. |
| `POST /admin/moderation/posts/:postId/delete` | `reason` (3–500) | Devuelve solo el estado; la web recarga la lista. 409 si ya estaba borrado. |
| `POST /admin/moderation/comments/:commentId/delete` | `reason` (3–500) | Igual que el anterior. |
| `POST /admin/moderation/posts/:postId/pin` y `/unpin` | — | Máximo 3 fijados por muro (409 al cuarto). Solo posts `VISIBLE`. |
| `POST /admin/moderation/posts/:postId/hide` y `/unhide`, `POST /admin/moderation/comments/:commentId/hide` y `/unhide` | `{ reason }` (obligatorio) | Ocultar sin borrar (`VISIBLE` ↔ `HIDDEN`); 409 si el estado no corresponde; ocultar un post fijado lo desfija. Los participantes no ven lo oculto ni pueden comentar, votar o borrar sobre ello (404). Audita `HIDE_*` y `UNHIDE_*`. |
| `GET /admin/audit-logs?event_id&limit&before` | — | Consulta de auditoría de un evento (`limit` 1 a 100, `before` es el cursor opaco `next_before` de la página anterior, o una fecha ISO 8601 con zona; cursor inválido: 400). Respuesta `{ logs, next_before }`. `ADMIN_TECH` ve el registro completo; `ADMIN_MUN` solo acciones de cuidado general (moderación, suspender, reactivar, restablecer contraseña, `ACCESS_DENIED`). Ver [ADR-007](../06-decisiones/ADR-007-decisiones-de-producto-noviembre-2026.md). |

### Contrato CSV

La plantilla usa `nombre,apellido,codigo_participante,comite,delegacion,rol,alias`. Los primeros tres son obligatorios. Se acepta también la columna `institucion`. El parser admite coma o punto y coma y encabezados equivalentes. El código admite de 3 a 50 caracteres alfanuméricos ASCII, punto, guion o guion bajo. Comité opcional, por código o nombre de un comité del evento que no esté archivado. Si no existe, se crea al confirmar con su muro (código derivado del nombre); un nombre o código de comité archivado bloquea la fila. Los comités nuevos se resuelven una vez por nombre, sin distinguir mayúsculas ni tildes, y se listan en la previsualización (`new_committees`). Si la creación falla, esas filas quedan fallidas. El rol vacío equivale a participante. Se admiten participante, moderador y administrador MUN (`ADMIN_MUN`, o «Admin»); el administrador técnico no se importa y se crea uno por uno.

Previsualización de hasta 1.000 filas de datos y 2.000.000 de caracteres. Confirmación de 1 a 50 filas normalizadas por solicitud y validación repetida en servidor. Se omiten las inválidas y duplicadas. Puede haber éxito parcial. La respuesta de confirmación y la del alta individual se marcan `Cache-Control: no-store`.

## Límites observados

- El servidor acepta JSON hasta `10mb`. El avatar aplica 5 MB decodificados.
- La paginación de eventos y participantes acepta `limit` de 1 a 100. El feed y el historial de chat carecen de paginación equivalente en sus rutas.
- Las respuestas de error no comparten una envoltura uniforme. El recorrido con datos y sus límites operativos se describe en [flujos funcionales](flujos-funcionales.md).
