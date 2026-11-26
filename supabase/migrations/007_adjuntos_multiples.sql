-- 007 · Varios adjuntos por publicación (mejora 10 de «Mejoras y correcciones»).
--
-- BORRADOR, NO APLICADA. Depende de la 001 y de la 003 (ya aplicadas).
-- Antes de ejecutarla: Pull Request revisado y aviso a Rober (la base es compartida y de producción).
-- Es segura de repetir: usa IF NOT EXISTS / IF EXISTS.
--
-- Qué cambia:
--   * Se quita el índice único uq_attachments_post (la 003 limitaba a un adjunto por post). Las
--     cantidades (hasta 10 imágenes y 2 PDF por publicación) las valida la API.
--   * attachments.position ordena los archivos de una publicación (carrusel y lista de PDF).
--   * El tamaño máximo de un intento de subida pasa de 20 MB a 30 MB (PDF de 30 MB). Las imágenes
--     son de hasta 15 MB; ese tope por tipo lo valida la API.
--
-- Importante: ejecutarla ANTES de desplegar el código que sube varios archivos.

begin;

drop index if exists public.uq_attachments_post;

alter table public.attachments
  add column if not exists position smallint not null default 0;

create index if not exists idx_attachments_post_position
  on public.attachments (post_id, position);

alter table public.attachment_uploads
  drop constraint if exists attachment_uploads_size_bytes_check;

alter table public.attachment_uploads
  add constraint attachment_uploads_size_bytes_check
  check (size_bytes > 0 and size_bytes <= 31457280);

commit;

notify pgrst, 'reload schema';

-- VERIFICACIÓN (solo lectura):
--   select indexname from pg_indexes where schemaname = 'public' and tablename = 'attachments' order by 1;
--     -- ya no debe aparecer uq_attachments_post; sí idx_attachments_post_position
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'attachments' and column_name = 'position';
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'attachment_uploads_size_bytes_check';
--
-- DESHACER (solo si ninguna publicación tiene más de un adjunto; si no, el índice no se puede crear):
--   select post_id, count(*) from public.attachments group by 1 having count(*) > 1;   -- debe dar 0 filas
--   create unique index if not exists uq_attachments_post on public.attachments (post_id);
--   drop index if exists public.idx_attachments_post_position;
--   alter table public.attachments drop column if exists position;
--   alter table public.attachment_uploads drop constraint if exists attachment_uploads_size_bytes_check;
--   alter table public.attachment_uploads add constraint attachment_uploads_size_bytes_check
--     check (size_bytes > 0 and size_bytes <= 20971520);
--   notify pgrst, 'reload schema';
