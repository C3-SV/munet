# Plan de implementación para calidad e integración web

> **Para agentes:** usar superpowers:executing-plans o superpowers:subagent-driven-development tras revisar el plan. Cada casilla describe trabajo futuro.

**Objetivo** · Obtener evidencia reproducible de acceso, sesión, Realtime y avatares, y preparar la protección y capacidad necesarias antes del piloto.

**Arquitectura** · La API comprueba la membresía activa en su evento y el acceso al recurso en cada solicitud. Las políticas de QA deben sostener la misma frontera en Realtime y Storage. La observabilidad registra acciones y fallos según el contrato aprobado.

**Tecnología** · Express, TypeScript, Supabase, clientes Realtime y Node Test Runner.

**Especificación** · [Alcance web](README.md), [verificación del repositorio](../pruebas-y-validacion.md), [RN-06/20/21](../../01-producto/reglas-de-negocio.md) y [base de datos](../../02-arquitectura/base-de-datos.md).

## Restricciones

- Q01 y Q02 antes de habilitar usuarios reales. Q03 antes del evento y, para adjuntos, antes de liberar W05.
- Las verificaciones de infraestructura y carga usan un proyecto de QA dedicado, previa autorización de su responsable. Los comandos de prueba local usan sustitutos o funciones aisladas.
- El equipo web es responsable de evidencia e integración participante. API, admin e infraestructura son responsables de sus contratos, fixtures y configuración. Toda corrección en rutas o servicios compartidos necesita coordinación con su propietario.

## Entorno y registro de evidencia

El escenario inicial usa dos eventos sintéticos independientes y dos comités en el primero. A y B son delegados activos en el primer evento, cada uno en su comité. C pertenece solo al segundo evento. T es un tercer delegado en el primer evento sin participación en el DM de A y B. P tiene una cuenta pendiente para ensayar activación. El equipo admin aporta una membresía autorizada de QA para anuncios y para cambiar/suspender a A. General/avisos, muros de comité y avatares/DM de prueba quedan identificados por un prefijo acordado.

Registrar por caso el ID, SHA, fecha, entorno, rol y evento de la fixture, pasos o comando, resultado esperado, resultado observado y enlace a evidencia saneada. Usar estados **pasa**, **falla**, **bloqueado** y **sin ejecutar**. Registrar por separado el resultado en UI, API, suscripción Realtime y Storage cuando aplique.

## Evidencia de la etapa documental

El 18 de noviembre de 2026, sobre el código de `56582dc`, `node --test apps/web/lib/api/base-url.test.mjs` pasó 2 pruebas y `npm test -w api` pasó 110 con dependencias fijadas en el lockfile, cargadas desde caché en un directorio temporal. Las cifras corresponden a pruebas existentes. Los recorridos de navegador, los builds y las pruebas de Supabase QA descritas en este plan quedan por ejecutar.

## Casos prioritarios de revisión

| Caso | Cobertura |
| --- | --- |
| Membresía suspendida con vista y suscripción abiertas | Q01 |
| Cambio de comité y lectura desde UI que conserva datos del muro anterior | Q01 |
| Dos participantes legítimos comparten red y los pasos de activación usan endpoints distintos | Q02 |
| Base incompleta o política QA distinta de lo documentado | Q03 |
| Vista de lectura con resultado vacío y suscripción deshabilitada | Q03 |

## Q01 · Acceso por evento y membresía

**Rutas y archivos** · `apps/api/src/middleware/auth.middleware.ts`, `services/auth-context.service.ts`, `utils/rbac.utils.ts`, `utils/walls.utils.ts`, controladores de eventos/posts/perfiles/DM y `apps/web/stores/auth.store.ts`. Coordinar con D03–D05. Mantener el criterio de menor acceso de RN-21.

- [ ] Ejecutar primero `npm test -w api` y `npm run check-types -w api`. Revisar estáticamente los consumidores de `apps/web/lib/supabase.ts` y la configuración cliente para confirmar que las operaciones de datos pasan por API, con la excepción Realtime (S1-19).
- [ ] Con las fixtures de QA, comprobar acceso ordinario propio y denegación fuera de evento, comité y conversación. Validar escritura en avisos desde los roles correctos. Con la misma sesión de A abierta, solicitar al responsable el cambio de comité y luego la suspensión de QA. En cada cambio, verificar próxima solicitud API, estado de datos visibles, acciones y recepción de notificaciones. Tras la suspensión, probar también el resultado al actualizar contexto o intentar entrar.
- [ ] En una publicación y un comentario de QA, comprobar el retiro por el actor autorizado y solicitar al responsable evidencia saneada del UUID de membresía registrado (S1-18). Si admin entrega el fijado de anuncios A05, comprobar en participante el orden al fijar y desfijar; el contrato y la mutación son de admin.
- [ ] Registrar resultados de API, RLS y Realtime individualmente. Si la UI conserva acceso aparente o datos anteriores, reproducir con sustitutos el cambio de contexto y corregir refresco o limpieza. Si la API o RLS entrega datos fuera de ámbito, coordinar la corrección con su dueño y bloquear el piloto hasta repetir satisfactoriamente el caso.
- [ ] Actualizar pruebas, discrepancias y REQ-03/07/08/11 según evidencia. Cerrar con `test(web): comprobar aislamiento y revocación de acceso` si se agregaron pruebas o `docs(web): registrar alcance y revocación en QA` si solo hay evidencia.

## Q02 · Límites de uso y auditoría esencial

**Dependencias** · API/admin aprueban las rutas a cubrir, umbral, ventana, identidad del límite, respuesta, entorno con proxies y política de auditoría. **Rutas y archivos** · `apps/api/src/routes/auth.routes.ts`, `controllers/auth.controller.ts`, `utils/auth.logger.ts` y `utils/audit.logger.ts`. Cualquier cambio de middleware se implementa en API. Las rutas de admin se coordinan con su equipo.

- [ ] Inventariar, mediante inspección estática, login, activación, consultas previas y acciones críticas. Contrastar qué éxito, fallo o denegación se audita y si el tratamiento de fallos es best effort. Revisar que web y API eviten contraseñas, tokens, payloads sensibles y claves en logs. Registrar brechas y su ruta responsable (S1-05/06, S3-09/10).
- [ ] Con API, fijar el contrato 429 y política de reintento, la persistencia del límite si corre en varios procesos y los campos de auditoría (actor, evento, objetivo, hora y motivo según la acción). Acordar comportamiento frente a indisponibilidad de auditoría antes de cambiar el resultado de cualquier escritura. El umbral de producto de bloqueo permanente y la recuperación son decisiones propias.
- [ ] Añadir pruebas controladas del umbral con reloj simulado, recuperación de la ventana, dos actores legítimos tras la misma red, fallo del registro y ausencia de secretos. Definir el mensaje web solo si cambia el contrato del usuario. Ejecutar pruebas/tipos API y tipos web si corresponde.
- [ ] Actualizar autenticación, API y REQ-07/08/24 si cambia su evidencia. Cerrar por separado los controles y la evidencia, por ejemplo `feat(api): aplicar límite acordado al acceso participante` y `test(api): verificar auditoría de acciones críticas`.

## Q03 · Inventario, RLS, Storage y capacidad

**Dependencias** · Infraestructura identifica el proyecto QA y el inventario saneado. B12 fija la meta de carga. **Rutas y archivos** · `supabase/schema.sql`, `supabase/migrations/001_alias_codigo_fijados_archivos.sql`, `supabase/migrations/002_codigo_delegacion.sql`, `docs/02-arquitectura/base-de-datos.md`, `apps/web/lib/supabase.ts` y `apps/api/src/controllers/profiles.controller.ts`. La 001 se anotó como aplicada históricamente y la 002 como pendiente. El snapshot carece de una base completa y reproducible.

- [ ] Comparar los archivos versionados con el inventario proporcionado de tablas, versiones, RLS, publicación Realtime y buckets de QA. Registrar qué requiere intervención de infraestructura. Alinear el mínimo de Node documentado con el del lockfile y la configuración efectiva de QA antes de proponer un cambio de `engines` (S1-07).
- [ ] Con una base desechable y autorización expresa del responsable, verificar que el esquema base y 001→002 pueden probarse en orden, que los resultados son reproducibles y que los códigos `#` resultantes son estables. Confirmar de forma independiente las políticas para comités, conversaciones, cambios de sesión y avatares. Comprobar una vista válida cuando Realtime esté deshabilitado. Si se aprueba W05, validar también permisos del bucket privado y retiro de enlaces con sus fixtures.
- [ ] Antes de la carga, definir con B12 la cifra concurrente, duración, mezcla de lecturas/escrituras y suscripciones, y umbrales por latencia, errores y refresco. Usar un destino QA aislado, con parada acordada al superar los límites. Incluir el directorio W02 si ya existe, con consulta y filtros representativos. Registrar versión, parámetros y resultados observados.
- [ ] Actualizar [base de datos](../../02-arquitectura/base-de-datos.md) y [validación](../pruebas-y-validacion.md) con evidencia y limitaciones. Cerrar con `docs(web): registrar verificación de infraestructura y capacidad de QA`. Toda intervención operativa se acuerda con el responsable del entorno.

## Inventario estático (sin QA)

> **Alcance.** Lectura del árbol de trabajo actual (rama `feat/web-improvements`). No se ejecutaron pruebas, builds, recorridos de navegador, consultas a Supabase ni llamadas a servicios externos. Todo lo siguiente es **evidencia estática**: describe el código y el SQL versionados, no el comportamiento en ejecución. Ninguna fila equivale a un resultado de QA.

### Q01 · Rutas API y frontera de evento

Marco común. Las rutas se montan en `apps/api/src/server.ts:38-43`; el CORS admite `x-event-id` (`server.ts:26`). `requireAuth` valida el JWT y carga memberships **solo `ACTIVE`** en cada petición (`apps/api/src/middleware/auth.middleware.ts:28-68`; `apps/api/src/services/auth-context.service.ts:98`). Una membresía suspendida deja de figurar en `req.auth.memberships` en la siguiente solicitud (evidencia estática, no verificada en ejecución).

En `/admin` el control es `requireEventAdmin` (`auth.middleware.ts:167-203`) con el evento resuelto desde parámetro, body, query, comité (`:130-142`) o membresía (`:147-159`). En rutas de participante no hay middleware de evento: cada controlador compara `x-event-id` o `:eventId` con `req.auth.memberships`. `requireEventMembership` (`auth.middleware.ts:74-104`) está exportado y **ninguna ruta lo usa**.

**Inventario (46 rutas al iniciar la lectura; 47 con la ruta añadida durante la revisión, ver fila de `/events/:eventId/participants`).**

| Ruta (archivo:línea) | Auth | Contexto de evento | Evidencia estática |
| --- | --- | --- | --- |
| GET `/auth/events-by-code/:participant_code` (`routes/auth.routes.ts:9`) | Pública | Ninguno | Devuelve `membership_id`, evento y rol de membresías `PENDING_ACTIVATION` (`controllers/admin.controller.ts:675-731`). Ver H2. |
| POST `/auth/activate` (`auth.routes.ts:10`) | Pública | `event_id` del body cruzado con el código | `controllers/auth.controller.ts:19-209`. Ver Q02. |
| POST `/auth/login` (`auth.routes.ts:11`) | Pública | Ninguno; devuelve todas las memberships del usuario | `auth.controller.ts:221-337`. Ver Q02. |
| GET `/auth/context` (`auth.routes.ts:13`) | `requireAuth` | Ninguno | `auth.controller.ts:340-365`. |
| GET `/admin/events` (`routes/admin.routes.ts:47`) | `requireAuth` + `requireAdmin` (global) | Lista solo eventos con admin activo (`admin.controller.ts:228-233`) | Por diseño (`admin.routes.ts:43-44`). Ver H5. |
| GET `/admin/events/:eventId` (`:48`) | `requireEventAdmin(param)` | Admin activo en ese evento | Correcto por lectura. |
| POST `/admin/events` (`:49`) | `requireAuth` + `requireAdmin` (global) | Sin evento previo | Cualquier admin activo puede crear eventos. Ver H5. |
| PATCH `/admin/events/:eventId` (`:50`) | `requireEventAdmin(param)` | Admin activo en ese evento | Correcto por lectura. |
| GET `/admin/committees` (`:53`) | `requireEventAdmin(query)` | Admin activo en `event_id` | Correcto por lectura. |
| GET/PATCH/DELETE `/admin/committees/:committeeId` (`:54-72`) | `requireEventAdmin(eventIdFromCommittee)` | Evento derivado de la BD (`auth.middleware.ts:130-142`) | Correcto por lectura. |
| POST `/admin/committees` (`:60`) | `requireEventAdmin(body)` | Admin activo en `event_id` del body | Correcto por lectura. |
| POST `/admin/memberships` (`:75`) | `requireEventAdmin(body)` | `committee_id` **sin comprobar** que pertenezca a `event_id` | **H1.** `controllers/admin.controller.ts:407-476`; insert con `committee_id` en `:469-476`; ninguna consulta a `committees` en ese rango. |
| POST `/admin/create-account` (`:76`) | `requireEventAdmin(body)` | Comité validado contra el evento (`services/participant-account.service.ts:102-115`) | Correcto por lectura. |
| POST `/admin/participants/import/preview` (`:86`) | `requireEventAdmin(body)` | Comités y códigos cargados por evento (`controllers/admin-participants.controller.ts:30-34`, `:65-71`) | Correcto por lectura. |
| POST `/admin/participants/import/confirm` (`:87`) | `requireEventAdmin(body)` | Filas validadas contra comités del evento (`admin-participants.controller.ts:136-141`) | Correcto por lectura. |
| GET `/admin/participants` (`:89`) | `requireEventAdmin(query)` | Consulta filtrada por `event_id` (`admin.controller.ts:993`) | Correcto por lectura. |
| GET `/admin/participants/:membershipId` (`:90`) | `requireEventAdmin(membresía→evento)` | Evento derivado de la membresía (`auth.middleware.ts:147-159`); lectura posterior por id (`admin.controller.ts:1070-1075`) | Correcto por lectura. |
| PATCH `/admin/participants/:membershipId` (`:91`) | Igual | Comité validado contra el evento del participante (`admin.controller.ts:1154-1170`) | Correcto por lectura. |
| POST `/admin/participants/:membershipId/suspend` (`:92`) | Igual | Estado `SUSPENDED` (`admin.controller.ts:1263`) | Correcto por lectura. |
| POST `.../reactivate` (`:93`) y `.../reset-password` (`:94`) | Igual | `reset-password` devuelve `temporary_password` (`admin.controller.ts:1435`). Ver Q02-8. | Correcto por lectura; ver Q02-8. |
| PATCH `/admin/participants/:membershipId/committee` (`:95`) | Igual | Comité validado contra el evento (`admin-participants.controller.ts:281-294`) | Correcto por lectura. |
| GET `/events/:eventId/walls` (`routes/events.routes.ts:8`) | `requireAuth` | Membresía del `:eventId` en `req.auth.memberships` (`controllers/events.controller.ts:8-20`) | Correcto por lectura; solo muros con `canAccess`. |
| GET `/events/:eventId/committees` (`events.routes.ts:9`) | `requireAuth` | Igual (`events.controller.ts:59-66`) | Correcto por lectura. |
| GET `/events/:eventId/participants` (`events.routes.ts:11`; **añadida en W02, commit `a9b85dd`**) | `requireAuth` | Membresía del evento con `accountStatus === 'ACTIVE'` (`events.controller.ts`, `listEventParticipants`); `x-event-id`, si llega, debe coincidir con la ruta | Guarda correcta por lectura. El servicio `services/participant-directory.service.ts` tiene pruebas con sustitutos (19), sin ejecución contra la base. Cuenta como ruta 47 de este inventario. |
| GET/POST `/posts` (`routes/posts.routes.ts:18-19`) | `requireAuth` | `x-event-id` → membresía (`controllers/posts.controller.ts:12-13`, `:30-31`, `:52-55`) | Correcto por lectura. |
| DELETE `/posts/:postId` (`posts.routes.ts:20`) | `requireAuth` | Post del evento (`services/posts.service.ts:895`); acceso al muro; autor o admin | Correcto por lectura. |
| POST `/posts/:postId/poll/vote` (`:21`) | `requireAuth` | `resolvePostContext` (`posts.service.ts:287-305`, uso en `:613`) | Correcto por lectura. |
| POST `/posts/:postId/poll/close` (`:22`) | `requireAuth` | `closePollService` usa `resolvePostContext` (`posts.service.ts:758-763`) | Correcto por lectura. |
| GET/POST `/posts/:postId/comments` (`:23-24`) | `requireAuth` | `ensurePostAccess` (`services/comments.service.ts:167-185`) | Correcto por lectura. |
| DELETE `/posts/:postId/comments/:commentId` (`:25`) | `requireAuth` | Comentario ligado a post y evento (`comments.service.ts:397-406`) | Correcto por lectura; ver H4. |
| GET `/profiles/me`, PATCH `/profiles/me`, POST `/profiles/me/avatar` (`routes/profiles.routes.ts:15-17`) | `requireAuth` | `x-event-id` → `getActiveMembership` (`controllers/profiles.controller.ts:73-82`) | Correcto por lectura. |
| PATCH `/profiles/:membershipId` y POST `.../avatar` (`profiles.routes.ts:18-19`) | `requireAuth` | Admin activo en el evento de la cabecera (`profiles.controller.ts:232-246`); perfil filtrado por `event_id` (`:121-156`); no edita a otro admin (`:248-255`) | Correcto por lectura. |
| GET `/profiles/:membershipId` (`profiles.routes.ts:20`) | `requireAuth` | Membresía activa en la cabecera; perfil filtrado por evento (`profiles.controller.ts:799-810`) | Observación de diseño: cualquier miembro del evento lee cualquier perfil del mismo evento, sin filtro de comité. Decisión de producto, no fallo técnico. |
| GET/POST `/dm/conversations` (`routes/dm.routes.ts:15-16`) | `requireAuth` | `x-event-id` → membresía (`controllers/dm.controller.ts:16-17`, `:30-34`); destino en el mismo evento (`services/dm.service.ts:231-234`) | Correcto por lectura. |
| GET `/dm/participants` (`dm.routes.ts:17`) | `requireAuth` | Consulta filtrada por `event_id` (`dm.service.ts:171-173`) | Solo lectura. No se modifica según restricciones. |
| GET/POST `/dm/conversations/:conversationId/messages` (`:18-19`) | `requireAuth` | `findConversationForMembership` filtra `event_id` (`dm.service.ts:42-58`) | Correcto por lectura; ver H4 para el UPDATE de `last_message_at` (`:410-412`). |
| DELETE `/dm/conversations/:conversationId/messages/:messageId` (`:20`) | `requireAuth` | Mensaje leído con `event_id` y `conversation_id` (`dm.service.ts:453-458`) | Correcto por lectura; ver H4 para el UPDATE por id (`:506`). |

**Hallazgos de Q01 (evidencia estática).**

| Id | Hallazgo | Cita | Ruta responsable |
| --- | --- | --- | --- |
| H1 | `POST /admin/memberships` acepta un `committee_id` que puede pertenecer a otro evento. Las demás rutas que aceptan comité lo validan. Impacto por confirmar. | `admin.controller.ts:407-476` frente a `participant-account.service.ts:115`, `admin.controller.ts:1154-1170` | API (admin); coordinar con D03–D05 |
| H2 | Endpoint público que, dado un código, devuelve `membership_id` y datos del evento para membresías pendientes. Ese `membership_id` es el identificador que usan los endpoints de perfil. | `routes/auth.routes.ts:9`; `admin.controller.ts:675-731` | API; decisión sobre el contrato público |
| H3 | `requireEventMembership` está exportado y sin uso. El aislamiento de participante depende de una comparación repetida en `events`, `posts`, `dm` y `profiles` (`resolveMembership` en `posts.controller.ts:12` y `dm.controller.ts:16`; `resolveMembershipForEvent` en `events.controller.ts:8`). | `auth.middleware.ts:74-104` | API |
| H4 | UPDATEs por id sin `event_id` tras una lectura acotada. No hay IDOR visible, pero no es defensa en profundidad. Afecta `dm.service.ts:410-412` (`last_message_at` por conversación), `dm.service.ts:506` (mensaje por id) y `comments.service.ts:436` (comentario por id). | Citas indicadas | API |
| H5 | `POST /admin/events` y `GET /admin/events` usan `requireAdmin` global, sin evento objetivo. Está documentado como excepción, pero cualquier admin activo puede crear eventos. | `admin.routes.ts:43-49`; `admin.controller.ts:228-233` | API/admin; decisión de producto |

**Web: consumidores de Supabase.**

- `apps/web/lib/supabase.ts:1-16` crea el único cliente del navegador con la anon key pública; `persistSession: false` (`:11`) y `autoRefreshToken: false` (`:12`). `realtimeEnabled` (`:6`) desactiva el cliente si faltan variables.
- Cuatro módulos importan ese cliente, y todos lo usan solo para Realtime:

| Módulo | Import | Canal y filtro | `setAuth(token)` |
| --- | --- | --- | --- |
| `apps/web/app/(main)/chat/page.tsx` | `:24` | `dm-inbox:` · `event_id=eq.` (`:182-222`; filtros en `:203` y `:213`) | `:189` |
| `apps/web/app/(main)/chat/[id]/page.tsx` | `:15` | `dm-room:` · `conversation_id=eq.`, `id=eq.` (`:171-193`) | `:169` |
| `apps/web/app/(main)/feed/[muro]/page.tsx` | `:11` | `feed-posts:` · `poll_id=eq.`, `wall_id=eq.` (`:102-159`) | `:101` |
| `apps/web/components/feed/PostComments.tsx` | `:5` | `post-comments:` · `post_id=eq.` (`:104-121`) | `:103` |

- Búsqueda en `apps/web` de `.from(`, `.rpc(`, `.storage` y `.auth.`: sin coincidencias. No hay acceso directo a tablas, RPC ni Storage desde el navegador en el código revisado. Las llamadas HTTP a la API no se auditaron en detalle.
- Los filtros `event_id=eq.` y similares los fija el cliente. El aislamiento de Realtime depende de RLS **no versionadas** (`supabase/schema.sql:5`; `docs/02-arquitectura/base-de-datos.md:11`).
- Guardas de sesión y de Realtime deshabilitado: `chat/page.tsx:184-186`, `chat/[id]/page.tsx:164`, `feed/[muro]/page.tsx:93` (incluye `isForbidden`), `PostComments.tsx:95`. Es evidencia de la guarda, no de una vista válida con Realtime apagado.

### Q02 · Límites de uso y auditoría

| Endpoint | Límite 429 | Auditoría de éxito | Auditoría de fallo | Secretos en registro o respuesta |
| --- | --- | --- | --- | --- |
| POST `/auth/login` (`auth.routes.ts:11`) | **No existe.** Sin 429 en `apps/api/src`; sin dependencia de límite en `package-lock.json`. | `auth_attempts` LOGIN/SUCCESS (`auth.controller.ts:320-326`) | `auth_attempts` LOGIN/FAILURE: `MEMBERSHIP_NOT_FOUND` (`:244-249`), `INVALID_CREDENTIALS` (`:291-298`). **Sin registro:** varios usuarios (`:257-262`), usuario no encontrado (`:271-273`), sin email (`:275-277`). | No se registra `password`; solo llega a `signInWithPassword` (`:280-286`). La respuesta de éxito incluye `session` (`:328-331`), esperado. |
| POST `/auth/activate` (`auth.routes.ts:10`) | **No existe.** | `auth_attempts` ACTIVATION/SUCCESS (`auth.controller.ts:196-202`) | ACTIVATION/FAILURE: `MEMBERSHIP_NOT_FOUND` (`:58-64`), `ALREADY_ACTIVATED` (`:72-79`), `INITIAL_PASSWORD_NOT_CONFIGURED` (`:89-96`), `INVALID_INITIAL_PASSWORD` (`:110-117`), error de Auth (`:150-157`). **Sin registro:** `:128-131`, `:174-176`, `:189-193`. | No se registran `initial_password` ni `new_password`. `failure_reason` puede contener texto de Supabase (`:156`). |
| GET `/auth/events-by-code/:participant_code` (`auth.routes.ts:9`) | **No existe.** | Ninguna | Ninguna | Devuelve `membership_id` (`admin.controller.ts:675-731`). |
| GET `/auth/context` (`auth.routes.ts:13`) | No aplica (exige JWT). | Ninguna | Ninguna | Devuelve memberships; no registra el token. |

**Hallazgos de Q02 (evidencia estática).**

| Id | Hallazgo | Cita |
| --- | --- | --- |
| Q02-1 | Sin límite de intentos en login, activación ni consulta por código. `auth_attempts` no guarda IP ni user agent, así que solo sería posible limitar por `participant_code`. No hay `trust proxy` configurado, por lo que la identidad del cliente detrás de un proxy no está definida. | `supabase/schema.sql:54-63`; `apps/api/src/server.ts`; búsqueda de `trust proxy` sin coincidencias |
| Q02-2 | Enumeración: login distingue "Membership no encontrado" (400) de "Credenciales invalidas" (401). El endpoint por código revela membresías pendientes sin autenticación. | `auth.controller.ts:250`, `:299`; `admin.controller.ts:675-731` |
| Q02-3 | `logAuthAttempt` no revisa el `{ error }` que devuelve supabase-js. Un insert rechazado no se registra ni se loguea. `logAudit` sí revisa ese error. | `apps/api/src/utils/auth.logger.ts:16-21`; `audit.logger.ts:64-83` |
| Q02-4 | Activación con estado parcial. Si `createUser` tiene éxito (`auth.controller.ts:140-160`) y falla `users.update` (`:165-176`) o `event_memberships.update` (`:179-193`), la respuesta es error, sin auditoría ni compensación. La cuenta de Auth queda creada con la membresía aún `PENDING_ACTIVATION`. Que el reintento falle por email existente es una inferencia, no verificada en ejecución. | Citas indicadas |
| Q02-5 | Errores de actualización sin revisar: `last_login_at` (`auth.controller.ts:303-312`) no comprueba el error. | `auth.controller.ts:303-312` |
| Q02-6 | Denegaciones sin auditoría. `DENIED` existe en tipo y enum, pero ningún código lo usa. Los 403 de middleware no se auditan. Se registran como `FAILURE`: `POLL_CLOSED` (`services/posts.service.ts:795`, `:840`), `IMPORT_PARTICIPANTS` (`admin-participants.controller.ts:225`, solo si hay filas fallidas) y `DELETE_DM_MESSAGE` (`services/dm.service.ts:479` para un 403 de borrado ajeno, `:513` para error de actualización). | `audit.logger.ts:47`; `schema.sql:9`; `auth.middleware.ts:95-99`, `:190-194` |
| Q02-7 | `logAudit` es best effort: su fallo no interrumpe la escritura. Es el punto que el plan deja pendiente de decisión. | `audit.logger.ts:76-86`; p. ej. `admin.controller.ts:491-498` tras el insert |
| Q02-8 | Secretos en respuesta JSON. `initial_password` se devuelve en `createAccount` (`admin.controller.ts:91`; `admin-participants.controller.ts:184`) y `temporary_password` en `resetParticipantPassword` (`admin.controller.ts:1435`). `Cache-Control: no-store` figura en `createAccount` (`admin.controller.ts:38`) y en `admin-participants.controller.ts:24`, `:128`. El handler de reset (`admin.controller.ts:1360-1437`) no fija esa cabecera en el texto revisado. La razón de auditoría no incluye la contraseña (`admin.controller.ts:1430`). | Citas indicadas |
| Q02-9 | Logs de error. Los `console.error(error)` de los catch (`auth.controller.ts:206`, `:334`, `:360`; `auth.middleware.ts:65`, `:199`) registran el objeto de excepción completo. `auth.controller.ts:50` registra `findError` dentro de un `if` del `try`, no en un catch. No se verificó si el SDK incluye cabeceras o payload. En `apps/api/src` no hay `console` que imprima `body`, `password`, `token` ni `initial_password` (búsqueda estática). | Búsqueda estática |
| Q02-10 | Web: `apps/web/stores/auth.store.ts:142-145` guarda la sesión completa en `localStorage` (`SESSION_KEY`, `TOKEN_KEY`). No es un log, pero deja abierto el riesgo ante XSS o en equipos compartidos. Búsqueda de `console` con `pass`, `token`, `session`, `secret` o `initial` en `apps/web/app`, `lib`, `components` y `stores`: sin coincidencias. | `auth.store.ts:142-145` |

### Q03 · Inventario de base de datos, RLS, Realtime y Node

**Qué está versionado y qué dice el repositorio.**

| Elemento | Versionado | Estado declarado | Evidencia estática |
| --- | --- | --- | --- |
| Snapshot `public` | `supabase/schema.sql` (284 líneas) | Referencia, "no es una migración ejecutable". Extraído el 26-oct-2026, actualizado con la 001 el 5-nov-2026. | `schema.sql:1-6`. Sin índices, RLS, triggers ni funciones (`:5`). "Pendiente: volcar índices y RLS" (`:6`). |
| Migración 001 | `supabase/migrations/001_alias_codigo_fijados_archivos.sql` | "APLICADA" el 2026-11-05, según su encabezado (ejecutada desde el SQL Editor y verificada con `information_schema`, según ese mismo encabezado). | `001:4-5`. `base-de-datos.md:8-11` la califica de histórica y no verificada contra Supabase. |
| Migración 002 | `supabase/migrations/002_codigo_delegacion.sql` | "NO APLICADA". Requiere la 001. | `002:3`. `base-de-datos.md:9`. |
| Documento de base de datos | `docs/02-arquitectura/base-de-datos.md` | Snapshot y migraciones versionados; RLS efectivo, Storage y publicación Realtime por confirmar. | `base-de-datos.md:7-11`, `:35-37` |

**Diferencias detectadas.**

| Id | Diferencia | Cita |
| --- | --- | --- |
| D1 | La API llama a `rpc('assign_delegation_code')`, definida solo en la 002, que no está aplicada. Si falla, la membresía se crea sin `delegation_code` y con aviso. No hay guarda de versión. | `apps/api/src/services/participant-account.service.ts:49`, `:185-194`; `admin.controller.ts:502-510`; `002:34-73` |
| D2 | `base-de-datos.md` dibuja `EVENT_DELEGATION_COUNTERS` en el diagrama de dominio sin marcarlo como pendiente de la 002. | `docs/02-arquitectura/base-de-datos.md:30` |
| D3 | El comentario de `assignDelegationCode` dice "advisory lock", pero la 002 usa `SELECT ... FOR UPDATE` y un upsert del contador. | `participant-account.service.ts:44-45`; `002:45-49`, `:59-63` |
| D4 | `membership_role_enum` declara `PARTICIPANT, MODERATOR, ADMIN_MUN, ADMIN_TECH`. El código decide admin por texto que contenga `ADMIN`, `COORDINADOR` u `ORGANIZADOR`. `COORDINADOR`, `ORGANIZADOR` y `ADMIN` (que se escribe en `apps/api/src/controllers/admin.controller.ts:171` al crear un evento) no están en el enum; si el enum se aplica en la base, no se podrían guardar. Requiere confirmación en base. | `schema.sql:17`; `apps/api/src/utils/rbac.utils.ts:6-13`; `participant-import.utils.ts:101-103`; `AGENTS.md` (provisional) |
| D5 | `membership_account_status_enum` incluye `BLOCKED`, `EXPELLED`, `ARCHIVED`. El código usa `ACTIVE`, `PENDING_ACTIVATION`, `SUSPENDED`. | `schema.sql:16`; `admin.controller.ts:1263`; `auth.controller.ts:70`, `:238` |
| D6 | `auth_attempt_result_enum` incluye `BLOCKED` y `audit_outcome_enum` incluye `DENIED`. El código no escribe ninguno de los dos. | `schema.sql:9-10`, `:60`; `auth.logger.ts:9`; `audit.logger.ts:47` |
| D7 | La tabla `sessions_audit` existe en el snapshot. No hay referencias en `apps/api` ni en `apps/web`. | `schema.sql:232-241`; búsqueda sin coincidencias |
| D8 | La tabla `attachments` (001) tiene RLS habilitado sin políticas. No hay referencias en `apps/api` ni en `apps/web`. El bucket privado se crea desde el panel y no está en el repositorio. | `001:44-61`; búsqueda sin coincidencias |
| D9 | `schema.sql:5` dice que no incluye políticas RLS, pero la 001 (`:61`) y la 002 (`:29-30`) sí habilitan RLS en sus tablas. Las políticas de las tablas principales no están versionadas. | `schema.sql:5`; `001:61`; `002:29-30` |

**No versionado (requiere infraestructura).** Búsqueda en todo el repositorio de `create policy`, `alter publication`, `supabase_realtime`, `storage.buckets` y `create bucket`: sin coincidencias.

- Políticas RLS de las tablas principales (`schema.sql:5`; `base-de-datos.md:11`).
- Publicación Realtime (`supabase_realtime`). Las suscripciones de `apps/web` dependen de ella (ver Q01).
- Buckets y políticas de Storage. `profile-images` figura en código (`apps/api/src/controllers/profiles.controller.ts:85-86`), pero no está creado en el repositorio. El bucket privado de adjuntos (`001:45`) tampoco.
- Índices, triggers y funciones fuera de las migraciones 001 y 002 (`schema.sql:5`).
- DDL base reproducible de las tablas anteriores a la 001 (`base-de-datos.md:7`).
- Configuración de Supabase Auth (confirmación de email, plantillas, límites del proveedor). No está en el repositorio.
- Inventario del proyecto de QA referido en el plan (`03-calidad.md:62`). No está en el repositorio.

**Node: `engines` en `package.json` frente al lockfile.**

| Fuente | Declaración | Observación |
| --- | --- | --- |
| `package.json` (raíz) | `engines.node` = `>=18` (`package.json:18-20`); `packageManager` = `npm@11.6.2` (`:21`) | `apps/api/package.json` y `apps/web/package.json` no declaran `engines`. |
| `package-lock.json`, entrada raíz | `>=18` (`package-lock.json:24`) | Coincide con la raíz. |
| `package-lock.json`, `node_modules/next` 16.1.5 | `>=20.9.0` (`:6548`) | Exige Node 20.9 o superior. |
| `package-lock.json`, `@supabase/supabase-js` 2.101.1 | `>=20.0.0` (`:1792`; también `:1718`, `:1730`, `:1748` en sus dependencias) | Exige Node 20 o superior. |
| Familia `@tailwindcss/oxide`, `eslint`, `@typescript-eslint/*` | `>= 20`; `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` | Excluye algunas versiones de 18 y 20. |
| `docs/04-desarrollo/configuracion-local.md:5` | Documenta Node 20.9 o superior y registra el desajuste con `>=18` como pendiente. | Documentación coherente con el lockfile, no con `engines`. |
| TypeScript | `apps/api/node_modules/typescript` 6.0.2; raíz y web 5.9.2 (`package-lock.json`) | Dos versiones de TypeScript en el lockfile. No afecta a `engines`, sí a la homogeneidad de tipos. |

Conclusión de la evidencia: el mínimo efectivo del lockfile es **Node 20.9**; `engines` declara **18**. No hay `.nvmrc`, `.node-version` ni configuración de `engines` específica por app; `.npmrc` está vacío. El cambio de `engines` queda como decisión posterior, según el plan (`03-calidad.md:62`).

**Pendiente de confirmar en base o en QA** (registrar como **sin ejecutar**): políticas RLS efectivas, publicación Realtime, buckets y sus políticas, aplicación real de la 002, valores reales de `role` y `account_status` (D4, D5) y la configuración efectiva de QA.

## Registro de ejecución

**Estado al 19 de noviembre de 2026.** Ejecución local sobre `e099e37` en `feat/web-improvements`. No se modificó código ni se escribió en la base real. Las casillas siguen sin marcar: su verificación requiere cuentas de prueba, navegador o decisiones pendientes.

| Comprobación | Resultado |
| --- | --- |
| `npm test -w api` | 129 pasan, 0 fallan |
| `npm run check-types -w api` | sin errores |
| `npm run check-types -w web` | sin errores |
| `node --test apps/web/lib/api/base-url.test.mjs` | 2 pasan |
| `node --test apps/web/lib/**/*.test.mjs` | 14 pasan (`apps/web` no define script `test`) |
| `git status --short` y `git diff --check` | sin salida, antes y después |

**Verificación estática de citas.** 97 afirmaciones de Q01–Q03 contrastadas con el código: 84 confirmadas, 11 discrepancias y 2 no verificables (requieren la base viva). Las discrepancias de cita quedan corregidas en este documento:
- Q01: líneas de `chat/page.tsx` (import, `setAuth`, canal y guarda), `persistSession` en `:11` y nombre `resolveMembershipForEvent` en `events.controller.ts:8`.
- Q02: `auth.controller.ts:50` no es un catch; `FAILURE` también se registra en `DELETE_DM_MESSAGE` (`dm.service.ts:479`, `:513`).
- Q03: D4 incluye `ADMIN` (`admin.controller.ts:171`); D9 niega políticas RLS, no RLS; el engine de `@supabase/supabase-js` está en `package-lock.json:1792`.

Los hallazgos H1–H5 y Q02-1 a Q02-10 se confirman en sustancia; no se corrigen aquí porque afectan a rutas o servicios compartidos de API/admin.

**Sondeo dinámico de la API local** (`apps/api` en el puerto 3002, sin tokens de usuario y sin escrituras; lectura de la base real solo en el caso de código inexistente):
- 44 rutas protegidas sin `Authorization`: todas responden 401. Con un token inválido, las 6 primeras probadas también 401. Con las 3 rutas públicas suman las 47 del inventario.
- `GET /auth/events-by-code/:code` con código inexistente: 200 con lista vacía. `POST /auth/activate` y `POST /auth/login` sin cuerpo: 400, sin escritura.
- 60 `POST /auth/login` sin email en ráfaga: 60 respuestas 400 y ningún 429. Confirma Q02-1 para esa rama; el umbral real de contraseñas no se mide sin cuentas.
- CORS: un origen ajeno no se refleja; la API responde solo `WEB_APP_URL`.
- Config: `ALLOW_DEMO_POSTS=true` en `apps/api/.env` no tiene lectura en `apps/api/src`; no tiene efecto.

**Lint web:** `npm run lint -w web` devuelve 0 errores y 32 advertencias (`--max-warnings 0` lo hace fallar). Las advertencias son `<img>` sin `next/image` y dependencias de `useEffect` en `PostComments.tsx`. `npm run build -w web` termina con código 0 y genera todas las rutas, incluidas `/directory` y `/guia`.

**Bloqueado o sin ejecutar** (requiere cuentas de prueba, autorización o decisiones):
- Q01: recorridos con fixtures de QA, cambio de comité, suspensión, retiro de contenido y verificación de RLS/Realtime. Depende de admin.
- Q02: contrato 429, umbral, política ante indisponibilidad de auditoría y pruebas con reloj simulado. Depende de decisiones de API/admin; hoy no existe ningún 429.
- Q03: base desechable, orden 001→002 y carga. Depende de la autorización del responsable. `supabase/migrations/002_codigo_delegacion.sql:5` indica que la base es compartida y de producción; confirmar el destino antes de cualquier prueba.
- Engines de Node: decisión posterior, sin cambio.
