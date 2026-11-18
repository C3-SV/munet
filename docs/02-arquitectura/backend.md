# Arquitectura del backend

## Tecnología y entrada

`apps/api` usa Express 5, TypeScript, Supabase JS, `bcrypt` y `dotenv`. `src/server.ts` configura CORS, JSON y routers bajo `/auth`, `/events`, `/posts`, `/profiles`, `/dm` y `/admin`.

## Organización

- `routes/`: método y middleware base.
- `controllers/`: validación manual, autorización contextual y orquestación.
- `services/`: consultas de posts, comentarios, muros, autenticación y DM, además de alta y búsqueda de participantes.
- `middleware/auth.middleware.ts`: token, contexto y helpers de autorización.
- `utils/`: RBAC, reglas de muro, auditoría y utilidades de dominio.
- `lib/supabase.ts`: clientes de Supabase.

## Autenticación

`requireAuth` valida el JWT con Supabase, busca el usuario interno y carga membresías `ACTIVE`. El contexto queda en `req.auth`. Los routers requieren autenticación, salvo búsqueda por código, activación y login.

## Autorización

La autorización fina está mayormente dentro de controladores y servicios. Los helpers `requireEventMembership` y `requireRole` existen, pero no están montados en las rutas revisadas. `requireEventAdmin` exige una membresía administrativa activa del evento objetivo. La colección de eventos usa `requireAdmin` y el controlador del listado acota los resultados. Véase [autenticación](../03-referencia/autenticacion.md).

## Persistencia

La API opera con service role y, para autenticación, con cliente anon. Los controladores y servicios comprueban permisos de aplicación. Varias altas compuestas usan escrituras secuenciales y compensaciones manuales. La asignación de código de delegación tiene una RPC de base definida en la migración 002.

## Validación y errores

Las validaciones son manuales; no hay biblioteca de schemas ni contrato OpenAPI. Los controladores responden JSON con códigos HTTP, pero los formatos de error no están centralizados. No hay rate limiting, request IDs o capa global de observabilidad.

## Auditoría

`utils/audit.logger.ts` y `utils/auth.logger.ts` intentan insertar registros, pero absorben fallos. Es apropiado describirlo como auditoría best-effort, no como garantía. Tampoco existe endpoint para consultar el registro.

## Cobertura del pipeline

La API ofrece `dev`, `build`, `check-types` y `test`. Build y tipos ejecutan `tsc --noEmit`. Las pruebas se ejecutan desde el workspace. Falta un script de lint para la API. Véase [pruebas y validación](../04-desarrollo/pruebas-y-validacion.md).
