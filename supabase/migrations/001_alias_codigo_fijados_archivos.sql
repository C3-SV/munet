-- 001 · Alias, código # de delegación, publicaciones fijadas, archivos adjuntos,
--       quién borró y unicidad de muros.
--
-- APLICADA en Supabase el 2026-11-05 (ejecutada desde el SQL Editor; verificada con information_schema).
-- Se conserva como registro. Si hay que repetirla, es segura: usa IF NOT EXISTS.
-- Antes de ejecutarla (ya hecho):
--   1. Cerrar las decisiones de S1-03 (alias único o no; formato del código #).
--   2. Ejecutar la consulta de muros duplicados (más abajo): debe devolver 0 filas.
--   3. Revisión en Pull Request y aviso a Rober (la base es compartida).
-- Todo usa IF NOT EXISTS: se puede ejecutar dos veces sin error.

begin;

-- 1) Alias elegido por el delegado. Va aparte de display_name: se muestra junto al nombre real.
--    Decisión pendiente: unicidad por evento. Por ahora se permite repetirlo.
alter table profiles
  add column if not exists alias varchar(60);

-- 2) Código # de delegación, único por evento. Formato por decidir (propuesta: '#042').
--    La generación automática al crear la cuenta se implementa en S2-03.
alter table event_memberships
  add column if not exists delegation_code varchar(20);

create unique index if not exists uq_memberships_event_delegation_code
  on event_memberships (event_id, delegation_code)
  where delegation_code is not null;

-- 3) Publicaciones fijadas.
alter table posts
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by_membership_id uuid
    references event_memberships(id) on delete set null;

-- 4) Quién borró (uuid de la membresía). Las columnas actuales solo guardan 'AUTHOR' / 'ADMIN'.
alter table posts
  add column if not exists deleted_by_membership_uuid uuid
    references event_memberships(id) on delete set null;

alter table post_comments
  add column if not exists deleted_by_membership_uuid uuid
    references event_memberships(id) on delete set null;

-- 5) Archivos adjuntos de publicaciones. El borrado del post borra sus filas.
--    El archivo en sí vive en un bucket PRIVADO de Storage (se crea desde el panel).
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  uploaded_by_membership_id uuid not null references event_memberships(id) on delete cascade,
  storage_path text not null,
  file_name varchar not null,
  mime_type varchar not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_post on attachments (post_id);

-- Sin políticas: solo el API (service role) puede leer o escribir esta tabla.
alter table attachments enable row level security;

-- 6) Evitar muros duplicados al crearlos automáticamente.
--    Un muro GENERAL y uno de ANNOUNCEMENTS por evento; un muro por comité.
create unique index if not exists uq_walls_event_type_singleton
  on walls (event_id, wall_type)
  where wall_type in ('GENERAL', 'ANNOUNCEMENTS') and deleted_at is null;

create unique index if not exists uq_walls_event_committee
  on walls (event_id, committee_id)
  where wall_type = 'COMMITTEE' and committee_id is not null and deleted_at is null;

commit;

-- ---------------------------------------------------------------------------
-- COMPROBACIÓN PREVIA (solo lectura). Ambas consultas deben devolver 0 filas
-- antes de crear los índices del punto 6:
--
--   select event_id, wall_type, count(*) from walls
--   where wall_type in ('GENERAL','ANNOUNCEMENTS') and deleted_at is null
--   group by 1,2 having count(*) > 1;
--
--   select event_id, committee_id, count(*) from walls
--   where wall_type = 'COMMITTEE' and deleted_at is null
--   group by 1,2 having count(*) > 1;
--
-- DESHACER (solo si hace falta, y sin datos que perder en estas columnas):
--
--   drop index if exists uq_walls_event_committee, uq_walls_event_type_singleton;
--   drop table if exists attachments;
--   alter table post_comments drop column if exists deleted_by_membership_uuid;
--   alter table posts drop column if exists deleted_by_membership_uuid,
--     drop column if exists pinned_by_membership_id, drop column if exists pinned_at,
--     drop column if exists is_pinned;
--   drop index if exists uq_memberships_event_delegation_code;
--   alter table event_memberships drop column if exists delegation_code;
--   alter table profiles drop column if exists alias;
