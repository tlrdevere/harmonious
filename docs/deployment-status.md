# Deployment status

Verified on September 8, 2026.

## Source and database

The application is published in [tlrdevere/harmonious](https://github.com/tlrdevere/harmonious), with public source publication approved by the project owner. The [first application release](https://github.com/tlrdevere/harmonious/commit/95e5149e0b7771c13600314ddbcb288591319d0d) was verified against the tested local source. The framework, original license, and prior-art notice are preserved.

The [Harmonious beta Supabase project](https://supabase.com/dashboard/project/hpjsieqbpnazpnjtyzdv) is active in the **Unanimous-Lovable** organization, in **us-east-1**. Supabase quoted **$0/month** for creating this project in that organization. Hosting and email service configuration remain separate.

The `20260908233252_harmonious_accounts` database migration is applied. The checked-in migration filename matches Supabase's recorded version. The older inactive projects were not used for this beta.

## Verified

- A fresh dependency installation, all application tests, account/autosave tests, PostgreSQL tests, and the independent Worker build pass.
- Cloudflare's deployment dry run accepts the Worker package; no live Worker has been published.
- Both application tables have row-level security enabled. Anonymous and authenticated browser roles have no direct table or RPC access.
- The server service role can use the snapshot and commit RPCs. Those functions use `SECURITY INVOKER`, so they do not elevate their caller's privileges.
- The service role can check account IDs but cannot select account email addresses from `auth.users` through SQL. Auth endpoints still verify the signed-in user on each application request.
- A live database check confirmed an empty initial snapshot and rejection of an unknown account. It wrote no data and created no tester accounts.

Supabase's security advisor reports two informational [RLS Enabled No Policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). This matches the deliberate server-only access model: browser roles are denied, and the Worker validates identity, ownership, source visibility, and revisions before using the service role. No permissive browser policies should be added to silence those notices.

## Remaining setup

1. Connect an authorized Cloudflare account, configure the Worker runtime values described in [independent-beta.md](independent-beta.md), and publish the preview.
2. Configure a custom email sender in Supabase, apply the email-code template, and set the Auth Site URL to that preview's origin. New free-plan projects need custom SMTP to customize Auth email templates; see [Supabase's June 2026 change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).
3. Configure the invited-email list and the server-only Supabase secret in the hosting account. Keep their values out of GitHub and chat.
4. Complete the two-person sign-in, privacy, co-sign, and cross-session acceptance checks described in the beta notes. Real email delivery, hosted sessions, and browser interaction have not yet been tested.

The Supabase connection currently exposes database and project operations, but no Auth-settings or server-secret management operation. Those configuration steps require the corresponding dashboard controls or an authorized management connection; database SQL is not a substitute for configuring Auth.
