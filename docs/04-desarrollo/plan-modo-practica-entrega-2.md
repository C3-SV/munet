# Modo práctica, entrega 2 (superficies): plan de implementación

> **Para agentes:** SUB-HABILIDAD REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas `- [ ]`.

**Meta:** que el simulador local del modo práctica atienda las superficies de participante (muro, encuestas, comentarios, adjuntos locales, directorio, perfil y mensajes directos con respuestas simuladas) con las mismas formas de respuesta y los mismos mensajes de error que la API, más los cuatro diferidos de la entrega 1.

**Arquitectura:** el estado de práctica (`PracticeState`) crece a la versión 2 con el contenido mutable (publicaciones, comentarios, votos, conversaciones, mensajes, metadatos de adjuntos, perfil editado). `routePracticeRequest` sigue siendo síncrono y puro respecto a la red: una tabla de rutas con parámetros que **muta el estado recibido** y devuelve la respuesta; la pasarela guarda el estado tras cada escritura. Los adjuntos (binarios) y las URL locales los maneja la pasarela, que es asíncrona. Los constructores de vistas (`views.ts`) convierten el estado en los tipos reales que consume la interfaz.

**Tecnología:** TypeScript (Next 16 / React 19 / zustand), pruebas `node:test` en `*.test.mjs` que importan `.ts` con extensión (Node 22, sin `enum` ni propiedades de parámetro), IndexedDB.

**Diseño (autoridad):** `docs/04-desarrollo/diseno-sandbox-conoce-munet.md`. **Contratos exactos de la API** (rutas, formas, errores literales): `.superpowers/contratos-superficies.md` (local, no versionado; el implementador de cada tarea recibe el extracto que necesita en su encargo).

## Restricciones globales

- La práctica nunca usa red, ni envía token, ni escribe en R2 o Supabase. Todo camino sin simular responde `PracticeRequestError(501, PRACTICE_UNAVAILABLE_MESSAGE)`.
- Los textos de error son **literales** los de la API real (con sus tildes y erratas, p. ej. `La encuesta esta cerrada`, `No puedes iniciar una conversacion contigo mismo`).
- Autoría propia = `PRACTICE_MEMBERSHIP_ID` (`"practice-membership"`) como `user.id` y `senderId`.
- Avatares: siempre `avatarFor(iniciales)` (data URI); nunca `ui-avatars.com`.
- Tiempo: `createdAt` ISO y `timestamp = Date.parse(createdAt)`. Ids: `practice-<tipo>-<n>` con contador `state.seq`.
- Límites locales (solo endurecen RN-11): como máximo **2 adjuntos** en total, imágenes JPG/PNG hasta **2 MB**, PDF hasta **5 MB**; tope total de datos **25 MB** (estado + binarios); la persona crea como máximo **30 publicaciones** y **100 comentarios**. Mensajes en `lib/practice/limits.ts`.
- Dentro de `lib/practice/` los imports llevan `.ts`; fuera, sin extensión. Sin dependencias nuevas. Cada regla del simulador tiene su prueba.
- El estado de práctica pasa a `PRACTICE_STATE_VERSION = 2`; un estado de versión distinta se reinicia solo y la persona lo ve (tarea 8).
- Cada commit termina con `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>` cuando lo hace un implementador Haiku. Sin `push`.

## Review Focus

- Muro de comité ajeno: leer, publicar, comentar, votar y descargar adjuntos responden 403 con el mensaje de cada operación (prueba en tareas 3 y 4).
- Entradas vacías o solo espacios en publicación, comentario y mensaje; opciones de encuesta duplicadas (sin distinguir mayúsculas) y con espacios (tarea 4 y 5).
- Borrar una publicación con comentarios y luego pedir comentarios, votos o descarga: 404 `Post no encontrado en este evento` (tarea 4 y 5).
- Reiniciar la práctica con adjuntos ya guardados: los binarios también se borran y no quedan URL temporales vivas (tarea 7).
- Almacenamiento lleno o límite local alcanzado: mensaje claro, la publicación no se crea a medias y la aplicación real no se afecta (tareas 4 y 7).

---

### Task 1: Modelo de estado v2, cohorte y contenido sembrado

**Archivos:**
- Crear: `apps/web/lib/practice/limits.ts`, `apps/web/lib/practice/model.ts`, `apps/web/lib/practice/people.ts`, `apps/web/lib/practice/seed.ts`
- Modificar: `apps/web/lib/practice/state.ts`, `apps/web/lib/practice/constants.ts`, `apps/web/lib/practice/storage.ts` (validador `isStoredState`)
- Prueba: `apps/web/lib/practice/seed.test.mjs`, actualizar `state.test.mjs`, `storage.test.mjs`, `constants.test.mjs`

**Interfaces:**
- Consume: `PRACTICE_COMMITTEES` y `buildPracticeWalls` (`catalog.ts`), `personaFor`, `avatarFor`, `PracticePersona` (`state.ts`).
- Produce:
  - `limits.ts`: `PRACTICE_LIMITS = { maxAttachments: 2, maxImageBytes: 2*1024*1024, maxPdfBytes: 5*1024*1024, maxTotalBytes: 25*1024*1024, maxOwnPosts: 30, maxOwnComments: 100, maxPollOptions: 10, minPollOptions: 2, maxDmReplies: 3 }` y los textos `PRACTICE_LIMIT_MESSAGES` (claves `attachments`, `imageSize`, `pdfSize`, `totalBytes`, `ownPosts`, `ownComments`), por ejemplo «En la práctica solo puedes guardar 2 adjuntos. Reinicia la práctica para empezar de cero.».
  - `model.ts` (tipos de estado, todos serializables):
    - `PracticePerson = { membershipId: string; firstName: string; lastName: string; alias: string | null; committeeId: string; delegation: string; delegationCode: string; role: "PARTICIPANT" }`
    - `PracticeAttachment = { id: string; name: string; mimeType: string; size: number }`
    - `PracticePoll = { status: "OPEN" | "CLOSED"; options: { id: string; text: string }[]; votes: Record<string, string> }` (clave = membershipId de quien vota, valor = id de opción)
    - `PracticePost = { id: string; authorId: string; wallSlug: string; postType: "TEXT" | "POLL"; content: string; createdAt: string; pinned: boolean; deleted: boolean; poll: PracticePoll | null; attachment: PracticeAttachment | null }`
    - `PracticeComment = { id: string; postId: string; parentCommentId: string | null; authorId: string; content: string; createdAt: string; deleted: boolean }`
    - `PracticeConversation = { id: string; otherId: string; createdAt: string }`
    - `PracticeMessage = { id: string; conversationId: string; senderId: string; content: string; createdAt: string; deleted: boolean }`
    - `PracticeProfileEdit = { displayName: string | null; alias: string | null; bio: string; avatar: string | null }`
    - `PracticeUpload = { id: string; wallSlug: string; fileName: string; mimeType: string; size: number }`
    - `PracticeStateV2 = PracticeState` ampliado con: `seq: number; people: PracticePerson[]; posts: PracticePost[]; comments: PracticeComment[]; conversations: PracticeConversation[]; messages: PracticeMessage[]; profile: PracticeProfileEdit; uploads: PracticeUpload[]; replyCounts: Record<string, number>` (respuestas simuladas dadas por conversación).
  - `people.ts`: `PRACTICE_PEOPLE_BASE: Omit<PracticePerson,"committeeId">[]`-equivalente: **8 personas de ejemplo** con ids `practice-person-1..8`, repartidas en los 4 comités (2 por comité), delegaciones distintas de la persona de la cuenta; `PRACTICE_DM_REPLIES: Record<string, string[]>` con 3 respuestas cortas en español por persona (sin lógica de palabras clave); `buildPracticePeople(persona: PracticePersona): PracticePerson[]` (excluye una persona de ejemplo cuya delegación coincida con la de la cuenta, para no duplicar la delegación).
  - `seed.ts`: `buildSeed(persona: PracticePersona, now: Date): { posts; comments; conversations; messages; seq: number }` con: 2 avisos fijados en `avisos`, 3 publicaciones en `general`, 1–2 por muro de comité, **1 encuesta** en `general` (3 opciones, con votos de ejemplo de varias personas, ninguno de la cuenta), 4–6 comentarios (uno con respuesta de primer nivel), **2 conversaciones sembradas** con 2 personas de ejemplo (2–3 mensajes cada una) y **2 publicaciones con adjunto** (`practice-seed-att-image`: PNG `ejemplo-imagen.png`, y `practice-seed-att-pdf`: PDF `procedimiento-de-debate.pdf`; solo metadatos, los binarios se generan en la tarea 7). Fechas relativas a `now` (de hace horas a hace días). Ids con el contador `seq`.
  - `createInitialState(userId, now)` devuelve el estado v2 completo (persona, personas, semilla, `profile: { displayName: null, alias: null, bio: "", avatar: null }`, `uploads: []`, `replyCounts: {}`).
  - `isStoredState` exige además arreglos en `people`, `posts`, `comments`, `conversations`, `messages`, `uploads` y un objeto `profile` y `replyCounts`; si no, el estado se reinicia.
  - `PRACTICE_STATE_VERSION = 2`.

- [ ] **Paso 1: pruebas que fallan.** `seed.test.mjs`: (a) `buildPracticePeople` devuelve 7 u 8 personas, con ids únicos y al menos una por comité; (b) la semilla tiene al menos 2 avisos fijados en `avisos`, la encuesta con 3 opciones y votos cuyos votantes existen en `people`, ningún voto de `PRACTICE_MEMBERSHIP_ID`; (c) todo `authorId`/`otherId`/`senderId` pertenece a `people` o es `PRACTICE_MEMBERSHIP_ID`; (d) los comentarios apuntan a publicaciones existentes y ninguno responde a una respuesta; (e) exactamente 2 publicaciones con adjunto y tamaños dentro de `PRACTICE_LIMITS`; (f) ids únicos y `seq` mayor que el número usado en cualquier id; (g) `createInitialState` es serializable (`JSON.parse(JSON.stringify(x))` igual) y mismo `userId` + mismo `now` da el mismo estado. `storage.test.mjs`: un estado v1 o con arreglos faltantes se reinicia (`wasReset: true`); un v2 válido se reutiliza. `constants.test.mjs`: versión 2.
- [ ] **Paso 2: ejecutar y ver que fallan** (`cd apps/web && node --test lib/practice/*.test.mjs`).
- [ ] **Paso 3: implementar** los archivos y cambios de **Interfaces**. El texto del contenido sembrado va en español neutro y trata de temas de un Modelo de Naciones Unidas (bienvenida, reglas de debate, tiempos de intervención); los avisos los publica una cuenta ficticia con rol visible `ADMIN_MUN` solo en el campo de vista (la tarea 2 define cómo se muestra); aquí `authorId` de avisos es `practice-person-staff`, que se agrega a `people` con `role` `"ADMIN_MUN"` (ajustá el tipo `PracticePerson.role` a `"PARTICIPANT" | "ADMIN_MUN"`).
- [ ] **Paso 4: ejecutar** las pruebas de `lib/practice` y `cd apps/web && npx tsc --noEmit`; deben pasar (las pruebas de entrega 1 que dependan de la forma de `createInitialState` se actualizan sin perder cobertura).
- [ ] **Paso 5: commit** `feat(web): estado v2 de la practica con cohorte y contenido sembrado`.

---

### Task 2: Constructores de vistas (estado a tipos de la interfaz)

**Archivos:**
- Crear: `apps/web/lib/practice/views.ts`
- Prueba: `apps/web/lib/practice/views.test.mjs`

**Interfaces:**
- Consume: `model.ts`, `people.ts`, `state.ts` (`avatarFor`), `catalog.ts`, tipos reales de `types/common.ts`, `types/chat.ts`, `lib/api/feed.ts`, `lib/api/directory.ts` (todos con `import type`).
- Produce (todas puras, reciben el estado y devuelven el tipo real; `me` = `PRACTICE_MEMBERSHIP_ID`):
  - `findPerson(state, membershipId): PracticePerson | null` (incluye a la propia persona mapeada desde `state.persona` y `state.profile`)
  - `toUser(state, membershipId): User` (`name` = `displayName`, `alias`, `committeeName`, `avatar` = `avatarFor(iniciales)`, `role`)
  - `toPost(state, post): Post` (campos `postType`, `title: null`, `canDelete` si es propio, `commentCount` = comentarios no borrados, `attachment` con `canRemove` si es propio, `poll` con `percentage = Math.round(votos/total*100)` o 0, `isSelectedByMe`, `canVote` = abierta y no borrada, `canClose` = abierta y propia, `committeeTags: []`, `isDeleted: false`, `timestamp`, además `isPinned`/`pinnedAt`)
  - `toPostDeleted(state, post): Post` (`isDeleted: true`, `deletedByActorType: "AUTHOR"`, `content: "Esta publicacion fue eliminada por el autor."`, `attachment: null`, encuesta con `canVote`/`canClose` en false)
  - `toComment(state, c): PostComment`, `toCommentDeleted(state, c): PostComment` (`"Este comentario fue eliminado por el autor."`)
  - `toWallView(state, slug): EventWall | null`
  - `toConversationSummary(state, conversation): ConversationSummary` (último mensaje no borrado; `otherParticipant` con `committee` = nombre del comité, `lastActive: "Activo"`, `delegationName`, `institutionName: null`)
  - `toDirectoryEntry(state, person): ParticipantDirectoryEntry`, `toMyProfile(state): MyProfile`, `toPublicProfile(state, membershipId): PublicProfile | null`
  - `sortPostsForWall(posts): PracticePost[]` (fijados primero, luego `createdAt` descendente) y `normalizeSearch(text): string` (sin tildes ni mayúsculas).

- [ ] **Paso 1: pruebas que fallan.** Para cada constructor, una prueba de forma con `deepEqual` de las claves esperadas (comparadas con las claves de los tipos reales listadas en el contrato) y los casos: publicación propia (`canDelete` y `canRemove` verdaderos) y ajena (falsos); encuesta sin votos (`percentage` 0, `totalVotes` 0) y con votos redondeados; encuesta cerrada (`canVote` y `canClose` falsos); voto propio marca `isSelectedByMe`; `toUser` para la propia persona usa `displayName` editado de `state.profile` si existe; `normalizeSearch("ÁrBol")` es `"arbol"`; `sortPostsForWall` pone fijados primero; `toConversationSummary` sin mensajes da `lastMessage: null`; el avatar de todos los usuarios empieza con `data:`.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** `views.ts` con las firmas de **Interfaces**; cada tipo se importa con `import type` para que el compilador marque la deriva.
- [ ] **Paso 4: ejecutar** las pruebas y `npx tsc --noEmit`.
- [ ] **Paso 5: commit** `feat(web): vistas del simulador de la practica con los tipos de la interfaz`.

---

### Task 3: Enrutador con parámetros y lecturas

**Archivos:**
- Modificar: `apps/web/lib/practice/router.ts` (reestructurar), `apps/web/lib/practice/router.test.mjs`
- Crear: `apps/web/lib/practice/router-read.test.mjs`

**Interfaces:**
- Consume: `views.ts`, `model.ts`, `limits.ts`, `PracticeRequestError`.
- Produce:
  - `routePracticeRequest(request: PracticeRequest, state: PracticeState, options?: { now?: Date }): unknown` mantiene su firma (tercer parámetro opcional). La tabla de rutas pasa a aceptar patrones con parámetros (`:postId`, `:commentId`, `:conversationId`, `:messageId`, `:membershipId`), cualquier método y `body`; el manejador recibe `{ params, query, body, state, now }`. La comparación sigue siendo por segmentos exactos y decodificando cada segmento después de separar; método en mayúsculas; sin ruta, 501.
  - Rutas de lectura nuevas (todas `GET`, formas y errores del contrato):
    - `/posts?muro=<slug>` (si falta `muro`, usa `general`; reemplaza el 501 de la entrega 1): `{ wall, posts }` ordenado con `sortPostsForWall`, sin publicaciones borradas.
    - `/posts/:postId/comments`: `{ comments }` ascendente, sin borrados. Errores en orden: 404 `Post no encontrado en este evento`, 403 `No tienes acceso a los comentarios de este post`.
    - `/events/practice-local/participants?page&limit&q&committee_id`: `{ participants, page, limit, hasMore }` (incluye a la propia persona; orden apellido, nombre, id; `q` sin tildes sobre nombre, apellido, nombre completo, alias y código sin `#`; validaciones de `page`, `limit`, `q`, y `committee_id` debe ser un id de comité de práctica, si no 400 `committee_id no pertenece a este evento`).
    - `/profiles/:membershipId`: `{ profile }` público; 404 `Perfil no encontrado`. `/profiles/me` pasa a usar `toMyProfile`.
    - `/dm/conversations`: `{ conversations }` ordenadas por último mensaje descendente y luego `createdAt`.
    - `/dm/conversations/:conversationId/messages`: `{ messages }` ascendente sin borrados; 404 `Conversacion no encontrada`.
    - `/dm/participants?search=`: `{ participants }` (ChatParticipant, excluye a la propia persona, filtro sin tildes sobre «nombre comité rol delegación», máximo 20).
  - `/events/practice-local/walls` ahora devuelve solo muros con `canAccess` verdadero (como la API real); `committees` no cambia.

- [ ] **Paso 1: pruebas que fallan** (`router-read.test.mjs`, con `fetch` que lanza antes de cada prueba y `createInitialState("u1", new Date("2026-11-21T12:00:00Z"))`): (a) `GET /posts?muro=general` y sin `muro` devuelven lo mismo, fijados primero, `wall.slug === "general"`; (b) muro de otro comité → 403 `No tienes acceso a este muro`; muro inexistente → 404; (c) comentarios de una publicación de la semilla en orden ascendente; de una publicación inexistente 404; (d) directorio: `limit=3` da `hasMore` verdadero y la página 2 sigue el orden; `q=` con tilde y mayúsculas encuentra; `q` por `#` + código encuentra; `page=0` → 400 `page debe ser un entero mayor o igual a 1`; `limit=101` → 400 `limit debe ser un entero entre 1 y 100`; `committee_id=otro` → 400; (e) `GET /profiles/practice-person-1` forma pública sin `participantCode`, id inexistente 404 `Perfil no encontrado`; (f) conversaciones sembradas: 2, ordenadas; mensajes en orden; conversación inexistente 404; (g) `/dm/participants?search=` excluye a la propia persona y respeta el tope; (h) `walls` ya no incluye muros de comités ajenos; (i) ruta con método distinto (`POST /posts/x/comments` aún sin escritura) → 501; (j) ningún camino toca `fetch`. Las pruebas de la entrega 1 en `router.test.mjs` se ajustan solo donde cambió el contrato (muros sin `canAccess:false`; `/posts` sin `muro`).
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** la reestructura: tabla `ROUTES` con `{ method, pattern, handler }`, función `matchRoute(segments, pattern)` con parámetros, manejadores de lectura nuevos. Los mensajes de error son los literales del contrato.
- [ ] **Paso 4: ejecutar** `node --test lib/practice/*.test.mjs` y `npx tsc --noEmit`.
- [ ] **Paso 5: commit** `feat(web): rutas con parametros y lecturas del simulador de la practica`.

---

### Task 4: Escrituras de publicaciones, encuestas y adjuntos (metadatos)

**Archivos:**
- Crear: `apps/web/lib/practice/router-posts.ts` (manejadores), `apps/web/lib/practice/router-posts.test.mjs`
- Modificar: `apps/web/lib/practice/router.ts` (registrar rutas)

**Interfaces:**
- Consume: tarea 3 (tabla de rutas, `RouteContext`), `views.ts`, `model.ts`, `limits.ts`.
- Produce (todas mutan `state` y devuelven la forma del contrato; ids `practice-post-<n>`, `practice-upload-<n>`, `practice-opt-<n>`):
  - `POST /posts/attachments/init` body `{ muro, file_name, mime_type, size }` → 201 `{ upload: { id, url: "practice-upload://<id>", method: "PUT", headers: {}, expiresAt } }`. Registra el ticket en `state.uploads`. Errores en el orden del contrato: tipo no admitido 400 `Solo se admiten imágenes JPG o PNG y archivos PDF.`; tamaño no entero positivo 400 `El tamaño del archivo no es válido.`; tamaño sobre el límite **local** (`El archivo supera el máximo de 2 MB para este tipo.` para imágenes y `... 5 MB ...` para PDF); nombre inválido 400 `El nombre del archivo no es válido.`; muro 404/403 y avisos 403 `No tienes permisos para publicar en este muro`; ya hay 2 adjuntos guardados o pendientes → 400 con `PRACTICE_LIMIT_MESSAGES.attachments`.
  - `POST /posts` body `{ muro, content, post_type, poll_options?, upload_id? }` → 201 `{ post }`. Orden de reglas del contrato: contenido vacío 400 `El contenido es obligatorio`; encuesta con menos de 2 opciones válidas (recorte, sin vacías, sin duplicados sin distinguir mayúsculas) 400 `Una encuesta debe tener al menos 2 opciones validas`; más de 10 400 `Una encuesta puede tener maximo 10 opciones`; muro 404, 403 `No tienes acceso a este muro`, 403 `No tienes permisos para publicar en este muro`; límite local de publicaciones propias (`PRACTICE_LIMIT_MESSAGES.ownPosts`, 400); con `upload_id`: no registrado 404 `Subida no encontrada`; muro distinto 400 `La subida corresponde a otro muro`; ya consumido con post → 200 con el mismo post (reintento idempotente); si no, crea el adjunto desde el ticket y consume el ticket. Se ignora `poll_options` en TEXT.
  - `DELETE /posts/:postId` → 200 `{ post }` borrado (`toPostDeleted`), marca `deleted`, limpia el adjunto (devuelve en el contexto `releasedBlobIds` con el id del binario para que la pasarela lo borre). Errores: 404 `Post no encontrado en este evento`; 403 `No tienes permisos para eliminar esta publicacion` (ajeno; incluidas las del personal ficticio).
  - `POST /posts/:postId/poll/vote` body `{ option_id }` → 200 `{ post }`; errores en el orden del contrato (`option_id es requerido`, 404 post, 403 `No tienes acceso a este post`, 400 `Este post no es una encuesta`, 400 `La encuesta esta cerrada`, 404 `Opcion de encuesta no encontrada`); el voto reemplaza el anterior.
  - `POST /posts/:postId/poll/close` → 200 `{ post }`; 403 `Solo el creador puede cerrar esta encuesta` (la comprobación de autoría va antes que la de ya cerrada; cerrar una propia ya cerrada es 200).
  - `DELETE /posts/:postId/attachment` → 200 `{ removed: true, postId, attachmentId }`; 403 `Solo el autor puede retirar el adjunto`; 404 `El post no tiene adjunto`; libera el binario.
  - `RouteContext` gana `released: string[]`; `routePracticeRequest` devuelve la respuesta y la pasarela lee `released` mediante una función exportada `routePracticeRequestDetailed(request, state, options): { result: unknown; released: string[]; wrote: boolean }` (la `routePracticeRequest` existente la envuelve y devuelve solo `result`). `wrote` es verdadero si alguna escritura cambió el estado.

- [ ] **Paso 1: pruebas que fallan** (`router-posts.test.mjs`, `fetch` que lanza): una prueba por regla del contrato y por mensaje literal de arriba, más: crear un TEXT y verlo primero en `GET /posts?muro=general` con `commentCount: 0` y `canDelete: true`; crear POLL con opciones `["Sí ", "no", "SÍ"]` queda con 2 opciones (`Sí`, `no`: recorta y descarta el duplicado sin distinguir mayúsculas), y `["Sí", "SÍ"]` falla con `Una encuesta debe tener al menos 2 opciones validas`; POLL con 11 opciones válidas falla; publicar en `avisos` 403 permisos; publicar en comité ajeno 403 acceso; flujo adjunto: init → crear con `upload_id` → el post trae `attachment` con `canRemove: true`; repetir el mismo `upload_id` devuelve 200 y no duplica; tras crear 2 publicaciones propias con adjunto, un tercer `init` responde el límite (los 2 adjuntos sembrados no cuentan); votar cambia el voto (los conteos suman 1 voto por persona); cerrar y luego votar 400; cerrar la encuesta de otra persona 403; borrar propia vuelve invisible la publicación y votar/comentar después da 404; borrar ajena 403; el contador `ownPosts` bloquea el post 31 con el mensaje de límite; `released` contiene el id del binario al borrar una publicación con adjunto o retirar el adjunto. *Nota:* el límite de adjuntos cuenta solo los adjuntos creados por la persona (los 2 sembrados no cuentan); ajustá la comprobación de la tarea 1 si hiciera falta.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** `router-posts.ts` y registrar las rutas; normalización de opciones: recortar, quitar vacías, deduplicar sin distinguir mayúsculas conservando la primera aparición.
- [ ] **Paso 4: ejecutar** las pruebas y `npx tsc --noEmit`.
- [ ] **Paso 5: commit** `feat(web): publicaciones, encuestas y adjuntos simulados en la practica`.

---

### Task 5: Comentarios y perfil

**Archivos:**
- Crear: `apps/web/lib/practice/router-comments.ts`, `apps/web/lib/practice/router-profile.ts`, pruebas `router-comments.test.mjs`, `router-profile.test.mjs`
- Modificar: `apps/web/lib/practice/router.ts` (registrar rutas)

**Interfaces:**
- Consume: tareas 3 y 4.
- Produce:
  - `POST /posts/:postId/comments` body `{ content, parent_comment_id? }` → 201 `{ comment }`. Errores en el orden del contrato: 404 `Post no encontrado en este evento` (también publicación borrada); 403 `No tienes acceso a los comentarios de este post`; 403 `No tienes permisos para comentar en avisos`; 400 `El comentario no puede estar vacio`; 404 `Comentario padre no encontrado para este post`; 400 `Solo se permite un nivel de respuesta`; límite local de comentarios propios (400 con `PRACTICE_LIMIT_MESSAGES.ownComments`).
  - `DELETE /posts/:postId/comments/:commentId` → 200 `{ comment }` borrado (`toCommentDeleted`); 404 `Comentario no encontrado en este post`; 403 `No tienes permisos para eliminar este comentario`; borrar un comentario padre no borra los hijos.
  - `PATCH /profiles/me` body `{ display_name?, alias?, bio?, profile_image_path? }` → 200 `{ profile }`. Campos protegidos presentes (`role`, `participant_code`, `delegation_code`, `committee_id`, en ese orden) → 400 `No puedes modificar estos campos: <lista separada por ", ">`; `alias` no texto 400 `alias debe ser texto`, recortado de más de 60 caracteres 400 `alias admite hasta 60 caracteres`, vacío o espacios = sin alias (`null`); `display_name` vacío vuelve al nombre de la persona; `bio` se guarda tal cual; `profile_image_path` se ignora (no existe subida de imagen por ruta en práctica).
  - `POST /profiles/me/avatar` body `{ file_name, mime_type, base64_data }` → 200 `{ profile }` con `avatar` = `data:<mime>;base64,<datos>`; formatos `image/jpeg`, `image/png`, `image/webp` (si no 400 `Formato de imagen no permitido`); vacío 400 `No se recibio el archivo a subir`; mayor de **256 KB** decodificados 400 `La imagen debe tener un tamano maximo de 256KB en la practica` (límite local para no inflar el estado; agregalo a `PRACTICE_LIMITS.maxAvatarBytes`).
  - `PATCH /profiles/:membershipId` y `POST /profiles/:membershipId/avatar` quedan en 501.

- [ ] **Paso 1: pruebas que fallan:** una prueba por regla y mensaje de arriba; además: comentar y ver `commentCount` +1 en el listado del muro; responder a un comentario sembrado de primer nivel funciona y responder a esa respuesta da 400; comentar en una publicación borrada da 404; comentar en `avisos` da 403 permisos; borrar el comentario propio lo quita del listado y deja los hijos; borrar el de otra persona 403; `PATCH /profiles/me` con `alias: "  "` da `alias: null`, con alias de 61 caracteres 400, con `role` y `committee_id` juntos da el mensaje con la lista ordenada; `display_name: ""` restaura el nombre; el nombre editado aparece en `toUser` de las publicaciones propias; el avatar subido (un PNG mínimo en base64) aparece en `GET /profiles/me` y en el autor de las publicaciones propias; avatar `image/gif` falla; sin `fetch`.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** manejadores y registro de rutas.
- [ ] **Paso 4: ejecutar** las pruebas y `npx tsc --noEmit`.
- [ ] **Paso 5: commit** `feat(web): comentarios y perfil simulados en la practica`.

---

### Task 6: Mensajes directos con respuestas simuladas

**Archivos:**
- Crear: `apps/web/lib/practice/router-dm.ts`, `apps/web/lib/practice/router-dm.test.mjs`
- Modificar: `apps/web/lib/practice/router.ts` (registrar rutas)

**Interfaces:**
- Consume: tareas 3 a 5, `PRACTICE_DM_REPLIES` y `PRACTICE_LIMITS.maxDmReplies` (tarea 1).
- Produce:
  - `POST /dm/conversations` body `{ targetMembershipId }`: 201 `{ conversation }` si crea, **200** si ya existe (mismo par); la conversación devuelta lleva `lastMessage: null` y `lastMessageAuthorId: null`. Errores en el orden del contrato: 400 `targetMembershipId es requerido`; 400 `No puedes iniciar una conversacion contigo mismo`; 404 `Participante no encontrado en este evento` (solo existen las personas de `state.people`).
  - `POST /dm/conversations/:conversationId/messages` body `{ content }` → 201 `{ message }` (campos `id`, `conversationId`, `text`, `senderId`, `createdAt`, `timestamp: "HH:MM"`). Errores: 400 `El mensaje no puede estar vacio` (se evalúa antes del acceso); 404 `Conversacion no encontrada`. **Respuesta simulada:** tras guardar el mensaje, si `replyCounts[conversationId] < maxDmReplies`, se agrega **un** mensaje de la otra persona con la siguiente respuesta de su lista (`PRACTICE_DM_REPLIES[otherId][replyCounts]`), con `createdAt` = `now + 1 s`, y se incrementa el contador; la respuesta de esa llamada solo trae el mensaje de la persona (la interfaz relee los mensajes; confirmalo leyendo `chat/[id]/page.tsx` y, si la pantalla solo añade el devuelto, hacé que la respuesta llegue también en la relectura siguiente). Sin lógica por palabras clave.
  - `DELETE /dm/conversations/:conversationId/messages/:messageId` → 200 `{ success: true }`; 404 `Conversacion no encontrada`; 404 `Mensaje no encontrado`; 403 `Solo puedes eliminar tus propios mensajes`.
  - `GET /dm/conversations/:conversationId/messages` ya existe (tarea 3).
  - Importante: la respuesta simulada se agrega en el mismo paso de escritura (misma llamada), para que persista junto con el mensaje y no dependa de temporizadores.

- [ ] **Paso 1: pruebas que fallan:** crear conversación con `practice-person-3` (201) y repetir (200, mismo id); a sí misma 400; id desconocido 404; vacío 400; enviar un mensaje en una conversación sembrada: aparece el mensaje y **una** respuesta de la otra persona al releer; tras `maxDmReplies` envíos, los siguientes no reciben respuesta; las respuestas salen en orden de su lista y sin repetir; mensaje vacío con conversación inexistente da 400 (orden de la API); borrar mensaje propio 200 y desaparece del listado y de `lastMessage`; borrar uno de la otra persona 403; conversación inexistente 404; el estado sigue siendo serializable; sin `fetch`.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** manejadores y registro de rutas.
- [ ] **Paso 4: ejecutar** las pruebas y `npx tsc --noEmit`.
- [ ] **Paso 5: commit** `feat(web): mensajes directos con respuestas simuladas en la practica`.

---

### Task 7: Pasarela con persistencia de escrituras, binarios y límites de espacio

**Archivos:**
- Crear: `apps/web/lib/practice/seed-files.ts`, `apps/web/lib/practice/uploads.ts`, pruebas `seed-files.test.mjs`, `uploads.test.mjs`
- Modificar: `apps/web/lib/practice/gateway.ts`, `apps/web/lib/practice/gateway.test.mjs`, `apps/web/lib/api/feed.ts` (callback `upload`)

**Interfaces:**
- Consume: `routePracticeRequestDetailed` (tarea 4), `PracticeStorage.putBlob/getBlob/deleteBlob`, `PRACTICE_LIMITS`.
- Produce:
  - `uploads.ts`: `stashPracticeFile(uploadId: string, file: File): void`, `takePracticeFile(uploadId: string): File | null` y `clearPracticeFiles(): void` (un `Map` en memoria; los archivos no se guardan en el estado hasta que la publicación se crea).
  - `seed-files.ts`: `makeSeedPng(): Uint8Array` (PNG válido RGB, 480×240, degradado y franja clara, **sin** `zlib`: bloques deflate sin comprimir, CRC32 y Adler-32 implementados a mano) y `makeSeedPdf(): Uint8Array` (PDF mínimo de una página con el texto «Procedimiento de debate»; ASCII). `seedBlobFor(attachmentId: string): Blob | null` para `practice-seed-att-image` y `practice-seed-att-pdf`.
  - `gateway.runPracticeRequest` pasa a: llamar a `routePracticeRequestDetailed`; **antes** de enrutar `POST /posts` con `upload_id`, tomar el archivo de `uploads.ts` (si falta responde 404 `Subida no encontrada`); si `wrote`, guardar el estado (`save`) y, para una publicación nueva con adjunto, `putBlob(<attachmentId>, file)` **antes** de guardar; los `released` se borran con `deleteBlob`. Un `save`/`putBlob` que rechace por cuota (`QuotaExceededError`, o cualquier rechazo) con `PRACTICE_LIMIT_MESSAGES.totalBytes` como 507 no se traga: se **revierte** el estado en memoria al último guardado (restaurar una copia hecha antes de enrutar con `structuredClone`) y se responde `PracticeRequestError(507, <mensaje>)`; no se degrada a memoria silenciosamente para escrituras de contenido (sí para el estado vacío inicial, como hoy). Tope total: si `JSON.stringify(state).length + suma de tamaños de adjuntos` supera `maxTotalBytes`, 507 con el mismo mensaje.
  - `GET /posts/:postId/attachment/download` lo resuelve la pasarela: valida con el enrutador (nueva ruta de solo validación en `router-posts.ts` que devuelve `{ attachmentId }` y los errores del contrato: 404 post, 403 `No tienes acceso a este post`, 404 `El post no tiene adjunto`), obtiene el binario con `getBlob` (o `seedBlobFor` si es sembrado), crea `URL.createObjectURL` y responde `{ url, expiresAt }`; las URL se registran y se revocan al reiniciar o al cambiar de usuario.
  - `resetPractice(userId)` también ejecuta `clearPracticeFiles()` y revoca las URL temporales.
  - `feed.ts`: en el callback `upload` de `publishFeedPost`, si `isPracticeEvent(eventId)`, en lugar de lanzar, llama a `stashPracticeFile(ticket.id, file)` y retorna sin llamar a `putFileToStorage`. El resto del flujo no cambia.
  - Un 507 se muestra con su mensaje en el feed (`publishErrorMessage` ya muestra `error.message` para 4xx y 501; agregá 507 solo si hiciera falta mostrarlo y verificalo leyendo la función).

- [ ] **Paso 1: pruebas que fallan:** `seed-files.test.mjs`: el PNG empieza con la firma `89 50 4E 47 0D 0A 1A 0A`, el IHDR dice 480×240, la suma Adler-32 y los CRC de cada trozo son correctos (recalcularlos en la prueba con un CRC32 propio) y el PDF empieza con `%PDF-` y termina con `%%EOF`. `uploads.test.mjs`: stash/take devuelve una sola vez y limpia. `gateway.test.mjs` (con `createMemoryStorage` y una fábrica que cuenta llamadas): publicar con adjunto guarda el binario y `getBlob` lo devuelve; `GET .../attachment/download` devuelve una URL `blob:` (se prueba con `URL.createObjectURL` simulado en `globalThis`); borrar la publicación borra el binario; retirar el adjunto lo borra; `resetPractice` borra todo y revoca las URL; un `save` que rechaza hace que la escritura falle con 507 y que el estado en memoria no cambie (la publicación no aparece); sobrepasar `maxTotalBytes` da 507; un `upload_id` sin archivo en el stash da 404; **ningún `fetch`**; dos usuarios no comparten binarios.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** los archivos y cambios. El generador de PNG usa bloques deflate «stored» de hasta 65535 bytes (cabecera `0x78 0x01`, bloques con bit final, longitud y su complemento) y Adler-32 al final.
- [ ] **Paso 4: ejecutar** `node --test lib/practice/*.test.mjs`, `npx tsc --noEmit` y `npx eslint --max-warnings 0 lib components app stores`.
- [ ] **Paso 5: commit** `feat(web): pasarela de la practica con persistencia, binarios y limites de espacio`.

---

### Task 8: Diferidos de la entrega 1 (aviso de reinicio, tiempo de espera, privacidad)

**Archivos:**
- Modificar: `apps/web/lib/practice/gateway.ts`, `apps/web/lib/practice/indexeddb-storage.ts`, `apps/web/components/practice/PracticeBanner.tsx`, `apps/web/components/layout/Sidebar.tsx`, `apps/web/stores/auth.store.ts`
- Prueba: `apps/web/lib/practice/gateway.test.mjs`, `apps/web/lib/practice/indexeddb-storage.test.mjs`

**Interfaces:**
- Consume: `loadOrInitState` (devuelve `wasReset`), `openPracticeStorage`, `deleteDatabase` de `indexedDB`.
- Produce:
  - `getPracticeStatus(userId): Promise<{ persistent: boolean; wasReset: boolean }>`: `wasReset` es verdadero cuando el estado de este navegador se reinició solo porque su versión no coincidía; `acknowledgePracticeReset(userId): void` lo vuelve a falso. El banner muestra, mientras sea verdadero, la línea «Actualizamos la práctica y empezó de cero» con un botón «Entendido» que llama a `acknowledgePracticeReset`.
  - `openPracticeStorage` abandona la apertura de IndexedDB tras **3 segundos** (`Promise.race` con un temporizador que se cancela) y cae a memoria con `persistent: false`; prueba con una fábrica que nunca llama a `onsuccess`.
  - `deletePracticeData(userId: string): Promise<void>` en `gateway.ts`: olvida la sesión, revoca URL, `clearPracticeFiles()` y borra la base `munet-practice-<userId>` con `indexedDB.deleteDatabase` (mejor esfuerzo; nunca rechaza). `auth.store.ts` `logout` la llama (sin esperar) con el id de usuario que cierra sesión, después de leerlo del estado y antes de limpiarlo.
  - `Sidebar.tsx`: al empezar el efecto que carga muros y perfil por cambio de `activeEventId`, llama a `setWalls([])` y `setProfile(null)` para no mostrar nombre ni avatar reales unos instantes al entrar a la práctica.

- [ ] **Paso 1: pruebas que fallan:** `gateway.test.mjs`: con un almacén que ya trae un estado v1, `getPracticeStatus` da `wasReset: true` y tras `acknowledgePracticeReset` da `false`; `deletePracticeData("u1")` llama `indexedDB.deleteDatabase` (fábrica simulada en `globalThis.indexedDB`) con `munet-practice-u1` y no rechaza aunque falle. `indexeddb-storage.test.mjs`: una apertura colgada cae a memoria en menos de 4 s (usar un tiempo de espera inyectable en la prueba para no esperar 3 s reales: parámetro opcional `timeoutMs`, por defecto 3000).
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar.** El store y el Sidebar no tienen pruebas automáticas dentro del repo: razoná cada cambio con cuidado y mantenelos mínimos; el recorrido de la tarea 9 los verifica.
- [ ] **Paso 4: ejecutar** las pruebas, `npx tsc --noEmit` y `npx eslint --max-warnings 0 lib components app stores`.
- [ ] **Paso 5: commit** `feat(web): aviso de reinicio, tiempo de espera de IndexedDB y borrado al cerrar sesion`.

---

### Task 9: Verificación de punta a punta, documentación y cierre

**Archivos:**
- Modificar: `docs/04-desarrollo/diseno-sandbox-conoce-munet.md` (estado de la entrega 2 y límites), `docs/PENDIENTES.md`, `docs/01-producto/funcionalidades.md`, `docs/04-desarrollo/guia-para-agentes.md` y `docs/04-desarrollo/pruebas-y-validacion.md` solo si hace falta

- [ ] **Paso 1: suite completa.** `node --test apps/web/lib/*.test.mjs apps/web/lib/api/*.test.mjs apps/web/lib/practice/*.test.mjs`, `cd apps/web && npx tsc --noEmit`, `npx eslint --max-warnings 0 lib components app stores`, `npm test -w api` y `cd apps/web && npx next build --webpack`: todo en verde.
- [ ] **Paso 2: recorrido real en el navegador** con la API local y la web apuntando a ella (`NEXT_PUBLIC_API_URL=http://localhost:3002`; ver `.claude/launch.json`), con la cuenta de un participante del evento demo; en la pestaña de red **ninguna petición a la API ni a R2** durante toda la práctica: (a) entrar a la práctica y ver contenido sembrado en Avisos, General y el muro del comité, con la encuesta y los dos adjuntos (abrir el PDF y ver la vista previa de la imagen); (b) publicar texto, publicar con una imagen JPG/PNG y con un PDF, y comprobar que un tercer adjunto lo rechaza el límite; (c) crear una encuesta, votar, cambiar el voto, cerrarla y ver que cerrada no admite votos; (d) comentar, responder y borrar; (e) borrar una publicación propia; (f) directorio: buscar con tilde y filtrar por comité; (g) abrir un perfil ajeno y desde allí iniciar un mensaje directo; (h) en mensajes directos, escribir y ver **una** respuesta preparada, y comprobar el tope; (i) editar el perfil propio (nombre, alias, bio) y ver el cambio en las publicaciones propias; (j) recargar: se vuelve al evento real y `localStorage` no contiene ids de práctica; volver a entrar y ver que lo hecho **sigue ahí** (persistencia en IndexedDB); (k) «Reiniciar práctica» deja el contenido sembrado y borra lo propio y los binarios; (l) cerrar sesión borra la base `munet-practice-<id>` en IndexedDB.
- [ ] **Paso 3: documentar.** Diseño: sección «Estado de la entrega 2» con fecha, verificación y límites conocidos (por ejemplo, rutas de administración sin desvío, el perfil público solo cubre a la cohorte de práctica); `funcionalidades.md`: la fila del modo práctica pasa a «Implementado salvo entrenamiento de organizadores»; `guia-para-agentes.md`: la lista de revisión del §5 (cambio de contrato → actualizar el simulador) con enlace al diseño. `PENDIENTES.md`: actualizar la línea del modo práctica.
- [ ] **Paso 4: commit** `docs: estado de la entrega 2 del modo practica`.
- [ ] **Paso 5:** informar a la persona dueña con el resumen y esperar su decisión sobre `git push` y el PR.
