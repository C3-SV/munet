# Arquitectura general

## Vista de contexto

```mermaid
flowchart LR
  U[Usuario] --> W[apps/web\nNext.js]
  W -->|HTTP Bearer JWT| A[apps/api\nExpress]
  A -->|service role / anon client| S[(Supabase\nAuth + Postgres + Storage)]
  W -.->|Realtime únicamente| S
  W --> C[CDN de iconos]
```

El monorepo usa npm workspaces y Turborepo. `apps/web` y `apps/docs` son aplicaciones Next.js; `apps/api` es un proceso Express TypeScript. Los paquetes compartidos contienen configuración y componentes de ejemplo.

## Flujo de una operación

```mermaid
sequenceDiagram
  actor Usuario
  participant Web as apps/web
  participant API as apps/api
  participant DB as Supabase
  Usuario->>Web: acción
  Web->>API: solicitud + Authorization Bearer
  API->>DB: valida JWT y obtiene contexto
  DB-->>API: usuario y membresías activas
  API->>DB: consulta o mutación autorizada
  DB-->>API: resultado
  API-->>Web: JSON
```

La API usa una clave privilegiada para datos; por eso la autorización de aplicación es crítica. El navegador crea además un cliente Supabase para Realtime y establece el token explícitamente solo en chat, no en feed/comentarios.

## Límites comprobados

- Hay un snapshot parcial y dos migraciones incrementales. La base reproducible y las políticas completas quedan pendientes. Véase [base de datos](base-de-datos.md).
- No hay configuración de CI/CD o infraestructura versionada.
- `apps/docs` sigue siendo una plantilla y no sirve estos Markdown.
- Los contratos son tipos y controladores TypeScript, sin OpenAPI.
- Las escrituras compuestas no usan transacciones visibles en el repositorio.

## Dependencias entre módulos

- `apps/web/app` depende de componentes, `stores/auth.store.ts` y clientes de `lib/api`.
- `apps/web/lib/api` encapsula HTTP hacia la API; `lib/supabase.ts` se reserva para Realtime.
- `apps/api/src/server.ts` monta routers. Los controladores usan servicios de autenticación, cuentas, búsqueda, posts, comentarios, muros y chat.
- `apps/api/src/lib/supabase.ts` expone clientes anon y service-role.
- `packages/ui` no es el sistema de componentes principal de la interfaz revisada.

## Riesgos arquitectónicos

1. La correspondencia del esquema efectivo con el SQL versionado está pendiente de comprobar.
2. El service role elude RLS; un error de autorización del backend puede cruzar eventos.
3. El frontend y backend no comparten tipos de contrato.
4. Turborepo incluye build y tipos de la API. Lint de API y test general quedan pendientes.
5. Las rutas administrativas con evento objetivo validan una membresía administrativa de ese evento. Consulta [autorización](../03-referencia/autenticacion.md).

Las decisiones que sí tienen evidencia se registran en [ADR](../06-decisiones/README.md).
