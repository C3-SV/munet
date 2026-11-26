-- 005 · Notificaciones y avisos sin leer (mejora 2 de «Mejoras y correcciones»).
--
-- BORRADOR, NO APLICADA. Depende de la 001 y de la 004 (dm_messages.read_at, para los mensajes).
-- Antes de ejecutarla: Pull Request revisado y aviso a Rober (la base es compartida y de producción).
--
-- Diseño: no hay tabla de notificaciones. Lo «pendiente» se calcula a partir de dos marcas de lectura:
--   * Mensajes directos: dm_messages.read_at (migración 004).
--   * Avisos: wall_reads.last_read_at, el momento en que cada membresía abrió por última vez el
--     muro de avisos. Un aviso es pendiente si es posterior a esa marca y lo publicó otra persona.
--     Sin marca, cuenta desde el alta de la membresía.
-- La tabla solo la usa la API (service role): sin políticas.

begin;

create table if not exists public.wall_reads (
  membership_id uuid not null references public.event_memberships(id) on delete cascade,
  wall_id uuid not null references public.walls(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (membership_id, wall_id)
);

alter table public.wall_reads enable row level security;
revoke all on table public.wall_reads from public, anon, authenticated;

-- Avisos publicados antes de esta migración: se consideran leídos para que nadie arranque con un
-- contador atrasado. Una marca por cada membresía vigente y muro de avisos de su evento.
insert into public.wall_reads (membership_id, wall_id, last_read_at)
select m.id, w.id, now()
  from public.event_memberships m
  join public.walls w
    on w.event_id = m.event_id
   and w.wall_type = 'ANNOUNCEMENTS'
   and w.deleted_at is null
 where m.deleted_at is null
on conflict (membership_id, wall_id) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFICACIÓN (solo lectura):
--   select count(*) from wall_reads;   -- una fila por membresía vigente y evento con muro de avisos
--
-- DESHACER:
--   drop table if exists public.wall_reads;
--   notify pgrst, 'reload schema';
