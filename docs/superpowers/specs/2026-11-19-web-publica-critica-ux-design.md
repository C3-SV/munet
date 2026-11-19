# Crítica y auditoría de la web pública de MUNET (apps/web)

Fecha: 2026-11-19. Método: dual-agent (A: revisión de diseño sobre código + capturas de `/login` y `/guia`; B: detector Impeccable + mediciones por grep). Las rutas privadas (feed, chat, directorio, perfil, admin) se evaluaron solo por código: no hubo sesión. Todo lo que dependa de datos reales queda marcado "por verificar".

## Alcance y restricciones del dueño

- Conservar el sistema visual base (azul `#1a4072`, neutros slate, Poppins + Inter, modo oscuro). No rehacer desde cero; hacer una versión mejorada.
- Prioridad: web pública (participantes). Admin: botones de acción y confirmaciones.
- Quejas explícitas: jerarquía de botones, navegación, iconos, exceso de comentarios/eyebrows/texto repetido, animaciones, forma de cards, apodos, fecha y hora de mensajes (quiere fecha y hora explícitas), comentarios, chat, filtros, menú lateral de muros, sensación "plana e igual / slop".
- Fuera de alcance: cambios de contrato de API, RLS, migraciones, nuevas funciones de negocio (no leídos, presencia real, paginación server-side).

## Veredicto de especificidad

Genérico, de plantilla SaaS. Todas las superficies usan la misma receta (`rounded-2xl`, borde 1 px, `shadow-sm`, fondo blanco); todos los H1 van en `uppercase font-black`; hay unos 47 micro-labels `uppercase tracking-widest 10-11px` en la web pública. No hay jerarquía entre aviso oficial, post de delegado y encuesta. La paleta se conserva; lo que falla son las decisiones de forma, énfasis y contexto.

## Puntaje de heurísticas (Nielsen): 20/40 (Aceptable)

| # | Heurística | Puntaje | Problema clave |
|---|---|---|---|
| 1 | Estado del sistema | 2 | Punto "en línea" falso (`ChatItem.tsx:46-49`); sin feedback al publicar/votar |
| 2 | Lenguaje del usuario | 3 | Enums crudos (`ACTIVE`), tildes omitidas, voz de red social |
| 3 | Control y libertad | 2 | `window.confirm` nativo; drawer móvil no se cierra al navegar |
| 4 | Consistencia | 2 | Tres sets de iconos, cuatro rojos, botones hechos a mano |
| 5 | Prevención de errores | 2 | Enter envía en móvil; "Restablecer contraseña" va como primario |
| 6 | Reconocimiento | 2 | Muros ocultos en acordeón; "Menu"/"Close"; chevrons "v" y ">" |
| 7 | Flexibilidad | 1 | Sin atajos; Enter no envía comentario |
| 8 | Estética minimalista | 2 | Texto repetido, eyebrows, comentarios siempre abiertos |
| 9 | Recuperación de errores | 2 | Banner con `error.message` crudo, sin reintento en feed/chat |
| 10 | Ayuda | 2 | `/guia` orientada a organizadores, filtra jerga interna |

Carga cognitiva: falla 4 de 8 (foco único, jerarquía visual, opciones mínimas, divulgación progresiva).

## Hallazgos prioritarios (con ubicación)

### P1

1. **Fechas y horas.** Feed: `app/(main)/feed/[muro]/page.tsx:234-253` (`formatRelativeTime`), pintado en `components/feed/PostCard.tsx:130-144`. Comentarios: `components/feed/PostComments.tsx:15-35`, pintado en `:265`. Chat: `components/chat/ChatMessage.tsx:48` pinta `message.timestamp`, que la API formatea en servidor (`apps/api/src/utils/dm.utils.ts:78-81`, `toLocaleTimeString` con zona del servidor, solo hora). El ISO completo ya viaja en `createdAt`. Separador "HOY" hardcodeado en `app/(main)/chat/[id]/page.tsx:308-321`. Bandeja: `chat/page.tsx:442-444` y `chat/[id]/page.tsx:42-44` usan `toLocaleDateString()` sin locale. Bug visible: `components/chat/ChatRoomHeader.tsx:83` pinta `hace {delegate.lastActive}` y `chat/[id]/page.tsx:291` pasa `isOnline={false}` siempre.
2. **Chat poco usable.** `ChatInput.tsx:70` deshabilita el textarea al enviar (se cierra el teclado en móvil); `:81-86` Enter siempre envía; `ChatMessage.tsx:27-41` y `PostCard.tsx:189-197` no usan `white-space: pre-wrap` (se pierden saltos de línea); `chat/[id]/page.tsx:206-209` hace `scrollIntoView` suave en cada cambio de mensajes; "Eliminar" rojo bajo cada mensaje propio (`ChatMessage.tsx:49-59`) con `window.confirm` (`chat/[id]/page.tsx:246`); mensajes del mismo autor sin agrupar; punto "en línea" siempre verde.
3. **Navegación de muros.** `components/layout/Sidebar.tsx:83` abre el acordeón solo si el pathname incluye "comite" (las rutas son `/feed/<slug>`); chevrons de texto "v" y ">" (`:340-342`); drawer móvil abre por la derecha (`:250`) y no cierra al navegar (a diferencia de `AdminSidebar.tsx:70-72`); botón "Menu" (`:236`) y "Close" (`:274`) en inglés y sin `aria-label`; sin logout en el sidebar; pie muestra `participantCode` en vez del nombre (`:483`); avatar de respaldo envía el código de login a `ui-avatars.com` (`:466-472`).
4. **Jerarquía de botones.** No hay `Button` público; cada archivo repite estilos inline. El primario usa `--bubble-me-bg` (token de burbuja). El primario deshabilitado es idéntico al secundario (`PostComments.tsx:377-391`, `PostEditor.tsx:226-229`, `profile/page.tsx:240-253`). Un "Comentar" primario por post. Destructivo = texto rojo 11-12 px con cuatro rojos distintos. Perfil: cuatro botones de peso distinto (`profile/page.tsx:383-427`). `select-event/page.tsx:120-122` "Entrar al evento" decorativo.
5. **Admin.** `<Link><AdminButton/></Link>` en al menos 12 sitios (HTML inválido, doble parada de tabulación): `events/page.tsx:184,227`, `committees/page.tsx:173,228`, `committees/[committeeId]/edit/page.tsx:246`, `events/[eventId]/page.tsx:211,219`, `participants/new/page.tsx:264`, `participants/page.tsx:325,455`, `participants/[membershipId]/page.tsx:508`. `AdminButton.tsx:34` `outline: none` sin foco visible. Acciones de fila = tres links de 12 px. `AdminConfirmDialog` solo se usa en `participants/[membershipId]/page.tsx:451`; "Restablecer contraseña" va primario (`:474`). Dos de cuatro tarjetas de `admin/page.tsx:70-97` llevan a "en construcción".
6. **Comentarios.** `PostComments.tsx:222-401`: siempre abiertos, un fetch y un canal realtime por post (`:62`, `:104`), caja dentro de caja (`:241-248`), sin hilo, composer sin `form`/Enter (`:358-370`), `window.confirm` (`:191`).

### P2

7. **Apodos/nombres.** `PostCard.tsx:30` y `PostComments.tsx:238` arman `NOMBRE “ALIAS” | COMITÉ` en mayúsculas; admin sale como "COMITE SIN ASIGNAR". Chat (`ChatItem.tsx:58`, `ChatRoomHeader.tsx:70`) y hover card (`UserHoverCard.tsx:100-112`) omiten alias. Perfil: `profile/page.tsx:185-210`. Directorio es el único con jerarquía razonable.
8. **Cards planas.** `components/ui/Card.tsx:6-17` receta única; se repite a mano en `PostEditor.tsx:99-106`, `select-event/page.tsx:93-98`, `directory/page.tsx:251-257`.
9. **Texto repetido / eyebrows** (eliminar): `feed/[muro]/page.tsx:349-354`, `directory/page.tsx:136-141`, `chat/ChatHeader.tsx:12-17`, `ChatInput.tsx:119-124`, `PostComments.tsx:224-229`, `Sidebar.tsx:281-286` y `:360-366`, `select-event/page.tsx:82-84,104,120-122,155-158`, `profile/page.tsx:171-173` y campos Rol/Comité duplicados `:321-358`, `AdminPageHeader.tsx:65-72`, `AdminSidebar.tsx:205-210`, `admin/page.tsx:105-110`, `Footer.tsx`, `ChatRoomHeader.tsx:96`, `guia/page.tsx` (triple numeración, hero con 3 CTA, jerga "Supabase"/"equipo técnico" en `:159,186`).
10. **Filtros del feed.** `components/feed/FeedFilters.tsx`: dropdown de dos opciones (`:99-158`), etiqueta "Comités"/"Filtros" (`:177-178`), sin `aria-expanded`/Esc, hover por JS; ocupa el espacio más caro de la pantalla.
11. **Animaciones.** `globals.css:150-154` transición sobre `*`; `.animate-message-in` con rebote (`:145-147`, detector `bounce-easing`); `hover:scale` en login/select-event/`LogOutButton.tsx:19`; acordeón con `maxHeight` (`Sidebar.tsx:345-351`); cero `prefers-reduced-motion`; "Cargando..." en vez de skeletons.
12. **Iconos.** Tabler remoto `@latest` vía `<img>` + `filter: invert(1)` (Sidebar, AdminSidebar, AdminButton); tres sets (Tabler, feather inline, heroicons); campana para Avisos, `users` para muros de comités; texto como icono.
13. **Tipografía.** `font-black`/`font-extrabold` con Poppins 400-700 cargado; doble carga de fuentes (`globals.css:1` `@import` + `next/font`); detector `overused-font` (Inter); H1 en mayúsculas; tildes omitidas sistemáticamente ("discusion", "sesion", "conversacion", "COMITE SIN ASIGNAR", etc.).

### P3

14. Contraste: `--text-muted #94a3b8` sobre blanco ≈ 2.5:1; texto 10-11 px (33 usos); `#ef4444` pequeño ≈ 3.8:1; botón primario en oscuro `#1f4788` sobre `#1c2128`; `--sidebar-active-bg #f0f4ff` casi invisible.
15. Tema: flash claro en modo oscuro (`lib/theme-context.tsx:17-24`), no respeta `prefers-color-scheme`.
16. Foco: 35 `outline-none` contra 4 `focus:`/`focus-visible:`; sin `:focus-visible` global.
17. A11y: 29 de 38 campos sin asociación `htmlFor`/`aria-label` (heurística); botón cerrar de modal de login sin `aria-label` (`login/page.tsx:427`), sin Esc ni `role="dialog"` (`:421`); ver contraseña `tabIndex={-1}` (`:337-345`); hover card solo con puntero.
18. Chakra UI en `package.json` sin uso en `.tsx`; tokens duplicados entre `@theme` y `:root` en `globals.css`.

## Evidencia determinista (detector)

- Código fuente (55 archivos): `overused-font` (`globals.css:1`) y `bounce-easing` (`globals.css:146`).
- URL `/login`, `/select-event` (390 y 1440): `low-contrast` y `undersized-ui-text` del pie "Desarrollado por C3" (2.5:1, 10 px).
- URL `/guia`: 18 hallazgos a 1440 y 25 a 390 (`low-contrast`, `hero-eyebrow-chip`, `numbered-section-labels`, `line-length`, `straggler`).
- No escaneado: rutas privadas.
- Mediciones: 856 `var(--…)`, 65 hex hardcodeados en `.tsx`, 61 líneas `uppercase tracking-`, 104 `transition`, 56 `transition-all`, 0 `prefers-reduced-motion`, radios `rounded-xl`≈86 / `rounded-2xl`≈47 / `rounded-full`≈32 / `rounded-lg`≈25, 18 `aria-label`, 0 `aria-live`.

## Tokens que se conservan

Claro: `--bg-base #f8fafc`, `--bg-surface #ffffff`, `--bg-surface-secondary #f1f5f9`, `--border-color #e2e8f0`, `--text-primary #0f172a`, `--text-secondary #64748b`, `--text-accent #1a4072`, `--bubble-me-bg #1a4072`. Oscuro: `--bg-base #0d1117`, `--bg-surface #1c2128`, `--border-color #30363d`, `--text-primary #e6edf3`, `--text-secondary #8b949e`, `--text-accent #58a6ff`, `--bubble-me-bg #1f4788`. Fuentes: Poppins (títulos) e Inter (cuerpo), pesos reales 400-700.

Se añaden: `--btn-primary-bg/-fg/-disabled-bg`, un único rojo de peligro, `--radius-sm: 8px`, `--radius-lg: 16px`, un tono de señal (ámbar) para aviso oficial, `--text-on-accent` con contraste suficiente en oscuro.

## Fortalezas a preservar

1. Sistema de tokens CSS con modo oscuro completo (`globals.css:36-105`).
2. Login (`app/(auth)/login/page.tsx`): errores diferenciados, activación en dos pasos, un CTA.
3. `components/admin/AdminConfirmDialog.tsx`: `role="dialog"`, `aria-modal`, Esc, scroll lock, motivo obligatorio, estado de carga. Es la base del diálogo compartido.
4. `UserHoverCard`: "Ver perfil" y "Enviar mensaje" bien separados.
5. Barra de progreso de encuestas en `PostCard`.
