# Estado actual auditado

- **Fecha:** 2026-10-23
- **Commit base:** `0a42cb5`
- **Alcance:** inspección estática del repositorio local y pruebas unitarias independientes disponibles
- **Fuera de alcance:** producción, datos reales, Supabase desplegado y servicios de hosting

## Resumen ejecutivo

MUNET es un MVP parcial con flujos participantes utilizables a nivel de código: acceso, contexto multi-evento, muros, publicaciones/encuestas, comentarios, perfiles y mensajes directos. La nueva rama añade la base visual del panel administrativo y conecta la creación de eventos y comités. La administración de participantes, asignaciones, moderación y edición/listado de eventos continúa incompleta.

La arquitectura separa web y API, pero su seguridad depende especialmente del backend porque opera Supabase con service role. No es posible verificar integridad, RLS ni compatibilidad del despliegue: el esquema no está versionado.

## Inventario real

| Componente | Tecnología | Responsabilidad | Evaluación |
|---|---|---|---|
| `apps/web` | Next.js 16, React 19, Zustand, Supabase JS, Tailwind | Cliente participante y panel admin inicial | Activo, parcial |
| `apps/api` | Express 5, TypeScript, Supabase JS, bcrypt | API y persistencia/autorización | Activo, parcial |
| `apps/docs` | Next.js | Plantilla generada | No contiene documentación MUNET |
| `packages/ui` | React | Componentes de ejemplo | Uso productivo limitado/no observado |
| `packages/*-config` | ESLint/TypeScript | Configuración compartida | Activo |
| `docs` | Markdown | Fuente documental | Consolidada por esta auditoría |

## Funcionalidad comprobada

- Autenticación/activación y contexto de membresías.
- Selector de evento y navegación por muros.
- Posts de texto/encuesta, comentarios, votos y cierre.
- Perfiles y avatares.
- DM uno a uno.
- API de altas de evento, comité, membresía y cuenta.
- UI administrativa base; altas visuales de evento/comité.

Todos tienen limitaciones descritas en [funcionalidades](../01-producto/funcionalidades.md).

## Hallazgos críticos

1. `apps/web/lib/api/auth.ts` registra payloads que pueden contener contraseña.
2. `requireAdmin` no limita las mutaciones al evento donde el usuario es admin.
3. No hay esquema/migraciones/RLS versionados y el backend usa service role.
4. Auditoría y registros de acceso fallan silenciosamente.
5. Operaciones compuestas no son transaccionales.
6. El estado del evento no impone solo lectura; los eventos se crean `ACTIVE`.
7. La API no participa en build/lint/typecheck de Turbo.
8. El root permite Node 18, pero Next.js 16.1.5 requiere Node 20.9 o superior.

## Base administrativa incorporada

La rama fusionada aporta rutas, layout y componentes admin, el cliente `lib/api/admin.ts`, dos formularios conectados y protección `requireAdmin`. No aporta contratos GET/PATCH de eventos ni páginas para participantes, asignaciones o moderación. Los documentos `docs/superpowers/` describen la decisión de autorización, pero sus casillas sin marcar no son evidencia fiable de ejecución; el código sí lo es.

## Madurez de verificación

Solo hay dos pruebas Node de utilidades de CORS y URL base. No se hallaron pruebas de dominio, integración o autorización. Sin dependencias instaladas y sin entorno Supabase aislado no se ejecutaron builds ni flujos end-to-end durante la auditoría.

## Conclusión

El repositorio ofrece una base funcional significativa, pero no un sistema integral terminado. Antes de ampliar funcionalidad conviene resolver el modelo administrativo global/evento, versionar datos/RLS, eliminar logs sensibles y hacer que la API participe en el pipeline de calidad. Estas son recomendaciones documentales; esta auditoría no modifica la aplicación.
