# Plan de implementación — Sprint 1 (26 oct – 1 nov 2026) · Sitio público

Alcance: tareas del Sprint 1 del sitio de participantes, más las tareas "ambos" que lo afectan. Las tareas de administración (S1-10 a S1-14) son del otro equipo y no están aquí.

Fuente de las tareas: plan de sprints (`MUNET_Plan_de_Sprints.pdf`). Cada fase termina en algo que se puede probar. No se pasa a la siguiente fase sin comprobar la anterior.

## Tabla de tareas

| ID | Tarea | Rol | Prioridad | Depende de | Estado |
|---|---|---|---|---|---|
| S1-01 | Kickoff del sprint | Coordinación | Must | — | Hecho (lun 26) |
| S1-03 | Reunión de decisiones con Rober y MUN ESEN | Coordinación | Must | — | Mié 28 |
| S1-05 | Quitar los logs que imprimen contraseña y token | Frontend | Must | — | **Hecho, sin commit** |
| S1-19 | Confirmar que el front no accede a datos de Supabase | Frontend | Should | — | **Hecho** (checklist abajo) |
| S1-04 | Mergear `sitio-admin` a `main` | Coordinación | Must | — | Pendiente |
| S1-08 | Contratos de API de las funciones nuevas | Backend (escribe) · Frontend (aprueba) | Must | S1-03 | **Borrador corregido**, falta aprobación |
| S1-02 | Archivo SQL 001 (alias, código #, fijados, archivos, quién borró, índice de muros) | Backend | Must | S1-03 | Pendiente |
| S1-17 | Un único estado para mensajes eliminados | Backend | Must | — | Pendiente |
| S1-06 | Arreglar el registro de auditoría | Backend | Must | — | Pendiente |
| S1-07 | Que la API entre al control de calidad | Backend | Should | — | Pendiente |
| S1-15 | Pruebas de permisos de muros y comités | Backend | Must | S1-07 | Pendiente |
| S1-16 | Ocultar comités ajenos y quitar el candado | Backend + Frontend | Must | S1-15 (solo para el cambio de backend) | Pendiente |
| S1-18 | Registrar quién borró una publicación o comentario | Backend | Should | S1-02 | Pendiente |
| S1-09 | Retirar (archivar) el comité de crisis | Coordinación + Backend | Should | S1-03 | Pendiente |
| — | *(Sugerida, no está en el plan)* Redirigir al login cuando expira la sesión | Frontend | Should | — | Pendiente |

## Reglas para todas las fases

- Una tarea = una rama = un responsable. Rama de ejemplo: `cambios-backend-<nombre>` o `cambios-frontend-<nombre>`.
- Antes de entregar: `git status --short`, `git diff --check`, y en `apps/web` `npm run lint` y `npm run check-types`.
- El entorno local usa la base de datos real y compartida. No probar borrados ni ejecutar SQL de estructura sin avisar.
- No hacer commit directo a `main`; Pull Request con revisión de alguien del otro rol.

---

## Fase 0 · Hoy: lo que no depende de nadie

### S1-05 · Quitar logs de contraseña y token — Frontend — **HECHO**
- `apps/web/lib/api/auth.ts`: eliminados los 3 `console.log` (payload con contraseña, estado y cuerpo con token).
- Comprobado: no queda ningún `console.*` en `apps/web`; `tsc --noEmit` sin errores.
- Falta: commit y Pull Request.

### S1-19 · El front no accede a datos de Supabase — Frontend — **HECHO**
Checklist verificada:
- [x] Ninguna llamada `.from(` en `apps/web`.
- [x] Solo 4 archivos usan Supabase y solo para tiempo real (`.channel()`, `.on()`, `.subscribe()`, `.removeChannel()`): `feed/[muro]/page.tsx`, `components/feed/PostComments.tsx`, `chat/page.tsx`, `chat/[id]/page.tsx`.
- [x] `lib/supabase.ts` desactiva la persistencia de sesión y solo usa la llave pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

### S1-03 · Reunión de decisiones — Coordinación
Cerrar antes de escribir SQL y contratos definitivos:
1. ¿El alias es único por evento o puede repetirse? (el contrato asume que puede repetirse hasta decidir).
2. Formato del código `#` (propuesta: `#042`).
3. Permisos del moderador, entrega de credenciales y qué implica suspender.

Resultado esperado: un acta corta con la decisión de cada punto.

### S1-04 · Mergear `sitio-admin` a `main` — Coordinación
1. `git fetch --all`; abrir un Pull Request de `origin/sitio-admin` hacia `main` (16 commits por delante).
2. Revisión por una persona de cada equipo.
3. Después del merge, todos hacen `git checkout main && git pull` y actualizan su rama.
- Listo cuando `main` incluye `GET /admin/events` y la lista de eventos del admin muestra datos reales.

---

## Fase 1 · Desbloquear al frontend

### S1-08 · Contratos de API — Backend escribe, Frontend aprueba
Archivo: `docs/SPRINT_1_PUBLIC_BACKEND_FE.md` (borrador de Susana, ajustado en esta rama).
Ajustes ya hechos:
- El alias es un campo **separado** (`profiles.alias`), no `display_name`. Se muestran **nombre completo y alias** juntos.
- Sin alias, la API devuelve `null` (no el nombre completo).
- Formato del código `#` marcado como pendiente de decisión.

Para aprobarlo, Frontend comprueba que:
- [ ] El directorio devuelve `firstName`, `lastName`, `alias`, `delegationCode`, comité y `avatarUrl`.
- [ ] La paginación trae `total` y `total_pages`.
- [ ] Los errores 400/401/403/404 tienen la forma `{ error: "..." }`.
- [ ] Nunca aparece `participant_code` ni correo.

### S1-02 · Archivo SQL 001 — Backend
Archivo: `supabase/migrations/001_alias_codigo_fijados_archivos.sql`. Pasos:
1. Tener cerradas las decisiones de S1-03.
2. Escribir cada cambio con `if not exists`:
   - `profiles.alias varchar(60)` (nulo).
   - `event_memberships.delegation_code varchar` + `unique (event_id, delegation_code)`.
   - `posts.is_pinned boolean not null default false`, `pinned_at`, `pinned_by_membership_id`.
   - Tabla `attachments` (post, ruta, nombre, tipo, tamaño, quién subió, fecha; borrado en cascada desde `posts`).
   - Columnas uuid `deleted_by_membership_uuid` en `posts` y `post_comments`.
   - Índice único parcial en `walls` (un muro general y uno de avisos por evento; uno por comité).
3. Antes de ejecutar, consultar si ya hay muros duplicados.
4. Pull Request con revisión.
5. Avisar a Rober y ejecutar en el SQL Editor de Supabase.
6. Verificar con una consulta y actualizar `supabase/schema.sql`.
7. Crear el bucket privado de adjuntos en Storage (desde el panel).

---

## Fase 2 · Backend sólido (en paralelo con la Fase 1)

### S1-17 · Un único estado para mensajes eliminados — Backend
Archivo: `apps/api/src/services/dm.service.ts`.
1. Sustituir la lista `DELETED_DM_MESSAGE_STATUSES` (líneas ~19-25) por la constante `'DELETED'` (único valor válido de `dm_message_status_enum`: `VISIBLE`, `DELETED`).
2. Reemplazar el bucle `for (const status of ...)` (líneas ~500-520) por una sola actualización. Si falla, registrar auditoría `FAILURE` con el mensaje del error y devolver 500.
3. Quitar la variable `DM_DELETED_MESSAGE_STATUS` del código, de `.env.example` y de `docs/04-desarrollo/configuracion-local.md`.
4. Probar: borrar un mensaje propio → 200 y la fila queda con `status = 'DELETED'`; borrar uno ajeno → 403.

### S1-06 · Arreglar la auditoría — Backend
Archivo: `apps/api/src/utils/audit.logger.ts`.
1. El `try/catch` actual no atrapa los fallos de Supabase: `supabase-js` devuelve `{ error }` en vez de lanzar. Capturar `const { error } = await supabaseAdmin.from('audit_logs').insert(...)`.
2. Si hay `error`, hacer `console.error` con `error.code` y `error.message`, sin romper la petición.
3. Añadir `'DENIED'` a `AuditOutcome` (el enum de la base lo permite: `SUCCESS`, `FAILURE`, `DENIED`).
4. Probar: forzar un insert inválido (por ejemplo un `actor_role` no existente) y comprobar que el error aparece en el log del servidor.

### S1-07 · La API entra al control de calidad — Backend
Archivo: `apps/api/package.json`.
1. Añadir scripts: `"check-types": "tsc --noEmit"`, `"build": "tsc --noEmit"` (el API corre con `ts-node`; no hay carpeta `dist`) y `"test": "node --test src"`.
2. Comprobar que `src/lib/cors.test.mjs` corre (importa `./cors.ts`, por lo que requiere una versión de Node que ejecute TypeScript; verificar la versión o ajustar).
3. Desde la raíz, `npm run check-types` y `npm run build` deben incluir ahora la API (Turbo las detecta por el script).
4. Corregir los errores de tipos que aparezcan.

### S1-15 · Pruebas de permisos de muros y comités — Backend
Depende de S1-07. Pruebas sobre `rbac.utils.ts` y `walls.service.ts` (`mapWallForMembership`):
- Un delegado: `canAccess` verdadero para el general, avisos y su comité; falso para los demás.
- Un admin: verdadero en todos.
- Un delegado no puede publicar en avisos.
- Un delegado sin comité solo ve general y avisos.
Dónde se aplica en el servidor: `posts.service.ts` (líneas ~325, 385, 474, 914) y `comments.service.ts` (~200).

---

## Fase 3 · Cambios de comportamiento (coordinar)

### S1-16 · Ocultar comités ajenos — Backend + Frontend (sin orden obligatorio entre ellos)

**Principio:** separar dos cosas distintas.
- *Que un comité existe y cómo se llama* → información pública. Ya se ve en cada publicación del muro general (`post.user.committeeName`) y se verá en el directorio de delegados.
- *El muro de ese comité* → privado. Es lo único que se oculta.

Por eso **solo se filtran los muros**; `GET /events/:eventId/committees` no se toca. Lo usan `feed/[muro]/page.tsx` (chips para filtrar el muro general por comité) y `profile/[membershipId]/page.tsx` (selector de comité, solo visible para administradores).

**Orden que evita el riesgo (cada paso se puede desplegar solo):**
1. **Frontend primero** — `apps/web/components/layout/Sidebar.tsx`: no pintar los muros con `canAccess === false` (filtrar la lista antes de dibujarla) y quitar el icono de candado y la opacidad 0.55 (líneas ~28, 41 y 72-83). Con la API actual no cambia nada para el admin y el delegado deja de ver los muros ajenos. **No depende del backend.**
2. **Frontend: ruta directa a un muro ajeno** — `feed/[muro]/page.tsx`. Si el `slug` de la URL no está entre los muros visibles, redirigir a `/feed` (o mostrar "No tienes acceso a este muro"), en vez de dejar la pantalla vacía.
3. **Backend después** — `events.controller.ts`, `listEventWalls`: `wallViews.filter((w) => w.canAccess)`. Es una línea; si algo falla se revierte sin tocar el frontend.
4. Dejar `canAccess` en los tipos hasta confirmar que nada más lo usa.

**Casos límite a probar (con 4 cuentas):**
| Cuenta | Debe ver en el menú | Al abrir la URL de un muro ajeno |
|---|---|---|
| Delegado del comité A | General, Avisos, comité A | Redirige o muestra "sin acceso"; la API responde 403 |
| Delegado del comité B | General, Avisos, comité B | Igual |
| Delegado sin comité asignado | General y Avisos | Igual |
| Admin | Todos | Abre normal |

También comprobar: el filtro por comité del muro general sigue mostrando todos los comités, y el selector de comité del perfil (admin) sigue funcionando.

**Fuera de esta tarea:** que el tiempo real (Realtime) no entregue publicaciones de comités ajenos se revisa en S2-14.

### S1-18 · Registrar quién borró — Backend
Depende de S1-02 aplicado.
1. `posts.service.ts`: al borrar, guardar el uuid de la membresía en la columna nueva, además del tipo de actor (`AUTHOR` / `ADMIN`) que ya se guarda.
2. `comments.service.ts`: igual para `post_comments`.
3. Probar: borrar como autor y como admin; comprobar que se guarda el uuid correcto en cada caso.

### S1-09 · Archivar el comité de crisis — Coordinación + Backend
1. Consulta de solo lectura: ¿existe un comité de crisis en `committees` del evento?
2. Si existe: `committees.status = 'ARCHIVED'` y su muro a `ARCHIVED`. No borrarlos (hay datos relacionados).
3. Comprobar que ningún delegado lo ve en el menú.

---

## Fase 4 · Cierre del sprint (viernes 30 – sábado 1)

- [ ] Todas las tareas Must en "Hecho".
- [ ] `main` actualizado, ambos sitios arrancan con `npm run dev` sin errores.
- [ ] Recorrido manual: iniciar sesión, ver muros, publicar, comentar, mandar un DM y abrir un perfil, con un delegado y con un admin.
- [ ] `npm run lint` y `npm run check-types` pasan en web y API.
- [ ] Las decisiones de S1-03 quedaron anotadas.
- [ ] Retro de 15 minutos: qué se atoró y qué se mueve al Sprint 2.

## Orden sugerido por rol

| Día | Backend | Frontend |
|---|---|---|
| Mié 28 | S1-03 (reunión), S1-17, S1-06 | S1-03, S1-05 (commit y PR), S1-19, revisar contrato S1-08 |
| Jue 29 | S1-02 (borrador SQL), S1-07 | Aprobar S1-08, empezar sesión expirada |
| Vie 30 | S1-15, S1-16 (backend, un filtro de una línea) | S1-16 (frontend: ya puede hacerse desde el miércoles) |
| Sáb 1 | S1-18, S1-09, cierre | Recorrido de prueba y cierre |
