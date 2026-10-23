# Testing and service-readiness follow-ups

Recorded October 21; status updated October 23, 2026. The [Canvas / Outline presentation](off-canvas-view-plan.md) is now live in Worker 71. [Notifications](notifications-plan.md) and [sign-up/sign-in cleanup](auth-cleanup-plan.md) have separate implementation plans and are not yet implemented. The owner has deferred pods and operational backups/recovery; the requirements below are retained for when that work resumes. Provider backup settings have not been verified by this task.

## Public and private pods

The owner wants both public pods and private, invite-only pods that users or facilitators can create. Private groups must keep their content separate from unrelated users. Existing map visibility is Only me / All beta participants; that is insufficient for private group membership.

Define server-enforced pod membership and roles, invitation acceptance/expiry/revocation, content scope, and visibility of each pod's maps, nodes, Philosophy references, discussions, search results, notifications and exports. A person may belong to multiple pods without transferring their private group content between them. Membership in a private pod must not expose the member's unrelated personal maps. Publishing private material requires an explicit authorized action; no default cross-pod copying or discovery.

Decide what public means (readable to signed-in users or to the wider web), who can contribute, who may invite/remove members, what happens after removal, and whether any client needs a physically separate deployment rather than logical isolation in the shared database. Ordinary private pods can start with strict membership isolation in the current stack. User/facilitator visibility does not imply ordinary members can inspect backend-wide backups. These choices belong in the next pod discussion before implementation.

## Notifications

Recommend an in-app activity inbox with an unread count first. Notify the owner about new interactions on their maps and the appropriate participant about replies, requests and standstill responses. Each item opens the exact authorized target in the user's chosen Canvas/Outline presentation.

Generate durable events transactionally with successful publication, with stable event IDs for retry deduplication and per-recipient read state. Failed saves and private draft validation must roll back the events too. Avoid alerts for one's own actions, private drafts, autosave keystrokes or every background refresh. Marking read should be explicit/open-based, not an accidental side effect of polling. Validate access both when listing and opening; removed membership/private sources cannot leak content through old notification text. Group noisy activity and offer per-context muting. Facilitated contributions retain their existing attribution and recipient rules. The [implementation plan](notifications-plan.md) details the shared database hook and draft-safe polling.

Email summaries or alerts can be added later as opt-in delivery, with preferences/unsubscribe and limited private content. Browser push is a separate optional channel. No notification sending or scheduled automation has been enabled by recording this proposal.

## Sign-up and sign-in

Current normal accounts use a passwordless email code; no password is set. The combined form in `dist/account-ui.mjs` currently requires display name and email on every visit. Organizer-created test accounts have a separate username/password flow.

Requested cleanup: returning users sign in using email and the emailed code, without entering a display name. Recommend clear Sign in / Create account choices; account creation collects the display name once. Sign-in must not overwrite an existing name or create a new account accidentally. Retain the existing code verification, session handling, rate limits, signup availability, optional challenge settings and separate test-account access. Show clear resend/change-email controls and generic responses that do not disclose account existence. Test both new and returning accounts, duplicate signup, expired/incorrect codes, name preservation and narrow screens before release. No new password requirement is proposed.

## Backups and recovery

Current evidence establishes application autosave, revision histories, user workspace downloads and versioned source code. Those are useful layers but do not establish complete operational recovery. The project's current provider plan, backup retention, latest successful restore point, off-site job and restoration procedure have not been verified in this review. Do not present the existing workspace download as a full backup: authenticated imports create independent private map copies, and exports exclude some permissions/drafts.

Before relying on the service for paid client work:

1. Inspect the actual Supabase backup configuration and successful backup history. Define acceptable lost work and restoration time with the owner before choosing a tier or promising service levels.
2. Use managed recovery. Daily backups are a minimum layer for a small pilot; they can lose up to a day's work. For active paid sessions, prefer point-in-time recovery if the budget supports it. If not, assess automated hourly independent backups against the actual acceptable-loss target, rather than claiming daily backups are sufficient. Provider add-ons and compute costs require a concrete cost decision before purchase.
3. Keep encrypted independent backups in a separate storage/account failure domain. A proposed starting retention is 30 daily copies plus 12 weekly copies, adjusted to client retention/deletion commitments. Verify scope explicitly: canonical records, histories, profiles/identity relationships, facilitator grants/drafts/audit, schema/migrations and necessary role/config recovery. Do not assume a default CLI dump includes Auth or every required schema. Store recovery credentials separately with restricted access.
4. Back up any future uploaded files separately; database backups contain Storage metadata, not the file objects. Keep code and deployment/configuration recovery instructions alongside the database runbook, with secrets kept out of Git and ordinary logs.
5. Monitor successful completion and backup age; alert the operator on failed or missing backups. Use checksums/read-back checks and retain copies that a mistaken deletion job cannot immediately erase where practical.
6. Perform an isolated restoration rehearsal before paid use and periodically thereafter. Check actual login/identity restoration, both participants' maps and conversations, permissions, private-pod isolation when introduced, and facilitator attribution. Disable outbound mail/notifications in the restored test environment. Document measured recovery time and the recovery point achieved.
7. Define both whole-service disaster recovery and recovery of an accidentally deleted record/group. Restore into isolation first for investigation or selective recovery; do not roll back every client's production work to recover one map without a reviewed recovery plan.

Provider documentation checked October 21: [Supabase backups](https://supabase.com/docs/guides/platform/backups) describes daily backups on paid plans, free-tier off-site export guidance, point-in-time recovery, restore downtime, and Storage exclusions. At review time its seven-day PITR add-on is approximately $100/month in addition to required plan/compute charges; verify the actual account quote before enabling it. PITR supersedes the provider's separate daily-backup mode; independent logical backups remain a distinct layer.

Current work order: Outline is complete; sign-in cleanup and the activity inbox are planned as separate increments. Pods and operational backups/recovery are deferred at the owner's request. The recovery recommendations above remain requirements to revisit when that work resumes; no backup job, paid provider option or recovery guarantee was enabled by this task.
