# Registro de migración histórica

## Inventario

Se analizaron **6 archivos Markdown** bajo `docs/HISTORICO - DOCS MUNET/documentacion munet`. Todos sus conceptos relevantes fueron preservados como reglas, requerimientos, estados, discrepancias o pendientes. Tras las verificaciones, los seis originales se retiraron para evitar dos fuentes operativas.

| Archivo histórico | Contenido identificado | Nuevos destinos | Tratamiento |
|---|---|---|---|
| `README.md` | Índice, alcance y forma de lectura | [`docs/README.md`](../README.md), [visión](../01-producto/vision-y-alcance.md) | Consolidado; original retirado |
| `01-producto-y-alcance.md` | Propósito, actores, alcance/exclusiones | [visión](../01-producto/vision-y-alcance.md), [funcionalidades](../01-producto/funcionalidades.md), [requerimientos](../01-producto/requerimientos.md) | Vigente separado de estado actual |
| `02-requerimientos.md` | REQ-01–REQ-24, NFR-01–NFR-10 | [requerimientos](../01-producto/requerimientos.md), [matriz](matriz-de-trazabilidad.md), [pendientes](pendientes.md) | Todos los IDs preservados y clasificados |
| `03-criterios-de-aceptacion.md` | CA-01–CA-24, escenarios, estados y excepciones | [criterios de aceptación](../01-producto/criterios-de-aceptacion.md), [flujos](../03-referencia/flujos-funcionales.md), [matriz](matriz-de-trazabilidad.md) | Todos los CA preservados y contrastados |
| `04-reglas-de-negocio.md` | RN-01–RN-21, decisiones abiertas D-01–D-10 | [reglas](../01-producto/reglas-de-negocio.md), [roles](../01-producto/roles-y-permisos.md), [pendientes](pendientes.md) | Reglas consolidadas temáticamente; preguntas preservadas |
| `05-arquitectura-y-calidad.md` | Arquitectura objetivo, seguridad, calidad y operación | [arquitectura](../02-arquitectura/arquitectura-general.md), [backend](../02-arquitectura/backend.md), [datos](../02-arquitectura/base-de-datos.md), [pruebas](../04-desarrollo/pruebas-y-validacion.md), [operaciones](../05-operaciones/despliegue-y-configuracion.md) | Separado entre realidad, objetivo y no verificado |

## Otras fuentes documentales revisadas

| Fuente | Uso | Estado posterior |
|---|---|---|
| `docs/MUNET_DOCUMENTACION_TECNICA.md` | Referencia técnica previa, con afirmaciones no siempre demostradas | Sustituido por un puntero de compatibilidad |
| `munet-context-general.md` | Contexto reciente, roadmap y base administrativa | Migrado; sustituido por puntero de compatibilidad |
| `docs/superpowers/specs/2026-08-15-admin-endpoints-authz-design.md` | Motivo y opciones de `requireAdmin` | Conservado como evidencia fechada |
| `docs/superpowers/plans/2026-08-15-admin-endpoints-authz.md` | Plan de implementación | Conservado; checklist no se usa como estado actual |

## Criterios de exclusión explícita

- Referencias a documentos/PDF originales no presentes se registran como limitación; no se recrea su contenido.
- Cifras contradictorias de carga, RTO/RPO y decisiones sin resolución se conservan en [pendientes](pendientes.md), no como requisitos cerrados.
- Detalles repetidos se consolidan en una sola fuente principal y se enlazan.
- Ninguna limitación actual del código se convierte automáticamente en regla de negocio.

## Verificación de cobertura

- REQ-01–REQ-24: presentes en [matriz](matriz-de-trazabilidad.md).
- CA-01–CA-24: preservados y clasificados en [criterios de aceptación](../01-producto/criterios-de-aceptacion.md).
- RN-01–RN-21: preservadas por identificador en [reglas](../01-producto/reglas-de-negocio.md); sus discrepancias y preguntas se conservaron.
- NFR-01–NFR-10: presentes en [requerimientos](../01-producto/requerimientos.md) y estado de evidencia.
- D-01–D-10 históricas: transformadas en preguntas de [pendientes](pendientes.md), sin inventar respuestas.
- Base admin nueva: registrada en funcionalidades, API, flujos, ADR-004 y auditoría.

La eliminación se limita a los seis Markdown del directorio histórico. Los planes de `docs/superpowers/` se mantienen porque documentan una decisión reciente y no han sido declarados obsoletos.
