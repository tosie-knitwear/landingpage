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
