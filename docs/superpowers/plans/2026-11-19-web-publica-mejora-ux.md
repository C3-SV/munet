# Mejora visual y de navegación de la web pública (y acciones admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar una versión mejorada de la UI de participantes (y de las acciones/confirmaciones de admin) que conserve la paleta y la base actuales pero corrija jerarquía, navegación, fechas, apodos, chat, comentarios, filtros y exceso de texto.

**Architecture:** Primero se fijan los cimientos (tokens, movimiento, foco). Luego se extraen helpers puros con pruebas `node --test` (fechas, etiqueta de persona, navegación de muros) y componentes compartidos (`Button`, `ConfirmDialog`, `PersonLabel`, iconos inline) que reemplazan los estilos repetidos archivo por archivo. Después se migra cada pantalla (nav, feed, comentarios, chat, copy, admin) para consumirlos. Todo ocurre en `apps/web`; no cambia ningún contrato de la API.

**Tech Stack:** Next.js 16 (App Router, `--webpack`), React 19, Tailwind 4 + variables CSS en `app/globals.css`, Zustand. Pruebas: `node --test` sobre módulos `.ts` puros (Node 22.20 ejecuta `.ts` directamente, igual que `lib/api/base-url.test.mjs`). `@chakra-ui/react` no se usa en ningún `.tsx`.

**Spec:** [`docs/superpowers/specs/2026-11-19-web-publica-critica-ux-design.md`](../specs/2026-11-19-web-publica-critica-ux-design.md)

## Global Constraints

- Toda consulta o mutación de datos sigue pasando por `apps/api`; solo Supabase Realtime sale del navegador (AGENTS.md).
- No cambiar contratos de API, RLS, migraciones, estados ni reglas de negocio. Lo que requiera backend (no leídos, presencia real, paginación) queda fuera: se retira la UI falsa, no se implementa el dato.
- Conservar paleta y fuentes: `--text-accent #1a4072` (claro) / `#58a6ff` (oscuro), `--bubble-me-bg #1a4072` / `#1f4788`, `--bg-base #f8fafc` / `#0d1117`, Poppins (títulos) + Inter (cuerpo), modo oscuro completo. Los valores exactos de los demás tokens están en el spec.
- Pesos tipográficos máximos: 700 (es lo que `next/font` carga). Prohibido `font-black`/`font-extrabold`.
- Texto mínimo en UI: 12 px (`text-xs`). Eliminar `text-[10px]` y `text-[11px]`. Objetivo táctil mínimo de controles: 44×44 px en móvil.
- Un solo rojo de peligro en toda la app (token `--danger`). Cero hex/rgba de estado hardcodeados en `.tsx` fuera de `globals.css`.
- Mayúsculas forzadas (`uppercase`) solo en etiquetas de cabecera de tabla de admin; prohibido en títulos de página, nombres, comités y eyebrows. Eliminar los eyebrows decorativos listados en el spec (hallazgo 9).
- Todo texto en español con tildes y signos de apertura (`¿`, `¡`).
- Fechas: formato `19 nov 2026 · 14:32` (24 h, zona local del navegador, locale `es`). Nunca formatear horas en el servidor para mostrarlas.
- Animación: solo `opacity` y `transform`, 120–200 ms, sin rebote ni `hover:scale`; todo respeta `prefers-reduced-motion`.
- Cada control solo-icono lleva `aria-label`. Cada campo lleva `<label htmlFor>` o `aria-label`.
- Antes de entregar (AGENTS.md): `git status --short` y `git diff --check`; sin commits ni push sin autorización expresa del usuario. Los pasos "Commit" de este plan se ejecutan solo si el usuario lo autoriza.

## Review Focus

1. Fecha `null`, `""` o ISO inválido en posts, comentarios o mensajes: debe mostrar `—`, nunca `Invalid Date` ni lanzar. (Task 2)
2. Cambio de día a medianoche y diferencia de zona horaria: un mensaje enviado 23:50 hora local no debe caer en el separador del día siguiente. (Task 2, Task 10)
3. Persona sin comité (admin que publica en Avisos), sin alias, con alias igual al nombre, o con nombre muy largo sin espacios: no debe salir "COMITE SIN ASIGNAR", ni comillas vacías, ni desbordar la tarjeta. (Task 3)
4. Usuario con cero muros de comité accesibles, o un solo muro: el menú lateral no debe mostrar un acordeón vacío ni de un ítem. (Task 7)
5. Texto con saltos de línea, URLs largas o palabras sin espacios en posts, comentarios y burbujas: `pre-wrap` no debe producir scroll horizontal. (Task 8, 9, 10)
6. Contraste del botón primario y del texto sobre acento en modo oscuro: mínimo 4.5:1. (Task 1, 4)

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `app/globals.css` | Tokens nuevos, foco global, movimiento, quitar `@import` de fuentes y reglas globales sobre `*` |
| `app/layout.tsx`, `lib/theme-context.tsx` | Fuentes vía `next/font` únicamente; tema aplicado antes de hidratar |
| `lib/format-datetime.ts` (+ `.test.mjs`) | Fecha/hora/día legible, sin dependencias |
| `lib/person-label.ts` (+ `.test.mjs`) | Reglas puras de nombre/alias/secundario/iniciales |
| `lib/wall-nav.ts` (+ `.test.mjs`) | Agrupa muros accesibles para el menú |
| `components/ui/Button.tsx` | Único botón público (variantes, `href`, `loading`) |
| `components/ui/ConfirmDialog.tsx` | Diálogo de confirmación compartido (generaliza `AdminConfirmDialog`) |
| `components/ui/PersonLabel.tsx` | Nombre + alias + secundario + avatar de iniciales |
| `components/ui/icons.tsx` | Set único de iconos inline (`currentColor`, trazo 1.75) |
| `components/ui/Card.tsx` | Variantes de tarjeta (`default`, `flat`, `official`) |
| `components/layout/Sidebar.tsx`, `AdminSidebar.tsx` | Navegación y drawer |
| `components/feed/*`, `components/chat/*` | Feed, comentarios, chat |
| `components/admin/*`, `app/(admin)/**` | Acciones y confirmaciones de admin |

---

### Task 1: Cimientos de tokens, foco y movimiento

**Files:**
- Modify: `app/globals.css` (líneas 1, 15-17, 19-33, 36-105, 123-154)
- Modify: `app/layout.tsx:8-11`
- Modify: `lib/theme-context.tsx:17-24`

**Interfaces:**
- Consumes: nada.
- Produces: tokens CSS `--btn-primary-bg`, `--btn-primary-fg`, `--btn-primary-disabled-bg`, `--btn-primary-disabled-fg`, `--danger`, `--danger-bg`, `--success`, `--warning`, `--signal` (ámbar, aviso oficial), `--text-on-accent`, `--radius-sm: 8px`, `--radius-lg: 16px`; clase `.motion-fade-in`; regla global `:focus-visible`. Las Tasks 4–12 los consumen por nombre.

- [ ] **Step 1: Medir la línea base.** Run: `cd apps/web && npx impeccable detect --json app components` (con `C:/Users/chris/.claude/skills/impeccable/scripts/impeccable detect --json app components`). Expected: hallazgos `overused-font` y `bounce-easing` en `globals.css`; anotar el conteo para compararlo al final.
- [ ] **Step 2: Definir tokens** en `:root` y `.dark` de `globals.css`. Valores fijados: `--btn-primary-bg` = `--bubble-me-bg` en claro, `#2f6fd0` en oscuro (≥4.5:1 con `--btn-primary-fg #ffffff`); `--btn-primary-disabled-bg` = mezcla 35 % de `--btn-primary-bg` sobre `--bg-surface`, con `--btn-primary-disabled-fg` = `--text-secondary` (visiblemente distinto del botón secundario, que lleva borde y fondo transparente); `--danger` = `#b91c1c` claro / `#f87171` oscuro; `--danger-bg` = `--danger` al 12 %; `--success` = `#15803d` / `#4ade80`; `--warning` = `#b45309` / `#fbbf24`; `--signal` = `#b45309` / `#fbbf24`; `--text-on-accent` = `#ffffff`. Subir `--text-muted` a `#64748b`-equivalente (claro) y `#8b949e` (oscuro) para texto; no crear un tercer gris decorativo.
- [ ] **Step 3: Foco global.** Añadir `:focus-visible { outline: 2px solid var(--input-focus); outline-offset: 2px; }` y quitar el `outline: none` heredado donde sea regla global.
- [ ] **Step 4: Movimiento.** Eliminar la transición sobre `*, *::before, *::after` (`:15-17`) y la de `button, a, input, textarea` (`:150-154`); sustituir por `transition: background-color 150ms, border-color 150ms, color 150ms` solo en `.btn`/controles que lo pidan. Reemplazar `.animate-message-in` (con `cubic-bezier(0.34, 1.56, 0.64, 1)`) por `.motion-fade-in` (opacity 0→1, `translateY(4px)→0`, 160 ms `ease-out`). Borrar `message-in-left` (sin uso). Añadir `@media (prefers-reduced-motion: reduce) { .motion-fade-in { animation: none; } * { scroll-behavior: auto !important; } }` que conserve el cambio de estado sin animar.
- [ ] **Step 5: Fuentes y tema.** Quitar el `@import` de Google Fonts de `globals.css:1`; dejar solo `next/font` en `layout.tsx` (Poppins 400/500/600/700, Inter variable). En `theme-context.tsx`, resolver el tema inicial desde `localStorage` y `prefers-color-scheme` con un `<script>` inline en `app/layout.tsx` que ponga la clase `dark` antes de hidratar; el efecto del contexto solo sincroniza.
- [ ] **Step 6: Verificar.** Run: `npm run lint -w web` y `npm run check-types -w web`. Expected: ambos en 0. Run el detector de nuevo: `bounce-easing` y `overused-font` no deben aumentar y `bounce-easing` debe desaparecer. Abrir `/login` en claro y oscuro: sin flash claro al recargar en oscuro.
- [ ] **Step 7: Commit** (solo con autorización): `git add apps/web/app/globals.css apps/web/app/layout.tsx apps/web/lib/theme-context.tsx` · `feat(web): tokens de botón y peligro, foco global y movimiento reducido`.

### Task 2: Formato de fecha y hora (hallazgo 1)

**Files:**
- Create: `lib/format-datetime.ts`, `lib/format-datetime.test.mjs`
- Modify: `app/(main)/feed/[muro]/page.tsx:234-253,444`, `components/feed/PostCard.tsx:130-144`, `components/feed/PostComments.tsx:15-35,265`, `components/chat/ChatMessage.tsx:48`, `app/(main)/chat/[id]/page.tsx:42-44,291,308-321`, `app/(main)/chat/page.tsx:442-444`, `components/chat/ChatRoomHeader.tsx:83`, `types/chat.ts`

**Interfaces:**
- Consumes: ISO 8601 `createdAt` que ya entregan feed, comentarios y `DirectMessage.createdAt` (`types/chat.ts`).
- Produces (todas aceptan `options?: { timeZone?: string; now?: Date }` para ser deterministas):
  - `formatDateTime(iso: string | null | undefined, options?): string` → `"19 nov 2026 · 14:32"`, o `"—"` si es inválido.
  - `formatTime(iso, options?): string` → `"14:32"`.
  - `formatDayLabel(iso, options?): string` → `"Hoy"` | `"Ayer"` | `"19 nov 2026"` (relativo al día local de `now`).
  - `isSameLocalDay(a: string, b: string, options?): boolean`.

- [ ] **Step 1: Escribir pruebas que fallan** en `lib/format-datetime.test.mjs` (`import ... from "./format-datetime.ts"`), todas con `timeZone: "America/El_Salvador"`: `formatDateTime("2026-11-19T20:32:00Z")` es `"19 nov 2026 · 14:32"`; `formatTime("2026-11-19T20:32:00Z")` es `"14:32"`; `formatDateTime(null)`, `("")` y `("no-fecha")` son `"—"`; `formatDayLabel("2026-11-19T05:50:00Z", { now: new Date("2026-11-19T20:00:00Z") })` es `"Ayer"` (23:50 del 18 en zona local); mismo día es `"Hoy"`; dos días antes es `"17 nov 2026"`; `isSameLocalDay("2026-11-19T05:50:00Z","2026-11-19T07:00:00Z")` es `false` (cruzan medianoche local).
- [ ] **Step 2: Verlas fallar.** Run: `node --test apps/web/lib/format-datetime.test.mjs`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** las cuatro funciones de arriba con `Intl.DateTimeFormat("es", …)`, `hour12: false`, sin dependencias. Si el ICU de Node abrevia distinto algún mes (p. ej. septiembre), la prueba usa solo noviembre/enero y la implementación normaliza quitando puntos finales.
- [ ] **Step 4: Verlas pasar.** Run: `node --test apps/web/lib/format-datetime.test.mjs`. Expected: PASS.
- [ ] **Step 5: Aplicar en feed y comentarios.** Eliminar `formatRelativeTime` de `feed/[muro]/page.tsx` y la copia de `PostComments.tsx:15-35`; pasar el ISO crudo hasta `PostCard`/`PostComments` y pintar `<time dateTime={iso} title={formatDateTime(iso)}>{formatDateTime(iso)}</time>`. Quitar el reloj SVG decorativo (`PostCard.tsx:130-143`) y el `lowercase`.
- [ ] **Step 6: Aplicar en chat.** `ChatMessage` recibe `createdAt` (ISO) y pinta `formatTime`; el separador de día lo calcula `chat/[id]/page.tsx` con `isSameLocalDay` y `formatDayLabel` (reemplaza el "HOY" fijo). La bandeja (`chat/page.tsx:442-444`, `chat/[id]/page.tsx:42-44`) usa `formatDayLabel` + `formatTime`. `ChatRoomHeader`: eliminar `hace {delegate.lastActive}` (`:83`) y la prop `isOnline`. Quitar `timestamp` del tipo de UI `ChatMessage` en `types/chat.ts` si ya nadie lo usa; `apps/api/src/utils/dm.utils.ts` **no se toca** en este plan (campo `timestamp` queda como compatibilidad).
- [ ] **Step 7: Verificar.** Run: `node --test apps/web/lib/format-datetime.test.mjs && npm run check-types -w web && npm run lint -w web`. Expected: todo en verde. Buscar con Grep que no queden `hace ${`, `toLocaleDateString()`, `toLocaleTimeString(` ni la cadena `HOY` en `apps/web`.
- [ ] **Step 8: Commit** (solo con autorización): `feat(web): fecha y hora explícitas en posts, comentarios y chat`.

### Task 3: Etiqueta de persona (hallazgo 7)

**Files:**
- Create: `lib/person-label.ts`, `lib/person-label.test.mjs`, `components/ui/PersonLabel.tsx`
- Modify: `components/feed/PostCard.tsx:30,120-125`, `components/feed/PostComments.tsx:238`, `components/chat/ChatItem.tsx:58`, `components/chat/ChatRoomHeader.tsx:70,87-93`, `components/profile/UserHoverCard.tsx:100-112`, `app/(main)/directory/page.tsx:258-279`, `app/(main)/profile/page.tsx:185-210`

**Interfaces:**
- Consumes: forma de `User` en `types/common.ts:1-8` (`name`, `alias?`, `committeeName?`, `avatar`, `role`).
- Produces:
  - `buildPersonLabel(p: { name?: string | null; alias?: string | null; committeeName?: string | null; roleName?: string | null }): { primary: string; alias: string | null; secondary: string | null; initials: string }`
  - `<PersonLabel person={...} size?: "sm" | "md" showSecondary?: boolean showAvatar?: boolean />`

- [ ] **Step 1: Pruebas que fallan** en `lib/person-label.test.mjs`: nombre y alias → `primary` = nombre recortado, `alias` = alias recortado; alias vacío, solo espacios o igual al nombre (sin distinguir mayúsculas) → `alias === null`; con comité → `secondary` = comité; sin comité pero con `roleName` → `secondary` = rol; sin ninguno → `secondary === null` y nunca contiene `"SIN ASIGNAR"`; sin nombre → `primary === "Participante"`; `initials` de `"Ana María López"` es `"AM"` y de `"Zoe"` es `"Z"`; nombre de 80 caracteres sin espacios se devuelve íntegro (el truncado es de CSS).
- [ ] **Step 2: Verlas fallar.** Run: `node --test apps/web/lib/person-label.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementar `buildPersonLabel`** en `lib/person-label.ts`.
- [ ] **Step 4: Verlas pasar.** Run: `node --test apps/web/lib/person-label.test.mjs`. Expected: PASS.
- [ ] **Step 5: Crear `PersonLabel`.** Línea 1: nombre en `font-semibold` + alias a su lado en `--text-secondary` (sin comillas, sin mayúsculas, `truncate`); línea 2: `secondary` en `text-xs` `--text-secondary`, caja normal. Avatar de iniciales local cuando no hay imagen (patrón de `ChatItem.tsx:33-44`). En el muro de un comité, `showSecondary={false}` para no repetir el comité en cada post.
- [ ] **Step 6: Sustituir** las cadenas `${name} “${alias}” | COMITÉ`.toUpperCase() de feed, comentarios, perfil y directorio por `PersonLabel`; en chat, hover card y directorio mostrar también el alias. En el directorio, añadir avatar a la fila.
- [ ] **Step 7: Verificar.** Run: `node --test apps/web/lib/person-label.test.mjs && npm run check-types -w web && npm run lint -w web`. Expected: verde. Grep: sin `COMITE SIN ASIGNAR` en `apps/web`.
- [ ] **Step 8: Commit** (solo con autorización): `feat(web): PersonLabel unificado para nombre, alias y comité`.

### Task 4: Componente `Button` y jerarquía de acciones (hallazgo 4 y 5)

**Files:**
- Create: `components/ui/Button.tsx`
- Modify: `components/admin/AdminButton.tsx` (líneas 34, 46, 61-91, 111), `components/feed/PostEditor.tsx:107-140,218-229`, `components/feed/PostComments.tsx:377-391`, `app/(main)/profile/page.tsx:240-253,383-427`, `app/select-event/page.tsx:89-123`, `app/(auth)/login/page.tsx:285-286,321,385,473,590-591`, `app/guia/page.tsx:69-73`, `components/auth/LogOutButton.tsx:19`, y los 12 `<Link><AdminButton/></Link>` listados en el spec (hallazgo 5)

**Interfaces:**
- Consumes: tokens de la Task 1.
- Produces: `<Button variant?: "primary" | "secondary" | "ghost" | "danger" | "danger-text" size?: "sm" | "md" href?: string loading?: boolean leadingIcon?: ReactNode …buttonProps />`. Con `href` renderiza `next/link` (no un `<button>` dentro de `<a>`). `AdminButton` se reimplementa sobre `Button` conservando sus props actuales.

- [ ] **Step 1: Implementar `Button`.** Alturas `md` = 44 px (`min-h-11`), `sm` = 36 px solo en escritorio denso. `primary` usa `--btn-primary-*`; deshabilitado usa `--btn-primary-disabled-*` (nunca igual a `secondary`); `secondary` = borde, fondo transparente; `ghost` = sin borde; `danger` = relleno `--danger`; `danger-text` = texto `--danger` con hit area de 44 px. Foco visible heredado de la Task 1; sin `onMouseEnter/Leave`, hover por CSS; sin `hover:scale`/`active:scale`. `loading` muestra spinner y `aria-busy`.
- [ ] **Step 2: Reimplementar `AdminButton`** sobre `Button`, añadir soporte `href`, quitar `outline: none` (`:34`), el `rgba(239,68,68,…)` (`:46`) y el icono con `--theme-icon-filter` en `danger` (`:111`).
- [ ] **Step 3: Reemplazar** los 12 `<Link><AdminButton/></Link>` por `<AdminButton href=…>`. Run: `Grep "<Link[^>]*>\s*<AdminButton"` con `multiline` en `apps/web/app` → Expected: 0 resultados.
- [ ] **Step 4: Migrar botones públicos** a `Button` y reordenar la jerarquía: **un solo primario por vista**. Perfil: primario = "Guardar perfil"; "Subir foto" es `secondary` sobre el avatar y solo guarda con el flujo existente; "Editar mi perfil" (duplica la pantalla actual) se elimina; "Cambiar evento" `ghost`; "Cerrar sesión" `danger-text`. `select-event`: eliminar el "Entrar al evento" decorativo (`:120-122`); la tarjeta completa es el control. Guía: un único CTA "Empezar".
- [ ] **Step 5: Verificar.** Run: `npm run lint -w web && npm run check-types -w web`. Expected: verde. Grep en `apps/web`: sin `hover:scale`, `active:scale` ni `bg-[var(--text-accent)] text-white`. Verificar a mano contraste del primario en oscuro (≥4.5:1).
- [ ] **Step 6: Commit** (solo con autorización): `feat(web): Button compartido y un primario por vista`.

### Task 5: Diálogo de confirmación compartido (hallazgos 3 y 5)

**Files:**
- Create: `components/ui/ConfirmDialog.tsx`
- Modify: `components/admin/AdminConfirmDialog.tsx` (pasa a reexportar o delegar), `components/feed/PostCard.tsx:38,82`, `components/feed/PostComments.tsx:191`, `app/(main)/chat/[id]/page.tsx:246`, `app/(auth)/login/page.tsx:421-434`, `app/(admin)/admin/events/[eventId]/participants/[membershipId]/page.tsx:451-474`

**Interfaces:**
- Consumes: `Button` (Task 4).
- Produces: `<ConfirmDialog open title description? confirmLabel cancelLabel? tone?: "default" | "danger" requireReason?: boolean loading? onConfirm(reason?: string): void | Promise<void> onCancel(): void />`. Atrapa el foco, lo devuelve al disparador al cerrar, cierra con Esc, `role="dialog"` + `aria-modal` + `aria-labelledby`, bloquea el scroll.

- [ ] **Step 1: Extraer** la lógica de `AdminConfirmDialog` (ya correcta) a `ConfirmDialog`, añadiendo trampa y restauración de foco. `AdminConfirmDialog` queda como envoltorio con su API actual.
- [ ] **Step 2: Sustituir `window.confirm`** en los cuatro sitios públicos (`PostCard.tsx:38,82`, `PostComments.tsx:191`, `chat/[id]/page.tsx:246`) por `ConfirmDialog` con `tone="danger"` y texto corto ("¿Eliminar este mensaje?" / "Esta acción no se puede deshacer."). Run: Grep `window.confirm` en `apps/web` → Expected: 0.
- [ ] **Step 3: Modal de activación del login** (`login/page.tsx:421-434`): reutilizar el contenedor del diálogo para ganar `role="dialog"`, Esc y `aria-label` en el botón de cerrar.
- [ ] **Step 4: Admin:** "Restablecer contraseña" pasa a `tone="danger"`; el título del diálogo no repite el texto exacto del botón (usar pregunta: "¿Suspender esta cuenta?").
- [ ] **Step 5: Verificar.** Run: `npm run lint -w web && npm run check-types -w web`. Expected: verde. A mano: Tab queda dentro del diálogo, Esc cierra, el foco vuelve al botón que lo abrió.
- [ ] **Step 6: Commit** (solo con autorización): `feat(web): ConfirmDialog compartido sin window.confirm`.

### Task 6: Set único de iconos (hallazgo 12)

**Files:**
- Create: `components/ui/icons.tsx`
- Modify: `components/layout/Sidebar.tsx` (líneas 20-40, 178-189, 329, 340-342, 386, 412, 449-450), `components/layout/AdminSidebar.tsx`, `components/admin/AdminButton.tsx`, `components/feed/FeedFilters.tsx`, `components/chat/ChatSearch.tsx`, `components/chat/ChatInput.tsx`, `app/(auth)/login/page.tsx:221-232`

**Interfaces:**
- Consumes: nada.
- Produces: iconos como componentes SVG inline con `size?: number` (24 por defecto), `strokeWidth = 1.75`, `currentColor`, `aria-hidden`: `IconAnnouncements` (megáfono), `IconGeneral` (burbujas), `IconCommittees` (bandera/mesa, distinto de `users`), `IconDirectory` (users), `IconChat`, `IconProfile`, `IconMenu`, `IconClose`, `IconChevronDown`, `IconChevronRight`, `IconSearch`, `IconSend`, `IconTheme`, `IconLogout`, `IconSwitchEvent`, `IconClock` (solo si algún lugar lo necesita).

- [ ] **Step 1: Crear `icons.tsx`** con los iconos listados, mismo trazo y tamaño.
- [ ] **Step 2: Reemplazar** los `<img src="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/...">` y sus `filter: invert(1)` por los iconos inline; el estado inactivo usa `--text-secondary`, no `opacity: 0.5`. Run: Grep `cdn.jsdelivr.net` y `@tabler` en `apps/web` → Expected: 0.
- [ ] **Step 3: Sustituir** los textos "v" y ">" (`Sidebar.tsx:340-342`) por `IconChevronDown`/`IconChevronRight`; los botones "Menu"/"Close" por `IconMenu`/`IconClose` con `aria-label="Abrir menú"` / `"Cerrar menú"`.
- [ ] **Step 4: Unificar** los feather/heroicons sueltos de filtros, búsqueda, chat y login con los de `icons.tsx`.
- [ ] **Step 5: Verificar.** Run: `npm run lint -w web && npm run check-types -w web`. Expected: verde. Con la red cortada (DevTools offline) la navegación sigue mostrando todos los iconos.
- [ ] **Step 6: Commit** (solo con autorización): `refactor(web): set único de iconos inline`.

### Task 7: Navegación de muros y drawer (hallazgo 3)

**Files:**
- Create: `lib/wall-nav.ts`, `lib/wall-nav.test.mjs`
- Modify: `components/layout/Sidebar.tsx` (líneas 43-66, 83-92, 160-166, 200-290, 329-366, 466-483), `app/(main)/feed/[muro]/page.tsx` (cabecera del muro), `app/(main)/layout.tsx`

**Interfaces:**
- Consumes: `EventWall` de `types/common.ts:59-71` (`kind: "general" | "announcements" | "committee" | "other"`, `slug`, `committeeName`, `canAccess`), iconos de la Task 6.
- Produces: `buildWallNav(walls: EventWall[], activeSlug: string | null): { announcements: EventWall | null; general: EventWall | null; mine: EventWall | null; committees: EventWall[]; showCommitteeGroup: boolean; activeSlug: string | null }`. `mine` = el único muro de comité cuando solo hay uno accesible; `committees` = el resto; `showCommitteeGroup` = hay más de un muro de comité accesible.

- [ ] **Step 1: Pruebas que fallan** en `lib/wall-nav.test.mjs`: con `announcements` + `general` + 1 comité accesible → `mine` es ese comité, `committees` vacío y `showCommitteeGroup === false`; con 3 comités → `mine === null`, `committees.length === 3`, `showCommitteeGroup === true`; muros con `canAccess: false` se ignoran; sin ningún muro → todo `null`/vacío sin lanzar; `activeSlug` se devuelve tal cual; `general` cae en el primer muro sin `committeeId` si no hay `kind: "general"` (misma regla que `Sidebar.tsx:160-163`).
- [ ] **Step 2: Verlas fallar.** Run: `node --test apps/web/lib/wall-nav.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementar `buildWallNav`.**
- [ ] **Step 4: Verlas pasar.** Run: `node --test apps/web/lib/wall-nav.test.mjs`. Expected: PASS.
- [ ] **Step 5: Reestructurar `Sidebar`.** Lista plana siempre visible: Avisos, General, **Mi comité** (nombre del comité, sin acordeón); solo si `showCommitteeGroup` hay un grupo "Comités" colapsable, abierto cuando `activeSlug` pertenece a él (calculado con `pathname === /feed/<slug>`, no con `includes("comite")`). Activo = barra lateral de 3 px en `--text-accent` + fondo `--sidebar-active-bg`, no solo color de texto. Animar el grupo con `grid-template-rows` (no `maxHeight`).
- [ ] **Step 6: Drawer móvil.** Abre por la izquierda, se cierra al cambiar `pathname` (como `AdminSidebar.tsx:70-72`) y con Esc; `aria-expanded` en el disparador; los enlaces fuera de pantalla no son enfocables mientras está cerrado (`inert`). La barra superior móvil prioriza el menú; el selector de tema pasa a icono solo.
- [ ] **Step 7: Pie del sidebar.** Mostrar nombre del participante (no `participantCode`); avatar de respaldo con iniciales locales — eliminar `ui-avatars.com` (`:466-472`). Añadir "Cerrar sesión" (`Button` `danger-text`) y acceso a `/guia`. Eliminar eyebrow "Evento actual" (`:281-286`) y "Sin comités disponibles." (`:360-366`).
- [ ] **Step 8: Selector rápido en el muro.** En la cabecera de `feed/[muro]/page.tsx`, fila de chips con los muros accesibles (visible solo en móvil), el activo resaltado.
- [ ] **Step 9: Verificar.** Run: `node --test apps/web/lib/wall-nav.test.mjs && npm run check-types -w web && npm run lint -w web`. Expected: verde. A mano en 390 px: tocar un muro cierra el drawer. Grep: sin `ui-avatars` ni `includes("comite")` en `apps/web`.
- [ ] **Step 10: Commit** (solo con autorización): `feat(web): menú de muros plano y drawer móvil que se cierra al navegar`.

### Task 8: Tarjetas, editor y filtros del feed (hallazgos 2, 8, 10)

**Files:**
- Modify: `components/ui/Card.tsx:6-17`, `components/feed/PostCard.tsx` (líneas 119-197, 199-284), `components/feed/PostEditor.tsx` (líneas 99-229), `components/feed/FeedFilters.tsx` (líneas 99-249), `app/(main)/feed/[muro]/page.tsx` (líneas 287-300, 349-382), `app/select-event/page.tsx`, `app/(main)/directory/page.tsx`

**Interfaces:**
- Consumes: `PersonLabel` (Task 3), `Button` (Task 4), iconos (Task 6), `formatDateTime` (Task 2).
- Produces: `<Card variant?: "default" | "flat" | "official">` (`flat` = sin sombra ni borde lateral, separador inferior; `official` = borde izquierdo de 4 px en `--signal` y etiqueta "Aviso"); `<FeedFilters …>` con el mismo contrato de props externo pero UI nueva.

- [ ] **Step 1: Card.** Añadir variantes; radio por contexto (`--radius-lg` en contenedores, `--radius-sm` en chips/elementos densos); quitar `shadow-sm` de ítems de lista.
- [ ] **Step 2: PostCard.** Posts de `announcements` usan `official`; posts de delegado usan `flat`; encuestas llevan cabecera propia ("Encuesta · abierta/cerrada"). Cuerpo con `white-space: pre-wrap` y `overflow-wrap: anywhere`. Eliminado → texto claro "Eliminada por la organización" o "Eliminada por su autor" según `deletedByActorType`. Encuesta cerrada no usa `cursor: not-allowed`. Revisar que `committeeTags` no duplique el comité del autor.
- [ ] **Step 3: PostEditor.** Tabs "Publicación/Encuesta" pasan a control segmentado simple en caja normal; placeholder "Escribe tu intervención" (el dueño puede ajustar la voz); `label` accesible; contador solo al superar el 80 % del límite; mantener el borrador en `sessionStorage` por muro.
- [ ] **Step 4: FeedFilters.** Una fila compacta: búsqueda colapsable (icono → input), control segmentado `Recientes | Antiguos` (reemplaza el dropdown de dos opciones), y en el muro General chips de comité con scroll horizontal. Chips de filtros activos con "Limpiar". `aria-pressed` en el segmentado; sin hover por JS.
- [ ] **Step 5: Cabecera del muro** (`feed/[muro]/page.tsx:349-382`): quitar eyebrow "Foro de discusion"; título en caja normal con identidad por muro (Avisos = aviso oficial, General = abierto, Comité = nombre y código). Banner de error: texto humano + botón "Reintentar", fondo por tokens (no `color-mix(... white)`).
- [ ] **Step 6: Estados de carga.** Reemplazar "Cargando..." por 3 skeletons de tarjeta (`motion-fade-in` suave, sin shimmer si hay `prefers-reduced-motion`).
- [ ] **Step 7: Verificar.** Run: `npm run lint -w web && npm run check-types -w web`. Expected: verde. Con un texto de 300 caracteres sin espacios y otro con saltos de línea, la tarjeta no genera scroll horizontal en 390 px.
- [ ] **Step 8: Commit** (solo con autorización): `feat(web): tarjetas por tipo, editor y filtros del feed rediseñados`.

### Task 9: Comentarios colapsados y sin cajas anidadas (hallazgo 6)

**Files:**
- Modify: `components/feed/PostComments.tsx` (líneas 62-138, 222-401), `components/feed/PostCard.tsx` (pie de acciones), `lib/api/comments.ts` solo si hace falta pedir conteo con los datos ya existentes

**Interfaces:**
- Consumes: `PersonLabel` (Task 3), `formatDateTime` (Task 2), `Button` (Task 4), `ConfirmDialog` (Task 5).
- Produces: `<PostComments postId … defaultOpen?: boolean />` que no carga ni abre canal realtime hasta estar abierto.

- [ ] **Step 1: Colapsar por defecto.** El pie del post muestra un `Button` `ghost` "N comentarios" (o "Comentar" si 0); el listado y el composer aparecen solo al abrirlo. Si la lista de posts ya trae el conteo, usarlo; si no, no mostrar número hasta abrir (sin llamadas nuevas ni cambios de contrato).
- [ ] **Step 2: Carga bajo demanda.** `getPostComments` y la suscripción realtime (`:62`, `:104`) se inician solo al abrir y se cancelan al cerrar el componente. Run: con 30 posts cargados, la pestaña Network muestra 0 llamadas de comentarios hasta abrir uno.
- [ ] **Step 3: Diseño del comentario.** Sin caja con borde por comentario: avatar de 32 px + `PersonLabel` en una línea con fecha (`<time>`), cuerpo debajo; respuestas con sangría y filete lateral de 2 px y una línea "En respuesta a <nombre>" en `text-xs`. Quitar eyebrow "Comentarios" (`:224-229`). Estado vacío con acción: "Sé la primera persona en comentar."
- [ ] **Step 4: Composer.** `<form>` con `textarea` de auto-altura: Enter envía, Shift+Enter inserta salto, botón `primary` con estado deshabilitado propio; en táctil Enter inserta salto (`matchMedia("(pointer: coarse)")`). Foco permanece en el campo tras enviar. Texto con `pre-wrap`.
- [ ] **Step 5: Eliminar** con `ConfirmDialog` (Task 5), acción en menú "⋯" de 44 px, no texto rojo suelto.
- [ ] **Step 6: Verificar.** Run: `npm run lint -w web && npm run check-types -w web`. Expected: verde. A mano: un comentario nuevo de otra sesión aparece en tiempo real solo en posts abiertos.
- [ ] **Step 7: Commit** (solo con autorización): `feat(web): comentarios colapsados, sin cajas anidadas y con carga bajo demanda`.

### Task 10: Chat usable en pleno debate (hallazgo 2)

**Files:**
- Create: `lib/chat-groups.ts`, `lib/chat-groups.test.mjs`
- Modify: `components/chat/ChatInput.tsx` (líneas 70, 81-86, 92, 119-124), `components/chat/ChatMessage.tsx` (líneas 27-59), `components/chat/ChatItem.tsx` (líneas 46-49, 58, 72-85), `components/chat/ChatRoomHeader.tsx`, `components/chat/ChatHeader.tsx:12-17`, `app/(main)/chat/[id]/page.tsx` (líneas 206-209, 246, 291-321), `app/(main)/chat/page.tsx` (líneas 380-387, 437-449)

**Interfaces:**
- Consumes: `formatTime`, `formatDayLabel`, `isSameLocalDay` (Task 2), `PersonLabel` (Task 3), `ConfirmDialog` (Task 5).
- Produces: `groupMessages(messages: { id: string; senderId: string; createdAt: string }[], options?: { timeZone?: string; now?: Date; windowMinutes?: number }): Array<{ dayLabel: string | null; runs: Array<{ senderId: string; messageIds: string[] }> }>` — `dayLabel` solo en el primer grupo de cada día; un `run` agrupa mensajes consecutivos del mismo autor separados por menos de `windowMinutes` (5 por defecto).

- [ ] **Step 1: Pruebas que fallan** en `lib/chat-groups.test.mjs` (zona `America/El_Salvador`): tres mensajes del mismo autor en 2 minutos → un solo `run` con 3 ids; cambio de autor → nuevo `run`; hueco de 6 minutos del mismo autor → nuevo `run`; mensajes a 23:50 y 00:10 locales → dos grupos, el segundo con `dayLabel` ("Hoy"/"Ayer"/fecha) y el primero con el suyo; lista vacía → `[]`; ids duplicados no se repiten.
- [ ] **Step 2: Verlas fallar.** Run: `node --test apps/web/lib/chat-groups.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementar `groupMessages`.**
- [ ] **Step 4: Verlas pasar.** Run: `node --test apps/web/lib/chat-groups.test.mjs`. Expected: PASS.
- [ ] **Step 5: `ChatInput`.** Durante el envío usar `readOnly` (no `disabled`) y devolver el foco con `textareaRef.current?.focus()` tras el `await`; en táctil Enter inserta salto y solo el botón envía; eliminar el texto permanente "Enter para enviar…" (mostrarlo como `title`/`aria-label` del botón); botón con `aria-label="Enviar mensaje"` y 44 px.
- [ ] **Step 6: Burbujas.** `white-space: pre-wrap; overflow-wrap: anywhere`; mensajes agrupados con hora solo en el último de cada `run` (`<time>` con `title` = `formatDateTime`); animación `.motion-fade-in`. Separadores de día con `dayLabel` real. Acción "Eliminar": menú "⋯" accesible (clic y teclado) en burbujas propias, con `ConfirmDialog`; quitar el texto rojo permanente.
- [ ] **Step 7: Scroll.** En `chat/[id]/page.tsx:206-209`, desplazar al fondo sin animación en la carga inicial; ante mensajes nuevos, solo si el usuario está a menos de 120 px del final; si no, mostrar chip "Mensajes nuevos" que baja al pulsarlo. Verificar por código que el contenedor del chat esté acotado en altura (`app/(main)/layout.tsx:83`, `flex-1 shrink-0` — por verificar con sesión) y corregirlo si el encabezado se desplaza con la lista.
- [ ] **Step 8: Bandeja y cabecera.** Quitar el punto verde "en línea" falso de `ChatItem.tsx:46-49`; vista previa con prefijo "Tú: " cuando `lastMessageAuthorId` sea el usuario actual; quitar contador "N conversaciones" en mayúsculas (`chat/page.tsx:380-387`), subtítulo de `ChatHeader.tsx:12-17` y `BrandAttribution` de `ChatRoomHeader.tsx:96`. En la sala móvil, añadir botón de volver visible de 44 px además del acceso al menú.
- [ ] **Step 9: Verificar.** Run: `node --test apps/web/lib/chat-groups.test.mjs apps/web/lib/format-datetime.test.mjs && npm run check-types -w web && npm run lint -w web`. Expected: verde. A mano en 390 px: tras enviar, el teclado sigue abierto; Shift+Enter conserva saltos en la burbuja.
- [ ] **Step 10: Commit** (solo con autorización): `feat(web): chat con fechas reales, mensajes agrupados y foco estable`.

### Task 11: Limpieza de texto, eyebrows, tildes y guía (hallazgos 9 y 13)

**Files:**
- Modify: `app/(main)/directory/page.tsx:136-141`, `app/select-event/page.tsx:82-84,104,136,151,155-158`, `app/(main)/profile/page.tsx:171-173,197,321-358`, `app/(main)/profile/[membershipId]/page.tsx:349,358`, `app/(main)/layout.tsx:64-72`, `components/layout/Footer.tsx`, `app/guia/page.tsx`, `components/layout/BrandAttribution.tsx`, `app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: tokens y `Button` previos.
- Produces: ninguna interfaz nueva; criterio de salida medible (ver Step 7).

- [ ] **Step 1: Eliminar** los textos y eyebrows listados en el spec (hallazgo 9) que sigan presentes tras las Tasks 7–10. No introducir copy de reemplazo salvo estados vacíos con acción.
- [ ] **Step 2: Select-event.** Mostrar solo nombre del evento y el rol traducido (mapa `ACTIVE→"Activo"`, etc., sin enums crudos); sin descripción, sin nota para admin.
- [ ] **Step 3: Perfil.** Rol y comité pasan a texto en la cabecera (ya están en `PersonLabel`); quitar los inputs deshabilitados duplicados.
- [ ] **Step 4: Footer y marca.** Una sola línea: `© 2026 MUN ESEN` + "Guía de uso". `BrandAttribution`: texto ≥12 px con contraste ≥4.5:1 (hallazgos del detector en `/login`, `/select-event`, `/guia`).
- [ ] **Step 5: Guía pública.** Una sola numeración; sin eyebrows ni hero con 3 CTA; sin la tarjeta "¿Problemas para entrar?" duplicada; quitar menciones a "Supabase" y "equipo técnico" (`:159,186`) y las secciones "en construcción" (`:190`); mover lo exclusivo de organizadores a una sección claramente separada al final o fuera de la guía pública (decisión del dueño: ver Verification final). Longitud de línea ≤ 75 caracteres (`max-w-prose`).
- [ ] **Step 6: Tildes.** Corregir todas las omisiones listadas en el spec (hallazgo 13). Run: Grep `-i` con `discusion|sesion|conversacion|publicacion|Delegacion|Institucion|membresias|Aun |Todavia|Deseas continuar\?` en `apps/web/app` y `apps/web/components` → Expected: solo coincidencias ya acentuadas o en identificadores de código.
- [ ] **Step 7: Verificar.** Run: `npm run lint -w web && npm run check-types -w web`. Expected: verde. Grep `text-\[10px\]|text-\[11px\]|font-black|font-extrabold` en `apps/web/app` y `apps/web/components` → Expected: 0. Grep `uppercase` → Expected: solo cabeceras de tabla de admin. Contar con Grep `tracking-widest` → Expected: 0 fuera de cabeceras de tabla.
- [ ] **Step 8: Commit** (solo con autorización): `refactor(web): quitar texto redundante, eyebrows y corregir tildes`.

### Task 12: Admin — acciones, filas y paneles (hallazgo 5)

**Files:**
- Modify: `components/layout/AdminSidebar.tsx` (líneas 104-115, 194, 205-210, 259), `components/admin/AdminPageHeader.tsx:65-72`, `app/(admin)/admin/page.tsx` (líneas 22, 29, 70-110), `app/(admin)/admin/events/page.tsx` (líneas 86-108, 247), `app/(admin)/admin/events/[eventId]/committees/page.tsx:249`, `app/(admin)/admin/events/[eventId]/participants/page.tsx` (líneas 130-137, 325, 455, 490), `app/(admin)/admin/events/[eventId]/participants/[membershipId]/page.tsx` (líneas 451-474, 596-623), `components/admin/AdminStatusBadge.tsx`

**Interfaces:**
- Consumes: `Button`/`AdminButton` (Task 4), `ConfirmDialog` (Task 5), iconos (Task 6), tokens (Task 1).
- Produces: `<RowActions primary={{ label; href }} items={Array<{ label; href?; onSelect?; tone?: "default" | "danger" }> } />` en `components/admin/RowActions.tsx` — una acción primaria visible + menú "⋯" accesible (teclado, Esc, `aria-haspopup`).

- [ ] **Step 1: `RowActions`.** Crear el componente y usarlo en eventos (`events/page.tsx:86-108`: primaria "Abrir", menú con Participantes/Comités/Configurar), comités y participantes (`participants/page.tsx:130-137`: primaria "Gestionar").
- [ ] **Step 2: Secciones en construcción.** En `admin/page.tsx:70-97` y `AdminSidebar.tsx:104-115`, quitar las tarjetas/enlaces a Asignaciones y Moderación o marcarlos con etiqueta "Pronto" y sin enlace; eliminar sus descripciones que prometen funciones inexistentes. Quitar `hover:scale-[1.01] active:scale-95` (`:22`) y la sombra hardcodeada (`:29`).
- [ ] **Step 3: Cabeceras.** Quitar la descripción por página de `AdminPageHeader` (queda opcional y vacía por defecto), el eyebrow "Panel de Control" (`AdminSidebar.tsx:205-210`) y el "Bienvenido al centro de control…" (`admin/page.tsx:105-110`). Cabeceras de tabla: mantener `uppercase` pero con `tracking-wide` y `text-xs`.
- [ ] **Step 4: Estados y rojo único.** `AdminStatusBadge` usa `--success`, `--warning`, `--danger`, `--danger-bg` (cero hex). Rol de participante: `select` en vez de texto libre; filtros de participantes se aplican al escribir/seleccionar (sin botón "Filtrar").
- [ ] **Step 5: Confirmaciones.** Acciones destructivas o que invaliden estado (suspender, restablecer contraseña, eliminar comité, cambio de comité) usan `ConfirmDialog` con `tone="danger"` y texto específico; el drawer móvil del admin conserva el cierre al navegar (`AdminSidebar.tsx:70-72`); botón de cierre de 44 px (`:194`, `:259`).
- [ ] **Step 6: Verificar.** Run: `npm run lint -w web && npm run check-types -w web`. Expected: verde. Grep `<AdminButton` dentro de `<Link` (multiline) → 0; Grep `#[0-9a-fA-F]{6}` en `components/admin` y `app/(admin)` → 0. A mano con teclado: foco visible en todos los botones, Tab no se duplica en acciones con `href`.
- [ ] **Step 7: Commit** (solo con autorización): `feat(web): acciones de fila, confirmaciones y limpieza del panel admin`.

### Task 13: Documentación y verificación final

**Files:**
- Modify: `docs/04-desarrollo/pruebas-y-validacion.md` (tabla de comandos y evidencia), `docs/01-producto/funcionalidades.md` (solo si cambia lo visible: p. ej. fecha y hora en mensajes, comentarios colapsados), y la matriz de trazabilidad si algún requisito cambia
- No tocar: `docs/superpowers/` previos (AGENTS.md)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: documentación al día y evidencia de verificación.

- [ ] **Step 1: Actualizar docs** (primero el documento especializado, luego la matriz de trazabilidad si aplica): añadir a `pruebas-y-validacion.md` el comando `node --test apps/web/lib/*.test.mjs apps/web/lib/api/*.test.mjs` y registrar las suites nuevas (`format-datetime`, `person-label`, `wall-nav`, `chat-groups`). No copiar reglas completas: enlazar al spec.
- [ ] **Step 2: Suite completa.** Run: `node --test apps/web/lib/*.test.mjs apps/web/lib/api/*.test.mjs && npm test -w api && npm run check-types && npm run lint`. Expected: todo en 0 fallos.
- [ ] **Step 3: Detector.** Run: `C:/Users/chris/.claude/skills/impeccable/scripts/impeccable detect --json app components` y sobre `/login`, `/guia`, `/select-event` en 390×844 y 1440×900. Expected: sin `low-contrast`, `undersized-ui-text`, `hero-eyebrow-chip`, `numbered-section-labels` ni `bounce-easing`; `overused-font` puede quedar (decisión de marca: Inter se conserva).
- [ ] **Step 4: Recorrido manual** en entorno aislado con datos ficticios (ver `pruebas-y-validacion.md`, recorrido 6), en claro/oscuro y 390/1440 px: login → select-event → feed (Avisos, General, un comité) → publicar, comentar, votar → chat entre dos sesiones → perfil → admin (eventos, participantes, suspender y restablecer con confirmación). Registrar resultado y limitaciones.
- [ ] **Step 5: Revisión de entrega.** Run: `git status --short` y `git diff --check`; confirmar que el diff solo contiene archivos de `apps/web` y `docs/` autorizados. Run `/impeccable critique` sobre `app/(main)/feed/[muro]/page.tsx` para comparar puntaje contra 20/40.
- [ ] **Step 6: Commit** (solo con autorización): `docs(web): validación de la mejora de UX pública`.

---

## Self-Review

- **Cobertura del spec:** fechas (T2), chat (T10), muros/drawer (T7), botones (T4), admin (T4, T5, T12), comentarios (T9), apodos (T3), cards (T8), texto repetido/eyebrows/guía/tildes (T11), filtros (T8), animaciones (T1, T4, T8), iconos (T6), tipografía y contraste (T1, T11), foco/tema (T1), A11y de formularios (Global Constraints; T5 login, T8 editor, T11). Gaps: asociación `htmlFor` en los 29 campos restantes se cubre en cada Task que toca el archivo; verificarla en T13 Step 3 con el detector sobre `/login`.
- **Consistencia de nombres:** `formatDateTime/formatTime/formatDayLabel/isSameLocalDay` (T2) se usan igual en T9 y T10; `buildPersonLabel`/`PersonLabel` (T3) en T8–T10; `Button` y `ConfirmDialog` (T4, T5) en T8–T12; `buildWallNav` (T7); `groupMessages` (T10); `RowActions` (T12).
- **Fuera de alcance, para seguimiento:** no leídos en bandeja, presencia real, paginación server-side del feed, `timestamp` del servidor en `dm.utils.ts`, y quitar `@chakra-ui/react` de `package.json`.
- **Decisiones del dueño pendientes:** si la guía pública conserva la sección de organizadores; la voz del placeholder del editor; si `Inter` se mantiene (el detector lo marca como `overused-font`).
