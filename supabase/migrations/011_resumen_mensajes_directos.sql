-- 011 · Resumen acotado para previews y no leídos de mensajes directos.
--
-- Depende de 004 (dm_messages.read_at). Aplicar después de 004 y antes de desplegar la API.
-- La función solo recibe los IDs que la API ya encontró para el evento y la membresía; vuelve
-- a comprobar evento, participación y estado activo para no confiar en IDs aportados por cliente.

begin;

create index if not exists idx_dm_messages_latest_visible
  on public.dm_messages (conversation_id, created_at desc, id desc)
  where status = 'VISIBLE' and deleted_at is null;

create or replace function public.get_dm_conversation_summaries(
  p_event_id uuid,
  p_membership_id uuid,
  p_conversation_ids uuid[]
)
returns table (
  conversation_id uuid,
  unread_count bigint,
  last_message_id uuid,
  last_message_author_membership_id uuid,
  last_message_content text,
  last_message_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with allowed_conversations as (
    select c.id
      from public.dm_conversations c
     where c.event_id = p_event_id
       and c.status = 'ACTIVE'
       and p_membership_id in (c.participant_a_membership_id, c.participant_b_membership_id)
       and c.id = any(coalesce(p_conversation_ids, '{}'::uuid[]))
  ), unread as (
    select m.conversation_id, count(*) as unread_count
      from public.dm_messages m
      join allowed_conversations c on c.id = m.conversation_id
     where m.event_id = p_event_id
       and m.author_membership_id <> p_membership_id
       and m.status = 'VISIBLE'
       and m.deleted_at is null
       and m.read_at is null
     group by m.conversation_id
  )
  select c.id,
         coalesce(u.unread_count, 0),
         latest.id,
         latest.author_membership_id,
         latest.content,
         latest.created_at
    from allowed_conversations c
    left join unread u on u.conversation_id = c.id
    left join lateral (
      select m.id, m.author_membership_id, m.content, m.created_at
        from public.dm_messages m
       where m.event_id = p_event_id
         and m.conversation_id = c.id
         and m.status = 'VISIBLE'
         and m.deleted_at is null
       order by m.created_at desc, m.id desc
       limit 1
    ) latest on true;
$$;

revoke all on function public.get_dm_conversation_summaries(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.get_dm_conversation_summaries(uuid, uuid, uuid[]) to service_role;

commit;

notify pgrst, 'reload schema';

-- DESHACER:
--   revoke all on function public.get_dm_conversation_summaries(uuid, uuid, uuid[]) from service_role;
--   drop function if exists public.get_dm_conversation_summaries(uuid, uuid, uuid[]);
--   drop index if exists public.idx_dm_messages_latest_visible;
--   notify pgrst, 'reload schema';
