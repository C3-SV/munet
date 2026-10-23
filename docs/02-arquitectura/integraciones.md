# Integraciones

## Supabase

MUNET usa Supabase para:

- validación de JWT y autenticación;
- Postgres a través de Supabase JS;
- Realtime en feed, comentarios y chat;
- Storage público para avatares.

El backend usa `SUPABASE_SERVICE_ROLE_KEY`, por lo que esa variable nunca debe llegar al navegador. El frontend solo utiliza las variables públicas y el token de usuario.

## CDN de iconos

El panel administrativo y otros elementos cargan SVG de Tabler Icons desde `cdn.jsdelivr.net`. Esto crea una dependencia de red y de disponibilidad externa no descrita en los requisitos históricos.

## Despliegue reportado, no comprobado

`munet-context-general.md` afirma que el frontend se despliega en Vercel y que `main` representa producción, dentro de una colaboración MUN ESEN/C3. El repositorio no contiene configuración suficiente ni se consultaron plataformas externas; se conserva como contexto reportado, no como hecho verificado.

## Integraciones ausentes

No hay evidencia de correo transaccional, SMS/push, almacenamiento de adjuntos de publicaciones, analítica, monitoreo, importación CSV o servicios de moderación automática.

## Reglas de integración

- Operaciones de negocio y datos: vía `apps/api`.
- Realtime: acceso directo desde `apps/web`, sujeto a JWT y RLS.
- Secretos: solo servidor/entorno, nunca Markdown ni código cliente.
- Cualquier nueva integración debe documentar propietario, datos transferidos, autenticación, fallos y estrategia de prueba.
