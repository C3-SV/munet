# ADR-004 — Autorización administrativa global provisional

- **Estado:** reemplazada por [ADR-005](ADR-005-autorizacion-administrativa-por-evento.md) (2026-10-29)
- **Fecha de origen documentada:** 2026-08-15
- **Revisión:** 2026-10-23

## Contexto

Las rutas de alta administrativa inicialmente solo exigían autenticación. La creación de un evento no aporta un evento existente contra el cual autorizar. El diseño de `docs/superpowers/specs/2026-08-15-admin-endpoints-authz-design.md` eligió comprobar si el usuario tiene alguna membresía administrativa activa.

## Decisión implementada

`requireAdmin` acepta una membresía activa cuyo rol contenga `ADMIN`, `COORDINADOR` u `ORGANIZADOR`, sin vincularla al evento objetivo. Se aplica a los cuatro POST de `/admin`.

## Alternativas registradas

- Autorizar solo contra la membresía activa/evento objetivo.
- Introducir un rol global explícito o una lista separada de superadministradores.
- Separar creación global de eventos de administración interna de un evento.

Los documentos disponibles no registran aprobación del negocio para una de estas alternativas.

## Consecuencias

- Cierra el acceso de usuarios meramente autenticados.
- Permite potencialmente que un admin de un evento cree recursos en otro evento conocido.
- Difiere del layout web, que exige que la membresía seleccionada sea admin.
- Contradice el principio histórico de aislamiento si no existe un rol global deliberado.

## Resolución

Resuelto el 2026-10-29 por [ADR-005](ADR-005-autorizacion-administrativa-por-evento.md): se descarta el acceso global y se acota la autorización al evento objetivo, salvo la creación de un evento nuevo. Véase también [P-01](../07-auditoria/pendientes.md#p-01-modelo-de-autorización-administrativa).

## Evidencia

`apps/api/src/middleware/auth.middleware.ts`, `apps/api/src/routes/admin.routes.ts` y los artefactos de `docs/superpowers/` fechados 2026-08-15.
