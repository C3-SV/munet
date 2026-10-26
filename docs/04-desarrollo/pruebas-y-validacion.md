# Pruebas y validación

## Estado del repositorio

Solo se encontraron dos pruebas independientes:

- `apps/api/src/lib/cors.test.mjs`
- `apps/web/lib/api/base-url.test.mjs`

Pueden ejecutarse con:

```bash
node --test apps/api/src/lib/cors.test.mjs apps/web/lib/api/base-url.test.mjs
```

No hay script `test` en el root ni en los workspaces.

## Scripts disponibles

| Comando | Alcance real |
|---|---|
| `npm run build` | Workspaces que definen `build`; web/docs, no API |
| `npm run lint` | Workspaces que definen `lint`; web/docs/configs, no API |
| `npm run check-types` | Workspaces que definen `check-types`; web/docs, no API |
| `npm run format` | Escribe archivos; no usar como comprobación de solo lectura |

No presentes un `turbo run` exitoso como validación de la API mientras `apps/api/package.json` carezca de esos scripts.

## Verificación mínima por tipo de cambio

- Documentación: enlaces relativos, `git diff --check`, búsqueda de secretos y revisión de diff.
- Frontend: lint, typecheck, build y recorrido manual de estados relevantes.
- API: compilación TypeScript explícita, pruebas unitarias/integración y casos negativos de autorización.
- Datos: validar migración y RLS en entorno aislado; nunca producción por defecto.

## Casos críticos faltantes

- Autorización cruzada entre eventos.
- Roles administrativos y cuentas inactivas.
- Activación/login sin fuga de secretos.
- Restricciones de muros y anuncios.
- Voto concurrente y creación transaccional de encuestas.
- Duplicación concurrente de conversaciones.
- Borrado y auditoría.
- Flujos admin de eventos/comités y sus estados de error, vacío y permiso.

## Evidencia de entrega

Registra comandos exactos, código de salida y limitaciones. Un test no ejecutado debe declararse como tal; no se infiere éxito por inspección.
