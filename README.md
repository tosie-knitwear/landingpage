# tosië – landing

Static landing page. Kein Build-Step. Direkt deploybar auf Netlify.

## Vor Go-Live ersetzen

1. **E-Mail Impressum** – in `impressum.html` `DEINE_EMAIL@example.com` ersetzen.
   Pflicht nach § 5 DDG (Telefon allein reicht nicht zwingend; E-Mail ergänzen).
2. **Hero-Bild** – `assets/hero.webp` ist das echte Strick-Foto der Marke.

## Newsletter-Signup (Double-Opt-In)

### Frontend
- `assets/signup.js`: `SUBSCRIBE_URL` zeigt auf die Subscribe-Function,
  `SUPABASE_ANON_KEY` mit dem **publishable** Anon-Key des Projekts füllen
  (public-safe).
- **Bot-Schutz (Cloudflare Turnstile):** in `index.html` das
  `data-sitekey="PASTE_TURNSTILE_SITE_KEY"` mit dem Turnstile-**Site-Key**
  ersetzen (public). Honeypot bleibt zusätzlich aktiv (Defense-in-Depth).
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
   supabase secrets set TURNSTILE_SECRET_KEY=...
   ```
   (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` sind in Functions automatisch da.)
4. **Resend** (finaler DOI-Provider): Domain `tosie-knitwear.de` verifizieren
   (DNS-Records), API-Key in `RESEND_API_KEY`. Versand ist in
   `supabase/functions/_shared/email.ts` isoliert (bei Bedarf tauschbar).
5. **Cloudflare Turnstile:** Widget im Dashboard anlegen → Site-Key ins Frontend
   (siehe oben), Secret-Key als `TURNSTILE_SECRET_KEY`. Verifikation in
   `supabase/functions/_shared/turnstile.ts`.

### Flow
Form → `subscribe` (pending + DOI-Mail) → User klickt Link → `confirm`
(confirmed) → Redirect `/confirmed`.

## Deploy

### A) Drag & Drop (kein Account-Setup nötig)
Ordner auf https://app.netlify.com/drop ziehen. Fertig, live URL sofort.

### B) CLI
    bun add -g netlify-cli        # oder: npm i -g netlify-cli
    netlify deploy --prod         # im Ordner ausführen, Build überspringen

Ohne Login zum schnellen Test:
    netlify deploy --prod --allow-anonymous   # claimbar innerhalb 1h

### C) Git + Continuous Deployment
Repo pushen, in Netlify verbinden. `netlify.toml` ist schon dabei
(publish = ".", Security-Header, /impressum Pretty-URL).

## Struktur
    index.html           Landing
    confirmed.html       Bestätigungsseite nach DOI
    impressum.html       Impressum (§5 DDG)
    styles.css           Styles (Hero-Fallback-Farbe)
    assets/hero.webp     Hero-Bild (Strick-Foto)
    assets/signup.js     Newsletter-Signup-Logik
    assets/qr.svg        QR-Code (tosie-knitwear.de)
    assets/favicon.svg
    supabase/            Migrations + Edge Functions (subscribe, confirm)
    netlify.toml         Config
