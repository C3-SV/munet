# Reglas de negocio

Esta es la fuente principal de reglas. Conserva los identificadores históricos y separa **regla esperada** de **estado actual**. El código no reemplaza una regla aprobada.

## Identidad, evento y membresía

| ID | Regla esperada | Estado actual comprobable |
|---|---|---|
| RN-01 | No hay alta pública. Personal autorizado asigna evento, rol y, al participante, exactamente un comité del evento. | No hay registro público; existen altas API. La obligatoriedad/unicidad del comité no se puede probar sin esquema. |
| RN-02 | Una membresía participante corresponde a un evento; organizador/Admin MUN pueden tener varias; el Admin técnico tiene ámbito global. Toda acción usa el evento autorizado seleccionado. | Multi-evento existe. El código no distingue formalmente Admin MUN/técnico y `requireAdmin` actúa globalmente para cualquier rol coincidente. Divergente. |
| RN-03 | `participant_code` es único por `(event_id, participant_code)`, inmutable, no reasignable y su alta/importación se audita. No hay patrón obligatorio aprobado. | Se usa para activación/login; constraint, inmutabilidad y auditoría garantizada no son verificables. |
| RN-04 | La contraseña temporal es de un uso. Solo una cuenta `ACTIVA` opera. Inicio fallido/correcto, activación, cierre y cambio de estado se registran. | Activación/login y log best-effort existen; logout es local y no hay garantía de auditoría. |
| RN-05 | Umbral configurable de fallos produce `BLOQUEADA_SEGURIDAD`. Recuperación/desbloqueo puede reactivar ese estado; `SUSPENDIDA` exige rehabilitación y `EXPULSADA` no revive automáticamente. | No implementado. |
| RN-06 | Cambiar comité, rol, delegación, estado o permisos requiere autoridad del evento y auditoría. Al perder acceso, sesiones previas pierden lectura/escritura. | Administración de esos cambios y revocación inmediata no están implementadas de extremo a extremo. |

## Estados y transiciones

### Evento

`BORRADOR → ACTIVO → CERRADO`. En borrador solo se configura; activo opera; cerrado permite consulta autorizada sin crear, editar, votar, enviar DM ni moderar. No se definió reapertura ni un estado separado para “desactivar”.

**Actual:** el alta crea `ACTIVE`, no hay transición/cierre y los controladores no imponen solo lectura.

### Cuenta de membresía

`PENDIENTE_ACTIVACION → ACTIVA`; desde activa puede pasar a `BLOQUEADA_SEGURIDAD`, `SUSPENDIDA` o `EXPULSADA`. Solo bloqueo de seguridad tiene reactivación posible por recuperación; suspensión necesita rehabilitación administrativa. Reversión de expulsión no está definida.

**Actual:** activación y filtrado de membresías activas existen; el resto del ciclo no está implementado completamente.

### Contenido, reportes y encuestas

- Contenido: vocabulario histórico `VISIBLE`, `OCULTO_MODERACION`, `ELIMINADO_AUTOR`, `ELIMINADO_ADMIN`; DM también propuso `VISIBLE|SOFT_DELETED`. Debe existir un mapeo aprobado.
- Reporte: `ABIERTO → EN_REVISION → RESUELTO` o `DESCARTADO`; cada transición conserva actor, hora y resolución.
- Encuesta: `ABIERTA → CERRADA`; no se define reapertura.

La eliminación es lógica, sin edición posterior, y desaparece de vistas ordinarias.

## Foro, adjuntos y encuestas

| ID | Regla esperada | Estado actual comprobable |
|---|---|---|
| RN-07 | Cada post pertenece a un muro del mismo evento. General/anuncios son visibles al evento; comité solo a su comité y autoridades autorizadas. | Implementado parcialmente; RLS no verificable y respuestas incluyen metadatos de muros no accesibles. |
| RN-08 | Etiquetar un comité en el muro general no vuelve privado el post; filtrar por etiqueta no es requisito. | Código puede leer tags, pero no se encontró alta; el filtro UI usa comité del autor, no tag. |
| RN-09 | Participante publica en general/su comité; solo coordinación autorizada publica anuncios. Comentar exige poder ver el post. | Implementado parcialmente en reglas de muro/controladores. |
| RN-10 | Respuestas a comentarios: máximo un nivel y mismo `post_id` que el padre. | Implementado. |
| RN-11 | Un post admite cero o un adjunto: JPG/PNG ≤5 MB o PDF ≤20 MB. Hereda visibilidad/evento y se valida en API/Storage. | Documentado, no implementado. WebP solo aplica a avatar, no a post. |
| RN-12 | Retirar adjunto impide servirlo a lectores; metadata/acción quedan auditables y no hay referencias activas huérfanas. | Documentado, no implementado. |
| RN-13 | Encuesta solo donde el autor puede publicar; máximo un voto por membresía, reemplazable mientras esté abierta. | Implementado parcialmente; unicidad y atomicidad no verificables. |

## Mensajería y supervisión

| ID | Regla esperada | Estado actual comprobable |
|---|---|---|
| RN-14 | Conversación de exactamente dos membresías activas del mismo evento; solo ellas leen/escriben; sin grupos/adjuntos; se reutiliza el mismo par. | Implementado funcionalmente; constraint contra duplicados concurrentes no verificable. |
| RN-15 | Mensaje exitoso solo al persistirse; registra autor, conversación y hora; solo el autor lo elimina lógicamente. | Implementado parcialmente; enum y auditoría son inciertos. |
| RN-16 | Supervisar DM es lectura excepcional por Admin MUN autorizado del evento, con motivo y auditoría **antes** de exponer; si auditar falla, se deniega. Acceso técnico adicional pendiente. | Documentado, no implementado. |

## Moderación, importación y auditoría

| ID | Regla esperada | Estado actual comprobable |
|---|---|---|
| RN-17 | Solo se reporta contenido visible. Se rechaza provisionalmente un segundo reporte del mismo actor/objetivo. | Documentado, no implementado. |
| RN-18 | Ocultar/eliminar, retirar adjunto, suspender o expulsar requiere autoridad, motivo y fecha. Advertencia presencial no es sanción digital. | Eliminación de post/comentario es parcial y no siempre exige motivo; demás flujos ausentes. |
| RN-19 | CSV valida schema, campos, código, duplicados y comité; muestra previsualización y espera confirmación. Solo importa filas válidas y audita lote/resultado. | Documentado/planificado, no implementado. |
| RN-20 | Acción crítica registra actor, evento, objetivo, hora y motivo. Auditoría es restringida y distinta de logs operativos. | Logger best-effort y sin consulta; no cumple la garantía. |
| RN-21 | Toda lectura/escritura limita `event_id`; referencias cruzadas son inválidas, incluso solicitudes directas, Storage y Realtime. | Parcial; autorización admin global y ausencia de RLS impiden confirmarlo. |

## Matriz normativa de permisos

`Sí*` exige evento, estado activo, muro/comité y alcance. Es intención histórica, no descripción del código.

| Acción | Participante | Moderador | Admin MUN | Admin técnico |
|---|---|---|---|---|
| Leer general/anuncios | Sí* | Sí* | Sí* | Pendiente |
| Leer/publicar en comité | Solo su comité* | Según asignación* | Según permiso* | Pendiente |
| Publicar anuncio | No | Sí* | Sí* | No por defecto |
| Crear post/encuesta/comentar | Muro autorizado* | Muro autorizado* | Muro autorizado* | No por defecto |
| Leer/enviar DM ordinario | Solo integrante* | Solo integrante* | Solo integrante* | No |
| Supervisar DM | No | No | Permiso y motivo* | Denegado provisionalmente |
| Reportar | Sí* | Sí* | Sí* | No por defecto |
| Moderar contenido/reportes | No | Sí* | Sí* | No por defecto |
| Suspender/rehabilitar/expulsar | No | Pendiente | Sí* | Pendiente |
| Gestionar evento/rol/comité/CSV | No | Pendiente | Sí* | Alcance global por definir |
| Consultar auditoría completa | No | No | No por defecto | Sí |

La fuente alterna entre “equipo coordinador” y permisos exclusivos de Admin MUN. Hasta aprobación se aplica la opción de menor acceso; el código actual no materializa todo este catálogo.

## Decisiones abiertas

Formato/desambiguación del código, prueba de identidad, permisos finales por rol, supervisión de DM, retención, representación de mensajes borrados, reapertura de encuestas, privacidad/consentimiento y estado de desactivación se conservan en [pendientes](../07-auditoria/pendientes.md).
