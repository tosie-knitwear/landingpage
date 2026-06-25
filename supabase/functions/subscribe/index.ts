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

// Rate-Limit (Ersatz für Altcha): Versuche pro IP/Email im Zeitfenster begrenzen.
const RL_WINDOW_MIN = 60;
const RL_MAX_PER_IP = 10;
const RL_MAX_PER_EMAIL = 3;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: {
    email?: string;
    website?: string;
    source?: string;
  };
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

  // Rate-Limit: zu viele gültige Versuche pro IP oder Email im Zeitfenster?
  const since = new Date(Date.now() - RL_WINDOW_MIN * 60_000).toISOString();
  if (ip) {
    const { count } = await supabase
      .from("signup_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= RL_MAX_PER_IP) return json({ error: "rate_limited" }, 429);
  }
  {
    const { count } = await supabase
      .from("signup_attempts")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);
    if ((count ?? 0) >= RL_MAX_PER_EMAIL) return json({ error: "rate_limited" }, 429);
  }

  // Versuch protokollieren (Basis fürs Rate-Limit + Abuse-Audit).
  await supabase.from("signup_attempts").insert({ ip, email });

  const { data: existing } = await supabase
    .from("subscribers")
    .select("id,status")
    .eq("email", email)
    .maybeSingle();

  // Bereits bestätigt → neutral ok, keine Mail, kein Existenz-Leak.
  if (existing?.status === "confirmed") return json({ ok: true });

  if (existing) {
    // status zurück auf 'pending' setzen, damit auch abgemeldete Adressen
    // sich erneut anmelden können (confirm prüft auf status='pending').
    const { error } = await supabase
      .from("subscribers")
      .update({ confirm_token: token, consent_ip: ip, user_agent: ua, source, status: "pending" })
      .eq("id", existing.id);
    if (error) return json({ error: "server_error" }, 500);
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
