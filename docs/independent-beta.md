# Harmonious: independent account beta

Status: the application is prepared and the Harmonious beta Supabase project has been created. Cloudflare deployment and real email delivery still need configuration. See [deployment-status.md](deployment-status.md) for the verified setup state. No tester accounts have been created.

## What this build does

The existing radial map editor, shared comparison canvas, reference maps, co-signs, and pods run on a standard Cloudflare Worker. Supabase provides managed email-code authentication and PostgreSQL storage. Testers do not need ChatGPT accounts.

Each invited email address gets one authenticated identity, a display name, and an initially private worldview with three frames. The same identity opens the same saved maps after signing out or using another device. Display names are visible within the beta; email addresses are not included in shared workspace responses.

Map settings let the owner choose **Only me** or **All beta participants**. Reference maps are also private until explicitly shared. Only owners edit their maps. Participants may copy or co-sign visible nodes; they can edit their own adopted copies. Co-signs on shared source maps disclose the person's display name and selected wording, without exposing the person's private destination map. Comparisons are private to the person recording them. There is no shared editing of a single map in this release.

Valid node form edits save after a short pause. Map changes, recorded comparisons, co-signs and withdrawals also save automatically. Unrecorded comparison drafts still need **Record comparison**; incomplete node/connection forms stay on the page and trigger the existing leave warning. A save failure retains local work, shows a message, and offers retry and backup. Another person's activity refreshes about every 30 seconds when the local page has no pending edits or open dialog. **Refresh maps** requests it immediately.

Changing a shared map back to private removes its current contents from other people's views. Copies and the snapshots in their earlier comparisons or endorsements remain theirs. Private unpublished wording versions are redacted from other people's responses, even when a later version is shared. An unavailable comparison source has a placeholder with its previously recorded comparison snapshot preserved.

## Services and configuration

Use the project owner’s [Harmonious GitHub repository](https://github.com/tlrdevere/harmonious), approved for public source publication. GitHub and Supabase are connected. Cloudflare can connect to this repository for builds. The original Sites checkout retains its deployment manifest and resources for rollback; this independent checkout does not carry that Site identity.

1. Create/select a Supabase project, then apply `supabase/migrations/20260908233252_harmonious_accounts.sql` once. Apply migrations through the connected project or the Supabase SQL editor. The migration creates the account record store, atomic save RPC, and access restrictions. It does not modify existing Sites/D1 data.
2. Configure an SMTP provider in Supabase Auth so sign-in emails can reach actual testers. The default Supabase sender is limited to project-team email addresses. New free-plan projects also require custom SMTP before changing Auth email templates, following [Supabase’s June 2026 change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier). Set the **Magic Link** email template to `supabase/templates/magic-link.html`, which displays the email OTP. Set the Auth Site URL to the intended Harmonious origin. Keep email rate limits enabled. These are prerequisites for testing email delivery.
3. Run `npm ci`, `npm test`, `npm run test:accounts`, and `npm run build`. The output is `build/cloudflare/worker.mjs`.
4. In Cloudflare, create/select the Worker named by `wrangler.jsonc` and connect the repository. The build command is `npm run build`, and the deployment command is `npm run deploy`. Set the five runtime values below as Worker secrets. Use a dedicated preview Worker/project if production accounts already exist.
5. Publish the preview and run the acceptance flow below. Publish a second change to confirm the ongoing edit/deploy path before moving testers over. Keep the previous Sites app available until that handoff succeeds.

| Worker runtime value | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact HTTPS origin, without a trailing slash, of this deployment. Requests and session cookies are tied to this origin. |
| `SUPABASE_URL` | Exact HTTPS project origin, without a trailing slash. |
| `SUPABASE_PUBLISHABLE_KEY` | Project publishable key used by the Worker for Auth requests. |
| `SUPABASE_SECRET_KEY` | Server-only `sb_secret_…` key used for the database RPCs. Never put it in frontend code, a repository, or a chat message. |
| `BETA_INVITE_EMAILS` | Comma- or newline-separated invited email addresses. An empty/missing list disables sign-in. Each authenticated request rechecks membership. |

For CLI deployment, configure secrets with `wrangler secret put NAME`, entering values through its secure prompt. Do not embed values in command arguments. Cloudflare's secret dashboard is also suitable. `.dev.vars.example` documents local development values; `.dev.vars` is ignored by Git. No live secrets are included in the source or generated Worker.

The Auth flow uses Supabase's OTP, verify, user and refresh endpoints. Access and refresh tokens are kept in Secure, HttpOnly, SameSite cookies, with host-only names in HTTPS deployments. Application scripts cannot read them. Writes require the exact same-origin header and JSON content type. The Worker checks the authenticated identity and permissions before calling the database. The database denies direct anonymous/authenticated table and RPC access; only the server service role may execute these functions. The RPCs run with the caller’s existing privileges (`SECURITY INVOKER`), with explicit grants for the two application tables and the account-ID existence check. Do not replace that boundary with a browser-side service key.

## Storage and migration behavior

Maps, wording histories, co-sign records, comparisons, and profiles have independent stored revisions and owners. A save sends only changed owned records. PostgreSQL commits a batch atomically; an ownership or revision failure rolls back the entire batch. A short generation lock ensures the source wording validated for a co-sign cannot change during that commit. Unrelated writes can retry automatically; a stale write to the same record requires review instead of silently overwriting data.

For this small beta the Worker reads a bounded snapshot and projects the private/shared view before responding. The original prototype limits (100 maps, 500 participants, 15,000 wording identities, 10,000 co-sign records, 2,000 nodes per map) remain global beta limits, not a claim of production-scale capacity. Read queries and membership calculations will need indexing and pagination before increasing those limits substantially. This implementation does not add AI equivalence matching, multi-parent placement, or live collaborative editing.

**Import maps** accepts previous workspace JSON and creates private copies owned by the signed-in user, with new map and wording identities. It does not impersonate the earlier participant names or convert facilitator-recorded endorsements into authenticated co-signs. The original file retains its earlier comparison history and endorsements; keep that backup. A later explicit migration can assign original records to verified users after they confirm ownership.

## Acceptance checks before inviting testers

- Sign in with two different invited email addresses. Verify real code delivery, sign-out, and access again from a fresh browser session/device.
- Each person starts with their own private three-frame map. Confirm neither can read or write the other's private map, including through API requests.
- One person shares a map; both co-sign one node. Both should see two unique people in the shared node's membership, while adopted personal maps remain private.
- Edit maps in both accounts and confirm both saves persist. Edit the same map in two sessions and confirm an older save is rejected without losing the page's unsaved work.
- Make a shared source private again. Confirm current private wording disappears, while the other person's copied nodes and recorded comparison snapshots remain.
- Publish a second preview update and confirm the same accounts and data survive it.

The automated suites cover the permission/projection rules, Auth/session protocol with mocked provider responses, two-account behavior against real embedded PostgreSQL, rollback, revisions, and build assets. They do not establish real provider delivery, a live Cloudflare deployment, or visual/browser interaction quality. Those remain acceptance work once service access is connected.

References: [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase session behavior](https://supabase.com/docs/guides/auth/sessions), [Cloudflare builds](https://developers.cloudflare.com/workers/ci-cd/builds/).
