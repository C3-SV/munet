-- Snapshot del esquema `public` de Supabase (proyecto MUNET), extraído el 2026-10-26
-- y actualizado el 2026-11-05 con la migración 001 (columnas y tabla marcadas)
-- desde information_schema.columns. Es REFERENCIA, no una migración ejecutable:
--   * Las CREATE TABLE no llevan PK/FK/UNIQUE/CHECK inline: están resumidos al final.
--   * No incluye índices, políticas RLS ni triggers/funciones.
-- Pendiente: volcar índices y RLS.

-- ===== Enums (public) =====
-- audit_outcome_enum: SUCCESS, FAILURE, DENIED
-- auth_attempt_result_enum: SUCCESS, FAILURE, BLOCKED
-- auth_attempt_type_enum: ACTIVATION, LOGIN
-- committee_status_enum: ACTIVE, ARCHIVED
-- dm_conversation_status_enum: ACTIVE, ARCHIVED
-- dm_message_status_enum: VISIBLE, DELETED
-- event_status_enum: DRAFT, ACTIVE, CLOSED, ARCHIVED
-- membership_account_status_enum: PENDING_ACTIVATION, ACTIVE, BLOCKED, SUSPENDED, EXPELLED, ARCHIVED
-- membership_role_enum: PARTICIPANT, MODERATOR, ADMIN_MUN, ADMIN_TECH
-- post_comment_status_enum: VISIBLE, HIDDEN, DELETED
-- post_status_enum: VISIBLE, HIDDEN, DELETED
-- post_type_enum: TEXT, LINK, POLL
-- session_logout_type_enum: MANUAL, EXPIRED, FORCED
-- user_system_status_enum: ACTIVE, DISABLED
-- wall_status_enum: ACTIVE, ARCHIVED
-- wall_type_enum: GENERAL, COMMITTEE, ANNOUNCEMENTS

create table attachments ( -- migración 001
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  post_id uuid not null, -- FK a posts, ON DELETE CASCADE
  uploaded_by_membership_id uuid not null,
  storage_path text not null,
  file_name varchar not null,
  mime_type varchar not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid not null default gen_random_uuid(),
  event_id uuid,
  actor_user_id uuid,
  actor_membership_id uuid,
  actor_role membership_role_enum,
  action_type varchar not null,
  entity_type varchar not null,
  entity_id uuid,
  target_user_id uuid,
  target_membership_id uuid,
  reason text,
  outcome audit_outcome_enum not null default 'SUCCESS',
  created_at timestamptz not null default now()
);

create table auth_attempts (
  id uuid not null default gen_random_uuid(),
  event_id uuid,
  participant_code varchar,
  event_membership_id uuid,
  attempt_type auth_attempt_type_enum not null,
  result auth_attempt_result_enum not null,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table committees (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  name varchar not null,
  code varchar not null,
  description text,
  status committee_status_enum not null default 'ACTIVE',
  sort_order int4 not null default 0,
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid,
  deleted_at timestamptz,
  deleted_by_user_id uuid
);

create table dm_conversations (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  participant_a_membership_id uuid not null,
  participant_b_membership_id uuid not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  status dm_conversation_status_enum not null default 'ACTIVE'
);

create table dm_messages (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  conversation_id uuid not null,
  author_membership_id uuid not null,
  content text not null,
  status dm_message_status_enum not null default 'VISIBLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_membership_id uuid,
  deleted_at timestamptz,
  deleted_by_membership_id uuid
);

create table event_memberships (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  user_id uuid not null,
  committee_id uuid,
  role membership_role_enum not null,
  delegation_name varchar,
  institution_name varchar,
  account_status membership_account_status_enum not null default 'PENDING_ACTIVATION',
  status_changed_at timestamptz not null default now(),
  participant_code varchar not null,
  delegation_code varchar(20), -- migración 001
  initial_password_hash text,
  activated_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  deleted_at timestamptz,
  deleted_by_user_id uuid
);

create table events (
  id uuid not null default gen_random_uuid(),
  name varchar not null,
  slug varchar not null,
  description text,
  start_date date,
  end_date date,
  status event_status_enum not null default 'DRAFT',
  is_read_only bool not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  deleted_at timestamptz,
  deleted_by_user_id uuid
);

create table poll_options (
  id uuid not null default gen_random_uuid(),
  poll_id uuid not null,
  option_text text not null,
  sort_order int4 not null default 0
);

create table poll_votes (
  id uuid not null default gen_random_uuid(),
  poll_id uuid not null,
  option_id uuid not null,
  voter_membership_id uuid not null,
  voted_at timestamptz not null default now()
);

create table polls (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  wall_id uuid not null,
  post_id uuid not null,
  author_membership_id uuid not null,
  question text not null,
  status varchar not null default 'OPEN',
  closed_at timestamptz,
  closed_by_membership_id uuid,
  created_at timestamptz not null default now()
);

create table post_comments (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  post_id uuid not null,
  author_membership_id uuid not null,
  parent_comment_id uuid,
  content text not null,
  status post_comment_status_enum not null default 'VISIBLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_by_actor_type varchar,
  deleted_at timestamptz,
  created_by_membership_id uuid,
  updated_by_membership_id uuid,
  deleted_by_membership_uuid uuid -- migración 001: quién borró
);

create table post_committee_tags (
  post_id uuid not null,
  committee_id uuid not null,
  created_at timestamptz not null default now(),
  created_by_user_id uuid
);

create table posts (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  wall_id uuid not null,
  author_membership_id uuid not null,
  post_type post_type_enum not null default 'TEXT',
  title varchar,
  content text not null,
  status post_status_enum not null default 'VISIBLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_by_membership_id varchar, -- OJO: varchar (guarda 'AUTHOR'/'ADMIN'), no uuid
  deleted_at timestamptz,
  created_by_membership_id uuid,
  updated_by_membership_id uuid,
  is_pinned boolean not null default false, -- migración 001
  pinned_at timestamptz,
  pinned_by_membership_id uuid,
  deleted_by_membership_uuid uuid -- migración 001: quién borró
);

create table profiles (
  id uuid not null default gen_random_uuid(),
  event_membership_id uuid not null,
  first_name varchar not null,
  last_name varchar not null,
  display_name varchar,
  bio text,
  profile_image_path text,
  alias varchar(60), -- migración 001
  updated_at timestamptz not null default now(),
  updated_by_membership_id uuid
);

create table sessions_audit (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  event_membership_id uuid not null,
  session_identifier varchar not null,
  login_at timestamptz not null,
  logout_at timestamptz,
  logout_type session_logout_type_enum,
  created_at timestamptz not null default now()
);

create table users (
  id uuid not null default gen_random_uuid(),
  supabase_auth_user_id uuid,
  email varchar,
  system_status user_system_status_enum not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid
);

create table walls (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  committee_id uuid,
  wall_type wall_type_enum not null,
  name varchar not null,
  status wall_status_enum not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid,
  deleted_at timestamptz,
  deleted_by_user_id uuid
);

-- ===== Constraints relevantes =====
-- UNIQUE: committees(event_id, name), committees(event_id, code),
--         event_memberships(event_id, user_id), event_memberships(event_id, participant_code),
--         events(slug), poll_options(poll_id, sort_order), poll_votes(poll_id, voter_membership_id),
--         polls(post_id), profiles(event_membership_id), users(email), users(supabase_auth_user_id)
-- CHECK:  polls.status IN ('OPEN','CLOSED'); events.end_date >= start_date;
--         posts.deleted_by_membership_id IN ('AUTHOR','ADMIN') (es un tipo de actor, no un id);
--         post_comments.deleted_by_actor_type IN ('AUTHOR','ADMIN');
--         dm_conversations.participant_a <> participant_b; sessions_audit.logout_at >= login_at
-- FK ON DELETE CASCADE: events -> committees, walls, posts, event_memberships, dm_*, sessions_audit;
--         event_memberships -> posts, profiles, dm_*, sessions_audit; walls -> posts
-- FK SIN cascade (bloquean el borrado): post_comments -> posts/event_memberships,
--         polls -> posts/walls/event_memberships, poll_votes -> event_memberships
-- FK ON DELETE SET NULL: audit_logs.*, auth_attempts.*, event_memberships.committee_id, walls.committee_id
-- walls: índices únicos parciales desde la migración 001 (un GENERAL y un ANNOUNCEMENTS por evento; un muro por comité).
-- delegation_code: UNIQUE (event_id, delegation_code) donde no es nulo.
