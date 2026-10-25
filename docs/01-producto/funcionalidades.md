# Funcionalidades y estado

La clasificación refleja el código local revisado el 2026-10-23. “Implementado” no significa verificado en producción.

| Área | Problema que resuelve | Implementación actual | Estado |
|---|---|---|---|
| Activación y acceso | Incorporar cuentas precreadas y abrir sesión | API de búsqueda por código, activación, login y contexto; interfaz de login | Parcialmente implementado |
| Multi-evento | Separar participaciones y elegir contexto | Membresías activas en sesión y selector de evento | Parcialmente implementado |
| Eventos | Crear y administrar eventos | POST administrativo e interfaz de creación; crea en estado `ACTIVE`; lista y edición son marcadores | Parcialmente implementado y divergente |
| Comités | Organizar participantes y muros temáticos | Listado por evento, alta administrativa e interfaz de listado/creación | Parcialmente implementado |
| Muros | Comunicación general, anuncios y comités | Lectura de muros y feed; acceso calculado por tipo y membresía | Parcialmente implementado |
| Publicaciones | Publicar texto y encuestas | Alta, listado y eliminación; encuestas de 2–10 opciones | Parcialmente implementado |
| Comentarios | Conversación bajo publicaciones | Alta, listado y eliminación; una profundidad | Parcialmente implementado |
| Encuestas | Votar y cerrar consultas | Voto reemplazable y cierre por autor | Parcialmente implementado |
| Perfiles | Identidad pública en el evento | Consulta/edición propia y administrativa; avatar público | Parcialmente implementado |
| Mensajes directos | Comunicación uno a uno | Conversaciones, participantes, mensajes y borrado lógico | Parcialmente implementado |
| Panel administrativo | Punto de entrada operacional | Layout, dashboard de navegación y flujos de eventos/comités | Base parcial |
| Cuentas y membresías administrativas | Altas operativas | Endpoints POST sin interfaz administrativa actual | Parcialmente implementado |
| Moderación | Retirar contenido y sancionar | Administradores pueden eliminar posts/comentarios y editar perfiles; sin reportes/sanciones | Parcialmente implementado |
| Auditoría | Trazabilidad de acciones | Inserciones best-effort en `audit_logs` y `auth_attempts`; sin consulta ni garantía | Parcialmente implementado |
| Notificaciones | Avisar actividad relevante | No existe módulo; Realtime solo refresca vistas | Documentado, no implementado |
| Reportes | Escalar contenido problemático | Sin rutas, UI ni tablas usadas por el código | Documentado, no implementado |
| CSV | Carga/descarga masiva | Solo aparece en requisitos y roadmap | Documentado, no implementado |

## Panel administrativo nuevo

Rutas presentes:

- `/admin`: tarjetas de navegación; no presenta métricas.
- `/admin/events`: marcador porque no existe `GET /admin/events`.
- `/admin/events/new`: formulario conectado a `POST /admin/events`.
- `/admin/events/[eventId]`: marcador de detalle/edición.
- `/admin/events/[eventId]/committees`: listado conectado a `GET /events/:eventId/committees`.
- `/admin/events/[eventId]/committees/new`: formulario conectado a `POST /admin/committees`.

El menú también enlaza `/admin/participants`, `/admin/assignments` y `/admin/moderation`, pero esas páginas no existen. El layout exige que la **membresía activa** sea administrativa; la API acepta que exista **cualquier membresía activa** administrativa. Esa diferencia se registra como [D-01](../07-auditoria/discrepancias.md#d-01-autorización-administrativa-no-acotada-al-evento).

## Límites operativos relevantes

- Los listados de feed y chat no implementan paginación robusta.
- Varias mutaciones de múltiples tablas no son transaccionales.
- No hay archivos adjuntos en publicaciones ni chat, pese al alcance histórico para publicaciones.
- Las suscripciones Realtime refrescan datos; no constituyen un sistema de notificaciones.
- El estado del evento no impide escrituras en los controladores revisados.

Los detalles por endpoint están en [referencia de API](../03-referencia/api.md).
