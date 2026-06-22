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
