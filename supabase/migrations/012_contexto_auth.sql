-- 012 · Contexto de usuario y membresías en una lectura para requireAuth.
-- Aplicar después de la 011 y antes de desplegar la API actualizada.
-- Mantiene el filtro/mapeo de la API; no concede autorización ni cambia filas.

begin;

create or replace function public.get_auth_context_by_supabase_auth_user_id(
  p_supabase_auth_user_id uuid
)
returns table (
  id uuid,
  supabase_auth_user_id uuid,
  email varchar,
  memberships jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select u.id,
         u.supabase_auth_user_id,
         u.email,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', m.id,
               'user_id', m.user_id,
               'event_id', m.event_id,
               'role', m.role,
               'committee_id', m.committee_id,
               'participant_code', m.participant_code,
               'account_status', m.account_status,
               'created_at', m.created_at,
               'events', case when e.id is null then null else jsonb_build_object(
                 'id', e.id,
                 'name', e.name,
                 'slug', e.slug,
                 'status', e.status,
                 'deleted_at', e.deleted_at
               ) end,
               'committees', case when c.id is null then null else jsonb_build_object(
                 'id', c.id,
                 'name', c.name,
                 'code', c.code,
                 'deleted_at', c.deleted_at
               ) end
             )
           ) filter (where m.id is not null),
           '[]'::jsonb
         ) as memberships
    from public.users u
    left join public.event_memberships m
      on m.user_id = u.id
     and m.account_status = 'ACTIVE'
     and m.deleted_at is null
    left join public.events e on e.id = m.event_id
    left join public.committees c on c.id = m.committee_id
   where u.supabase_auth_user_id = p_supabase_auth_user_id
   group by u.id, u.supabase_auth_user_id, u.email;
$$;

revoke all on function public.get_auth_context_by_supabase_auth_user_id(uuid) from public, anon, authenticated;
grant execute on function public.get_auth_context_by_supabase_auth_user_id(uuid) to service_role;

commit;

notify pgrst, 'reload schema';

-- DESHACER:
--   revoke all on function public.get_auth_context_by_supabase_auth_user_id(uuid) from service_role;
--   drop function if exists public.get_auth_context_by_supabase_auth_user_id(uuid);
--   notify pgrst, 'reload schema';
