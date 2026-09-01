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

  async function claimLogin(classCode, studentCode) {
    const existing = await getSession();
    if (existing.error) return { status: "unavailable", context: null };
    if (existing.session && !isAnonymousSession(existing.session)) return { status: "educator-session", context: null };

    if (isAnonymousSession(existing.session)) {
      const current = await getStudentContext();
      if (current.context) return { status: "signed-in", context: current.context };
    } else {
      const anonymousResult = await client.auth.signInAnonymously();
      if (anonymousResult.error) return { status: isAnonymousProviderUnavailable(anonymousResult.error) ? "provider-unavailable" : "unavailable", context: null };
    }

    const claim = await client.rpc("claim_student_login", { p_class_code: classCode, p_student_code: studentCode });
    if (claim.error) return { status: "invalid-credentials", context: null };
    const context = firstRow(claim.data);
    return context ? { status: "signed-in", context } : { status: "invalid-credentials", context: null };
  }

  async function signOut() {
    if (client) await client.auth.signOut();
  }

  window.FirstVoloStudentAuth = { getSession, getStudentContext, isAnonymousSession, claimLogin, signOut };
}());
