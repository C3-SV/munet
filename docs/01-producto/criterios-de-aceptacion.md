# Criterios de aceptación recuperados

Estos criterios expresan pruebas esperadas, no pruebas ya ejecutadas. Deben usar al menos dos eventos, dos comités y roles/estados distintos. “Rechazar” significa no mutar datos, responder de forma comprensible y registrar el intento si es sensible.

| ID | Requisito | Criterio verificable resumido | Estado de prueba |
|---|---|---|---|
| CA-01 | REQ-01 | Crear deja borrador; fechas inválidas fallan; activar habilita; cerrar impide toda escritura; no-admin no cambia evento. | No satisfecho: alta crea activo y no hay cierre |
| CA-02 | REQ-02 | Un general, un anuncios y uno por comité; no cruzar comité/muro de evento. | Pendiente de schema/pruebas |
| CA-03 | REQ-03 | IDs manipulados nunca revelan datos de otro evento; búsqueda admin usa contexto; denegación se registra. | No demostrado; riesgo admin global |
| CA-04 | REQ-04 | Cambio de rol solo afecta evento y audita; multi-evento elige contexto; participante no tiene segunda membresía participante. | No ejecutado; última restricción no demostrada |
| CA-05 | REQ-05 | Alta pendiente con comité/código único/auditoría; formato/duplicado falla; código no cambia ni se reasigna. | Parcial/no demostrado |
| CA-06 | REQ-06 | Temporal válida activa y solo se usa una vez; inválida no activa. | Parcial/no ejecutado |
| CA-07 | REQ-07 | Solo activa inicia; todos los intentos se registran; logout revoca credencial. | Parcial; logout no revoca |
| CA-08 | REQ-08 | Umbral bloquea; suspensión/rehabilitación con motivo; sesión antigua pierde acceso; desbloqueo no levanta suspensión. | No implementado |
| CA-09 | REQ-09 | Recuperación no confía solo en código; nueva credencial invalida anterior; no reactiva suspensión/expulsión. | No implementado |
| CA-10 | REQ-10 | Mismo evento ve perfil; usuario solo cambia nombre/bio/foto; campos institucionales no; admin audita. | Parcial |
| CA-11 | REQ-11 | Participante solo ve general, anuncios y su comité incluso con URL manipulada; post y muro comparten evento. | Parcial/no ejecutado |
| CA-12 | REQ-12 | Publica en general/su comité, nunca anuncios; tag general no restringe; solo coordinador anuncia. | Parcial; alta de tags ausente |
| CA-13 | REQ-13 | Autor/moderador retira; tercero no; desaparece sin marcador y conserva datos/auditoría restringida. | Parcial |
| CA-14 | REQ-14 | Solo lector comenta; vacío y nieto fallan; autor/moderación retira; sin edición. | Parcial |
| CA-15 | REQ-15 | Encuesta solo en muro autorizado; voto único reemplazable; cierre auditado bloquea votos; sin reapertura. | Parcial |
| CA-16 | REQ-16 | Un JPG/PNG ≤5 MB o PDF ≤20 MB; permisos heredados; retiro conserva metadata sin huérfanos. | No implementado |
| CA-17 | REQ-17 | Abre/reutiliza par del mismo evento; no consigo mismo/tercero/otro evento; historial ordenado persiste. | Parcial |
| CA-18 | REQ-18 | Solo integrantes envían/leen; confirma tras persistir; solo autor elimina; sin edición/adjuntos. | Parcial |
| CA-19 | REQ-19 | Admin MUN del evento da motivo; auditoría ocurre antes; si falla se deniega; otro evento no accede; solo lectura. | No implementado |
| CA-20 | REQ-20 | Reporte visible crea `ABIERTO`; duplicado propio falla; transita con responsable/resolución. | No implementado |
| CA-21 | REQ-21 | Moderación/sanción con permiso y motivo; contenido deja de verse; suspensión corta sesión; rol insuficiente falla. | Mayormente no implementado |
| CA-22 | REQ-22 | DM/anuncio crea aviso persistente/contador; sobrevive fallo Realtime; reintento no duplica; sin canal externo. | No implementado |
| CA-23 | REQ-23 | Preview muestra válidas/inválidas/duplicadas y errores; no escribe antes de confirmar; importa solo válidas y audita lote. | No implementado |
| CA-24 | REQ-24 | Toda acción crítica guarda campos; solo Admin técnico consulta completo; supervisión falla cerrada sin auditoría. | No satisfecho completamente |

## Calidad

Las aceptaciones de rendimiento, disponibilidad, aislamiento, auditoría, recuperación y observabilidad usan NFR-01–NFR-10 de [requerimientos](requerimientos.md). Los umbrales de DM, pico y recuperación deben resolverse antes de declarar pase/fallo.
