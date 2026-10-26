# Flujos funcionales

## Activación e ingreso

1. La persona introduce su código.
2. La web consulta cuentas pendientes por código.
3. Selecciona evento cuando corresponde y activa o inicia sesión.
4. La API devuelve token/contexto con membresías activas.
5. Si hay más de una, la persona selecciona evento; el store conserva la membresía activa.

Limitaciones: no hay recuperación de contraseña; el login registra datos sensibles en consola del navegador; producción no fue probada.

## Lectura y publicación en un muro

1. La ruta `/feed/[muro]` obtiene metadatos y publicaciones por `lib/api`.
2. `GET /posts?muro=...` resuelve muro, evento y membresía.
3. El servicio comprueba acceso y devuelve posts visibles.
4. Para publicar, `POST /posts` valida capacidad; si es encuesta crea post, poll y opciones secuencialmente.
5. Realtime dispara una recarga de la API.

Limitaciones: sin paginación, sin adjuntos, transacción no garantizada y autorización Realtime no verificable.

## Comentarios y encuestas

Los comentarios aceptan un padre, pero no nietos. En anuncios solo administración comenta. Un voto nuevo elimina/reemplaza el anterior mediante varias operaciones; el autor puede cerrar su encuesta. No hay reapertura.

## Perfil

El evento activo viaja en `x-event-id`. El usuario edita nombre/bio/ruta de imagen o sube un avatar base64. Administración puede editar perfiles ajenos con restricciones. Storage se configura como público; no se verificaron sus políticas.

## Mensaje directo

```mermaid
flowchart LR
  L[Buscar participante] --> C[Crear o reutilizar conversación]
  C --> M[Listar/enviar mensajes]
  M --> R[Evento Realtime]
  R --> M
  M --> D[Borrado lógico por autor]
```

Ambas membresías deben estar activas y pertenecer al mismo evento. No existen grupos, adjuntos, bloqueo ni supervisión.

## Crear evento desde el panel

1. El layout exige que la membresía seleccionada parezca administrativa.
2. `/admin/events/new` valida nombre, slug y fechas en cliente.
3. `POST /admin/events` exige token y cualquier membresía administrativa activa.
4. El controlador crea el evento directamente `ACTIVE` y sus datos auxiliares según el código.
5. La UI abre la configuración del evento creado y el listado lo muestra mediante `GET /admin/events`.

## Crear/listar/editar comités desde el panel

El formulario envía `event_id`, nombre, código, descripción y orden a `POST /admin/committees`. El listado usa `GET /admin/committees?event_id=`, que exige rol admin pero no membresía en ese evento; así el alta y la lectura comparten alcance. La edición usa `GET/PATCH /admin/committees/:committeeId`.

## Configurar evento y editar comité

1. `/admin/events` lista los eventos con `GET /admin/events` y paginación.
2. `/admin/events/:eventId` carga el evento y guarda `name`, `slug`, descripción, fechas y `status` con `PATCH /admin/events/:eventId`.
3. `/admin/events/:eventId/committees/:committeeId/edit` carga el comité, valida que pertenezca al evento y guarda nombre, código, descripción y orden con `PATCH /admin/committees/:committeeId`.

## Flujos no existentes

No hay recorridos completos para edición/cierre de evento, administración visual de participantes/asignaciones, importación CSV, reportes, sanciones, notificaciones, auditoría consultable o supervisión de DM.
