# Requerimientos funcionales de MUNET

Este catálogo expresa comportamiento esperado, no implementación comprobada. La columna de origen permite volver al listado `Requerimientos munet.docx`, repetido en el anexo 1 de `Arquitectura MUNET.pdf` (pp. 79–94). Los criterios verificables están en [03-criterios-de-aceptacion.md](03-criterios-de-aceptacion.md) y las restricciones transversales en [04-reglas-de-negocio.md](04-reglas-de-negocio.md).

## Eventos y pertenencia

| ID | Requerimiento | Origen |
| --- | --- | --- |
| REQ-01 | Un Admin MUN autorizado puede crear, editar, activar y cerrar eventos con nombre, fechas y estado. Un evento cerrado se consulta en modo de solo lectura. | RF-40 |
| REQ-02 | Cada evento define comités, un muro general, un muro de anuncios y un muro por comité, además de sus reglas operativas. | RF-42 |
| REQ-03 | Toda membresía, publicación, comentario, DM, reporte, incidente y auditoría pertenece a un evento; las lecturas, escrituras y archivos respetan ese límite. | RF-41 |
| REQ-04 | Los roles se asignan por evento y sus cambios se auditan. Personal con acceso a varios eventos selecciona el contexto antes de operar. | RF-43, RF-44 |

## Acceso y perfiles

| ID | Requerimiento | Origen |
| --- | --- | --- |
| REQ-05 | El equipo autorizado habilita a un participante con identidad, comité, `participant_code` y contraseña temporal de un solo uso; registra responsable y fecha. El código cumple el formato definido para el evento, es único en él y no cambia ni se reasigna. | RF-01, RF-02.3, RF-23 |
| REQ-06 | El participante activa su cuenta con código y contraseña temporal, define una contraseña nueva y pasa de PENDIENTE_ACTIVACION a ACTIVA; el uso de la credencial y la transición quedan registrados. | RF-02.5 |
| REQ-07 | El usuario inicia sesión con código y contraseña, solo si su cuenta está ACTIVA; se registran intentos exitosos y fallidos. Puede cerrar sesión y revocar la sesión activa. | RF-02, RF-03 |
| REQ-08 | El sistema bloquea por seguridad al superar un umbral configurable de intentos fallidos y permite desbloqueo administrativo. La coordinación puede suspender y rehabilitar cuentas con motivo, responsable y fecha. | RF-04, RF-06, RF-07 |
| REQ-09 | El usuario puede solicitar recuperación de contraseña; el equipo administrador puede emitir una credencial nueva. Restablecer la contraseña solo reactiva automáticamente una cuenta BLOQUEADA_SEGURIDAD, nunca una SUSPENDIDA o EXPULSADA. El método de verificación de identidad está pendiente. | RF-05, RF-06, RF-07 |
| REQ-10 | Cada miembro puede consultar perfiles permitidos del evento. Solo puede editar su nombre a mostrar, biografía e imagen. Los campos institucionales, como comité, delegación, rol y estado, requieren autoridad administrativa y auditoría. | RF-08–10 |

## Foro y adjuntos

| ID | Requerimiento | Origen |
| --- | --- | --- |
| REQ-11 | Una persona autenticada ve el muro general y los anuncios de su evento, y solo el muro de su comité, salvo permisos administrativos del evento. Cada publicación tiene exactamente un muro. | RF-11, RF-23–27 |
| REQ-12 | Un participante puede crear un post académico con texto y/o enlace en el muro general o el de su comité. Una etiqueta de comité en el muro general organiza la información sin cambiar su visibilidad. Solo el equipo coordinador publica anuncios oficiales. | RF-12, RF-25–27 |
| REQ-13 | El autor puede retirar su post y la moderación autorizada puede retirarlo u ocultarlo. La eliminación es lógica, auditable y el post deja de aparecer a participantes sin marcador visible. | RF-14, RF-28 |
| REQ-14 | Quien pueda ver un post puede comentarlo y responder a un comentario. El alcance detallado dice «hilos anidados (no subhilos)»: se toma un nivel de respuesta como base provisional. El autor o la moderación puede eliminar comentarios lógicamente; los eliminados no se muestran. | RF-15 |
| REQ-15 | En un muro donde puede publicar, un miembro puede crear una encuesta; cada miembro emite un voto, puede cambiarlo mientras esté abierta y el creador puede cerrarla. Crear y cerrar se audita. La reapertura queda sin definir. | RF-12.1 |
| REQ-16 | Un post admite como máximo un adjunto total: JPG/PNG de hasta 5 MB o PDF de hasta 20 MB. Se conserva metadata y el adjunto hereda los permisos del post. Autor o moderación autorizada puede retirarlo; el post puede permanecer sin él. | RF-47–51, RF-48.1 |

## Mensajería, avisos y moderación

| ID | Requerimiento | Origen |
| --- | --- | --- |
| REQ-17 | Miembros activos del mismo evento pueden abrir o reutilizar una conversación DM entre exactamente dos personas y consultar su bandeja e historial persistente. | RF-17, RF-21 |
| REQ-18 | Los dos integrantes pueden enviar texto y enlaces; cada mensaje registra autor, hora y conversación. Solo el autor puede eliminarlo lógicamente; deja de verse a participantes y la acción queda auditable. No hay adjuntos ni edición. | RF-18–20 |
| REQ-19 | La supervisión institucional de DM exige permiso explícito, motivo obligatorio, lectura únicamente y auditoría previa de quién, cuándo y qué conversación se abrió. Si no se puede registrar la auditoría, se niega la lectura. El rol exacto adicional a Admin MUN está pendiente (D-03). | RF-22; `Arquitectura MUNET.pdf`, pp. 40–42 y RN-35–37 |
| REQ-20 | Un miembro puede reportar una publicación visible; los flujos detallados también contemplan comentarios. El reporte guarda objetivo, reportante, motivo y hora, pasa por ABIERTO, EN_REVISION y RESUELTO o DESCARTADO, y evita duplicados del mismo reportante y objetivo. | RF-28; `Arquitectura MUNET.pdf`, pp. 37–40 |
| REQ-21 | El personal autorizado revisa reportes, registra incidentes y ejecuta ocultación de contenido, retiro de adjuntos, suspensión o expulsión con responsable, motivo y hora. La advertencia presencial mencionada en la fuente no es una acción del sistema. | RF-28–30 |
| REQ-22 | El usuario recibe avisos dentro de la aplicación por nuevos DM y anuncios oficiales; puede consultar historial y contador. La persistencia del aviso y su actualización en tiempo real se apoyan en ADR-004. | RF-36–37; ADR-004, pp. 70–71 |

## Operación y trazabilidad

| ID | Requerimiento | Origen |
| --- | --- | --- |
| REQ-23 | El equipo autorizado puede subir un CSV con nombre, apellido, institución, código, delegación y comité; valida esquema, unicidad y existencia del comité, muestra errores por fila y resumen, y requiere confirmación antes de importar filas válidas. El lote y sus resultados se auditan. | RF-38; `Arquitectura MUNET.pdf`, pp. 23–26 |
| REQ-24 | Las acciones críticas y los intentos de acceso indebido generan registros de auditoría asociados a actor, evento, objetivo, fecha y motivo cuando proceda. La consulta de auditoría está reservada al Admin técnico en la propuesta detallada. | RF-34; `Arquitectura MUNET.pdf`, RN-52–53, pp. 50 y 44–45 |

## Requerimientos expresamente excluidos

| Origen | Decisión de alcance |
| --- | --- |
| RF-13, RF-16, RF-19 | No editar posts, comentarios o mensajes ni añadir reacciones. |
| RF-18 | No adjuntar archivos a mensajes DM. |
| RF-31–35 | No exigir un dashboard integral ni métricas. Las funciones de operación presentes en REQ-01, 04, 08, 10, 19, 20, 21, 23 y 24 sí requieren una vía usable y autorizada. |
| RF-39 | No exigir filtrado de posts del muro general por etiquetas. |
| Visión y ADR-004 | No registro abierto, chat grupal, apps nativas ni notificaciones externas. |

## Límites para la implementación

El formato exacto del código, la verificación de identidad para recuperar contraseña, el protocolo institucional para leer DM, la política de retención y el mecanismo de login cuando dos eventos usan el mismo código necesitan decisión antes de liberar el producto. [README.md](README.md) enumera las discrepancias restantes.
