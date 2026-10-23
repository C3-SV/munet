# Documentación consolidada de MUNET

Versión de trabajo: 23 de octubre de 2026. Esta carpeta define el **producto previsto** a partir de los documentos entregados; no certifica qué funciones están implementadas ni sustituye una aprobación actual de MUN ESEN.

## Lectura recomendada

1. [Producto y alcance](01-producto-y-alcance.md): propósito, usuarios y límites.
2. [Requerimientos](02-requerimientos.md): capacidades exigidas y trazabilidad.
3. [Criterios de aceptación](03-criterios-de-aceptacion.md): comprobaciones observables para validar cada grupo funcional.
4. [Reglas de negocio](04-reglas-de-negocio.md): estados, permisos e invariantes.
5. [Arquitectura y calidad](05-arquitectura-y-calidad.md): solución de referencia, atributos medibles y verificaciones.

Los identificadores `REQ`, `CA`, `RN` y `NFR` de esta documentación son nuevos. Los `RF` se refieren a los documentos originales.

## Fuentes y criterio de consolidación

| Fuente en la carpeta original | Uso en esta documentación |
| --- | --- |
| `Munet - IdeaProyecto.docx` (28/01/2026) | Propósito, público, objetivos y escala inicial. |
| `Requerimientos munet.docx` (modificado 16/02/2026) | Detalle de RF, roles, estados y anotaciones de alcance. |
| `ENTREGA_MUNET_1/Arquitectura MUNET.pdf` (17/02/2026), sobre todo anexo 1, pp. 79–94; reglas pp. 45–50; ADR pp. 65–71 | Repetición del listado funcional rotulado «aprobado por MUN ESEN», flujos, reglas y decisiones técnicas. |
| `ENTREGA_MUNET_1/DIAGRAMAS/MUNET_ModeloDeDominio.pdf` y diagramas C4 | Entidades y límites de contenedores; se usan como modelo conceptual, no como esquema físico aprobado. |
| `Entrega Arquitectura - Semana 3.docx` y `Avances MUNET.docx` | Historia de decisiones y comparación de supuestos. |
| `ENTREGA_MUNET_1/Arquitectura MUNET-2-Microservicios.pdf` | Alternativa arquitectónica de la misma entrega, conservada como referencia histórica. |
| `Despliegue Munet en Vercel - ChrisMarroquin.docx/.pdf` | Evidencia de un despliegue académico puntual. No demuestra el estado actual del producto; sus credenciales de prueba se excluyen de esta documentación. |

Las guías de clase, los laboratorios y `Guia4_Sistema_Tutorias` tratan otros ejercicios y no definen MUNET. La carpeta no contiene un repositorio de implementación MUNET verificable. Los archivos PDF y DOCX originales se mantienen fuera de este ZIP para evitar duplicados y datos de prueba.

### Regla de interpretación

Se usa el RF detallado del anexo como fuente principal de comportamiento, especialmente cuando un resumen narrativo anterior discrepa. Se usa la propuesta `Arquitectura MUNET.pdf` como **base técnica provisional**, porque su ADR-002 figura aceptado y su sección 6.3 selecciona capas; el documento paralelo de microservicios no queda borrado ni tratado como decisión final. Cuando dos pasajes detallados se contradicen, esta carpeta señala la decisión pendiente y aplica temporalmente la opción de menor acceso o menor alcance. Ningún «pendiente» debe convertirse en comportamiento definitivo sin validación del equipo responsable.

## Decisiones que requieren confirmación

| ID | Discrepancia o vacío | Base provisional para especificar y probar |
| --- | --- | --- |
| D-01 | Hay propuestas de capas y de microservicios en la misma entrega. | API Express modular en capas, según ADR-002 de `Arquitectura MUNET.pdf`, pp. 67–68. |
| D-02 | DM p95 aparece como `<500 ms` en definición de éxito y `<800 ms` en tabla NFR. | Medir ambas cifras; el umbral de aceptación final queda pendiente. |
| D-03 | RF-22 permite supervisión de DM a Admin MUN y Admin técnico; RN-35 la limita a Admin MUN. | Solo Admin MUN del evento, con permiso explícito, motivo y auditoría previa. |
| D-04 | El resumen excluye adjuntos y notificaciones, pero el anexo RF-36–37 y RF-47–51 y ADR-004 los incluyen. | Incluir un adjunto por post y avisos **dentro de la aplicación**; excluir canales externos. |
| D-05 | RF-31–35 marca «panel administrativo» fuera de alcance, pero otras RF exigen crear eventos, importar usuarios, moderar y auditar. | Exigir esas operaciones y sus controles; la forma de la interfaz administrativa queda abierta. Dashboard y métricas no se incluyen. |
| D-06 | Se permite reabrir encuestas «si se define»; el duplicado de reporte puede rechazarse o consolidarse. | Sin reapertura; rechazar un segundo reporte del mismo usuario sobre el mismo contenido. |
| D-07 | `participant_code` es único por evento, pero se plantea como identificador de login sin definir cómo elegir evento. | El inicio de sesión debe resolver el evento sin ambigüedad; el mecanismo concreto queda abierto. |
| D-08 | Se menciona «desactivar» evento, pero los únicos estados definidos son BORRADOR, ACTIVO y CERRADO. | No agregar un cuarto estado sin decisión; documentar transición y efecto de desactivación. |
| D-09 | Se habla de 250 usuarios iniciales y de un pico de 300; cambian algunos objetivos de recuperación y notificaciones. | Diseñar la prueba con 300 usuarios como escenario conservador; confirmar carga, RTO/RPO y canal de avisos. |
| D-10 | Recuperación de contraseña, formato del código, límites de contenido, retención, consentimiento y protocolo de acceso a DM no están detallados. | Requieren definición operativa y de privacidad antes de producción, especialmente por participantes menores de edad. |

Estas decisiones abiertas no impiden usar los documentos como backlog y guía de diseño. Sí impiden declarar aceptadas las partes afectadas sin resolverlas.
