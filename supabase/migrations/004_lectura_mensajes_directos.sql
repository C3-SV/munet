-- 004 · Confirmaciones de lectura en mensajes directos (mejora 7 de «Mejoras y correcciones»).
--
-- BORRADOR, NO APLICADA. Depende de la 001.
-- Antes de ejecutarla: Pull Request revisado y aviso a Rober (la base es compartida y de producción).
--
-- Diseño:
--   * dm_messages.read_at: momento en que la OTRA persona de la conversación leyó el mensaje.
--     Es nulo mientras no lo haya leído. Persiste en la base, así que se conserva al cerrar
--     sesión o cambiar de dispositivo.
--   * Solo se marca cuando la persona tiene la conversación abierta (lo hace la API a petición de
--     la pantalla), nunca por el solo hecho de recibir el mensaje.
--   * Los mensajes que ya existen se marcan como leídos para que, al activar las notificaciones,
--     el historial no aparezca como pendiente.
--   * No hay estado «entregado»: no existe una confirmación fiable de entrega al dispositivo.

begin;

alter table public.dm_messages
  add column if not exists read_at timestamptz;

-- Mensajes sin leer por conversación y autor: acelera el contador de pendientes y el marcado.
create index if not exists idx_dm_messages_unread
  on public.dm_messages (conversation_id, author_membership_id)
  where read_at is null and deleted_at is null;

-- Historial previo: se considera leído (se conserva la fecha del mensaje como referencia).
update public.dm_messages
   set read_at = created_at
 where read_at is null;

commit;

notify pgrst, 'reload schema';

-- VERIFICACIÓN (solo lectura):
--   select count(*) from dm_messages where read_at is null;   -- debe ser 0 justo tras aplicarla
--
-- DESHACER:
--   drop index if exists public.idx_dm_messages_unread;
--   alter table public.dm_messages drop column if exists read_at;
--   notify pgrst, 'reload schema';
