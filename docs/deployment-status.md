# Deployment status

Verified on September 9, 2026 (UTC).

## Source and database

The application is published in [tlrdevere/harmonious](https://github.com/tlrdevere/harmonious), with public source publication approved by the project owner. The [first application release](https://github.com/tlrdevere/harmonious/commit/95e5149e0b7771c13600314ddbcb288591319d0d) was verified against the tested local source. The framework, original license, and prior-art notice are preserved.

The [Harmonious beta Supabase project](https://supabase.com/dashboard/project/hpjsieqbpnazpnjtyzdv) is active in the **Unanimous-Lovable** organization, in **us-east-1**. Supabase quoted **$0/month** for creating this project in that organization. Hosting and email service configuration remain separate.

The `20260908233252_harmonious_accounts` database migration is applied. The checked-in migration filename matches Supabase's recorded version. The older inactive projects were not used for this beta.

## Verified

- A fresh dependency installation, all application tests, account/autosave tests, PostgreSQL tests, and the independent Worker build pass.
- Cloudflare's deployment dry run accepts the Worker package. The first live deployment is published at https://harmonious-beta.tlrdevere.workers.dev.
- The application and account suites, including embedded PostgreSQL, pass. A Windows line-ending build failure was fixed in commit `ce1d64e2e3b9da35ef95c73dc51ccb727ec9031f`; the build and generated-Worker tests then passed.
- Live checks return HTTP 200 for the homepage, beta boot module, application module, and account stylesheet; configuration-file URLs return 404. Account/session endpoints return 503 with `configured:false`, correctly keeping sign-in disabled until configuration is complete.
- Both application tables have row-level security enabled. Anonymous and authenticated browser roles have no direct table or RPC access.
- The server service role can use the snapshot and commit RPCs. Those functions use `SECURITY INVOKER`, so they do not elevate their caller's privileges.
- The service role can check account IDs but cannot select account email addresses from `auth.users` through SQL. Auth endpoints still verify the signed-in user on each application request.
- A live database check confirmed an empty initial snapshot and rejection of an unknown account. It wrote no data and created no tester accounts.

Supabase's security advisor reports two informational [RLS Enabled No Policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). This matches the deliberate server-only access model: browser roles are denied, and the Worker validates identity, ownership, source visibility, and revisions before using the service role. No permissive browser policies should be added to silence those notices.

## Cloudflare deployment

- Account: `de8bd4e6fd63290ed1f91b607d1f6b56`.
- Worker: `harmonious-beta`.
- URL: https://harmonious-beta.tlrdevere.workers.dev
- First deployment ID: `b2b906d2cf4f48198645091cb06553a9`.
- Source: `ce1d64e2e3b9da35ef95c73dc51ccb727ec9031f`, built locally and uploaded through the Cloudflare API.
- Compatibility date: `2026-09-08`. Workers.dev enabled; alternate preview URLs disabled so the configured application origin remains exact.
- Encrypted runtime bindings configured and verified: `APP_ORIGIN`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`.
- Encrypted server secret `SUPABASE_SECRET_KEY` is now installed with owner approval.
- Public signup uses `SIGNUP_MODE=public`, `TURNSTILE_SITE_KEY`, and `SUPABASE_CAPTCHA_ENABLED=true`; no invitation list is needed.
- Current deployment ID: `d37341ffe38f4245abd77176d22b5baf` (September 9, 2026 UTC).
- A live compatibility issue with calling Cloudflare fetch as a class method was fixed by wrapping the default fetcher in both Auth and database clients.
- Automatic GitHub deployment is not connected. Cloudflare's repository-connection API reports the Git account is disconnected; the dashboard connection flow requires GitHub sign-in. No build token or build trigger exists.

## Remaining setup

1. Sign in to Supabase and securely configure the server-only Supabase secret and invited-email list in this Worker's runtime secrets. Keep both values out of GitHub and chat.
2. Configure custom SMTP in Supabase, apply `supabase/templates/magic-link.html`, and set the Auth Site URL to `https://harmonious-beta.tlrdevere.workers.dev`. No Auth settings or email delivery were changed or verified during this deployment.
3. Complete Cloudflare's GitHub connection for `tlrdevere/harmonious`, limited to the intended repository. Use production branch `main`, repository root, build command `npm run build`, and deploy command `npm run deploy`.
4. Verify a second deployment through the connected GitHub build.
5. Complete the two-person sign-in, privacy, co-sign, and cross-session acceptance checks in the beta notes. The beta is hosted but is not yet ready for testers; no tester accounts were created.

The Supabase connection currently exposes database and project operations, but no Auth-settings or server-secret management operation. Those configuration steps require the corresponding dashboard controls or an authorized management connection; database SQL is not a substitute for configuring Auth.

## Email and public signup configuration

- Resend domain harmonious.forum is verified; required TXT and two CNAME records are saved at Spaceship.
- Supabase custom SMTP is enabled with smtp.resend.com:465, username resend, sender Harmonious <noreply@harmonious.forum>, and a sending-only domain-restricted Resend key. The key is saved privately in Supabase.
- Supabase Magic Link/OTP template contains the repository’s sign-in code template. Auth Site URL is https://harmonious-beta.tlrdevere.workers.dev.
- Native Supabase CAPTCHA is enabled using the Harmonious Turnstile widget (managed, no pre-clearance), restricted to harmonious-beta.tlrdevere.workers.dev and harmonious.forum.
- Public session endpoint returns 200/configured:true; unauthenticated workspace returns 401; private configuration paths return 404. Missing and invalid CAPTCHA requests return 400.
- Public signup, CAPTCHA forwarding/expiry/errors, account isolation, PostgreSQL, autosave, and generated-Worker checks pass. Full real email and two-person browser acceptance remain outstanding.

