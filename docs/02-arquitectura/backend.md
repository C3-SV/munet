# Arquitectura del backend

## Tecnología y entrada

`apps/api` usa Express 5, TypeScript, Supabase JS, `bcrypt` y `dotenv`. `src/server.ts` configura CORS, JSON y routers bajo `/auth`, `/events`, `/posts`, `/profiles`, `/dm` y `/admin`.

## Organización

- `routes/`: método y middleware base.
- `controllers/`: validación manual, autorización contextual y orquestación.
- `services/`: consultas de posts, comentarios, muros, autenticación y DM.
- `middleware/auth.middleware.ts`: token, contexto y helpers de autorización.
- `utils/`: RBAC, reglas de muro, auditoría y utilidades de dominio.
- `lib/supabase.ts`: clientes de Supabase.

## Autenticación

`requireAuth` valida el JWT con Supabase, busca el usuario interno y carga membresías `ACTIVE`. El contexto queda en `req.auth`. Los routers requieren autenticación, salvo búsqueda por código, activación y login.

## Autorización

La autorización fina está mayormente dentro de controladores y servicios. Los helpers `requireEventMembership` y `requireRole` existen, pero no están montados en las rutas revisadas. `requireAdmin` comprueba una membresía administrativa activa en cualquier evento y protege los cuatro endpoints administrativos.

## Persistencia

La API opera con service role y, para autenticación, con cliente anon. Esto hace que la seguridad dependa del código del servidor además de cualquier política de base no disponible. No se observaron transacciones; varios flujos aplican escrituras secuenciales y compensaciones manuales.

## Validación y errores

Las validaciones son manuales; no hay biblioteca de schemas ni contrato OpenAPI. Los controladores responden JSON con códigos HTTP, pero los formatos de error no están centralizados. No hay rate limiting, request IDs o capa global de observabilidad.

## Auditoría

`utils/audit.logger.ts` y `utils/auth.logger.ts` intentan insertar registros, pero absorben fallos. Es apropiado describirlo como auditoría best-effort, no como garantía. Tampoco existe endpoint para consultar el registro.

## Cobertura del pipeline

`apps/api/package.json` solo define `dev`. Por tanto, `npm run build`, `lint` y `check-types` del root no validan la API a través de Turbo. Existe una prueba Node de CORS, pero no un script `test` de paquete.
