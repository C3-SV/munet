# Documentación de MUNET

Revisión documental: **2026-10-23**. Evidencia: repositorio local en `0a42cb5`; no se verificó producción ni una base de datos desplegada.

Esta carpeta es la fuente documental mantenida. Distingue cuatro clases de afirmación:

- **Actual comprobado:** evidencia directa en el código local.
- **Requerimiento:** comportamiento esperado recuperado de especificaciones históricas.
- **Plan reciente:** intención registrada en el contexto o planes del repositorio, todavía no necesariamente implementada.
- **No verificado:** requiere esquema, políticas, entorno o decisión externa no disponibles.

## Ruta de lectura

1. [Visión y alcance](01-producto/vision-y-alcance.md)
2. [Funcionalidades y estado](01-producto/funcionalidades.md)
3. [Arquitectura general](02-arquitectura/arquitectura-general.md)
4. [Flujos funcionales](03-referencia/flujos-funcionales.md)
5. [Estado actual de la auditoría](07-auditoria/estado-actual.md)

## Índice

| Área | Fuente principal |
|---|---|
| Producto | [visión](01-producto/vision-y-alcance.md), [funcionalidades](01-producto/funcionalidades.md), [reglas](01-producto/reglas-de-negocio.md), [roles](01-producto/roles-y-permisos.md), [requerimientos](01-producto/requerimientos.md), [criterios de aceptación](01-producto/criterios-de-aceptacion.md) |
| Arquitectura | [general](02-arquitectura/arquitectura-general.md), [frontend](02-arquitectura/frontend.md), [backend](02-arquitectura/backend.md), [datos](02-arquitectura/base-de-datos.md), [integraciones](02-arquitectura/integraciones.md) |
| Referencia | [API](03-referencia/api.md), [modelos](03-referencia/modelos-de-datos.md), [autenticación](03-referencia/autenticacion.md), [flujos](03-referencia/flujos-funcionales.md) |
| Desarrollo | [configuración](04-desarrollo/configuracion-local.md), [guía](04-desarrollo/guia-para-desarrolladores.md), [agentes](04-desarrollo/guia-para-agentes.md), [pruebas](04-desarrollo/pruebas-y-validacion.md) |
| Operaciones | [despliegue y configuración](05-operaciones/despliegue-y-configuracion.md) |
| Decisiones | [índice de ADR](06-decisiones/README.md) |
| Auditoría | [estado](07-auditoria/estado-actual.md), [trazabilidad](07-auditoria/matriz-de-trazabilidad.md), [discrepancias](07-auditoria/discrepancias.md), [pendientes](07-auditoria/pendientes.md), [migración](07-auditoria/migracion-historica.md) |

## Criterio editorial

La estructura separa explicación, guía práctica y referencia; `AGENTS.md` actúa únicamente como mapa operativo. Los ADR se reservan para decisiones relevantes y difíciles de revertir. Las reglas de negocio tienen una única fuente principal y los demás documentos las enlazan.

Los archivos de `docs/superpowers/` se conservan como evidencia fechada de diseño y ejecución. No reemplazan esta documentación ni garantizan que sus listas de tareas reflejen el código actual.

## Prácticas adoptadas

- [Diátaxis](https://diataxis.fr/) orientó la separación entre explicación, guías y referencia.
- [AGENTS.md](https://agents.md/) orientó un punto de entrada corto y operativo para agentes.
- La guía de [iteración con Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex) respaldó investigar primero, usar evidencia del repositorio y mantener instrucciones persistentes.
- La guía de [Architecture Decision Records de Microsoft](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record) se aplicó solo a decisiones significativas, con contexto, consecuencias y estado.

La adaptación evita crear tutoriales o ADR vacíos: cada archivo responde a una necesidad real del repositorio.
