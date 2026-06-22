import { createChallenge, verifySolution } from "npm:altcha-lib@1";

// Geheimer HMAC-Key für Altcha. Signiert Challenges und prüft Lösungen.
const HMAC_KEY = Deno.env.get("ALTCHA_HMAC_KEY")!;

// Challenge mit 5-Minuten-Gültigkeit. maxNumber steuert die PoW-Schwierigkeit.
export function createAltchaChallenge() {
  return createChallenge({
    hmacKey: HMAC_KEY,
    maxNumber: 100000,
    expires: new Date(Date.now() + 5 * 60 * 1000),
  });
}

// Prüft die vom Widget gelieferte Lösung. Verifiziert Signatur + Ablauf.
export function verifyAltcha(payload: string): Promise<boolean> {
  if (!payload) return Promise.resolve(false);
  return verifySolution(payload, HMAC_KEY);
}
