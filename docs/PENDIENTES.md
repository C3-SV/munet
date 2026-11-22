# Pendientes de MUNET

Lista única de lo que falta por hacer, decidir o verificar. Reemplaza a `07-auditoria/pendientes.md` y a las listas dispersas de los planes. Última revisión: 21 de noviembre de 2026 (tras la rama `fix/q02-auditoria-login-seed`).

Los IDs B, S, D, W, Q y A vienen de los [planes del equipo web](04-desarrollo/plan-web/README.md) y de la planilla externa del plan maestro, que no está en el repositorio.

## 1. Orden propuesto

Reordenado el 21 de noviembre de 2026 tras auditar cada pendiente contra el código de `main` (revisión de solo lectura, con un segundo revisor por informe). Desde entonces se aplicó la migración 002 y se hicieron varias correcciones (ver las filas 1 a 3 y la sección 8). Se ordena primero lo que no necesita decisión de producto.

| Prioridad | Trabajo | Estado | Resultado verificable |
|---|---|---|---|
| 1 | Migración 002 (código de delegación): aplicada y verificada el 21 de noviembre de 2026. Falta probar un lote CSV mixto de punta a punta. | Hecho; queda la prueba del CSV. | Existen `event_delegation_counters` y `assign_delegation_code`; las 13 membresías vigentes tienen código; un lote CSV mixto devuelve resultados, credenciales y código. |
| 2 | Correcciones de seguridad y cuentas sin decisión de producto. Hechas el 21 de noviembre de 2026: Q01-H1, Q01-H4, H3 (middleware sin uso eliminado), Q02-2 (login con 401 uniforme), Q02-3, Q02-4 (compensación al activar), Q02-5, Q02-6 (auditoría de denegaciones, con límite), Q02-8, la reactivación sin salida (ya no se suspende una cuenta nunca activada) y `role` fuera de `events-by-code`. | Hecho; queda verificar en el evento demo. | Pruebas de unidad por cada corrección (343 en la API); sin cambios de contrato HTTP. |
| 3 | Código de ingreso entre eventos (B07, B14). Hecho el 21 de noviembre de 2026: un código solo puede repetirse entre eventos si es la misma persona; las altas nuevas (individual, CSV y vinculación) rechazan con 409 el código de otra persona, y `events-by-code` tiene límite por IP. Pendiente: confirmar la regla con MUN ESEN (B07), selección de evento con varias membresías (B14). | Implementado; pendiente de confirmar la regla. | Las colisiones de código tienen una regla escrita y el login las resuelve sin casos sin salida. |
| 4 | Ciclo del evento: borrador, cierre, archivo y reapertura; guarda central de solo lectura (hecha el 21 de noviembre de 2026: `requireEventOpenForWrites` rechaza con 403 las escrituras de participantes y moderación en un evento `CLOSED`; la reapertura es `PATCH /admin/events/:eventId`); borrar comités. Sin decidir: escrituras en `ARCHIVED`, `PATCH /profiles/:membershipId` en evento cerrado, y el uso de `events.is_read_only`. | Decisiones de cierre, archivo y reapertura tomadas el 21 de noviembre de 2026 ([ADR-007](06-decisiones/ADR-007-decisiones-de-producto-noviembre-2026.md)); pendiente implementarlas. Siguen sin decidirse el borrador y el borrado de comités. | El evento cerrado sigue visible a quien corresponda y se rechazan las escrituras definidas por la regla. |
| 5 | Moderación mínima para MUN ESEN: ocultar sin borrar, endurecer la suspensión, consulta de auditoría y, si se decide, expulsión. Ya existen: eliminar con motivo, retirar adjuntos, fijar, suspender y reactivar. | Parcial. Decisiones de ocultar, auditoría y suspensión tomadas el 21 de noviembre de 2026 ([ADR-007](06-decisiones/ADR-007-decisiones-de-producto-noviembre-2026.md)); sigue sin decidirse la expulsión. | El equipo resuelve un caso de moderación con los permisos y la trazabilidad acordados. |
| 6 | Validar el recorrido de un evento de ensayo con delegados en comités distintos. Sin base aislada, se hace en el evento de entrenamiento «Conoce MUNET» ([guía](04-desarrollo/evento-de-entrenamiento.md)), sembrado el 21 de noviembre de 2026, reducido a 12 cuentas y reiniciable; el ciclo de cuentas ya se recorrió ahí por la API. Falta hacerlo con personas. | Pendiente, con el equipo. | El equipo ejecuta el [recorrido de validación](04-desarrollo/pruebas-y-validacion.md#recorrido-en-un-entorno-aislado) y registra resultados. |
| En curso | Modo práctica local de «Conoce MUNET» ([diseño](04-desarrollo/diseno-sandbox-conoce-munet.md)). Entrega 1 (núcleo, PR 14) y entrega 2 (superficies: muro, encuestas, comentarios, adjuntos locales, directorio, perfil y mensajes directos) implementadas el 21 de noviembre de 2026; la entrega 2 está en la rama `feat/modo-practica-superficies`, sin publicar. La entrega 3 (reducir el evento del servidor a 12 cuentas) está aplicada en la base real; el seed y el contenido de ejemplo ya definen solo esas 12 cuentas; falta decidir si el botón se esconde en producción hasta fusionar todo. | Entregas 1, 2 y 3 hechas; falta decidir el botón en producción y publicar la entrega 2. | Cada participante practica en su navegador sin tocar datos reales. |
| Hecho | Adjuntos de publicaciones en Cloudflare R2 ([ADR-006](06-decisiones/ADR-006-adjuntos-en-r2-con-url-firmada.md), [plan](04-desarrollo/plan-adjuntos-r2.md)), fusionado en el PR 9 y verificado en el evento demo. | Hecho; queda probar un PDF cercano a 20 MB y el origen de producción. Ver la sección 3. | Un delegado adjunta una imagen o un PDF a una publicación y los lectores autorizados lo abren. |

## 2. Decisiones de producto

- Recuperación autónoma de cuenta y verificación de identidad.
- Efectos de la suspensión sobre sesiones y Realtime: decididos e implementados el 21 de noviembre de 2026 ([ADR-007](06-decisiones/ADR-007-decisiones-de-producto-noviembre-2026.md)): sin membresía activa la API responde 401 y la web cierra sesión; suspender banea al usuario en Auth si no le queda otra membresía activa. El canal Realtime abierto dura hasta que vence el token (hasta una hora). Falta verificarlo con dos cuentas.
- Necesidad de reportes, notificaciones, fijado, reapertura de encuestas y exportación masiva. Vigencia de REQ-20 (reportes) y REQ-22 (avisos).
- Supervisión, bloqueo y expulsión de DM, con permisos, motivo, retención y privacidad (B15).
- Consulta de auditoría: decidida el 21 de noviembre de 2026 ([ADR-007](06-decisiones/ADR-007-decisiones-de-producto-noviembre-2026.md)): completa para `ADMIN_TECH`, acotada a su evento para `ADMIN_MUN`. Falta implementarla y actualizar la matriz de reglas de negocio y REQ-24.
- Expulsión de participantes: sin decidir.
- Colisión de códigos de ingreso (B07), para W07.
- Selección de evento para participantes con varias membresías (B14): decidida el 21 de noviembre de 2026 ([ADR-007](06-decisiones/ADR-007-decisiones-de-producto-noviembre-2026.md)). Falta implementarla en W07.
- Formato, guion, público y ubicación del tour (B11).
- Definición de S3-11 y S3-08.
- Registrar en el repositorio las decisiones B03, B04, B07, B11, B15, S2-13, S3-08 y S3-11, que hoy están solo en los planes o en la planilla externa. B14 ya se registró en [ADR-007](06-decisiones/ADR-007-decisiones-de-producto-noviembre-2026.md).
- B01: PNG oficial de MUN ESEN y su ubicación definitiva. Hoy `/guia`, el login y el footer usan los logos provisionales de `public/`.
- B02: ejemplos aprobados de conteo de publicaciones, para W04.
- B12: meta de carga (concurrencia, mezcla, duración y umbrales), para Q03.
- Destino de soporte y términos de uso para la guía (D06).
- ~~Node: `engines` declaraba `>=18`~~ Resuelto el 21 de noviembre de 2026: `engines.node` es `>=20.9` en la raíz y en las apps, según el lockfile.

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
- ~~H1: `POST /admin/memberships` no validaba que el comité perteneciera al evento.~~ Resuelto el 21 de noviembre de 2026.
- H2: `GET /auth/events-by-code/:participant_code` es público. Ya tiene límite por IP, no devuelve `role`, `membership_id` ni datos internos del evento, y no filtra errores de la base (resuelto el 21 de noviembre de 2026 lo evitable); por diseño sigue confirmando que un código tiene cuenta pendiente, porque la activación lo necesita.
- ~~H3: `requireEventMembership` sin uso.~~ Resuelto el 21 de noviembre de 2026: el middleware se eliminó.
- ~~H4: UPDATEs por id sin `event_id` en DM y comentarios.~~ Resuelto el 21 de noviembre de 2026.
- H5: `POST /admin/events` y `GET /admin/events` usan `requireAdmin` global; decisión de producto.

### Q02 · Autenticación y auditoría

- Límite de intentos: el Sprint 3 añadió `rate-limit.ts`. Falta decidir la persistencia del contador (hoy en memoria), el umbral de bloqueo y la política de auditoría ante fallo.
- ~~Enumeración: el login distingue 400 de 401 (Q02-2).~~ Resuelto el 21 de noviembre de 2026: el login responde 401 también si el código no tiene membresía activa, y la web muestra el mismo mensaje. Sigue abierto fuera de esta corrección: `GET /auth/events-by-code/:participant_code` (Q01-H2) y el 404 «Membership no encontrado» de `POST /auth/activate` siguen distinguiendo códigos pendientes o inexistentes, y el tiempo de respuesta no se igualó.
- ~~`logAuthAttempt` ignora el error de Supabase (Q02-3).~~ Resuelto el 21 de noviembre de 2026: se registra en consola sin cortar el flujo.
- ~~Activación sin compensación si falla tras crear la cuenta de Auth (Q02-4).~~ Resuelto el 21 de noviembre de 2026: se borra el usuario de Auth creado, se revierte `users` y la cuenta sigue pendiente con su contraseña inicial.
- ~~`last_login_at` sin revisar errores (Q02-5).~~ Resuelto el 21 de noviembre de 2026: el error se registra y no impide el login.
- ~~Denegaciones de middleware sin auditar (Q02-6).~~ Resuelto el 21 de noviembre de 2026: los 403 de los middlewares de autorización registran `ACCESS_DENIED`. Límite contra abuso: 10 registros por usuario cada 10 minutos, en memoria por instancia. Verificado el 21 de noviembre de 2026 con consultas de solo lectura: `outcome` es un enum que admite `DENIED` y `action_type` es texto libre.
- `logAudit` es best effort (Q02-7): registra el error con `console.error` y no lanza; se mantiene así a propósito.
- `initial_password` y `temporary_password` viajan en respuestas JSON (Q02-8). El handler de reset ya fija `Cache-Control: no-store` (resuelto el 21 de noviembre de 2026); las otras respuestas con contraseñas ya lo tenían.
- Sesión completa en `localStorage` (Q02-10).
- Pruebas con reloj simulado, sin ejecutar.

### Q03 · Base real

- La migración 002 se aplicó el 21 de noviembre de 2026 (P-06 cerrado): la función `assign_delegation_code` y la tabla `event_delegation_counters` existen y las membresías vigentes tienen código. Falta verificar privilegios de `service_role` frente a `anon` y `authenticated` por la vía de la API con un alta real.
- Verificar RLS, publicación Realtime (incluida `poll_votes`), buckets y configuración de Auth en la base real. Es solo lectura y requiere autorización expresa.
- Discrepancias D1–D9 del inventario, incluida la RPC `assign_delegation_code` sin guarda de versión (D1) y el valor de estado que el código escribe y el enum no declara (D5).
- `ALLOW_DEMO_POSTS=true` aparece en `apps/api/.env.example` (versionado) y en `apps/api/.env` local, pero no se lee en `apps/api/src`; retirarlo del ejemplo o documentarlo.

### Trabajo técnico posterior

Completitud del DDL, políticas RLS y Storage, transacciones e idempotencia, auditoría y logging, paginación, contratos compartidos, cobertura de CI, accesibilidad, rendimiento, observabilidad, respaldos y preparación de producción. Q04: limpieza técnica y reportes o notificaciones solo después de la demo y con el producto estable. Los objetivos históricos están en [requerimientos](01-producto/requerimientos.md).

## 5. Producto participante

- W07: implementado el 21 de noviembre de 2026 (último evento usado, selector con más de una membresía, «Cambiar evento» en el sidebar, `refreshContext` conectado, 409 con mensaje claro). Faltan: probarlo en navegador con dos membresías; que el selector aparezca también justo después del login (hoy entra directo al evento por defecto; requiere cambiar `login/page.tsx`); y el desempate por «más reciente», que exige que la API exponga la fecha de la membresía o del evento (hoy desempata por nombre). Alinear `flujos-funcionales.md` con el código.
- W02/W03: verificar en QA la búsqueda más allá de 80 filas, la paginación sin omisiones y los límites de evento.
- W03: confirmar si los comités archivados se muestran y se pueden filtrar.
- W02: confirmar qué roles incluye el directorio.
- W04: conteo de publicaciones, bloqueado por B02.
- W06: contenido del tour y su enlace en `/guia`, tras aprobar B11.
- A03: evidencia de QA de las migraciones 001/002 y decisión sobre dónde mostrar el código de delegación (S2-13) en tarjetas, búsqueda, DM y chat.
- ~~Marca «Fijado» y fijados primero en el feed~~ hechos el 21 de noviembre de 2026 (fijar lo puede hacer Admin MUN).
- ~~Moderación: lista vacía al eliminar el último post de una página distinta de la primera.~~ Resuelto el 21 de noviembre de 2026: retrocede a la página anterior.
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
