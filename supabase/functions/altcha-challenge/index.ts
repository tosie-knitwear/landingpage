import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { createAltchaChallenge } from "../_shared/altcha.ts";

// Liefert eine frische Altcha-Challenge an das Widget (public, GET).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();

  const challenge = await createAltchaChallenge();
  return new Response(JSON.stringify(challenge), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
});
