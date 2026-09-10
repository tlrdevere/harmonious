# Deployment status

Updated September 10, 2026 (UTC).

## Current release

- Website: https://harmonious-beta.tlrdevere.workers.dev
- Source: [49940048c7f4001deaeedd2d2a935f50c1f8ea5d](https://github.com/tlrdevere/harmonious/commit/49940048c7f4001deaeedd2d2a935f50c1f8ea5d).
- Cloudflare account: `de8bd4e6fd63290ed1f91b607d1f6b56`; Worker: `harmonious-beta`.
- Deployment: `55463476-3331-4691-91d6-d3ecc3d02dbf`.
- Worker version: `9488030d-1602-4419-bf20-616d98570512`, serving 100% of traffic.
- Uploaded September 10, 2026 at 03:07:49 UTC, using compatibility date `2026-09-08`.
- Compare now overlays both maps in a shared frame layout, keeps source identities visible, provides A/B highlighting, and saves elicitation questions for a node or candidate pair. The owner accepted the preview. See [Compare overlay](compare-overlay.md).
- Prior Worker version: `285c5365-5503-4620-97e8-f63a334d35b4`. A rollback to it would not understand the new `needs_elicitation` comparison state; review any new records before rolling back.
- No database migration or account-data write was performed for this release. Runtime secrets were inherited and their names verified after upload.

## Accounts and email

- Supabase project: `hpjsieqbpnazpnjtyzdv`, in the Unanimous-Lovable organization, us-east-1.
- Migration `20260908233252_harmonious_accounts` is applied.
- Public signup uses `SIGNUP_MODE=public`; no invitation list is required.
- Turnstile and native Supabase CAPTCHA were disabled at the owner's request. Email verification and Supabase rate limits remain the signup controls. Previously configured Turnstile secrets remain stored but are unused by this release.
- Encrypted Worker bindings: `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `SIGNUP_MODE`. Values are kept out of source control.
- Resend's `harmonious.forum` sending domain is verified. SMTP uses `smtp.resend.com:465`, username `resend`, and sender `Harmonious <noreply@harmonious.forum>`. A sending-access API key is saved privately in Supabase.
- The owner confirmed receiving signup confirmation emails and reported two accounts working. The actual signup message contained a confirmation link; do not assume every Auth template currently sends a numeric code. The Magic Link template was configured for codes.
- Auth Site URL is `https://harmonious-beta.tlrdevere.workers.dev`.

## Verification and access boundaries

- Application, comparison, account API, embedded PostgreSQL, autosave, signup, and generated Worker checks passed before release.
- Comparison tests include 100 expansion/filter patterns, unequal trees, independent source IDs, collapsed endpoints, source snapshots, and elicitation review history.
- Live homepage and updated Compare modules return 200. The session endpoint returns 200 with `configured:true` and public signup; unauthenticated workspace returns 401; `/.dev.vars` returns 404.
- Automated visual inspection of the local preview was blocked by browser URL policy. The owner provided visual acceptance. An authenticated live save/reopen test of the new elicitation state has not been performed by the agent.
- Both application tables have RLS enabled, and browser roles cannot directly access the tables or RPCs. The Worker checks identity, ownership, visibility, and revisions before using the service role. RPCs use `SECURITY INVOKER`.
- Informational RLS-without-policy notices match this server-only access design; do not add permissive policies to silence them.
- The service role may check account IDs but cannot select account email addresses from `auth.users` through SQL.

## Next development

The owner prioritized Compare and then Argument. Argument should be a separate view built on comparison records. Pod-map design, the custom website domain, and automatic GitHub deployments are deferred.

Compare still needs semantic alignment beyond provisional sibling placement, decisions about displaying equivalent statements, and an elicitation response workflow. Argument is not implemented.

Cloudflare's GitHub build connection is not configured; this release was built locally and uploaded through the Cloudflare connector. The `harmonious.forum` domain is currently used for email; it has not been connected as the app's primary URL.

## Earlier release

The first independent deployment used source `ce1d64e2e3b9da35ef95c73dc51ccb727ec9031f`. The original license and prior-art notice remain in the repository. The initial database boundary and unknown-account rejection were verified before testers joined.
