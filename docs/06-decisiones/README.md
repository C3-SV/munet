# Decisiones de arquitectura

Los ADR documentan decisiones significativas con evidencia. No se inventan motivos históricos ausentes. Una decisión futura debe crear un ADR nuevo o marcar otro como reemplazado, no reescribir silenciosamente el pasado.

| ADR | Decisión | Estado |
|---|---|---|
| [ADR-001](ADR-001-monorepo-y-aplicaciones.md) | Monorepo con aplicaciones separadas y paquetes compartidos | Aceptada / implementada |
| [ADR-002](ADR-002-api-como-frontera-de-datos.md) | API como frontera de datos, salvo Realtime | Aceptada / implementada parcialmente |
| [ADR-003](ADR-003-identidad-por-membresia.md) | Identidad y permisos por membresía/evento | Aceptada / implementada parcialmente |
| [ADR-004](ADR-004-autorizacion-administrativa-global.md) | Autorización admin global como solución provisional | Reemplazada por ADR-005 |
| [ADR-005](ADR-005-autorizacion-administrativa-por-evento.md) | Autorización admin acotada por evento | Aceptada / implementada |

Decisiones abiertas no elevadas a ADR se mantienen en [pendientes](../07-auditoria/pendientes.md), porque falta una resolución aprobada.
