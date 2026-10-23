# Guía para agentes de IA

Esta guía reduce recorridos innecesarios sin reemplazar `AGENTS.md`.

## Entender el proyecto desde cero

Lee, en orden: [`docs/README.md`](../README.md), [visión](../01-producto/vision-y-alcance.md), [funcionalidades](../01-producto/funcionalidades.md), [arquitectura](../02-arquitectura/arquitectura-general.md) y [estado actual](../07-auditoria/estado-actual.md).

## Investigar una funcionalidad del frontend

1. Localiza su `page.tsx` en `apps/web/app`.
2. Sigue imports hacia `components`, `stores/auth.store.ts` y `lib/api`.
3. Identifica qué valores vienen de ruta, store, `x-event-id` o `muro`.
4. Busca el endpoint en `apps/api/src/routes` y continúa al controlador/servicio.
5. Comprueba estados de carga, error, vacío y marcadores explícitos.

## Investigar un endpoint o servicio

1. Empieza en `apps/api/src/server.ts` para el prefijo.
2. Lee la ruta y todos sus middlewares.
3. Sigue controlador, servicio y utilidades.
4. Enumera tablas, filtros de evento/membresía, roles, estados y efectos múltiples.
5. Busca el consumidor con `rg` en `apps/web/lib/api` y páginas.

## Entender una regla de negocio

Consulta [reglas](../01-producto/reglas-de-negocio.md), después la [matriz](../07-auditoria/matriz-de-trazabilidad.md) y finalmente la evidencia citada. Si historia y código difieren, conserva ambos; no conviertas el bug o la carencia en regla nueva.

## Analizar permisos y seguridad

Recorre `auth.middleware.ts`, `rbac.utils.ts`, utilidades de muro y el controlador afectado. Verifica cuatro preguntas: ¿quién está autenticado?, ¿qué membresía usa?, ¿pertenece al evento del recurso?, ¿qué rol/capacidad se exige? Consulta además [autenticación](../03-referencia/autenticacion.md).

## Investigar base de datos

Busca `.from('tabla')` y sigue selects/inserts/updates. Contrasta [modelos](../03-referencia/modelos-de-datos.md). No afirmes constraints, RLS, triggers o tipos que el repositorio no contiene.

## Seguir una operación completa

Usa esta cadena:

```text
page/layout → component/store → lib/api → route → middleware
→ controller → service/util → Supabase table/storage → Realtime/refetch
```

Anota también errores, rollback, auditoría y rutas alternativas.

## Preparar un cambio futuro

Determina primero si es implementación de requisito, resolución de discrepancia o propuesta. Las decisiones abiertas de [pendientes](../07-auditoria/pendientes.md) requieren autoridad del producto. Un cambio de arquitectura significativo debe actualizar o crear un ADR.

## Validar que no contradice decisiones

Revisa [ADR](../06-decisiones/README.md), reglas, roles y matriz. Ejecuta las verificaciones aplicables y examina el diff. No uses planes de `docs/superpowers/` como prueba de que un paso se completó; comprueba el código.

## Fuentes con distinta autoridad

1. Requerimiento aprobado/decisión explícita: define lo que debería ocurrir.
2. Código y pruebas: definen lo que puede comprobarse localmente.
3. Plan/contexto fechado: expresa intención, no finalización.
4. Comentarios, nombres y UI: pistas que requieren confirmación.
