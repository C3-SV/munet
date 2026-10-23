# Reglas de negocio y permisos de MUNET

Estas reglas aplican a todos los requerimientos y a la API, no solo a las pantallas. Recogen `Requerimientos munet.docx`, el anexo 1 y las RN-01–53 de `Arquitectura MUNET.pdf` (pp. 45–50). Las reglas provisionales se señalan expresamente.

## Identidad, evento y membresía

| ID | Regla |
| --- | --- |
| RN-01 | No hay alta pública. Solo personal autorizado habilita cuentas y les asigna evento, rol y, para participantes, exactamente un comité del evento. |
| RN-02 | Una membresía de participante corresponde a un solo evento. Organizador y Admin MUN pueden tener membresías en varios; Admin técnico tiene ámbito global. Toda acción usa el evento autorizado seleccionado. |
| RN-03 | `participant_code` es único por `(event_id, participant_code)`, no se edita ni reasigna, y su alta/importación queda auditada. El ejemplo `AGCGF001` no define por sí solo un patrón obligatorio. |
| RN-04 | La contraseña temporal se usa una sola vez. Solo una cuenta ACTIVA puede iniciar una sesión operativa. Inicio fallido, inicio correcto, activación, cierre y cambio de estado quedan registrados. |
| RN-05 | El umbral de intentos fallidos es configurable y produce BLOQUEADA_SEGURIDAD. Solo el flujo autorizado de seguridad o recuperación revierte ese estado. SUSPENDIDA requiere rehabilitación administrativa; EXPULSADA no se reactiva automáticamente. |
| RN-06 | Cambiar comité, rol, delegación, estado o permisos requiere autoridad sobre ese evento y deja auditoría. Una cuenta sin acceso pierde también permisos de lectura o escritura con sesiones previamente emitidas. |

## Estados y transiciones

### Evento

| Estado | Permiso principal | Transiciones previstas |
| --- | --- | --- |
| BORRADOR | Configuración por administración autorizada; no participación ordinaria. | ACTIVO mediante activación. |
| ACTIVO | Operación según rol y comité. | CERRADO mediante cierre. |
| CERRADO | Consulta histórica autorizada; no cambios de contenido ni configuración. | No se documenta reapertura. |

«Desactivar» aparece en RF-40, pero no tiene estado propio definido. Queda pendiente D-08. Los registros técnicos/auditoría que documentan accesos al archivo cerrado no son cambios de contenido del evento.

### Cuenta de la membresía

| Estado | Efecto | Salida documentada |
| --- | --- | --- |
| PENDIENTE_ACTIVACION | No puede operar. | ACTIVA tras código, contraseña temporal y contraseña nueva. |
| ACTIVA | Puede operar según rol y evento. | BLOQUEADA_SEGURIDAD por fallos, SUSPENDIDA o EXPULSADA por decisión autorizada. |
| BLOQUEADA_SEGURIDAD | Sin sesión operativa. | ACTIVA por desbloqueo de seguridad o recuperación válida. |
| SUSPENDIDA | Sin acceso ni interacción. | ACTIVA solo por rehabilitación administrativa con motivo. |
| EXPULSADA | Sin acceso al evento. | Reversión no definida; requeriría política y acción administrativa explícita. |

### Contenido y reportes

- Post, comentario y mensaje tienen estado `VISIBLE`, `OCULTO_MODERACION`, `ELIMINADO_AUTOR` o `ELIMINADO_ADMIN` como vocabulario de la fuente. La operación concreta admite solo transiciones autorizadas; no hay edición de contenido. La eliminación es lógica y el contenido desaparece de las vistas de participantes. El modelo de dominio del DM usa una enumeración abreviada `VISIBLE|SOFT_DELETED`; debe mapearse de manera coherente al vocabulario elegido antes de implementar.
- Un reporte sigue `ABIERTO → EN_REVISION → RESUELTO` o `ABIERTO/EN_REVISION → DESCARTADO`; no se definió reapertura. Cada cambio guarda actor, hora y resolución.
- Una encuesta está `ABIERTA` o `CERRADA`. El creador puede cerrarla; votar o cambiar voto solo está permitido mientras esté abierta. Reabrir no forma parte de la base provisional.

## Matriz de permisos funcionales

`Sí*` significa que además se comprueban evento, estado ACTIVA, muro/comité y alcance del rol. `Pte.` señala una decisión abierta. La matriz no sustituye las reglas detalladas de cada recurso.

| Acción | Participante | Moderador | Admin MUN | Admin técnico |
| --- | --- | --- | --- | --- |
| Leer muro general y anuncios del evento | Sí* | Sí* | Sí* | Pte. |
| Leer/publicar en muro de comité | Solo su comité* | Según asignación* | Según permiso del evento* | Pte. |
| Publicar anuncio oficial | No | Sí* | Sí* | No por defecto |
| Crear post/encuesta y comentar | En muro autorizado* | En muro autorizado* | En muro autorizado* | No por defecto |
| Leer/enviar DM ordinario | Solo si integra la conversación* | Solo si integra la conversación* | Solo si integra la conversación* | No |
| Supervisar DM ajeno | No | No | Sí, permiso explícito y motivo* | Pte.; denegado provisionalmente |
| Reportar contenido visible | Sí* | Sí* | Sí* | No por defecto |
| Moderar post/comentario/adjunto y reportes | No | Sí* | Sí* | No por defecto |
| Suspender/rehabilitar/expulsar | No | Pte. | Sí* | Pte. |
| Gestionar evento, rol, comité y CSV | No | Pte. | Sí* | Administración técnica global, alcance por definir |
| Consultar auditoría completa | No | No | No por defecto | Sí |

La fuente alterna entre «Equipo Coordinador = Organizador + Admin MUN» y RN que reservan algunas acciones a Admin MUN. La matriz aplica el permiso más restrictivo cuando no hay acuerdo; antes de producción debe aprobarse el mapa de acciones de moderador y Admin técnico.

## Foro, adjuntos y encuestas

| ID | Regla |
| --- | --- |
| RN-07 | Todo post pertenece a exactamente un muro del mismo evento que su autor. General y anuncios son visibles para miembros del evento; un muro de comité solo para miembros de ese comité y autoridades explícitamente autorizadas. |
| RN-08 | Una etiqueta de comité en el muro general no vuelve privado el post. El filtrado por etiquetas no es requisito actual. |
| RN-09 | Un participante publica en general o en su comité; un anuncio solo lo emite el equipo coordinador autorizado. Un comentario requiere visibilidad del post. |
| RN-10 | Las respuestas a comentarios se limitan provisionalmente a un nivel, conforme a «no subhilos» de RF-15. Una respuesta conserva el `post_id` de su comentario padre. |
| RN-11 | Un post admite **cero o un adjunto total**, imagen JPG/PNG ≤5 MB o PDF ≤20 MB. El archivo hereda la visibilidad y el evento del post; comprobar solo la URL o la interfaz no sustituye el control en almacenamiento/API. |
| RN-12 | Un adjunto retirado deja de servirse a lectores ordinarios; la metadata y la acción quedan auditables. No deben quedar referencias de post activas hacia archivos inaccesibles por error. |
| RN-13 | Una encuesta solo se crea en un muro donde su autor podría crear un post. Hay como máximo un voto por membresía y encuesta; cambiarlo sustituye el anterior. |

## Mensajería y supervisión

| ID | Regla |
| --- | --- |
| RN-14 | Una conversación contiene exactamente dos membresías activas del mismo evento. Solo ellas ven y envían mensajes ordinarios; no hay grupos ni adjuntos. Una conversación existente entre el mismo par se reutiliza. |
| RN-15 | Un mensaje enviado se considera exitoso solo tras persistirse; registra autor, conversación y hora. Solo su autor lo elimina lógicamente. |
| RN-16 | La supervisión de DM ajeno es lectura excepcional. Requiere Admin MUN autorizado para ese evento, motivo no vacío y registro de auditoría **antes** de exponer el historial. Si la auditoría falla, se niega el acceso. El acceso técnico adicional está pendiente D-03. |

## Moderación, importación y auditoría

| ID | Regla |
| --- | --- |
| RN-17 | Solo se reporta contenido visible para el reportante. Provisionalmente se rechaza un segundo reporte suyo sobre el mismo objetivo; no se crean duplicados. |
| RN-18 | Ocultar, eliminar, retirar adjunto, suspender o expulsar exige actor autorizado, motivo y fecha. La advertencia presencial no se modela como sanción digital. |
| RN-19 | Importar CSV exige validar esquema, campos, código, duplicados y comité del evento; mostrar previsualización y esperar confirmación explícita. Las filas inválidas no se importan. Se registra lote y resultado. |
| RN-20 | Las acciones críticas generan auditoría con actor, evento, objetivo y hora, más motivo cuando aplique. Los registros son de consulta restringida. Logs operativos y auditoría tienen propósitos diferentes: un error de API no equivale a evidencia de una decisión administrativa. |
| RN-21 | Cada consulta y escritura se limita al `event_id` autorizado; referencias cruzadas entre evento, comité, muro, post, adjunto, conversación y membresía son inválidas. Este control incluye solicitudes directas y suscripciones en tiempo real. |

## Pendientes que afectan reglas definitivas

Están sin fijar el patrón de `participant_code`, su desambiguación entre eventos en login, la prueba de identidad para recuperar contraseña, la lista final de permisos por rol, el protocolo de supervisión de DMs, el plazo de retención de contenido y auditoría, el modo de mostrar un DM eliminado y la política de reapertura de encuesta. Ver [README.md](README.md).
