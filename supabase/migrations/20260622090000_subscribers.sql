-- subscribers: Newsletter-DOI. RLS-dicht, nur Service-Role schreibt/liest.
create extension if not exists citext;

create table public.subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  status        text not null default 'pending'
                  check (status in ('pending','confirmed','unsubscribed')),
  confirm_token uuid,
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now(),
  consent_ip    inet,
  user_agent    text,
  source        text,
  extra         jsonb not null default '{}'::jsonb
);

alter table public.subscribers enable row level security;
-- Bewusst KEINE Policies für anon/authenticated:
-- Zugriff ausschließlich über Edge Functions mit Service-Role-Key.

create index subscribers_confirm_token_idx
  on public.subscribers (confirm_token);
