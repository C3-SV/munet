# Plan de implementación para calidad e integración web

> **Para agentes:** usar superpowers:executing-plans o superpowers:subagent-driven-development tras revisar el plan. Cada casilla describe trabajo futuro.

**Objetivo** · Obtener evidencia reproducible de acceso, sesión, Realtime y avatares, y preparar la protección y capacidad necesarias antes del piloto.

**Arquitectura** · La API comprueba la membresía activa en su evento y el acceso al recurso en cada solicitud. Las políticas de QA deben sostener la misma frontera en Realtime y Storage. La observabilidad registra acciones y fallos según el contrato aprobado.

**Tecnología** · Express, TypeScript, Supabase, clientes Realtime y Node Test Runner.

**Especificación** · [Alcance web](README.md), [verificación del repositorio](../pruebas-y-validacion.md), [RN-06/20/21](../../01-producto/reglas-de-negocio.md) y [base de datos](../../02-arquitectura/base-de-datos.md).

## Restricciones

- Q01 y Q02 antes de habilitar usuarios reales. Q03 antes del evento y, para adjuntos, antes de liberar W05.
- Las verificaciones de infraestructura y carga usan un proyecto de QA dedicado, previa autorización de su responsable. Los comandos de prueba local usan sustitutos o funciones aisladas.
- El equipo web es responsable de evidencia e integración participante. API, admin e infraestructura son responsables de sus contratos, fixtures y configuración. Toda corrección en rutas o servicios compartidos necesita coordinación con su propietario.

## Entorno y registro de evidencia

El escenario inicial usa dos eventos sintéticos independientes y dos comités en el primero. A y B son delegados activos en el primer evento, cada uno en su comité. C pertenece solo al segundo evento. T es un tercer delegado en el primer evento sin participación en el DM de A y B. P tiene una cuenta pendiente para ensayar activación. El equipo admin aporta una membresía autorizada de QA para anuncios y para cambiar/suspender a A. General/avisos, muros de comité y avatares/DM de prueba quedan identificados por un prefijo acordado.

Registrar por caso el ID, SHA, fecha, entorno, rol y evento de la fixture, pasos o comando, resultado esperado, resultado observado y enlace a evidencia saneada. Usar estados **pasa**, **falla**, **bloqueado** y **sin ejecutar**. Registrar por separado el resultado en UI, API, suscripción Realtime y Storage cuando aplique.

## Evidencia de la etapa documental

El 18 de noviembre de 2026, sobre el código de `56582dc`, `node --test apps/web/lib/api/base-url.test.mjs` pasó 2 pruebas y `npm test -w api` pasó 110 con dependencias fijadas en el lockfile, cargadas desde caché en un directorio temporal. Las cifras corresponden a pruebas existentes. Los recorridos de navegador, los builds y las pruebas de Supabase QA descritas en este plan quedan por ejecutar.

## Casos prioritarios de revisión

| Caso | Cobertura |
| --- | --- |
| Membresía suspendida con vista y suscripción abiertas | Q01 |
| Cambio de comité y lectura desde UI que conserva datos del muro anterior | Q01 |
| Dos participantes legítimos comparten red y los pasos de activación usan endpoints distintos | Q02 |
| Base incompleta o política QA distinta de lo documentado | Q03 |
| Vista de lectura con resultado vacío y suscripción deshabilitada | Q03 |

## Q01 · Acceso por evento y membresía

**Rutas y archivos** · `apps/api/src/middleware/auth.middleware.ts`, `services/auth-context.service.ts`, `utils/rbac.utils.ts`, `utils/walls.utils.ts`, controladores de eventos/posts/perfiles/DM y `apps/web/stores/auth.store.ts`. Coordinar con D03–D05. Mantener el criterio de menor acceso de RN-21.

- [ ] Ejecutar primero `npm test -w api` y `npm run check-types -w api`. Revisar estáticamente los consumidores de `apps/web/lib/supabase.ts` y la configuración cliente para confirmar que las operaciones de datos pasan por API, con la excepción Realtime (S1-19).
- [ ] Con las fixtures de QA, comprobar acceso ordinario propio y denegación fuera de evento, comité y conversación. Validar escritura en avisos desde los roles correctos. Con la misma sesión de A abierta, solicitar al responsable el cambio de comité y luego la suspensión de QA. En cada cambio, verificar próxima solicitud API, estado de datos visibles, acciones y recepción de notificaciones. Tras la suspensión, probar también el resultado al actualizar contexto o intentar entrar.
- [ ] En una publicación y un comentario de QA, comprobar el retiro por el actor autorizado y solicitar al responsable evidencia saneada del UUID de membresía registrado (S1-18). Si admin entrega el fijado de anuncios A05, comprobar en participante el orden al fijar y desfijar; el contrato y la mutación son de admin.
- [ ] Registrar resultados de API, RLS y Realtime individualmente. Si la UI conserva acceso aparente o datos anteriores, reproducir con sustitutos el cambio de contexto y corregir refresco o limpieza. Si la API o RLS entrega datos fuera de ámbito, coordinar la corrección con su dueño y bloquear el piloto hasta repetir satisfactoriamente el caso.
- [ ] Actualizar pruebas, discrepancias y REQ-03/07/08/11 según evidencia. Cerrar con `test(web): comprobar aislamiento y revocación de acceso` si se agregaron pruebas o `docs(web): registrar alcance y revocación en QA` si solo hay evidencia.

## Q02 · Límites de uso y auditoría esencial

**Dependencias** · API/admin aprueban las rutas a cubrir, umbral, ventana, identidad del límite, respuesta, entorno con proxies y política de auditoría. **Rutas y archivos** · `apps/api/src/routes/auth.routes.ts`, `controllers/auth.controller.ts`, `utils/auth.logger.ts` y `utils/audit.logger.ts`. Cualquier cambio de middleware se implementa en API. Las rutas de admin se coordinan con su equipo.

- [ ] Inventariar, mediante inspección estática, login, activación, consultas previas y acciones críticas. Contrastar qué éxito, fallo o denegación se audita y si el tratamiento de fallos es best effort. Revisar que web y API eviten contraseñas, tokens, payloads sensibles y claves en logs. Registrar brechas y su ruta responsable (S1-05/06, S3-09/10).
- [ ] Con API, fijar el contrato 429 y política de reintento, la persistencia del límite si corre en varios procesos y los campos de auditoría (actor, evento, objetivo, hora y motivo según la acción). Acordar comportamiento frente a indisponibilidad de auditoría antes de cambiar el resultado de cualquier escritura. El umbral de producto de bloqueo permanente y la recuperación son decisiones propias.
- [ ] Añadir pruebas controladas del umbral con reloj simulado, recuperación de la ventana, dos actores legítimos tras la misma red, fallo del registro y ausencia de secretos. Definir el mensaje web solo si cambia el contrato del usuario. Ejecutar pruebas/tipos API y tipos web si corresponde.
- [ ] Actualizar autenticación, API y REQ-07/08/24 si cambia su evidencia. Cerrar por separado los controles y la evidencia, por ejemplo `feat(api): aplicar límite acordado al acceso participante` y `test(api): verificar auditoría de acciones críticas`.

## Q03 · Inventario, RLS, Storage y capacidad

**Dependencias** · Infraestructura identifica el proyecto QA y el inventario saneado. B12 fija la meta de carga. **Rutas y archivos** · `supabase/schema.sql`, `supabase/migrations/001_alias_codigo_fijados_archivos.sql`, `supabase/migrations/002_codigo_delegacion.sql`, `docs/02-arquitectura/base-de-datos.md`, `apps/web/lib/supabase.ts` y `apps/api/src/controllers/profiles.controller.ts`. La 001 se anotó como aplicada históricamente y la 002 como pendiente. El snapshot carece de una base completa y reproducible.

- [ ] Comparar los archivos versionados con el inventario proporcionado de tablas, versiones, RLS, publicación Realtime y buckets de QA. Registrar qué requiere intervención de infraestructura. Alinear el mínimo de Node documentado con el del lockfile y la configuración efectiva de QA antes de proponer un cambio de `engines` (S1-07).
- [ ] Con una base desechable y autorización expresa del responsable, verificar que el esquema base y 001→002 pueden probarse en orden, que los resultados son reproducibles y que los códigos `#` resultantes son estables. Confirmar de forma independiente las políticas para comités, conversaciones, cambios de sesión y avatares. Comprobar una vista válida cuando Realtime esté deshabilitado. Si se aprueba W05, validar también permisos del bucket privado y retiro de enlaces con sus fixtures.
- [ ] Antes de la carga, definir con B12 la cifra concurrente, duración, mezcla de lecturas/escrituras y suscripciones, y umbrales por latencia, errores y refresco. Usar un destino QA aislado, con parada acordada al superar los límites. Incluir el directorio W02 si ya existe, con consulta y filtros representativos. Registrar versión, parámetros y resultados observados.
- [ ] Actualizar [base de datos](../../02-arquitectura/base-de-datos.md) y [validación](../pruebas-y-validacion.md) con evidencia y limitaciones. Cerrar con `docs(web): registrar verificación de infraestructura y capacidad de QA`. Toda intervención operativa se acuerda con el responsable del entorno.
