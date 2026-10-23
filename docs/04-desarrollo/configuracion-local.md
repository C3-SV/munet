# Configuración local

## Requisitos

- Node.js 20.9 o superior para satisfacer Next.js 16.1.5 (`package-lock.json`). El root declara `>=18`, una incompatibilidad documental/configurativa pendiente.
- npm 11.6.2 recomendado por `packageManager`.
- Un proyecto Supabase compatible con el esquema esperado; el esquema no está incluido.

## Instalación y ejecución

```bash
npm install
npm run dev
```

Turbo inicia las aplicaciones que exponen `dev`: web en puerto 3000, API en 3002 y la plantilla docs según Next.js. Si solo se necesita una aplicación, puede ejecutarse desde su workspace.

## Variables de la API

Basadas en `apps/api/.env.example` y usos del código:

| Variable | Propósito |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Operaciones de autenticación con privilegio público |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso privilegiado del backend; secreto crítico |
| `SUPABASE_PROFILE_IMAGES_BUCKET` | Bucket de avatares; el código tiene valor predeterminado |
| `PORT` | Puerto HTTP, predeterminado 3002 |
| `WEB_APP_URL` | Origen permitido por CORS |
| `DM_DELETED_MESSAGE_STATUS` | Enum usado al borrar mensajes |

`ALLOW_DEMO_POSTS` y `DEFAULT_POST_AUTHOR_MEMBERSHIP_ID` aparecen en el ejemplo, pero no tienen uso encontrado en el código actual: son configuración obsoleta.

## Variables del frontend

| Variable | Propósito |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base de la API; la utilidad define fallback local |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase público para Realtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública para Realtime |

No hay `.env.example` versionado en `apps/web`; esta lista proviene del código. Nunca introduzcas la service-role como variable `NEXT_PUBLIC_*`.

## Limitación importante

Una instalación limpia no puede reconstruir la base solo desde el repositorio. Se necesita el esquema externo compatible. No ejecutes migraciones ni apuntes a producción para “probar” la configuración.
