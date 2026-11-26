# ADR-006 — Adjuntos de publicaciones en Cloudflare R2 con URL firmada

- **Estado:** aceptada; no implementada
- **Fecha de la decisión:** 2026-11-20
- **Relacionada con:** [ADR-002](ADR-002-api-como-frontera-de-datos.md) (la amplía con una excepción), RN-11, RN-12 y REQ-16
- **Plan:** [plan-adjuntos-r2.md](../04-desarrollo/plan-adjuntos-r2.md)

## Contexto

RN-11 admite cero o un adjunto por post (JPG o PNG hasta 5 MB, PDF hasta 20 MB). La interfaz existe, pero no hay API ni bucket privado: el único bucket es `profile-images` (público, avatares). La API se despliega en Vercel, donde el cuerpo de una petición tiene un tope de unos 4,5 MB, y el servidor acepta JSON de hasta 10 MB; un PDF de 20 MB no puede pasar por la API. El plan gratuito de Supabase Storage ofrece 1 GB; el de Cloudflare R2 ofrece 10 GB y no cobra descargas.

## Decisión

1. **Proveedor inicial: Cloudflare R2 (clase Standard), en un bucket privado**, sin acceso público, sin dominio personalizado y sin Workers.
2. **Abstracción del proveedor.** La lógica de negocio depende de una interfaz `FileStorage` en `apps/api/src/lib/storage/`. El adaptador inicial usa el SDK S3 de AWS v3. La configuración usa variables `STORAGE_*` sin nombre de proveedor. Cambiar a Backblaze B2, AWS S3 u otro servicio compatible con S3 es cambiar de adaptador o de variables.
3. **Subida directa con URL firmada.** La API autoriza e inicia el intento y devuelve una URL firmada de `PUT` de 5 minutos; el navegador sube el archivo a R2; la API verifica el objeto y lo asocia al post al crearlo. Los bytes del archivo no pasan por la API.
4. **Descarga a demanda.** La API genera una URL firmada de `GET` de 60 segundos solo cuando la persona la pide, tras comprobar membresía, acceso al muro y estado del post.
5. **Autorización siempre en la API.** El navegador nunca recibe credenciales de R2, solo URLs firmadas de corta vida.
6. **Consistencia.** Cada intento de subida se registra en `attachment_uploads` (un solo uso, vencimiento, límites por membresía). El orden de operaciones evita referencias a objetos inexistentes; los residuos son objetos huérfanos que limpian una regla de ciclo de vida y un script de conciliación. No hay transacciones distribuidas.
7. **Un adjunto por post garantizado en la base** con un índice único sobre `attachments(post_id)`, además de la validación de la API.
8. **Retención.** Los adjuntos de posts eliminados se conservan 30 días y luego se eliminan físicamente, salvo `retention_hold` por auditoría o moderación.
9. **Formatos.** JPG, PNG y PDF. No se admite WebP (solo aplica a avatares).
10. **Moderación.** Administradores y moderadores del evento pueden retirar un adjunto con motivo, sin borrar el post.

## Excepción a ADR-002

ADR-002 deja Realtime como única comunicación directa del navegador con un servicio externo. Esta decisión añade una segunda: los bytes de los adjuntos viajan del navegador a R2 y de R2 al navegador mediante URL firmadas emitidas por la API. Los metadatos, los permisos y las eliminaciones siguen pasando por la API.

## Alternativas descartadas

- **Supabase Storage.** Ya integrado y suficiente para el volumen previsto, pero con 1 GB gratuito, 5 GB de descarga y pausa de proyectos inactivos en el plan gratuito. Se prefirió R2 por el margen de almacenamiento y las descargas sin costo.
- **Subida a través de la API** (cuerpo binario o base64). Descartada por el tope de cuerpo de Vercel y porque encarece la API.
- **UploadThing u otro intermediario.** Añade un modelo de permisos propio que choca con la regla de que la API controle toda la autorización.
- **Transacción distribuida o cola de trabajos** para el alta del post y el archivo. Se descartó por complejidad desproporcionada; el orden de operaciones y la compensación cubren los fallos.

## Consecuencias

- Una cuenta y una facturación nuevas en Cloudflare. R2 puede requerir método de pago aunque se use el nivel gratuito; si el pago falla, los buckets quedan inaccesibles. No está confirmado.
- Nueva migración `003_adjuntos_un_por_post.sql`, para una base compartida y de producción: requiere revisión y autorización expresa antes de aplicarse.
- Nuevas variables de entorno de servidor (`STORAGE_*`), que nunca llegan al navegador.
- Hay que configurar CORS en el bucket para el origen de la web.
- Riesgos por comprobar contra R2 real: firma de `Content-Length` en el `PUT` y sumas de verificación por defecto del SDK de AWS.
- Los avatares siguen en Supabase Storage; no se migran.

## Evidencia

Documentación de Cloudflare R2 consultada el 20 de noviembre de 2026: URL firmadas, tokens con alcance por bucket, CORS, límites y precios. Estado del repositorio y de la base real comprobado con consultas de solo lectura el mismo día.

## Actualización del 26 de noviembre de 2026 (mejora 10 de «Mejoras y correcciones»)

Se amplía la decisión sin cambiar la arquitectura (R2 privado, subida directa con URL firmada, descarga a demanda):

- **Cantidad y tamaño.** Hasta 10 imágenes JPG/PNG de 15 MB y hasta 2 PDF de 30 MB por publicación, combinables. Sustituye al punto 7 («un adjunto por post»): la migración `007_adjuntos_multiples.sql` quita el índice único `uq_attachments_post` y agrega `attachments.position`. Las cantidades las valida la API.
- **Un intento por archivo.** Cada archivo conserva su propio intento y URL firmada; `POST /posts` recibe `upload_ids`, los reclama a la vez y, si uno falla, compensa todos.
- **Cuota.** `STORAGE_QUOTA_BYTES` (opcional) activa la protección acordada: alerta en los registros al 90 % y rechazo de cargas nuevas al 95 %, medido con los adjuntos guardados más los intentos vigentes.
- **Imágenes.** Se evaluó optimizarlas en el navegador antes de subir. No se hizo: la subida ya es directa (no pasa por el servidor de aplicación) y recomprimir cambia los bytes declarados y puede degradar los PNG. Queda como mejora futura si el consumo de almacenamiento lo exige.
- **Pendiente de definir.** Un tope total de tamaño por publicación: hoy es el máximo teórico (210 MB).
