# Catálogo de requerimientos

Se conservan los identificadores históricos. El texto resume comportamiento esperado; la última columna refleja el código local al 2026-10-23. Evidencia ampliada: [matriz de trazabilidad](../07-auditoria/matriz-de-trazabilidad.md).

| ID | Requerimiento esperado | Estado actual |
|---|---|---|
| REQ-01 | Admin MUN crea, edita, activa y cierra eventos; cerrado es solo lectura. | Parcial / divergente |
| REQ-02 | Evento define comités, muro general, anuncios y uno por comité. | Parcial |
| REQ-03 | Membresía, contenido, DM, reporte, incidente, auditoría y archivos se aíslan por evento. | Parcial / pendiente RLS |
| REQ-04 | Roles son por evento, cambios auditados y personal multi-evento selecciona contexto. | Parcial / divergente |
| REQ-05 | Personal habilita participante con identidad, comité, código inmutable/único y contraseña temporal; audita alta. | Parcial |
| REQ-06 | Participante activa cuenta, cambia contraseña temporal y pasa a activa; se audita. | Parcial |
| REQ-07 | Solo cuenta activa inicia sesión; se registran intentos y logout revoca sesión. | Parcial; logout solo local |
| REQ-08 | Bloqueo por umbral configurable; desbloqueo, suspensión y rehabilitación autorizados/auditados. | Documentado, no implementado |
| REQ-09 | Recuperación con verificación; nueva credencial solo reactiva bloqueo de seguridad, no suspensión/expulsión. | Documentado, no implementado |
| REQ-10 | Ver perfiles permitidos; usuario edita nombre/bio/foto; campos institucionales requieren admin y auditoría. | Parcial |
| REQ-11 | Ver general/anuncios y solo comité autorizado; cada post tiene un muro. | Parcial |
| REQ-12 | Publicar texto/enlace en general/comité; tag no cambia visibilidad; solo coordinación publica anuncios. | Parcial |
| REQ-13 | Autor/moderación retira u oculta post lógicamente, auditable y sin marcador al participante. | Parcial / divergente |
| REQ-14 | Comentar/responder un nivel; eliminación lógica por autor/moderación, sin edición. | Parcial |
| REQ-15 | Crear encuesta en muro autorizado, voto único reemplazable y cierre por creador auditado. | Parcial |
| REQ-16 | Un adjunto por post: JPG/PNG ≤5 MB o PDF ≤20 MB, metadata, permisos heredados y retiro. | Documentado, no implementado |
| REQ-17 | Reutilizar conversación 1:1 entre miembros activos del mismo evento, con bandeja/historial. | Parcial |
| REQ-18 | Enviar texto/enlaces; autor/hora/conversación; solo autor elimina lógicamente; sin adjuntos/edición. | Parcial |
| REQ-19 | Supervisión DM de solo lectura, permiso/motivo y auditoría previa fail-closed. | Documentado, no implementado |
| REQ-20 | Reportar post/comentario visible; estados y deduplicación por actor/objetivo. | Documentado, no implementado; postergado |
| REQ-21 | Revisar reportes, incidentes, ocultar/retirar, suspender/expulsar con motivo y actor. | Mayormente no implementado |
| REQ-22 | Avisos internos persistentes por DM/anuncios con historial/contador y Realtime. | Documentado, no implementado; postergado |
| REQ-23 | CSV con validación/previsualización/confirmación, errores por fila y lote auditado. | Documentado, no implementado |
| REQ-24 | Acciones críticas e intentos indebidos auditados; consulta completa para Admin técnico. | Parcial |

## Requerimientos expresamente excluidos

- Sin edición de posts, comentarios o mensajes y sin reacciones.
- Sin adjuntos en DM.
- Sin dashboard administrativo integral ni métricas; sí deben existir vías para las operaciones administrativas requeridas.
- Sin filtro obligatorio del muro general por tags.
- Sin registro abierto, chat grupal, app nativa ni notificaciones externas.

## Requerimientos no funcionales recuperados

Estos son objetivos históricos, no resultados medidos:

| ID | Objetivo | Estado de evidencia |
|---|---|---|
| NFR-01 | Disponibilidad ≥99.5 % durante días del evento | No verificado; ventana/exclusiones abiertas |
| NFR-02 | Feed paginado p95 <400 ms | No medido; no hay paginación robusta |
| NFR-03 | Crear post/comentario p95 <600 ms hasta persistencia | No medido |
| NFR-04 | DM p95 <500 ms o <800 ms, cifras contradictorias | No medido; umbral pendiente |
| NFR-05 | Pico 3× y p95 <1200 ms; fuentes hablan de 250/300 usuarios | No medido; carga base pendiente |
| NFR-06 | Cero accesos cruzados por evento/comité/rol/DM | No demostrado; existe riesgo admin global |
| NFR-07 | 100 % de acciones críticas auditadas | No cumplido: logger best-effort |
| NFR-08 | Cero pérdida silenciosa de posts/mensajes | No probado; escrituras no transaccionales |
| NFR-09 | RTO <60 min y RPO provisional <15 min | No verificado ni operacionalizado |
| NFR-10 | 100 % de peticiones con fecha, request ID, usuario, evento, endpoint y estado | No implementado |

Las pruebas deben declarar dataset, concurrencia, red, punto de medición y periodo. Accesibilidad, compatibilidad, retención y privacidad siguen necesitando criterios operativos adicionales.

## Decisiones que impiden cerrar aceptación

Formato y desambiguación de código, prueba de identidad, roles finales, protocolo/retención de DM, límites de contenido, consentimiento —especialmente si hay menores—, recuperación, RTO/RPO y estados de evento requieren aprobación. Véase [pendientes](../07-auditoria/pendientes.md).
