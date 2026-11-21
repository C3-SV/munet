# Pendientes de MUNET

Lista única de lo que falta por hacer, decidir o verificar. Reemplaza a `07-auditoria/pendientes.md` y a las listas dispersas de los planes. Última revisión: 21 de noviembre de 2026.

Los IDs B, S, D, W, Q y A vienen de los [planes del equipo web](04-desarrollo/plan-web/README.md) y de la planilla externa del plan maestro, que no está en el repositorio.

## 1. Orden propuesto

Reordenado el 21 de noviembre de 2026 tras auditar cada pendiente contra el código de `main` (revisión de solo lectura, con un segundo revisor por informe). Ninguno de estos trabajos estaba hecho en el repositorio; el estado de la base real sigue sin la migración 002. Se ordena primero lo que no necesita decisión de producto.

| Prioridad | Trabajo | Estado | Resultado verificable |
|---|---|---|---|
| 1 | Migración 002 (código de delegación): aplicada y verificada el 21 de noviembre de 2026. Falta probar un lote CSV mixto de punta a punta. | Hecho; queda la prueba del CSV. | Existen `event_delegation_counters` y `assign_delegation_code`; las 13 membresías vigentes tienen código; un lote CSV mixto devuelve resultados, credenciales y código. |
| 2 | Correcciones de seguridad y cuentas sin decisión de producto. Hechas el 21 de noviembre de 2026: Q01-H1 (comité en `POST /admin/memberships`) y `role` fuera de `events-by-code`. Pendientes: Q01-H4 (UPDATE por id sin `event_id` en DM y comentarios), Q02-3, Q02-5, Q02-8 (`Cache-Control: no-store` en el reinicio de contraseña), Q02-4 (compensación al activar), callejón de la reactivación de una cuenta nunca activada y H3 (código sin uso). | Parcial, implementable ya. | Pruebas de unidad por cada corrección; sin cambios de contrato HTTP. |
| 3 | Código de ingreso entre eventos (B07, B14). Hecho el 21 de noviembre de 2026: un código solo puede repetirse entre eventos si es la misma persona; las altas nuevas (individual, CSV y vinculación) rechazan con 409 el código de otra persona, y `events-by-code` tiene límite por IP. Pendiente: confirmar la regla con MUN ESEN (B07), selección de evento con varias membresías (B14) y Q02-2 (login que distingue 400 de 401). | Implementado; pendiente de confirmar la regla. | Las colisiones de código tienen una regla escrita y el login las resuelve sin casos sin salida. |
| 4 | Ciclo del evento: borrador, cierre, archivo y reapertura; guarda central de solo lectura; borrar comités. | Pendiente; requiere decisiones (ver sección 2). | El evento cerrado sigue visible a quien corresponda y se rechazan las escrituras definidas por la regla. |
| 5 | Moderación mínima para MUN ESEN: ocultar sin borrar, endurecer la suspensión, consulta de auditoría y, si se decide, expulsión. Ya existen: eliminar con motivo, retirar adjuntos, fijar, suspender y reactivar. | Parcial; requiere decisiones (ver sección 2). | El equipo resuelve un caso de moderación con los permisos y la trazabilidad acordados. |
| 6 | Validar el recorrido de un evento de ensayo con delegados en comités distintos. Sin base aislada, se hace en el evento demo de la base real. | Pendiente, con el equipo. | El equipo ejecuta el [recorrido de validación](04-desarrollo/pruebas-y-validacion.md#recorrido-en-un-entorno-aislado) y registra resultados. |
| Hecho | Adjuntos de publicaciones en Cloudflare R2 ([ADR-006](06-decisiones/ADR-006-adjuntos-en-r2-con-url-firmada.md), [plan](04-desarrollo/plan-adjuntos-r2.md)), fusionado en el PR 9 y verificado en el evento demo. | Hecho; queda probar un PDF cercano a 20 MB y el origen de producción. Ver la sección 3. | Un delegado adjunta una imagen o un PDF a una publicación y los lectores autorizados lo abren. |

## 2. Decisiones de producto

- Recuperación autónoma de cuenta, verificación de identidad y efectos de la suspensión sobre sesiones y Realtime.
- Necesidad de reportes, notificaciones, fijado, reapertura de encuestas y exportación masiva. Vigencia de REQ-20 (reportes) y REQ-22 (avisos).
- Supervisión, bloqueo y expulsión de DM, con permisos, motivo, retención y privacidad (B15), y consulta de auditoría.
- Reglas de selección de evento para participantes con varias membresías (B14) y colisión de códigos de ingreso (B07), para W07.
- Formato, guion, público y ubicación del tour (B11).
- Definición de S3-11 y S3-08.
- Registrar en el repositorio las decisiones B03, B04, B07, B11, B14, B15, S2-13, S3-08 y S3-11, que hoy están solo en los planes o en la planilla externa.
- B01: PNG oficial de MUN ESEN y su ubicación definitiva. Hoy `/guia`, el login y el footer usan los logos provisionales de `public/`.
- B02: ejemplos aprobados de conteo de publicaciones, para W04.
- B12: meta de carga (concurrencia, mezcla, duración y umbrales), para Q03.
- Destino de soporte y términos de uso para la guía (D06).
- Node: `engines` declara `>=18`, pero el lockfile exige Node 20.9 por Next.js 16.1.5 y `@supabase/supabase-js`. Decidir el cambio.

### P-01 Modelo de autorización administrativa

La administración por evento se decidió el 29 de octubre de 2026 en [ADR-005](06-decisiones/ADR-005-autorizacion-administrativa-por-evento.md). Un rol transversal, si se pide, requiere una decisión nueva.


## 3. Adjuntos y Storage

Estado verificado el 20 de noviembre de 2026 con consultas de solo lectura:

- La tabla `attachments` existe con 0 filas. Difiere del snapshot en `CHECK size_bytes >= 0` (migración 001).
- El único bucket es `profile-images` (público, avatares). No existe un bucket privado para adjuntos.
- La API no tiene endpoints de adjuntos.
- Al 20 de noviembre de 2026 la API (endpoints, orden de operaciones y compensaciones) y la web (envío en pasos, descarga a demanda y retiro por el autor) están implementadas en la rama, con pruebas de unidad. La migración 003 está aplicada y el recorrido real en el evento demo (subida desde el navegador, descarga, retiro por el autor y por moderación, rechazos y auditoría) pasó el 20 de noviembre de 2026; el detalle está en el [plan](04-desarrollo/plan-adjuntos-r2.md). Falta probar el origen de producción contra el CORS del bucket y archivos grandes desde el navegador. La bandera `ATTACHMENTS_BACKEND_READY` se eliminó: la web envía el archivo siempre. Sin la 003 y las variables `STORAGE_*` en el servidor, publicar con adjunto falla y el texto se conserva en el editor.
- El panel de moderación muestra el adjunto de cada post y ofrece «Retirar adjunto» con motivo (verificado el 20 de noviembre de 2026 en el evento demo).

Reglas vigentes ([RN-11](01-producto/reglas-de-negocio.md), REQ-16): cero o un adjunto por post, JPG/PNG ≤ 5 MB o PDF ≤ 20 MB, permisos heredados del post y retiro auditable.

Decisiones del 20 de noviembre de 2026 ([ADR-006](06-decisiones/ADR-006-adjuntos-en-r2-con-url-firmada.md)): almacenamiento en Cloudflare R2 (bucket privado) detrás de una interfaz compatible con S3; subida directa con URL firmada; descarga a demanda; un adjunto por post con índice único; moderación puede retirar con motivo; adjuntos de posts eliminados se conservan 30 días salvo retención; solo JPG, PNG y PDF; la API corre en Vercel.

Trabajo pendiente, por fases del [plan](04-desarrollo/plan-adjuntos-r2.md):

0. Cuenta, bucket privado, token, CORS y ciclo de vida de R2, a cargo del dueño de la cuenta. Variables `STORAGE_*` en `apps/api/.env` y en Vercel.
1. Documentación y migración `003_adjuntos_un_por_post.sql`: hechas. La 003 se aplicó el 20 de noviembre de 2026 y quedó verificada.
2. Módulo de almacenamiento (`lib/storage`) y pruebas.
3. API: inicio de subida, creación de post con adjunto, descarga, retiro, moderación, auditoría y script de conciliación y purga.
4. Web: envío en pasos, descarga a demanda y retiro por el autor (hecho, sin verificar con sesión). El botón de retiro por moderación en el panel también está hecho.
5. Aplicar la 003 y verificar en el evento demo con dos cuentas. Pruebas de aislamiento entre eventos. Depende de Q03.
- Pendiente de confirmar: umbrales de límites por membresía (3 intentos sin consumir, 20 por hora).

## 4. API, base de datos y seguridad

### Q01 · Autorización cruzada

- Ejecutar en QA fixtures, cambio de comité, suspensión, retiro de contenido y Realtime. Requiere dos cuentas de participante de prueba; el sondeo de solo lectura ya está preparado y no se ejecutó.
- H1: `POST /admin/memberships` no valida que el comité pertenezca al evento.
- H2: `GET /auth/events-by-code/:participant_code` es público y devuelve `membership_id`.
- H3: `requireEventMembership` está exportado y sin uso.
- H4: UPDATEs por id sin `event_id` en DM y comentarios (defensa en profundidad).
- H5: `POST /admin/events` y `GET /admin/events` usan `requireAdmin` global; decisión de producto.

### Q02 · Autenticación y auditoría

- Límite de intentos: el Sprint 3 añadió `rate-limit.ts`. Falta decidir la persistencia del contador (hoy en memoria), el umbral de bloqueo y la política de auditoría ante fallo.
- Enumeración: el login distingue 400 de 401 (Q02-2).
- `logAuthAttempt` ignora el error de Supabase (Q02-3).
- Activación sin compensación si falla tras crear la cuenta de Auth (Q02-4).
- `last_login_at` sin revisar errores (Q02-5).
- Denegaciones de middleware sin auditar (Q02-6).
- `logAudit` es best effort (Q02-7).
- `initial_password` y `temporary_password` viajan en respuestas JSON; el handler de reset no fija `Cache-Control: no-store` (Q02-8).
- Sesión completa en `localStorage` (Q02-10).
- Pruebas con reloj simulado, sin ejecutar.

### Q03 · Base real

- La migración 002 se aplicó el 21 de noviembre de 2026 (P-06 cerrado): la función `assign_delegation_code` y la tabla `event_delegation_counters` existen y las membresías vigentes tienen código. Falta verificar privilegios de `service_role` frente a `anon` y `authenticated` por la vía de la API con un alta real.
- Verificar RLS, publicación Realtime (incluida `poll_votes`), buckets y configuración de Auth en la base real. Es solo lectura y requiere autorización expresa.
- Discrepancias D1–D9 del inventario, incluida la RPC `assign_delegation_code` sin guarda de versión (D1) y el valor de estado que el código escribe y el enum no declara (D5).
- `ALLOW_DEMO_POSTS=true` en `apps/api/.env` no se lee en `apps/api/src`; retirarlo o documentarlo.

### Trabajo técnico posterior

Completitud del DDL, políticas RLS y Storage, transacciones e idempotencia, auditoría y logging, paginación, contratos compartidos, cobertura de CI, accesibilidad, rendimiento, observabilidad, respaldos y preparación de producción. Q04: limpieza técnica y reportes o notificaciones solo después de la demo y con el producto estable. Los objetivos históricos están en [requerimientos](01-producto/requerimientos.md).

## 5. Producto participante

- W07: implementar la selección de evento según B14 (orden determinista de membresías, selector para participantes con varias, cambio de evento en el sidebar). Alinear `flujos-funcionales.md` con el código, conectar `refreshContext` (hoy sin llamadas), limpiar el estado del evento anterior y mapear el 409 en el login.
- W02/W03: verificar en QA la búsqueda más allá de 80 filas, la paginación sin omisiones y los límites de evento.
- W03: confirmar si los comités archivados se muestran y se pueden filtrar.
- W02: confirmar qué roles incluye el directorio.
- W04: conteo de publicaciones, bloqueado por B02.
- W06: contenido del tour y su enlace en `/guia`, tras aprobar B11.
- A03: evidencia de QA de las migraciones 001/002 y decisión sobre dónde mostrar el código de delegación (S2-13) en tarjetas, búsqueda, DM y chat.
- Marca «Fijado» en `PostCard` y mapeo de `isPinned`/`pinnedAt` del feed (componente compartido).
- Moderación: si se elimina el último post de una página distinta de la primera, la lista queda vacía hasta volver a la anterior.
- El moderador llega al panel por el enlace «Moderación» del sidebar. Un moderador con varios eventos solo cambia de evento desde `/select-event`.

## 6. Verificación y QA

Estas verificaciones requieren sesión autenticada y datos ficticios en un entorno aislado. La base real está marcada como de producción, así que no se ejecutan contra ella sin autorización expresa.

### Mejora de UX pública (Tarea 13) y panel admin

Deuda abierta, pendiente de aceptación formal del dueño. El registro está en [pruebas y validación](04-desarrollo/pruebas-y-validacion.md).

- Recorrido manual autenticado en claro y oscuro, a 390 y 1440 px: login, selección de evento, feed (Avisos, General y un comité), publicar, comentar, votar, chat entre dos sesiones, perfil y administración (eventos con iconos, comités, participantes con iconos, moderación, importación CSV).
- Detector de diseño sobre rutas autenticadas (selección de evento con sesión, muro, perfil). Solo se midieron `/login`, `/guia` y `/select-event` sin sesión.
- `/impeccable critique` sobre el muro, para comparar contra el puntaje de 20/40.
- Puntos 1 a 6 de Review Focus del plan: hay evidencia de pruebas unitarias y de código, pero no de navegador; sobre todo el desbordamiento de texto (punto 5) y el acordeón de muros (punto 4).
- `line-length` en `/guia` a 1440 px: párrafos de unos 110 caracteres dentro de tarjetas. Advertencia del detector fuera de la lista de la especificación.
- Adjuntos: probar la interfaz (elegir, validar, quitar) con sesión.

### Estabilización y demo (plan 01)

- D06: verificar en navegador autenticado el footer y los enlaces de `/guia`; teclado, foco, tema oscuro y viewport 360×800.
- D07: casos con respuestas simuladas (sin membresía activa, credenciales inválidas, 409, preactivación vacía o con varios eventos, fallo de red) y verificación con la API.
- D03/D05: ejecutar muros, permisos y perfiles en QA con los fixtures de D01/D02.
- D04: registrar en dos sesiones la entrega en tiempo real y la reconexión.
- D08: matriz responsive, tema y teclado en login, guía, perfil, feed, encuesta y chat.
- D09: guion de demo y evidencia frente al checklist (pasos 05–15 y 18).

## 7. Trabajo local sin subir

- Commit `3aeee7b` (inventario del plan 04) existe solo en local en `feat/web-improvements`. Pendiente de push.

## 8. Resuelto recientemente

- Roles: la base usa `PARTICIPANT`, `MODERATOR`, `ADMIN_MUN` y `ADMIN_TECH` (confirmado el 20 de noviembre de 2026). La API valida el rol al crear cuentas y membresías, y `isAdminRole` reconoce solo `ADMIN_MUN` y `ADMIN_TECH`. Los formularios usan un select con esos nombres. El alta de eventos escribe `ADMIN_TECH` (P-05 y D4 cerrados).
- Total de comentarios por publicación: la API devuelve `commentCount` y la web lo muestra sin una carga extra por post.
- Alias en mensajes directos: la API lo entrega en `otherParticipant` y el chat lo muestra.
- Prueba de moderador en `rbac.utils`: alineada con el contrato del Sprint 3.
- El PR #7 pasó todos los checks de CI.
- Lint de web: 0 errores y 0 advertencias en el último `eslint`.
