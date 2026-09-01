(function () {
  "use strict";
  const url = "https://apkvvspubolyxlqtlkto.supabase.co";
  const publishableKey = "sb_publishable_0O4rNLfhuW18xYRZSPkLpw_xyXR9d3n";
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    window.FirstVoloAccountSupabase = { client: null, error: new Error("Supabase client unavailable") };
    return;
  }
  window.FirstVoloAccountSupabase = { client: window.supabase.createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }), error: null };
}());
