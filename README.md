# tosië – landing

Static landing page. Kein Build-Step. Direkt deploybar auf Netlify.

## Vor Go-Live ersetzen

1. **Newsletter-Link** – in `index.html` 2× `DEIN_NEWSLETTER_LINK` ersetzen
   (einmal im `href`, einmal im QR-`data=`-Param). Beide müssen identisch sein,
   sonst zeigt der QR-Code auf eine andere URL als der Klick.
2. **E-Mail Impressum** – in `impressum.html` `DEINE_EMAIL@example.com` ersetzen.
   Pflicht nach § 5 DDG (Telefon allein reicht nicht zwingend; E-Mail ergänzen).
3. **Hero-Bild** – `assets/hero.jpg` ist ein weicher Platzhalter-Verlauf in
   Markenfarben. Echtes Foto gleich benennen (`hero.jpg`) und überschreiben.

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
    index.html        Landing
    impressum.html    Impressum (§5 DDG)
    styles.css        Styles (Hero-Fallback-Farbe bei fehlendem Foto)
    assets/hero.jpg   Platzhalter-Hero
    assets/favicon.svg
    netlify.toml      Config
