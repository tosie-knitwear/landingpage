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
