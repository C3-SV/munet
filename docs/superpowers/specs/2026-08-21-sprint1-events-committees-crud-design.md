# Sprint 1 (Backend): CRUD de eventos y comités + muro automático

Corresponde a las 2 sub-tareas de "Sitio administrativo > Backend" en Sprint 1:
1. Endpoints/lógica para crear y configurar eventos.
2. Endpoints para crear/editar comités + creación automática del muro al registrar un comité nuevo.

## Estado previo

`apps/api/src/controllers/admin.controller.ts` ya tiene `createEvent` y `createCommittee`
(alta únicamente, protegidos con `requireAuth + requireAdmin` desde Sprint 0). No existe
ningún endpoint de admin para listar, ver o editar eventos/comités. No existe ningún código
que cree un `wall` — los muros general/avisos que existen hoy en producción se crearon a
mano fuera de la aplicación.

Tablas relevantes (confirmadas por uso real en `admin.controller.ts`,
`events.controller.ts`, `walls.service.ts`, `docs/MUNET_DOCUMENTACION_TECNICA.md`):

- `events`: `id, name, slug, description, start_date, end_date, status, is_read_only,
  deleted_at, created_by_user_id, updated_by_user_id`. `status` conocido: `ACTIVE`,
  `CLOSED`, `ARCHIVED` (usados hoy en `createCommittee` para bloquear altas).
- `committees`: `id, event_id, name, code, description, sort_order, status, deleted_at,
  created_by_user_id, updated_by_user_id`.
- `walls`: `id, event_id, name, wall_type, committee_id, status, deleted_at`.

No hay acceso a la base de datos real de MUNET desde este entorno (sin credenciales de
Supabase configuradas, y el MCP de Supabase disponible apunta a otra cuenta/proyectos no
relacionados). El diseño asume los campos ya usados en el código existente; no se inventan
columnas nuevas.

## Riesgo conocido: `audit_logs.action_type`

`AuditActionType` en `apps/api/src/utils/audit.logger.ts` es un union type de TypeScript.
Si la columna `audit_logs.action_type` en Postgres es un ENUM (como `dm_message_status_enum`
mencionado en `.env.example`), los 3 valores nuevos de esta tarea (`UPDATE_EVENT`,
`UPDATE_COMMITTEE`, `DELETE_COMMITTEE`) requerirían una migración:

```sql
ALTER TYPE <nombre_del_enum> ADD VALUE IF NOT EXISTS 'UPDATE_EVENT';
ALTER TYPE <nombre_del_enum> ADD VALUE IF NOT EXISTS 'UPDATE_COMMITTEE';
ALTER TYPE <nombre_del_enum> ADD VALUE IF NOT EXISTS 'DELETE_COMMITTEE';
```

`logAudit()` ya envuelve el insert en `try/catch` y solo hace `console.error` si falla —
esto **no bloquea** la operación principal (crear/editar evento o comité sigue funcionando
igual). El único efecto de no migrar el enum es que esos 3 tipos de auditoría no queden
persistidos hasta que se corra la migración. Se documenta como pendiente, no bloquea esta
tarea.

## Diseño

### 1. Eventos

Nuevos endpoints en `admin.controller.ts` / `admin.routes.ts`, todos con
`requireAuth, requireAdmin`:

- **`GET /admin/events`** — lista todos los eventos no eliminados (`deleted_at IS NULL`),
  sin filtrar por membership del actor (vista de admin, no de participante).
- **`GET /admin/events/:eventId`** — detalle de un evento por id. 404 si no existe o está
  eliminado.
- **`PATCH /admin/events/:eventId`** — edita campos parciales: `name`, `slug`,
  `description`, `start_date`, `end_date`, `status`. Reglas:
  - Solo se actualizan los campos presentes explícitamente en el body (mismo patrón
    `hasOwn` que ya usa `updatePublicProfileAsAdmin` en `profiles.controller.ts`).
  - Si se manda `slug`, se valida unicidad excluyendo el propio evento (mismo check que
    `createEvent`, agregando `.neq('id', eventId)`).
  - `status` acepta cualquiera de `ACTIVE | CLOSED | ARCHIVED`; cualquier transición es
    válida, sin máquina de estados (esto es una decisión explícita: no hay reglas de
    negocio que restrinjan pasar de `ARCHIVED` a `ACTIVE`, por ejemplo).
  - Sin endpoint de borrado: `ARCHIVED` cumple el rol de "evento fuera de uso" sin
    necesitar soft-delete adicional.
  - Audita `UPDATE_EVENT` (entity `EVENT`) con outcome `SUCCESS`.

### 2. Comités + muro automático

- **`POST /admin/committees`** (ya existe, se modifica): después de insertar el comité,
  crea automáticamente su `wall` asociado:
  ```
  {
    event_id: <mismo del comité>,
    name: <mismo name del comité>,
    wall_type: 'COMMITTEE',
    committee_id: <id del comité recién creado>,
    status: 'ACTIVE'
  }
  ```
  Si el insert del wall falla, se revierte el comité (soft-delete inmediato, seteando
  `deleted_at`) y se responde `400` con el error del wall — no debe quedar un comité sin
  su muro. Esto se implementa como dos inserts secuenciales (no hay transacciones
  multi-tabla expuestas por el cliente de Supabase usado en el proyecto); el rollback
  manual del comité es el mecanismo de consistencia.

- **`GET /admin/committees?event_id=<uuid>`** — lista comités de un evento para admin, sin
  requerir membership del actor en ese evento (a diferencia de
  `GET /events/:eventId/committees`, que sí lo exige). `event_id` es requerido en query.

- **`GET /admin/committees/:committeeId`** — detalle de un comité por id.

- **`PATCH /admin/committees/:committeeId`** — edita `name`, `code`, `description`,
  `sort_order` (campos parciales, mismo patrón `hasOwn`). Si cambia `name` o `code`, valida
  unicidad dentro del evento excluyendo el propio comité (mismo check que `createCommittee`
  + `.neq('id', committeeId)`). Si cambia `name`, también actualiza `wall.name` del muro
  asociado (`UPDATE walls SET name = <nuevo name> WHERE committee_id = :committeeId`) para
  mantenerlos sincronizados. Audita `UPDATE_COMMITTEE` (entity `COMMITTEE`).

- **`DELETE /admin/committees/:committeeId`** — soft delete del comité (`deleted_at =
  now()`) y de su muro asociado (`walls.deleted_at = now() WHERE committee_id =
  :committeeId`). Ambos updates se ejecutan; si el segundo falla se loguea el error pero no
  se revierte el primero (evitar dejar el comité en un estado ambiguo — soft-delete es
  reversible manualmente si hace falta, a diferencia de la creación). Audita
  `DELETE_COMMITTEE` (entity `COMMITTEE`).

### Fuera de alcance

- No se tocan `posts`, `comments`, `profiles`, `dm` — sin relación con esta tarea.
- No se crean muros general/avisos automáticamente al crear un evento — el roadmap solo
  pide automatizarlo para comités. Los eventos siguen sin muro general/avisos por defecto
  (gap preexistente, no se resuelve aquí).
- No hay UI de frontend en esta tarea — es la parte "Backend" del sprint; "Frontend" y
  "Sitio participantes" son sub-tareas separadas en el tablero.
- No se agrega rate limiting ni tests automatizados (no existe framework de tests en
  `apps/api`, igual que en Sprint 0).

## Verificación

Igual que en Sprint 0: sin framework de tests, verificación manual con `curl` contra el dev
server (requiere `.env` local con credenciales reales de Supabase, que el usuario debe
correr en su máquina):

1. `POST /admin/events` sin cambios de comportamiento previo (ya cubierto por Sprint 0).
2. `GET /admin/events` con token admin → 200 con lista de eventos.
3. `PATCH /admin/events/:id` cambiando `status` a `CLOSED` → 200, y luego
   `POST /admin/committees` sobre ese evento debe seguir devolviendo 400 "no se pueden
   crear comités en evento cerrado" (regla ya existente, no debe romperse).
4. `POST /admin/committees` → 200, y el comité creado debe traer un `wall` asociado
   consultable vía `GET /events/:eventId/committees` (ruta de participantes) sin errores.
5. `PATCH /admin/committees/:id` cambiando `name` → 200, y el `wall.name` debe reflejar el
   cambio (verificable con `GET /admin/committees/:id` o revisando el muro en el feed).
6. `DELETE /admin/committees/:id` → 200, y el comité no debe aparecer más en
   `GET /events/:eventId/committees` ni su muro en `GET /events/:eventId/walls`.
7. Todos los endpoints nuevos devuelven `403` con un token sin membership admin activa
   (mismo criterio de `requireAdmin` de Sprint 0).
