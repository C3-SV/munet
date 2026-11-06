-- 002 · Codigo # de delegacion generado por la base (tarea S2-03).
--
-- NO APLICADA. Requiere la 001 (columna event_memberships.delegation_code).
-- Antes de ejecutarla:
--   1. Revision en Pull Request y aviso a Rober (la base es compartida y de produccion).
--   2. Que nadie este importando participantes en ese momento (el backfill del final asigna codigos).
--   3. Ejecutar el archivo completo en el SQL Editor de Supabase.
--   4. Verificar con las consultas del final.
--
-- Diseno (decidido 2026-11-06 comparando la propuesta de Claude y la de Codex):
--   * Un contador por evento (event_delegation_counters). Incrementar una sola fila es atomico,
--     cuesta lo mismo con 10 o 1000 delegados y nunca reutiliza un numero aunque se borren memberships.
--   * assign_delegation_code(membership_id) es idempotente: si la membership ya tiene codigo lo devuelve.
--   * La API la llama despues de crear membership y perfil (el alta sigue en Node con rollback manual).
--   * Formato: '#' + numero con al menos 3 digitos: #001 ... #999, #1000 (lpad con 3 fijo truncaria 1000 a 100).
--   * Un trigger impide cambiar un codigo ya asignado (decision: inmutable).
--   * Unicidad garantizada ademas por uq_memberships_event_delegation_code (migracion 001).
--   * Puede haber huecos en la numeracion (altas deshechas, borrados). Unico no significa consecutivo.

begin;

-- 1) Contador por evento. Solo lo usa la API (service role): sin politicas RLS.
create table if not exists public.event_delegation_counters (
  event_id uuid primary key references public.events(id) on delete cascade,
  last_value bigint not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);

alter table public.event_delegation_counters enable row level security;
revoke all on table public.event_delegation_counters from public, anon, authenticated;

-- 2) Asignacion atomica e idempotente.
--    Orden de bloqueos fijo en todas las llamadas: primero la membership, luego el contador del evento.
create or replace function public.assign_delegation_code(p_membership_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_code text;
  v_next bigint;
begin
  select m.event_id, m.delegation_code
    into v_event_id, v_code
    from public.event_memberships m
   where m.id = p_membership_id
   for update;

  if not found then
    raise exception 'Membership % no existe', p_membership_id using errcode = 'P0002';
  end if;

  if v_code is not null then
    return v_code;
  end if;

  insert into public.event_delegation_counters as c (event_id, last_value)
  values (v_event_id, 1)
  on conflict (event_id)
  do update set last_value = c.last_value + 1, updated_at = now()
  returning c.last_value into v_next;

  v_code := '#' || lpad(v_next::text, greatest(3, length(v_next::text)), '0');

  update public.event_memberships
     set delegation_code = v_code
   where id = p_membership_id;

  return v_code;
end;
$$;

revoke all on function public.assign_delegation_code(uuid) from public, anon, authenticated;
grant execute on function public.assign_delegation_code(uuid) to service_role;

-- 3) Inmutabilidad: un codigo asignado no se cambia ni se borra.
create or replace function public.prevent_delegation_code_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.delegation_code is not null and new.delegation_code is distinct from old.delegation_code then
    raise exception 'El codigo de delegacion % es inmutable', old.delegation_code using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_delegation_code_change() from public, anon, authenticated;

drop trigger if exists trg_memberships_delegation_code_immutable on public.event_memberships;
create trigger trg_memberships_delegation_code_immutable
  before update of delegation_code on public.event_memberships
  for each row execute function public.prevent_delegation_code_change();

-- 4) Sembrar el contador con el mayor codigo numerico ya usado en cada evento
--    (incluye memberships borradas para no reutilizar numeros).
insert into public.event_delegation_counters (event_id, last_value)
select m.event_id, max(substring(m.delegation_code from '^#([0-9]+)$')::bigint)
  from public.event_memberships m
 where m.delegation_code ~ '^#[0-9]+$'
 group by m.event_id
on conflict (event_id)
do update set last_value = greatest(public.event_delegation_counters.last_value, excluded.last_value),
              updated_at = now();

-- 5) Backfill: codigo para las memberships vigentes que aun no tienen, por orden de alta.
do $$
declare
  r record;
begin
  for r in
    select id
      from public.event_memberships
     where delegation_code is null
       and deleted_at is null
     order by created_at, id
  loop
    perform public.assign_delegation_code(r.id);
  end loop;
end;
$$;

commit;

-- Que PostgREST vea la funcion nueva sin esperar.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- VERIFICACION (solo lectura). Deben dar: 0 sin codigo, 0 duplicados, contador >= maximo.
--
--   select count(*) from event_memberships where delegation_code is null and deleted_at is null;
--
--   select event_id, delegation_code, count(*) from event_memberships
--    where delegation_code is not null group by 1,2 having count(*) > 1;
--
--   select c.event_id, c.last_value,
--          max(substring(m.delegation_code from '^#([0-9]+)$')::bigint) as max_usado
--     from event_delegation_counters c join event_memberships m on m.event_id = c.event_id
--    where m.delegation_code ~ '^#[0-9]+$' group by 1,2;
--
-- DESHACER (los codigos ya asignados se conservan en event_memberships):
--
--   drop trigger if exists trg_memberships_delegation_code_immutable on public.event_memberships;
--   drop function if exists public.prevent_delegation_code_change();
--   drop function if exists public.assign_delegation_code(uuid);
--   drop table if exists public.event_delegation_counters;
--   notify pgrst, 'reload schema';