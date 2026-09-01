# My First Volo

Product-neutral, read-only educator account home for First Volo Story Builder, First Volo Morphology, and Primo Volo.

Run a static server from this directory, for example `python3 -m http.server 8787`, then open `http://127.0.0.1:8787/`.

The site uses the existing Supabase project with its browser-safe publishable key. Auth sessions are persistent and entitlement reads are scoped to the authenticated user by Supabase RLS. No service-role key, entitlement write path, product-progress sync, or local progress mutation exists here.

Return targets are product keys (`storyBuilder`, `morphology`, `primoVolo`) resolved through a fixed allowlist in `js/auth-return-targets.js`; arbitrary URLs are ignored. Before public deployment, register the production `auth-callback.html` URL in Supabase Auth allowed redirect URLs and replace only the fixed product destination constants with approved production URLs.
