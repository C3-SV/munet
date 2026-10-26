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
| `/admin/participants`, `/admin/assignments`, `/admin/moderation` | Marcadores de secciones futuras | Implementadas como marcador |

## Capas

- `app/`: páginas, layouts y redirecciones.
- `components/`: interfaz de feed, chat, perfiles, navegación y elementos admin.
- `lib/api/`: contratos manuales y llamadas HTTP.
- `stores/auth.store.ts`: sesión, membresías y selección activa.
- `types/`: modelos exclusivos del cliente.

## Sesión y selección de evento

El store conserva token, usuario, membresías y IDs activos. Cerrar sesión limpia estado local; no revoca la sesión en Supabase. Los layouts redirigen según hidratación, token y membresía. Al elegir un evento, una membresía administrativa entra a `/admin` y una de participante a `/feed`. Estas comprobaciones mejoran la navegación, pero no sustituyen autorización del servidor.

El panel admin reutiliza la estética del sitio participante: sidebar fija en escritorio y drawer con barra superior en móvil, con cierre de sesión y cambio de tema accesibles.

## Realtime

Feed, comentarios y chat se suscriben a cambios para volver a consultar la API. Chat invoca `realtime.setAuth(token)`; otros flujos no lo hacen explícitamente. Sin políticas RLS versionadas no se puede afirmar que las suscripciones sean seguras u operativas en todos los entornos.

## Hallazgos

- Filtros, búsqueda y orden del feed se ejecutan en cliente sobre el conjunto ya cargado.
- Los iconos administrativos dependen de jsDelivr/Tabler en tiempo de ejecución.
- La carga de avatar admite JPEG, PNG o WebP en base64 hasta el límite aplicado por el backend.
