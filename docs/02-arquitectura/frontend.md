# Arquitectura del frontend

## Tecnología y organización

`apps/web` usa Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Zustand y Supabase JS. El estado de autenticación se persiste en `localStorage` mediante `stores/auth.store.ts`.

## Rutas

| Ruta | Responsabilidad | Estado |
|---|---|---|
| `/` | Redirección inicial | Implementada |
| `/login` | Verificación, activación e inicio de sesión | Implementada parcialmente |
| `/select-event` | Selección de membresía/evento | Implementada |
| `/feed` y `/feed/[muro]` | Navegación y feed del muro | Implementada parcialmente |
| `/profile` | Perfil propio | Implementada parcialmente |
| `/profile/[membershipId]` | Perfil público | Implementada |
| `/chat` | Conversaciones y participantes | Implementada parcialmente |
| `/chat/[id]` | Mensajes de una conversación | Implementada parcialmente |
| `/admin` | Entrada del panel | Base implementada |
| `/admin/events` | Listado paginado | Implementada |
| `/admin/events/new` | Crear evento | Conectada |
| `/admin/events/[eventId]` | Detalle y configuración | Implementada |
| `/admin/events/[eventId]/committees` | Listar comités | Implementada |
| `/admin/events/[eventId]/committees/new` | Crear comité | Conectada |
| `/admin/events/[eventId]/committees/[committeeId]/edit` | Editar comité | Implementada |
| `/admin/events/[eventId]/participants` | Listado paginado con búsqueda (`q`) y filtros por comité, rol y estado; alias, código # y acciones por fila | Implementada |
| `/admin/events/[eventId]/participants/new` | Alta individual de participante con alias y credenciales iniciales de una sola vez | Implementada |
| `/admin/events/[eventId]/participants/import` | Importación CSV con plantilla, preview, confirmación por lotes y descarga de credenciales | Implementada |
| `/admin/events/[eventId]/participants/[membershipId]` | Detalle, edición, cambio de comité y ciclo de vida de la cuenta | Implementada |
| `/admin/assignments`, `/admin/moderation` | Marcadores de secciones futuras | Implementadas como marcador |

El panel carece de pantalla de importación CSV y de borrado de comités. El inventario de operaciones con y sin interfaz está en la [referencia de API](../03-referencia/api.md).

## Capas

- `app/`: páginas, layouts y redirecciones.
- `components/`: interfaz de feed, chat, perfiles, navegación y elementos admin.
- `lib/api/`: contratos manuales y llamadas HTTP.
- `stores/auth.store.ts`: sesión, membresías y selección activa.
- `types/`: modelos exclusivos del cliente.

## Sesión y selección de evento

El store conserva token, usuario, membresías y IDs activos. Cerrar sesión limpia el estado local y deja activa la sesión en Supabase. Los layouts redirigen según hidratación, token y membresía. Al elegir un evento, una membresía administrativa entra a `/admin` y una de participante o moderador a `/feed`; el moderador llega al panel por el enlace «Moderación» del sidebar. Con una única membresía no administrativa, login puede dirigir directamente al feed. El cliente común limpia la sesión al recibir un 401.

La pantalla de moderación usa `ModerationPostCard` en lugar de `PostCard` porque este último está atado a la API del feed (votación, borrado propio, comentarios sin texto de borrados). Comparte con él `Card`, `PersonLabel`, `Button` y `formatDateTime`.

El panel admin reutiliza la estética del sitio participante: sidebar fija en escritorio y drawer con barra superior en móvil, con cierre de sesión y cambio de tema accesibles.

Las reacciones se consultan mediante la API cada 10 segundos mientras el muro está visible, y al volver a la pestaña; esto incluye las retiradas sin exponer la tabla al navegador.

## Realtime

Feed, comentarios y chat se suscriben a cambios para volver a consultar la API. Feed y comentarios invocan `realtime.setAuth(token)` antes de suscribirse; chat lo hace igual en su propia vista. Al unirse por primera vez el canal no relee; al reconectarse (`SUBSCRIBED` posterior) sí vuelve a consultar la API. Al cambiar de evento o muro, el feed descarta las publicaciones anteriores. Los votos de encuesta (`poll_votes`) no tienen `wall_id`, por lo que el feed abre un filtro `poll_id=eq.<id>` por cada encuesta cargada en el muro; la lista se recalcula cuando cambian las encuestas visibles. Las eliminaciones de votos no llegan con ese filtro salvo que la réplica de la tabla incluya la columna, y el flujo actual de la API no las emite salvo en limpieza de datos heredados. El alcance efectivo de las suscripciones queda por comprobar en un entorno aislado.

## Hallazgos

- Filtros, búsqueda y orden del feed se ejecutan en cliente sobre el conjunto ya cargado.
- La carga de avatar admite JPEG, PNG o WebP en base64 hasta el límite aplicado por el backend.
