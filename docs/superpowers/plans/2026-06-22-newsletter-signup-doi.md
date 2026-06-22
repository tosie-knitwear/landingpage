# Newsletter-Signup mit Double-Opt-In — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Besucher trägt Email ein → Double-Opt-In-Mail → Bestätigung → `confirmed` in Supabase. QR-Code bleibt (kodiert die Landing-URL, statisches SVG).

**Architecture:** Statische Netlify-Seite. Frontend postet an Supabase Edge Function `subscribe` (schreibt `pending` + sendet DOI-Mail via Resend). Confirm-Link trifft Edge Function `confirm` (setzt `confirmed`, redirect auf `/confirmed`). Tabelle RLS-dicht, nur Service-Role schreibt.

**Tech Stack:** HTML/CSS/Vanilla-JS (kein Build), Supabase Postgres + Edge Functions (Deno/TS), Resend (Mail), segno (QR-SVG-Generierung, einmalig).

**Spec:** `docs/superpowers/specs/2026-06-22-newsletter-signup-doi-design.md`

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `assets/qr.svg` | Statischer QR-Code → `https://tosie-knitwear.de` |
| `index.html` | QR-Card-Block → Signup-Form + QR-Block |
| `styles.css` | Form-/Status-/QR-Styles, States |
| `assets/signup.js` | Submit-Logik, Client-Validierung, States |
| `confirmed.html` | Danke-Seite nach DOI |
| `netlify.toml` | `/confirmed` Pretty-URL |
| `supabase/config.toml` | `verify_jwt = false` für beide Functions |
| `supabase/migrations/20260622090000_subscribers.sql` | Tabelle + RLS |
| `supabase/functions/_shared/cors.ts` | CORS-Header |
| `supabase/functions/_shared/email.ts` | Isolierter Resend-Versand (tauschbar) |
| `supabase/functions/subscribe/index.ts` | Anmeldung + DOI-Mail |
| `supabase/functions/confirm/index.ts` | Bestätigung + Redirect |
| `README.md` | Setup / Secrets / Deploy |

**Hinweis Testing:** Statische Seite ohne Test-Runner. Verifikation pragmatisch: `deno check` für Type-Safety der Functions, lokaler HTTP-Server + Browser für Frontend, `curl` + manueller E2E nach Deploy. Kein TDD-Framework vorhanden — nicht künstlich einführen.

---

### Task 1: Statisches QR-SVG generieren

**Files:**
- Create: `assets/qr.svg`

- [ ] **Step 1: segno installieren**

Run:
```bash
pip install --break-system-packages segno
```
Expected: `Successfully installed segno-...`

- [ ] **Step 2: QR-SVG erzeugen (Palette-Farben, kein externer Call)**

Run (im Projekt-Root `C:/Users/walte/DEV/05_TosieMe`):
```bash
python -c "import segno; segno.make('https://tosie-knitwear.de', error='m').save('assets/qr.svg', scale=8, border=2, dark='#524e48', light='#faf6ef')"
```
Expected: keine Ausgabe, Datei `assets/qr.svg` existiert.

- [ ] **Step 3: Verifizieren**

Run:
```bash
head -c 120 assets/qr.svg
```
Expected: beginnt mit `<?xml` bzw. `<svg`. Datei > 1 KB.

- [ ] **Step 4: Commit**

```bash
git add assets/qr.svg
git commit -m "feat: statisches QR-SVG (Landing-URL, kein API-Call)"
```

---

### Task 2: Danke-Seite + Netlify Pretty-URL

**Files:**
- Create: `confirmed.html`
- Modify: `netlify.toml`

- [ ] **Step 1: `confirmed.html` anlegen**

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>tosië – bestätigt</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="landing">
    <div class="content">
      <h1>tosië</h1>
      <p class="claim">soft beginnings</p>
      <p class="teaser" id="confirm-msg">Bestätigt – schön, dass du dabei bist.</p>
    </div>
    <footer class="legal"><a href="impressum.html">Impressum</a></footer>
  </main>
  <script>
    if (new URLSearchParams(location.search).get("status") === "invalid") {
      document.getElementById("confirm-msg").textContent =
        "Link ungültig oder abgelaufen. Bitte melde dich erneut an.";
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Pretty-URL in `netlify.toml` ergänzen**

Nach dem bestehenden `/impressum`-Redirect einfügen:
```toml
[[redirects]]
  from = "/confirmed"
  to = "/confirmed.html"
  status = 200
```

- [ ] **Step 3: Verifizieren**

Run:
```bash
python -m http.server 8777 >/dev/null 2>&1 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8777/confirmed.html
pkill -f "http.server 8777"
```
Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add confirmed.html netlify.toml
git commit -m "feat: DOI-Danke-Seite + /confirmed Pretty-URL"
```

---

### Task 3: Frontend Signup-UI (Form ersetzt Newsletter-Link, QR bleibt)

**Files:**
- Modify: `index.html` (QR-Card-Block, Zeilen ~28-37)
- Modify: `styles.css` (`.qr-card`-Styles ersetzen)
- Create: `assets/signup.js`

- [ ] **Step 1: QR-Card-Block in `index.html` ersetzen**

Ersetze den kompletten `<a class="qr-card">…</a>`-Block durch:
```html
      <div class="signup-card">
        <form id="signup" novalidate>
          <label class="visually-hidden" for="email">Email-Adresse</label>
          <input id="email" name="email" type="email" inputmode="email"
                 autocomplete="email" placeholder="deine@email.de" required />
          <!-- Honeypot: für Menschen unsichtbar, Bots füllen es aus -->
          <input class="hp" type="text" name="website" tabindex="-1"
                 autocomplete="off" aria-hidden="true" />
          <button type="submit">JOIN THE LAUNCH LIST</button>
        </form>
        <p id="signup-status" role="status" aria-live="polite"></p>

        <div class="qr">
          <img src="assets/qr.svg" alt="QR-Code zu tosie-knitwear.de"
               width="150" height="150" loading="lazy" />
          <span>Scannen &amp; teilen</span>
        </div>
      </div>
```

- [ ] **Step 2: Script vor `</body>` einbinden**

In `index.html` direkt vor `</body>`:
```html
  <script src="assets/signup.js" defer></script>
```

- [ ] **Step 3: `.qr-card`-Styles in `styles.css` durch Signup-Styles ersetzen**

Ersetze die Blöcke `.qr-card`, `.qr-card:hover`, `.qr-card img`, `.qr-card span` durch:
```css
.signup-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding: 40px 44px 34px;
  background: var(--card-bg);
  border-radius: 34px;
  box-shadow: 0 22px 55px var(--card-shadow);
  backdrop-filter: blur(4px);
}

#signup {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(78vw, 320px);
}

#signup input[type="email"] {
  font-family: "Inter", sans-serif;
  font-size: 15px;
  padding: 14px 18px;
  border: 1px solid var(--mist);
  border-radius: 999px;
  background: var(--cream-light);
  color: var(--ink);
  text-align: center;
  letter-spacing: 0.04em;
}

#signup input[type="email"]:focus {
  outline: none;
  border-color: var(--blush-deep);
}

#signup button {
  font-family: "Inter", sans-serif;
  font-size: 13px;
  letter-spacing: 0.34em;
  padding: 14px 18px;
  border: none;
  border-radius: 999px;
  background: var(--blush-deep);
  color: var(--ink);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

#signup button:hover { transform: translateY(-2px); }
#signup button:disabled { opacity: 0.6; cursor: default; transform: none; }

/* Honeypot komplett aus dem Blickfeld */
.hp {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0);
  white-space: nowrap; border: 0;
}

#signup-status {
  margin: 4px 0 0;
  min-height: 1.2em;
  font-family: "Inter", sans-serif;
  font-size: 13px;
  letter-spacing: 0.02em;
  color: var(--ink-soft);
}
#signup-status[data-state="error"] { color: #b06a5a; }
#signup-status[data-state="success"] { color: var(--ink); }

/* Erfolg: Form ausblenden, QR bleibt sichtbar */
.signup-card.is-done #signup { display: none; }

.qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding-top: 6px;
}
.qr img { width: 150px; height: 150px; display: block; }
.qr span {
  font-family: "Inter", sans-serif;
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-muted);
}
```

- [ ] **Step 4: Responsive-Block anpassen**

In der `@media (max-width: 600px)`-Regel den `.qr-card`-Eintrag ersetzen durch:
```css
  .signup-card {
    padding: 32px 28px 28px;
    border-radius: 28px;
  }
  .qr img { width: 130px; height: 130px; }
```

- [ ] **Step 5: `assets/signup.js` anlegen**

```js
// Beide Werte sind public-safe (publishable). Vor Go-Live ausfüllen:
const SUBSCRIBE_URL =
  "https://ovvnhpbuoylaovkhhpts.supabase.co/functions/v1/subscribe";
const SUPABASE_ANON_KEY = "PASTE_ANON_KEY_HERE";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const form = document.getElementById("signup");
const statusEl = document.getElementById("signup-status");
const card = document.querySelector(".signup-card");

function setStatus(msg, state) {
  statusEl.textContent = msg;
  statusEl.dataset.state = state || "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  const website = form.website.value; // Honeypot

  if (!EMAIL_RE.test(email)) {
    setStatus("Bitte eine gültige Email eingeben.", "error");
    return;
  }

  const btn = form.querySelector("button");
  btn.disabled = true;
  setStatus("Senden …", "sending");

  try {
    const res = await fetch(SUBSCRIBE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, website, source: "landing" }),
    });
    if (!res.ok) throw new Error(String(res.status));
    card.classList.add("is-done");
    setStatus("Fast geschafft – check deine Mails und bestätige die Anmeldung.", "success");
  } catch {
    setStatus("Hat nicht geklappt. Bitte später erneut versuchen.", "error");
    btn.disabled = false;
  }
});
```

- [ ] **Step 6: Lokal rendern + visuell prüfen**

Run:
```bash
python -m http.server 8777 >/dev/null 2>&1 &
sleep 1
curl -s http://localhost:8777/index.html | grep -c "signup-card"
pkill -f "http.server 8777"
```
Expected: `1` (Form-Block vorhanden). Optional Browser: Form + QR sichtbar, Layout intakt.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css assets/signup.js
git commit -m "feat: Email-Signup-Form (QR bleibt) ersetzt Newsletter-Link"
```

---

### Task 4: DB-Migration `subscribers`

**Files:**
- Create: `supabase/migrations/20260622090000_subscribers.sql`

- [ ] **Step 1: Migration schreiben**

```sql
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
```

- [ ] **Step 2: SQL-Syntax lokal grob prüfen**

Run:
```bash
grep -c "create table public.subscribers" supabase/migrations/20260622090000_subscribers.sql
```
Expected: `1`

Hinweis: Tatsächliche Ausführung erfolgt beim Deploy durch den User
(`supabase db push` bzw. SQL-Editor) — MCP-Tools erreichen das Projekt nicht.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260622090000_subscribers.sql
git commit -m "feat: subscribers-Tabelle (RLS-dicht, jsonb-Reserve)"
```

---

### Task 5: Shared Helpers + Function-Config

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/email.ts`
- Create: `supabase/config.toml`

- [ ] **Step 1: `cors.ts`**

```ts
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function handleOptions(): Response {
  return new Response("ok", { headers: corsHeaders });
}
```

- [ ] **Step 2: `email.ts` (isolierter Resend-Versand)**

```ts
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = Deno.env.get("DOI_FROM") ?? "tosië <hello@tosie-knitwear.de>";

export async function sendDoiEmail(
  to: string,
  confirmUrl: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: "Bitte bestätige deine Anmeldung – tosië",
      html: doiHtml(confirmUrl),
      text: `Bestätige deine Anmeldung bei tosië: ${confirmUrl}`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  }
}

function doiHtml(confirmUrl: string): string {
  return `<!doctype html><html><body style="font-family:Georgia,serif;color:#524e48;background:#f4ece1;padding:40px">
  <div style="max-width:480px;margin:0 auto;background:#faf6ef;border-radius:24px;padding:40px;text-align:center">
    <h1 style="font-weight:300;letter-spacing:-.02em;margin:0 0 8px">tosië</h1>
    <p style="letter-spacing:.2em;color:#6f6860;margin:0 0 32px">soft beginnings</p>
    <p style="margin:0 0 28px">Schön, dass du dabei sein willst. Bitte bestätige deine Anmeldung:</p>
    <a href="${confirmUrl}" style="display:inline-block;background:#e7c6b9;color:#524e48;text-decoration:none;padding:14px 32px;border-radius:999px;letter-spacing:.1em">ANMELDUNG BESTÄTIGEN</a>
    <p style="font-size:12px;color:#9a9088;margin:32px 0 0">Falls du das nicht warst, ignoriere diese Mail einfach.</p>
  </div></body></html>`;
}
```

- [ ] **Step 3: `config.toml` (Functions public schalten)**

```toml
[functions.subscribe]
verify_jwt = false

[functions.confirm]
verify_jwt = false
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/cors.ts supabase/functions/_shared/email.ts supabase/config.toml
git commit -m "feat: shared cors + resend helper, functions public config"
```

---

### Task 6: Edge Function `subscribe`

**Files:**
- Create: `supabase/functions/subscribe/index.ts`

- [ ] **Step 1: Implementieren**

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { sendDoiEmail } from "../_shared/email.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Confirm-Function-URL aus der auto-injizierten SUPABASE_URL ableiten.
const CONFIRM_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1/confirm`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: { email?: string; website?: string; source?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // Honeypot gefüllt → Bot. Neutral ok, nichts schreiben.
  if (payload.website && payload.website.trim() !== "") {
    return json({ ok: true });
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);

  const token = crypto.randomUUID();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;
  const source = payload.source ?? null;

  const { data: existing } = await supabase
    .from("subscribers")
    .select("id,status")
    .eq("email", email)
    .maybeSingle();

  // Bereits bestätigt → neutral ok, keine Mail, kein Existenz-Leak.
  if (existing?.status === "confirmed") return json({ ok: true });

  if (existing) {
    await supabase
      .from("subscribers")
      .update({ confirm_token: token, consent_ip: ip, user_agent: ua, source })
      .eq("id", existing.id);
  } else {
    const { error } = await supabase.from("subscribers").insert({
      email, confirm_token: token, consent_ip: ip, user_agent: ua, source,
    });
    if (error) return json({ error: "server_error" }, 500);
  }

  try {
    await sendDoiEmail(email, `${CONFIRM_BASE}?token=${token}`);
  } catch {
    return json({ error: "server_error" }, 500);
  }

  return json({ ok: true });
});
```

- [ ] **Step 2: Type-Check**

Run:
```bash
deno check supabase/functions/subscribe/index.ts
```
Expected: kein Fehler (ggf. lädt Deno erst die Remote-Imports). Falls `deno` fehlt: Schritt überspringen, Check beim Deploy via `supabase functions deploy`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/subscribe/index.ts
git commit -m "feat: subscribe edge function (DOI-Mail, idempotent, kein Leak)"
```

---

### Task 7: Edge Function `confirm`

**Files:**
- Create: `supabase/functions/confirm/index.ts`

- [ ] **Step 1: Implementieren**

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Danke-Seite auf der Landing, z.B. https://tosie-knitwear.de/confirmed
const REDIRECT = Deno.env.get("CONFIRM_REDIRECT_URL")!;

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return redirect(`${REDIRECT}?status=invalid`);

  const { data, error } = await supabase
    .from("subscribers")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirm_token: null,
    })
    .eq("confirm_token", token)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !data) return redirect(`${REDIRECT}?status=invalid`);
  return redirect(REDIRECT);
});
```

- [ ] **Step 2: Type-Check**

Run:
```bash
deno check supabase/functions/confirm/index.ts
```
Expected: kein Fehler. Falls `deno` fehlt: beim Deploy geprüft.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/confirm/index.ts
git commit -m "feat: confirm edge function (Token -> confirmed, redirect)"
```

---

### Task 8: README — Setup, Secrets, Deploy

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Abschnitt „Vor Go-Live ersetzen" überarbeiten**

Ersetze den alten Punkt 1 (Newsletter-Link) durch Signup-Setup. Neuer Abschnitt
(ans Ende von „Vor Go-Live ersetzen" bzw. als eigener Block):

```markdown
## Newsletter-Signup (Double-Opt-In)

### Frontend
- `assets/signup.js`: `SUBSCRIBE_URL` zeigt auf die Subscribe-Function,
  `SUPABASE_ANON_KEY` mit dem **publishable** Anon-Key des Projekts füllen
  (public-safe).
- QR-Code: `assets/qr.svg` kodiert `https://tosie-knitwear.de`. Neu erzeugen mit:
  `python -c "import segno; segno.make('https://tosie-knitwear.de', error='m').save('assets/qr.svg', scale=8, border=2, dark='#524e48', light='#faf6ef')"`

### Supabase (Projekt-Ref `ovvnhpbuoylaovkhhpts`)
1. Migration einspielen: `supabase db push` (oder SQL aus
   `supabase/migrations/` im SQL-Editor ausführen).
2. Functions deployen:
   `supabase functions deploy subscribe` und `supabase functions deploy confirm`.
3. Secrets setzen:
   ```
   supabase secrets set RESEND_API_KEY=...
   supabase secrets set ALLOWED_ORIGIN=https://tosie-knitwear.de
   supabase secrets set CONFIRM_REDIRECT_URL=https://tosie-knitwear.de/confirmed
   supabase secrets set DOI_FROM="tosië <hello@tosie-knitwear.de>"
   ```
   (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` sind in Functions automatisch da.)
4. Resend: Domain `tosie-knitwear.de` verifizieren (DNS-Records), API-Key in
   `RESEND_API_KEY`. DOI-Provider final klären — Versand ist in
   `supabase/functions/_shared/email.ts` isoliert und tauschbar.

### Flow
Form → `subscribe` (pending + DOI-Mail) → User klickt Link → `confirm`
(confirmed) → Redirect `/confirmed`.
```

- [ ] **Step 2: Veraltete Newsletter-/Hero-Hinweise bereinigen**

Entferne in „Vor Go-Live ersetzen" den alten Punkt zum `DEIN_NEWSLETTER_LINK`
(existiert nicht mehr) und passe den Hero-Punkt auf `hero.webp` an.

- [ ] **Step 3: Verifizieren**

Run:
```bash
grep -c "DEIN_NEWSLETTER_LINK" README.md index.html
```
Expected: `0` in beiden (keine Platzhalter-Reste).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: Signup-/DOI-Setup, Secrets, Deploy-Schritte"
```

---

### Task 9: End-to-End-Verifikation (nach Deploy durch User)

Kein Code — Checkliste nach dem Deploy. Erst ausführen, wenn Migration +
Functions + Secrets live sind und `SUPABASE_ANON_KEY` im Frontend gesetzt ist.

- [ ] **Step 1: Subscribe per curl**

```bash
curl -i -X POST \
  "https://ovvnhpbuoylaovkhhpts.supabase.co/functions/v1/subscribe" \
  -H "Content-Type: application/json" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -d '{"email":"test@example.com","website":"","source":"verify"}'
```
Expected: `HTTP/2 200` + `{"ok":true}`. DOI-Mail trifft ein.

- [ ] **Step 2: Honeypot greift**

Gleicher Call mit `"website":"bot"` → `{"ok":true}`, aber **keine** neue Row /
keine Mail (in Supabase `subscribers` prüfen).

- [ ] **Step 3: Confirm-Link**

Link aus der Mail (oder `…/confirm?token=<token>` aus der Row) im Browser öffnen.
Expected: Redirect auf `/confirmed`, Row `status='confirmed'`, `confirmed_at`
gesetzt, `confirm_token` null.

- [ ] **Step 4: Ungültiger Token**

`…/confirm?token=00000000-0000-0000-0000-000000000000` öffnen.
Expected: Redirect auf `/confirmed?status=invalid`, Seite zeigt Ungültig-Meldung.

- [ ] **Step 5: Doppelte Anmeldung (bereits confirmed)**

Subscribe-Call mit der bestätigten Email erneut → `{"ok":true}`, **keine**
zweite Mail, Status bleibt `confirmed`.

- [ ] **Step 6: RLS-Dichte**

Mit Anon-Key direkt auf die Tabelle lesen:
```bash
curl -s "https://ovvnhpbuoylaovkhhpts.supabase.co/rest/v1/subscribers?select=*" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```
Expected: leeres `[]` bzw. Permission-Fehler — **keine** Daten (RLS-dicht).

---

## Self-Review

- **Spec-Coverage:** Form (T3), QR-SVG bleibt (T1/T3), DOI-Tabelle + jsonb + RLS
  (T4), subscribe/confirm Functions (T6/T7), shared cors/email (T5), Danke-Seite
  + Pretty-URL (T2), Secrets/Deploy-Doku (T8), DSGVO-Nachweis via consent_ip +
  Timestamps (T4/T6), Provider isoliert (T5). Alle Spec-Punkte abgedeckt.
- **Konfig-Abweichung zur Spec:** Subscribe leitet die Confirm-URL aus
  `SUPABASE_URL` ab (statt eigenem Secret) → ein Secret weniger. `DOI_FROM` als
  optionales Secret ergänzt. Bewusst, dokumentiert in T8.
- **Platzhalter:** `PASTE_ANON_KEY_HERE` ist echte User-Config (publishable),
  in T8/README erklärt — kein Plan-Platzhalter.
- **Typ-Konsistenz:** Feldnamen (`email`, `website`, `source`, `confirm_token`,
  `status`, `confirmed_at`, `consent_ip`, `user_agent`) durchgehend identisch in
  Migration, subscribe, confirm, Frontend.
```
