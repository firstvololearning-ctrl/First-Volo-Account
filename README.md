# My First Volo

Product-neutral, read-only educator account home for First Volo Story Builder, First Volo Morphology, and Primo Volo.

Run a static server from this directory, for example `python3 -m http.server 8787`, then open `http://127.0.0.1:8787/`.

The site uses the existing Supabase project with its browser-safe publishable key. Auth sessions are persistent and entitlement reads are scoped to the authenticated user by Supabase RLS. No service-role key, entitlement write path, product-progress sync, or local progress mutation exists here.

Return targets are product keys (`storyBuilder`, `morphology`, `primoVolo`) resolved through a fixed allowlist in `js/auth-return-targets.js`; arbitrary URLs are ignored. Before public deployment, register the production `auth-callback.html` URL in Supabase Auth allowed redirect URLs and replace only the fixed product destination constants with approved production URLs.

## Google educator sign-in (prepared October 29)

The account page provides Google OAuth through the existing Supabase browser client. It returns through `auth-callback.html`, retaining only the fixed Story Builder, Morphology and Primo return targets. No Google API data scopes, offline Google access, student-code changes or product entitlements are added by this code.

Before publishing/enabling this option, configure a Web application OAuth client in the intended First Volo Google Cloud project and the Google provider in Supabase. The Google-authorized redirect URI for the current production project is `https://apkvvspubolyxlqtlkto.supabase.co/auth/v1/callback`. The JavaScript origin is `https://firstvololearning-ctrl.github.io`. The browser-facing callback is separate: `https://firstvololearning-ctrl.github.io/First-Volo-Account/auth-callback.html`.

Preserve existing Site URL and redirect entries. Verify the base callback and its three explicit query variants (`?returnTo=storyBuilder`, `?returnTo=morphology`, `?returnTo=primoVolo`) in the Supabase redirect allowlist. Use only OpenID/email/profile identity scopes. Enter the client secret directly in the provider dashboard; never commit it or put it in frontend code. Keep the existing student signup release lock and anonymous-provider setting unchanged.

Provider enablement, the intended Google audience/publishing status and a real callback/account-linking check must be verified separately from the local mocked tests. Use the same verified Google email as an existing educator account when checking identity continuity; confirm existing product access remains attached to the original account. School-managed Google accounts may require their organization's approval. Do not represent this as roster or institutional SSO integration.

Official setup: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
