# Plan backend admin, Sprint 3 (Christian + Codex)

Rama: `sitio-admin` (con `main` mezclado localmente el 2026-11-18). **Sin commits ni push** hasta que Christian lo diga.

## Decisiones tomadas (2026-11-18)

| Tema | Decisión |
|---|---|
| Crear eventos | Solo `ADMIN_TECH` activo (superadmin). Los `ADMIN_MUN` solo administran sus eventos. Sin migración. |
| Moderador | Rol `MODERATOR` por evento. Ve y modera **todos** los muros del evento (General, Avisos, todos los comités). Borra y fija. **No** crea cuentas, no cambia comités, no edita el evento ni perfiles. |
| Fijados | Máximo **3** por muro. Con 3 fijados, fijar otro responde `409`. |
| Motivo al borrar | Obligatorio para admin/moderador desde la moderación. Se guarda en `audit_logs.reason` (sin migración). |
| Migraciones | Nada de este sprint requiere migración. La 002 sigue pendiente de permisos. |

## Bloque 0 · Correcciones (antes del sprint)

### C1 · P-05 `POST /admin/events` falla siempre
- La membership del creador usa `role: 'ADMIN'`, que no existe en `membership_role_enum` (`PARTICIPANT, MODERATOR, ADMIN_MUN, ADMIN_TECH`). Usar `ADMIN_TECH` (el creador ahora siempre es ADMIN_TECH, ver C2).
- Rollback: hoy marca `deleted_at` y el slug queda ocupado. Como el evento recién creado no tiene hijos, hacer **borrado físico** del evento (y de lo que se haya creado) si un paso falla.
- Crear también los muros **GENERAL** y **ANNOUNCEMENTS** del evento (hoy no se crean). Reusar `walls.service`/la lógica que ya usa `createCommittee` para el muro de comité. Si falla, rollback completo.
- Pruebas: enum correcto, rollback físico, muros creados, auditoría solo en éxito.
- Fuera del código: el evento huérfano que dejó la prueba de Alex lo limpia quien tenga acceso a la base (Fiore/Rober).

### C2 · Superadmin para crear eventos
- `requireSuperAdmin` en `auth.middleware.ts`: alguna membership `ACTIVE` con rol exacto `ADMIN_TECH`.
- `POST /admin/events` pasa de `requireAdmin` a `requireSuperAdmin`. `GET /admin/events` sigue igual.
- Actualizar la prueba estática de rutas (`admin.authz.test.cjs`).
- **Riesgo:** si nadie tiene `ADMIN_TECH`, nadie crea eventos. Confirmar en la base qué rol tienen Christian, Alex y Fiore.

## Bloque 1 · Base de roles y auditoría

### S3-04 · Moderadores (backend)
- `rbac.utils.ts`: `isModeratorRole` por valor exacto `MODERATOR`; `canModerateRole(role)` = admin o moderador; `isSuperAdminRole(role)` = `ADMIN_TECH`.
- `canAccessCommitteeWall`: moderador ve todos los muros del evento (igual que admin). Revisar `mapWallForMembership` y `canPublishInAnnouncements` (el moderador **no** publica en Avisos).
- `requireEventModerator(resolver)`: membership `ACTIVE` del evento con rol admin o moderador. Deja `req.auth.currentMembership`.
- `PATCH /admin/participants/:membershipId/role` `{ role: 'PARTICIPANT' | 'MODERATOR', reason? }` con `requireEventAdmin`. No permite tocar memberships admin ni asignar roles admin. Auditoría `CHANGE_ROLE`.
- `PATCH /admin/participants/:membershipId` (existente): validar `role` contra el enum y prohibir subir a admin por esa vía.
- Pruebas: moderador 200 en moderación, 403 en `create-account`, `committee`, `role`, `events`.

### S3-10 · Auditoría con actor y afectado (parte admin)
- `logAudit` acepta `targetMembershipId` y `targetUserId` (columnas `target_membership_id`, `target_user_id` ya existen en `audit_logs`).
- Llenarlos en: crear cuenta, importar CSV, editar, suspender, reactivar, reiniciar contraseña, cambiar comité, cambiar rol, borrar post/comentario, fijar/desfijar.
- `actor_membership_id` y `actor_role` desde `req.auth.currentMembership` en todas las acciones admin.
- Tipos nuevos: `CHANGE_ROLE`, `PIN_POST`, `UNPIN_POST`, `MODERATE_DELETE_POST`, `MODERATE_DELETE_COMMENT`.
## Bloque 2 · Moderación (`/admin/moderation`)

Todas con `requireAuth` + `requireEventModerator(resolver)`. Resolvers nuevos: `eventIdFromWall`, `eventIdFromPost`, `eventIdFromComment` (404 si no existe). Controlador nuevo `admin-moderation.controller.ts`.

### S3-01 · Navegar todos los muros
- `GET /admin/moderation/walls?event_id=` → muros `ACTIVE` del evento (General, Avisos, comités) con `visible_posts` y `pinned_posts`.
- `GET /admin/moderation/posts?wall_id=&status=VISIBLE|DELETED|ALL&page=&limit=` → posts del muro con autor (nombre, alias, código #, comité), `is_pinned`, `pinned_at`, estado, y si está borrado: quién (`deleted_by_membership_uuid` + nombre), cuándo y el motivo (de `audit_logs`). Orden: fijados primero, luego más nuevos. Paginado.
- `GET /admin/moderation/posts/:postId/comments?status=VISIBLE|DELETED|ALL` → comentarios con los mismos datos.

### S3-02 · Borrar con motivo
- `POST /admin/moderation/posts/:postId/delete` `{ reason }` y `POST /admin/moderation/comments/:commentId/delete` `{ reason }`.
- `reason` obligatorio, 3 a 500 caracteres.
- Mismo borrado lógico que el sitio de participantes: `status = 'DELETED'`, `deleted_at`, `deleted_by_membership_id = 'ADMIN'` (tipo de actor), `deleted_by_membership_uuid = actor` (S1-18). Al borrar un post fijado, se desfija.
- 409 si ya estaba borrado. Auditoría con actor, afectado (autor) y motivo.
- La ruta compartida `DELETE /posts/:postId` no se toca (es del equipo de participantes). Avisar a Fiore: el moderador **no** puede borrar desde el feed hasta que esa ruta use `canModerateRole`; desde el panel sí.

### S3-03 · Fijar y desfijar
- `POST /admin/moderation/posts/:postId/pin` y `/unpin`.
- Solo posts `VISIBLE`. Máximo 3 fijados por muro (`409` con mensaje claro). Idempotente: fijar uno ya fijado responde 200 sin cambios.
- Llena `is_pinned`, `pinned_at`, `pinned_by_membership_id`. Auditoría `PIN_POST` / `UNPIN_POST`.
- **Feed (compartido, cambio mínimo):** `getPostsByWall` ordena por `is_pinned desc, pinned_at desc, created_at desc`; `POST_SELECT` y `mapPost` exponen `isPinned` y `pinnedAt`. Avisar a Fiore y Susana.

## Bloque 3 · Opcional si da tiempo

- **S3-09 rate limiting** (tarea Ambos, solo backend): `express-rate-limit` en login, posts, comentarios y DMs con 429. Requiere dependencia nueva: confirmar con Christian antes.

## Reparto

| Quién | Qué |
|---|---|
| Codex, tanda 1 | Bloque 0 + Bloque 1 (middleware, rbac, rol, auditoría) con pruebas |
| Claude | Revisa el diff de la tanda 1 |
| Codex, tanda 2 | Bloque 2 (moderación + orden del feed) con pruebas |
| Claude | Revisión final, suite completa, `docs/SPRINT_3_FRONTEND_ADMIN.md` para Alex |

## Verificación

- `apps/api/node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json` (TypeScript 6 de la API; el de la raíz es 5.9 y no entiende `ignoreDeprecations: "6.0"`).
- Pruebas con lista explícita de archivos (`node --test <archivos>`). Con Node 20 los `.mjs` que importan `.ts` (`cors`, `profile.utils`, `rbac.utils`) fallan por entorno; necesitan Node 22+.
- Prueba contra Supabase real: pendiente del `.env` de la API.