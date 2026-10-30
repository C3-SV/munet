# ADR-005 — Autorización administrativa acotada por evento

- **Estado:** aceptada; implementada
- **Fecha de la decisión:** 2026-10-29
- **Reemplaza a:** [ADR-004](ADR-004-autorizacion-administrativa-global.md), que queda superada
- **Resuelve:** [P-01](../07-auditoria/pendientes.md#p-01-modelo-de-autorización-administrativa)

## Contexto

ADR-004 dejó el modelo de autorización administrativa marcado explícitamente
como provisional: `requireAdmin` aceptaba cualquier membresía activa con rol
administrativo en **cualquier** evento, sin verificar que esa membresía
correspondiera al evento sobre el que se operaba. El propio ADR-004 pedía
una decisión de producto antes de presentar ese comportamiento como modelo
definitivo.

## Decisión

Se descarta el acceso administrativo transversal entre eventos. Se adopta el
modelo acotado por evento (alternativa B registrada en ADR-004):

- Cada ruta administrativa que opera sobre un evento existente exige una
  membresía admin activa **de ese evento específico**. Se resuelve en
  `apps/api/src/middleware/auth.middleware.ts` (`requireEventAdmin` +
  resolvers `eventIdFromParam`/`eventIdFromBody`/`eventIdFromQuery`/
  `eventIdFromCommittee`/`eventIdFromMembership`) y se aplica ruta por ruta
  en `apps/api/src/routes/admin.routes.ts`.
- La única excepción legítima es `POST /admin/events` (crear un evento
  nuevo): no existe un evento objetivo previo, así que sigue exigiendo
  `requireAdmin` (alguna membresía admin activa en cualquier evento).
- Para que crear un evento no deje a su creador sin poder administrarlo,
  `createEvent` crea automáticamente una membership admin `ACTIVE` para el
  usuario que lo creó, con reversión (soft delete del evento) si esa
  membership no puede crearse.
- `GET /admin/events` deja de listar todos los eventos; solo devuelve
  aquellos donde el usuario tiene esa membresía admin.
- `requireEventMembership` (sin consumidores aún) perdió el mismo bypass
  transversal, para no reintroducir la misma divergencia cuando se use.

## Alternativas descartadas

- **Mantener el modelo global** (ADR-004 tal cual): se descarta por el
  riesgo de acceso cruzado entre eventos que el propio ADR-004 señalaba.
- **Rol de superadministrador global explícito**: requeriría diseño de
  esquema nuevo (tabla o flag de superadmin) sin que exista hoy; se deja
  fuera de alcance de este sprint. Si el negocio decide que ese rol es
  necesario, debe ser una decisión y un ADR aparte.

## Consecuencias

- Cierra el acceso cruzado entre eventos descrito en
  [D-01](../07-auditoria/discrepancias.md#d-01-autorizaciÃ³n-administrativa-no-acotada-al-evento).
- Quien dependa hoy del acceso global (si lo hay) necesita una membership
  admin propia por cada evento que deba administrar; no hay migración de
  datos automática para esto.
- No se tocó el reconocimiento de rol por texto (`ADMIN`/`COORDINADOR`/
  `ORGANIZADOR`), las RLS (no versionadas), ni se creó ningún catálogo de
  roles definitivo. Sigue siendo una implementación provisional en ese
  sentido, solo que ya no transversal entre eventos.

## Evidencia

`apps/api/src/middleware/auth.middleware.ts`, `apps/api/src/routes/admin.routes.ts`,
`apps/api/src/controllers/admin.controller.ts` (`createEvent`, `listEvents`)
y `docs/SPRINT_1_BACKEND_FE.md`, cambiados el 2026-10-29.
