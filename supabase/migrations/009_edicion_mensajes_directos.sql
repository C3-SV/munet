-- 009 · Edición de mensajes directos (mejora 9 de «Mejoras y correcciones»).
--
-- BORRADOR, NO APLICADA. Depende de la 004 (misma tabla dm_messages).
-- Antes de ejecutarla: Pull Request revisado y aviso a Rober (la base es compartida y de producción).
--
-- Diseño: dm_messages.edited_at guarda cuándo se editó el contenido por última vez; es nulo si
-- nunca se editó. created_at no cambia, así que el mensaje conserva su posición en la conversación.

begin;

alter table public.dm_messages
  add column if not exists edited_at timestamptz;

commit;

notify pgrst, 'reload schema';

-- VERIFICACIÓN (solo lectura):
--   select count(*) from dm_messages where edited_at is not null;   -- 0 justo tras aplicarla
--
-- DESHACER:
--   alter table public.dm_messages drop column if exists edited_at;
--   notify pgrst, 'reload schema';
