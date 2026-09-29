# Argument: four-category prototype plan

Planned, implemented and published September 29, 2026 as **Worker 54**, after all 53 local and 53 hosted checks, the additive database migration and public verification. [Deployment status](deployment-status.md) records the release evidence. This plan supersedes the earlier suggestions to rename Argument actions by target, redesign objection/response displays, or introduce response-status indicators.

## Intended experience

In Argument mode, select another participant's ordinary node or eligible reasoning connection, choose **Dispute reasoning**, select one or more categories, optionally explain the objection or reference a node, and send it. The recipient can read and respond through the existing workflow.

The prototype covers making and responding to arguments. Resolution, closure, settlement and automatic agreement are outside this increment. Keep the current technology stack, canvas, action labels and response choices.

## The four choices

| Category | Short helper text |
| --- | --- |
| Factual basis | Is the claim accurate and supported by evidence? |
| Reasoning | Does the conclusion follow from the reasons and assumptions? |
| Consequences | What results or side effects would follow? |
| Feasibility | Can the proposed action or goal realistically be achieved? |

Show exactly these four checkboxes, in this order, under **What do you dispute?** No preselected category. Require at least one selection; allow multiple selections.

Use this same small set for all currently eligible ordinary nodes in SQ, TA and GS, and for supported reason, cause, addresses and enables connections. Do not add frame-specific submenus, citation-specific additions, a fifth Other option, or a fallacy list. The optional explanation provides room for specificity. A category need not apply to every target; users choose those that apply.

Frame containers, organizational branches and unsupported connection types retain their existing eligibility rules. Shared counterpart adjacency alone does not create a disputable reasoning connection.

Keep the existing **Comment (optional)** field, **Point to a node (optional)** reference control and **Send dispute** action. Do not require new evidence fields or infer a category from the user's text.

## Implementation sequence

### 1. Separate new categories from historical grounds

- Add one canonical four-category catalog with stable identifiers such as `factual_basis`, `reasoning`, `consequences` and `feasibility` in `dist/interaction-grammar.mjs`.
- Version the new dispute grammar explicitly. Retain the existing version-4 catalog for validating and displaying saved disputes and their revisions. New initiating disputes use the new catalog version; unrelated Compare/Inquiry actions and response choices keep their existing behavior.
- Do not reinterpret old grounds as broad categories or infer new hidden Signals tags from them. New categories store the user's explicit choices; retain historical tags as historical data. Keep any required metadata shape consistent in JavaScript and database validation.
- Earlier disputes must retain their original selected grounds, comments, references, authorship, revisions and responses. Viewing or exporting them changes nothing. If an author edits an earlier dispute into the new format, require an explicit selection from the four new categories, retain their comment/reference, and preserve the previous revision. Opening or cancelling that editor must not convert the record.

### 2. Use the four choices throughout Argument

- Update `dist/interaction-ui.mjs` to show the four-checkbox form for new disputes and the explicit editing transition described above. Reuse the current form, optional fields, submission, draft protection and error handling.
- Make saved details, conversation rows, attachment previews and Find display/search the correct catalog for each record's version. Update `dist/interaction-presentation.mjs` and related callers so old labels do not become raw identifiers or disappear.
- Preserve the selected target and actual connection direction. Keep counts, source reveal, mode switching, keyboard return, blank-click dismissal, pan/zoom and portable files working as they do now.
- The intended recipient can respond to new and earlier disputes with the existing outcomes and explanation. A response records that person's position; it does not resolve the argument, change a comparison assessment, join/unjoin counterparts or edit a map automatically.
- Do not expand the response model into arbitrary reply chains in this increment. Existing explicit Review/Apply map-edit operations remain separate and are not presented as argument resolution.

### 3. Update account and database compatibility

- Update model validation, account-write checks, source snapshots, imports and exports to understand both catalogs, including historical revisions and responses to either kind of dispute.
- Add a new additive database migration for the version-aware interaction option and validation functions. Do not edit already-applied migrations or rewrite existing participant records. Inspect the latest function definitions and preserve all intervening integrity and authorization protections.
- Keep client, Worker and database validation aligned: accepted option identifiers, canonical order, no duplicates, minimum one category, metadata version, source eligibility and recipient rules. Reject unknown or mixed-version category identifiers.
- Extend the existing client-capability/refresh-required mechanism before old tabs encounter records they cannot interpret. Preserve unfinished work. Test legacy reads and submissions, including an old open form during rollout; require refresh for obsolete new-dispute submission rather than silently converting it or allowing the retired menu to keep creating new disputes.
- Validate the migration against an isolated database with earlier and new records before production. Check function permissions and security advisors as part of release. No new tables, authentication system, dependencies or technology changes are expected.

### 4. Verify the complete testing workflow

- Model and database checks: every category alone and all combinations; empty, duplicate and unknown selections; supported nodes/connections; ineligible containers/organizational edges; JavaScript/SQL agreement.
- Historical compatibility: old grounds retain their labels and searchability; old responses and revisions survive; explicit edit conversion preserves history; withdrawal does not corrupt either format; backup import/export supports both.
- Two-account browser exchange: create a dispute, save, reload, inspect it as the recipient, respond, and reopen it as the author. Exercise both a node and a connection, multiple categories, optional explanation/reference and existing response outcomes.
- Integrity: ownership, private/unavailable references, changed-source rejection, conflicting edits, retry after a lost acknowledgment, old-tab refresh handling, and drafts across mode changes. Recording a dispute/response must not mutate source maps or comparison assessments.
- Presentation: exact four labels in order across all eligible targets; no old submenus in new forms; narrow-screen and keyboard use; attachment navigation, Find, readable saved details and the portable export.
- Run the complete active release suite, currently 53 checks, with updated focused cases. Add a separate check only if needed for distinct compatibility coverage; report the actual final count.

### 5. Publish when execution is requested

Commit and push the implementation on `redesign/node-interactions`, run hosted verification on that exact source, and use the established database/Worker release sequence. First deploy or stage the compatible reader and capability handling as necessary, apply the additive migration safely, then enable the new authoring flow. Do not introduce a release window in which new records can be written but the serving application cannot read them.

Verify public assets, account protections and deployed settings. Record the actual source, migration, Worker version, verification evidence and rollback requirements in `docs/deployment-status.md`. Once new-format records exist, rollback must retain a reader that understands them; do not assume Worker 53 can read them.

Update `docs/current-argument-workflow.md`, `docs/interaction-grammar-v4.md`, `docs/next-work-plan.md` and `docs/user-testing-checklist.md` to distinguish the new four-category flow from historical grounds. The owner's testing checklist should end with making and responding to an argument, not resolving it.

## Acceptance

- A new dispute offers exactly Factual basis, Reasoning, Consequences and Feasibility, with one or more required and no automatic selection.
- Users can explain/reference their objection, send it, and receive the existing recipient response.
- Saved categories are consistent in details, previews, search, reload and portable files.
- Earlier arguments remain readable with their original meaning and attributed history.
- Source maps, personal assessments and counterpart links do not change merely because an argument or response was recorded.
- No resolution system, action-label redesign, new diagram layout, automatic classification or technology-stack change is added. Existing deferrals remain in place.
