-- signup_attempts: Rate-Limiting-Log für subscribe (Ersatz für Altcha, kein Drittanbieter).
-- Pro gültigem Anmeldeversuch eine Zeile; subscribe zählt darüber pro IP/Email.
-- RLS-dicht, Zugriff ausschließlich über Edge Function mit Service-Role-Key.
create table public.signup_attempts (
  id         bigint generated always as identity primary key,
  ip         inet,
  email      citext,
  created_at timestamptz not null default now()
);

alter table public.signup_attempts enable row level security;
-- Bewusst KEINE Policies für anon/authenticated.

create index signup_attempts_ip_idx    on public.signup_attempts (ip, created_at desc);
create index signup_attempts_email_idx on public.signup_attempts (email, created_at desc);
create index signup_attempts_time_idx  on public.signup_attempts (created_at);

-- Hinweis: Tabelle wächst pro Anmeldeversuch. Bei Bedarf alte Zeilen periodisch
-- löschen, z. B. via pg_cron:
--   delete from public.signup_attempts where created_at < now() - interval '7 days';
