# Despliegue y configuración

## Estado verificable

El repositorio no contiene workflows CI, Dockerfiles, manifiestos, Terraform, configuración de Supabase CLI ni scripts de despliegue. Por ello no existe un procedimiento reproducible y versionado de despliegue.

El contexto recién incorporado reporta frontend en Vercel, colaboración MUN ESEN/C3 y uso de `main` para producción. No se consultó Vercel, Supabase ni ningún servicio productivo; esos datos no están verificados.

## Componentes a desplegar

- `apps/web`: aplicación Next.js; necesita URL de API y variables públicas de Supabase.
- `apps/api`: servidor Node/Express que necesita claves de Supabase, origen web y configuración de Storage.
- Supabase: Auth, Postgres, Realtime y Storage. Hay un snapshot y migraciones incrementales. Falta una base reproducible y verificar la configuración del entorno.
- `apps/docs`: plantilla sin documentación oficial; no debe confundirse con un portal operativo.

## Configuración sensible

Los nombres están en [configuración local](../04-desarrollo/configuracion-local.md). Secretos deben almacenarse en el gestor del proveedor, con separación por entorno y rotación. Nunca usar `SUPABASE_SERVICE_ROLE_KEY` en el cliente.

## Comprobaciones previas necesarias

1. Build/typecheck/lint y pruebas aplicables.
2. Esquema y RLS compatibles con la versión de la aplicación.
3. CORS limitado al origen correcto.
4. Variables por entorno y buckets existentes.
5. Pruebas negativas de autorización por evento.
6. Plan de reversión, respaldo y observabilidad.

## Pendientes operativos

- Definir CI/CD y responsables de promoción.
- Completar el versionado del esquema base, las políticas y la configuración del entorno.
- Definir health check, logs, métricas, alertas y retención.
- Acordar backup, RTO/RPO y recuperación.
- Documentar dominios, regiones y ambientes sin exponer secretos.
