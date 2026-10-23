# ADR-001 — Monorepo con aplicaciones separadas

- **Estado:** aceptada e implementada
- **Revisión:** 2026-10-23

## Contexto

MUNET reúne frontend, API, una aplicación docs generada y configuración compartida. `package.json` declara workspaces `apps/*` y `packages/*`; Turbo coordina tareas.

## Decisión

Mantener aplicaciones desplegables separadas dentro de un monorepo:

- `apps/web` para experiencia participante y administrativa;
- `apps/api` para reglas, autorización y persistencia;
- `apps/docs` como aplicación independiente, aunque hoy no contiene la documentación oficial;
- `packages/*` para configuración y piezas reutilizables.

## Justificación conocida

La arquitectura está materializada y los documentos históricos la describen. No se encontró una comparación histórica formal con repositorios separados o un monolito, por lo que no se atribuyen razones adicionales.

## Consecuencias

- Cambios transversales pueden coordinarse en un solo repositorio.
- Turbo solo ejecuta tareas que cada workspace declare; la API queda fuera de build/lint/typecheck actuales.
- Los contratos entre web/API no se comparten automáticamente.
- `apps/docs` y `docs/` tienen propósitos distintos y pueden confundirse.

## Evidencia

`package.json`, `turbo.json`, `apps/*`, `packages/*`.
