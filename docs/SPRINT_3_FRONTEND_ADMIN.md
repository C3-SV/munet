# Plan frontend admin, Sprint 3 (para Alex)

Backend del Sprint 3 hecho por Christian en `sitio-admin` (C1, C2, S3-01, S3-02, S3-03, S3-04, S3-09 y S3-10). Este documento es el contrato **real** de esos endpoints. Tareas tuyas: **S3-01, S3-02, S3-03 y S3-04 (parte FE)**, más ajustar la pantalla de eventos por los cambios de permisos.

Reglas que no cambian:

- Todo pasa por `apps/web/lib/api/*`. Nada de Supabase directo desde el navegador.
- Toda petición lleva `Authorization: Bearer <token>`.
- La autorización es **por evento** (ADR-005). Un `403` significa que la membresía activa no tiene permiso en ese evento.
- Decisión de arquitectura: **no** se replican los muros en un árbol admin aparte. La vista de moderación reutiliza los componentes del feed (`PostCard`, `PostComments`) y agrega solo lo exclusivo de moderación.

## Lo que cambió en permisos (léelo primero)

| Cambio | Qué significa para ti |
|---|---|
| Solo `ADMIN_TECH` crea eventos | `POST /admin/events` responde `403` a un `ADMIN_MUN`. Oculta o deshabilita el botón "Nuevo evento" si ninguna membresía activa es `ADMIN_TECH`. |
| Crear evento ya funciona (bug P-05) | Ahora crea también los muros General y Avisos. Si falla, no deja nada a medias: puedes reintentar con el mismo slug. |
| Nuevo rol `MODERATOR` | Ve y modera **todos** los muros del evento. Puede borrar y fijar. **No** crea cuentas, no cambia comités, no edita el evento ni publica en Avisos. |
| Rate limiting | Cualquier acción puede responder `429` si se repite demasiado rápido. Muestra el `error` que viene en la respuesta y no reintentes en bucle. |

### El moderador en el panel

Hoy el layout admin solo deja entrar a roles admin (`isAdminRole`). Para el moderador:

1. Permite entrar al panel si la membresía activa es admin **o** `MODERATOR`.
2. Si es `MODERATOR`, en el menú muestra **solo Moderación**. Oculta Eventos, Participantes y Asignaciones.
3. Si un moderador abre a mano otra ruta del panel, redirígelo a Moderación (la API igual le respondería `403`).
## Endpoints nuevos

Todos con `Authorization`. Los de `/admin/moderation` aceptan admin o moderador **del evento**. Errores siempre `{ "error": "texto" }`: `400` validación, `401` sesión, `403` permiso, `404` no existe, `409` conflicto, `429` demasiados intentos, `500` interno.

### Tipos de respuesta

```ts
type Status = 'VISIBLE' | 'HIDDEN' | 'DELETED';

type Wall = {
  id: string;
  event_id: string;
  committee_id: string | null;
  wall_type: 'GENERAL' | 'COMMITTEE' | 'ANNOUNCEMENTS';
  name: string;
  status: 'ACTIVE';
  visible_posts: number;
  pinned_posts: number;
};

type PostState = {
  id: string;
  event_id: string;
  wall_id: string;
  author_membership_id: string;
  status: Status;
  deleted_at: string | null;
  deleted_by_membership_uuid: string | null;
  deleted_by_membership_id: 'AUTHOR' | 'ADMIN' | null; // tipo de actor, no un id
  is_pinned: boolean;
  pinned_at: string | null;
  pinned_by_membership_id: string | null;
};

type CommentState = {
  id: string;
  event_id: string;
  post_id: string;
  author_membership_id: string;
  status: Status;
  deleted_at: string | null;
  deleted_by_membership_uuid: string | null;
  deleted_by_actor_type: 'AUTHOR' | 'ADMIN' | null;
};

type Detail = {
  content: string;            // en moderación se ve el texto original aunque esté borrado
  created_at: string;
  updated_at: string;
  author: {
    membership_id: string;
    name: string | null;
    alias: string | null;
    participant_code: string | null;
    delegation_code: string | null;
    committee: { id: string; name: string; code: string | null } | null;
  };
  deleted_by_name: string | null;
  deletion_reason: string | null; // puede venir null
};

type ModerationPost = PostState & Detail & { post_type: 'TEXT' | 'LINK' | 'POLL'; title: string | null };
type ModerationComment = CommentState & Detail & { parent_comment_id: string | null };
```

### S3-01 · Navegar muros

| Endpoint | Request | Respuesta `200` |
|---|---|---|
| `GET /admin/moderation/walls` | `?event_id=<uuid>` | `{ walls: Wall[] }` |
| `GET /admin/moderation/posts` | `?wall_id=<uuid>&status=VISIBLE&page=1&limit=20` | `{ posts: ModerationPost[], pagination: { page, limit, total, total_pages } }` |
| `GET /admin/moderation/posts/:postId/comments` | `?status=VISIBLE` (opcional) | `{ comments: ModerationComment[] }` |

- `status`: `VISIBLE` (por defecto), `DELETED` o `ALL`. `ALL` puede traer también `HIDDEN`.
- `limit` por defecto 20, máximo 100.
- Posts: fijados primero, luego del más nuevo al más viejo. Comentarios: del más viejo al más nuevo, todos de una vez.

### S3-02 · Borrar con motivo

| Endpoint | Body | Respuesta `200` |
|---|---|---|
| `POST /admin/moderation/posts/:postId/delete` | `{ "reason": "texto" }` | `{ post: PostState }` |
| `POST /admin/moderation/comments/:commentId/delete` | `{ "reason": "texto" }` | `{ comment: CommentState }` |

- `reason` obligatorio, de 3 a 500 caracteres (el servidor quita espacios a los lados).
- `409` si ya estaba borrado o si cambió mientras tanto ("vuelve a cargarlo").
- Borrar un post fijado lo desfija.
- **La respuesta trae solo el estado**, sin autor ni contenido. Combínala con el registro que ya tienes o recarga la lista.

### S3-03 · Fijar y desfijar

| Endpoint | Body | Respuesta `200` |
|---|---|---|
| `POST /admin/moderation/posts/:postId/pin` | ninguno | `{ post: PostState }` |
| `POST /admin/moderation/posts/:postId/unpin` | ninguno | `{ post: PostState }` |

- Solo posts `VISIBLE` (si no, `409`).
- Máximo **3 fijados por muro**. El cuarto responde `409` con `"El muro ya tiene 3 posts fijados. Desfija uno primero."`. Muestra ese texto tal cual.
- Fijar uno ya fijado (o desfijar uno que no lo está) responde `200` sin cambios.

### S3-04 · Dar o quitar moderador

| Endpoint | Body | Quién |
|---|---|---|
| `PATCH /admin/participants/:membershipId/role` | `{ "role": "PARTICIPANT" \| "MODERATOR", "reason": "opcional" }` | Solo admin del evento |

- `400` si ya tiene ese rol o el rol no es válido. No se puede cambiar el rol de un admin ni asignar roles admin por aquí.
- El `PATCH /admin/participants/:membershipId` normal tampoco acepta subir a admin.

### Feed de participantes (lo comparte con Fiore)

Cada post del feed trae ahora `isPinned` y `pinnedAt`, y los fijados llegan primero. Muestra una marca "Fijado" en `PostCard`; coordina con Fiore porque ese componente es compartido.
## Qué construir

### Pantalla de moderación (`/admin/events/[eventId]/moderation`)

Reemplaza el marcador actual de `/admin/moderation`.

1. **Selector de muro** con `GET /admin/moderation/walls`: General, Avisos y comités, cada uno con sus contadores (`visible_posts`, `pinned_posts`).
2. **Pestañas** Visibles / Eliminados / Todos, que cambian `status`.
3. **Lista de posts** paginada, reutilizando `PostCard`. Cada post muestra autor (nombre, alias, código #, comité), fecha y la marca "Fijado".
4. **Acciones por post:** Fijar o Desfijar y Eliminar. Deshabilita "Fijar" si el muro ya tiene 3 fijados (`pinned_posts >= 3`), aunque la API igual lo valida.
5. **Comentarios** al expandir el post (`GET .../comments`), cada uno con su botón Eliminar.
6. **Eliminados:** en la pestaña Eliminados muestra el texto original atenuado, quién lo borró (`deleted_by_name`), cuándo y el motivo (`deletion_reason`, o "Sin motivo registrado" si es `null`).

### Modal de eliminar

- Campo de motivo **obligatorio**, con contador de 3 a 500 caracteres y el botón deshabilitado si no cumple.
- Texto de confirmación: "El contenido dejará de verse para los participantes. Quedará registrado quién lo eliminó y por qué."
- Tras `200`: actualiza el elemento con el estado que vuelve y refresca los contadores del muro.

### Moderadores en Participantes

- En el menú de acciones de cada fila: "Hacer moderador" / "Quitar moderador" (solo si la fila no es admin), con confirmación y motivo opcional.
- Filtro por rol: agrega `MODERATOR`.

### Eventos

- Botón "Nuevo evento" solo si alguna membresía activa del usuario es `ADMIN_TECH`.
- Si `POST /admin/events` responde `403`, muestra "Solo el equipo técnico puede crear eventos".
- Vuelve a probar el alta de evento: con el arreglo de P-05 ya debería funcionar y el evento sale con sus muros General y Avisos.

### Manejo de `429`

Muestra el `error` de la respuesta en un toast y deshabilita el botón unos segundos. No reintentes automáticamente.

## Funciones sugeridas en `lib/api/moderation.ts`

```ts
listModerationWalls(eventId)
listModerationPosts(wallId, { status, page, limit })
listModerationComments(postId, { status })
deleteModerationPost(postId, reason)
deleteModerationComment(commentId, reason)
pinPost(postId)
unpinPost(postId)
```

Y en `lib/api/participants.ts`: `changeParticipantRole(membershipId, role, reason?)`.

## Cómo probar

1. Usa el evento de pruebas **"MUN ESEN 2026"**. El front local apunta a la API de producción: todo lo que hagas se guarda en la base real.
2. Fija 3 posts en un muro e intenta un cuarto: debe salir el `409`.
3. Elimina un post con motivo y revisa que aparezca en Eliminados con quién y por qué.
4. Haz moderador a una cuenta de prueba, entra con ella y comprueba que solo ve Moderación en el panel y que puede moderar comités que no son el suyo.
5. Con la cuenta moderadora, abre a mano `/admin/events/.../participants`: debe redirigirte o mostrar el error de permisos.
6. No borres cuentas de prueba: suspéndelas.

## Pendientes que no son tuyos

- **Migración 002** sin aplicar: los participantes nuevos siguen saliendo "Sin código #".
- **Evento huérfano** de tu prueba del 17 nov: hay que borrarlo en la base (Fiore o Rober).
- **`ADMIN_TECH`**: hay que confirmar quién lo tiene; si nadie lo tiene, nadie puede crear eventos.
- El moderador todavía **no** puede borrar desde el feed de participantes (esa ruta es del equipo de Fiore); desde el panel sí.

Dudas del contrato: Christian.