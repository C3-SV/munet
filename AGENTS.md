# AGENTS.md — MUNET

## Propósito

MUNET es una plataforma web para operar eventos de Modelo de Naciones Unidas. El repositorio contiene una aplicación participante, una base inicial de panel administrativo, una API y paquetes compartidos. La documentación oficial comienza en [`docs/README.md`](docs/README.md).

## Mapa del repositorio

- `apps/web`: Next.js. Incluye autenticación, selector de evento, muros, perfiles, chat y rutas administrativas iniciales.
- `apps/api`: Express + TypeScript. Es la frontera autorizada para operaciones de Supabase, salvo suscripciones Realtime del navegador.
- `apps/docs`: plantilla Next.js sin contenido documental de MUNET; no confundir con `docs/`.
- `packages/ui`: componentes de ejemplo compartidos; el producto usa principalmente componentes locales de `apps/web`.
- `packages/eslint-config` y `packages/typescript-config`: configuración compartida.
- `docs/`: fuente documental mantenida.

## Lectura según la tarea

- Producto, alcance y reglas: [`docs/01-producto/`](docs/01-producto/).
- Límites técnicos: [`docs/02-arquitectura/`](docs/02-arquitectura/).
- Endpoints, datos, autenticación y flujos: [`docs/03-referencia/`](docs/03-referencia/).
- Puesta en marcha e investigación: [`docs/04-desarrollo/`](docs/04-desarrollo/).
- Estado real, divergencias y pendientes: [`docs/07-auditoria/`](docs/07-auditoria/).
- Decisiones arquitectónicas: [`docs/06-decisiones/`](docs/06-decisiones/).

## Cómo investigar una funcionalidad

1. Identifica su estado en [`docs/01-producto/funcionalidades.md`](docs/01-producto/funcionalidades.md).
2. Revisa reglas y discrepancias; el código describe lo existente, no sustituye la decisión de negocio.
3. Sigue el flujo `app/` → `lib/api/` → ruta/controlador/servicio de `apps/api` → tablas documentadas.
4. Verifica siempre el contexto de evento, la membresía activa y el rol. Una pantalla visible no prueba autorización ni persistencia.
5. Consulta [`docs/04-desarrollo/guia-para-agentes.md`](docs/04-desarrollo/guia-para-agentes.md) para recorridos concretos.

## Restricciones y convenciones

- Toda consulta o mutación de datos pasa por `apps/api`; la excepción vigente es Supabase Realtime desde `apps/web`.
- No expongas `SUPABASE_SERVICE_ROLE_KEY` al cliente ni documentes valores secretos.
- La identidad operativa es una membresía dentro de un evento, no solo un usuario global.
- No asumas aislamiento por evento: compruébalo en cada controlador y en las políticas RLS, que no están versionadas.
- Roles administrativos se detectan hoy por texto (`ADMIN`, `COORDINADOR`, `ORGANIZADOR`); es una implementación provisional, no un catálogo normativo.
- No cambies estados, reglas o contratos para “alinearlos” con documentos históricos sin una decisión explícita.
- No edites artefactos de `docs/superpowers/`; son evidencia de planificación, no la fuente de verdad actual.

## Verificación segura

Antes de entregar cambios:

1. Ejecuta las comprobaciones pertinentes descritas en [`docs/04-desarrollo/pruebas-y-validacion.md`](docs/04-desarrollo/pruebas-y-validacion.md).
2. Revisa `git status --short` y `git diff --check`.
3. Confirma que el diff solo contenga archivos autorizados.
4. No ejecutes migraciones, despliegues, operaciones contra producción, borrados de datos, commits o push sin autorización expresa.

Si cambia comportamiento, actualiza primero el documento especializado y luego la matriz de trazabilidad cuando afecte un requisito. Evita copiar reglas completas en varios lugares: enlaza a su fuente principal.
