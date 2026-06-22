const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY")!;
const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Verifiziert ein Cloudflare-Turnstile-Token serverseitig.
// Gibt true nur bei nachweislich erfolgreicher Challenge zurück.
export async function verifyTurnstile(
  token: string,
  ip: string | null,
): Promise<boolean> {
  if (!token) return false;

  const body = new FormData();
  body.append("secret", TURNSTILE_SECRET);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);

  let res: Response;
  try {
    res = await fetch(VERIFY_URL, { method: "POST", body });
  } catch {
    return false;
  }
  if (!res.ok) return false;

  const data = await res.json().catch(() => null);
  return data?.success === true;
}
