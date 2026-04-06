-- Comentarios planos por post (con respuesta maximo 1 nivel)
create type if not exists public.post_comment_status_enum as enum ('VISIBLE', 'HIDDEN', 'DELETED');

create table if not exists public.post_comments (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  post_id uuid not null references public.posts(id),
  author_membership_id uuid not null references public.event_memberships(id),
  parent_comment_id uuid null references public.post_comments(id),
  content text not null,
  status public.post_comment_status_enum not null default 'VISIBLE',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint post_comments_pkey primary key (id)
);

create index if not exists idx_post_comments_post_created
  on public.post_comments (post_id, created_at asc);

create index if not exists idx_post_comments_event
  on public.post_comments (event_id);
