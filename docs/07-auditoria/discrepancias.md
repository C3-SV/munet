# Discrepancias y riesgos

## D-01 — Autorización administrativa no acotada al evento

- **Historia:** todo dato y permiso se aísla por evento.
- **Código:** `requireAdmin` acepta cualquier membresía administrativa activa; los POST reciben `event_id` sin vincularlo a esa membresía.
- **Clasificación:** divergente.
- **Impacto:** un administrador de A podría crear recursos en B si conoce el identificador.
- **Pregunta:** ¿existe un superadministrador global o debe separarse creación global de administración por evento?

## D-02 — Ciclo del evento

- **Historia:** `DRAFT → ACTIVE → CLOSED`; cerrado es solo lectura.
- **Código:** creación directa en `ACTIVE`; la UI permite cambiar `status` por `PATCH`, pero no hay guardas generales de escritura.
- **Clasificación:** divergente/parcial.
- **Impacto:** no puede prepararse un evento en borrador ni congelarlo confiablemente.

## D-03 — Credenciales en logs del navegador

- **Historia:** seguridad y protección de datos.
- **Código:** los logs de payload y respuesta fueron retirados de `apps/web/lib/api/auth.ts` (2026-10-26).
- **Clasificación:** resuelto.
- **Impacto:** ninguno vigente; evitar reintroducir trazas con credenciales.

## D-04 — Auditoría no garantizada

- **Historia:** acciones críticas y moderación deben ser auditables.
- **Código:** loggers absorben errores y no existe consulta.
- **Clasificación:** parcialmente implementado/divergente.
- **Impacto:** una acción puede completarse sin evidencia.

## D-05 — Esquema y RLS ausentes

- **Historia:** aislamiento, integridad y seguridad en profundidad.
- **Repositorio:** no incluye migraciones ni políticas; API usa service role.
- **Clasificación:** pendiente de verificación.
- **Impacto:** no se puede reproducir ni auditar la capa de datos.

## D-06 — Alcance reciente frente a requisitos históricos

- **Historia:** reportes y notificaciones internas son REQ-20/REQ-22.
- **Plan reciente:** `munet-context-general.md` los pone fuera del incremento inmediato.
- **Clasificación:** divergencia de planificación, no descontinuación demostrada.
- **Impacto:** riesgo de borrar requisitos por confundir “no ahora” con “nunca”.

## D-07 — Panel visible frente a funcionalidad operativa

- **UI:** menú muestra eventos, participantes, asignaciones y moderación.
- **Código:** eventos y comités tienen listado, alta y edición; participantes, asignaciones y moderación son marcadores.
- **Clasificación:** parcialmente implementado.
- **Impacto:** las secciones futuras no ofrecen operaciones reales.

## D-08 — Escrituras compuestas sin transacción

- **Historia:** consistencia y trazabilidad.
- **Código:** encuestas, cuentas y otras altas hacen escrituras secuenciales/rollback manual.
- **Clasificación:** divergente respecto a calidad esperada.
- **Impacto:** estados parciales ante fallos o concurrencia.

## D-09 — Referencias de borrado inconsistentes

- **Código:** `deleted_by_membership_id` recibe valores de categoría como `AUTHOR`/`ADMIN`; DM prueba estados configurables.
- **Clasificación:** pendiente de verificación/divergente semántico.
- **Impacto:** incompatibilidad con columnas/enums y pérdida de atribución precisa.

## D-10 — Pipeline incompleto

- **Configuración:** Turbo define build/lint/typecheck.
- **API:** solo expone `dev`.
- **Clasificación:** implementado distinto a expectativa de calidad.
- **Impacto:** los comandos del root pueden pasar sin revisar backend.

## D-11 — Realtime sin evidencia de autorización uniforme

- **Código:** chat establece token Realtime; feed/comentarios no explícitamente.
- **Datos:** RLS no está versionado.
- **Clasificación:** pendiente de verificación.
- **Impacto:** eventos no recibidos o exposición según configuración externa.

## D-12 — Documentación previa sobreafirmaba madurez

El README y documento técnico previos describían módulos como sistema integrado sin separar intención, código y producción. Esta reconstrucción los reemplaza por estados y evidencia explícitos.

## D-13 — Versión de Node declarada incompatible

- **Root:** `engines.node` declara `>=18`.
- **Dependencia:** Next.js 16.1.5 exige `>=20.9.0` en `package-lock.json`.
- **Clasificación:** configuración divergente.
- **Impacto:** una instalación que cumpla solo el requisito del root puede fallar.
