(function () {
  "use strict";
  const state = window.FirstVoloAccountSupabase; const client = state?.client; let user = null; let resolveReady; let settled = false; const ready = new Promise(resolve => { resolveReady = resolve; });
  function settle(next) { user = next || null; if (!settled) { settled = true; resolveReady(user); } }
  function callbackUrl(key) { const url = new URL("auth-callback.html", window.location.href); if (key) url.searchParams.set("returnTo", key); return url.href; }
  async function signIn(email) { if (!client) throw state?.error || new Error("Auth unavailable"); const key = window.FirstVoloAccountReturnTargets.requestedKey(); return client.auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl(key), shouldCreateUser: true } }); }
  async function completeRedirect() { const message = document.getElementById("callbackMessage"); if (!client) { if (message) message.textContent = "Secure sign-in is unavailable."; return; } const result = await client.auth.getSession(); if (result.error || !result.data.session?.user) { if (message) message.textContent = "Sign-in could not be completed. Please return to My First Volo and try again."; return; } const key = window.FirstVoloAccountReturnTargets.requestedKey(); window.location.replace(window.FirstVoloAccountReturnTargets.destinationFor(key) || "index.html"); }
  if (client) client.auth.onAuthStateChange((_event, session) => settle(session?.user)); else settle(null);
  window.FirstVoloAccountAuth = { ready: () => ready, getUser: () => user, signIn, signOut: () => client ? client.auth.signOut() : Promise.resolve(), completeRedirect };
}());
