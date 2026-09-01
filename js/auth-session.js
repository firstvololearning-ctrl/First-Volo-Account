(function () {
  "use strict";

  const state = window.FirstVoloAccountSupabase;
  const client = state?.client;
  let user = null;
  let resolveReady;
  let settled = false;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  function settle(nextUser) {
    user = nextUser || null;
    if (!settled) {
      settled = true;
      resolveReady(user);
    }
  }

  function isExpiredSessionError(error) {
    const status = Number(error?.status || error?.statusCode);
    const text = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
    return status === 401 || text.includes("session_not_found") || text.includes("session not found") || text.includes("jwt expired") || text.includes("invalid jwt") || text.includes("invalid token") || text.includes("refresh token");
  }

  async function handleSessionError(error) {
    if (!isExpiredSessionError(error)) return false;
    user = null;
    if (client) {
      await client.auth.signOut({ scope: "local" }).catch(() => {});
    }
    window.dispatchEvent(new CustomEvent("firstvolo:session-expired"));
    return true;
  }

  function destinationForCurrentTarget() {
    const key = window.FirstVoloAccountReturnTargets.requestedKey();
    return window.FirstVoloAccountReturnTargets.destinationFor(key);
  }

  function callbackUrl(key) {
    const url = new URL("auth-callback.html", window.location.href);
    if (key) url.searchParams.set("returnTo", key);
    return url.href;
  }

  function resetRedirectUrl() {
    return new URL("reset-password.html", window.location.href).href;
  }

  async function signInWithPassword(email, password) {
    if (!client) throw state?.error || new Error("Auth unavailable");
    const result = await client.auth.signInWithPassword({ email, password });
    if (!result.error) {
      const destination = destinationForCurrentTarget();
      if (destination) window.location.replace(destination);
    }
    return result;
  }

  async function signInWithMagicLink(email) {
    if (!client) throw state?.error || new Error("Auth unavailable");
    const key = window.FirstVoloAccountReturnTargets.requestedKey();
    return client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(key), shouldCreateUser: true }
    });
  }

  async function requestPasswordReset(email) {
    if (!client) throw state?.error || new Error("Auth unavailable");
    return client.auth.resetPasswordForEmail(email, { redirectTo: resetRedirectUrl() });
  }

  async function updatePassword(password) {
    if (!client) throw state?.error || new Error("Auth unavailable");
    return client.auth.updateUser({ password });
  }

  async function completeRedirect() {
    const message = document.getElementById("callbackMessage");
    if (!client) {
      if (message) message.textContent = "Secure sign-in is unavailable.";
      return;
    }
    const result = await client.auth.getSession();
    if (result.error) {
      if (await handleSessionError(result.error)) {
        if (message) message.textContent = "Your sign-in session has expired. Please sign in again.";
        return;
      }
      if (message) message.textContent = "Sign-in could not be completed. Please return to My First Volo and try again.";
      return;
    }
    if (!result.data.session?.user) {
      if (message) message.textContent = "Sign-in could not be completed. Please return to My First Volo and try again.";
      return;
    }
    window.location.replace(destinationForCurrentTarget() || "index.html");
  }

  if (client) {
    client.auth.onAuthStateChange((_event, session) => settle(session?.user));
  } else {
    settle(null);
  }

  window.FirstVoloAccountAuth = {
    ready: () => ready,
    getUser: () => user,
    signInWithPassword,
    signInWithMagicLink,
    requestPasswordReset,
    updatePassword,
    handleSessionError,
    signOut: () => client ? client.auth.signOut() : Promise.resolve(),
    completeRedirect
  };
}());
