# Plan: adjuntos de publicaciones con Cloudflare R2

Estado: aprobado el 20 de noviembre de 2026; sin implementar. Decisión registrada en [ADR-006](../06-decisiones/ADR-006-adjuntos-en-r2-con-url-firmada.md). Cubre el pendiente 7 de [`PENDIENTES.md`](../PENDIENTES.md) (sección 3). Reglas vigentes: RN-11 y REQ-16 (cero o un adjunto por post; JPG/PNG ≤ 5 MB o PDF ≤ 20 MB; permisos heredados del post; retiro auditable).

## 1. Qué existe hoy (verificado)

| Pieza | Estado |
|---|---|
| Tabla `attachments` (migración 001) | 0 filas. `event_id`, `post_id`, `uploaded_by_membership_id`, `storage_path`, `file_name`, `mime_type`, `size_bytes`. RLS activo sin políticas: solo la API (service role). |
| API (`apps/api`, Express 5 + TS) | `server.ts` registra `express.json({ limit: '10mb' })`. Rutas de posts en `routes/posts.routes.ts`; lógica en `services/posts.service.ts` (`createPostService`, `getPostsByWall`, `deletePostService`). Ya hace rollback manual (borra el post si falla la encuesta). |
| Autorización | `requireAuth` carga `req.auth.memberships`; cada controlador resuelve la membresía con `x-event-id`. El acceso al muro sale de `mapWallForMembership` (`canAccess`, `canPublish`). Borrado: autor o `isAdminRole`. |
| Auditoría | `logAudit` con `AuditActionType` y `AuditEntityType` (hay `UPLOAD_AVATAR`; no hay tipos de adjunto). |
| Límites | `express-rate-limit` en memoria (`createPostLimiter`). En serverless el contador es por instancia, así que no sirve como límite duro (ver Q02). |
| Storage actual | Solo avatares en Supabase (`profile-images`, público), en base64 por la API. **No se migran.** |
| Web | `lib/attachments.ts` valida tipo y tamaño; `PostEditor` elige el archivo; `PostCard` pinta `post.attachment`. `ATTACHMENTS_BACKEND_READY = false`. |
| Pruebas | `node --test` sobre `*.test.cjs` y `*.test.mjs`, con dobles de Supabase. |

## 2. Decisiones de diseño

1. **El navegador sube directo a R2 con URL firmada; la API no recibe los bytes.** `server.ts` indica que la API corre detrás de Vercel. La persona dueña del proyecto confirmó el 20 de noviembre de 2026 que la API está en Vercel, donde el cuerpo de una petición tiene un tope de unos 4,5 MB; un PDF de 20 MB no pasaría. La API conserva toda la autorización.
2. **Abstracción del proveedor.** `apps/api/src/lib/storage/` con la interfaz `FileStorage` (`presignUpload`, `presignDownload`, `head`, `readRange`, `copy`, `delete`) y un adaptador S3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`). Variables sin nombre de proveedor: `STORAGE_ENDPOINT`, `STORAGE_REGION` (`auto`), `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`. La lógica de posts solo conoce la interfaz. Sin Workers ni dominio personalizado (las URLs firmadas no funcionan con ellos).
3. **Excepción nueva a la arquitectura:** los bytes van del navegador a R2 con URL firmada de corta vida, sin credenciales. Se documenta en un ADR.

### 2.1 Subidas pendientes: una intención de subida por intento

Una URL firmada es un token de portador y se puede reutilizar hasta que vence. Para que el flujo sea consistente, cada intento tiene identidad y estado en la base de datos.

Tabla nueva `attachment_uploads` (migración 003, RLS activo y sin políticas, como `attachments`):

| Columna | Uso |
|---|---|
| `id` uuid | Identificador del intento; forma parte de la clave del objeto. |
| `event_id`, `membership_id` | Dueño del intento. |
| `wall_id` | Muro para el que se autorizó. |
| `storage_key` | `pending/{event_id}/{id}`. |
| `file_name`, `mime_type`, `size_bytes` | Lo declarado al iniciar; se compara con lo subido. |
| `expires_at` | 15 minutos tras el inicio. La URL firmada dura 5. |
| `consumed_at`, `post_id` | Se llenan al confirmar. `post_id` permite responder igual a un reintento. |

Reglas del backend:

- **Inicio** (`POST /posts/attachments/init`): valida membresía, `canPublish` del muro, tipo y tamaño. Rechaza con 429 si la membresía tiene 3 intentos sin consumir y vigentes, o más de 20 intentos en la última hora. Los límites salen de la tabla, así que valen en serverless. Se mantiene además el limitador existente como primera barrera.
- **Verificación antes de asociar:** `HEAD` (tamaño y tipo declarado coinciden y están dentro del límite) y lectura de los primeros bytes (firma JPEG, PNG o `%PDF`).
- **Un solo uso:** la confirmación reclama el intento con una actualización atómica (`consumed_at is null and expires_at > now()` con `returning`). Si no devuelve fila, no hay segundo uso.
- **Reintentos idempotentes:** si el intento ya está consumido y tiene `post_id`, la API devuelve ese post con 200 en vez de crear otro. Así un reintento del cliente tras un corte de red no duplica la publicación.
- **Reenvío de la URL firmada:** repetir el `PUT` solo reescribe `pending/…`. El archivo publicado es una copia, así que no cambia. El sobrante lo borra el ciclo de vida del bucket.

### 2.2 Orden de operaciones y compensación al crear el post

Principio: **nunca existe una referencia a un objeto inexistente.** Un objeto huérfano no daña a nadie y se limpia; una referencia rota se ve en pantalla.

`POST /posts` con `upload_id`:

| Paso | Acción | Si falla |
|---|---|---|
| 1 | Validar membresía, muro y permiso de publicar. Reclamar el intento (§2.1). | Nada que compensar. 4xx. |
| 2 | Verificar el objeto en `pending/` (`HEAD` y firma de archivo). | Liberar el intento (`consumed_at = null`) para que el cliente reintente. 422 si el archivo es inválido. |
| 3 | Copiar `pending/…` a `events/{event_id}/posts/{upload_id}`. Hasta 3 intentos con espera corta; el SDK ya reintenta errores transitorios. | Liberar el intento. 502. El objeto de `pending/` sigue ahí. |
| 4 | Insertar el post (código actual, con su rollback de encuesta). | Borrar el objeto final (mejor esfuerzo) y liberar el intento. |
| 5 | Insertar la fila en `attachments`. | Borrar el post (como ya hace el servicio con la encuesta), borrar el objeto final y liberar el intento. |
| 6 | Marcar `consumed_at` y `post_id`. Borrar el objeto de `pending/` (mejor esfuerzo). | El post ya existe y es correcto. Un fallo aquí deja, como mucho, un objeto en `pending/` y se registra el error. El intento ya estaba reclamado en el paso 1, así que un reintento del cliente no duplica el post. |

Residuos posibles, todos invisibles para el usuario:

- Objetos en `pending/`: los borra una regla de ciclo de vida de R2 a las 24 horas.
- Un objeto en la ruta final cuyo borrado compensatorio falló: se registra y lo recoge un script de conciliación (`apps/api/scripts/reconcile-attachments`) que lista el prefijo `events/`, compara con `attachments` y borra lo que no tenga fila y tenga más de 24 horas. Se ejecuta a mano o desde una tarea programada; no es parte del camino crítico.

Sin transacciones distribuidas, sin colas y sin trabajadores.

### 2.3 Un adjunto por post en la base de datos

El índice único se aplica **desde ahora**, junto con la validación de la API. Migración `003_adjuntos_un_por_post.sql`:

- `create unique index if not exists uq_attachments_post on attachments (post_id);`
- `create unique index if not exists uq_attachments_storage_path on attachments (storage_path);`
- La columna `attachments.retention_hold` (booleano, por defecto falso) para marcar un adjunto que debe conservarse por auditoría o moderación (§2.5).
- La tabla `attachment_uploads` y su índice `(membership_id, created_at)`.
- Consultas de verificación y bloque para deshacer, con el estilo de la 001.

`attachments` tiene 0 filas, así que no hay datos que choquen. La 003 no depende de la 002. Como la base es compartida y de producción, se revisa en una solicitud de cambios y se aplica solo con autorización expresa.

### 2.4 Descargas: un solo mecanismo, a demanda

- El feed devuelve solo los metadatos (`id`, `name`, `mimeType`, `size`). Se cargan con una consulta por lote de los posts de la página, como ya se hace con los comentarios. No se firman URLs al listar.
- Al hacer clic, la web llama a `GET /posts/:postId/attachment/download`. La API comprueba membresía, acceso al muro, que el post no esté eliminado y que exista el adjunto, y devuelve `{ url, expiresAt }` con una URL firmada de `GET` de 60 segundos y `Content-Disposition` con el nombre del archivo. La firma es local, sin llamada a R2.
- La web abre la pestaña de forma síncrona al hacer clic y le asigna la URL al recibirla, para que el navegador no la bloquee.
- `PostAttachment.url` desaparece del tipo del cliente.

### 2.5 Retiro

Dos entradas, mismo servicio:

- `DELETE /posts/:postId/attachment`: el autor del post.
- `POST /admin/moderation/posts/:postId/attachment/delete` con `reason` (3–500): administrador o `MODERATOR` activo del evento, igual que el resto de la moderación. Retira el adjunto sin borrar el post y registra el motivo (RN-18).

Borra primero el objeto y luego la fila, y registra `DELETE_ATTACHMENT`. Si falla el borrado del objeto, la fila se conserva y el retiro se puede repetir. Un fallo entre ambos pasos deja una fila sin objeto; la descarga lo trata como "archivo no disponible" y repetir el retiro lo limpia. El retiro es idempotente.

**Retención de posts eliminados (decidido el 20 de noviembre de 2026):** al borrar un post (borrado lógico) el adjunto deja de listarse y el objeto se conserva 30 días. Pasado ese plazo se elimina físicamente (objeto y fila), salvo que `retention_hold` esté en verdadero por razones de auditoría o moderación. El script `apps/api/scripts/reconcile-attachments` hace la purga, con modo de simulación por defecto. No hay interfaz para marcar la retención en esta primera versión: se activa con una instrucción SQL de un administrador técnico.

## 3. Configuración en Cloudflare (la hace la persona dueña de la cuenta)

- Activar R2 (podría pedir un método de pago aunque se use solo el nivel gratis; no está confirmado).
- Bucket privado `munet-attachments`, sin acceso público.
- Token de API "Object Read & Write" limitado a ese bucket. El secreto se muestra una sola vez; va a `apps/api/.env` y a las variables de Vercel, nunca al cliente.
- CORS: orígenes `WEB_APP_URL` y `http://localhost:3000`, método `PUT`, cabecera `Content-Type`, exponer `ETag`. Las descargas se abren por navegación y no requieren CORS.
- Regla de ciclo de vida: borrar el prefijo `pending/` tras 1 día.

Referencias verificadas: URLs firmadas (GET, HEAD, PUT, DELETE; hasta 7 días; solo el endpoint S3), tokens con alcance por bucket, `S3Client` con `region: "auto"` y endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, nivel gratis de 10 GB, 1 M de operaciones de clase A, 10 M de clase B y descargas sin costo. Los borrados son gratis.

## 4. Riesgos a comprobar al implementar

- **Tamaño en el `PUT`:** la documentación no aclara si `Content-Length` se puede firmar. Se prueba contra R2 real. Mientras tanto, el `HEAD` del paso 2 descarta lo que exceda.
- **Checksums del SDK:** las versiones recientes de `@aws-sdk/client-s3` calculan sumas de verificación por defecto y pueden romper las firmas con R2. Se fija `requestChecksumCalculation: "WHEN_REQUIRED"` y se prueba.
- **Facturación:** si el pago falla, los buckets quedan inaccesibles. Vigilar el método de pago.
- **Copia dentro del bucket:** cuenta como operación de clase A; con el volumen esperado cabe de sobra en el nivel gratis.

## 5. Fases

| Fase | Trabajo | Salida verificable |
|---|---|---|
| 0 | Cuenta y bucket de R2, token, CORS, ciclo de vida (en curso, a cargo del dueño de la cuenta). | Credenciales en `.env`, `HEAD` de prueba contra el bucket. |
| 1 | Documentación primero: ADR de almacenamiento y de la excepción de subida directa, contrato de endpoints en `03-referencia`, `modelos-de-datos.md`, `PENDIENTES.md`. Redactar la migración 003 (sin aplicar). | Documentos y SQL revisados. |
| 2 | Módulo `lib/storage` con interfaz y adaptador S3, validación de tipo, tamaño y firma de archivo, constructor de claves. | Pruebas unitarias en verde (adaptador con cliente simulado). |
| 3 | API: `init` con límites, ampliación de `POST /posts` con el orden y las compensaciones de §2.2, metadatos en el feed, descarga a demanda, retiro, auditoría (`UPLOAD_ATTACHMENT`, `DELETE_ATTACHMENT`, entidad `ATTACHMENT`), script de conciliación. | Pruebas de controlador (ver abajo). |
| 4 | Web: `publishFeedPost` en pasos (init, `PUT`, crear post) con progreso y errores, `PostCard` con descarga a demanda y retiro por el autor. La bandera `ATTACHMENTS_BACKEND_READY` se eliminó. | Pruebas del cliente y lint sin advertencias. |
| 5 | Aplicar la migración 003 y verificar en el evento demo con dos cuentas: subir JPG, PNG y PDF; ver desde otro comité con y sin acceso; retirar; archivo inválido o excedido; CORS desde el navegador. | Registro en `pruebas-y-validacion.md`. |

Pruebas de controlador de la fase 3:

- Evento ajeno: usuario del evento B no inicia ni confirma una subida en el evento A.
- Intento de otra membresía o de otro evento: rechazado.
- Intento vencido o ya consumido: rechazado; reintento tras consumo devuelve el mismo post, sin duplicar.
- Fallo simulado en cada paso de §2.2: no queda post ni fila, y el intento queda libre.
- Dos confirmaciones simultáneas del mismo intento: solo una crea el post.
- Límites por membresía: el cuarto intento sin consumir recibe 429.
- Descarga a un usuario sin acceso al muro o a un post eliminado: rechazada.
- Retiro por quien no es autor ni administrador: rechazado.
- Archivo con tipo declarado que no coincide con su firma: rechazado.

Las fases 2 a 4 se pueden hacer en una rama sin tocar producción. Nada de producción cambia en la fase 0 ni en la 5 sin autorización expresa.

## 6. Decisiones tomadas el 20 de noviembre de 2026

- Posts eliminados: el objeto se conserva 30 días y luego se elimina, salvo `retention_hold` (§2.5).
- El moderador puede retirar adjuntos con los permisos de moderación existentes y registro de auditoría (§2.5).
- WebP no se admite por ahora: JPG, PNG y PDF, según RN-11.
- La API corre en Vercel (§2, decisión 1).

Pendiente: confirmar los umbrales de los límites por membresía (propuesta: 3 intentos sin consumir y 20 por hora).
