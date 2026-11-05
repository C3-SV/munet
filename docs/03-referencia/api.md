# Referencia de API

Base local predeterminada: `http://localhost:3002`. Salvo donde se indique, se exige `Authorization: Bearer <JWT>`. El encabezado `x-event-id` selecciona contexto en perfiles y otros flujos; posts usa `muro` para resolverlo.

No existe OpenAPI ni versionado `/v1`. Los cuerpos siguientes se infieren de controladores y clientes actuales.

## Autenticación

| Método y ruta | Acceso | Entrada principal | Propósito |
|---|---|---|---|
| `GET /auth/events-by-code/:participant_code` | Público | código | Cuentas/eventos pendientes para activar |
| `POST /auth/activate` | Público | `participant_code`, `event_id`, contraseña inicial/nueva y datos requeridos por controlador | Activar una cuenta pendiente |
| `POST /auth/login` | Público | `participant_code`, `password` | Abrir sesión |
| `GET /auth/context` | Autenticado | JWT | Refrescar usuario y membresías activas |

La activación y login deben verificarse directamente en `controllers/auth.controller.ts` antes de cambiar clientes, porque no hay schema compartido.

## Eventos

| Método y ruta | Acceso efectivo | Resultado |
|---|---|---|
| `GET /events/:eventId/walls` | Miembro activo del evento | Muros con metadatos/banderas de acceso |
| `GET /events/:eventId/committees` | Miembro activo del evento | Comités del evento |

## Publicaciones y comentarios

| Método y ruta | Entrada | Regla principal |
|---|---|---|
| `GET /posts?muro=<slug>` | query `muro` | Lista posts visibles del muro autorizado |
| `POST /posts` | `muro`, `content`, `post_type`, `poll_options?` | Texto o encuesta; 2–10 opciones |
| `DELETE /posts/:postId` | — | Autor o admin; eliminación lógica |
| `POST /posts/:postId/poll/vote` | `option_id` | Reemplaza voto vigente |
| `POST /posts/:postId/poll/close` | — | Autor cierra encuesta |
| `GET /posts/:postId/comments` | — | Comentarios visibles |
| `POST /posts/:postId/comments` | `content`, `parent_comment_id?` | Máximo un nivel de respuesta |
| `DELETE /posts/:postId/comments/:commentId` | — | Autor o admin |

## Perfiles

Estas rutas dependen del contexto de evento enviado por cliente, normalmente `x-event-id`.

| Método y ruta | Entrada | Regla principal |
|---|---|---|
| `GET /profiles/me` | evento | Perfil propio |
| `PATCH /profiles/me` | `display_name?`, `bio?`, `profile_image_path?` | Editar perfil propio |
| `POST /profiles/me/avatar` | `file_name`, `mime_type`, `base64_data` | JPEG/PNG/WebP; carga a Storage |
| `GET /profiles/:membershipId` | evento | Perfil público del mismo evento |
| `PATCH /profiles/:membershipId` | campos permitidos | Administración; restricciones sobre otros admins |
| `POST /profiles/:membershipId/avatar` | archivo base64 | Administración |

## Mensajería directa

| Método y ruta | Entrada | Regla principal |
|---|---|---|
| `GET /dm/conversations` | evento | Conversaciones de la membresía activa |
| `GET /dm/participants?search=` | búsqueda | Participantes activos del mismo evento |
| `POST /dm/conversations` | `targetMembershipId` | Crea o reutiliza conversación 1:1 |
| `GET /dm/conversations/:conversationId/messages` | — | Solo participante |
| `POST /dm/conversations/:conversationId/messages` | `content` | Solo participante activo |
| `DELETE /dm/conversations/:conversationId/messages/:messageId` | — | Solo autor; borrado lógico |

## Administración

Todas usan `requireAuth` y `requireAdmin`. Este último acepta un rol administrativo activo en cualquier evento.

| Método y ruta | Cuerpo principal | Interfaz actual |
|---|---|---|
| `GET /admin/events` | `page` y `limit` opcionales | Sí; listado paginado |
| `GET /admin/events/:eventId` | — | Sí; configuración |
| `POST /admin/events` | `name`, `slug`, `description?`, `start_date?`, `end_date?` | Sí |
| `PATCH /admin/events/:eventId` | campos parciales y `status` | Sí; configuración |
| `GET /admin/committees?event_id=` | `event_id` requerido | Sí; listado admin |
| `GET /admin/committees/:committeeId` | — | Sí; edición |
| `POST /admin/committees` | `event_id`, `name`, `code`, `description?`, `sort_order?` | Sí |
| `PATCH /admin/committees/:committeeId` | `name`, `code`, `description`, `sort_order` | Sí; edición |
| `DELETE /admin/committees/:committeeId` | — | No |
| `POST /admin/memberships` | datos de evento, usuario/participante, rol y comité según controlador | No |
| `POST /admin/create-account` | identidad, código, evento, rol y contraseña inicial según controlador | No |

La interfaz administrativa consume la lectura y edición de eventos y comités. El borrado de comités y las altas de membresías o cuentas siguen sin pantalla.

## Respuestas, límites e incertidumbres

- Los controladores devuelven JSON, pero no existe envoltura de error uniforme.
- El body global admite hasta `10mb`; el avatar aplica límite propio de 5 MB decodificados.
- No hay rate limit ni idempotency keys.
- No se publican garantías de paginación, estabilidad del contrato o compatibilidad.
- Para cuerpos exactos de activación y altas administrativas sin cliente, el controlador es la fuente actual.
