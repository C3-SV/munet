# Pendientes y decisiones abiertas

Orden propuesto para el siguiente incremento funcional de MUNET. Las decisiones de negocio siguen abiertas donde se indican.

| Prioridad | Trabajo | Resultado verificable |
|---|---|---|
| 1 | Preparar una base aislada reproducible y completar el alta de evento. Alinear el rol automático con el enum vigente y garantizar los muros general y anuncios junto con el acceso del creador. | Un organizador crea un evento, vuelve a seleccionarlo y ve los muros. Un segundo evento sirve para comprobar límites de acceso. |
| 2 | Completar el alta, activación y mantenimiento de cuentas. Resolver la unicidad o desambiguación del código de ingreso entre eventos, alinear los roles de los formularios y manejar la reactivación de una cuenta que nunca se activó. | El organizador entrega credenciales. El delegado activa, inicia sesión y recupera acceso con ayuda de administración. Las colisiones tienen una resolución clara. |
| 3 | Verificar y completar código de delegación, CSV y asignaciones. Comprobar migraciones 001/002 en pruebas, habilitar una recuperación de códigos faltantes y conectar plantilla, previsualización, confirmación y resultados al panel. Definir si se necesita asignación masiva. | Un lote con filas válidas y fallidas devuelve resultados y credenciales de las altas. Cada delegado ve su código y su comité. |
| 4 | Completar el ciclo del evento. Definir borrador, cierre, archivo y reapertura. Aplicar la regla de solo lectura de manera uniforme y decidir si el borrado de comités se ofrece en el panel. | El evento cerrado sigue visible a quien corresponda y se rechazan las escrituras definidas por la regla. |
| 5 | Validar el recorrido de un evento de ensayo. Probar delegados en comités distintos, anuncios, votos, comentarios, perfiles, chat y actualización entre sesiones. | El equipo ejecuta el [recorrido de validación](../04-desarrollo/pruebas-y-validacion.md#recorrido-en-un-entorno-aislado) con datos ficticios y registra resultados. |
| 6 | Definir el mínimo de moderación para MUN ESEN. Completar la pantalla y acordar responsabilidades de mesa, motivos y acciones sobre contenido y cuentas. | El equipo identifica y resuelve un caso de moderación con los permisos y la trazabilidad acordados. |

## Decisiones de producto

- Definir recuperación autónoma y verificación de identidad, así como efectos de suspensión sobre sesiones y Realtime.
- Acordar la necesidad de reportes, notificaciones, adjuntos, fijado, reapertura de encuestas y exportación masiva.
- Acordar si se requieren supervisión de DM, bloqueo, expulsión y consulta de auditoría. Definir permisos, motivo, retención y privacidad antes de implementarlos.
### P-01 Modelo de autorización administrativa

La administración por evento se decidió el 29 de octubre de 2026 en [ADR-005](../06-decisiones/ADR-005-autorizacion-administrativa-por-evento.md). Un rol transversal, si se pide, requerirá una decisión nueva.

## Trabajo técnico y operativo posterior

Completitud del DDL, políticas RLS y Storage, transacciones e idempotencia, auditoría y logging, paginación, contratos compartidos, cobertura de CI, accesibilidad, rendimiento, observabilidad, respaldos y preparación de producción. Los objetivos históricos se conservan en [requerimientos](../01-producto/requerimientos.md).

## Defectos detectados en la prueba manual del Sprint 2 (2026-11-17)

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
