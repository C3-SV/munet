# Pendientes y decisiones abiertas

Los ítems requieren decisión, evidencia externa o implementación futura. No son cambios ejecutados por esta auditoría.

## Prioridad crítica

### P-01 — Modelo de autorización administrativa (resuelto 2026-10-29)

Se decidió separar la capacidad de crear un evento (global) de administrar uno existente (acotado al evento); no se introdujo un rol de superadministrador explícito. Ver [ADR-005](../06-decisiones/ADR-005-autorizacion-administrativa-por-evento.md). Sigue abierto si el negocio quiere en el futuro un rol de superadministrador global separado; eso sería una decisión y un ADR nuevos, no una reapertura de este punto.

### P-02 — Esquema y seguridad de datos

Versionar DDL, migraciones, enums, índices, constraints, triggers, RLS y Storage. Confirmar aislamiento con pruebas negativas.

### P-03 — Datos sensibles en logs

Los logs de autenticación del frontend fueron retirados. Falta definir una política de logging y revisar los registros del backend.

### P-04 — Auditoría confiable

Decidir si acciones críticas deben fallar cuando no puede registrarse la auditoría; definir consulta, retención y acceso.

### P-05 — `POST /admin/events` falla al crear la membresía admin del creador (para Christian)

Detectado el 2026-11-17 en la prueba manual del frontend admin (Sprint 2). Es un defecto de backend; el frontend solo envía `name`, `slug`, `description`, `start_date` y `end_date`.

- `createEvent` (`apps/api/src/controllers/admin.controller.ts`) inserta la membresía del creador con `role: 'ADMIN'`, pero `membership_role_enum` no acepta ese valor. Respuesta: `No se pudo otorgar acceso administrativo sobre el evento: invalid input value for enum membership_role_enum: "ADMIN"`. El valor correcto probablemente sea `ADMIN_MUN` (no verificado: el enum no está versionado, ver P-02). El código existe desde el commit `27a6932`.
- Tras el fallo, el evento quedó en la base. Un reintento con el mismo slug respondió "El slug ya existe", lo que indica que el rollback por soft-delete (`deleted_at`) no se aplicó. Revisar ese camino y limpiar el evento huérfano (sin membresía admin, nadie puede administrarlo).
- Impacto: hoy no se puede crear ningún evento desde el panel.

### P-06 — Código # no se asigna al crear participantes (para Christian / Fiore)

Detectado el 2026-11-17 en la prueba manual del alta individual (Sprint 2). Es un tema de backend y base de datos; el frontend solo muestra los `warnings` y "Sin código" cuando `delegation_code` es `null`, como indica el contrato.

- Al crear una cuenta, la API llama a la función SQL `assign_delegation_code` (`apps/api/src/services/participant-account.service.ts`). Si falla, la cuenta se conserva y se devuelve el aviso "La cuenta se creo pero no se pudo asignar el codigo #. Se puede reintentar despues." El mismo camino aplica a la importación CSV y a `POST /admin/memberships`.
- Causa probable (no confirmada): la migración `supabase/migrations/002_codigo_delegacion.sql` sigue sin aplicarse, así que la función y la tabla `event_delegation_counters` no existen. El error exacto está en el log de la API: `No se pudo asignar el codigo de delegacion <membershipId> <error>`.
- Acción: revisar y aplicar la 002 siguiendo los pasos de su cabecera (PR, aviso a Rober, nadie importando en ese momento, verificación final). Su backfill asignará código a las cuentas ya creadas sin él, incluidas las de pruebas manuales.
- Impacto: mientras tanto, todo participante nuevo queda con "Sin código" y la columna Código # de la tabla aparece vacía.

## Producto y reglas

- ¿Quién puede supervisar DM y bajo qué causa/consentimiento?
- ¿Se puede reabrir una encuesta cerrada?
- ¿Cómo se deduplican reportes y qué estados tienen?
- ¿Cómo se recupera una cuenta o contraseña?
- ¿Qué implica suspender una cuenta en sesiones, contenido y chat?
- ¿Puede desactivarse un evento y cómo difiere de `CLOSED`?
- ¿Cuál es el alcance final del panel administrativo?
- ¿Reportes y notificaciones siguen aprobados o solo postergados?
- ¿“código de participante” identifica login globalmente o requiere evento?
- Resolver contradicciones históricas sobre adjuntos y notificaciones.

## Panel administrativo

El roadmap reciente se conserva como **propuesta**, no como compromiso completado:

| Tramo | Intención registrada | Estado observado |
|---|---|---|
| Sprint 0 | Base visual admin y protección de endpoints | Implementado parcialmente |
| Sprint 1 | UI/backend de eventos y comités; muro automático | Parcial; listado/configuración de eventos y listado/alta/edición de comités; automatismo de muro no demostrado |
| Sprint 2 | Participantes, CSV y restablecimiento | Implementado en backend y frontend; verificación E2E y de accesibilidad pendiente |
| Sprint 3 | Asignaciones, suspensión, moderadores y archivos | No implementado |
| Sprint 4 | Moderación, fijado, supervisión y bloqueo de conversación | No implementado |
| Cierre | Pruebas, auditoría con UUID, retirar logs, alinear DB y rate limits | No implementado o no demostrado |

Participantes ya cuenta con listado con búsqueda, alta, importación CSV, alias, código #, cambio de comité, edición, suspensión/reactivación y restablecimiento anidados por evento. Asignaciones y moderación siguen como marcadores; la validación de accesibilidad y de extremo a extremo queda pendiente.

## Calidad técnica

- Incorporar API a build/lint/typecheck/test.
- Contratos compartidos u OpenAPI y validación de schemas.
- Transacciones e idempotencia en altas compuestas.
- Paginación de feeds, participantes, conversaciones y mensajes.
- Rate limiting, request ID, métricas y alertas.
- Pruebas unitarias, integración, autorización y E2E.
- Alinear nombres/enum de borrado y unicidad de conversaciones/votos.

## Operaciones y cumplimiento

- Ambientes, dominios y responsables de despliegue.
- CI/CD, rollback y health checks.
- Backups, RTO/RPO, retención y borrado de datos.
- Política de privacidad y tratamiento de perfiles/mensajes.
- Navegadores, rendimiento (las cifras históricas 250/300 y 500/800 son contradictorias) y accesibilidad.
