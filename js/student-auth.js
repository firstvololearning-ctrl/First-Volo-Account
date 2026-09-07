// Consent-checked signup; backend release and anonymous signup remain disabled.
(function () {
  "use strict";

  const client = window.FirstVoloAccountSupabase?.client;

  function firstRow(data) {
    return Array.isArray(data) ? data[0] || null : data || null;
  }

  function isAnonymousSession(session) {
    return session?.user?.is_anonymous === true;
  }

  function isAnonymousProviderUnavailable(error) {
    const status = Number(error?.status || error?.statusCode);
    const text = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
    return status === 422 || text.includes("anonymous") || text.includes("provider") || text.includes("disabled");
  }

  async function getSession() {
    if (!client) return { session: null, error: new Error("Auth unavailable") };
    const result = await client.auth.getSession();
    return { session: result.data.session || null, error: result.error || null };
  }

  async function getStudentContext() {
    const result = await client.rpc("get_student_session_context");
    if (result.error) return { context: null, error: result.error };
    return { context: firstRow(result.data), error: null };
  }

  async function getStudentProductAccess() {
    const result = await client.rpc("get_student_product_access");
    if (result.error) return { productKeys: [], error: result.error };
    return { productKeys: (result.data || []).map(item => item.product_key), error: null };
  }

  let loginPending = false;
  async function performClaimLogin(classCode, studentCode, product) {
    let signupTicket;
    const existing = await getSession();
    if (existing.error) return { status: "unavailable", context: null };
    if (existing.session && !isAnonymousSession(existing.session)) return { status: "educator-session", context: null };

    // Check codes and current permission before creating an anonymous account.
    // The database repeats authorization when claiming and on product access.
    try {
      const permission = await fetch("https://apkvvspubolyxlqtlkto.supabase.co/functions/v1/student-signup-ticket", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classCode, studentCode, product }), signal: AbortSignal.timeout(15000),
        cache: "no-store"
      });
      if (permission.status === 503 || permission.status === 429) return { status: "unavailable", context: null };
      const permit = await permission.json();
      if (!permission.ok || permit.allowed !== true || !/^[a-f0-9]{64}$/.test(permit.ticket || "")) return { status: "invalid-credentials", context: null };
      signupTicket = permit.ticket;
    } catch { return { status: "unavailable", context: null }; }

    if (isAnonymousSession(existing.session)) {
      // A new code submission must never return a previous learner’s session.
      const logout = await client.auth.signOut();
      if (logout.error) return { status: "unavailable", context: null };
    }
    {
      const anonymousResult = await client.auth.signInAnonymously({ options: { data: { signup_ticket: signupTicket } } });
      if (anonymousResult.error) return { status: isAnonymousProviderUnavailable(anonymousResult.error) ? "provider-unavailable" : "unavailable", context: null };
    }

    try {
      const claim = await client.rpc("claim_student_login", { p_class_code: classCode, p_student_code: studentCode });
      const context = firstRow(claim.data);
      if (!claim.error && context) return { status: "signed-in", context };
    } catch { /* A failed or uncertain claim must not leave a usable browser session. */ }
    try { await client.auth.signOut({ scope: "local" }); } catch { /* Retry starts with a fresh permission check. */ }
    return { status: "invalid-credentials", context: null };
  }

  async function claimLogin(classCode, studentCode, product) {
    if (loginPending) return { status: "unavailable", context: null };
    loginPending = true;
    try { return await performClaimLogin(classCode, studentCode, product); }
    catch { return { status: "unavailable", context: null }; }
    finally { loginPending = false; }
  }

  async function signOut() {
    if (client) await client.auth.signOut();
  }

  window.FirstVoloStudentAuth = { getSession, getStudentContext, getStudentProductAccess, isAnonymousSession, claimLogin, signOut };
}());
