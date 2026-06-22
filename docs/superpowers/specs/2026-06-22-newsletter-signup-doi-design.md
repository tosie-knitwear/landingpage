# Newsletter-Signup mit Double-Opt-In — Design

**Datum:** 2026-06-22
**Projekt:** tosië Landing (`05_TosieMe`)
**Status:** Design — genehmigt

## Ziel

Besucher landet auf der Landing, trägt seine Email-Adresse ein, erhält eine
Double-Opt-In-Mail (DOI), bestätigt per Link → Status `confirmed`. Tracking der
Subscriber in einem Supabase-Projekt. Der bestehende QR-Code bleibt erhalten,
ändert aber seinen Zweck: er kodiert die Landing-URL selbst, damit die GF die
Seite am Handy zeigen kann und die Community sie scannt und selbst landet.

## Nicht-Ziele (YAGNI)

- Keine weiteren Formularfelder jetzt (in Arbeit) — nur Email. Schema hält per
  `jsonb`-Spalte Platz für spätere Felder.
- Kein Unsubscribe-Flow in dieser Iteration (Status-Feld lässt ihn später zu).
- Kein Admin-/Export-UI. Subscriber werden in Supabase eingesehen.
- Kein Newsletter-Versand selbst — nur Erfassung + DOI.

## Architektur

Edge-Function-basiert, Tabelle RLS-dicht (Variante A aus Brainstorming):

```
Browser (Form)
   │  POST email
   ▼
[subscribe]  Edge Function (public, verify_jwt=false)
   │  - validiert Email + Honeypot
   │  - Upsert pending-Row mit confirm_token (Service-Role)
   │  - sendDoiEmail() → Resend → DOI-Mail mit Confirm-Link
   ▼
Subscriber-Postfach → klickt Link
   │  GET ?token=
   ▼
[confirm]  Edge Function (public, GET)
   │  - Token → status=confirmed, confirmed_at, Token löschen
   │  - 302 Redirect → /confirmed
   ▼
confirmed.html (Danke-Seite auf der Landing)
```

Die Tabelle ist für `anon` **nicht** schreibbar. Alle Schreibzugriffe laufen
über die Edge Functions mit Service-Role-Key. Email-Existenz wird nach außen
nie verraten (idempotente, neutrale Antwort).

## Komponenten

### Frontend

**`index.html`** — QR-Card-Block wird ersetzt durch einen Card-Block mit:
- Email-Signup-Form (1 Feld + Submit-Button) als primärer CTA
- Honeypot-Feld (versteckt, Spam-Schutz)
- QR-Code (statisches SVG) als sekundäres Element mit Caption „Scannen & teilen"
- ARIA-Live-Region für Status-Feedback

**`styles.css`** — Form-Styles im bestehenden Card-Look (Cormorant/Inter,
CSS-Variablen-Palette). Zustände: idle / sending / success / error.

**`assets/signup.js`** — Vanilla JS, kein Build:
- Submit-Handler: `fetch` POST an `subscribe`-Function-URL
- Konstanten: `SUBSCRIBE_URL`, `SUPABASE_ANON_KEY` (public-safe, publishable)
- Client-seitige Email-Validierung + Honeypot-Check vor dem Senden
- States rendern, Form bei Erfolg durch „Check deine Mails" ersetzen, QR bleibt

**`assets/qr.svg`** — statisch generiertes QR-SVG, kodiert
`https://tosie-knitwear.de`. Kein externer API-Call (vorher `api.qrserver.com`).
Generiert mit `segno` (pure Python, keine Laufzeit-Abhängigkeit).

**`confirmed.html`** — Danke-Seite im Landing-Look („Bestätigt — willkommen").

### Datenbank (`supabase/migrations/<ts>_subscribers.sql`)

```sql
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
-- KEINE Policies für anon/authenticated → nur Service-Role schreibt/liest.

create index on public.subscribers (confirm_token);
```

- `email citext unique` — case-insensitive Eindeutigkeit.
- `extra jsonb` — Reserve für spätere Felder ohne Migration.
- `consent_ip` + `created_at` + `confirmed_at` — DSGVO-DOI-Nachweis.

### Edge Functions (`supabase/functions/`)

**`_shared/cors.ts`** — CORS-Header, Origin auf `ALLOWED_ORIGIN` begrenzt,
OPTIONS-Preflight.

**`_shared/email.ts`** — `sendDoiEmail(to, confirmUrl)`, isolierter Resend-Aufruf.
Einziger Provider-Berührungspunkt → später ohne Architektur-Umbau tauschbar.

**`subscribe/index.ts`** (public, `verify_jwt=false`):
1. CORS / OPTIONS
2. Email parsen + validieren, Honeypot prüfen (gefüllt → still `{ok:true}`)
3. Upsert `pending`-Row mit frischem `confirm_token`, `consent_ip`, `user_agent`,
   `source` (Service-Role). Bereits `confirmed` → no-op, neutral `{ok:true}`.
4. `sendDoiEmail()` mit Link `…/confirm?token=<token>`
5. Antwort `{ok:true}` (immer neutral, kein Existenz-Leak)

**`confirm/index.ts`** (public, GET):
1. `token` aus Query lesen
2. `pending`-Row per Token finden → `status=confirmed`, `confirmed_at=now()`,
   `confirm_token=null`
3. 302-Redirect auf `CONFIRM_REDIRECT_URL` (`/confirmed`). Ungültig/abgelaufen →
   Redirect auf `/confirmed?status=invalid` (neutrale Meldung).

### Konfiguration

**Netlify (`netlify.toml`):** Pretty-URL `/confirmed → /confirmed.html`.

**Supabase Secrets (vom User gesetzt):**
- `RESEND_API_KEY`
- `ALLOWED_ORIGIN` (z.B. `https://tosie-knitwear.de`)
- `CONFIRM_REDIRECT_URL` (z.B. `https://tosie-knitwear.de/confirmed`)
- Service-Role-Key ist in Functions automatisch verfügbar.

**Frontend-Konstanten (`assets/signup.js`):** `SUBSCRIBE_URL`,
`SUPABASE_ANON_KEY` — beide public-safe.

## Datenfluss / Fehlerbehandlung

- Ungültige Email (client + server) → Inline-Fehler, kein Request / 400.
- Honeypot gefüllt → Server tut so als ob ok, schreibt nichts.
- Doppelte Email (pending) → neuer Token + erneute DOI-Mail (idempotent).
- Doppelte Email (confirmed) → neutral ok, keine Mail, kein Leak.
- Resend-Fehler → 500, Frontend zeigt „später erneut versuchen".
- Confirm mit ungültigem/altem Token → Redirect mit `status=invalid`.

## Sicherheit

- Tabelle RLS-dicht, keine anon-Policies.
- Functions public aber CORS-Origin-begrenzt.
- Honeypot + Email-Validierung gegen Bots.
- Keine Email-Existenz-Leaks.
- Anon-Key im Frontend ist publishable (kein Risiko).
- Keine personenbezogenen Daten in URLs außer dem opaken `confirm_token`.

## Offen bis Go-Live (außerhalb dieser Implementierung)

- **DOI-Provider final** — Default Resend, User klärt ab. Versand in `email.ts`
  isoliert → Tausch ohne Architektur-Umbau.
- **Domain in Resend verifizieren** (DNS-Records für `tosie-knitwear.de`).
- **Deployment** — User spielt Migration + Functions via Supabase CLI/Dashboard
  ein (MCP-Tools erreichen das Projekt nicht).

## Dateien

| Datei | Aktion |
|---|---|
| `index.html` | QR-Card → Form + QR-SVG-Block |
| `styles.css` | Form-/State-Styles |
| `assets/signup.js` | neu — Submit-Logik |
| `assets/qr.svg` | neu — statischer QR |
| `confirmed.html` | neu — Danke-Seite |
| `netlify.toml` | `/confirmed` Pretty-URL |
| `supabase/migrations/<ts>_subscribers.sql` | neu |
| `supabase/functions/subscribe/index.ts` | neu |
| `supabase/functions/confirm/index.ts` | neu |
| `supabase/functions/_shared/cors.ts` | neu |
| `supabase/functions/_shared/email.ts` | neu |
| `README.md` | Setup-/Deploy-/Secrets-Doku |
