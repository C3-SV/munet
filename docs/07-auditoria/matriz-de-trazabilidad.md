# Matriz de trazabilidad

Origen principal: los seis Markdown históricos migrados. “Comprobable” significa evidencia en el repositorio local, no producción.

| ID | Origen histórico / comportamiento esperado | Evidencia concreta | Comportamiento actual comprobable | Clasificación | Impacto / pregunta |
|---|---|---|---|---|---|
| REQ-01 | RF-40; ciclo y solo lectura | `admin.controller.ts`; panel de eventos | Crea `ACTIVE` y permite cambiar estado. Cierre sin guarda general de escritura. | Parcial | Verificar alta, añadir borrador y aplicar solo lectura. |
| REQ-02 | RF-42; comités y muros | `admin.controller.ts`; migración 001 | Alta de comité con muro. El alta de evento no inserta general/anuncios. | Parcial | Comprobar aprovisionamiento de muros iniciales. |
| REQ-03 | RF-41; aislamiento total | `requireEventAdmin`; controladores; servicios | Rutas admin acotadas al objetivo. El listado filtra por membresía. | Parcial / no verificado | Verificar aislamiento completo con dos eventos y Realtime. |
| REQ-04 | RF-43/44; rol por evento y contexto | Store de sesión; middleware; ficha de participante | Selección de evento y edición de rol por membresía. | Parcial | Alinear catálogo y controles de UI con el enum. |
| REQ-05 | RF-01/02.3/23; habilitación con código/temporal | `/admin/create-account`; servicio de alta; formulario web | Alta individual con contraseña generada. El comité es opcional y el código queda fuera de la edición. | Parcial | Resolver colisiones de ingreso y verificar alta completa. |
| REQ-06 | RF-02.5; activación y cambio temporal | `auth.controller.ts`; login web | Activa pendientes con contraseña inicial y limpia el hash tras activar. | Parcial / no verificado | Probar reintentos y persistencia con Auth aislado. |
| REQ-07 | RF-02/03; sesión activa, intentos y revocación | auth controller/store/loggers | Login/contexto; log best-effort; logout solo local | Parcial / divergente | Revocar token y garantizar intentos |
| REQ-08 | RF-04/06/07; bloqueo, suspensión y rehabilitación | Ficha; `suspendParticipant` y `reactivateParticipant` | Suspensión/reactivación con motivo. Sin umbral de fallos. | Parcial | Validar sesiones abiertas y reactivación de cuentas pendientes. |
| REQ-09 | RF-05/06/07; recuperación segura | `resetParticipantPassword`; ficha de participante | Hay restablecimiento asistido. Falta recuperación autónoma con verificación. | Parcial | Acordar el alcance de recuperación y validar el restablecimiento. |
| REQ-10 | RF-08–10; perfil y campos institucionales | Controlador y páginas de perfil; migración 001 | Perfil propio/público, alias, avatar y gestión administrativa. | Parcial | Verificar Storage y permisos efectivos. |
| REQ-11 | RF-11/23–27; muros autorizados | events/posts/walls | Muros/feed y banderas; evento cerrado ignorado | Parcial | RLS/ocultamiento por verificar |
| REQ-12 | RF-12/25–27; texto/enlace/tags/anuncios | posts/UI | Texto/encuesta; tags solo leídos; anuncios restringidos | Parcial | UI filtra autor, no tag |
| REQ-13 | RF-14/28; retiro/ocultación | `deletePostService`; migración 001 | El borrado lógico registra categoría y UUID. Puede quedar un marcador. | Parcial / divergente | Faltan ocultación diferenciada y motivo. |
| REQ-14 | RF-15; comentarios con respuestas encadenadas | comments service/controller | Respuestas encadenadas y eliminación; anuncios para administración y moderación | Parcial | Auditoría no garantizada |
| REQ-15 | RF-12.1; encuesta/voto/cierre | posts controller/service | 2–10, reemplazo y cierre | Parcial | Unicidad/transacción/auditoría inciertas |
| REQ-16 | RF-47–51; adjunto de post | Migración 001 | Tabla `attachments` existe en la base (0 filas). Interfaz en `PostEditor`/`PostCard` y validación en `lib/attachments.ts` (con pruebas); sin API ni bucket privado. | Parcial | Contrato de API, bucket privado, carga, lectura y retiro. |
| REQ-17 | RF-17/21; DM 1:1 reutilizable | dm routes/services/pages | Mismo evento, conversaciones/historial/realtime | Parcial | Sin paginación ni unicidad demostrada |
| REQ-18 | RF-18–20; mensaje y borrado | Controlador y servicios DM | Texto y borrado del autor con estado `DELETED`. | Parcial | Verificar persistencia, entrega y auditoría. |
| REQ-19 | RF-22/RN-35–37; supervisión fail-closed | Sin ruta/UI | No existe | Documentado, no implementado | Roles, privacidad y retención abiertos |
| REQ-20 | RF-28; reportes/estados/deduplicación | Sin ruta/UI/tablas usadas | No existe; plan nuevo lo posterga | Documentado, no implementado | ¿Requisito vigente y fecha? |
| REQ-21 | RF-28–30; moderación/sanción | Pantalla `/admin/events/:id/moderation` (muros, pestañas, fijar/desfijar, eliminar con motivo); ficha y listado de participantes (`PATCH …/role`) | Moderación operativa para admin y `MODERATOR`, con motivo, auditoría y rate limit. Sin reportes, incidentes o expulsión. | Parcial | Marca «Fijado» en feed (Fiore), prueba `rbac` por alinear (Christian), borrado desde el feed del moderador. |
| REQ-22 | RF-36/37; avisos internos persistentes | Realtime cliente | Realtime refresca; no existe entidad/historial/contador | Documentado, no implementado | Plan nuevo lo posterga |
| REQ-23 | RF-38; CSV validado/confirmado | `admin-participants.controller.ts`; utilidades CSV | API de preview y confirmación por lote, credenciales y fallos por fila. Auditoría best-effort. | Parcial | Conectar UI y verificar persistencia y resultados parciales. |
| REQ-24 | RF-34/RN-52–53; auditoría y consulta | audit/auth loggers | Escritura best-effort; sin consulta | Parcial / divergente | No garantiza evidencia ni denegaciones |

## Reglas y criterios

- RN-01–RN-21 están preservadas con estado individual en [reglas de negocio](../01-producto/reglas-de-negocio.md).
- CA-01–CA-24 se preservaron en [criterios de aceptación](../01-producto/criterios-de-aceptacion.md). No hay evidencia de que esa suite histórica se haya ejecutado.
- NFR-01–NFR-10 están preservados con sus cifras y contradicciones en [requerimientos](../01-producto/requerimientos.md).

## Implementado sin documentación histórica suficiente

| Capacidad | Evidencia | Clasificación |
|---|---|---|
| Tema claro/oscuro | `theme-context.tsx` | Implementado, no documentado |
| Avatar WebP | profiles controller | Implementado, no documentado |
| Búsqueda/orden/filtro local | `FeedFilters.tsx` | Implementado, no documentado |
| Panel admin | `app/(admin)`, `lib/api/admin.ts` | Parcial |
| Iconos desde CDN | componentes admin | Implementado |
| Identificador de delegación | Migraciones 001/002, alta API y perfiles web | No verificado con Supabase |
| Cambio de comité | Ficha web, PATCH general y endpoint dedicado | Parcial. Flujo individual con pantalla general pendiente. |

## Funcionalidades propuestas o postergadas

El alta individual, el cambio de comité, la API de CSV y la pantalla de moderación del Sprint 3 tienen evidencia en código y en pruebas contra la API local. La interfaz CSV, el panel general de asignaciones, los adjuntos y la marca «Fijado» en el feed siguen pendientes. Reportes y notificaciones permanecen postergados en los planes. Consulta [pendientes](../PENDIENTES.md).
