# ADR-002 — API como frontera de datos, salvo Realtime

- **Estado:** aceptada; cumplimiento parcial
- **Revisión:** 2026-10-23

## Contexto

El backend usa credenciales privilegiadas de Supabase y concentra validaciones. El contexto administrativo reciente explicita que toda operación Supabase debe pasar por la API, con excepción de suscripciones Realtime.

## Decisión

Las lecturas y mutaciones de negocio se realizan a través de `apps/api`. `apps/web` puede conectarse directamente a Supabase únicamente para escuchar cambios Realtime y luego volver a consultar la API.

## Alternativas conocidas

No se documentó una evaluación formal. El acceso directo completo desde el navegador sería una alternativa técnica, pero no fue adoptada como regla del proyecto.

## Consecuencias

- La API es responsable de autorización y aislamiento incluso si existe RLS.
- La service-role nunca debe exponerse al cliente.
- Realtime requiere políticas y JWT correctos; no están versionados.
- Duplicar consultas Supabase en el frontend rompería el límite establecido.

## Evidencia

`apps/api/src/lib/supabase.ts`, `apps/web/lib/supabase.ts`, componentes de feed/chat y el contexto general migrado.
