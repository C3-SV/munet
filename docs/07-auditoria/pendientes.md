# Pendientes y decisiones abiertas

Orden propuesto para el siguiente incremento funcional de MUNET. Las decisiones de negocio siguen abiertas donde se indican.

El [plan del equipo web](../04-desarrollo/plan-web/README.md) detalla la secuencia para participantes e integraciones y las entregas que requiere del equipo admin.

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

## Pendientes del Sprint 3 (frontend admin)

- Marca «Fijado» en `PostCard` y mapeo de `isPinned`/`pinnedAt` del feed: componente compartido, lo toma el equipo de Fiore.
- `rbac.utils.test.mjs` («un moderador no accede a comités ajenos solo por su rol») falla porque `canAccessCommitteeWall` deja pasar a `MODERATOR` según el contrato del Sprint 3. Debe alinearlo Christian (prueba o regla).
- El moderador inicia sesión en `/feed` y llega al panel por el enlace «Moderación» del sidebar. Un moderador con varios eventos solo cambia de evento desde `/select-event`.
- Moderación: si se elimina el último post de una página distinta de la primera, la lista queda vacía hasta volver a la anterior.
- La ficha del participante ya no envía `role` en el `PATCH` general; el rol de moderador se cambia solo con `PATCH /admin/participants/:id/role`.

## Trabajo técnico y operativo posterior

Completitud del DDL, políticas RLS y Storage, transacciones e idempotencia, auditoría y logging, paginación, contratos compartidos, cobertura de CI, accesibilidad, rendimiento, observabilidad, respaldos y preparación de producción. Los objetivos históricos se conservan en [requerimientos](../01-producto/requerimientos.md).

## Pendientes de los planes web (estado al 19 de noviembre de 2026)

Lista consolidada de lo no ejecutado o no resuelto en los planes del [equipo web](../04-desarrollo/plan-web/README.md). Cada punto enlaza a su plan. Los IDs B y S vienen de la planilla externa del plan maestro, que no está en el repositorio.

### Decisiones y registros pendientes (bloquean trabajo)

- Registrar en el repositorio las decisiones B03, B04, B07, B11, B14, B15, S2-13, S3-08 y S3-11. Hoy aparecen solo en los planes o en la planilla externa ([plan 04](../04-desarrollo/plan-web/04-condicionadas.md), [README](../04-desarrollo/plan-web/README.md)).
- B01: PNG oficial de MUN ESEN y su ubicación, para el logo W01 ([plan 02](../04-desarrollo/plan-web/02-producto.md)).
- B02: ejemplos aprobados de conteo de publicaciones, para W04 ([plan 02](../04-desarrollo/plan-web/02-producto.md)).
- B12: meta de carga (concurrencia, mezcla, duración y umbrales), para Q03 ([plan 03](../04-desarrollo/plan-web/03-calidad.md)).
- Límites 429, persistencia del contador, política de auditoría ante fallo y umbral de bloqueo, para Q02 ([plan 03](../04-desarrollo/plan-web/03-calidad.md)).
- Alcance de adjuntos (B03/B04): JPG/PNG frente a PDF, y tamaño y cantidad. [RN-11](../01-producto/reglas-de-negocio.md) ya fija JPG/PNG ≤ 5 MB o PDF ≤ 20 MB ([plan 04](../04-desarrollo/plan-web/04-condicionadas.md)).
- Reglas de selección de evento participante (B14) y colisión de códigos de ingreso (B07), para W07 ([plan 04](../04-desarrollo/plan-web/04-condicionadas.md)).
- Formato, guion, público y ubicación del tour (B11) ([plan 04](../04-desarrollo/plan-web/04-condicionadas.md)).
- Supervisión, bloqueo y expulsión de DM, con permisos, motivo, retención y privacidad (B15) ([plan 04](../04-desarrollo/plan-web/04-condicionadas.md)).
- Definición de S3-11 y S3-08, y vigencia de REQ-20 (reportes) y REQ-22 (avisos) ([plan 04](../04-desarrollo/plan-web/04-condicionadas.md)).
- Destino de soporte y términos para la guía (D06) ([plan 01](../04-desarrollo/plan-web/01-estabilizacion.md)).

### Plan 01 · Estabilización y demo

- D06: verificar en navegador autenticado el footer y los enlaces de `/guia`; comprobar teclado, foco, tema oscuro y viewport 360×800.
- D07: casos con respuestas simuladas (sin membresía activa, credenciales inválidas, 409, preactivación vacía o con varios eventos, fallo de red) y verificación con API.
- D03/D05: ejecutar muros, permisos y perfiles en QA con los fixtures de D01/D02 (dependen de admin).
- D04: registrar en dos sesiones la entrega en tiempo real y la reconexión. Confirmar en QA que `poll_votes` está en la publicación Realtime, que no está versionada.
- D08: matriz responsive, tema y teclado en login, guía, perfil, feed, encuesta y chat.
- D09: guion de demo y evidencia frente al checklist (pasos 05–15 y 18).
- Lint de web: 32 advertencias (`--max-warnings 0` falla). Incluyen `<img>` sin `next/image` y dependencias de `useEffect` en `PostComments.tsx`.

### Plan 02 · Producto participante

- W01: sustituir los logos provisionales de `/guia` por los archivos finales cuando MUN ESEN los apruebe.
- W02/W03: verificar en QA la búsqueda más allá de 80 filas, la paginación sin omisiones y los límites de evento. Actualizar API, frontend y matriz de trazabilidad.
- W03: confirmar si los comités archivados se muestran y se pueden filtrar.
- W02: confirmar roles incluidos en el directorio.
- W04: bloqueado por B02.
- A03: evidencia de QA de las migraciones 001/002 y decisión sobre dónde mostrar el código (S2-13) en tarjetas, búsqueda, DM y chat.

### Plan 03 · Calidad del piloto (Q01–Q03)

- Q01: autorización cruzada en QA (fixtures, cambio de comité, suspensión, retiro de contenido y Realtime). Requiere dos cuentas de participante de prueba; el sondeo de solo lectura ya está preparado y no se ejecutó.
- Q01, hallazgos de API/admin que requieren coordinación con su dueño:
  - H1: `POST /admin/memberships` no valida que el comité pertenezca al evento.
  - H2: `GET /auth/events-by-code/:participant_code` es público y devuelve `membership_id`.
  - H3: `requireEventMembership` está exportado y sin uso.
  - H4: UPDATEs por id sin `event_id` en DM y comentarios (defensa en profundidad).
  - H5: `POST /admin/events` y `GET /admin/events` usan `requireAdmin` global; decisión de producto.
- Q02:
  - Sin límite de intentos en login, activación ni consulta por código (confirmado en la API local: 60 respuestas sin 429).
  - Enumeración: login distingue 400 de 401 (Q02-2).
  - `logAuthAttempt` ignora el error de Supabase (Q02-3).
  - Activación sin compensación si falla tras crear la cuenta de Auth (Q02-4).
  - `last_login_at` sin revisar errores (Q02-5).
  - Denegaciones de middleware sin auditar (Q02-6).
  - `logAudit` es best effort (Q02-7).
  - `initial_password` y `temporary_password` en respuestas JSON. El handler de reset no fija `Cache-Control: no-store` (Q02-8).
  - Sesión completa en `localStorage` (Q02-10).
  - Pruebas con reloj simulado, sin ejecutar.
- Q03:
  - Aplicar o no la 002, que la base real marca como compartida y de producción (`002_codigo_delegacion.sql:5`). Requiere decisión antes de cualquier cambio en la base.
  - Verificar RLS, publicación Realtime, buckets y configuración de Auth en la base real. Es solo lectura y requiere autorización expresa.
  - Discrepancias D1–D9 del inventario, incluida la RPC `assign_delegation_code` sin guarda de versión (D1) y los valores de rol y estado que el código escribe y el enum no declara (D4, D5).
  - `ALLOW_DEMO_POSTS=true` en `apps/api/.env` no se lee en `apps/api/src`; retirarlo o documentarlo.
- Node: `engines` declara `>=18`, pero el lockfile exige Node 20.9 por Next.js 16.1.5 y `@supabase/supabase-js`. Decidir el cambio.

### Plan 04 · Condicionadas

- W07: implementar la selección de evento según B14 (orden determinista de membresías, selector para participantes con varias, cambio de evento en sidebar). Alinear `flujos-funcionales.md` con el código actual. Conectar `refreshContext`, que hoy no tiene llamadas. Limpiar estado del evento anterior, y mapear el 409 en login.
- W05: la interfaz de adjuntos existe (editor, tarjeta y validación JPG/PNG ≤ 5 MB o PDF ≤ 20 MB en `apps/web/lib/attachments.ts`), pero no se guarda nada. Verificado el 20 de noviembre de 2026 (solo lectura): la tabla `attachments` existe con 0 filas y el único bucket es `profile-images` (público). Pendiente el contrato de API, el bucket privado, las políticas de Storage, el retiro, las URL temporales y las pruebas. La tabla `attachments` difiere entre el snapshot y la migración 001 (`CHECK size_bytes >= 0`). Al activarlo: poner `ATTACHMENTS_BACKEND_READY = true`, enviar el archivo desde `publishFeedPost` y devolver `attachment` en los posts. Depende de Q03.
- W06: contenido del tour y su enlace en `/guia`, tras aprobar B11.
- Q04: limpieza técnica y reportes/notificaciones solo tras demo y producto estable.

### Trabajo local sin subir

- Commit `3aeee7b` (inventario del plan 04) existe solo en local en `feat/web-improvements`. Pendiente de push.

### Verificación diferida de la Tarea 13 (mejora de UX pública)

Deuda abierta, pendiente de aceptación formal del dueño. Mientras no se acepte, la verificación sigue pendiente y no se considera cerrada. Registro en [pruebas y validación](../04-desarrollo/pruebas-y-validacion.md#ronda-2-de-corrección-de-la-tarea-13-20-de-noviembre-de-2026).

- Recorrido manual autenticado en claro y oscuro, 390 y 1440 px: login, selección de evento, feed (Avisos, General y un comité), publicar, comentar, votar, chat entre dos sesiones, perfil y administración. Requiere datos ficticios en un entorno aislado.
- Detector sobre rutas autenticadas (vista de selección con sesión, muro, perfil). Solo se midieron `/login`, `/guia` y `/select-event` sin sesión.
- `/impeccable critique` sobre el muro, para comparar contra el puntaje de 20/40.
- Puntos 1 a 6 de Review Focus del plan: evidencia solo a nivel de pruebas unitarias y de código (ronda 3); sin verificación en navegador. Pendiente verlos en 390 y 1440 px, sobre todo el desbordamiento de texto (punto 5) y el acordeón de muros (punto 4).
- `line-length` en `/guia` a 1440 px: párrafos de unos 110 caracteres dentro de tarjetas. Advertencia del detector, no está en la lista de la especificación.

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

### Pendientes tras la mejora de UX y la integración de sitio-admin (20 de noviembre de 2026)

- Contador de comentarios: la API no devuelve el total, así que cada publicación carga sus comentarios al montar. Añadir el conteo al listado de posts y quitar esa carga.
- `isAdminRole` (API y `auth.store`) aún reconoce `COORDINADOR` y `ORGANIZADOR`, que no existen en el enum. Decidir si se retiran.
- Fallos de roles por texto en `dm.utils.ts`, `posts.utils.ts` y `comments.service.ts`: ahora el valor por defecto es `PARTICIPANT`; revisar los consumidores que comparaban con `DELEGADO`.
- QA autenticado de la mejora de UX y del panel admin (eventos con iconos, comités, participantes con iconos, moderación, importación CSV) sin ejecutar; ver la sección de verificación diferida de la Tarea 13.
- Verificar el PR #7 en CI: GitHub lo marcó `UNSTABLE` al fusionarlo y no se revisó qué check lo causó.
- Alias en chat (T3-R0-1): requiere `mapDmParticipant` y el select de `dm.service.ts`.
