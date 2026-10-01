# Facilitator mode implementation plan

**Implemented; final release verification is in progress.** Worker 61 remains live until the additive migration, exact-source hosted checks and deployment complete. No participants are automatically enabled. See [deployment status](deployment-status.md).

Let the organizer help a participant build their map and take part in a comparison while remaining signed into the organizer's own account. Keep the participant's ownership and decisions distinct from the facilitator's act of entering them. Support spoken instructions and approval during an assisted session, without requiring the participant to operate a device.

## First release scope

Use the existing verified organizer as the sole facilitator. Enable access separately for individual, server-marked test accounts. Ordinary email accounts, multiple facilitators, organizational roles, bulk actions across participants and Pods remain outside this increment. Existing email and test-account sign-in continue unchanged.

The defaults below make the proposed workflow concrete for implementation. Access begins only after permission has actually been received; an account's existence or the organizer having created it is not itself permission to facilitate.

| Action | First release behavior |
| --- | --- |
| Create or edit a participant's map content | Nodes, including frame text, descriptions, details, sources and supported connections, using the existing editor. Keep existing map ownership. |
| Enter dialogue | Current Inquiry actions, disputes, recipient responses and replies, with the represented participant's existing eligibility rules. |
| Record a decision | Confidence, Agree/Disagree/No position, counterpart actions and standstill actions require explicit participant direction, with facilitator attribution. |
| Draft wording for review | Save a proposed new node, node revision, dispute or reply separately from published content. It has no effect on assessments or consensus until approved. |
| Change sharing or remove content | Require an explicit named action showing the participant, scope and consequence. No sharing change follows automatically from enabling facilitation or approving a draft. |
| Account administration | Keep creation/reset controls in the organizer's own account menu. Facilitating does not grant access to credentials, email changes, account deletion or delegation to another facilitator. |

Do not reactivate retired Argument, adoption or outcome-authoring interfaces. Existing request-specific workflows retain their normal rules; audit every exposed mutation and disable it in facilitation until its attribution and permissions are covered. This is a defined set of supported actions, not a blanket ownership bypass.

## Enabling and ending access

Add **Facilitation** to each account in the organizer's Test accounts list. Enabling it records the named participant, named facilitator, scope, time and how permission was received. Offer **Permission received in an assisted session** without inventing participant authentication. Require the organizer to explicitly attest to that permission. Do not enable existing accounts in bulk or silently enable new ones.

The permission screen explains that facilitation includes reading that participant's own private maps and the comparison context they can access, entering content, and recording their stated decisions. It does not make private maps public or provide access through any other participant's grant.

The participant's account menu shows who can facilitate, a small list of pending drafts, and **Stop facilitation**. The organizer can also stop access. Revocation blocks further delegated reads and writes, including already-open forms, pending approvals and retries that would create a new write. Previously saved content and attribution remain. Renewed permission creates a new grant revision and does not silently renew an old session.

## Entering facilitator mode

From the organizer's account menu, choose **Facilitate for…** and select an enabled participant. Preserve the authenticated organizer identity; do not request the participant's password, replace login cookies, or sign into their account.

Display a persistent banner: **Facilitating for Alex · Signed in as Taylor**, with **Exit facilitation**. Show the participant's workspace and permissions, including their maps and their eligible comparison actions. A comparison between Alex and Blair remains between Alex and Blair; Taylor is the recorder, not a third participant.

Switching participants or exiting must use the existing draft safeguards. Finish, save as a facilitator draft where supported, or explicitly discard an unfinished form before switching. Bind pending submissions to the original participant, grant and source revision; never retarget them to the newly selected account. Clear the previous workspace and private caches before loading another context.

Keep the selection local to the tab. Another tab signed in as Taylor remains Taylor's normal workspace unless facilitation is explicitly entered there. Reload requires server revalidation before exposing facilitated content; expired or revoked context returns to the organizer's workspace. An in-flight response from an old context cannot replace a newer context or submit work under it.

## Entered content and facilitator drafts

When creating or changing substantive content, distinguish two explicit choices: **Record Alex's words or instructions** and **Draft for Alex to review**. Default a new facilitator-authored wording proposal to draft; never infer instruction from the selected account. A direction-based submission uses **Record for Alex** and an explicit statement that the entry reflects Alex's instructions. It can publish immediately without an additional participant login.

| State | Display and effect |
| --- | --- |
| Entered at the participant's direction | **Alex · Entered by Taylor**. Saved as Alex's contribution, subject to normal sharing and eligibility. |
| Facilitator draft | **Facilitator draft for Alex**. Visible only to Alex and the currently authorized facilitator; absent from ordinary comparison, dispute and agreement counts. |
| Approved by Alex while signed in | Publish the exact reviewed draft with its original recorder retained; history shows Alex's direct approval. |
| Approved verbally in an assisted session | **Alex · Approval recorded by Taylor**. Record that Taylor attested to Alex's approval of the exact wording. Do not label this as Alex personally clicking confirmation. |
| Declined or withdrawn draft | Retain authorized draft history; publish nothing. The participant can decline, and the facilitator can withdraw their own draft. |

Store drafts separately from canonical map/discussion records. A proposed edit leaves the current node or comment unchanged until approval. A new-node draft may have a clearly labeled preview for the participant and facilitator, but must not enter public layouts, counterpart matching, source snapshots, confidence displays or shared counts. Do not let later canonical contributions target an unpublished draft.

Facilitator autosave may preserve unfinished wording as a private draft. Publishing still requires the explicit Record for Alex or approval action; autosave must not turn new typing into approved participant wording. Further edits after publication form a new pending revision, and earlier approval never applies automatically to the changed text. Ordinary participant autosave retains its current behavior.

Draft approval checks the exact draft version and current destination/source revisions. Changed source content or changed draft wording requires fresh review. Promotion creates or revises the canonical content, its attribution and approval receipt atomically, with one stable operation ID for retries. Group only the dependent writes for that contribution, such as node plus idea version and its parent connection. No bulk approval of unrelated contributions.

Participants can subsequently edit, withdraw or delete their own published content using the usual rules. Preserve who originally entered it and who changed each version. A participant's later edit does not erase facilitator history; an organizer's draft does not overwrite a participant's intervening edit.

## Decisions and two person confirmation

Entering wording, linking counterparts and approving a draft do not imply Agree, confidence or standstill confirmation. Each decision is its own explicit action. In facilitator mode, its submission identifies the represented person and requires recording that person's instruction for the exact current target. Labels such as **Record Alex's agreement** make the operation clear.

Apply the existing dispute-participant and standstill rules to the represented person. Taylor recording Alex's proposal cannot then confirm it as Alex. If Taylor also facilitates Blair with a separate active grant, Taylor may switch to Blair and record Blair's explicit confirmation. Preserve the two distinct participants, the recorder on both actions and the verbal/direct approval method. One submission must never supply both people's decisions.

Agreement displays and confirmed standstill markers may then use the ordinary participant state, while visibly indicating **Facilitated** where either contributing decision was recorded by a facilitator. Details show which person gave each decision and who entered it. This avoids presenting facilitated agreement as two independent authenticated clicks. Unapproved drafts never contribute to either state.

The existing exact-wording, source-review, causal sequence, resumption and withdrawal rules remain in force. Facilitation does not resolve disputes automatically, lock replies, change the four categories or extend the deferred resolution workflow.

## Attribution and saved history

Record both identities explicitly: the participant who owns the content or decision, and the authenticated operator who entered it. Record server time, operation ID, active grant/version, contribution identity/version, entry method and any exact draft approval reference. Display names come from stable account IDs; renaming either person must not lose attribution.

Use small text badges on affected node faces and contributions, with fuller details in their existing inspector/history. Frame nodes, ordinary nodes, comments, confidence, counterpart actions and standstill decisions need attribution appropriate to the action. A comparison pair's facilitated badge should be distinct from its Agree/Disagree state. Avoid changing frame colors or using color alone.

The current map row contains many nodes, while discussion entries already have version histories. Derive actual changes on the server: attribute only the affected nodes, fields and relationships, not every unchanged node in a saved map. Include deletions and earlier versions in immutable audit history. Direct participant edits must preserve prior facilitator records without falsely attributing the new edit to the facilitator.

Audit visibility follows the affected record and its authorized history. A public badge may identify the recorder; it must not expose private drafts, grant notes, unrelated maps or hidden source snapshots. Permission records are visible only to the participant and organizer. Copying a map retains source provenance where supported, but must not claim the new copy was entered or approved by the source's facilitator.

## Server and database design

Introduce an explicit acting context containing authenticated operator, represented participant and current facilitation grant. Normal sessions have the same operator and participant. The server derives the operator from the verified session and checks the existing organizer identity and target test-account status. Do not trust a submitted author ID, display name, editable profile metadata or a browser-only role flag.

Start from `worker/account-api.mjs`, `worker/account-policy.mjs`, `worker/supabase-store.mjs` and `dist/account-ui.mjs`. Extend the request/commit contract deliberately; simply calling today's `commit(actorId, …)` with a selected tester's ID would lose operator identity and is not sufficient. Preserve existing participant-level validators for ownership, source visibility and eligible actions, alongside the separate delegation checks.

Add service-only storage for versioned facilitation grants, facilitator drafts and immutable audit/approval receipts. Choose the final table/record layout during implementation; keep credentials and mutable permission notes outside portable workspace content. Canonical records retain participant ownership and protected attribution references. Old data receives no invented facilitator or consent history.

Use an atomic delegated save path that validates the current grant, target scope, exact source/draft revisions and stable operation ID, then commits canonical changes and audit receipts together. Serialize revocation against delegated commits so a write cannot pass an earlier permission check after revocation wins the transaction. Direct requests must neither fabricate attribution nor remove previous provenance. Replayed writes return their original recorded result without adding history or reviving revoked access.

Retain service-only database access, explicit grants, invoker functions where appropriate and existing row-level protection. Validate both allowed and denied operations in isolated PostgreSQL, including direct RPC attempts. Follow current [Supabase access guidance](https://supabase.com/docs/guides/database/postgres/row-level-security); recheck provider documentation before implementation, generate the migration through the CLI, and inspect advisors before production rollout.

## Compatibility and view integration

Introduce a distinct capability such as `facilitation-v1` for facilitated workspaces and for canonical records containing new provenance. Detect current, historical and incoming metadata. Unsupported older tabs must retain drafts and request refresh; they must not overwrite or discard protected attribution. Advance the portable schema if older readers would otherwise silently strip it.

Audit serialization, validation, map copying, own-backup import, export and source snapshots before choosing that schema change. Portable exports preserve published attribution as historical information, never transferable facilitator authority. Private drafts and permission notes are excluded from shared backups; sensitive exports through facilitator mode require explicit supported scope. Import into an authenticated account retains the current private-map-copy boundary and cannot create trusted approvals, grants or another person's contributions.

Add a focused facilitator module rather than making each view guess the operator. Integrate account context, node-face editing, provisional children, the current Inquiry/Compare/Argument controls, logs, dialogue cards, search and agreement overview. Load and save the same participant state across views. Keep unpublished draft previews separate from the main comparison projections and legacy portable facilitator demo.

## Implemented behavior and boundaries

Account menu → Test accounts → Facilitation enables an individual test account after an explicit permission attestation. Account menu → Facilitation & drafts lists enabled participants and pending drafts. A persistent banner identifies both the represented participant and signed-in organizer. Reload returns to the organizer; selection is local to the tab. Either participant or organizer can stop access.

Map edits are held locally until **Review contribution**. The review defaults to a private draft where supported, or offers **Record for [name]** with a separate direction attestation. Drafts support node wording, disputes and plain replies; confidence, sharing, deletion, assessments, counterpart links and standstill choices require direction. Finish each contribution before editing another node. Discard pending changes is available in the banner. Drafts are immutable review versions: withdraw an obsolete draft and create a revised one. Approval checks source revisions and fails safely if the destination changed.

The participant can approve or decline a draft from their account menu. The organizer can record verbal approval of the exact reviewed wording. Node authorship badges are separate from **Facilitated activity** on a node’s attached conversation and **Facilitated standstill** on a joint state. These badges open contribution history; later participant edits retain historical attribution. The zoomed-out pair label also identifies facilitated assessments. A new portable schema version 7 carries published historical attribution only. Authenticated imports remain private independent copies and cannot import facilitator authority or approval. Grants and private drafts are not included in workspace exports; exports and imports are disabled while facilitating.

Definition authoring and copying both endpoints of a connection from an Inquiry application remain unavailable in facilitation; existing definitions can be read and referenced. Other retired authoring controls remain retired. Ordinary account administration stays in the organizer context. No additional facilitator role or ordinary email-account delegation is introduced.

The additive migration stores grants, immutable draft versions, operation receipts and audit records behind service-only access. Revocation and writes use the existing generation lock. Worker validation applies the represented participant's existing ownership, source and interaction rules; PostgreSQL repeats delegation, scope, version and atomicity checks. Audit rows retain before/after record versions privately; the client receives only authorized contribution metadata. The test suite includes isolated PostgreSQL and browser coverage; all preceding checks remain registered.

## Implementation order

1. Define the acting context, grant lifecycle, permitted actions, draft states and protected provenance model. Add model tests for scope, attribution and promotion before wiring controls.
2. Implement grant management, participant revocation, delegated workspace reads and atomic saves with immutable audit receipts. Add the additive database migration and Worker/database parity tests.
3. Build **Facilitate for…**, the persistent banner, safe context switching and **Exit facilitation**. Verify normal organizer and participant sessions remain unchanged.
4. Integrate node/frame/connection creation and editing, version attribution, separate drafts, direct review and recorded verbal approval. Reuse the existing editor and preserve autosave/retry safeguards.
5. Integrate current dialogue and explicit decisions, including facilitated pair displays and standstill confirmation. Hide any unsupported action until its full path is covered; do not release with an ordinary save path that silently impersonates the participant.
6. Complete copy/import/export and older-client handling, inspect desktop/narrow layouts, and run the full release suite. Document the actual resulting check count rather than assuming it stays 60.
7. After execution is requested, commit and push the tested implementation, run hosted checks on the exact source, apply the additive migration, deploy, verify live assets/access and record release evidence. Preserve runtime settings, organizer identity and existing data. Update workflow, grammar, deployment status, next-work plan and testing checklist.

## Required verification

- Organizer can facilitate only an enabled test account. Ordinary participants, outsiders, forged role/participant fields, disabled grants and expired contexts fail without exposing private data or making partial writes.
- Taylor entering for Alex sees Alex's allowed workspace, not a union of Taylor's or Blair's private workspaces. Switching or revocation clears prior content; stale network responses and another tab cannot change the active represented person.
- Permission can be recorded from an assisted session, and either account can stop facilitation. Revocation racing a write has a defined atomic result, and re-enabling access does not revive stale forms or operations.
- Nodes, frame text, connections, disputes and replies retain participant ownership and visible facilitator attribution. Participant edits and renamed accounts preserve accurate historical identity. Unchanged nodes do not acquire false attribution on autosave.
- Drafts remain private and absent from comparisons and counts. Approval publishes only the exact reviewed version once; rejection publishes nothing. Concurrent participant edits, stale sources, duplicate submissions and lost acknowledgements preserve drafts and reject unsafe promotion.
- A facilitator can assist Alex and Blair through separate contexts. Each Agree/Disagree, confidence or standstill decision is independently directed and attributed. Self-confirmation, single-click bilateral acceptance and unpublished-draft consensus remain impossible.
- Existing source privacy, changed-source warnings, counterpart cardinality, standstill causal history, ongoing replies and participant-only authorization rules still hold.
- Portable round trips preserve historical attribution; old readers cannot strip it; authenticated imports cannot forge trusted facilitation or approval. Browser content, backups and audit endpoints reveal no account credentials or unrelated permission notes.
- Desktop, keyboard and narrow-screen walkthroughs cover creating a child, editing on the node face, pending review, recorded verbal approval, declined navigation, participant switching, reload, simultaneous tabs, failure/retry and exiting facilitation.
- Run all existing checks plus new model, Worker, isolated-database and multi-account browser coverage. Before/after migration evidence must show existing application records unchanged. Verify live behavior without creating production participant content for testing.

## Completion criteria

The organizer can help an enabled participant through the supported map and dialogue workflows while staying signed in as themselves. Readers can tell whose position is represented, who entered it, and whether approval was direct or recorded during facilitation. Drafts cannot masquerade as participant decisions. Either side can stop access, and normal account boundaries, histories and the existing technology stack remain intact.
