# Contrato backend para Sprint 1 del frontend

Todos estos endpoints requieren sesión (`requireAuth`). La autorización ya NO
es global: resuelve el ADR-004/P-01 acotando cada ruta a la membership admin
activa **del evento sobre el que se opera** (`requireEventAdmin`), salvo
`POST /admin/events` (crear un evento nuevo), que no tiene evento objetivo y
sigue exigiendo solo alguna membership admin activa en cualquier evento
(`requireAdmin`). Al crear un evento, el backend crea automáticamente una
membership admin ACTIVA para quien lo creó, para que no quede sin poder
administrarlo. `GET /admin/events` solo lista los eventos donde el usuario
tiene esa membership.

| Método y ruta | Respuesta |
| --- | --- |
| `GET /admin/events?page=1&limit=20` | `{ events, pagination: { page, limit, total, total_pages } }` (solo eventos administrables por el usuario) |
| `GET /admin/events/:eventId` | `{ event }` |
| `POST /admin/events` | `{ message, event }` |
| `PATCH /admin/events/:eventId` | `{ message, event }` |
| `GET /admin/committees?event_id=<id>` | `{ committees }` |
| `GET /admin/committees/:committeeId` | `{ committee }` |
| `POST /admin/committees` | `{ message, committee, wall }` |
| `PATCH /admin/committees/:committeeId` | `{ message, committee }` |
| `GET /admin/participants?event_id=<id>&committee_id=&role=&status=&page=&limit=` | `{ participants, pagination }` |
| `GET /admin/participants/:membershipId` | `{ participant }` (membership + perfil) |
| `PATCH /admin/participants/:membershipId` | `{ message }` |
| `POST /admin/participants/:membershipId/suspend` (`{ reason }`) | `{ message, membership }` |
| `POST /admin/participants/:membershipId/reactivate` (`{ reason }`) | `{ message, membership }` |
| `POST /admin/participants/:membershipId/reset-password` | `{ message, temporary_password }` |
| `POST /admin/create-account` | `{ message, user, membership, profile, initial_password }` (el servidor genera la contraseña; ya no se envía en el body) |

La lista de eventos usa página 1 y límite 20 por defecto; límite máximo 100.
El frontend debe recorrer las páginas para mostrar todos los eventos.
Las listas y detalles excluyen registros eliminados lógicamente.

Para el panel administrativo usar `GET /admin/committees?event_id=...`;
`GET /events/:eventId/committees` exige pertenencia al evento y está destinado
a participantes. El ID del evento lo envía el frontend desde su contexto activo.

Evento: creación requiere `name` y `slug`. Edición admite `name`, `slug`,
`description`, `start_date`, `end_date` y `status` (`ACTIVE`, `CLOSED`, `ARCHIVED`).
Las fechas usan `YYYY-MM-DD`; descripción y fechas admiten `null` para borrar
su valor. Al editar una sola fecha también se valida contra la otra fecha guardada.

Comité: creación requiere `event_id`, `name`, `code`; admite `description` y
`sort_order` (entero, por defecto 0). Edición admite `name`, `code`, `description`
y `sort_order`. Los PATCH conservan campos omitidos y rechazan cuerpos sin
campos editables. Nombre, slug y código requeridos deben ser textos no vacíos.

Los duplicados devuelven 400 con `{ error }`; detalles inexistentes, 404.
Los errores de consulta no se confunden con registros inexistentes.
Crear un comité crea su muro automáticamente y revierte mediante soft delete
si falla el muro. Si también falla esa reversión, responde 500 y registra el error.
Renombrar un comité sincroniza el muro: si falla la sincronización, devuelve 500
indicando que el comité ya se actualizó y que se debe reintentar guardar.
Estas operaciones usan llamadas secuenciales a Supabase, sin transacción conjunta.

Participante: edición admite `role`, `committee_id`, `delegation_name`,
`institution_name`, `first_name`, `last_name`, `display_name` y `bio`.
`event_id` y `participant_code` son inmutables (RN-03) y se ignoran si vienen
en el body. El PATCH rechaza cuerpos sin ningún campo editable (400).

Suspender/reactivar exigen `reason` no vacío en el body (RN-18); sin él,
400. Suspender una cuenta ya suspendida, o reactivar una que no lo está,
también es 400. El estado de cuenta soportado hoy es solo
`PENDING_ACTIVATION` / `ACTIVE` / `SUSPENDED`: no se implementó el resto del
ciclo de RN-05 (`BLOQUEADA_SEGURIDAD`, `EXPULSADA`), que queda fuera de
alcance de este sprint.

Restablecer contraseña devuelve `temporary_password` en texto plano una sola
vez, igual que `create-account`. Si la cuenta está `PENDING_ACTIVATION`,
regenera `initial_password_hash` (contraseña de un solo uso para activar).
Si ya está `ACTIVE`, la autenticación real vive en Supabase Auth (ver
`auth.controller`), así que actualiza la contraseña allá vía
`supabaseAdmin.auth.admin.updateUserById`; esa rama no tiene prueba unitaria
porque el harness actual solo mockea `.from(...)`, no `.auth.admin`. No se
puede restablecer la contraseña de una cuenta `SUSPENDED` (400); hay que
reactivarla primero.

La auditoría registra las operaciones exitosas. Sus errores se registran en el
servidor; no bloquean la operación principal. Si `audit_logs.action_type` usa un
ENUM, la base debe admitir `UPDATE_EVENT`, `UPDATE_COMMITTEE`,
`UPDATE_PARTICIPANT`, `SUSPEND_ACCOUNT`, `REACTIVATE_ACCOUNT` y
`RESET_PASSWORD`, como indica el diseño existente en
`docs/superpowers/specs/2026-08-21-sprint1-events-committees-crud-design.md`.

Verificación local:

```powershell
node node_modules/typescript/bin/tsc --project apps/api/tsconfig.json --noEmit
node --test apps/api/src/utils/admin.validation.test.mjs apps/api/src/controllers/admin.controller.test.cjs
```

Las pruebas usan Supabase simulado: no comprueban constraints ni datos de la
base real. La verificación de extremo a extremo requiere el servidor conectado
a Supabase y tokens reales de administrador y participante.
