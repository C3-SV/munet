-- 010 · Invalidaciones privadas Realtime para reacciones.
--
-- BORRADOR, NO APLICADA. Requiere post_reactions (migración 006).
-- Aplicar la migración antes de desplegar la web que escucha el canal privado.
-- No cambia las lecturas ni escrituras de reacciones, que siguen pasando por la API.

begin;

-- El cuerpo vacío evita emitir membership_id, post_id, reacción o contadores.
-- Los fallos de Broadcast quedan en los logs y nunca revierten la escritura de negocio.
create or replace function public.broadcast_post_reaction_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op = 'DELETE' then
      perform realtime.send(
        '{}'::jsonb,
        'post_reaction_changed',
        'feed-reactions:' || old.event_id::text || ':' || old.wall_id::text,
        true
      );
      return old;
    end if;

    if tg_op = 'UPDATE'
       and (old.event_id, old.wall_id) is distinct from (new.event_id, new.wall_id) then
      perform realtime.send(
        '{}'::jsonb,
        'post_reaction_changed',
        'feed-reactions:' || old.event_id::text || ':' || old.wall_id::text,
        true
      );
    end if;

    perform realtime.send(
      '{}'::jsonb,
      'post_reaction_changed',
      'feed-reactions:' || new.event_id::text || ':' || new.wall_id::text,
      true
    );
    return new;
  exception when others then
    raise warning 'No se pudo emitir invalidación Realtime de reacción (%, SQLSTATE %)', tg_op, sqlstate;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end;
end;
$$;

revoke all on function public.broadcast_post_reaction_invalidation() from public, anon, authenticated;

drop trigger if exists trg_post_reactions_broadcast on public.post_reactions;
create trigger trg_post_reactions_broadcast
  after insert or update or delete on public.post_reactions
  for each row execute function public.broadcast_post_reaction_invalidation();

-- SECURITY DEFINER acotado: usa el UID y topic del socket actual, y solo devuelve true/false.
create or replace function public.can_receive_post_reaction_invalidation()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.event_memberships m
      join public.users u on u.id = m.user_id
      join public.events e on e.id = m.event_id
      join public.walls w on w.event_id = m.event_id
      left join public.committees c on c.id = w.committee_id and c.event_id = w.event_id
     where u.supabase_auth_user_id = (select auth.uid())
       and u.system_status = 'ACTIVE'
       and u.deleted_at is null
       and m.account_status = 'ACTIVE'
       and m.deleted_at is null
       and e.deleted_at is null
       and (e.status <> 'ARCHIVED' or m.role in ('ADMIN_MUN', 'ADMIN_TECH'))
       and realtime.topic() = 'feed-reactions:' || m.event_id::text || ':' || w.id::text
       and w.status = 'ACTIVE'
       and w.deleted_at is null
       and (w.committee_id is null or c.deleted_at is null)
       and (
         w.committee_id is null
         or m.role in ('MODERATOR', 'ADMIN_MUN', 'ADMIN_TECH')
         or m.committee_id = w.committee_id
       )
       -- getWallKind clasifica primero por committee_id; los otros muros con nombre/tipo de avisos no permiten reacciones.
       and (
         w.committee_id is not null
         or (
           lower(w.name) not like '%aviso%'
           and lower(w.wall_type::text) not like '%announce%'
           and lower(w.wall_type::text) not like '%official%'
           and lower(w.wall_type::text) not like '%aviso%'
         )
       )
  );
$$;

revoke all on function public.can_receive_post_reaction_invalidation() from public, anon;
grant execute on function public.can_receive_post_reaction_invalidation() to authenticated;

drop policy if exists "active members can receive reaction invalidations" on realtime.messages;
create policy "active members can receive reaction invalidations"
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and (select public.can_receive_post_reaction_invalidation())
  );

commit;

-- VERIFICACIÓN (solo lectura):
--   select tgname from pg_trigger where tgrelid = 'public.post_reactions'::regclass
--     and tgname = 'trg_post_reactions_broadcast' and not tgisinternal;
--   select policyname from pg_policies where schemaname = 'realtime' and tablename = 'messages'
--     and policyname = 'active members can receive reaction invalidations';
--   select has_function_privilege('authenticated',
--     'public.can_receive_post_reaction_invalidation()', 'execute'); -- true
--   select has_function_privilege('anon',
--     'public.can_receive_post_reaction_invalidation()', 'execute'); -- false
--
-- DESHACER (mantiene post_reactions y sus filas):
--   drop policy if exists "active members can receive reaction invalidations" on realtime.messages;
--   drop trigger if exists trg_post_reactions_broadcast on public.post_reactions;
--   drop function if exists public.broadcast_post_reaction_invalidation();
--   drop function if exists public.can_receive_post_reaction_invalidation();
