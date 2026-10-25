# Matriz de trazabilidad

Origen principal: los seis Markdown históricos migrados. “Comprobable” significa evidencia en el repositorio local, no producción.

| ID | Origen histórico / comportamiento esperado | Evidencia concreta | Comportamiento actual comprobable | Clasificación | Impacto / pregunta |
|---|---|---|---|---|---|
| REQ-01 | RF-40; ciclo y solo lectura | `admin.controller.ts`; páginas admin | Crea `ACTIVE`; lista/edición son marcadores; no cierra | Parcial / divergente | Falta borrador, transición y cierre |
| REQ-02 | RF-42; comités y muros | admin/events controllers | Crea/lista comité; no se demuestra invariante de un muro por comité | Parcial | Verificar automatismo/constraints |
| REQ-03 | RF-41; aislamiento total | controladores/servicios; `requireAdmin` | Muchos flujos validan evento; admin es global; RLS ausente | Parcial / divergente | Riesgo de cruce entre eventos |
| REQ-04 | RF-43/44; rol por evento y contexto | auth context/store; RBAC | Selección multi-evento; cambios de rol ausentes; admin global | Parcial / divergente | Definir Admin técnico/global |
| REQ-05 | RF-01/02.3/23; habilitación con código/temporal | `POST /admin/memberships`, `/create-account` | Altas API sin UI; inmutabilidad, unicidad y auditoría no garantizadas | Parcial | Falta gestión/transacción/schema |
| REQ-06 | RF-02.5; activación y cambio temporal | auth controller/login UI | Activación existe y restringe pendientes | Parcial | Uso único/auditoría dependen de datos |
| REQ-07 | RF-02/03; sesión activa, intentos y revocación | auth controller/store/loggers | Login/contexto; log best-effort; logout solo local | Parcial / divergente | Revocar token y garantizar intentos |
| REQ-08 | RF-04/06/07; bloqueo, suspensión y rehabilitación | Solo estados activos filtrados | No hay umbral ni gestión de estados | Documentado, no implementado | Definir efectos en sesiones |
| REQ-09 | RF-05/06/07; recuperación segura | Sin ruta/UI | No existe | Documentado, no implementado | Método de identidad abierto |
| REQ-10 | RF-08–10; perfil y campos institucionales | profiles controller/pages | Perfil propio/público y admin; auditoría no garantizada | Parcial | Campos/Storage/RLS por verificar |
| REQ-11 | RF-11/23–27; muros autorizados | events/posts/walls | Muros/feed y banderas; evento cerrado ignorado | Parcial | RLS/ocultamiento por verificar |
| REQ-12 | RF-12/25–27; texto/enlace/tags/anuncios | posts/UI | Texto/encuesta; tags solo leídos; anuncios restringidos | Parcial | UI filtra autor, no tag |
| REQ-13 | RF-14/28; retiro/ocultación | delete post | Autor/admin marca borrado; campo de borrador inconsistente | Parcial / divergente | Sin motivo/ocultación diferenciada |
| REQ-14 | RF-15; comentarios un nivel | comments service/controller | Un nivel y eliminación; anuncio admin | Parcial | Auditoría no garantizada |
| REQ-15 | RF-12.1; encuesta/voto/cierre | posts controller/service | 2–10, reemplazo y cierre | Parcial | Unicidad/transacción/auditoría inciertas |
| REQ-16 | RF-47–51; adjunto de post | Sin contrato/UI | No existe | Documentado, no implementado | Definir Storage y retención |
| REQ-17 | RF-17/21; DM 1:1 reutilizable | dm routes/services/pages | Mismo evento, conversaciones/historial/realtime | Parcial | Sin paginación ni unicidad demostrada |
| REQ-18 | RF-18–20; mensaje y borrado | dm controller/service | Texto y borrado por autor con enum configurable | Parcial | Enlaces no validados; auditoría incierta |
| REQ-19 | RF-22/RN-35–37; supervisión fail-closed | Sin ruta/UI | No existe | Documentado, no implementado | Roles, privacidad y retención abiertos |
| REQ-20 | RF-28; reportes/estados/deduplicación | Sin ruta/UI/tablas usadas | No existe; plan nuevo lo posterga | Documentado, no implementado | ¿Requisito vigente y fecha? |
| REQ-21 | RF-28–30; moderación/sanción | delete post/comment; perfil admin | Retiro parcial; sin reportes, incidentes o sanciones | Parcialmente implementado | Falta motivo/flujo/auditoría |
| REQ-22 | RF-36/37; avisos internos persistentes | Realtime cliente | Realtime refresca; no existe entidad/historial/contador | Documentado, no implementado | Plan nuevo lo posterga |
| REQ-23 | RF-38; CSV validado/confirmado | Solo roadmap/contexto | No existe | Documentado, no implementado | Formato y atomicidad pendientes |
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
| Base de panel admin | `app/(admin)`, `lib/api/admin.ts` | Plan reciente / parcial |
| Iconos desde CDN | componentes admin | Implementado, no documentado |

## Funcionalidades propuestas o postergadas

El roadmap reciente propone participantes/CSV, asignaciones, archivos, moderación, fijado de posts, supervisión/bloqueo de conversación y endurecimiento técnico. Son **propuestas**, salvo la base admin ya comprobada. Reportes y notificaciones históricas figuran “fuera del alcance ahora”; no hay evidencia de descontinuación formal.
