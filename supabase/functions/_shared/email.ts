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
