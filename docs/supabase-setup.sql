-- tosië Newsletter – komplettes DB-Setup
-- Im Supabase-Dashboard ausführen: Projekt "tosië" → SQL Editor → einfügen → Run.
-- Kein DB-Passwort nötig (läuft über die Dashboard-Session). Einmalig ausführen.

create extension if not exists citext;

-- 1) subscribers: Newsletter Double-Opt-In. RLS-dicht, nur Service-Role (Edge Functions).
create table if not exists public.subscribers (
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
create index if not exists subscribers_confirm_token_idx
  on public.subscribers (confirm_token);

-- 2) signup_attempts: Rate-Limit-Log (Altcha-Ersatz). RLS-dicht, nur Service-Role.
create table if not exists public.signup_attempts (
  id         bigint generated always as identity primary key,
  ip         inet,
  email      citext,
  created_at timestamptz not null default now()
);
alter table public.signup_attempts enable row level security;
create index if not exists signup_attempts_ip_idx
  on public.signup_attempts (ip, created_at desc);
create index if not exists signup_attempts_email_idx
  on public.signup_attempts (email, created_at desc);
create index if not exists signup_attempts_time_idx
  on public.signup_attempts (created_at);
