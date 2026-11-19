# Alcance y planes del equipo web

**Estado: para revisión.** Base verificada con el remoto el 18 de noviembre de 2026, `main` en `56582dcf61096034c387e891625b452dfe1c886e`. Fuente de priorización: *MUNET_Plan_Maestro_Unificado_2026-11-18.xlsx*, hojas **Backlog maestro** (A4:J35), **Trazabilidad 50** (A4:H54), **Decisiones** (A4:F19), **Checklist demo** (A4:F22) y **Panel** (A9:E15). Las ventanas de la planilla son contexto del corte. Los estados de los recorridos proceden del repositorio y la evidencia local.

El alcance web cubre la experiencia pública y participante, sus contratos en `apps/api` y las verificaciones de integración. El equipo admin conserva el panel, sus rutas y componentes, la gestión de eventos, participantes/CSV, moderación, fijado, cierre y reapertura (D01–D02 y A01–A07, con la interfaz participante de A03 como excepción). La puesta en marcha y los datos institucionales de O01–O04 son dependencias de operación. D09 es compartida y la aportación web es el guion y la evidencia del recorrido participante. El amarillo/dorado figura cancelado en S3-08.

Se propone estabilizar primero los recorridos que ya existen. El directorio se diseña como contrato participante para que chat pueda reutilizarlo y el equipo admin conserve sus contratos. Las pruebas de acceso arrancan junto a la estabilización y sus resultados deciden qué ajustes de integración hacen falta antes de un piloto.

## Secuencia

| Fase | Prioridad y alcance web | Orden de trabajo y criterio para avanzar |
| --- | --- | --- |
| 0 · Estabilización | P0 · D03–D08, aportación a D09 | Empezar por D06 y D07. Abrir el recorrido D03/D05 cuando se disponga de los fixtures D01/D02. D04 depende de esa línea base. D08 comprueba las pantallas conforme se habilitan y D09 consolida D01–D08. [Plan de estabilización](01-estabilizacion.md) |
| 1 · Entregas del equipo admin | P1 · A03 web y dependencias de operación | Tras la entrega del identificador `#`, validar su presentación web. El logo W01 puede entrar en cuanto MUN entregue B01. [Plan de producto](02-producto.md) |
| 2 · Producto participante | P1 · W01–W04. P2 · W07 y W05, condicionadas | W02 precede a W03. W04 depende de B02. W07 requiere B14 y corroborar B07 con admin si aparece la colisión de ingreso. W05 requiere decisiones B03/B04 y el trabajo de Storage de Q03. [Plan de producto](02-producto.md), [plan condicionado](04-condicionadas.md) |
| 3 · Calidad del piloto | P1 · Q01–Q03 | Q01 comparte fixtures con la fase 0 y arranca al estar disponibles. Q02 requiere contrato API y responsables. Q03 comienza por inventario de infraestructura de QA y termina con carga al acordar B12. Q01/Q02 son condiciones antes de incorporar usuarios reales y Q03 antes del evento real. [Plan de calidad](03-calidad.md) |
| 4 · Posterior | P3 · W06 y Q04 | Tour tras estabilizar guía/UI y aprobar B11. Limpieza técnica después de la demo y con producto estable. Reportes, notificaciones y supervisión requieren alcance independiente. [Plan condicionado](04-condicionadas.md) |

Las tareas sin dependencia pendiente pueden prepararse en su orden de prioridad. Una prueba sin entorno o con una dependencia fallida se registra como bloqueada, con el caso reproducible y su responsable. El orden de la planilla no convierte una propuesta pendiente en una regla de producto.

## Insumos y decisiones por solicitar

| Cuándo | Responsable | Entrega o decisión |
| --- | --- | --- |
| Antes de D03–D05 y Q01 | Admin/API e infraestructura | Confirmar un proyecto QA independiente y desechable. Entregar dos eventos ficticios, dos comités en el primero, uno en el segundo, muros general/avisos y membresías ficticias activas y pendientes. Acordar quién aprovisiona, cambia de comité y suspende cuentas de QA. Configuración y credenciales mediante el canal privado del equipo. |
| Durante D06, si se conservan soporte y términos | MUN ESEN | Destino oficial de soporte y URL o texto aprobado para términos. La guía puede publicarse como destino funcional desde web mientras se reciben. |
| Antes de W01 · B01 | MUN ESEN | PNG oficial en alta resolución, ubicación aprobada y confirmación de si identifica al evento o a su organizador. |
| Antes de A03 web | Equipo admin/API | Evidencia en QA de 001/002 y contrato de lectura del `#`: formato, disponibilidad para membresías previas, y superficies y visibilidad de tarjetas/búsqueda. |
| Antes de W02/W03 | Equipo API y MUN ESEN para reglas abiertas | Revisar el contrato participante propuesto. Confirmar campos públicos, roles incluidos y tratamiento de miembros sin comité o con comité archivado. |
| Antes de W04 · B02 | MUN ESEN | Ejemplos de conteos esperados para texto, encuestas, muros de comité ajeno, contenido moderado o eliminado y publicaciones de otro evento. |
| Antes de W07 · B14 y, si corresponde, B07 | MUN ESEN y equipo admin | Confirmar cuándo elegir evento, cuándo recordar selección y cómo cambiarla. Resolver la colisión de códigos de login por separado si bloquea el flujo. |
| Antes de Q02/Q03 · B12 | API, infraestructura y MUN ESEN | Parámetros y ámbito de los límites, política de auditoría, inventario saneado de QA y meta de carga con concurrencia, mezcla de operaciones, duración y umbrales. |
| Antes de W05 · B03/B04 | MUN ESEN, API e infraestructura | Autorización de fotos, tipos, tamaño, privacidad, moderación y retención. PDF exige una decisión explícita. |
| Antes de W06 · B11 y Q04 | MUN ESEN y equipo web | Aprobar formato, guion y público de la grabación, y confirmar qué mejoras posteriores tienen prioridad. B15 sigue abierto para supervisión y bloqueo de DM. |

## Registro y cierre por etapa

1. Usar la [guía de verificación](../pruebas-y-validacion.md) y el [protocolo de calidad](03-calidad.md). Registrar para cada ID la revisión del código, comando o caso, entorno, fecha, resultado, limitación y responsable del seguimiento. Marcar por separado la evidencia estática, las pruebas locales y el E2E.
2. Actualizar primero el documento especializado que corresponda: [frontend](../../02-arquitectura/frontend.md), [API](../../03-referencia/api.md), [autenticación](../../03-referencia/autenticacion.md), [flujos](../../03-referencia/flujos-funcionales.md) o [pruebas](../pruebas-y-validacion.md). Actualizar [funcionalidades](../../01-producto/funcionalidades.md) al comprobar una capacidad y la [matriz](../../07-auditoria/matriz-de-trazabilidad.md) cuando cambie la evidencia de un requisito.
3. Revisar `git status --short`, `git diff --check` y el alcance del diff. Cada mejora verificada puede cerrarse con el commit indicado en su plan cuando se autorice su ejecución. Excluir rutas, clientes y componentes del panel admin del diff y preservar su comportamiento al trabajar en entradas compartidas.
4. Usar pruebas locales con sustitutos y, cuando se apruebe, un proyecto QA separado con objetos ficticios. Las pruebas, migraciones y cargas de QA requieren confirmar destino y autorización. Los datos existentes y el proyecto Supabase en uso quedan fuera de estos recorridos.
