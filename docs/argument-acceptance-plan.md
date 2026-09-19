# Argument mapping: acceptance plan

Prepared for the September 21–25, 2026 work described in [the weekly plan](next-week-plan-2026-09-21.md).

This is the checklist for the forthcoming Argument workflow, not a report that it is implemented or tested. Existing coverage below was identified by reading the tests; no tests were run as part of preparing this document. Baseline execution and release results belong in the deployment and preparation records.

## What success looks like

Two people can explain, question and challenge reasoning within one shared Comparison, follow exactly what each contribution addresses, and return later without losing the discussion or its history. Creating reasoning does not change either person's worldview map.

Use two isolated test accounts, **Alice** and **Bob**, with one shared map each. Use a fresh Comparison with no earlier proposal, shared question, agreement or co-sign. Use disposable local fixtures for automated checks; do not create test contributions in real accounts without separate authorization. The example below is invented test content, not evidence about actual meeting attendance.

## One complete two-person walkthrough

| Step | Action | Required result |
| --- | --- | --- |
| 1. Open the shared Comparison | Alice opens the map pair; Bob opens it from his Comparison list. Alice's source position is **Hold next month's meeting in the evening**. | Both reach the same Comparison. Author names distinguish the source maps. Argument mode is available without first recording a relationship or proposal. |
| 2. Explain the position | Alice selects her position, chooses **Explain my reasoning**, and writes **Evening is when most invited members can attend**, with optional detail. | A saved reason connects toward the position it supports. Its author and purpose are clear. Bob sees it after the normal refresh flow. Neither map acquires or changes a node. |
| 3. Add supporting reasoning | Alice adds **The responses collected so far favor evening** as a reason for her first reason. | The chain is source position ← reason ← further reason. Each contribution has an unambiguous target. Reasons are not counted as open challenges and have no challenge-resolution controls. |
| 4. Challenge the inference | Bob selects the connection between the first reason and the position. He challenges: **Availability for a majority does not establish that evening is suitable for everyone invited. How are the others included?** | The challenge identifies the reasoning connection and both endpoints. It does not appear to dispute the attendance statement itself, the map's parent/child connection, or an agreement between maps. |
| 5. Respond | Alice answers: **I mean a one-month trial with a remote option, rather than a permanent schedule**, explains her reasoning and optionally includes a test reference such as `https://example.org/meeting-notes`. | The response names Alice, points to Bob's exact challenge, and remains connected to the source chain. A reference is part of the explanation; it does not require a separate evidence node or an extra relationship action. Bob can challenge this response if needed. |
| 6. Record an outcome | Alice records **Accept challenge** or **Maintain position**, with an explanation. Bob subsequently marks his challenge resolved, then reopens it with another explanation. | Alice's response never resolves Bob's challenge automatically. Only Bob can resolve or reopen this challenge. The interface identifies who made each decision and never calls it agreement by both people. Earlier outcomes remain readable. |
| 7. Return to the work | Both wait for saving, reload, return through the library and open the same chain. | Reason, connection target, challenge, response, outcome and attribution survive. Both see the same saved record identities. Unsaved text is covered separately below; this step does not promise that drafts survive a browser reload. |

Repeat step 4 by selecting the **reason card**, then by selecting the **source position**. Use **I dispute that most people can attend** and **I disagree with holding the meeting in the evening**, respectively. The three challenges must remain visibly different: challenge to a reason, challenge to a position, and challenge to the reason-to-position connection. A reasoning-error label is Bob's assertion, not a system verdict.

## Interaction and readability checks

- **Stay on the map:** complete the main walkthrough without a side panel. No mandatory question definition, proposal, co-sign, or source-review ceremony appears. Agreement popups do not regain generic Reply, Support or Add evidence actions.
- **Keep context:** Compare and Argument are modes of the same Comparison. Switching preserves the selected source, camera, expanded branches and unfinished composer. **Follow argument** and **Back to source** identify the original source correctly, including when the chain begins at a source edge.
- **Protect drafts:** start a reason, challenge or response; switch modes and Full canvas, resize, and return. Text, references and chosen definitions remain. Leaving the Comparison or opening something that would replace the draft must offer a clear discard decision. Cancel leaves the draft untouched. Background refresh and a save acknowledgement must not overwrite a newer local edit.
- **Keep drafts private:** sign out or switch accounts with an unfinished composer. The next account must not see the previous author's draft, reference choices or private library content. A retained draft must also remain tied to its original Comparison and target.
- **Collapse without disappearance:** collapsing the argument or hiding a contribution type leaves a source indicator. Reasons, inquiries and open challenges have distinguishable counts. Expanding restores the chain, not every unrelated conversation. Collapsing a source branch moves its indicator to the visible ancestor without changing the actual target or its label.
- **One visible edge per displayed pair:** multiple saved meanings share a line with accessible details. A reasoning connection is not doubled by a decorative connector or selection overlay. Collapsed descendants do not create duplicate visible lines. Selecting a grouped line identifies the exact meaning before composing a targeted challenge.
- **Usable geometry:** source, cards, labels and controls remain readable at desktop and a 390-pixel-wide viewport. Automatic placement avoids covering the source with a wall of windows. Pan/zoom stays stable when saving. No manual node dragging is introduced.
- **Keyboard and non-color cues:** open source indicators and select reasoning connections with the keyboard. Focus is visible and returns sensibly after closing. Names and labels distinguish authors, card roles and challenge targets without depending on color. Use modest hover/focus treatment.
- **Keep Compare fixes:** a node with an active counterpart link cannot request another counterpart through the menu or a stale composer. Distinct available connection meanings remain accessible through the single visible edge. Argument changes must not modify counterpart placement or source-map structure.

## Ownership, history and privacy checks

| Case | Acceptance criterion |
| --- | --- |
| Own versus another person's work | Alice can edit or withdraw her reason and response; Bob cannot. Bob can edit or withdraw his challenge; Alice cannot. The server rejects forged edits even if a client constructs them directly. |
| Source wording changes | Edit the source position after the exchange. Existing contributions retain the wording originally addressed, identify the relevant change and show current wording where available. Nothing silently reattaches to the revised claim or rewrites earlier snapshots. |
| Inference endpoint changes | Edit the reason, its supporting reason, and the immediate conclusion separately. A challenge to a reasoning connection preserves the recorded reason version and conclusion wording. It reports a relevant endpoint change rather than presenting old wording as current. |
| Withdrawal or deletion | Withdraw the supported reason or remove a source node. Preserve existing contribution history and make the unavailable target clear. Do not silently substitute a visible ancestor or create a fresh active contribution against a missing or withdrawn target. |
| Private sources | Make either comparison map private. The participant who loses access must not receive new source text, reasoning, responses, references or invoked definitions through the workspace response, a deep link or a descendant contribution. Existing historical behavior follows the established visibility policy; never broaden access as a side effect of the new mode. |
| Source unavailable during a draft | Hide a map or remove the target from the other session before saving. The save fails clearly and retains the local draft. No partially connected contribution is committed. |
| Concurrent editing | Two independent new contributions both survive. Two edits to the same contribution produce a clear conflict rather than overwriting the other version. A rejected save keeps local work recoverable. |
| History integrity | Editing, withdrawing, resolving and reopening preserve authorship, identity, original targets and earlier wording. Tampered histories, forged source snapshots and retargeting an existing reason are rejected. |
| Target integrity | Reject missing entries, cross-Comparison targets, self-reference and cycles. An inference target must identify an actual reason and its supported conclusion, not an arbitrary reply, inquiry or legacy proposal. |
| Atomic save | If creating connected contributions in one operation, save the complete valid chain or nothing. An invalid endpoint or author cannot leave an orphan reason, challenge or partial revision. |

## Definitions and standards

1. Alice creates a private library standard, **Inclusive scheduling**, version 1: **Offer a way to participate for invitees who cannot attend the main session**. She explicitly invokes it in a reason or response.
2. Bob opens the contribution's definitions icon and sees exactly that version and Alice's attribution. He cannot edit the invocation or browse Alice's unused library entries.
3. Alice edits the library to version 2. Bob continues to see the explicitly invoked version 1; the new private wording is absent from his workspace response.
4. Alice explicitly updates this invocation to version 2. History retains version 1, and other uses stay on their own selected versions. A challenge to the changed wording shows the relevant change.
5. Attempts to invoke someone else's private entry, forge the quoted wording or claim a nonexistent version are rejected. Existing definitions invoked on source nodes and edges continue to work.

## Compatibility checks

- Existing on-map relationships, inquiries, challenges, replies, counterpart requests and outcomes retain their IDs, histories and targets. Old records without captured source wording remain readable without inventing a historical snapshot.
- Earlier proposal-based Argument nodes and edges remain available through a clearly labeled **Earlier reasoning** path. Their proposal/version restrictions and older deep links keep working; the new workflow does not automatically convert or rewrite them.
- Keep the new Comparison-based workflow usable when there are no legacy proposals. Old proposal wording is not imposed on new reasons.
- Portable export/open retains both representations and their history. Account import continues to copy permitted map data without impersonating earlier authors or silently recreating their shared contributions.
- New modules are included in the independent build and portable exporter. Existing legacy links never resolve to an unrelated new reason just because labels match.
- The new reader accepts older portable schema versions without rewriting authored records; a version 3 export preserves reasons and inference targets. A stale account client gets a clear refresh-required response before receiving or writing an unsupported workspace, while keeping its unsaved work recoverable. A rollback keeps the compatible reader and saved records; it does not delete new reasoning to accommodate an older client.

## Existing coverage versus tests to add

The following is a source-code inventory, not a current pass/fail result. Existing tests exercise related behavior; they do **not** establish that the forthcoming reason/inference workflow is covered.

| Test area | Coverage already present | Required extension |
| --- | --- | --- |
| Discussion model and account policy — `tests/discussion.test.mjs` | Two-account relationships without proposals, source-edge challenges, replies, authorship, source snapshots/history, URL validation, missing/cyclic entry targets, private-map filtering, portable validation. | New reason actions and inference targets; reason versus challenge classification; own-source reasoning; immutable target; chained reason/response snapshots; cross-thread, withdrawn and forged inference targets. |
| Outcomes and references — `tests/definitions.test.mjs` | Private library entries, pinned invocation versions, forged references, foreign edits, immutable history, challenger-only resolution/reopening, acceptance not implying resolution. | Definition invocation on reasons and responses; invocation edits reflected in contribution snapshots; no resolution controls/counts for reasons; privacy through inference chains. |
| Canvas/browser — `tests/discussion-browser.test.mjs` | Real two-context browser interaction with local in-memory storage: attached counters, edge challenges, relationship contests, responses/resolution, source changes, explicit definition updates, draft protection, collapsed branches, narrow screen and Full canvas. | Add the complete reason → inference challenge → response flow in a dedicated Argument browser walkthrough or a clearly separated extension; compare all three challenge targets, mode preservation, follow/back navigation, keyboard access and visual layout. |
| Edges and counterparts — `tests/conversation-edges.test.mjs`, `tests/counterparts.test.mjs`, `tests/counterpart-browser.test.mjs` | Grouped visible connections and counterpart workflow regression checks. | Apply grouping to reasoning connections and collapsed argument branches; ensure the target chooser distinguishes inference from source-map edges and relationship meanings. |
| Persistence and save conflicts — `tests/account-database.test.mjs`, `tests/account-autosave.test.mjs` | Existing discussion/definition/legacy argument exercises through the local PostgreSQL engine, rejected writes/atomic rollback, save conflicts and in-flight edit preservation. | Exercise new reason and inference validation through the database boundary; validate reference ordering and complete rollback of mixed batches; retain new composers after failed or conflicting saves. |
| Earlier Argument — `tests/argument.test.mjs`, `tests/argument-ui.test.mjs`, `tests/navigation-browser.test.mjs` | Proposal-based reasons/edges, versioned endpoints, foreign-edit rejection, history, source-map invariance, drafts, old routes and two-user reasoning. | Keep as compatibility tests. Add new shared-mode checks separately; legacy graph tests cannot substitute for a new on-map Argument walkthrough. |
| Export and release — `tests/account-build.test.mjs` and the existing portable export walkthrough | Built frontend module graph, routing/security checks and prior portable behavior. | Include new Argument modules, validate new records and both historical representations after export/open, and verify the deployed assets only when a release is authorized and ready. |

The integration design extends current `discussion` records with a reason action and a separately identifiable inference target. A reason's support line is derived from its immutable target; it is not another saved edge record. Initial supported targets are one's own ordinary source node, reason or Argument response. New acceptance tests must follow that representation rather than add a third graph store. See [the integration design](argument-integration-design.md) for the implementation boundary.

## Release evidence to record later

Record the build/revision tested, exact commands and results, browser screenshots for desktop and narrow layouts, the two-account walkthrough result, and any remaining limitations. Check the actual save/reload behavior rather than relying on a screenshot. Only mark a checklist item passed after observing it. A ready first slice includes an inference challenge and response; a reason composer alone is not the complete deliverable.

Manual dragging, pod design, automatic merging, formal premise bundles, multiple pinned windows and reusing one reason across unrelated threads are outside this acceptance pass.
