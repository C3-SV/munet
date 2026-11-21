# Modo práctica, entrega 1 (núcleo): plan de implementación

> **Para quien ejecute:** usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans`. Los pasos usan casillas `- [ ]`.

**Meta:** que una persona con sesión entre al «Modo práctica» desde el menú, vea el aviso fijo, cargue la barra lateral y las pantallas vacías del muro sin que ninguna llamada llegue a la API real, y pueda reiniciar y salir de la práctica.

**Arquitectura:** `requestApi` (`apps/web/lib/api/client.ts`) entrega a un enrutador local toda llamada cuyo `eventId` sea el evento reservado de práctica. El enrutador atiende un conjunto cerrado de caminos con datos de un almacén local por usuario (IndexedDB, con una copia en memoria para pruebas) y **falla cerrado**: cualquier otro camino responde «no disponible en modo práctica» y jamás sale a la red. La práctica es una membresía solo del cliente que se agrega en memoria al store de autenticación y nunca se persiste como evento activo.

**Tecnología:** Next.js 16, React 19, TypeScript, zustand, IndexedDB, `node:test`.

**Diseño:** [diseno-sandbox-conoce-munet.md](diseno-sandbox-conoce-munet.md). Esta entrega es la «Entrega 1: Núcleo». Las superficies (publicar, encuestas, comentarios, adjuntos, directorio, mensajes directos) y los límites locales son la entrega 2.

## Restricciones globales

- Ninguna acción de práctica llega a la API real, a R2 ni a tiempo real. Nunca se envía el token en modo práctica.
- El evento reservado es `practice-local` y la membresía reservada es `practice-membership`. Ninguno existe en la base.
- La práctica no se guarda como evento activo en `localStorage` y no cuenta para decidir si alguien entra directo.
- El almacén es IndexedDB, **una base por usuario** (`munet-practice-<userId>`), con versión de contenido; ante una versión distinta se reinicia con aviso.
- Textos en español. Aviso fijo: «Modo práctica: todo se guarda solo en tu navegador». Etiqueta: «Práctica». Evento en el menú: «Práctica».
- Sin migraciones de base de datos y sin cambios en `apps/api`.
- Los módulos nuevos de `apps/web/lib/practice/` importan con la extensión `.ts` (`import { x } from "./y.ts"`) y los tipos con `import type`, para que las pruebas de `node:test` los carguen sin compilar. Pruebas en `*.test.mjs` junto al módulo, con el estilo de `apps/web/lib/attachments.test.mjs`.
- Verificación: `node --test apps/web/lib/practice/*.test.mjs` desde la raíz del repositorio; `cd apps/web && npx tsc --noEmit`; `cd apps/web && npx eslint --max-warnings 0 lib components app stores`.
- Cada commit termina con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No hacer `git push` ni abrir PR: lo decide la persona dueña.

## Foco de revisión (lo que el diseño implica y ninguna tarea cubre sola)

1. El token no debe viajar nunca en práctica, ni siquiera en un error (cubierto en las tareas 5 y 6: la prueba reemplaza `fetch` por una función que lanza).
2. Datos locales corruptos o de otra versión (JSON inválido, estructura incompleta) no rompen la app: se reinician (tarea 3).
3. IndexedDB no disponible (navegación privada, bloqueada): la práctica sigue funcionando con almacén en memoria y se avisa (tarea 4).
4. Dos cuentas en el mismo navegador no comparten la práctica (tarea 3).
5. Recargar la página, `hydrateAuth` o `refreshContext` estando en práctica no deben dejar ids de práctica en `localStorage` ni expulsar en silencio (tarea 7).
6. Caminos con parámetros de consulta, barra final o identificadores con caracteres especiales no se escapan del enrutador (tarea 5).

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/practice/constants.ts` | Ids reservados, versión del almacén, `isPracticeEvent`. |
| `lib/practice/catalog.ts` | Muros y comités fijos de la práctica y reglas de acceso del participante. |
| `lib/practice/state.ts` | Forma del estado local, persona de práctica por usuario y avatar de iniciales. |
| `lib/practice/storage.ts` | Interfaz `PracticeStorage`, almacén en memoria y `loadOrInitState`. |
| `lib/practice/indexeddb-storage.ts` | Almacén IndexedDB y selección con respaldo en memoria. |
| `lib/practice/router.ts` | Enrutador local de caminos y `PracticeRequestError`. |
| `lib/practice/gateway.ts` | `runPracticeRequest`: une enrutador, almacén por usuario y conversión de errores. |
| `lib/practice/membership.ts` | Funciones puras sobre la membresía ficticia. |
| `lib/api/client.ts` | Desvío a la práctica y `ApiError` para sus errores. |
| `lib/api/feed.ts` | Protección contra subida a R2 en práctica. |
| `stores/auth.store.ts` | `practice`, `enterPractice`, `exitPractice` y protecciones de persistencia. |
| `components/practice/PracticeBanner.tsx` | Aviso fijo con «Reiniciar práctica» y «Salir». |
| `components/layout/Sidebar.tsx`, `app/(main)/layout.tsx`, `app/select-event/page.tsx` | Acceso, aviso y etiqueta. |
| `app/(main)/feed/[muro]/page.tsx`, `app/(main)/chat/page.tsx`, `app/(main)/chat/[id]/page.tsx`, `components/feed/PostComments.tsx` | Sin suscripción de tiempo real en práctica. |

Todas las rutas son relativas a `apps/web/`.

---

### Task 1: Constantes y detección de práctica

**Archivos:**
- Crear: `lib/practice/constants.ts`
- Prueba: `lib/practice/constants.test.mjs`

**Interfaces:**
- Produce: `PRACTICE_EVENT_ID: "practice-local"`, `PRACTICE_MEMBERSHIP_ID: "practice-membership"`, `PRACTICE_STATE_VERSION: number` (valor `1`), `PRACTICE_DB_PREFIX: "munet-practice-"`, `isPracticeEvent(eventId: string | null | undefined): boolean`, `practiceDbName(userId: string): string`.

- [ ] **Paso 1: escribir la prueba que falla.** `isPracticeEvent("practice-local")` es `true`; es `false` para `"11111111-1111-1111-1111-111111111111"`, `""`, `null`, `undefined` y `"practice-local "` (con espacio). `practiceDbName("u1")` es `"munet-practice-u1"`. `PRACTICE_STATE_VERSION` es un entero mayor que 0.
- [ ] **Paso 2: ejecutar y ver que falla:** `node --test apps/web/lib/practice/constants.test.mjs` → falla por módulo inexistente.
- [ ] **Paso 3: implementar** las constantes y las dos funciones en `lib/practice/constants.ts` con las firmas de arriba (comparación estricta, sin recortar espacios).
- [ ] **Paso 4: ejecutar y ver que pasa.**
- [ ] **Paso 5: commit** `feat(web): constantes y deteccion del modo practica`.

---

### Task 2: Catálogo de muros, estado y persona de práctica

**Archivos:**
- Crear: `lib/practice/catalog.ts`, `lib/practice/state.ts`
- Prueba: `lib/practice/catalog.test.mjs`, `lib/practice/state.test.mjs`

**Interfaces:**
- Consume: constantes de la tarea 1; tipos `EventWall`, `MyProfile` de `types/common.ts` (con `import type`).
- Produce en `catalog.ts`:
  - `PRACTICE_COMMITTEES: readonly { id: string; code: string; name: string }[]` con exactamente `AG` «Asamblea General», `CS` «Consejo de Seguridad», `UNICEF` «UNICEF», `ECOSOC` «ECOSOC» (ids `practice-committee-ag`, `-cs`, `-unicef`, `-ecosoc`).
  - `buildPracticeWalls(committeeId: string): EventWall[]`: Avisos, General y un muro por comité.
- Produce en `state.ts`:
  - `type PracticePersona = { delegation: string; number: number; committeeId: string; firstName: string; lastName: string; displayName: string; delegationCode: string }`.
  - `type PracticeState = { version: number; userId: string; createdAt: string; persona: PracticePersona }` (las superficies de la entrega 2 agregan campos con una versión nueva).
  - `personaFor(userId: string): PracticePersona`, `createInitialState(userId: string, now: Date): PracticeState`, `avatarFor(initials: string): string` (URI `data:image/svg+xml` sin llamadas externas).

Reglas que fijan los valores (del diseño):
- Slugs de muro como en la API: `avisos`, `general`, `comite-<código en minúsculas>` (`comite-ag`, `comite-cs`, `comite-unicef`, `comite-ecosoc`).
- Avisos: `kind: "announcements"`, `wallType: "ANNOUNCEMENTS"`, `canAccess: true`, `canPublish: false`. General: `kind: "general"`, `wallType: "GENERAL"`, `canAccess: true`, `canPublish: true`. Comités: `kind: "committee"`, `wallType: "COMMITTEE"`; `canAccess` y `canPublish` son `true` solo para el comité de la persona y `false` en los demás. `eventId` de todos: `practice-local`.
- `personaFor` es determinista por `userId`: la delegación sale de la lista fija `["Brasil","Japón","Francia","Kenia","Canadá","India","Egipto","México","Alemania","Chile","Australia","Nigeria"]`, el número está entre 1 y 99, `lastName` es `"#" + número`, `firstName` es la delegación, `displayName` es `"<delegación> #<número>"`, `delegationCode` es `"#" + número con tres dígitos` (`#017`) y el comité se reparte entre los cuatro.

- [ ] **Paso 1: pruebas que fallan.**
  - `catalog.test.mjs`: hay 6 muros; los slugs son los esperados; Avisos tiene `canPublish` falso y General verdadero; con `committeeId = "practice-committee-cs"` solo `comite-cs` tiene `canAccess` y `canPublish` verdaderos y los otros tres comités los tienen falsos; todos tienen `eventId === "practice-local"`.
  - `state.test.mjs`: `personaFor("a")` igual a `personaFor("a")`; distinta para `"a"` y `"b"` en al menos una de las propiedades en una muestra de 20 usuarios (hay más de 3 resultados distintos); `number` entre 1 y 99; `delegationCode` coincide con `/^#\d{3}$/`; `createInitialState("u1", new Date("2026-11-21T00:00:00Z"))` devuelve `version === PRACTICE_STATE_VERSION`, `userId === "u1"` y `createdAt` ISO; `avatarFor("B1")` empieza con `data:image/svg+xml` y no contiene `http`.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** ambos módulos con las firmas y reglas de arriba. La persona se deriva con un hash simple de la cadena (por ejemplo, suma ponderada de códigos de carácter módulo el tamaño de cada lista).
- [ ] **Paso 4: ejecutar y ver que pasan.**
- [ ] **Paso 5: commit** `feat(web): catalogo de muros y persona del modo practica`.

---

### Task 3: Almacén en memoria y arranque con versión

**Archivos:**
- Crear: `lib/practice/storage.ts`
- Prueba: `lib/practice/storage.test.mjs`

**Interfaces:**
- Consume: `PracticeState`, `createInitialState` (tarea 2), `PRACTICE_STATE_VERSION` (tarea 1).
- Produce:
  - `interface PracticeStorage { load(): Promise<unknown | null>; save(state: PracticeState): Promise<void>; putBlob(id: string, blob: Blob): Promise<void>; getBlob(id: string): Promise<Blob | null>; deleteBlob(id: string): Promise<void>; clear(): Promise<void>; }`
  - `createMemoryStorage(): PracticeStorage`
  - `type LoadResult = { state: PracticeState; wasReset: boolean }`
  - `loadOrInitState(storage: PracticeStorage, userId: string, now: Date): Promise<LoadResult>`: si `load()` devuelve `null`, crea y guarda el estado inicial (`wasReset: false`); si devuelve un objeto con `version === PRACTICE_STATE_VERSION`, `userId` igual y `persona` presente, lo devuelve sin cambios (`wasReset: false`); en cualquier otro caso (versión distinta, `userId` distinto, forma inválida, valor que no es objeto), llama a `clear()`, crea y guarda uno nuevo y devuelve `wasReset: true`. Si `load()` lanza, trata el caso como datos corruptos.

- [ ] **Paso 1: pruebas que fallan.** (a) Almacén vacío: devuelve estado inicial, `wasReset` falso y lo deja guardado. (b) Segunda llamada devuelve el mismo estado guardado sin cambiar `createdAt`. (c) Estado guardado con `version` distinta: `wasReset` verdadero y `clear` se llamó. (d) Estado de otro `userId` guardado en el mismo almacén: reinicia. (e) `load()` devuelve `"basura"`, `{}` o un objeto sin `persona`: reinicia. (f) `load()` lanza: reinicia sin propagar el error. (g) Dos almacenes distintos con usuarios distintos no comparten estado. (h) `putBlob`/`getBlob`/`deleteBlob` guardan, devuelven y borran; `getBlob` de un id desconocido da `null`; `clear` vacía estado y blobs.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** `createMemoryStorage` con un `Map` y `loadOrInitState` según las reglas.
- [ ] **Paso 4: ejecutar y ver que pasan.**
- [ ] **Paso 5: commit** `feat(web): almacen local de la practica con versionado`.

---

### Task 4: Almacén IndexedDB con respaldo en memoria

**Archivos:**
- Crear: `lib/practice/indexeddb-storage.ts`
- Prueba: `lib/practice/indexeddb-storage.test.mjs` (solo la parte de selección con respaldo)

**Interfaces:**
- Consume: `PracticeStorage`, `createMemoryStorage` (tarea 3), `practiceDbName` (tarea 1).
- Produce:
  - `createIndexedDbStorage(userId: string): PracticeStorage`: base `practiceDbName(userId)`, versión 1, dos almacenes de objetos: `state` (clave fija `"state"`) y `blobs` (clave = id). `clear()` vacía ambos.
  - `type StorageChoice = { storage: PracticeStorage; persistent: boolean }`
  - `openPracticeStorage(userId: string, indexedDbFactory?: IDBFactory | undefined): Promise<StorageChoice>`: si no hay `IDBFactory` o abrir la base falla, devuelve `{ storage: createMemoryStorage(), persistent: false }`; si abre, `{ storage: <IndexedDB>, persistent: true }`.

- [ ] **Paso 1: pruebas que fallan.** `openPracticeStorage("u1", undefined)` devuelve `persistent: false` y un almacén que guarda y devuelve un estado; con un `indexedDbFactory` falso cuyo `open` lanza o dispara `onerror`, también devuelve `persistent: false` sin propagar el error.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** `createIndexedDbStorage` con el patrón de `indexedDB.open` y promesas envolventes, y `openPracticeStorage` con el respaldo. Sin dependencias nuevas. El comportamiento contra un IndexedDB real se verifica en la tarea 9.
- [ ] **Paso 4: ejecutar y ver que pasan.**
- [ ] **Paso 5: commit** `feat(web): almacen IndexedDB de la practica con respaldo en memoria`.

---

### Task 5: Enrutador local con falla cerrada

**Archivos:**
- Crear: `lib/practice/router.ts`
- Prueba: `lib/practice/router.test.mjs`

**Interfaces:**
- Consume: `PRACTICE_EVENT_ID`, `PRACTICE_MEMBERSHIP_ID` (tarea 1), `buildPracticeWalls`, `PRACTICE_COMMITTEES` (tarea 2), `PracticeState`, `avatarFor` (tarea 2).
- Produce:
  - `class PracticeRequestError extends Error { status: number }`
  - `const PRACTICE_UNAVAILABLE_MESSAGE = "No disponible en modo práctica"`
  - `type PracticeRequest = { method: string; path: string; body?: unknown }`
  - `routePracticeRequest(request: PracticeRequest, state: PracticeState): unknown`: síncrono y puro. No usa `fetch` ni ninguna API de red.

Caminos atendidos (todos los demás lanzan `PracticeRequestError` con estado `501` y el mensaje `PRACTICE_UNAVAILABLE_MESSAGE`); el método se compara en mayúsculas, se ignoran parámetros de consulta salvo donde se indica, se ignora una barra final y los identificadores se decodifican con `decodeURIComponent`:
- `GET /events/practice-local/walls` → `{ event: { id, name: "Práctica", slug: "practica" }, membership: { id: "practice-membership", role: "PARTICIPANT", committeeId }, walls }`.
- `GET /events/practice-local/committees` → `{ committees: [...] }` con forma `EventCommittee` (`id`, `event_id: "practice-local"`, `name`, `code`, `description: null`, `status: "ACTIVE"`, `sort_order` 1 a 4, `canAccess` verdadero solo para el comité de la persona).
- `GET /profiles/me` → `{ profile }` con la forma `MyProfile` de la persona (`membershipId` y `eventId` reservados, `role: "PARTICIPANT"`, `participantCode: "PRACTICA"`, `email: null`, `accountStatus: "ACTIVE"`, `avatar: avatarFor(<iniciales de la delegación>)`, `committee` con `id`, `name`, `code`).
- `GET /posts?muro=<slug>` → `{ wall, posts: [] }`. Muro inexistente → `PracticeRequestError(404, "Muro no encontrado")`; muro sin acceso → `PracticeRequestError(403, "No tienes acceso a este muro")`.
- `GET /dm/conversations` → `{ conversations: [] }`.

- [ ] **Paso 1: pruebas que fallan.** Antes de cada prueba, `globalThis.fetch = () => { throw new Error("fetch prohibido") }`; ningún camino lo toca.
  - walls: 6 muros, `event.id === "practice-local"`, `membership.id === "practice-membership"`.
  - committees: 4 comités, exactamente uno con `canAccess` verdadero, que coincide con el comité de la persona.
  - profiles/me: forma completa; `participantCode` es `"PRACTICA"`; `displayName` coincide con la persona; `avatar` empieza con `data:`.
  - posts: `GET /posts?muro=general` → `posts` vacío y `wall.slug === "general"`; `GET /posts?muro=avisos` ok; `GET /posts?muro=no-existe` → error 404; muro de un comité ajeno → error 403; su propio comité → ok.
  - dm: `{ conversations: [] }`.
  - falla cerrada: `POST /posts`, `DELETE /posts/x`, `GET /admin/participants`, `POST /auth/login`, `PATCH /profiles/me`, `GET /posts/abc/attachment/download` y un camino vacío `""` lanzan `PracticeRequestError` con estado `501`.
  - tolerancia: `GET /events/practice-local/walls/` (barra final) y `get` en minúsculas funcionan; `GET /events/otro-evento/walls` falla cerrado; `GET /events/practice-local%2Fwalls` no coincide y falla cerrado.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** `routePracticeRequest` con una tabla de rutas (método, patrón, manejador) y un `default` que lanza el error de falla cerrada.
- [ ] **Paso 4: ejecutar y ver que pasan.**
- [ ] **Paso 5: commit** `feat(web): enrutador local de la practica que falla cerrado`.

---

### Task 6: Pasarela, desvío en `requestApi` y fugas de R2 y tiempo real

**Archivos:**
- Crear: `lib/practice/gateway.ts`
- Modificar: `lib/api/client.ts`, `lib/api/feed.ts` (callback `upload` de `publishFeedPost`), `app/(main)/feed/[muro]/page.tsx` (condición del efecto de tiempo real, línea ~147), `app/(main)/chat/page.tsx` (~185), `app/(main)/chat/[id]/page.tsx` (~209), `components/feed/PostComments.tsx` (donde usa `realtimeEnabled`/`supabaseBrowser`)
- Prueba: `lib/practice/gateway.test.mjs`

**Interfaces:**
- Consume: `routePracticeRequest`, `PracticeRequestError` (tarea 5), `openPracticeStorage` (tarea 4), `loadOrInitState` (tarea 3), `isPracticeEvent` (tarea 1).
- Produce en `gateway.ts`:
  - `setPracticeStorageFactory(factory: ((userId: string) => Promise<PracticeStorage>) | null): void` (para pruebas; `null` restaura el real).
  - `runPracticeRequest(input: { userId: string; method: string; path: string; body?: unknown }): Promise<unknown>`: obtiene (y memoriza por usuario) el almacén, llama a `loadOrInitState` y a `routePracticeRequest`. Los errores `PracticeRequestError` se propagan tal cual.
  - `resetPractice(userId: string): Promise<void>`: llama a `clear()` del almacén del usuario y olvida el estado memorizado.
  - `getPracticeStatus(userId: string): Promise<{ persistent: boolean }>`
- Cambio en `client.ts`: al inicio de `requestApi`, `if (isPracticeEvent(eventId)) { try { return (await runPracticeRequest({ userId: useAuthStore.getState().user?.id ?? "anonimo", method, path, body })) as T; } catch (error) { if (error instanceof PracticeRequestError) throw new ApiError(error.message, error.status, { error: error.message }); throw error; } }`. No se lee ni se envía `token` en esa rama.
- Cambio en `feed.ts`: en el callback `upload` de `publishFeedPost`, si `isPracticeEvent(eventId)`, lanzar `new AttachmentUploadError("No disponible en modo práctica")` antes de `putFileToStorage`.
- Cambio en los efectos de tiempo real: agregar `isPracticeEvent(eventId)` a la condición que hoy decide no suscribirse, de modo que en práctica no se cree ninguna suscripción.

- [ ] **Paso 1: pruebas que fallan** (`gateway.test.mjs`, con `setPracticeStorageFactory(async () => createMemoryStorage())` y `fetch` que lanza). (a) `runPracticeRequest({ userId: "u1", method: "GET", path: "/events/practice-local/walls" })` devuelve las paredes. (b) Un camino desconocido lanza `PracticeRequestError` 501. (c) Dos usuarios (`u1`, `u2`) con la misma fábrica por usuario no comparten estado: la persona de `u1` y la de `u2` salen distintas en `/profiles/me`. (d) `resetPractice("u1")` hace que el siguiente `load()` del almacén de `u1` devuelva `null` antes de re-sembrar. (e) Nada llama a `fetch`.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** `gateway.ts` y aplicar los cambios de `client.ts`, `feed.ts` y los cuatro efectos de tiempo real. Importar con extensión `.ts` dentro de `lib/practice/` y de forma habitual (sin extensión) en los archivos existentes.
- [ ] **Paso 4: ejecutar** `node --test apps/web/lib/practice/*.test.mjs` y `cd apps/web && npx tsc --noEmit`; ambos deben pasar.
- [ ] **Paso 5: commit** `feat(web): desvio a la practica en requestApi y cierre de fugas`.

---

### Task 7: Membresía de práctica y store de autenticación

**Archivos:**
- Crear: `lib/practice/membership.ts`
- Modificar: `stores/auth.store.ts`
- Prueba: `lib/practice/membership.test.mjs`

**Interfaces:**
- Consume: constantes de la tarea 1; tipo `MembershipSummary` de `types/auth.ts` (con `import type`).
- Produce en `membership.ts`:
  - `buildPracticeMembership(): MembershipSummary` con `id: PRACTICE_MEMBERSHIP_ID`, `eventId: PRACTICE_EVENT_ID`, `eventName: "Práctica"`, `eventSlug: "practica"`, `eventStatus: "ACTIVE"`, `role: "PARTICIPANT"`, `committeeId`, `committeeName`, `committeeCode` en `null`, `participantCode: "PRACTICA"`, `accountStatus: "ACTIVE"`.
  - `isPracticeMembership(m: Pick<MembershipSummary, "id" | "eventId">): boolean` (verdadero si el id o el evento son los reservados).
  - `withPracticeMembership(memberships: MembershipSummary[]): MembershipSummary[]`: agrega la de práctica al final sin duplicar.
  - `withoutPracticeMembership(memberships: MembershipSummary[]): MembershipSummary[]`.
  - `shouldPersistActive(m: Pick<MembershipSummary, "id" | "eventId">): boolean` (falso para la práctica).
- Cambios en `auth.store.ts`:
  - Estado nuevo `practice: boolean` (inicia `false`); no se persiste.
  - `enterPractice()`: `practice: true`, `memberships: withPracticeMembership(memberships)`, `activeEventId = PRACTICE_EVENT_ID`, `activeMembershipId = PRACTICE_MEMBERSHIP_ID`. **No escribe en `localStorage`.**
  - `exitPractice()`: `practice: false`, `memberships: withoutPracticeMembership(memberships)`, y restaura el evento activo desde `localStorage` (`ACTIVE_MEMBERSHIP_KEY`) si sigue siendo válido o con la regla automática existente (`resolveAutoMembership`); si no hay ninguno, deja el activo en `null`.
  - `setActiveMembership`: si `!shouldPersistActive(membership)`, actualiza el estado en memoria sin escribir en `localStorage`.
  - `hydrateAuth`: nunca elige la membresía de práctica ni deja `practice: true`.
  - `refreshContext`: si `practice` es verdadero, conserva la membresía de práctica agregándola de nuevo a las del API y mantiene la práctica activa.
  - `logout`: además limpia `practice: false`.

- [ ] **Paso 1: pruebas que fallan** (`membership.test.mjs`). `buildPracticeMembership()` tiene los valores listados; `withPracticeMembership([])` devuelve 1 elemento y llamarla dos veces no duplica; `withoutPracticeMembership` quita solo la de práctica y conserva el orden de las demás; `isPracticeMembership` es verdadero para la de práctica y falso para una real; `shouldPersistActive(buildPracticeMembership())` es falso y para una membresía real es verdadero.
- [ ] **Paso 2: ejecutar y ver que fallan.**
- [ ] **Paso 3: implementar** `membership.ts` y los cambios del store con las reglas de arriba.
- [ ] **Paso 4: ejecutar** las pruebas y `cd apps/web && npx tsc --noEmit`; deben pasar.
- [ ] **Paso 5: commit** `feat(web): membresia de practica solo en el cliente`.

---

### Task 8: Interfaz del modo práctica

**Archivos:**
- Crear: `components/practice/PracticeBanner.tsx`
- Modificar: `components/layout/Sidebar.tsx`, `app/(main)/layout.tsx`, `app/select-event/page.tsx`

**Interfaces:**
- Consume: `useAuthStore` con `practice`, `enterPractice`, `exitPractice` (tarea 7); `resetPractice` (tarea 6); `ConfirmDialog` de `components/ui/ConfirmDialog.tsx`.
- Produce: componente `PracticeBanner(): JSX.Element | null`.

Comportamiento:
- `PracticeBanner` solo se muestra si `practice` es verdadero. Muestra el texto exacto «Modo práctica: todo se guarda solo en tu navegador», el botón «Reiniciar práctica» (abre un `ConfirmDialog` con título «¿Reiniciar la práctica?» y descripción «Se borrará todo lo que hiciste en el modo práctica de este navegador.»; al confirmar llama a `resetPractice(user.id)` y recarga la ruta con `router.refresh()`) y el botón «Salir de la práctica» (llama a `exitPractice()` y navega a `/feed`). Si `getPracticeStatus` indica `persistent: false`, agrega: «Tu navegador no permite guardar la práctica: se borrará al cerrar la pestaña.»
- `app/(main)/layout.tsx`: renderiza `<PracticeBanner />` justo encima de `{children}` (no en la sala de chat, que ya tiene altura acotada: ahí va dentro del contenedor sin romper el desplazamiento).
- `Sidebar.tsx`: debajo del nombre del evento, si `practice` es falso, un enlace-botón «Modo práctica» que llama a `enterPractice()` y navega a `/feed`; si es verdadero, en su lugar el texto «Práctica» como etiqueta. Se muestra a cualquier rol.
- `app/select-event/page.tsx`: en el listado de eventos, los de práctica (por `isPracticeMembership`) llevan la etiqueta «Práctica». (El listado solo contiene la práctica mientras esté activa en memoria.)

- [ ] **Paso 1: implementar** el componente y los tres cambios con los textos exactos.
- [ ] **Paso 2: verificar** `cd apps/web && npx tsc --noEmit` y `npx eslint --max-warnings 0 lib components app stores`; ambos sin errores ni advertencias.
- [ ] **Paso 3: commit** `feat(web): aviso, acceso y reinicio del modo practica`.

---

### Task 9: Verificación de punta a punta, documentación y cierre

**Archivos:**
- Modificar: `docs/04-desarrollo/diseno-sandbox-conoce-munet.md` (estado de la entrega 1), `docs/PENDIENTES.md` (una línea)

- [ ] **Paso 1: suite completa.** `node --test apps/web/lib/practice/*.test.mjs`, `cd apps/web && npx tsc --noEmit`, `npx eslint --max-warnings 0 lib components app stores` y `npm test -w api`: todo en verde.
- [ ] **Paso 2: recorrido real en el navegador** con la API local y la web apuntando a la API local (`NEXT_PUBLIC_API_URL=http://localhost:3002`; ver la nota del proyecto sobre el `.env` de la web). Con la cuenta de un participante del evento demo: (a) iniciar sesión; (b) pulsar «Modo práctica»; (c) comprobar el aviso fijo, que el menú muestra Avisos, General y el muro del comité de la persona, y que el muro carga vacío; (d) en la pestaña de red **no hay ninguna petición a la API ni a R2** durante la práctica (solo recursos de la propia web); (e) recargar la página: se vuelve al evento real y `localStorage` no contiene `practice-local` ni `practice-membership`; (f) volver a entrar, pulsar «Reiniciar práctica» y confirmar; (g) pulsar «Salir de la práctica»; (h) abrir IndexedDB en las herramientas del navegador y comprobar la base `munet-practice-<id>`.
- [ ] **Paso 3: documentar.** En el diseño, anotar «Entrega 1 implementada el <fecha>»; en `PENDIENTES.md`, una línea que apunte al diseño y al estado.
- [ ] **Paso 4: commit** `docs: estado de la entrega 1 del modo practica`.
- [ ] **Paso 5:** informar a la persona dueña con el resumen y esperar su decisión sobre `git push` y el PR.
