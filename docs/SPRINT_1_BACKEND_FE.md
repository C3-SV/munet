# Contrato backend para Sprint 1 del frontend

Todos estos endpoints requieren sesión y rol administrador, mediante
`requireAuth` y `requireAdmin`. El rol administrador actual permite administrar
catálogos de eventos sin exigir una membership en cada evento consultado.

| Método y ruta | Respuesta |
| --- | --- |
| `GET /admin/events?page=1&limit=20` | `{ events, pagination: { page, limit, total, total_pages } }` |
| `GET /admin/events/:eventId` | `{ event }` |
| `POST /admin/events` | `{ message, event }` |
| `PATCH /admin/events/:eventId` | `{ message, event }` |
| `GET /admin/committees?event_id=<id>` | `{ committees }` |
| `GET /admin/committees/:committeeId` | `{ committee }` |
| `POST /admin/committees` | `{ message, committee, wall }` |
| `PATCH /admin/committees/:committeeId` | `{ message, committee }` |

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

La auditoría registra las operaciones exitosas. Sus errores se registran en el
servidor; no bloquean la operación principal. Si `audit_logs.action_type` usa un
ENUM, la base debe admitir `UPDATE_EVENT` y `UPDATE_COMMITTEE`, como indica el
diseño existente en `docs/superpowers/specs/2026-08-21-sprint1-events-committees-crud-design.md`.

Verificación local:

```powershell
node node_modules/typescript/bin/tsc --project apps/api/tsconfig.json --noEmit
node --test apps/api/src/utils/admin.validation.test.mjs apps/api/src/controllers/admin.controller.test.cjs
```

Las pruebas usan Supabase simulado: no comprueban constraints ni datos de la
base real. La verificación de extremo a extremo requiere el servidor conectado
a Supabase y tokens reales de administrador y participante.
