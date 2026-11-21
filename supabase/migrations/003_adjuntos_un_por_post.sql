-- 003 · Adjuntos de publicaciones: un adjunto por post, intentos de subida y retención.
--
-- APLICADA en Supabase el 2026-11-20 (ejecutada desde el SQL Editor con autorización expresa;
-- verificada: tabla, restricciones y RLS). Se conserva como registro; es segura de repetir.
-- Requiere la 001 (tabla attachments). No depende de la 002.
-- Antes de ejecutarla (ya hecho):
--   1. Revisión en Pull Request y aviso a Rober (la base es compartida y de produccion).
--   2. Autorización expresa de quien administra la base.
--   3. Ejecutar el archivo completo en el SQL Editor de Supabase.
--   4. Verificar con las consultas del final.
-- Plan y decisión: docs/04-desarrollo/plan-adjuntos-r2.md y docs/06-decisiones/ADR-006.
-- Todo usa IF NOT EXISTS: se puede ejecutar dos veces sin error.

begin;

-- 1) Un adjunto por post (RN-11) y una ruta de objeto por fila. attachments tenía 0 filas al redactar esto.
create unique index if not exists uq_attachments_post
  on public.attachments (post_id);

create unique index if not exists uq_attachments_storage_path
  on public.attachments (storage_path);

-- 2) Retención: un adjunto marcado se conserva aunque pasen los 30 días de un post eliminado.
--    No hay interfaz para marcarlo; lo hace un administrador técnico con SQL.
alter table public.attachments
  add column if not exists retention_hold boolean not null default false;

-- 3) Intentos de subida. Un intento = una URL firmada autorizada. Un solo uso:
--    la API lo reclama con un UPDATE atómico sobre consumed_at.
create table if not exists public.attachment_uploads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  membership_id uuid not null references public.event_memberships(id) on delete cascade,
  wall_id uuid not null references public.walls(id) on delete cascade,
  storage_key text not null unique,
  file_name varchar not null,
  mime_type varchar not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Cuenta de intentos recientes y pendientes por membresía (límites de la API).
create index if not exists idx_attachment_uploads_membership
  on public.attachment_uploads (membership_id, created_at desc);

-- Solo la API (service role): RLS activo y sin políticas, como attachments y event_delegation_counters.
alter table public.attachment_uploads enable row level security;
revoke all on table public.attachment_uploads from public, anon, authenticated;

commit;

-- ---------------------------------------------------------------------------
-- COMPROBACIÓN PREVIA (solo lectura). Debe devolver 0 filas antes de crear los índices del punto 1:
--
--   select post_id, count(*) from public.attachments group by 1 having count(*) > 1;
--   select storage_path, count(*) from public.attachments group by 1 having count(*) > 1;
--
-- VERIFICACIÓN DESPUÉS DE APLICAR (solo lectura):
--
--   select indexname from pg_indexes
--   where schemaname = 'public' and tablename in ('attachments', 'attachment_uploads')
--   order by 1;
--
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'attachments' and column_name = 'retention_hold';
--
--   select relrowsecurity from pg_class where oid = 'public.attachment_uploads'::regclass;  -- true
--
-- DESHACER (solo si hace falta; borra los intentos de subida registrados):
--
--   drop table if exists public.attachment_uploads;
--   alter table public.attachments drop column if exists retention_hold;
--   drop index if exists public.uq_attachments_storage_path, public.uq_attachments_post;
