# Argument standstill implementation plan

Prepared September 29, 2026; implementation updated September 30, 2026 (UTC). **Implemented locally; release verification is underway.** Live baseline: Worker 60 on `redesign/node-interactions`. The current node-focused Argument canvas and chronological log share the same discussion records. See [deployment status](deployment-status.md) and [the dialogue canvas plan](argument-dialogue-canvas-plan.md).

This increment lets either participant propose that discussion has reached a standstill at a specific node, explain why, and ask the other participant to confirm that account of the impasse. A confirmed standstill records their shared understanding of the present obstacle. It does not establish agreement with the underlying position, decide who is right, or permanently close discussion.

## Agreed behavior

- Use the action **Propose standstill**.
- Require a node attachment and a written explanation answering **Why do you believe this argument cannot move forward at this time?**
- Show **Standstill proposed** with its author until the other participant confirms the current explanation.
- Offer the other participant **Confirm standstill** and **Suggest changes**.
- Show **Standstill confirmed** only when both have accepted the same current explanation: the proposer through submission and the other participant through explicit confirmation.
- Either participant can **Resume discussion**. Keep the proposal, explanation, confirmation and resumption history.
- Keep the standstill local to the identified point. Other branches remain usable.
- Preserve the four dispute categories, existing assessments, source maps and current technology stack. Pods remain deferred.

## Scope and attachment

The current Argument canvas contains a source claim, dispute cards and response/reply cards. For this first implementation, retain both the ordinary source map/node identity and the exact dispute or reply card identifying the sticking point. The source node is mandatory; a free-floating standstill is invalid.

Add Propose standstill to eligible active dispute/reply cards, their detail windows and their entries in the node log. The selected card supplies the attachment automatically. The form shows the source node and the addressed contribution, with their full descriptions available, so the user can verify the attachment before sending.

From the source-node window or the dialogue claim card, offer the same action with a required choice of the relevant existing dispute or reply. Do not guess among several disputes. If no dispute exists, explain that a dispute must be recorded first. This is an implementation default to make the agreed local scope precise; a source node never receives a blanket closed status.

Store the comparison identity as well as the source node, original dispute and addressed contribution/revision. The same source node in another comparison has independent standstills. A linked counterpart does not inherit a standstill.

Exclude frame containers, missing/withdrawn contributions and free-floating notes. Connection-only disputes and the retired Argument graphs are outside this first slice because the current dialogue canvas is node-focused. Several distinct points under one source node can have separate proposals.

## Proposal and response flow

### Propose

Open a compact composer attached to the selected point. Show its source and contribution context, one required explanation field, **Propose standstill**, and Cancel. Trim surrounding spaces; reject blank or whitespace-only explanations and enforce the existing 10,000-character discussion-body limit. Do not add another required category or a separate reason selector.

Submitting creates an attributed proposal. Cancel creates nothing. Keep at most one open proposal by the same author at the same addressed contribution; reopen it for editing instead of creating accidental duplicates. The other participant may maintain a separate proposal if they identify the impasse differently; never merge their explanations automatically.

### Confirm or suggest changes

The other participant reads the full proposed explanation before confirming it. The confirmation helper states: **You are confirming this description of the impasse, not agreeing with the underlying position.** The proposer cannot supply the second person's confirmation.

Suggest changes requires a written suggestion and records it under the proposal with its own author. It does not edit the proposer's explanation or imply confirmation. The proposer can revise their explanation, using the suggestion if appropriate, and submit a new version. The other participant must confirm that new wording explicitly. A suggestion may also be followed by confirmation of the unchanged wording if its author later accepts it.

If the explanation changes after confirmation, the new version returns to Standstill proposed. Earlier confirmation stays visible against the wording it approved. If a participant questions an already confirmed explanation, suggesting changes removes the shared confirmed state until the current explanation is explicitly confirmed again.

### Resume or withdraw

Resume discussion is an explicit action available to either participant on a proposed or confirmed standstill. It records who resumed and when, changes the visible state to **Discussion resumed**, and can focus the ordinary reply control. It does not require permission from the other participant or a new reply. Cancelling a resumption action before submission saves nothing.

It is also available on an accessible proposal marked Needs review after loading its latest saved state. Ending the standstill does not require renewing or confirming changed wording first. Keep the same stale-state checks and privacy boundaries.

Replies remain available throughout: a standstill is an annotation, not a lock. Ordinary replies do not silently alter a proposal, supply confirmation, or rewrite its explanation. Present Resume discussion clearly alongside the existing reply action when a standstill is active. Replies on unrelated branches have no effect on it.

Resumption ends that proposal instance. A later impasse uses a new proposal with a new explanation and confirmation; editing, withdrawing a later event or reloading must never revive an earlier confirmed state.

The proposer can withdraw their own proposal, preserving history. Withdrawal is terminal for that proposal ID, like resumption; a renewed proposal needs a new ID. The other participant uses Resume discussion to end its active status. They cannot edit or withdraw the proposer's explanation. No action deletes the existing Argument.

## State and freshness rules

| Display | Meaning and transition |
| --- | --- |
| Standstill proposed | Current explanation submitted by its author, awaiting the other participant's confirmation; identify any suggested changes. |
| Standstill confirmed | The other participant explicitly confirmed the exact current explanation and reviewed target context. |
| Discussion resumed | Either participant ended this proposal's active standstill; retain it as history and allow a new proposal. |
| Proposal withdrawn | Its author withdrew it; retain authorized history without an active count. |
| Needs review | The attached source or addressed contribution changed; do not present the old confirmation as current. |
| Unavailable | The target was removed, withdrawn or became inaccessible; preserve only history allowed by existing access rules. |

Validate proposal revisions, target snapshots and latest response state at submission. Stale confirmation, suggestion, edit and resume requests must fail clearly while retaining the user's draft or intended action. A changed source requires the proposer to review the updated context and renew the proposal; the other participant then reconfirms. Historical wording does not silently move onto the new source.

A new message elsewhere in the conversation does not by itself invalidate confirmation of the identified point. Changes to its actual source/anchor or explanation do. Display the date and attribution so the marker is understood as an explicit recorded assessment.

Validate the original dispute as well as the selected reply. Withdrawing the dispute makes standstills beneath it unavailable even if individual reply records remain active. Block new proposals, suggestions and confirmations in that unavailable discussion; retain permitted history and narrow own-proposal withdrawal.

Count current proposed and confirmed standstills separately. Show Needs review separately; resumed, withdrawn and unavailable instances are history, not current impasses. A suggestion or confirmation does not count as an additional standstill.

## Presentation across views

- **Argument canvas:** attach a concise text-and-symbol marker to the addressed card. Opening it shows the complete explanation, attribution, response actions and history. Do not create a new dispute/reply card or a reasoning edge for the annotation.
- **Collapsed branches:** show distinct proposed/confirmed standstill counts and provide a reveal action that expands the actual target's ancestors. Do not transfer the marker's meaning to the ancestor.
- **Chronological log and node window:** show the same proposal and response history, including revision-specific confirmation. Keep standstills distinct from dispute and reply counts.
- **Larger map in Argument:** show a compact standstill summary on the original source node. Selecting it lists the points and reveals the selected location in the dialogue. Keep pair agreement badges, Confidence and frame colors independent.
- **Search and navigation:** find current explanations, suggestions, authors and statuses through the existing Argument search. Opening a result uses the authorized source and precise point, restoring folds and selection. Reuse the current comparison/source/contribution route and add proposal identity only where needed to reopen its detail.
- **Refresh and accessibility:** retain camera, visible anchor, focus, scroll and expanded detail state when records change. Include markers in card measurements so text never overlaps and ordinary connections stay straight. Use readable labels as well as color, keyboard-operable controls and usable narrow-screen forms.

Use the existing unsaved-form safeguards on blank clicks, Escape, mode changes and navigation. Failed saves, refresh and competing updates must preserve entered explanations and suggestions. Do not promise a new cross-session draft store or silently submit an existing node/reply draft.

## Saved records and permissions

Use the existing authored discussion collection with a distinct **standstill** record family and versioned metadata, expected initial metadata version **1**. Do not rename or reactivate historical reflection/outcome or Resolve/Reopen records; those remain readable with their original meaning.

Implemented record shape:

| Record | Stored meaning |
| --- | --- |
| Proposal | Author-owned discussion row targeting the mandatory source node, required explanation in body, comparison ID, original dispute ID, fixed addressed contribution identity, original addressed revision and source snapshots. A renewed version separately records the currently reviewed anchor revision. |
| Suggestion | Other-participant-owned discussion row targeting the proposal and its exact revision, with required suggestion text and its exact predecessor in the proposal's shared causal sequence. |
| Confirmation | Other-participant-owned receipt targeting the exact proposal revision and reviewed context. It cannot change the proposal row. |
| Resumption | Receipt authored by either participant ending the proposal instance, retaining the reviewed revision/state and attribution. |

Proposal edits use existing immutable version history. Keep source/comparison/dispute/anchor identity fixed; retargeting requires a new proposal. The original addressed revision remains historical; reviewing an edited anchor advances the reviewed revision only in a new proposal version, requiring fresh confirmation. Keep suggestion, confirmation and resumption records immutable. Correct a suggestion by recording a new attributed suggestion in the shared causal sequence; it cannot modify the proposal.

The pure projection in `dist/standstill.mjs` is shared by every view. Derive display state from authorized records, exact versions, source health and an explicit causal response sequence. Do not decide the current state from client timestamps alone. A suggestion supersedes that participant's earlier confirmation; reconfirmation must explicitly follow it. A resumption ends the complete proposal ID permanently.

Preserve per-author record ownership. The Worker and database validate each actor against the actual two dispute participants, the same comparison/source and the latest saved proposal state. They must reject self-confirmation, outsiders, fabricated anchors/revisions, cross-dispute attachments and stale competing transitions.

Extend privacy projection to follow the new anchor, proposal and causal predecessor references as well as existing target/other references. No hidden node text, reply snapshot, historical explanation or current badge may leak through an otherwise visible attachment. Missing or hidden state dependencies must suppress the shared current-state claim, never fall back to an earlier confirmation. Existing unavailable-source and narrow own-withdrawal behavior must remain consistent.

Use the existing atomic account-save path and snapshot revision checks. Allocate stable IDs before submission; exact retries after a lost acknowledgement must produce one proposal/event. Recompute transitions against the current committed snapshot after competing saves, preserving drafts on a real conflict. Do not overwrite another person's record to represent a shared state.

## Implementation sequence

### 1 Define and test the standstill model

Finalize the record catalog, required fields, target validation, response sequence, health projection and transition rules above. Extend `dist/discussion.mjs`, workspace validation/serialization and account policy without rewriting existing records. Add pure model/API tests before UI integration.

Cover proposal, suggestion, author revision, exact confirmation, retraction through resumption, withdrawal, new proposals after resumption and current/history counts. Pin the expected behavior for concurrent edits and confirmations so all layers agree.

### 2 Add database validation and client compatibility

Implement an additive Supabase migration for the new discussion records and transition checks. Reuse service-only account storage and atomic transactions; preserve invoker security, explicit execution grants and existing access boundaries. Follow the project's Supabase migration workflow and verify against an isolated PostgreSQL database before production application.

Add the distinct client capability `argument-standstill-v1`, in `worker/account-api.mjs` and `dist/account-ui.mjs`. Check current and historical standstill records and incoming changes. An older tab that cannot preserve them receives the established draft-preserving refresh-required response. Earlier record formats stay accepted during the rollout.

Keep the current workspace envelope where compatible. Portable readers must either understand and preserve the new records or clearly reject the unsupported format before any save can strip them; advance the portable schema only if needed to enforce that guarantee.

### 3 Build the composer and detail controls

Add focused `dist/standstill-ui.mjs` controls integrated with `dist/interaction-ui.mjs`, `dist/discussion-ui.mjs` and the existing candidate-commit flow. Implement required attachment/explanation, confirmation, suggested changes, author revision, withdrawal and resumption.

Show the full explanation that confirmation will approve. Block duplicate submissions while saving, retain drafts after failures and bind every action to the revision the user actually reviewed. A successful acknowledgement updates the shared projection once.

### 4 Integrate canvas markers and discovery

Extend `dist/argument-dialogue.mjs` and `dist/argument-dialogue-ui.mjs` with attached standstill projection and refreshed measurements. Keep the existing dispute/reply tree, edges and response counts intact. Include standstill records and current participant names in refresh signatures.

Update `dist/interaction-presentation.mjs`, `dist/interaction-search-ui.mjs`, source-node markers and routing as needed. Ensure the canvas, log, main-map summary and search agree on current state and exact target. Register new modules/styles in client assets, the Worker bundle and standalone export.

### 5 Verify the complete two-person workflow

Add focused tests to the active verification suite, currently **57 checks**; report the actual resulting count.

- Model, Worker and isolated PostgreSQL parity for required source node and explanation, same-point scope, participant permissions, immutable targets, proposal revisions, exact confirmation and causal transitions.
- Two-account browser flow: propose, read from the other account, suggest changes, revise, confirm, refresh/reload both accounts, resume from either side and propose again without resurrecting old confirmation.
- Race cases: simultaneous proposals, proposal edit versus confirmation, suggestion versus confirmation, resume versus edit/confirmation, source edit/withdrawal and exact retry after a lost acknowledgement. No duplicated records, partial shared state or discarded drafts.
- Presentation: several standstills on one node, sibling branches continuing, exact counts across views, collapsed-target reveal, full explanations, history, renamed participants, search/direct links and browser Back/Forward.
- Navigation and reliability: preserve unrelated node/reply drafts, focus, scroll, source selection, folds and cameras; Cancel saves nothing; blank-click/Escape guards remain intact.
- Boundaries: private/unavailable sources and hidden anchor references, old-client behavior, legacy reflection records, portable round trips and unchanged maps, counterpart links, confidence and Agree/Disagree assessments.
- Inspect desktop and narrow-screen captures with long explanations and dense branches. Run the full local and hosted release suites before publication.

### 6 Release and document

Use the existing branch `redesign/node-interactions`. Commit and push the tested implementation, run hosted checks on that exact source, then follow the established additive database and Worker release process. Verify current provider documentation during implementation and preserve existing runtime settings and organizer authorization.

Before applying the production migration, record database content/generation evidence. Verify migration permissions, advisors and unchanged existing application records afterward. Deploy a Worker with the compatible reader and new authoring, then verify exact public assets, account boundaries and live deployment identity.

Once standstill records exist, a rollback must retain their reader, capability checks and validation; the present Worker 60 is not automatically a compatible rollback. Record the actual source, Worker version, migration and verification evidence.

Update this plan, deployment status, current workflow, interaction grammar, next-work plan and the owner testing checklist. Only the approved standstill workflow moves out of the broader resolution deferral. Pods, automatic conclusions, additional dispute categories and unrelated deferred work remain outside scope.

## Completion criteria

A participant can propose a standstill on a specific Argument point with a required explanation. The other participant can suggest changes or confirm the exact current explanation. Both see consistent, attributed markers and history in the canvas, log and source-node summary. Either can resume without closing other branches or changing anyone's map or position. Invalid, stale or unauthorized writes are rejected without losing drafts, and existing records remain readable.

## Implemented contract and verification

`dist/standstill.mjs` defines metadata version 1. Stored actions are `propose_standstill`, `suggest_standstill`, `confirm_standstill` and `resume_standstill`; withdrawal is an authored terminal revision of the proposal. Each explanation version and immutable receipt names the exact preceding `{entryId, version}` across the whole proposal, so timestamps never decide shared state. Receipts include the source snapshot and reviewed anchor/dispute revisions, including when resuming a proposal that needs review.

`dist/standstill-ui.mjs` supplies the composer, exact-wording confirmation, suggestions, revision, withdrawal, resumption and history. Markers attach to existing cards; source-node summaries, collapsed branches, the log and Find use the same state without increasing dispute/reply or legacy graph counts. Portable backups include and validate the same records.

The additive migration is `supabase/migrations/20260930013031_argument_standstill.sql`. It adds invoker functions and a service-only validation trigger without rewriting existing application records. The Worker and account client require `argument-standstill-v1` when current, historical or incoming standstill records exist. Older portable readers reject the unknown kind rather than silently stripping it.

Focused model, real account-policy, isolated PostgreSQL and two-user browser coverage is registered as three additional release checks, for 60 total. Release identity, verification results and rollout evidence are recorded in [deployment status](deployment-status.md) after publication.
