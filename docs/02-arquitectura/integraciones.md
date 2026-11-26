# Integraciones

## Supabase

MUNET usa Supabase para:

- validación de JWT y autenticación;
- Postgres a través de Supabase JS;
- Realtime en feed, comentarios y chat;
- Storage público para avatares.

El backend usa `SUPABASE_SERVICE_ROLE_KEY`, por lo que esa variable nunca debe llegar al navegador. El frontend solo utiliza las variables públicas y el token de usuario.

## Cloudflare R2 (decidido, no implementado)

[ADR-006](../06-decisiones/ADR-006-adjuntos-en-r2-con-url-firmada.md) adopta R2 como almacenamiento privado de adjuntos de publicaciones, detrás de una interfaz de almacenamiento compatible con S3 que permite cambiar de proveedor. La API autoriza y emite URLs firmadas de corta vida; el navegador sube y descarga los archivos directamente con ellas. Credenciales solo en el servidor. Los avatares siguen en Supabase Storage. Plan: [plan-adjuntos-r2.md](../04-desarrollo/plan-adjuntos-r2.md).

## CDN de iconos

El panel administrativo y otros elementos cargan SVG de Tabler Icons desde `cdn.jsdelivr.net`. Esto crea una dependencia de red y de disponibilidad externa no descrita en los requisitos históricos.

## Despliegue reportado, no comprobado

`munet-context-general.md` afirma que el frontend se despliega en Vercel y que `main` representa producción, dentro de una colaboración MUN ESEN/C3. El repositorio no contiene configuración suficiente ni se consultaron plataformas externas; se conserva como contexto reportado, no como hecho verificado.

## Integraciones ausentes

Storage solo se usa para avatares (bucket público `profile-images`, verificado el 20 de noviembre de 2026 con una consulta de solo lectura). No hay evidencia de correo transaccional, SMS/push, almacenamiento de adjuntos de publicaciones (no existe bucket privado), analítica, monitoreo o servicios de moderación automática.

El CSV se procesa en la API sin un servicio de terceros. Consulta [el contrato CSV](../03-referencia/api.md#contrato-csv).

## Reglas de integración

- Operaciones de negocio y datos: vía `apps/api`.
- Realtime: acceso directo desde `apps/web`, sujeto a JWT y RLS.
- Bytes de adjuntos (cuando se implemente ADR-006): directos entre `apps/web` y R2 mediante URL firmadas emitidas por la API.
- Secretos: solo servidor/entorno, nunca Markdown ni código cliente.
- Cualquier nueva integración debe documentar propietario, datos transferidos, autenticación, fallos y estrategia de prueba.
