-- 006 · Reacciones a publicaciones (mejora 4 de «Mejoras y correcciones»).
--
-- BORRADOR, NO APLICADA. Depende de la 001.
-- Antes de ejecutarla: Pull Request revisado y aviso a Rober (la base es compartida y de producción).
--
-- Diseño:
--   * Una reacción por persona y publicación (clave primaria post_id + membership_id): se puede
--     agregar, cambiar a otra o retirar (borrando la fila).
--   * Reacciones iniciales: LIKE (me gusta), LOVE (me encanta), LAUGH (risa), CLAP (aplausos).
--     Nuevas reacciones se agregan ampliando el CHECK.
--   * wall_id se guarda para suscribirse por muro en Realtime, igual que las publicaciones.
--   * Solo la usa la API (service role): sin políticas.

begin;

create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  membership_id uuid not null references public.event_memberships(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  wall_id uuid not null references public.walls(id) on delete cascade,
  reaction varchar(16) not null check (reaction in ('LIKE', 'LOVE', 'LAUGH', 'CLAP')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, membership_id)
);

create index if not exists idx_post_reactions_wall on public.post_reactions (wall_id);

alter table public.post_reactions enable row level security;
revoke all on table public.post_reactions from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- VERIFICACIÓN (solo lectura):
--   select reaction, count(*) from post_reactions group by 1;
--
-- DESHACER:
--   drop table if exists public.post_reactions;
--   notify pgrst, 'reload schema';
